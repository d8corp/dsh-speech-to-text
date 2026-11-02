/**
 * Fixed identifiers and vocabulary shared by the host and browser halves.
 * @module dsh-speech-to-text/constants
 */

import type { SpeechProviderId } from './dsh'

/**
 * Id registered in the global speech-provider registry. It is namespaced
 * because ids are global and a duplicate registration throws: the official
 * SenseVoice provider uses `sensevoice-local` and other recognizers own
 * their own short names.
 *
 * The registry's own `SpeechProviderId` brand is compile-time only; the cast
 * keeps it without a runtime import of `dsh-brand`, which this plugin does not
 * declare.
 */
export const PROVIDER_ID = 'speech-to-text-universal' as SpeechProviderId

/** Text shown in Plugins → Voice input → Recognition service. */
export const PROVIDER_NAME = 'Speech to Text'

/** Profile entry id from `cordis.patch.yml`, which is also the settings namespace this plugin owns. */
export const SETTINGS_NS = 'dsh-speech-to-text'

/** Recognizer selected when this plugin's switcher turns off. */
export const FALLBACK_PROVIDER_ID = 'sensevoice-local' as SpeechProviderId

/**
 * Language hints this provider accepts, in picker order.
 *
 * `configure()` validates the persisted language against the *selected*
 * provider, so the list has to cover every value the official selection may
 * already hold — including the six codes SenseVoice advertises — or switching
 * to this recognizer would fail for users who had picked one of those.
 */
export const LANGUAGES = [
  'auto', 'en', 'ru', 'uk', 'pl', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'tr', 'zh', 'yue', 'ja', 'ko',
] as const

/** English labels for {@link LANGUAGES}; `auto` is the detection option. */
export const LANGUAGE_LABELS: Record<string, string> = {
  auto: 'Auto-detect',
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
  pl: 'Polish',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  tr: 'Turkish',
  zh: 'Chinese',
  yue: 'Cantonese',
  ja: 'Japanese',
  ko: 'Korean',
}

/** Bound on one transcription request. A recording is at most two minutes. */
export const REQUEST_TIMEOUT_MS = 60_000

/** Bound on one endpoint interrogation (model list, capability probe). */
export const DISCOVERY_TIMEOUT_MS = 20_000

/** Canonical recording format the speech service hands to a provider: 16 kHz mono PCM. */
const PCM16_16K_BYTES_PER_SECOND = 32_000

/**
 * Duration of a canonical WAV recording from its byte length.
 *
 * The service validates the header before the provider is called, so the
 * RIFF chunk is a fixed 44 bytes over 16 kHz mono 16-bit samples.
 *
 * @param byteLength - total encoded size, including the header.
 * @returns seconds of audio, rounded to milliseconds.
 */
export function wavDurationSeconds (byteLength: number): number {
  const samples = Math.max(0, byteLength - 44)

  return Math.round((samples / PCM16_16K_BYTES_PER_SECOND) * 1000) / 1000
}
