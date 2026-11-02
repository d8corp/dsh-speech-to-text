/**
 * dsh-speech-to-text — host plugin entry.
 *
 * Registers one recognizer, `Speech to Text`, into the official speech registry
 * for as long as this plugin is composed: the picker entry depends on the
 * plugin being installed, never on the switcher. The switcher the settings page
 * shows is a mirror of the selection the voice-input bundle owns
 * (`speech-to-text.defaultProvider`), so this plugin stores no enable flag of
 * its own and cannot disagree with Plugins → Voice input.
 *
 * What this plugin owns is the two values no official surface has a place for:
 * which provider route recognizes, and which of its models. Keys, base URLs and
 * the recognition language are read from the services that own them, so nothing
 * here can hold a credential.
 */

import z from '@deepseek-ai/schemastery'

import { LANGUAGES, PROVIDER_ID, PROVIDER_NAME, SETTINGS_NS, wavDurationSeconds } from './constants'
import type { HostContext, LlmDiscoveredModel, LlmModelDiscoveryRequest, SpeechProvider, Volatile } from './dsh'
import { resolveEndpoint } from './route'
import { listModels, probeTranscriptions, SttError, transcribe } from './stt'

/** Editable configuration of this entry; both fields hot-apply. */
export const Config = z.object({
  provider: z.string().default('').volatile(),
  model: z.string().default('').volatile(),
})

/** Live view of {@link Config} handed to `apply`. */
export interface RuntimeConfig {
  provider: Volatile<string>
  model: Volatile<string>
}

/** Plugin identity in the composed profile, and the namespace its settings page edits. */
export const name = SETTINGS_NS

/** Services this plugin needs before mounting. */
export const inject = ['speechToText', 'llm', 'settings', 'credentials']

/**
 * Build the recognizer registered into `ctx.speechToText`.
 *
 * @param ctx host context.
 * @param config live configuration of this entry.
 * @returns the speech provider.
 */
export function createProvider (ctx: HostContext, config: RuntimeConfig): SpeechProvider {
  return {
    info: {
      id: PROVIDER_ID,
      name: PROVIDER_NAME,
      location: 'cloud',
      languages: LANGUAGES,
    },

    async transcribe (input, signal) {
      const provider = config.provider.get()
      const model = config.model.get()

      if (provider === '' || model === '') {
        throw new SttError(
          `Choose a ${provider === '' ? 'provider' : 'model'} in Settings → Speech to Text.`,
          'stt-incomplete',
        )
      }

      const endpoint = await resolveEndpoint(ctx, provider)

      const result = await transcribe(endpoint, {
        audio: input.audio,
        model,
        language: input.language,
      }, signal)

      return {
        text: result.text,
        audioSeconds: wavDurationSeconds(input.audio.byteLength),
        inferenceSeconds: result.inferenceSeconds,
      }
    },
  }
}

/**
 * Build the responder that lists one provider route's models.
 *
 * Served under this plugin's own namespace, which is how the settings page
 * reaches it through `remote.llm.discoverModels` without a bespoke endpoint.
 * The route is probed first, so a provider that does not serve transcription is
 * named at the moment the user selects it rather than after they record.
 *
 * @param ctx host context.
 * @returns the model discovery responder.
 */
export function createDiscovery (
  ctx: HostContext,
): (request: LlmModelDiscoveryRequest, signal?: AbortSignal) => Promise<LlmDiscoveredModel[]> {
  return async (request, signal) => {
    const provider = (request.provider ?? '').trim()

    if (provider === '') throw new SttError('Choose a provider first.', 'stt-incomplete')

    const endpoint = await resolveEndpoint(ctx, provider)
    const capability = await probeTranscriptions(endpoint, signal)

    if (capability === 'unsupported') {
      throw new SttError(
        `Provider "${endpoint.displayName}" has no audio transcription endpoint. Choose another provider.`,
        'stt-unsupported',
      )
    }

    if (capability === 'unauthorized') {
      throw new SttError(
        `Provider "${endpoint.displayName}" rejected the stored API key. Update it in Settings → Models.`,
        'stt-auth',
      )
    }

    const models = await listModels(endpoint, signal)

    return models.map((id): LlmDiscoveredModel => ({ id }))
  }
}

/**
 * Mount the page policy, the recognizer and the model interrogation.
 *
 * @param ctx host context.
 * @param config live configuration of this entry.
 */
export function apply (ctx: HostContext, config: RuntimeConfig): void {
  // This plugin draws its own page; the schema-derived automatic page would
  // offer two raw text fields instead of a provider and model picker.
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), 'dsh-speech-to-text: page policy')

  ctx.effect(() => ctx.speechToText.register(createProvider(ctx, config)), 'dsh-speech-to-text: provider')

  ctx.effect(
    () => ctx.llm.registerModelDiscovery(SETTINGS_NS, createDiscovery(ctx)),
    'dsh-speech-to-text: model discovery',
  )
}
