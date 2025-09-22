'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { serializeFromEditor, hydrateEditorFromText, migrateOldContent } from '@/lib/editor/serialization'
import { useRhymePanelStore } from '@/store/rhymePanelStore'

const STORAGE_KEY = 'rhyme-lines:doc:current'
const STORAGE_KEY_V2 = 'rhyme-lines:doc:current:v2'
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
  const [lineTotals, setLineTotals] = useState<number[]>([])
  const [showOverlays, setShowOverlays] = useState(true)
  
  const { isOpen: isPanelOpen, panelWidth } = useRhymePanelStore()

  const updatePlaceholder = () => {
    const el = editorRef.current
    if (!el) return
    const hasText = (el.textContent || '').trim().length > 0
    el.classList.toggle('show-placeholder', !hasText)
  }

  const updateCurrentLineHighlight = useCallback(() => {
    const el = editorRef.current
    if (!el) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      
      // Remove current-line class from all elements
      el.querySelectorAll('.current-line').forEach(element => {
        element.classList.remove('current-line')
      })
      
      // Find the line containing the caret by walking up the DOM tree
      let node: Node | null = range.startContainer
      while (node && node !== el) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element
          if (element.classList.contains('line')) {
            element.classList.add('current-line')
            break
          }
        }
        node = node.parentNode
      }
    } catch (error) {
      // Ignore errors
    }
  }, [])

  const ensureLineStructure = useCallback(() => {
    const el = editorRef.current
    if (!el) return

    // Check if content already has line structure
    const hasLineDivs = el.querySelector('.line')
    if (hasLineDivs) return

    // If no line divs, wrap content in line divs
    const content = el.innerHTML
    if (content.trim() === '') {
      el.innerHTML = '<div class="line"><br></div>'
      return
    }

    // Split by <br> and wrap each part in a line div
    const parts = content.split('<br>')
    const wrappedParts = parts.map((part, index) => {
      if (part.trim() === '') {
        return '<div class="line"><br></div>'
      }
      return `<div class="line">${part}</div>`
    })
    
    el.innerHTML = wrappedParts.join('')
  }, [])

  const saveNow = () => {
    const el = editorRef.current
    if (!el) return
    try {
      const text = serializeFromEditor(el)
      localStorage.setItem(STORAGE_KEY_V2, text)
      // Emit save complete event
      window.dispatchEvent(new CustomEvent('rhyme:save-complete'))
    } catch {}
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    // Emit save start event
    window.dispatchEvent(new CustomEvent('rhyme:save-start'))
    saveTimer.current = window.setTimeout(saveNow, SAVE_DELAY_MS)
  }

  const recomputeLineTotals = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const lines = el.innerText.replace(/\u00A0/g, ' ').split(/\r?\n/)
    const totals = lines.map(ln =>
      ln
        .split(/\s+/)
        .filter(Boolean)
        .reduce((sum, w) => sum + countSyllables(w), 0)
    )
    setLineTotals(totals)
  }, [])

  const measureWords = useCallback(() => {
    if (!showOverlays) {
      setBadges([])
      return
    }
    const root = editorRef.current
    if (!root) return

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
          const y = r.top - rootRect.top - 1
          badgesNext.push({ x, y, text: String(syl) })
        }
        range.detach()
      }
      node = walker.nextNode()
    }
    setBadges(badgesNext)
  }, [showOverlays])

  const scheduleMeasure = useCallback(() => {
    if (measureTimer.current) window.clearTimeout(measureTimer.current)
    measureTimer.current = window.setTimeout(() => {
      measureTimer.current = null
      measureWords()
      recomputeLineTotals()
    }, MEASURE_DEBOUNCE_MS)
  }, [measureWords, recomputeLineTotals])

  const handleChange = () => {
    ensureLineStructure()
    updateCurrentLineHighlight()
    updatePlaceholder()
    scheduleSave()
    scheduleMeasure()
    recomputeLineTotals()
  }

  useEffect(() => {
    const el = editorRef.current
    if (!el) return

    try {
      // Try new format first
      let saved = localStorage.getItem(STORAGE_KEY_V2)
      
      // If no v2 content, try to migrate from old format
      if (!saved) {
        const oldContent = localStorage.getItem(STORAGE_KEY)
        if (oldContent) {
          saved = migrateOldContent(oldContent)
          // Save migrated content to new format
          if (saved) {
            localStorage.setItem(STORAGE_KEY_V2, saved)
          }
        }
      }
      
      if (saved) {
        hydrateEditorFromText(el, saved)
      }
    } catch {}

    ensureLineStructure()
    updatePlaceholder()
    el.focus()
    requestAnimationFrame(() => {
      measureWords()
      recomputeLineTotals()
      updateCurrentLineHighlight()
    })

    // flush on unload
    const onBeforeUnload = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveNow()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // hotkeys: Alt+R for overlays
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        setShowOverlays(v => !v)
      }
    }
    // custom event from toolbar
    const onToggleEvent = () => setShowOverlays(v => !v)

    // Track cursor movement for current line highlighting
    const onSelectionChange = () => {
      updateCurrentLineHighlight()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
    document.addEventListener('selectionchange', onSelectionChange)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
      document.removeEventListener('selectionchange', onSelectionChange)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (measureTimer.current) window.clearTimeout(measureTimer.current)
    }
  }, [measureWords, recomputeLineTotals])

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
    <div className="flex w-full h-screen">
      {/* Left gutter */}
      <div className="w-14 shrink-0 border-r border-gray-600/30 text-right pr-2 py-8 overflow-hidden select-none">
        <div className="text-xs text-gray-400 leading-9 font-mono whitespace-pre">
          {lineTotals.map((total, i) => (
            <div key={i} className="h-9 leading-9">
              {total || ''}
            </div>
          ))}
        </div>
      </div>

      {/* Editor + overlay */}
      <div 
        ref={containerRef} 
        className="relative flex-1 overflow-auto transition-all duration-300"
        style={{
          marginRight: isPanelOpen ? `${panelWidth}px` : '0',
          maxWidth: isPanelOpen ? `calc(100% - ${panelWidth}px)` : '100%'
        }}
      >
        <div className="p-8">
          {/* Overlay for syllable badges */}
          {showOverlays && (
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
          )}

          {/* Editable area */}
          <div
            ref={editorRef}
            id="lyric-editor"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder="Start writing..."
            onInput={handleChange}
            onKeyUp={handleChange}
            onBlur={handleChange}
            onKeyDown={handleChange}
            onClick={handleChange}
            className="rl-editor relative outline-none w-full min-h-[70vh] text-lg leading-9 font-mono"
          />
        </div>
      </div>
    </div>
  )
}

