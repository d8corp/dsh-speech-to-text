// dsh-speech-to-text — browser half, loaded by the shell's ModuleLoader.

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

import { PROVIDER_NAME, SETTINGS_NS } from './constants'
import { ensureStyles, openModelsSection } from './utils'
import type { SectionValues, SettingsProps } from './widgets'
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
 * The two `remote.*` names are declarations, not accesses: cordis mounts a
 * namespace's browser face only for a fiber that declared it, so reading
 * `ctx.remote.speech` from the page's props factory without this list yields an
 * absent service. The slot registration crashes on it, the slot registry
 * retires the entry, and the shell keeps the navigation cell while the content
 * column renders an invisible error anchor — a blank page, no message.
 * Declaring them also parks this half until the host side answers, which is
 * what keeps the page out of a profile that has no voice input.
 */
export const inject = ['remote', 'remote.speech', 'remote.llm', 'slots', 'configForms']

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
        llm: ctx.remote.llm,
        subscribe: (listener: () => void) => {
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
