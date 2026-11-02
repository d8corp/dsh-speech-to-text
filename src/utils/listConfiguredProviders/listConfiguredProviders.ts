/**
 * Narrowing the declared provider directory to the routes a user can pick.
 *
 * `llm.listConfigurableProviders()` answers every route any adapter declares,
 * filled in or not, and an unconfigured route only fails once the user has
 * chosen it and recorded. The two requirements below are the ones the host
 * applies when it resolves the same route for a recording — a base URL and a
 * stored credential, through the same {@link keyRefOf} — so the picker and the
 * microphone never disagree about what counts as configured.
 * @module dsh-speech-to-text/configured
 */

import type { CredentialInfo, LlmConfigurableProvider, SettingsNamespaceView } from '../../dsh'
import { keyRefOf } from '../../route'

/** Read a string out of an untyped settings node. */
function text (value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Walk a route's profile out of the settings document.
 *
 * @param namespaces every namespace the mirror holds.
 * @param route the directory entry naming the namespace and path of the profile.
 * @returns the profile object, or undefined when nothing is stored for the route.
 */
function readProfile (namespaces: readonly SettingsNamespaceView[], route: LlmConfigurableProvider): Record<string, unknown> | undefined {
  const view = namespaces.find((namespace) => namespace.ns === route.settingsNs)

  if (view === undefined) return undefined

  let node: unknown = view.value

  for (const segment of route.settingsPath) {
    if (node === null || typeof node !== 'object') return undefined

    node = (node as Record<string, unknown>)[segment]
  }

  return node !== null && typeof node === 'object' && !Array.isArray(node)
    ? node as Record<string, unknown>
    : undefined
}

/**
 * The credential references that can authenticate one route.
 *
 * The route's own reference comes from {@link keyRefOf}, the same rule the
 * recorder follows; the environment variables the adapter authenticates
 * through on its own are alternatives a shipped route answers to.
 *
 * @param route the directory entry.
 * @param profile the route's stored profile.
 * @returns reference names.
 */
function routeKeyRefs (route: LlmConfigurableProvider, profile: Record<string, unknown> | undefined): string[] {
  return [keyRefOf(route.provider, profile), ...(route.nativeAuth?.env ?? [])]
}

/**
 * Keep the routes that have both an endpoint and a credential.
 *
 * When the credential service cannot be read the directory is returned whole:
 * a transport fault must not empty the picker, and a route that turns out to
 * have no key still reports why the moment it is selected.
 *
 * @param routes every declared route, in declaration order.
 * @param namespaces the settings document as the browser mirror holds it.
 * @param describe the credential service's batched describe.
 * @returns the routes Settings → Models has configured, in the same order.
 */
export async function listConfiguredProviders (
  routes: readonly LlmConfigurableProvider[],
  namespaces: readonly SettingsNamespaceView[],
  describe: (refs: string[]) => Promise<Record<string, CredentialInfo> | undefined>,
): Promise<LlmConfigurableProvider[]> {
  const profiles = new Map<string, Record<string, unknown> | undefined>()
  const refs = new Set<string>()

  for (const route of routes) {
    const profile = readProfile(namespaces, route)

    profiles.set(route.provider, profile)
    for (const ref of routeKeyRefs(route, profile)) refs.add(ref)
  }

  const states: Record<string, CredentialInfo> = {}

  try {
    const batch = [...refs]

    // The credential service answers a bounded list, so long directories are read in chunks.
    for (let index = 0; index < batch.length; index += 64) {
      Object.assign(states, await describe(batch.slice(index, index + 64)) ?? {})
    }
  } catch {
    return [...routes]
  }

  return routes.filter((route) => {
    const profile = profiles.get(route.provider)
    const endpoint = text(profile?.baseURL) || text(route.defaultBaseURL)

    return endpoint !== '' && routeKeyRefs(route, profile).some((ref) => states[ref]?.configured === true)
  })
}
