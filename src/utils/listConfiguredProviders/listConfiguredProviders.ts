/**
 * Narrowing the declared provider directory to the routes a user can pick.
 *
 * `llm.listConfigurableProviders()` answers every route any adapter declares,
 * filled in or not, and an unconfigured route only fails once the user has
 * chosen it and recorded. The two requirements below are the ones the host
 * applies when it resolves the same route for a recording — a base URL and a
 * stored credential — so the picker and the microphone never disagree about
 * what counts as configured.
 * @module dsh-speech-to-text/configured
 */

import { deriveKeyRef } from '../../route'

/** One provider route, as the model directory reports it. */
export interface DirectoryRoute {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: readonly string[]
  defaultBaseURL?: string
  nativeAuth?: { env: readonly string[] }
}

/** One namespace of the settings document, as the browser mirror reports it. */
export interface NamespaceValue {
  ns: string
  value: unknown
}

/** What the credential service says about one reference. */
export interface CredentialState {
  configured: boolean
}

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
function readProfile (namespaces: readonly NamespaceValue[], route: DirectoryRoute): Record<string, unknown> | undefined {
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
 * The profile's own reference wins, exactly as it does host-side; the
 * conventional derived name and any environment the adapter authenticates
 * through on its own are the alternatives a shipped route answers to.
 *
 * @param route the directory entry.
 * @param profile the route's stored profile.
 * @returns reference names, in lookup order.
 */
function keyRefs (route: DirectoryRoute, profile: Record<string, unknown> | undefined): string[] {
  const named = text(profile?.apiKeyEnv)

  return [named || deriveKeyRef(route.provider), ...(route.nativeAuth?.env ?? [])]
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
  routes: readonly DirectoryRoute[],
  namespaces: readonly NamespaceValue[],
  describe: (refs: string[]) => Promise<Record<string, CredentialState> | undefined>,
): Promise<DirectoryRoute[]> {
  const profiles = new Map<string, Record<string, unknown> | undefined>()
  const refs = new Set<string>()

  for (const route of routes) {
    const profile = readProfile(namespaces, route)

    profiles.set(route.provider, profile)
    for (const ref of keyRefs(route, profile)) refs.add(ref)
  }

  const states: Record<string, CredentialState> = {}

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

    return endpoint !== '' && keyRefs(route, profile).some((ref) => states[ref]?.configured === true)
  })
}
