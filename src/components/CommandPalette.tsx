'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { useSettingsStore } from '@/store/settingsStore'

const COMMAND_LABEL = 'Toggle: Include exact repeats'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const includeExactRepeats = useSettingsStore((state) => state.includeExactRepeats)
  const setIncludeExactRepeats = useSettingsStore((state) => state.setIncludeExactRepeats)

  const commands = useMemo(
    () => [
      {
        id: 'toggle-exact-repeats',
        title: COMMAND_LABEL,
        keywords: ['exact', 'repeat', 'repeats', 'underline'],
        action: () => setIncludeExactRepeats(!includeExactRepeats),
      },
    ],
    [includeExactRepeats, setIncludeExactRepeats]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter((command) => {
      const haystack = `${command.title} ${command.keywords.join(' ')}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [commands, query])

  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    const handleShortcut = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail !== 'palette') return
      openPalette()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isPrimary = event.metaKey || event.ctrlKey
      if (!isPrimary || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      openPalette()
    }

    window.addEventListener('rhyme:editor-shortcut', handleShortcut as EventListener)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('rhyme:editor-shortcut', handleShortcut as EventListener)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPalette])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closePalette())}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className="left-1/2 top-1/3 w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-950/95 p-4 text-white shadow-2xl outline-none"
          aria-label="Command palette"
        >
          <div className="space-y-3">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a command…"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-white/50">No matching commands.</div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((command) => (
                    <li key={command.id}>
                      <button
                        type="button"
                        onClick={() => {
                          command.action()
                          closePalette()
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        {command.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-white/40">Search: exact · repeat · underline</p>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
