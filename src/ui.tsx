/**
 * Layout primitives of the Settings → Speech to Text page.
 *
 * The settings shell paints no chrome inside a section, so the page draws its
 * own rows with the shell's design tokens (see `styles.ts`).
 * @module dsh-speech-to-text/ui
 */

import type { ChangeEvent, MouseEvent, ReactElement, ReactNode } from 'react'

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

/** One option of a {@link Select}. */
export interface SelectOption {
  value: string
  label: string
}

/** A native select, styled to match the shell. */
export function Select (props: {
  id: string
  value: string
  options: SelectOption[]
  disabled?: boolean
  onChange: (value: string) => void
}): ReactElement {
  return (
    <span className='sst-selectWrap'>
      <select
        id={props.id}
        className='sst-select'
        value={props.value}
        disabled={props.disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <svg className='sst-chevron' viewBox='0 0 16 16' width={14} height={14} aria-hidden='true'>
        <path d='M4 6l4 4 4-4' fill='none' stroke='currentColor' strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}

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
