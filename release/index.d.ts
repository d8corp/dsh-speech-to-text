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
import z from '@deepseek-ai/schemastery';
import type { DiscoveredModel, HostContext, ModelDiscoveryRequest, SpeechProvider, Volatile } from './dsh';
/** Editable configuration of this entry; both fields hot-apply. */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    provider: z<string, string, "volatile-defined">;
    model: z<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    provider: z<string, string, "volatile-defined">;
    model: z<string, string, "volatile-defined">;
}>>, "plain">;
/** Live view of {@link Config} handed to `apply`. */
export interface RuntimeConfig {
    provider: Volatile<string>;
    model: Volatile<string>;
}
/** Plugin identity in the composed profile, and the namespace its settings page edits. */
export declare const name = "dsh-speech-to-text";
/** Services this plugin needs before mounting. */
export declare const inject: string[];
/**
 * Build the recognizer registered into `ctx.speechToText`.
 *
 * @param ctx host context.
 * @param config live configuration of this entry.
 * @returns the speech provider.
 */
export declare function createProvider(ctx: HostContext, config: RuntimeConfig): SpeechProvider;
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
export declare function createDiscovery(ctx: HostContext): (request: ModelDiscoveryRequest, signal?: AbortSignal) => Promise<DiscoveredModel[]>;
/**
 * Mount the page policy, the recognizer and the model interrogation.
 *
 * @param ctx host context.
 * @param config live configuration of this entry.
 */
export declare function apply(ctx: HostContext, config: RuntimeConfig): void;
