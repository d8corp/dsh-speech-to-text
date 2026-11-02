import type { CredentialInfo, LlmConfigurableProvider, SettingsNamespaceView } from '../src/dsh'
import { listConfiguredProviders } from '../src/utils'

/** One declared route, shaped as the model directory reports it. */
const route: LlmConfigurableProvider = {
  provider: 'minimax-cn',
  displayName: 'MiniMax',
  settingsNs: 'dsh-llm-pi-ai',
  settingsPath: ['providers', 'minimax-cn'],
}

const LLM_NS = 'dsh-llm-pi-ai'

/** A route profile, as the redacted settings document reports it. */
type Profile = { [key: string]: string }

/** A settings document holding one profile for `route`, as the browser mirror reports it. */
function document (profile?: Profile): SettingsNamespaceView[] {
  return [{
    ns: LLM_NS,
    autoGenerate: true,
    schema: {},
    value: { providers: { 'minimax-cn': profile ?? {} } },
    applies: 'live',
    secrets: [],
    revision: 1,
  }]
}

/** A credential service reporting `configured` references as set, and the batches it saw. */
function credentials (...configured: string[]) {
  const asked: string[][] = []

  const read = async (refs: string[]) => {
    asked.push(refs)

    const answer: Record<string, CredentialInfo> = {}

    for (const ref of refs) {
      answer[ref] = { configured: configured.includes(ref), writable: true }
    }

    return answer
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
      [{ ...route, provider: 'x-ai', defaultBaseURL: 'https://api.x.example/v1', nativeAuth: { env: ['XAI_API_KEY'], oauth: false } }],
      document(undefined),
      read,
    )

    expect(kept).toHaveLength(1)
  })

  it('asks for every reference in one batch', async () => {
    const { asked, read } = credentials()
    const other: LlmConfigurableProvider = { ...route, provider: 'vllm', settingsPath: ['providers', 'vllm'] }

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
