import type { LlmConfigurableProvider } from '../src/dsh'
import { deriveKeyRef, findRoute, resolveEndpoint, RouteError } from '../src/route'
import { createHostStub } from './fixtures/host'

/** One declared route, shaped as `listConfigurableProviders` reports it. */
const entry: LlmConfigurableProvider = {
  provider: 'minimax-cn',
  displayName: 'MiniMax',
  settingsNs: 'dsh-llm-pi-ai',
  settingsPath: ['providers', 'minimax-cn'],
  defaultBaseURL: 'https://api.minimax.example/v1',
}

/** A directory holding `route`, and a settings document holding `profile`. */
function stub (route: LlmConfigurableProvider | undefined, profile: unknown, keys: Record<string, string> = {}) {
  return createHostStub({
    routes: route === undefined ? [] : [route],
    settings: [{ ns: 'dsh-llm-pi-ai', value: { providers: { 'minimax-cn': profile } } }],
    keys,
  })
}

describe('deriveKeyRef', () => {
  it.each([
    ['vllm', 'VLLM_API_KEY'],
    ['minimax-cn', 'MINIMAX_CN_API_KEY'],
    ['api.openai.com', 'API_OPENAI_COM_API_KEY'],
    ['X_AI', 'X_AI_API_KEY'],
  ])('%s becomes %s', (provider, expected) => {
    expect(deriveKeyRef(provider)).toBe(expected)
  })
})

describe('findRoute', () => {
  it('locates a declared route and reports an unknown one as absent', () => {
    const { ctx } = stub(entry, undefined)

    expect(findRoute(ctx, 'minimax-cn')).toBe(entry)
    expect(findRoute(ctx, 'groq')).toBeUndefined()
  })
})

describe('resolveEndpoint', () => {
  it('prefers the stored profile for both the URL and the key reference', async () => {
    const { ctx } = stub(entry, { baseURL: 'http://127.0.0.1:8900/v1///', apiKeyEnv: 'CUSTOM_REF' }, { CUSTOM_REF: 'profile-key' })

    await expect(resolveEndpoint(ctx, 'minimax-cn')).resolves.toEqual({
      provider: 'minimax-cn',
      displayName: 'MiniMax',
      baseURL: 'http://127.0.0.1:8900/v1',
      apiKey: 'profile-key',
    })
  })

  it('falls back to the declared base URL and the conventional key reference', async () => {
    const { ctx } = stub(entry, undefined, { MINIMAX_CN_API_KEY: 'conventional-key' })

    await expect(resolveEndpoint(ctx, 'minimax-cn')).resolves.toMatchObject({
      baseURL: 'https://api.minimax.example/v1',
      apiKey: 'conventional-key',
    })
  })

  it('names the provider, not the route id, in the endpoint it hands back', async () => {
    const { ctx } = stub({ ...entry, provider: 'groq', displayName: 'Groq Cloud' }, undefined, { GROQ_API_KEY: 'k' })

    const endpoint = await resolveEndpoint(ctx, 'groq')

    expect(endpoint.displayName).toBe('Groq Cloud')
    expect(endpoint.provider).toBe('groq')
  })

  it('rejects a route no adapter declares', async () => {
    const { ctx } = stub(undefined, undefined)

    const failure = await resolveEndpoint(ctx, 'deepseek').then(() => undefined, (cause: unknown) => cause)

    expect(failure).toBeInstanceOf(RouteError)
    expect((failure as RouteError).code).toBe('route-unknown')
    expect((failure as RouteError).message).toContain('Settings → Models')
  })

  it('rejects a route with neither a stored nor a declared base URL', async () => {
    const { ctx } = stub({ ...entry, defaultBaseURL: undefined }, {}, { MINIMAX_CN_API_KEY: 'k' })

    const failure = await resolveEndpoint(ctx, 'minimax-cn').then(() => undefined, (cause: unknown) => cause)

    expect((failure as RouteError).code).toBe('route-base-url')
  })

  it('rejects a route without a stored key and never reports the value', async () => {
    const { ctx } = stub(entry, { baseURL: 'http://127.0.0.1:8900/v1' })

    const failure = await resolveEndpoint(ctx, 'minimax-cn').then(() => undefined, (cause: unknown) => cause)

    expect((failure as RouteError).code).toBe('route-key-missing')
    expect((failure as RouteError).message).toContain('Store it in Settings → Models')
  })

  it('treats an empty stored value as no key at all', async () => {
    const { ctx } = stub(entry, { baseURL: 'http://127.0.0.1:8900/v1' }, { MINIMAX_CN_API_KEY: '   ' })

    await expect(resolveEndpoint(ctx, 'minimax-cn')).rejects.toThrow(/no API key/i)
  })
})
