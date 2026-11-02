import type { ReactElement } from 'react'

/** An accessible on/off switch. */
export function Switch (props: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}): ReactElement {
  return (
    <button
      type='button'
      role='switch'
      className={props.checked ? 'sst-switch sst-switchOn' : 'sst-switch'}
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span className='sst-switchTrack' aria-hidden='true'>
        <span className='sst-switchThumb' />
      </span>
    </button>
  )
}
