'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'rhyme-lines:doc:current'
const SAVE_DELAY_MS = 250

// --- Heuristic syllable counter (good baseline; we can swap in CMU later) ---
function countSyllables(wordRaw: string): number {
  const word = wordRaw.toLowerCase().replace(/[^a-z]/g, '')
  if (!word) return 0
  // Special cases
  const specials: Record<string, number> = {
    the: 1, a: 1, i: 1, you: 1, are: 1, fire: 1, hour: 1, choir: 1,
    people: 2, every: 2, evening: 3, queue: 1, queued: 1, queues: 1,
  }
  if (word in specials) return specials[word]

  // Remove trailing silent e
  const core = word.replace(/e\b/, '')
  // Count vowel groups
  const groups = core.match(/[aeiouy]+/g)?.length ?? 0

  // Adjustments
  let syl = groups
  // -ion, -ian endings often add a syllable
  if (/(ion|ian|ious|iest)\b/.test(word)) syl += 1
  // -le ending after a consonant (e.g., table)
  if (/[bcdfghjklmnpqrstvwxyz]le\b/.test(word)) syl += 1
  // Single-letter words that are vowels
  if (/^[ai]$/.test(word)) syl = 1

  // Never return less than 1 for alphabetic words
  return Math.max(1, syl)
}

function lineSyllables(line: string): number {
  const words = line.split(/\s+/).filter(Boolean)
  return words.reduce((sum, w) => sum + countSyllables(w), 0)
}

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | null>(null)
  const [textSnapshot, setTextSnapshot] = useState<string>('') // for gutter calc

  // ---- Placeholder visibility (robust vs :empty quirks) ----
  const updatePlaceholder = () => {
    const el = editorRef.current
    if (!el) return
    const hasText = (el.textContent || '').trim().length > 0
    el.classList.toggle('show-placeholder', !hasText)
  }

  // ---- Save / restore (localStorage) ----
  const saveNow = () => {
    const el = editorRef.current
    if (!el) return
    try {
      const text = (el.textContent || '').replace(/\u00A0/g, ' ')
      localStorage.setItem(STORAGE_KEY, text)
      setTextSnapshot(text) // keep gutter in sync with what we saved
    } catch {
      // ignore quota / privacy mode errors
    }
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(saveNow, SAVE_DELAY_MS)
  }

  const handleChange = () => {
    updatePlaceholder()
    scheduleSave()
  }

  useEffect(() => {
    const el = editorRef.current
    if (!el) return

    // Restore saved text
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        el.textContent = saved
        setTextSnapshot(saved)
      }
    } catch {
      // ignore
    }

    updatePlaceholder()
    el.focus()

    // Flush pending save on unload
    const beforeUnload = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveNow()
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  // --- Compute syllables per line for gutter ---
  const lines = useMemo(() => {
    // Split on newlines; keep empty lines to align gutter
    return textSnapshot.split(/\r?\n/)
  }, [textSnapshot])

  const lineTotals = useMemo(() => {
    return lines.map((ln) => lineSyllables(ln))
  }, [lines])

  return (
    <div className="flex w-full h-screen bg-black text-white">
      {/* Left gutter with line totals */}
      <div className="w-14 shrink-0 border-r border-white/10 text-right pr-2 py-8 overflow-hidden select-none">
        <div className="text-xs text-gray-400 leading-loose font-mono">
          {lineTotals.map((n, i) => (
            <div key={i} className="h-7 leading-7">{n || ''}</div>
          ))}
        </div>
      </div>

      {/* Editor column */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder="Start writing..."
            onInput={handleChange}
            onKeyUp={handleChange}
            onBlur={handleChange}
            className="relative outline-none whitespace-pre-wrap break-words w-full min-h-[70vh] text-lg leading-7 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
