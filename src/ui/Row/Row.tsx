import type { ReactElement, ReactNode } from 'react'

/** One label/description column with its control on the right. */
export function Row (props: {
  title: string
  description?: ReactNode
  children?: ReactNode
}): ReactElement {
  return (
    <div className='sst-row'>
      <div className='sst-text'>
        <span className='sst-title'>{props.title}</span>
        {props.description === undefined ? null : <div className='sst-desc'>{props.description}</div>}
      </div>
      {props.children === undefined ? null : <div className='sst-control'>{props.children}</div>}
    </div>
  )
}
