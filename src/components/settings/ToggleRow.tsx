'use client'

import { memo } from 'react'

type ToggleRowProps = {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}

function ToggleRowComponent({ label, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      className="flex min-h-11 w-full touch-manipulation select-none items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 active:bg-white/15 cursor-pointer"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="select-none text-left">{label}</span>
      <span
        className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full bg-white/20 transition"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-label={label}
        />
        <span className="absolute left-1 top-1 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
    </button>
  )
}

export const ToggleRow = memo(ToggleRowComponent)
