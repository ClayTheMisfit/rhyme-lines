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
type HighlightPosition = { x: number; y: number; width: number; height: number }

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const saveTimer = useRef<number | null>(null)
  const measureTimer = useRef<number | null>(null)

  const [badges, setBadges] = useState<Badge[]>([])
  const [lineTotals, setLineTotals] = useState<number[]>([])
  const [showOverlays, setShowOverlays] = useState(true)
  const [highlightPosition, setHighlightPosition] = useState<HighlightPosition | null>(null)
  
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
      if (!selection || selection.rangeCount === 0) {
        setHighlightPosition(null)
        return
      }

      const range = selection.getRangeAt(0)
      
      // Find the line containing the caret by walking up the DOM tree
      let lineElement: Element | null = null
      let node: Node | null = range.startContainer
      
      while (node && node !== el) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element
          if (element.classList.contains('line')) {
            lineElement = element
            break
          }
        }
        node = node.parentNode
      }

      if (!lineElement) {
        setHighlightPosition(null)
        return
      }

      // Get the text content of the line
      const lineText = lineElement.textContent || ''
      if (!lineText.trim()) {
        setHighlightPosition(null)
        return
      }

      // Create a temporary range to measure the text content
      const tempRange = document.createRange()
      
      // Find all text nodes in the line
      const walker = document.createTreeWalker(
        lineElement,
        NodeFilter.SHOW_TEXT,
        null
      )
      
      const textNodes: Text[] = []
      let textNode: Node | null = walker.nextNode()
      while (textNode) {
        textNodes.push(textNode as Text)
        textNode = walker.nextNode()
      }
      
      if (textNodes.length === 0) {
        setHighlightPosition(null)
        return
      }

      // Set range to cover all text content in the line
      const firstTextNode = textNodes[0]
      const lastTextNode = textNodes[textNodes.length - 1]
      
      tempRange.setStart(firstTextNode, 0)
      tempRange.setEnd(lastTextNode, lastTextNode.textContent?.length || 0)

      // Get the bounding rectangle
      const rect = tempRange.getBoundingClientRect()
      const editorRect = el.getBoundingClientRect()

      // Only show highlight if we have valid dimensions
      if (rect.width > 0 && rect.height > 0) {
        // Calculate position relative to editor
        const x = rect.left - editorRect.left
        const y = rect.top - editorRect.top
        const width = rect.width
        const height = rect.height

        setHighlightPosition({ x, y, width, height })
      } else {
        setHighlightPosition(null)
      }
      
      tempRange.detach()
    } catch (error) {
      console.warn('Error updating line highlight:', error)
      setHighlightPosition(null)
    }
  }, [])

  const ensureLineStructure = useCallback(() => {
    const el = editorRef.current
    if (!el) return

    const doc = el.ownerDocument || document

    const createLine = (): HTMLDivElement => {
      const line = doc.createElement('div')
      line.className = 'line'
      return line
    }

    const ensureLineHasContent = (line: HTMLDivElement) => {
      if (line.childNodes.length === 0) {
        line.appendChild(doc.createElement('br'))
      }
    }

    const wrapNodeWithLine = (node: Node): HTMLDivElement => {
      const line = createLine()

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (text.trim() !== '') {
          line.textContent = text
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        while (element.firstChild) {
          line.appendChild(element.firstChild)
        }
      }

      ensureLineHasContent(line)
      node.parentNode?.replaceChild(line, node)
      return line
    }

    const childNodes = Array.from(el.childNodes)
    if (childNodes.length === 0) {
      const line = createLine()
      line.appendChild(doc.createElement('br'))
      el.appendChild(line)
      return
    }

    let hasLine = false

    childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement

        if (element.tagName === 'DIV') {
          element.classList.add('line')
          ensureLineHasContent(element as HTMLDivElement)
          hasLine = true
          return
        }

        if (element.tagName === 'BR') {
          const line = createLine()
          line.appendChild(doc.createElement('br'))
          el.replaceChild(line, element)
          hasLine = true
          return
        }

        const line = wrapNodeWithLine(element)
        ensureLineHasContent(line)
        hasLine = true
        return
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (text.trim() === '') {
          node.parentNode?.removeChild(node)
          return
        }
        const line = wrapNodeWithLine(node)
        ensureLineHasContent(line)
        hasLine = true
        return
      }

      node.parentNode?.removeChild(node)
    })

    if (!hasLine) {
      el.innerHTML = ''
      const line = createLine()
      line.appendChild(doc.createElement('br'))
      el.appendChild(line)
    }
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
      updateCurrentLineHighlight()
    }, MEASURE_DEBOUNCE_MS)
  }, [measureWords, recomputeLineTotals, updateCurrentLineHighlight])

  const handleChange = () => {
    ensureLineStructure()
    updatePlaceholder()
    scheduleSave()
    scheduleMeasure()
    recomputeLineTotals()
    // Update highlight immediately for responsive feel
    updateCurrentLineHighlight()
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
          {/* Overlay for syllable badges and line highlight */}
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-8 z-10"
            aria-hidden="true"
          >
            {/* Current line highlight pill */}
            {highlightPosition && (
              <div
                className="current-line-highlight active"
                style={{
                  left: highlightPosition.x,
                  top: highlightPosition.y,
                  width: highlightPosition.width,
                  height: highlightPosition.height,
                }}
              />
            )}
            
            {/* Syllable badges */}
            {showOverlays && badges.map((b, i) => (
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

