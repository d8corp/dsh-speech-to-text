import type { ReactElement, ReactNode } from 'react'

/** One label/description column with its control on the right. */
export function Row (props: {
  title: string
  description?: ReactNode
  htmlFor?: string
  children?: ReactNode
}): ReactElement {
  return (
    <div className='sst-row'>
      <div className='sst-text'>
        {props.htmlFor === undefined
          ? <span className='sst-title'>{props.title}</span>
          : <label className='sst-title' htmlFor={props.htmlFor}>{props.title}</label>}
        {props.description === undefined ? null : <div className='sst-desc'>{props.description}</div>}
      </div>
      {props.children === undefined ? null : <div className='sst-control'>{props.children}</div>}
    </div>
  )
}
