import type { ChangeEvent, ReactElement } from 'react'

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
