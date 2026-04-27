'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useReducedMotion } from 'framer-motion'
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'

export type CommandPaletteItem = {
  id: string
  title: string
  description?: string
  group?: string
  shortcutHint?: string
  keywords?: string[]
  run: () => void
}

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandPaletteItem[]
}

const scoreCommand = (command: CommandPaletteItem, query: string) => {
  if (!query) return 1
  const normalized = query.trim().toLowerCase()
  if (!normalized) return 1
  const haystacks = [command.title, command.description ?? '', ...(command.keywords ?? [])].map((value) =>
    value.toLowerCase()
  )

  let score = 0
  for (const value of haystacks) {
    if (!value) continue
    if (value === normalized) score += 150
    else if (value.startsWith(normalized)) score += 100
    else if (value.includes(normalized)) score += 50
  }
  return score
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listboxId = React.useId()
  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    if (!open) return
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [open])

  const visibleCommands = React.useMemo(() => {
    const mapped = commands
      .map((command) => ({ command, score: scoreCommand(command, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
      .map((entry) => entry.command)
    return mapped
  }, [commands, query])

  React.useEffect(() => {
    if (!visibleCommands.length) {
      setSelectedIndex(0)
      return
    }
    if (selectedIndex >= visibleCommands.length) {
      setSelectedIndex(0)
    }
  }, [selectedIndex, visibleCommands.length])

  const runSelected = React.useCallback(() => {
    const selected = visibleCommands[selectedIndex]
    if (!selected) return
    selected.run()
    onOpenChange(false)
  }, [onOpenChange, selectedIndex, visibleCommands])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className="left-1/2 top-[12vh] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] p-3"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onOpenChange(false)
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedIndex((index) => (visibleCommands.length ? (index + 1) % visibleCommands.length : 0))
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedIndex((index) =>
                visibleCommands.length ? (index - 1 + visibleCommands.length) % visibleCommands.length : 0
              )
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              runSelected()
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and run commands for editor and workspace actions.
          </DialogPrimitive.Description>
          <label htmlFor="command-palette-input" className="sr-only">
            Search commands
          </label>
          <input
            id="command-palette-input"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or draft name…"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={visibleCommands[selectedIndex] ? `command-option-${visibleCommands[selectedIndex].id}` : undefined}
            className="h-10 w-full rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-chrome)] px-3 text-sm text-[color:var(--rl-shell-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--rl-shell-elevated)]"
          />

          <div id={listboxId} role="listbox" aria-label="Commands" className="mt-2 max-h-[52vh] space-y-1 overflow-y-auto thin-scrollbar">
            {visibleCommands.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-[color:var(--rl-shell-muted)]">No matching commands.</p>
            ) : (
              visibleCommands.map((command, index) => {
                const active = index === selectedIndex
                return (
                  <button
                    key={command.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    id={`command-option-${command.id}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      command.run()
                      onOpenChange(false)
                    }}
                    className={`flex w-full cursor-pointer items-start justify-between rounded-md border px-3 py-2 text-left ${reduceMotion ? '' : 'transition-colors'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--rl-shell-elevated)] ${
                      active
                        ? 'border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-text)_8%,transparent)]'
                        : 'border-transparent hover:bg-[color:color-mix(in_srgb,var(--rl-shell-text)_5%,transparent)]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[color:var(--rl-shell-text)]">{command.title}</span>
                      {command.description ? (
                        <span className="mt-0.5 block truncate text-xs text-[color:var(--rl-shell-muted)]">
                          {command.description}
                        </span>
                      ) : null}
                    </span>
                    {command.shortcutHint ? (
                      <span className="ml-3 shrink-0 rounded-sm border border-[color:var(--rl-shell-border)] px-1.5 py-0.5 text-[10px] text-[color:var(--rl-shell-muted)]">
                        {command.shortcutHint}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
