/**
 * OpenAI-compatible audio endpoints: transcription, model listing and the
 * capability probe. Response bodies are never included in an error message —
 * provider payloads can echo request content back, and this text reaches the
 * user's transcript area.
 * @module dsh-speech-to-text/stt
 */

import { DISCOVERY_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from './constants'
import type { Endpoint } from './route'

/** A provider refusal or transport failure, phrased for the settings page and the recorder. */
export class SttError extends Error {
  readonly code: string

  constructor (message: string, code: string) {
    super(message)
    this.name = 'SttError'
    this.code = code
  }
}

/**
 * Combine a caller's cancellation with a request deadline.
 *
 * @param signal caller cancellation, if any.
 * @param timeoutMs deadline for this request.
 * @returns a signal aborted by whichever reason comes first.
 */
function guard (signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const deadline = AbortSignal.timeout(timeoutMs)

  return signal === undefined ? deadline : AbortSignal.any([signal, deadline])
}

/**
 * Map an HTTP status onto one fixed message.
 *
 * @param status response status.
 * @param endpoint the endpoint that answered.
 * @returns an error carrying a stable code and no provider payload.
 */
export function statusError (status: number, endpoint: Endpoint): SttError {
  if (status === 401 || status === 403) {
    return new SttError(`Provider "${endpoint.displayName}" rejected the stored API key.`, 'stt-auth')
  }

  if (status === 404) {
    return new SttError(
      `Provider "${endpoint.displayName}" has no audio transcription endpoint.`,
      'stt-unsupported',
    )
  }

  if (status === 429) {
    return new SttError(`Provider "${endpoint.displayName}" is rate limited. Try again shortly.`, 'stt-rate-limit')
  }

  if (status >= 500) {
    return new SttError(`Provider "${endpoint.displayName}" is unavailable (${status}).`, 'stt-unavailable')
  }

  return new SttError(`Provider "${endpoint.displayName}" refused the request (${status}).`, 'stt-http')
}

/**
 * Run one request and translate transport failures into {@link SttError}s.
 *
 * @param url absolute endpoint URL.
 * @param init fetch options, including the deadline signal.
 * @param endpoint route the call belongs to, used for message wording.
 * @param timeoutMs deadline, for the wording of a timeout.
 * @returns the response, status unjudged.
 */
async function send (
  url: string,
  init: RequestInit,
  endpoint: Endpoint,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (cause) {
    if (init.signal?.aborted === true && (cause as Error).name !== 'TypeError') {
      throw new SttError(
        `Provider "${endpoint.displayName}" did not answer within ${Math.round(timeoutMs / 1000)} s.`,
        'stt-timeout',
      )
    }

    throw new SttError(`Could not reach provider "${endpoint.displayName}".`, 'stt-network')
  }
}

/**
 * Transcribe one canonical WAV recording.
 *
 * @param endpoint resolved route endpoint.
 * @param options the recording, the model id and an optional language hint.
 * @param signal caller cancellation.
 * @returns the transcript and the wall-clock duration of the call.
 */
export async function transcribe (
  endpoint: Endpoint,
  options: { audio: Uint8Array, model: string, language: string },
  signal?: AbortSignal,
): Promise<{ text: string, inferenceSeconds: number }> {
  const body = new FormData()

  body.append('file', new Blob([options.audio as BlobPart], { type: 'audio/wav' }), 'recording.wav')
  body.append('model', options.model)

  if (options.language !== '' && options.language !== 'auto') {
    body.append('language', options.language)
  }

  body.append('response_format', 'json')
  body.append('temperature', '0')

  const started = Date.now()

  const response = await send(
    `${endpoint.baseURL}/audio/transcriptions`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${endpoint.apiKey}` },
      body,
      signal: guard(signal, REQUEST_TIMEOUT_MS),
    },
    endpoint,
    REQUEST_TIMEOUT_MS,
  )

  if (!response.ok) throw statusError(response.status, endpoint)

  const payload: unknown = await response.json().catch(() => undefined)

  const text = payload !== null && typeof payload === 'object'
    ? (payload as { text?: unknown }).text
    : undefined

  if (typeof text !== 'string') {
    throw new SttError(`Provider "${endpoint.displayName}" returned no transcript.`, 'stt-response')
  }

  return { text, inferenceSeconds: Math.round((Date.now() - started) / 100) / 10 }
}

/**
 * List the model ids one endpoint advertises.
 *
 * @param endpoint resolved route endpoint.
 * @param signal caller cancellation.
 * @returns model ids, in the endpoint's own order.
 */
export async function listModels (endpoint: Endpoint, signal?: AbortSignal): Promise<string[]> {
  const response = await send(
    `${endpoint.baseURL}/models`,
    { method: 'GET', headers: { authorization: `Bearer ${endpoint.apiKey}` }, signal: guard(signal, DISCOVERY_TIMEOUT_MS) },
    endpoint,
    DISCOVERY_TIMEOUT_MS,
  )

  if (!response.ok) throw statusError(response.status, endpoint)

  const payload: unknown = await response.json().catch(() => undefined)

  const data = payload !== null && typeof payload === 'object'
    ? (payload as { data?: unknown }).data
    : undefined

  if (!Array.isArray(data)) {
    throw new SttError(`Provider "${endpoint.displayName}" returned no model list.`, 'stt-response')
  }

  return data
    .map((model) => (model !== null && typeof model === 'object' ? (model as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/** What the capability probe concluded about an endpoint. */
export type Capability = 'available' | 'unsupported' | 'unauthorized'

/**
 * Check that a route really serves `/audio/transcriptions`.
 *
 * The probe posts a multipart request with no audio, which a serving endpoint
 * rejects as a missing field and a missing route answers as an unknown path.
 * Only a clear `404` and a rejected key are reported: a rate limit or a
 * temporary server fault says nothing about the route's capabilities, so an
 * unavailable answer would keep a working provider out of reach.
 *
 * @param endpoint resolved route endpoint.
 * @param signal caller cancellation.
 * @returns whether the endpoint serves transcription.
 */
export async function probeTranscriptions (endpoint: Endpoint, signal?: AbortSignal): Promise<Capability> {
  const response = await send(
    `${endpoint.baseURL}/audio/transcriptions`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${endpoint.apiKey}` },
      body: new FormData(),
      signal: guard(signal, DISCOVERY_TIMEOUT_MS),
    },
    endpoint,
    DISCOVERY_TIMEOUT_MS,
  )

  if (response.status === 401 || response.status === 403) return 'unauthorized'
  if (response.status === 404) return 'unsupported'

  return 'available'
}
