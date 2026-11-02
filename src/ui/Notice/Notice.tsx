import type { ReactElement } from 'react'

/** One status line at the foot of the page. */
export function Notice (props: {
  kind: 'error' | 'status'
  text: string
}): ReactElement | null {
  if (props.text === '') return null

  return (
    <p
      className={props.kind === 'error' ? 'sst-notice sst-notice-error' : 'sst-notice'}
      role={props.kind === 'error' ? 'alert' : 'status'}
      aria-live='polite'
      style={{ marginTop: '12px' }}
    >
      {props.text}
    </p>
  )
}
