'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'rhyme-lines:doc:current'
const SAVE_DELAY_MS = 250
const MEASURE_DEBOUNCE_MS = 50

function countSyllables(wordRaw: string): number {
  const word = wordRaw.toLowerCase().replace(/[^a-z']/g, '')
  if (!word) return 0
  const specials: Record<string, number> = {
    the: 1, a: 1, i: 1, you: 1, are: 1, fire: 1, hour: 1, choir: 1,
    people: 2, every: 2, evening: 3, queue: 1, queued: 1, queues: 1,
  }
  if (word in specials) return specials[word]
  const core = word.replace(/e\b/, '')
  const groups = core.match(/[aeiouy]+/g)?.length ?? 0
  let syl = groups
  if (/(ion|ian|ious|iest)\b/.test(word)) syl += 1
  if (/[bcdfghjklmnpqrstvwxyz]le\b/.test(word)) syl += 1
  if (/^[ai]$/.test(word)) syl = 1
  return Math.max(1, syl)
}

type Badge = { x: number; y: number; text: string }

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const saveTimer = useRef<number | null>(null)
  const measureTimer = useRef<number | null>(null)

  const [badges, setBadges] = useState<Badge[]>([])
  const [textSnapshot, setTextSnapshot] = useState<string>('')

  const updatePlaceholder = () => {
    const el = editorRef.current
    if (!el) return
    const hasText = (el.textContent || '').trim().length > 0
    el.classList.toggle('show-placeholder', !hasText)
  }

  const saveNow = () => {
    const el = editorRef.current
    if (!el) return
    try {
      const text = (el.textContent || '').replace(/\u00A0/g, ' ')
      localStorage.setItem(STORAGE_KEY, text)
      setTextSnapshot(text)
    } catch {}
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(saveNow, SAVE_DELAY_MS)
  }

  const scheduleMeasure = useCallback(() => {
    if (measureTimer.current) window.clearTimeout(measureTimer.current)
    measureTimer.current = window.setTimeout(() => {
      measureTimer.current = null
      measureWords()
    }, MEASURE_DEBOUNCE_MS)
  }, [])

  const handleChange = () => {
    updatePlaceholder()
    scheduleSave()
    scheduleMeasure()
  }

  const measureWords = useCallback(() => {
    const root = editorRef.current
    const overlay = overlayRef.current
    if (!root || !overlay) return

    const badgesNext: Badge[] = []
    const rootRect = root.getBoundingClientRect()

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Node | null = walker.nextNode()
    const wordRegex = /[A-Za-z']+/g

    while (node) {
      const txt = node.textContent || ''
      let match: RegExpExecArray | null
      while ((match = wordRegex.exec(txt)) !== null) {
        const start = match.index
        const end = start + match[0].length

        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, end)

        const rects = range.getClientRects()
        if (rects.length > 0) {
          const r = rects[0]
          const word = match[0]
          const syl = countSyllables(word)

          const x = r.left - rootRect.left + r.width / 2
          const y = r.top - rootRect.top + 1 // badges sit almost directly over the word

          badgesNext.push({ x, y, text: String(syl) })
        }
        range.detach()
      }
      node = walker.nextNode()
    }

    setBadges(badgesNext)
  }, [])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        el.textContent = saved
        setTextSnapshot(saved)
      }
    } catch {}

    updatePlaceholder()
    el.focus()
    requestAnimationFrame(() => {
      measureWords()
    })

    const onBeforeUnload = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveNow()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (measureTimer.current) window.clearTimeout(measureTimer.current)
    }
  }, [measureWords])

  useEffect(() => {
    const onResize = () => scheduleMeasure()
    window.addEventListener('resize', onResize)

    const scroller = containerRef.current
    const onScroll = () => scheduleMeasure()
    scroller?.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('resize', onResize)
      scroller?.removeEventListener('scroll', onScroll)
    }
  }, [scheduleMeasure])

  return (
    <div className="flex w-full h-screen bg-black text-white">
      {/* Left gutter with line totals */}
      <div className="w-14 shrink-0 border-r border-white/10 text-right pr-2 py-8 overflow-hidden select-none">
        <div className="text-xs text-gray-400 leading-9 font-mono whitespace-pre">
          {textSnapshot.split(/\r?\n/).map((ln, i) => {
            const total =
              ln
                .split(/\s+/)
                .filter(Boolean)
                .reduce((sum, w) => sum + countSyllables(w), 0) || ''
            return (
              <div key={i} className="h-9 leading-9">
                {total}
              </div>
            )
          })}
        </div>
      </div>

      {/* Editor + overlay */}
      <div ref={containerRef} className="relative flex-1 overflow-auto">
        <div className="p-8">
          {/* Overlay for syllable badges */}
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-8 z-10"
            aria-hidden="true"
          >
            {badges.map((b, i) => (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-full text-[10px] font-semibold text-gray-300"
                style={{ left: b.x, top: b.y }}
              >
                {b.text}
              </div>
            ))}
          </div>

          {/* Editable area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder="Start writing..."
            onInput={handleChange}
            onKeyUp={handleChange}
            onBlur={handleChange}
            className="relative outline-none whitespace-pre-wrap break-words w-full min-h-[70vh] text-lg leading-9 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
