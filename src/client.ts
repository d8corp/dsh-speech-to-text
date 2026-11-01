// dsh-speech-to-text — browser half, loaded by the shell's ModuleLoader.

import { PROVIDER_NAME, SETTINGS_NS } from './constants'
import type { SectionValues } from './page'
import { Settings } from './page'
import { ensureStyles } from './styles'

/** One slot registration's declared options. */
interface SlotEntry {
  options?: { id?: unknown, order?: unknown }
}

/** The slot service slice this plugin uses. */
interface SlotsService {
  inject: (name: string, register: () => () => void) => unknown
  register: (meta: Record<string, unknown>, component: typeof Settings) => () => void
  entries: (name: string) => SlotEntry[]
}

/** Live view of one settings namespace. */
interface ConfigFormLike {
  getSnapshot: () => { value: SectionValues | undefined }
  subscribe: (listener: () => void) => () => void
  set: (field: string, value: unknown) => Promise<boolean>
}

/** Configuration forms shared by the settings surfaces. */
interface ConfigFormsService {
  get: <T>(entryId: string) => ConfigFormLike & { value?: T }
  whileServed: (namespaces: readonly string[], register: () => () => void) => () => void
}

/** Remote carrier: typed namespace faces plus the event bus. */
interface RemoteService {
  speech: Record<string, unknown>
  llm: Record<string, unknown>
  $on: (event: string, listener: () => void) => () => void
}

/** Browser context of this plugin. */
interface ClientContext {
  slots: SlotsService
  configForms: ConfigFormsService
  remote: RemoteService
}

/** Nav identity of the page; `order` places it after the bundled sections. */
const SECTION = {
  name: 'settings.section',
  id: SETTINGS_NS,
  order: 31,
  label: PROVIDER_NAME,
} as const

/** Events that can change what the page offers. */
const REFRESH_EVENTS = [
  'settings/document-updated',
  'llm/adapters-updated',
  'credentials/reference-updated',
] as const

/**
 * Activate the built-in Models section inside the open settings panel.
 *
 * The shell exposes no navigation callback to a section — `openSection` belongs
 * to the onboarding coordinator — so the page mirrors the shell's own ordering
 * of `settings.section` registrations and clicks the matching nav cell. The
 * lookup is by slot id, never by a guessed URL or a localized label.
 *
 * @param ctx browser context carrying the slot service.
 * @returns true when the Models cell was found and clicked.
 */
function openModelsSection (ctx: ClientContext): boolean {
  if (typeof document === 'undefined') return false

  const panel = document.querySelector('[data-shortcut-modal="settings"]')

  if (panel === null) return false

  let index = -1

  try {
    const rows = ctx.slots
      .entries('settings.section')
      .map((entry) => ({
        id: entry?.options ? entry.options.id : '',
        order: entry?.options && typeof entry.options.order === 'number' ? entry.options.order : 0,
      }))
      .sort((left, right) => left.order - right.order)

    index = rows.findIndex((row) => row.id === 'models')
  } catch {
    index = -1
  }

  const buttons = panel.querySelectorAll('nav > div:last-child button')

  if (index < 0 || buttons[index] === undefined) return false

  ;(buttons[index] as HTMLElement).click()

  return true
}

/** Services required to mount the contribution. */
export const inject = ['remote', 'slots', 'configForms']

/**
 * Register the Settings → Speech to Text section while the Host serves this
 * plugin's namespace, so a profile that does not compose the plugin shows no
 * trace of the page.
 *
 * @param ctx browser context.
 */
export function apply (ctx: ClientContext): void {
  ensureStyles(SETTINGS_NS)

  const slots = ctx.slots
  const forms = ctx.configForms

  slots.inject('settings.section', () => forms.whileServed([SETTINGS_NS], () => slots.register(
    {
      ...SECTION,
      inject: () => ({
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
    },
    Settings,
  )))
}
