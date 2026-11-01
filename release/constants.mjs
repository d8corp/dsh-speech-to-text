// src/constants.ts
/**
* Fixed identifiers and vocabulary shared by the host and browser halves.
* @module dsh-speech-to-text/constants
*/
/**
* Id registered in the global speech-provider registry. It is namespaced
* because ids are global and a duplicate registration throws: the official
* SenseVoice provider uses `sensevoice-local` and other recognizers own
* their own short names.
*/
const PROVIDER_ID = "speech-to-text-universal";
/** Text shown in Plugins → Voice input → Recognition service. */
const PROVIDER_NAME = "Speech to Text";
/** Profile entry id from `cordis.patch.yml`, which is also the settings namespace this plugin owns. */
const SETTINGS_NS = "dsh-speech-to-text";
/**
* Language hints this provider accepts, in picker order.
*
* `configure()` validates the persisted language against the *selected*
* provider, so the list has to cover every value the official selection may
* already hold — including the six codes SenseVoice advertises — or switching
* to this recognizer would fail for users who had picked one of those.
*/
const LANGUAGES = [
	"auto",
	"en",
	"ru",
	"uk",
	"pl",
	"de",
	"fr",
	"es",
	"it",
	"pt",
	"nl",
	"tr",
	"zh",
	"yue",
	"ja",
	"ko"
];
/** Bound on one transcription request. A recording is at most two minutes. */
const REQUEST_TIMEOUT_MS = 6e4;
/** Bound on one endpoint interrogation (model list, capability probe). */
const DISCOVERY_TIMEOUT_MS = 2e4;
/** Canonical recording format the speech service hands to a provider: 16 kHz mono PCM. */
const PCM16_16K_BYTES_PER_SECOND = 32e3;
/**
* Duration of a canonical WAV recording from its byte length.
*
* The service validates the header before the provider is called, so the
* RIFF chunk is a fixed 44 bytes over 16 kHz mono 16-bit samples.
*
* @param byteLength - total encoded size, including the header.
* @returns seconds of audio, rounded to milliseconds.
*/
function wavDurationSeconds(byteLength) {
	const samples = Math.max(0, byteLength - 44);
	return Math.round(samples / PCM16_16K_BYTES_PER_SECOND * 1e3) / 1e3;
}
export { DISCOVERY_TIMEOUT_MS, LANGUAGES, PROVIDER_ID, PROVIDER_NAME, REQUEST_TIMEOUT_MS, SETTINGS_NS, wavDurationSeconds };
