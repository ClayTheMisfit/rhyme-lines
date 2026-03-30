'use client'

import { useAutosaveStore } from '@/store/autosaveStore'
import { useRhymeHighlightSettingsStore } from '@/store/rhymeHighlightSettingsStore'
import { shallow } from 'zustand/shallow'

type StatusBarProps = {
  text: string
  cursor: { line: number; column: number } | null
}

const countWords = (text: string) => (text.trim().match(/\S+/g) ?? []).length
const countLines = (text: string) => (text.length ? text.split('\n').length : 1)

export default function StatusBar({ text, cursor }: StatusBarProps) {
  const { status } = useAutosaveStore((state) => ({ status: state.status }), shallow)
  const { highlightMode } = useRhymeHighlightSettingsStore((state) => ({ highlightMode: state.highlightMode }), shallow)
  const saveLabel =
    status === 'saving' ? 'Saving…' : status === 'dirty' ? 'Unsaved changes' : status === 'error' ? 'Save error' : 'Saved'

  return (
    <footer className="flex h-8 items-center justify-between border-t border-white/[0.04] bg-[#0e0e10] px-4 text-[11px] text-white/36">
      <div className="flex items-center gap-4">
        <span className={status === 'error' ? 'text-rose-300/80' : status === 'saving' ? 'text-amber-200/85' : 'text-white/48'}>
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

