import type { Context } from '@deepseek-ai/cordis'

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
export function openModelsSection (ctx: Context): boolean {
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
