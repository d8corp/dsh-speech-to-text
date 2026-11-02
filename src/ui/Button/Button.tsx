import type { ReactElement, ReactNode } from 'react'

/** A compact secondary button. */
export function Button (props: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}): ReactElement {
  return (
    <button type='button' className='sst-button' disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  )
}
