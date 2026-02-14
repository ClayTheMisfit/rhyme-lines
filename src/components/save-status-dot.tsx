'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type SaveStatusDotState = 'saving' | 'saved' | 'error'

type SaveStatusDotProps = {
  state: SaveStatusDotState
  className?: string
}

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

const STATE_LABELS: Record<SaveStatusDotState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  error: 'Save failed',
}

const STATE_VISUALS: Record<SaveStatusDotState, string> = {
  saved: 'h-2.5 w-2.5 rounded-full bg-muted-foreground/30 border border-border/50',
  saving: 'h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/40 border-t-transparent animate-spin',
  error: 'h-2.5 w-2.5 rounded-full bg-destructive/80 border border-destructive/60',
}

/**
 * Render a compact save-status indicator with an accessible tooltip and live region.
 *
 * The component visualizes one of three states and exposes the human-readable state
 * to assistive technology via an `aria-label`, tooltip content, and an `aria-live`
 * region for announcements.
 *
 * @param state - One of `"saving"`, `"saved"`, or `"error"` indicating the current save status
 * @param className - Optional additional CSS classes to apply to the outer button
 * @returns The rendered save-status indicator element
 */
export default function SaveStatusDot({ state, className }: SaveStatusDotProps) {
  const label = STATE_LABELS[state]

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cx(
              'inline-flex h-5 w-5 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              className
            )}
          >
            <span className={STATE_VISUALS[state]} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
    </TooltipProvider>
  )
}