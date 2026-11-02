import type { CredentialState, DirectoryRoute, NamespaceValue } from '../src/utils'
import { listConfiguredProviders } from '../src/utils'

/** One declared route, shaped as the model directory reports it. */
const route: DirectoryRoute = {
  provider: 'minimax-cn',
  displayName: 'MiniMax',
  settingsNs: 'dsh-llm-pi-ai',
  settingsPath: ['providers', 'minimax-cn'],
}

const LLM_NS = 'dsh-llm-pi-ai'

/** A settings document holding one profile for `route`. */
function document (profile: unknown): NamespaceValue[] {
  return [{ ns: LLM_NS, value: { providers: { 'minimax-cn': profile } } }]
}

/** A credential service reporting `configured` references as set, and the batches it saw. */
function credentials (...configured: string[]) {
  const asked: string[][] = []

  const read = async (refs: string[]) => {
    asked.push(refs)

    return Object.fromEntries(refs.map((ref): [string, CredentialState] => [ref, { configured: configured.includes(ref) }]))
  }

  return { asked, read }
}

describe('listConfiguredProviders', () => {
  it('keeps a shipped route the moment its key is stored', async () => {
    const { read } = credentials('MINIMAX_CN_API_KEY')

    const kept = await listConfiguredProviders([{ ...route, defaultBaseURL: 'https://api.minimax.example/v1' }], document(undefined), read)

    expect(kept.map((entry) => entry.provider)).toEqual(['minimax-cn'])
  })

  it('drops a route that has an endpoint but no key', async () => {
    const { read } = credentials()

    const kept = await listConfiguredProviders([{ ...route, defaultBaseURL: 'https://api.minimax.example/v1' }], document({}), read)

    expect(kept).toEqual([])
  })

  it('drops a route that has a key but no endpoint to call', async () => {
    const { read } = credentials('MINIMAX_CN_API_KEY')

    expect(await listConfiguredProviders([route], document({}), read)).toEqual([])
  })

  it('reads the endpoint and the reference of a hand-added route from its profile', async () => {
    const { asked, read } = credentials('GATEWAY_TOKEN')

    const kept = await listConfiguredProviders([route], document({ baseURL: 'https://gateway.example/v1', apiKeyEnv: 'GATEWAY_TOKEN' }), read)

    expect(kept).toHaveLength(1)
    expect(asked[0]).toEqual(['GATEWAY_TOKEN'])
  })

  it('counts an environment the adapter authenticates through as a key', async () => {
    const { read } = credentials('XAI_API_KEY')

    const kept = await listConfiguredProviders(
      [{ ...route, provider: 'x-ai', defaultBaseURL: 'https://api.x.example/v1', nativeAuth: { env: ['XAI_API_KEY'] } }],
      document(undefined),
      read,
    )

    expect(kept).toHaveLength(1)
  })

  it('asks for every reference in one batch', async () => {
    const { asked, read } = credentials()
    const other: DirectoryRoute = { ...route, provider: 'vllm', settingsPath: ['providers', 'vllm'] }

    await listConfiguredProviders([route, other], document({}), read)

    expect(asked).toEqual([['MINIMAX_CN_API_KEY', 'VLLM_API_KEY']])
  })

  it('keeps the whole directory when the credential service cannot answer', async () => {
    const kept = await listConfiguredProviders([route], document({}), async () => {
      throw new Error('credentials unavailable')
    })

    expect(kept).toEqual([route])
  })
})
