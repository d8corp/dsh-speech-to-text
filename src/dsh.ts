/**
 * Structural slices of the DSH host services this plugin consumes.
 *
 * The plugin declares its peers as optional peer dependencies, so the profile
 * that composes it may not resolve those packages from this directory at all.
 * Describing only the members actually used keeps the compiled host file free
 * of imports that could fail to resolve, and every shape here is read straight
 * from the service contracts: `dsh-experimental-speech-to-text`, `dsh-llm`,
 * `dsh-settings` and `dsh-credentials`.
 * @module dsh-speech-to-text/dsh
 */

/** One config field that hot-applies without a restart. */
export interface Volatile<T> {
  get (): T
}

/** Metadata a recognizer advertises to the official picker. */
export interface SpeechProviderInfo {
  id: string
  name: string
  location: 'host-local' | 'cloud'
  languages: readonly string[]
}

/** One recording handed to a provider by the speech service. */
export interface TranscriptionInput {
  audio: Uint8Array
  language: string
}

/** What a provider reports back for one recording. */
export interface TranscriptionResult {
  text: string
  audioSeconds: number
  inferenceSeconds: number
}

/** The recognizer contract. */
export interface SpeechProvider {
  info: SpeechProviderInfo
  transcribe (input: TranscriptionInput, signal?: AbortSignal): Promise<TranscriptionResult>
}

/** The registry this plugin registers into. */
export interface SpeechService {
  register (provider: SpeechProvider): () => void
}

/** One provider route the configuration surfaces can activate. */
export interface LlmConfigurableProvider {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: readonly string[]
  defaultBaseURL?: string
}

/** One model advertised by a provider endpoint. */
export interface DiscoveredModel {
  id: string
  name?: string
}

/** Draft endpoint description a model interrogation is given. */
export interface ModelDiscoveryRequest {
  provider?: string
  baseURL?: string
}

/** The LLM directory members this plugin uses. */
export interface LlmService {
  listConfigurableProviders (): LlmConfigurableProvider[]
  registerModelDiscovery (
    settingsNs: string,
    discover: (request: ModelDiscoveryRequest, signal?: AbortSignal) => Promise<DiscoveredModel[]>,
  ): () => void
}

/** One entry's live configuration, as the settings service reports it. */
export interface SettingsDescriptor {
  ns: string
  value: unknown
}

/** The settings facade members this plugin uses. */
export interface SettingsService {
  describe (options?: { redactSecrets?: boolean }): SettingsDescriptor[]
  configure (presentation: { auto?: boolean }, owner?: unknown): () => void
}

/** A resolved credential; only `value` is read, and only in the host. */
export interface CredentialResolution {
  value?: string
}

/** The credentials facade member this plugin uses. */
export interface CredentialsService {
  resolve (ref: string): Promise<CredentialResolution | undefined>
}

/** Logger slice used for one warning path. */
export interface Logger {
  warn (message: string): void
}

/** Host context of this plugin. */
export interface HostContext {
  speechToText: SpeechService
  llm: LlmService
  settings: SettingsService
  credentials: CredentialsService
  logger: Logger
  fiber: unknown
  effect (callback: () => unknown, label?: string): unknown
}
