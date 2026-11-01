import type { Endpoint } from '../src/route'
import { listModels, probeTranscriptions, statusError, SttError, transcribe } from '../src/stt'
import type { StubHandler, StubServer } from './helpers/server'
import { readMultipart, reply, startSttServer } from './helpers/server'

/** A route whose endpoint is overridden per test with the loopback server. */
const route: Endpoint = {
  provider: 'vllm',
  displayName: 'vLLM',
  baseURL: 'http://127.0.0.1:1',
  apiKey: 'stored-secret',
}

/** One second of canonical 16 kHz mono PCM16 plus its fixed header. */
const audio = new Uint8Array(44 + 32_000)

describe('statusError', () => {
  it('names a fixed code per status and never quotes the provider payload', () => {
    const cases: Array<[number, string]> = [
      [401, 'stt-auth'],
      [403, 'stt-auth'],
      [404, 'stt-unsupported'],
      [429, 'stt-rate-limit'],
      [503, 'stt-unavailable'],
      [400, 'stt-http'],
    ]

    for (const [status, code] of cases) {
      expect(statusError(status, route).code).toBe(code)
      expect(statusError(status, route).message).toContain('vLLM')
    }

    expect(statusError(500, route).message).toContain('(500)')
  })
})

describe('transcribe', () => {
  let server: StubServer
  let respond: StubHandler = (_request, res) => reply(res, 200, { text: '' })

  beforeAll(async () => {
    server = await startSttServer((request, res) => respond(request, res))
  })

  afterAll(async () => server.close())

  beforeEach(() => {
    server.requests.length = 0
    respond = (_request, res) => reply(res, 200, { text: 'привет мир' })
  })

  it('posts the recording as multipart with the model and language', async () => {
    const endpoint = { ...route, baseURL: server.baseURL }

    const result = await transcribe(endpoint, { audio, model: 'whisper-large-v3', language: 'ru' })

    expect(result.text).toBe('привет мир')
    expect(result.inferenceSeconds).toBeGreaterThanOrEqual(0)

    const [request] = server.requests

    expect(request.method).toBe('POST')
    expect(request.url).toBe('/audio/transcriptions')
    expect(request.headers.authorization).toBe('Bearer stored-secret')

    const parts = readMultipart(request)

    expect(parts.filename).toBe('recording.wav')
    expect(parts.contentType).toBe('audio/wav')
    expect(parts.file.length).toBe(audio.length)

    expect(parts.fields).toEqual({
      model: 'whisper-large-v3',
      language: 'ru',
      response_format: 'json',
      temperature: '0',
    })
  })

  it('leaves the language out when detection was asked for', async () => {
    const endpoint = { ...route, baseURL: server.baseURL }

    for (const language of ['auto', '']) {
      await transcribe(endpoint, { audio, model: 'm', language })
    }

    for (const request of server.requests) expect(readMultipart(request).fields.language).toBeUndefined()
  })

  it('reports a refused key without echoing the provider body', async () => {
    respond = (_request, res) => reply(res, 401, { error: 'bad key stored-secret' })

    const failure = await transcribe({ ...route, baseURL: server.baseURL }, { audio, model: 'm', language: 'auto' })
      .then(() => undefined, (cause: unknown) => cause)

    expect(failure).toBeInstanceOf(SttError)
    expect((failure as SttError).code).toBe('stt-auth')
    expect((failure as SttError).message).not.toContain('stored-secret')
    expect((failure as SttError).message).not.toContain('bad key')
  })

  it('rejects a response that carries no transcript', async () => {
    respond = (_request, res) => reply(res, 200, { text: 12 })

    await expect(transcribe({ ...route, baseURL: server.baseURL }, { audio, model: 'm', language: 'auto' }))
      .rejects.toThrow(/no transcript/i)
  })

  it('reports an unreachable provider as a network failure', async () => {
    const failure = await transcribe(route, { audio, model: 'm', language: 'auto' })
      .then(() => undefined, (cause: unknown) => cause)

    expect((failure as SttError).code).toBe('stt-network')
  })
})

describe('listModels', () => {
  let server: StubServer
  let respond: StubHandler = (_request, res) => reply(res, 200, {})

  beforeAll(async () => {
    server = await startSttServer((request, res) => respond(request, res))
  })

  afterAll(async () => server.close())

  beforeEach(() => {
    server.requests.length = 0
  })

  it('returns the advertised ids in the provider order', async () => {
    respond = (_request, res) => reply(res, 200, { object: 'list', data: [{ id: 'whisper-1' }, { id: 'gpt' }, { name: 'x' }] })

    await expect(listModels({ ...route, baseURL: server.baseURL })).resolves.toEqual(['whisper-1', 'gpt'])
    expect(server.requests[0].url).toBe('/models')
  })

  it('fails when the payload is not a list', async () => {
    respond = (_request, res) => reply(res, 200, { models: [] })

    await expect(listModels({ ...route, baseURL: server.baseURL })).rejects.toThrow(/no model list/i)
  })

  it('fails on a missing route the same way a transcription does', async () => {
    respond = (_request, res) => reply(res, 404, { detail: 'Not Found' })

    const failure = await listModels({ ...route, baseURL: server.baseURL }).then(() => undefined, (cause: unknown) => cause)

    expect((failure as SttError).code).toBe('stt-unsupported')
  })
})

describe('probeTranscriptions', () => {
  let server: StubServer
  let respond: StubHandler = (_request, res) => reply(res, 200, {})

  beforeAll(async () => {
    server = await startSttServer((request, res) => respond(request, res))
  })

  afterAll(async () => server.close())

  it.each([[404, 'unsupported'], [401, 'unauthorized'], [403, 'unauthorized'], [400, 'available'], [429, 'available'], [503, 'available']])(
    'reads status %i as %s',
    async (status, expected) => {
      respond = (_request, res) => reply(res, status, { error: 'x' })

      await expect(probeTranscriptions({ ...route, baseURL: server.baseURL })).resolves.toBe(expected)
    },
  )

  it('sends an empty multipart body and the bearer header', async () => {
    respond = (_request, res) => reply(res, 400, {})

    await probeTranscriptions({ ...route, baseURL: server.baseURL })

    const [request] = server.requests

    expect(request.method).toBe('POST')
    expect(request.url).toBe('/audio/transcriptions')
    expect(request.headers.authorization).toBe('Bearer stored-secret')
    expect(readMultipart(request).fields).toEqual({})
  })
})
