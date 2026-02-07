'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { useSettingsStore } from '@/store/settingsStore'
import { shallow } from 'zustand/shallow'

type Command = {
  id: string
  label: string
  active: boolean
  onSelect: () => void
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const headingId = useId()

  const {
    rhymeHighlightEnabled,
    rhymeIgnoreStopwords,
    rhymeIncludeExactRepeats,
    setRhymeHighlightEnabled,
    setRhymeIgnoreStopwords,
    setRhymeIncludeExactRepeats,
  } = useSettingsStore(
    useCallback(
      (state) => ({
        rhymeHighlightEnabled: state.rhymeHighlightEnabled,
        rhymeIgnoreStopwords: state.rhymeIgnoreStopwords,
        rhymeIncludeExactRepeats: state.rhymeIncludeExactRepeats,
        setRhymeHighlightEnabled: state.setRhymeHighlightEnabled,
        setRhymeIgnoreStopwords: state.setRhymeIgnoreStopwords,
        setRhymeIncludeExactRepeats: state.setRhymeIncludeExactRepeats,
      }),
      []
    ),
    shallow
  )

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'toggle-rhyme-highlight',
        label: 'Toggle: Rhyme highlighting',
        active: rhymeHighlightEnabled,
        onSelect: () => setRhymeHighlightEnabled(!rhymeHighlightEnabled),
      },
      {
        id: 'toggle-ignore-stopwords',
        label: 'Toggle: Ignore stopwords',
        active: rhymeIgnoreStopwords,
        onSelect: () => setRhymeIgnoreStopwords(!rhymeIgnoreStopwords),
      },
      {
        id: 'toggle-exact-repeats',
        label: 'Toggle: Include exact repeats',
        active: rhymeIncludeExactRepeats,
        onSelect: () => setRhymeIncludeExactRepeats(!rhymeIncludeExactRepeats),
      },
    ],
    [
      rhymeHighlightEnabled,
      rhymeIgnoreStopwords,
      rhymeIncludeExactRepeats,
      setRhymeHighlightEnabled,
      setRhymeIgnoreStopwords,
      setRhymeIncludeExactRepeats,
    ]
  )

  useEffect(() => {
    const handleShortcut = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail !== 'palette') return
      setIsOpen(true)
    }
    window.addEventListener('rhyme:editor-shortcut', handleShortcut as EventListener)
    return () => {
      window.removeEventListener('rhyme:editor-shortcut', handleShortcut as EventListener)
    }
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {isOpen ? (
        <DialogPortal>
          <DialogOverlay data-testid="command-palette-overlay" />
          <DialogContent
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            data-testid="command-palette"
            className="left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 text-white shadow-2xl outline-none"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-white/60">
                Command palette
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
                aria-label="Close command palette"
              >
                ✕
              </button>
            </header>
            <div className="space-y-2">
              {commands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => {
                    command.onSelect()
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10"
                >
                  <span>{command.label}</span>
                  <span className="text-xs text-white/50">{command.active ? 'On' : 'Off'}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </DialogPortal>
      ) : null}
    </Dialog>
  )
}
