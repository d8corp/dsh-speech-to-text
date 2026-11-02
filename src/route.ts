/**
 * Resolving a provider route chosen in Settings → Models into an endpoint this
 * plugin can call: a base URL and an API key.
 *
 * Neither value is stored by this plugin. The route's profile is read through
 * the settings service, exactly as the official Models page reads it, and the
 * key is resolved per operation through the credentials service, so a key
 * rotated in Settings → Models takes effect on the next recording.
 * @module dsh-speech-to-text/route
 */

import { credentialRef, isCredentialRefName } from '@deepseek-ai/dsh-credentials'

import type { CredentialRef, HostContext, LlmConfigurableProvider } from './dsh'

/** An endpoint ready to be called. */
export interface Endpoint {
  /** Provider route id, kept for error messages. */
  provider: string
  /** Display name of the route. */
  displayName: string
  /** OpenAI-compatible base URL, without a trailing slash. */
  baseURL: string
  /** Secret resolved for this operation only; never returned to the browser. */
  apiKey: string
}

/** A route that cannot be called, described without any secret material. */
export class RouteError extends Error {
  readonly code: string

  constructor (message: string, code: string) {
    super(message)
    this.name = 'RouteError'
    this.code = code
  }
}

/**
 * Conventional credential reference for a provider route.
 *
 * The Models page stores a typed key under this name and records it in the
 * profile as `apiKeyEnv`; the derivation is repeated here only for routes the
 * profile leaves unnamed, which is how an environment-supplied key is found.
 *
 * @param provider - route id, e.g. `minimax-cn`.
 * @returns the reference name, e.g. `MINIMAX_CN_API_KEY`.
 */
export function deriveKeyRef (provider: string): CredentialRef {
  return credentialRef(`${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`)
}

function text (value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The credential reference one route answers to.
 *
 * The profile's own name wins; a name outside the credential grammar has no
 * reference to miss, and an absent one leaves the conventional derived name.
 * Both the recorder and the settings page ask through here, so the picker
 * cannot offer a route the recorder would refuse for a key.
 *
 * @param provider - route id.
 * @param profile - the route's stored profile, when it has one.
 * @returns the reference the key is read from.
 */
export function keyRefOf (provider: string, profile: Record<string, unknown> | undefined): CredentialRef {
  const named = text(profile?.apiKeyEnv)

  return named !== '' && isCredentialRefName(named) ? credentialRef(named) : deriveKeyRef(provider)
}

/**
 * Read one route's stored profile out of the settings snapshot.
 *
 * @param ctx host context.
 * @param entry directory entry naming the namespace and path of the profile.
 * @returns the profile object, or undefined when the route has no stored profile.
 */
function readProfile (ctx: HostContext, entry: LlmConfigurableProvider): Record<string, unknown> | undefined {
  if (entry.settingsNs.length === 0) return undefined

  const descriptor = ctx.settings.describe().find((form) => form.ns === entry.settingsNs)

  if (descriptor === undefined) return undefined

  let node: unknown = descriptor.value

  for (const segment of entry.settingsPath) {
    if (node === null || typeof node !== 'object') return undefined

    node = (node as Record<string, unknown>)[segment]
  }

  return node !== null && typeof node === 'object' && !Array.isArray(node)
    ? node as Record<string, unknown>
    : undefined
}

/**
 * Locate a directory entry for a route id.
 *
 * @param ctx host context.
 * @param provider route id chosen in this plugin's settings.
 * @returns the entry, or undefined when no adapter declares the route.
 */
export function findRoute (ctx: HostContext, provider: string): LlmConfigurableProvider | undefined {
  return ctx.llm.listConfigurableProviders().find((entry) => entry.provider === provider)
}

/**
 * Resolve the endpoint one route answers on.
 *
 * @param ctx host context.
 * @param provider route id.
 * @returns base URL and key, ready for one operation.
 * @throws RouteError when the route is unknown, has no endpoint, or has no stored key.
 */
export async function resolveEndpoint (ctx: HostContext, provider: string): Promise<Endpoint> {
  const entry = findRoute(ctx, provider)
  const displayName = entry?.displayName ?? provider

  if (entry === undefined) {
    throw new RouteError(`Provider "${provider}" is not configured in Settings → Models.`, 'route-unknown')
  }

  const profile = readProfile(ctx, entry)
  const baseURL = text(profile?.baseURL) || text(entry.defaultBaseURL)

  if (baseURL === '') {
    throw new RouteError(
      `Provider "${displayName}" has no base URL. Set one in Settings → Models.`,
      'route-base-url',
    )
  }

  const resolved = await ctx.credentials.resolve(keyRefOf(provider, profile))
  const apiKey = text(resolved?.value)

  if (apiKey === '') {
    throw new RouteError(
      `Provider "${displayName}" has no API key. Store it in Settings → Models.`,
      'route-key-missing',
    )
  }

  return {
    provider,
    displayName,
    baseURL: baseURL.replace(/\/+$/, ''),
    apiKey,
  }
}
