'use client'

import { memo } from 'react'

type ToggleRowProps = {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}

/**
 * Render an accessible, keyboard-operable toggle row that displays a label and a switch-like visual.
 *
 * The control toggles its state when clicked or when Enter/Space is pressed and reports the new state
 * via `onCheckedChange`.
 *
 * @param label - The text label displayed to the left of the switch.
 * @param checked - The current boolean state of the switch (`true` = on).
 * @param onCheckedChange - Callback invoked with the new boolean state when the control is toggled.
 * @returns The ToggleRow React element (a button with switch semantics).
 */
function ToggleRowComponent({ label, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="flex min-h-11 w-full touch-manipulation select-none items-center justify-between gap-4 rounded-lg border border-[color:var(--rl-border)] bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition duration-100 hover:bg-white/10 active:scale-[0.99] active:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
      onClick={() => onCheckedChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onCheckedChange(!checked)
        }
      }}
    >
      <span className="select-none text-left">{label}</span>
      <span
        aria-hidden="true"
        className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full bg-white/20 transition-colors duration-100"
      >
        <span
          className="absolute left-1 top-1 inline-block h-3 w-3 rounded-full bg-white transition-transform duration-100"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0px)' }}
        />
      </span>
    </button>
  )
}

export const ToggleRow = memo(ToggleRowComponent)