/**
 * OpenAI-compatible audio endpoints: transcription, model listing and the
 * capability probe. Response bodies are never included in an error message —
 * provider payloads can echo request content back, and this text reaches the
 * user's transcript area.
 * @module dsh-speech-to-text/stt
 */
import type { Endpoint } from './route';
/** A provider refusal or transport failure, phrased for the settings page and the recorder. */
export declare class SttError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/**
 * Map an HTTP status onto one fixed message.
 *
 * @param status response status.
 * @param endpoint the endpoint that answered.
 * @returns an error carrying a stable code and no provider payload.
 */
export declare function statusError(status: number, endpoint: Endpoint): SttError;
/**
 * Transcribe one canonical WAV recording.
 *
 * @param endpoint resolved route endpoint.
 * @param options the recording, the model id and an optional language hint.
 * @param signal caller cancellation.
 * @returns the transcript and the wall-clock duration of the call.
 */
export declare function transcribe(endpoint: Endpoint, options: {
    audio: Uint8Array;
    model: string;
    language: string;
}, signal?: AbortSignal): Promise<{
    text: string;
    inferenceSeconds: number;
}>;
/**
 * List the model ids one endpoint advertises.
 *
 * @param endpoint resolved route endpoint.
 * @param signal caller cancellation.
 * @returns model ids, in the endpoint's own order.
 */
export declare function listModels(endpoint: Endpoint, signal?: AbortSignal): Promise<string[]>;
/** What the capability probe concluded about an endpoint. */
export type Capability = 'available' | 'unsupported' | 'unauthorized';
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
export declare function probeTranscriptions(endpoint: Endpoint, signal?: AbortSignal): Promise<Capability>;
