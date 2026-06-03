'use client'

import { useAutosaveStore } from '@/store/autosaveStore'
import { useRhymeHighlightSettingsStore } from '@/store/rhymeHighlightSettingsStore'
import { shallow } from 'zustand/shallow'

type StatusBarProps = {
  text: string
  cursor: { line: number; column: number } | null
}

const countWords = (text: string) => (text.trim().match(/\S+/g) ?? []).length
const countLines = (text: string) => {
  const normalized = text.replace(/\r\n?/g, '\n')
  if (!normalized.trim()) return 0

  const lines = normalized.split('\n')
  let start = 0
  let end = lines.length - 1

  while (start <= end && lines[start].trim() === '') start += 1
  while (end >= start && lines[end].trim() === '') end -= 1

  return end >= start ? end - start + 1 : 0
}

export default function StatusBar({ text, cursor }: StatusBarProps) {
  const { status } = useAutosaveStore((state) => ({ status: state.status }), shallow)
  const { highlightMode } = useRhymeHighlightSettingsStore((state) => ({ highlightMode: state.highlightMode }), shallow)
  const saveLabel = status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Saved'
  const saveToneClass =
    status === 'error'
      ? 'text-rose-400/90'
      : status === 'saving'
        ? 'text-amber-300/90'
        : 'text-[color:var(--rl-shell-muted)]'

  return (
    <footer className="flex h-8 items-center justify-between border-t border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-chrome)]/90 px-4 text-[11px] text-[color:var(--rl-shell-muted)] backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <span
          aria-live="polite"
          aria-atomic="true"
          className={`inline-flex min-w-[8ch] transition-colors duration-150 motion-reduce:transition-none ${saveToneClass}`}
        >
          {saveLabel}
        </span>
        <span>Words {countWords(text).toLocaleString()}</span>
        <span>Lines {countLines(text).toLocaleString()}</span>
        <span>Rhyme {highlightMode}</span>
      </div>
      <span>{cursor ? `Ln ${cursor.line}, Col ${cursor.column}` : 'Ln —, Col —'}</span>
    </footer>
  )
}
