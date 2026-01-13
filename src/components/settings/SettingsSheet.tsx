'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { shallow } from 'zustand/shallow'

import {
  applySettingsSnapshot,
  getCurrentSettingsSnapshot,
  useSettingsStore,
} from '@/store/settingsStore'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTrigger } from '@/components/ui/dialog'

const BADGE_SIZE_LABEL: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'Compact',
  sm: 'Comfortable',
  md: 'Spacious',
}

const KEYBOARD_SHORTCUTS: { combo: string; description: string }[] = [
  { combo: '⌘/Ctrl + K', description: 'Open the command palette' },
  { combo: 'Esc', description: 'Close panels or dialogs' },
  { combo: '0–5', description: 'Filter rhyme syllables when the panel is focused' },
  { combo: 'Enter', description: 'Insert the highlighted rhyme suggestion' },
]

const DEBOUNCE_OPTIONS: { value: 'cursor-50' | 'typing-250'; label: string; description: string }[] = [
  {
    value: 'cursor-50',
    label: 'Fast (50ms)',
    description: 'Instant updates while moving the caret',
  },
  {
    value: 'typing-250',
    label: 'Calm (250ms)',
    description: 'Debounce typing for a steadier experience',
  },
]

// Repro (pre-fix): open Settings from the gear icon, then try toggles/sliders; clicks do not register.
export function SettingsSheet() {
  const [isOpen, setIsOpen] = useState(false)
  const snapshotRef = useRef(getCurrentSettingsSnapshot())

  const headingId = useId()
  const descriptionId = useId()
  const panelId = useId()

  const {
    theme,
    fontSize,
    lineHeight,
    badgeSize,
    showLineTotals,
    rhymeAutoRefresh,
    debounceMode,
    setTheme,
    setFontSize,
    setLineHeight,
    setBadgeSize,
    setShowLineTotals,
    setRhymeAutoRefresh,
    setDebounceMode,
    resetDefaults,
  } = useSettingsStore(
    useCallback(
      (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        badgeSize: state.badgeSize,
        showLineTotals: state.showLineTotals,
        rhymeAutoRefresh: state.rhymeAutoRefresh,
        debounceMode: state.debounceMode,
        setTheme: state.setTheme,
        setFontSize: state.setFontSize,
        setLineHeight: state.setLineHeight,
        setBadgeSize: state.setBadgeSize,
        setShowLineTotals: state.setShowLineTotals,
        setRhymeAutoRefresh: state.setRhymeAutoRefresh,
        setDebounceMode: state.setDebounceMode,
        resetDefaults: state.resetDefaults,
      }),
      []
    ),
    shallow
  )

  const openSheet = useCallback(() => {
    snapshotRef.current = getCurrentSettingsSnapshot()
    setIsOpen(true)
  }, [])

  const closeSheet = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleCancel = useCallback(() => {
    if (snapshotRef.current) {
      applySettingsSnapshot(snapshotRef.current)
    }
    closeSheet()
  }, [closeSheet])

  const handleSave = useCallback(() => {
    snapshotRef.current = getCurrentSettingsSnapshot()
    closeSheet()
  }, [closeSheet])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        openSheet()
      } else {
        handleCancel()
      }
    },
    [handleCancel, openSheet]
  )

  useEffect(() => {
    if (!isOpen) {
      document.body.style.removeProperty('overflow')
      return
    }

    document.body.style.setProperty('overflow', 'hidden')

    return () => {
      document.body.style.removeProperty('overflow')
    }
  }, [isOpen])

  const badgeSizeLabel = BADGE_SIZE_LABEL[badgeSize]

  const dialogContent = useMemo(
    () => (
      <DialogPortal>
        <DialogOverlay data-testid="settings-overlay" />
        <DialogContent
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          id={panelId}
          data-testid="settings-panel"
          className="left-1/2 top-1/2 flex h-[92vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-6 rounded-t-3xl border border-white/10 bg-zinc-950/95 p-6 text-white shadow-2xl outline-none md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-w-[460px] md:translate-x-0 md:translate-y-0 md:rounded-none md:border-l md:border-white/20 md:p-8"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 id={headingId} className="text-lg font-semibold tracking-tight">Editor settings</h2>
                <p id={descriptionId} className="text-sm text-white/60">
                  Tune the writing surface, rhyme helper, and accessibility defaults.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Close settings"
                data-testid="settings-close"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto pb-4 pr-1 md:grid-cols-2">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Theme</h3>
              <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                {(['dark', 'light'] as const).map((option) => {
                  const isActive = theme === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-white text-black shadow'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                      aria-pressed={isActive}
                    >
                      {option === 'dark' ? 'Dark' : 'Light'}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Font size</h3>
              <label className="text-sm font-medium text-white/80" htmlFor="font-size-slider">
                {fontSize.toFixed(0)} px
              </label>
              <input
                id="font-size-slider"
                type="range"
                min={14}
                max={28}
                step={1}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                aria-valuemin={14}
                aria-valuemax={28}
                aria-valuenow={fontSize}
                aria-label="Editor font size"
                className="slider h-2 w-full cursor-pointer rounded-full bg-white/10"
              />
              <p className="text-xs text-white/50">Applies instantly across the editor and overlays.</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Line height</h3>
              <label className="text-sm font-medium text-white/80" htmlFor="line-height-slider">
                {lineHeight.toFixed(2)}
              </label>
              <input
                id="line-height-slider"
                type="range"
                min={1.2}
                max={2}
                step={0.05}
                value={lineHeight}
                onChange={(event) => setLineHeight(Number(event.target.value))}
                aria-valuemin={1.2}
                aria-valuemax={2}
                aria-valuenow={lineHeight}
                aria-label="Editor line height"
                className="slider h-2 w-full cursor-pointer rounded-full bg-white/10"
              />
              <p className="text-xs text-white/50">Adjust vertical rhythm for readability.</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Syllable badges</h3>
              <label className="text-sm font-medium text-white/80" htmlFor="badge-size-select">
                {badgeSizeLabel}
              </label>
              <select
                id="badge-size-select"
                value={badgeSize}
                onChange={(event) => setBadgeSize(event.target.value as 'xs' | 'sm' | 'md')}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              >
                <option value="xs">Compact</option>
                <option value="sm">Comfortable</option>
                <option value="md">Spacious</option>
              </select>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-white/80">
                <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-white/20 transition">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={showLineTotals}
                    onChange={(event) => setShowLineTotals(event.target.checked)}
                    aria-label="Show line totals"
                  />
                  <span className="absolute left-1 top-1 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </span>
                Show line totals in the gutter
              </label>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Rhyme suggestions</h3>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-white/80">
                <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-white/20 transition">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={rhymeAutoRefresh}
                    onChange={(event) => setRhymeAutoRefresh(event.target.checked)}
                    aria-label="Auto refresh rhyme suggestions"
                    data-testid="settings-auto-refresh"
                  />
                  <span className="absolute left-1 top-1 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </span>
                Auto refresh while typing
              </label>
              <div className="space-y-2">
                {DEBOUNCE_OPTIONS.map((option) => {
                  const isActive = debounceMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDebounceMode(option.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? 'border-blue-400 bg-blue-500/20 text-white shadow'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-white/60">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="md:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Keyboard</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80 sm:grid-cols-2">
                {KEYBOARD_SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.combo} className="rounded-md bg-white/5 p-3">
                    <p className="font-mono text-xs uppercase tracking-wide text-white/50">{shortcut.combo}</p>
                    <p className="mt-1 text-sm text-white/80">{shortcut.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => {
                resetDefaults()
              }}
              className="text-sm font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Reset to defaults
            </button>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                Save
              </button>
            </div>
          </footer>
        </DialogContent>
      </DialogPortal>
    ),
    [
      badgeSize,
      badgeSizeLabel,
      debounceMode,
      descriptionId,
      fontSize,
      handleCancel,
      handleSave,
      headingId,
      lineHeight,
      panelId,
      resetDefaults,
      rhymeAutoRefresh,
      setBadgeSize,
      setDebounceMode,
      setFontSize,
      setLineHeight,
      setRhymeAutoRefresh,
      setShowLineTotals,
      setTheme,
      showLineTotals,
      theme,
    ]
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-sm font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Open settings"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          data-testid="settings-trigger"
        >
          ⚙️
        </button>
      </DialogTrigger>
      {isOpen ? dialogContent : null}
    </Dialog>
  )
}

export default SettingsSheet
