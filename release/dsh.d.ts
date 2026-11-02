/**
 * The DSH contracts this plugin builds on.
 *
 * Every type here is the owning package's own declaration. This file used to
 * copy the members the plugin read, and the copies silently fell behind: the
 * recognizer id is a branded `SpeechProviderId`, the directory's entries grew
 * `declared` and `nativeAuth`, and a resolved credential carries the source
 * layer that supplied it. The copies are type-only imports, so the compiled
 * host file gains no runtime import and a profile that does not resolve a peer
 * package still loads the plugin.
 * @module dsh-speech-to-text/dsh
 */
import type { Context, Fiber, LoggerService } from '@deepseek-ai/cordis';
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials';
import type SpeechToText from '@deepseek-ai/dsh-experimental-speech-to-text';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import type { SettingsForms } from '@deepseek-ai/dsh-settings';
/** One config field that hot-applies without a restart. */
export type { Volatile } from '@deepseek-ai/cordis';
/** Credential reference space. */
export type { CredentialRef } from '@deepseek-ai/dsh-credentials';
/** Presence and writability of one reference, never its value. */
export type { CredentialInfo } from '@deepseek-ai/dsh-credentials/types';
/** One provider route the configuration surfaces can activate. */
export type { LlmConfigurableProvider } from '@deepseek-ai/dsh-llm/types';
/** One model an endpoint interrogation reports. */
export type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm/types';
/** Draft endpoint description a model interrogation is given. */
export type { LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm/types';
/** One entry's live configuration, as the settings service reports it. */
export type { SettingsDescriptor } from '@deepseek-ai/dsh-settings';
/** One namespace of the settings document, as the browser mirror reports it. */
export type { SettingsNamespaceView } from '@deepseek-ai/dsh-settings/types';
/** One complete recording handed to a provider by the speech service. */
export type { SpeechInput } from '@deepseek-ai/dsh-experimental-speech-to-text/types';
/** Recognizer identity: a branded id, because the registry rejects a duplicate. */
export type { SpeechProviderId } from '@deepseek-ai/dsh-experimental-speech-to-text/types';
/** The selection the voice-input bundle owns. */
export type { SpeechSelection } from '@deepseek-ai/dsh-experimental-speech-to-text/types';
/** The recognizer contract. */
export type { SpeechProvider } from '@deepseek-ai/dsh-experimental-speech-to-text/types';
/** One Remote answer, and the namespaces the host declares their calls in. */
export type { RemoteResult, TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol';
/**
 * The host context this plugin reads.
 *
 * Each service is a `Pick` of the package's own service class, so a signature
 * cannot fall behind the host's while still leaving room for the offline suite
 * to stand in for a profile with a plain object.
 */
export interface HostContext extends Pick<Context, 'effect'> {
    speechToText: Pick<SpeechToText, 'register'>;
    llm: Pick<LlmRuntime, 'listConfigurableProviders' | 'registerModelDiscovery'>;
    settings: Pick<SettingsForms, 'describe' | 'configure'>;
    credentials: Pick<CredentialProvider, 'resolve'>;
    logger: Pick<LoggerService, 'warn'>;
    fiber: Fiber;
}
