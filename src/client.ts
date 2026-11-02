// dsh-speech-to-text — browser half, loaded by the shell's ModuleLoader.

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

import { PROVIDER_NAME, SETTINGS_NS } from './constants'
import { ensureStyles, listConfiguredProviders, openModelsSection } from './utils'
import type { LlmLike, SectionValues, SettingsProps } from './widgets'
import { Settings } from './widgets'

/** Events that can change what the page offers. */
const REFRESH_EVENTS = [
  'settings/document-updated',
  'llm/adapters-updated',
  'credentials/reference-updated',
] as const

/**
 * Services required to mount the contribution.
 *
 * The `remote.*` names are declarations, not accesses: cordis mounts a
 * namespace's browser face only for a fiber that declared it, so reading
 * `ctx.remote.speech` from the page's props factory without this list yields an
 * absent service. The slot registration crashes on it, the slot registry
 * retires the entry, and the shell keeps the navigation cell while the content
 * column renders an invisible error anchor — a blank page, no message.
 * Declaring them also parks this half until the host side answers, which is
 * what keeps the page out of a profile that has no voice input.
 */
export const inject = ['remote', 'remote.speech', 'remote.llm', 'remote.credentials', 'slots', 'configForms']

/**
 * The provider directory the page picks from, narrowed to configured routes.
 *
 * `llm/listConfigurableProviders` answers every route an adapter has declared,
 * and the settings mirror plus the credential service answer which of them a
 * user has actually filled in — the same two facts the host needs to resolve an
 * endpoint. A failed credential read is thrown into the filter's fallback, so
 * the page keeps offering the whole directory rather than an empty one.
 *
 * @param ctx browser context carrying the remotes and the settings mirror.
 * @returns the LLM face the settings page consumes.
 */
function configuredLlm (ctx: Context): LlmLike {
  const mirror = ctx.configForms.describe()

  return {
    async listConfigurableProviders () {
      const listed = await ctx.remote.llm.listConfigurableProviders()

      if (!listed.ok) return listed

      await mirror.ensure()

      const namespaces = mirror.getSnapshot().view?.namespaces ?? []

      const configured = await listConfiguredProviders(listed.value, namespaces, async (refs) => {
        const answer = await ctx.remote.credentials.describe(refs)

        if (!answer.ok) throw new Error(answer.error.message)

        return answer.value
      })

      return { ok: true, value: configured }
    },

    discoverModels: (settingsNs, request) => ctx.remote.llm.discoverModels(settingsNs, request),
  }
}

/**
 * Register the Settings → Speech to Text section while the Host serves this
 * plugin's namespace, so a profile that does not compose the plugin shows no
 * trace of the page.
 *
 * @param ctx browser context.
 */
export function apply (ctx: Context): void {
  ensureStyles(SETTINGS_NS, import.meta.env.DSH_PLUGIN_SPEECH_TO_TEXT_CSS || '')

  const slots = ctx.slots
  const forms = ctx.configForms
  const llm = configuredLlm(ctx)

  slots.inject(
    'settings.section',
    () => forms.whileServed([SETTINGS_NS], () => slots.register({
      name: 'settings.section',
      id: SETTINGS_NS,
      order: 31,
      label: PROVIDER_NAME,
      inject: (): SettingsProps => ({
        form: forms.get<SectionValues>(SETTINGS_NS),
        speech: ctx.remote.speech,
        llm,
        subscribe: listener => {
          const off = REFRESH_EVENTS.map((event) => ctx.remote.$on(event, listener))

          return () => {
            for (const dispose of off) dispose()
          }
        },
        openModels: () => openModelsSection(ctx),
      }),
    }, Settings)),
  )
}
