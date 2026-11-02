/**
 * The page stylesheet, injected once per plugin id.
 *
 * Colors and metrics come from the shell's `--dsw-alias-*` design tokens, so
 * the page follows the host theme and needs no build-time preprocessing.
 * @module dsh-speech-to-text/styles
 */

/**
 * Install the page stylesheet into the document head, once.
 *
 * @param id plugin id carried by the `data-plugin` attribute.
 * @param CSS string with CSS rules.
 */
export function ensureStyles (id: string, CSS: string): void {
  if (typeof document === 'undefined' || document.head == null) return
  if (document.querySelector(`style[data-plugin="${id}"]`) !== null) return

  const style = document.createElement('style')

  style.dataset.plugin = id
  style.textContent = CSS
  document.head.appendChild(style)
}
