'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { serializeFromEditor, hydrateEditorFromText, migrateOldContent } from '@/lib/editor/serialization'
import { tokenizeKeepPunctuation } from '@/lib/tokenize'
import Line, { Token } from './editor/Line'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettings } from '@/state/settings'
import { useEditorHotkeys } from '@/hooks/useHotkeys'

const STORAGE_KEY = 'rhyme-lines:doc:current'
const STORAGE_KEY_V2 = 'rhyme-lines:doc:current:v2'
const SAVE_DELAY_MS = 250
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

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const saveTimer = useRef<number | null>(null)

  const [lineTotals, setLineTotals] = useState<number[]>([])
  const [lineTokens, setLineTokens] = useState<Token[][]>([])

  const showCounts = useSettings(state => state.showSyllableCounts)
  const toggleCounts = useSettings(state => state.toggleShowSyllableCounts)
  const { isOpen: isPanelOpen, panelWidth } = useRhymePanelStore()

  useEditorHotkeys()

  const updatePlaceholder = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const hasText = (el.textContent || '').trim().length > 0
    el.classList.toggle('show-placeholder', !hasText)
  }, [])

  const updateCurrentLineHighlight = useCallback(() => {
    const el = editorRef.current
    if (!el) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        // Remove existing highlight if no selection
        const existingHighlight = el.querySelector('.current-line-highlight')
        if (existingHighlight) {
          existingHighlight.remove()
        }
        return
      }

      const range = selection.getRangeAt(0)
      
      // Remove existing highlight
      const existingHighlight = el.querySelector('.current-line-highlight')
      if (existingHighlight) {
        existingHighlight.remove()
      }
      
      // Find the line containing the caret
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

      if (!lineElement) return

      // Create a range that spans the entire line content
      const lineRange = document.createRange()
      lineRange.selectNodeContents(lineElement)
      
      // Get the bounding rectangle of the line content
      const rects = lineRange.getClientRects()
      if (rects.length === 0) {
        lineRange.detach()
        return
      }

      // Calculate the highlight position relative to the editor
      const editorRect = el.getBoundingClientRect()
      const firstRect = rects[0]
      const lastRect = rects[rects.length - 1]
      
      const highlightLeft = firstRect.left - editorRect.left
      const highlightTop = firstRect.top - editorRect.top
      const highlightWidth = lastRect.right - firstRect.left
      const highlightHeight = firstRect.height

      // Create the highlight element
      const highlight = document.createElement('div')
      highlight.className = 'current-line-highlight active'
      highlight.style.left = `${highlightLeft}px`
      highlight.style.top = `${highlightTop}px`
      highlight.style.width = `${highlightWidth}px`
      highlight.style.height = `${highlightHeight}px`

      // Forward clicks to the underlying line element
      highlight.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        // Create a range at the end of the line content
        const range = document.createRange()
        range.selectNodeContents(lineElement)
        range.collapse(false) // Collapse to end
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        // Update highlight after selection change
        setTimeout(() => updateCurrentLineHighlight(), 0)
      })

      // Insert the highlight before the line element
      lineElement.parentNode?.insertBefore(highlight, lineElement)
      
      lineRange.detach()
    } catch {
      // Ignore errors
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

  const updateSyllableLayout = useCallback(() => {
    const root = editorRef.current
    if (!root) return

    const lineElements = Array.from(root.querySelectorAll<HTMLDivElement>('.line'))
    if (lineElements.length === 0) {
      setLineTokens([])
      setLineTotals([])
      return
    }

    const totals: number[] = []
    const tokenLines: Token[][] = lineElements.map(lineEl => {
      const rawText = (lineEl.textContent || '').replace(/\u00A0/g, ' ')
      if (!rawText) {
        totals.push(0)
        return []
      }

      const words = tokenizeKeepPunctuation(rawText)
      const tokens: Token[] = []
      let cursor = 0

      for (const word of words) {
        const index = rawText.indexOf(word, cursor)
        const start = index === -1 ? cursor : index
        if (start > cursor) {
          tokens.push({ text: rawText.slice(cursor, start), syl: 0, kind: 'space' })
        }
        tokens.push({ text: word, syl: countSyllables(word), kind: 'word' })
        cursor = start + word.length
      }

      if (cursor < rawText.length) {
        tokens.push({ text: rawText.slice(cursor), syl: 0, kind: 'space' })
      }

      const total = tokens.reduce((sum, token) => (token.kind === 'word' ? sum + token.syl : sum), 0)
      totals.push(total)
      return tokens
    })

    setLineTotals(totals)
    setLineTokens(tokenLines)
  }, [])

  const handleChange = () => {
    ensureLineStructure()
    updateCurrentLineHighlight()
    updatePlaceholder()
    scheduleSave()
    updateSyllableLayout()
  }

  const handleSelectionChange = useCallback(() => {
    updateCurrentLineHighlight()
  }, [updateCurrentLineHighlight])

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
      updateSyllableLayout()
      updateCurrentLineHighlight()
    })

    // flush on unload
    const onBeforeUnload = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveNow()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // custom event from toolbar
    const onToggleEvent = () => toggleCounts()

    window.addEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [
    ensureLineStructure,
    updatePlaceholder,
    updateCurrentLineHighlight,
    updateSyllableLayout,
    toggleCounts,
    handleSelectionChange,
  ])

  useEffect(() => {
    const onResize = () => {
      updateCurrentLineHighlight()
    }
    window.addEventListener('resize', onResize)
    const scroller = containerRef.current
    const onScroll = () => {
      updateCurrentLineHighlight()
    }
    scroller?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      scroller?.removeEventListener('scroll', onScroll)
    }
  }, [updateCurrentLineHighlight])

  return (
    <div className="flex w-full h-screen">
      {/* Left gutter */}
      <div className="w-14 shrink-0 border-r border-gray-600/30 text-right pr-2 py-8 overflow-hidden select-none">
        <div className="text-xs text-gray-400 font-mono whitespace-pre" style={{ lineHeight: 'var(--editor-line-height, 1.5)' }}>
          {lineTotals.map((total, i) => (
            <div key={i} style={{ height: 'calc(var(--editor-font-size, 16px) * var(--editor-line-height, 1.5))', lineHeight: 'var(--editor-line-height, 1.5)' }}>
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
          <div className="relative">
            <div
              className="pointer-events-none select-none relative z-30"
              aria-hidden="true"
              style={{ opacity: showCounts ? 1 : 0 }}
            >
              <div className="rl-editor font-mono min-h-[70vh] text-transparent">
                {lineTokens.map((tokens, index) => (
                  <Line key={index} tokens={tokens} showCounts={showCounts} wordClassName="text-transparent" />
                ))}
              </div>
            </div>

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
              className="rl-editor absolute inset-0 z-20 outline-none w-full min-h-[70vh] font-mono"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

