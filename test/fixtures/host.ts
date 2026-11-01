/**
 * A host context carrying only the service slices this plugin touches, so the
 * offline suite runs without a DSH profile.
 */

import type { DiscoveredModel, HostContext, LlmConfigurableProvider, ModelDiscoveryRequest, SpeechProvider } from '../../src/dsh'

/** One recorded interaction. */
export interface Recorded {
  kind: string
  detail: unknown
}

/** Options for the stub. */
export interface StubOptions {
  /** Provider routes the LLM directory reports. */
  routes?: LlmConfigurableProvider[]
  /** Settings namespaces `describe()` answers with. */
  settings?: Array<{ ns: string, value: unknown }>
  /** Credential values the credentials service holds. */
  keys?: Record<string, string>
}

/** What the stub captured. */
export interface Stub {
  ctx: HostContext
  recorded: Recorded[]
  providers: SpeechProvider[]
  discoveries: Array<(request: ModelDiscoveryRequest, signal?: AbortSignal) => Promise<DiscoveredModel[]>>
}

/**
 * Build a stub context.
 *
 * @param options directory, settings and credential contents to answer with.
 * @returns the context plus everything recorded through it.
 */
export function createHostStub (options: StubOptions = {}): Stub {
  const recorded: Recorded[] = []
  const providers: SpeechProvider[] = []
  const discoveries: Stub['discoveries'] = []

  const stub: Stub = {
    recorded,
    providers,
    discoveries,
    ctx: {
      speechToText: {
        register (provider) {
          providers.push(provider)
          recorded.push({ kind: 'register', detail: provider.info.id })

          return () => {
            recorded.push({ kind: 'unregister', detail: provider.info.id })
          }
        },
      },
      llm: {
        listConfigurableProviders: () => options.routes ?? [],
        registerModelDiscovery (settingsNs, discover) {
          discoveries.push(discover)
          recorded.push({ kind: 'discovery', detail: settingsNs })

          return () => {
            recorded.push({ kind: 'discovery-off', detail: settingsNs })
          }
        },
      },
      settings: {
        describe: () => options.settings ?? [],
        configure (presentation) {
          recorded.push({ kind: 'page-policy', detail: presentation })

          return () => {}
        },
      },
      credentials: {
        async resolve (ref) {
          const keys = options.keys ?? {}

          return keys[ref] === undefined ? undefined : { value: keys[ref] }
        },
      },
      logger: {
        warn (message) {
          recorded.push({ kind: 'warn', detail: message })
        },
      },
      fiber: {},
      effect (callback) {
        return callback()
      },
    },
  }

  return stub
}

/**
 * A live configuration object, as cordis hands it to `apply`.
 *
 * @param values the entry's fields.
 * @returns volatile getters over those values.
 */
export function createConfigStub (values: { provider: string, model: string }) {
  return {
    provider: { get: () => values.provider },
    model: { get: () => values.model },
  }
}
