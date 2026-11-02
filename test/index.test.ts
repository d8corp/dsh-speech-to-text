import { FALLBACK_PROVIDER_ID, LANGUAGES, PROVIDER_ID, PROVIDER_NAME, SETTINGS_NS } from '../src/constants'
import type { LlmConfigurableProvider, SpeechInput } from '../src/dsh'
import { apply, Config, createDiscovery, createProvider, inject, name } from '../src/index'
import type { SttError } from '../src/stt'
import { createConfigStub, createHostStub } from './fixtures/host'
import type { StubHandler, StubServer } from './helpers/server'
import { readMultipart, reply, startSttServer } from './helpers/server'

/** The route the settings page would have selected. */
const route: LlmConfigurableProvider = {
  provider: 'vllm',
  displayName: 'vLLM',
  settingsNs: 'dsh-llm-pi-ai',
  settingsPath: ['providers', 'vllm'],
}

/** One recording, as the speech service hands it over: two seconds of audio. */
const input: SpeechInput = { audio: new Uint8Array(44 + 64_000), language: 'auto' }

/** The cancellation the speech service always supplies alongside a recording. */
const signal = new AbortController().signal

/** A host in which `route` is stored pointing at `baseURL`, with a key. */
function host (baseURL: string) {
  return createHostStub({
    routes: [route],
    settings: [{ ns: 'dsh-llm-pi-ai', value: { providers: { vllm: { baseURL } } } }],
    keys: { VLLM_API_KEY: 'test-key' },
  })
}

/**
 * Run a body against a loopback endpoint.
 *
 * @param respond how the endpoint answers.
 * @param body test body, given the server.
 */
async function withEndpoint (respond: StubHandler, body: (server: StubServer) => Promise<void>) {
  const server = await startSttServer(respond)

  try {
    await body(server)
  } finally {
    await server.close()
  }
}

/** The fields a configuration entry declares, as schemastery keeps them. */
interface ConfigField {
  meta?: { volatile?: boolean, default?: unknown }
}

/** Reject a promise and hand back the cause. */
async function reason (promise: Promise<unknown>): Promise<unknown> {
  return promise.then(() => undefined, (cause: unknown) => cause)
}

describe('entry metadata', () => {
  it('is named after its profile entry and injects only reading services', () => {
    expect(name).toBe(SETTINGS_NS)
    expect(inject).toEqual(['speechToText', 'llm', 'settings', 'credentials'])
  })

  it('owns exactly two values, both hot-applying', () => {
    const fields = (Config as unknown as { dict: Record<string, ConfigField> }).dict

    expect(Object.keys(fields)).toEqual(['provider', 'model'])

    for (const field of Object.values(fields)) {
      expect(field.meta?.volatile).toBe(true)
      expect(field.meta?.default).toBe('')
    }
  })

  it('accepts every language the official selection may already hold', () => {
    // SenseVoice's own list, so switching off and on again cannot strand a saved choice.
    for (const code of ['auto', 'zh', 'en', 'yue', 'ja', 'ko']) expect(LANGUAGES).toContain(code)
    expect(LANGUAGES).toContain('ru')
    expect(PROVIDER_ID).not.toBe(FALLBACK_PROVIDER_ID)
  })
})

describe('createProvider', () => {
  it('advertises the picker entry the plugin is installed for', () => {
    const { ctx } = host('http://127.0.0.1:1')

    const provider = createProvider(ctx, createConfigStub({ provider: 'vllm', model: 'whisper-1' }))

    expect(provider.info).toEqual({
      id: PROVIDER_ID,
      name: PROVIDER_NAME,
      location: 'cloud',
      languages: LANGUAGES,
    })
  })

  it('asks for what the user has not chosen yet, without any network call', async () => {
    await withEndpoint((_request, res) => reply(res, 200, { text: 'never' }), async (server) => {
      const { ctx } = host(server.baseURL)
      const config = { provider: '', model: 'whisper-1' }

      const noProvider = await reason(createProvider(ctx, createConfigStub(config)).transcribe(input, signal))

      expect((noProvider as SttError).code).toBe('stt-incomplete')
      expect((noProvider as SttError).message).toMatch(/choose a provider in settings/i)

      config.provider = 'vllm'
      config.model = ''

      const noModel = await reason(createProvider(ctx, createConfigStub(config)).transcribe(input, signal))

      expect((noModel as SttError).message).toMatch(/choose a model in settings/i)
      expect(server.requests).toHaveLength(0)
    })
  })

  it('transcribes through the selected route and reports the audio duration', async () => {
    await withEndpoint((_request, res) => reply(res, 200, { text: 'двадцать две секунды' }), async (server) => {
      const { ctx } = host(server.baseURL)

      const result = await createProvider(ctx, createConfigStub({ provider: 'vllm', model: 'whisper-1' })).transcribe(input, signal)

      expect(result.text).toBe('двадцать две секунды')
      expect(result.audioSeconds).toBe(2)

      const [request] = server.requests

      expect(request.headers.authorization).toBe('Bearer test-key')
      expect(readMultipart(request).fields.model).toBe('whisper-1')
    })
  })

  it('reads the configuration on every call, so a setting change needs no remount', async () => {
    await withEndpoint((_request, res) => reply(res, 200, { text: 'ok' }), async (server) => {
      const { ctx } = host(server.baseURL)
      const values = { provider: 'vllm', model: 'whisper-1' }
      const provider = createProvider(ctx, createConfigStub(values))

      await provider.transcribe(input, signal)
      values.model = 'paraformer'
      await provider.transcribe(input, signal)

      expect(readMultipart(server.requests[1]).fields.model).toBe('paraformer')
    })
  })

  it('keeps a route failure free of the stored key', async () => {
    await withEndpoint((_request, res) => reply(res, 401, { detail: 'bad test-key' }), async (server) => {
      const { ctx } = host(server.baseURL)

      const failure = await reason(createProvider(ctx, createConfigStub({ provider: 'vllm', model: 'm' })).transcribe(input, signal))

      expect((failure as SttError).code).toBe('stt-auth')
      expect((failure as SttError).message).not.toContain('test-key')
    })
  })
})

describe('createDiscovery', () => {
  it('refuses to interrogate without a provider', async () => {
    const { ctx } = host('http://127.0.0.1:1')

    await expect(createDiscovery(ctx)({})).rejects.toThrow(/choose a provider/i)
    await expect(createDiscovery(ctx)({ provider: '  ' })).rejects.toThrow(/choose a provider/i)
  })

  it('lists the models of a route that serves transcription', async () => {
    await withEndpoint((request, res) => {
      if (request.url === '/models') reply(res, 200, { data: [{ id: 'whisper-large-v3' }, { id: 'sensevoice' }] })
      else reply(res, 400, { detail: 'file required' })
    }, async (server) => {
      const { ctx } = host(server.baseURL)

      await expect(createDiscovery(ctx)({ provider: 'vllm' })).resolves.toEqual([
        { id: 'whisper-large-v3' },
        { id: 'sensevoice' },
      ])
    })
  })

  it('says the route has no transcription endpoint instead of listing its text models', async () => {
    await withEndpoint((request, res) => {
      if (request.url === '/models') reply(res, 200, { data: [{ id: 'gpt' }] })
      else reply(res, 404, { detail: 'Not Found' })
    }, async (server) => {
      const { ctx } = host(server.baseURL)

      const failure = await reason(createDiscovery(ctx)({ provider: 'vllm' }))

      expect((failure as SttError).code).toBe('stt-unsupported')
      expect((failure as SttError).message).toMatch(/no audio transcription endpoint/)
    })
  })

  it('reports a rejected key from the probe', async () => {
    await withEndpoint((request, res) => {
      if (request.url === '/models') reply(res, 200, { data: [] })
      else reply(res, 401, { detail: 'invalid api key' })
    }, async (server) => {
      const { ctx } = host(server.baseURL)

      await expect(createDiscovery(ctx)({ provider: 'vllm' })).rejects.toThrow(/rejected the stored API key/)
    })
  })

  it('fails when the route has no key stored', async () => {
    const { ctx } = createHostStub({
      routes: [route],
      settings: [{ ns: 'dsh-llm-pi-ai', value: { providers: { vllm: { baseURL: 'https://api.example.invalid/v1' } } } }],
    })

    await expect(createDiscovery(ctx)({ provider: 'vllm' })).rejects.toThrow(/no API key/i)
  })
})

describe('apply', () => {
  it('mounts the page policy, the recognizer and the model interrogation', () => {
    const { ctx, recorded, providers, discoveries } = host('http://127.0.0.1:1')

    apply(ctx, createConfigStub({ provider: '', model: '' }))

    expect(recorded).toEqual([
      { kind: 'page-policy', detail: { auto: false } },
      { kind: 'register', detail: PROVIDER_ID },
      { kind: 'discovery', detail: SETTINGS_NS },
    ])

    expect(providers).toHaveLength(1)
    expect(discoveries).toHaveLength(1)
  })
})
