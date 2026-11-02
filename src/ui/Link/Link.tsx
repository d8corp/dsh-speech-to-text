import type { MouseEvent, ReactElement, ReactNode } from 'react'

/** An inline link; settings navigation is shell-owned, so it carries an action, not an href. */
export function Link (props: {
  children: ReactNode
  onClick: () => void
}): ReactElement {
  return (
    <a
      href='#'
      className='sst-link'
      onClick={(event: MouseEvent) => {
        event.preventDefault()
        props.onClick()
      }}
    >
      {props.children}
    </a>
  )
}
