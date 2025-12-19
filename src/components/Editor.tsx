'use client'

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { serializeFromEditor, hydrateEditorFromText } from '@/lib/editor/serialization'
import { computeLineTotals, splitNormalizedLines } from '@/lib/editor/lineTotals'
import { useSettingsStore } from '@/store/settingsStore'
import { shallow } from 'zustand/shallow'
import { useBadgeShortcuts } from '@/lib/shortcuts/badges'
import { SyllableOverlay, type OverlayToken } from '@/components/editor/SyllableOverlay'
import { useBadgeSettings } from '@/store/settings'
import LineTotalsOverlay from '@/components/editor/overlays/LineTotalsOverlay'
import { countSyllables } from '@/lib/nlp/syllables'

const PLACEHOLDER_TEXT = 'Start writing...'
const MEASURE_DEBOUNCE_MS = 50
const SAVE_STATUS_DELAY_MS = 200

type EditorProps = {
  text: string
  onTextChange: (text: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

const Editor = forwardRef<HTMLDivElement, EditorProps>(function Editor({ text, onTextChange, onDirtyChange }, ref) {
  const editorRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const highlightLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lineIdSeed = useRef(0)
  const lineElementsRef = useRef<HTMLDivElement[]>([])

  const measureTimer = useRef<number | null>(null)
  const lastSerializedRef = useRef<string>('')
  const lastHydratedTextRef = useRef<string>('')
  const hasInitializedRef = useRef(false)
  const saveStatusTimer = useRef<number | null>(null)

  const [tokens, setTokens] = useState<OverlayToken[]>([])
  const [lineTotals, setLineTotals] = useState<number[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [showOverlays, setShowOverlays] = useState(true)
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null)
  const [viewportRange, setViewportRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Number.POSITIVE_INFINITY,
  })
  const [lineVersion, setLineVersion] = useState(0)

  const { fontSize, lineHeight, showLineTotals, theme } = useSettingsStore(
    (state) => ({
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      showLineTotals: state.showLineTotals,
      theme: state.theme,
    }),
    shallow
  )

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--editor-font-size', `${fontSize}px`)
    root.style.setProperty('--editor-line-height', lineHeight.toString())
  }, [fontSize, lineHeight])
  

  const badgeMode = useBadgeSettings((state) => state.badgeMode)

  useBadgeShortcuts()

  const isPlaceholderLine = useCallback(
    (element: Element | null): element is HTMLDivElement =>
      !!element && element.getAttribute('data-placeholder-line') === 'true',
    []
  )

  const createLineElement = useCallback(
    (doc: Document, options?: { placeholder?: boolean }) => {
      const line = doc.createElement('div')
      line.className = 'line'
      if (options?.placeholder) {
        line.dataset.placeholderLine = 'true'
        line.classList.add('placeholder-line')
        const placeholder = doc.createElement('span')
        placeholder.className = 'placeholder-text'
        placeholder.setAttribute('aria-hidden', 'true')
        placeholder.setAttribute('data-placeholder-content', 'true')
        placeholder.textContent = PLACEHOLDER_TEXT
        placeholder.contentEditable = 'false'
        line.appendChild(placeholder)
      }

      if (!line.dataset.lineId) {
        line.dataset.lineId = `line-${lineIdSeed.current++}`
      }
      return line
    },
    []
  )

  const ensureLineHasContent = useCallback(
    (line: HTMLDivElement, doc: Document) => {
      const hasBreak = Array.from(line.childNodes).some((node) => node.nodeName === 'BR')
      if (!hasBreak) {
        line.appendChild(doc.createElement('br'))
      }
    },
    []
  )

  const setCaretToLineStart = useCallback((line: HTMLDivElement) => {
    const selection = line.ownerDocument.getSelection()
    if (!selection) return
    const range = line.ownerDocument.createRange()
    range.setStart(line, 0)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const replacePlaceholderWithEmptyLine = useCallback(
    (placeholderLine: HTMLDivElement) => {
      const doc = placeholderLine.ownerDocument
      const replacement = createLineElement(doc)
      replacement.dataset.lineId = placeholderLine.dataset.lineId ?? `line-${lineIdSeed.current++}`
      ensureLineHasContent(replacement, doc)
      placeholderLine.replaceWith(replacement)
      return replacement
    },
    [createLineElement, ensureLineHasContent]
  )

  const editorIsMeaningfullyEmpty = useCallback((el: HTMLElement) => {
    const lines: HTMLDivElement[] = Array.from(el.querySelectorAll<HTMLDivElement>('.line')).filter(
      (line): line is HTMLDivElement => !isPlaceholderLine(line)
    )
    if (lines.length === 0) return true
    return lines.every((line) => ((line.textContent || '').replace(/\u00A0/g, ' ').trim().length === 0))
  }, [isPlaceholderLine])

  const syncPlaceholderLine = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const doc = el.ownerDocument || document
    const placeholderLine = el.querySelector<HTMLDivElement>('[data-placeholder-line="true"]')
    const hasContent = !editorIsMeaningfullyEmpty(el)

    if (hasContent) {
      if (placeholderLine) {
        placeholderLine.remove()
      }
      return
    }

    if (placeholderLine) {
      ensureLineHasContent(placeholderLine, doc)
      if (document.activeElement === el) {
        setCaretToLineStart(placeholderLine)
      }
      return
    }

    el.innerHTML = ''
    const placeholder = createLineElement(doc, { placeholder: true })
    ensureLineHasContent(placeholder, doc)
    el.appendChild(placeholder)
    if (document.activeElement === el) {
      setCaretToLineStart(placeholder)
    }
  }, [createLineElement, editorIsMeaningfullyEmpty, ensureLineHasContent, setCaretToLineStart])

  const updateCurrentLineHighlight = useCallback(() => {
    const el = editorRef.current
    const highlightLayer = highlightLayerRef.current
    if (!el || !highlightLayer) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        highlightLayer.replaceChildren()
        setActiveLineId((prev) => (prev === null ? prev : null))
        return
      }

      const range = selection.getRangeAt(0)

      highlightLayer.replaceChildren()
      
      // Find the line containing the caret
      let lineElement: HTMLElement | null = null
      let node: Node | null = range.startContainer

      while (node && node !== el) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element
          if (element.classList.contains('line')) {
            lineElement = element as HTMLElement
            if (isPlaceholderLine(lineElement)) {
              lineElement = null
            }
            break
          }
        }
        node = node.parentNode
      }

      if (!lineElement) {
        setActiveLineId((prev) => (prev === null ? prev : null))
        return
      }

      if (!lineElement.dataset.lineId) {
        lineElement.dataset.lineId = `line-${lineIdSeed.current++}`
      }

      const resolvedLineId = lineElement.dataset.lineId ?? null
      setActiveLineId((prev) => (prev === resolvedLineId ? prev : resolvedLineId))

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
      highlight.setAttribute('aria-hidden', 'true')
      highlight.setAttribute('data-editor-overlay', 'current-line')
      highlight.tabIndex = -1
      highlight.contentEditable = 'false'
      highlight.style.pointerEvents = 'none'
      highlight.style.left = `${highlightLeft}px`
      highlight.style.top = `${highlightTop}px`
      highlight.style.width = `${highlightWidth}px`
      highlight.style.height = `${highlightHeight}px`

      highlightLayer.appendChild(highlight)
      
      lineRange.detach()
    } catch {
      // Ignore errors
    }
  }, [isPlaceholderLine])

  const ensureLineStructure = useCallback(() => {
    const el = editorRef.current
    if (!el) return

    const doc = el.ownerDocument || document

    const childNodes = Array.from(el.childNodes)
    if (childNodes.length === 0) {
      const line = createLineElement(doc)
      ensureLineHasContent(line, doc)
      el.appendChild(line)
      return
    }

    let hasLine = false

    childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement

        if (element.tagName === 'DIV') {
          element.classList.add('line')
          if (isPlaceholderLine(element)) {
            element.classList.add('placeholder-line')
          }
          if (!element.dataset.lineId) {
            element.dataset.lineId = `line-${lineIdSeed.current++}`
          }
          ensureLineHasContent(element as HTMLDivElement, doc)
          hasLine = true
          return
        }

        if (element.tagName === 'BR') {
          const line = createLineElement(doc)
          ensureLineHasContent(line, doc)
          el.replaceChild(line, element)
          hasLine = true
          return
        }

        const line = createLineElement(doc)
        while (element.firstChild) {
          line.appendChild(element.firstChild)
        }
        ensureLineHasContent(line, doc)
        element.parentNode?.replaceChild(line, element)
        hasLine = true
        return
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (text.trim() === '') {
          node.parentNode?.removeChild(node)
          return
        }
        const line = createLineElement(doc)
        line.textContent = text
        ensureLineHasContent(line, doc)
        node.parentNode?.replaceChild(line, node)
        hasLine = true
        return
      }

      node.parentNode?.removeChild(node)
    })

    if (!hasLine) {
      el.innerHTML = ''
      const line = createLineElement(doc)
      ensureLineHasContent(line, doc)
      el.appendChild(line)
    }
  }, [createLineElement, ensureLineHasContent, isPlaceholderLine])

  const announceSave = useCallback(() => {
    window.dispatchEvent(new CustomEvent('rhyme:save-start'))
    if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('rhyme:save-complete'))
    }, SAVE_STATUS_DELAY_MS)
  }, [])

  const recomputeLineTotals = useCallback(() => {
    if (!showLineTotals) {
      setLineTotals([])
      setLines([])
      return
    }
    const el = editorRef.current
    if (!el) return

    const text = serializeFromEditor(el)
    const normalizedLines = splitNormalizedLines(text)
    const totals = computeLineTotals(text, normalizedLines)

    setLines(normalizedLines)
    setLineTotals(totals)
  }, [showLineTotals])

  const measureWords = useCallback(() => {
    if (!showOverlays || badgeMode === 'off') {
      setTokens([])
      lineElementsRef.current = []
      setLineVersion((v) => v + 1)
      return
    }
    const root = editorRef.current
    if (!root) return

    const rootRect = root.getBoundingClientRect()
    const lines: HTMLDivElement[] = Array.from(root.querySelectorAll<HTMLDivElement>('.line')).filter(
      (line): line is HTMLDivElement => !isPlaceholderLine(line)
    )
    const lineOffsetMap = new Map<HTMLElement, number>()
    const lineRectMap = new Map<HTMLElement, DOMRect>()

    for (let index = 0; index < lines.length; index += 1) {
      const lineEl = lines[index]
      if (!lineEl.dataset.lineId) {
        lineEl.dataset.lineId = `line-${lineIdSeed.current++}`
      }
      lineEl.dataset.lineIndex = index.toString()

      const rect = lineEl.getBoundingClientRect()
      lineRectMap.set(lineEl, rect)

      const computed = window.getComputedStyle(lineEl)
      const fontSizePx = Number.parseFloat(computed.fontSize) || 16
      let lineHeightPx = Number.parseFloat(computed.lineHeight)
      if (!Number.isFinite(lineHeightPx)) {
        const numericLineHeight = Number.parseFloat(computed.lineHeight)
        lineHeightPx =
          Number.isFinite(numericLineHeight) && numericLineHeight > 0 ? numericLineHeight : fontSizePx * 1.6
      }
      const badgeOffsetEm = Math.min(Math.max(0.95 * (lineHeightPx / fontSizePx), 0.85), 1.25)
      lineEl.style.setProperty('--badge-offset', `${badgeOffsetEm}em`)
      lineOffsetMap.set(lineEl, badgeOffsetEm)
    }

    lineElementsRef.current = lines

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Node | null = walker.nextNode()
    const wordRegex = /[A-Za-z']+/g
    const tokensNext: OverlayToken[] = []
    let tokenId = 0

    while (node) {
      const placeholderAncestor = node.parentElement?.closest('[data-placeholder-line="true"]')
      if (placeholderAncestor) {
        node = walker.nextNode()
        continue
      }
      const text = node.textContent || ''
      let match: RegExpExecArray | null
      while ((match = wordRegex.exec(text)) !== null) {
        const start = match.index
        const end = start + match[0].length

        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, end)

        const rects = range.getClientRects()
        if (rects.length > 0) {
          const rangeRect = rects[0]
          let lineElement: HTMLElement | null = null
          let current: Node | null = range.startContainer
          while (current && current !== root) {
            if (current instanceof HTMLElement && current.classList.contains('line')) {
              lineElement = current
              break
            }
            current = current.parentNode
          }

          if (lineElement) {
            if (!lineElement.dataset.lineId) {
              lineElement.dataset.lineId = `line-${lineIdSeed.current++}`
            }
            const lineId = lineElement.dataset.lineId || `line-${lineIdSeed.current++}`
            const lineIndex = Number.parseInt(lineElement.dataset.lineIndex ?? '-1', 10)
            const lineRect = lineRectMap.get(lineElement)
            const topBase = lineRect ? lineRect.top - rootRect.top : rangeRect.top - rootRect.top
            const centerX = rangeRect.left - rootRect.left + rangeRect.width / 2
            const value = countSyllables(match[0])
            const lineOffset = lineOffsetMap.get(lineElement) ?? 0.95

            tokensNext.push({
              id: `${lineId}-${tokenId++}`,
              value,
              lineId,
              lineIndex,
              lineOffset,
              rect: {
                top: topBase,
                centerX,
              },
            })
          }
        }
        range.detach()
      }
      node = walker.nextNode()
    }
    setTokens(tokensNext)
    setLineVersion((v) => v + 1)
  }, [showOverlays, badgeMode, isPlaceholderLine])

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
    syncPlaceholderLine()
    updateCurrentLineHighlight()
    scheduleMeasure()
    recomputeLineTotals()

    const el = editorRef.current
    if (!el) return
    const serialized = serializeFromEditor(el)
    if (serialized !== lastSerializedRef.current) {
      lastSerializedRef.current = serialized
      lastHydratedTextRef.current = serialized
      onTextChange(serialized)
      onDirtyChange?.(true)
      announceSave()
    }
  }

  const handleBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent
    const inputType = typeof nativeEvent?.inputType === 'string' ? nativeEvent.inputType : ''
    if (inputType && !inputType.startsWith('insert')) return

    const el = editorRef.current
    if (!el) return
    const placeholderLine = el.querySelector<HTMLDivElement>('[data-placeholder-line="true"]')
    if (!placeholderLine) return

    const replacement = replacePlaceholderWithEmptyLine(placeholderLine)
    setCaretToLineStart(replacement)
  }

  const handleSelectionChange = useCallback(() => {
    updateCurrentLineHighlight()
  }, [updateCurrentLineHighlight])

  useEffect(() => {
    if (showLineTotals) {
      recomputeLineTotals()
    } else {
      setLineTotals([])
    }
  }, [showLineTotals, recomputeLineTotals])

  useEffect(() => {
    scheduleMeasure()
  }, [fontSize, lineHeight, scheduleMeasure])

  useEffect(() => {
    scheduleMeasure()
  }, [badgeMode, scheduleMeasure])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (hasInitializedRef.current && text === lastHydratedTextRef.current) return

    hydrateEditorFromText(el, text)
    ensureLineStructure()
    syncPlaceholderLine()
    lastHydratedTextRef.current = text
    lastSerializedRef.current = text
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      el.focus()
    }
    requestAnimationFrame(() => {
      measureWords()
      recomputeLineTotals()
      updateCurrentLineHighlight()
    })
  }, [measureWords, recomputeLineTotals, syncPlaceholderLine, text, updateCurrentLineHighlight, ensureLineStructure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        setShowOverlays((v) => !v)
      }
    }
    const onToggleEvent = () => setShowOverlays((v) => !v)

    window.addEventListener('keydown', onKey)
    window.addEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (measureTimer.current) window.clearTimeout(measureTimer.current)
      if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current)
    }
  }, [handleSelectionChange])

  useEffect(() => {
    const onResize = () => {
      scheduleMeasure()
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
  }, [scheduleMeasure, updateCurrentLineHighlight])

  useEffect(() => {
    const lines = lineElementsRef.current
    if (!lines.length) {
      setHoveredLineId(null)
      return
    }

    const handleEnter = (event: Event) => {
      const target = event.currentTarget as HTMLElement | null
      const lineId = target?.dataset.lineId ?? null
      setHoveredLineId(lineId)
    }

    const handleLeave = () => {
      setHoveredLineId(null)
    }

    lines.forEach((line) => {
      line.addEventListener('pointerenter', handleEnter)
      line.addEventListener('pointerleave', handleLeave)
    })

    return () => {
      lines.forEach((line) => {
        line.removeEventListener('pointerenter', handleEnter)
        line.removeEventListener('pointerleave', handleLeave)
      })
    }
  }, [lineVersion])

  useEffect(() => {
    const lines = lineElementsRef.current
    lines.forEach((line) => {
      const id = line.dataset.lineId
      if (!id) return
      if (id === activeLineId) {
        line.dataset.activeLine = 'true'
      } else {
        delete line.dataset.activeLine
      }
    })
  }, [activeLineId, lineVersion])

  useEffect(() => {
    const container = containerRef.current
    const lines = lineElementsRef.current
    if (!container || !lines.length) {
      setViewportRange({ start: 0, end: Number.POSITIVE_INFINITY })
      return
    }

    const visible = new Set<number>()

    const commitRange = () => {
      if (!visible.size) {
        setViewportRange({ start: 0, end: Number.POSITIVE_INFINITY })
        return
      }
      const sorted = Array.from(visible).sort((a, b) => a - b)
      setViewportRange({ start: sorted[0], end: sorted[sorted.length - 1] })
    }

    const measureFromGeometry = () => {
      let changed = false
      const containerRect = container.getBoundingClientRect()
      const seen = new Set<number>()

      lines.forEach((line) => {
        const rect = line.getBoundingClientRect()
        const index = Number.parseInt(line.dataset.lineIndex ?? '-1', 10)
        if (Number.isNaN(index)) return

        const intersects = rect.bottom >= containerRect.top && rect.top <= containerRect.bottom
        if (intersects) {
          seen.add(index)
          if (!visible.has(index)) {
            visible.add(index)
            changed = true
          }
        } else if (visible.delete(index)) {
          changed = true
        }
      })

      visible.forEach((index) => {
        if (!seen.has(index) && visible.delete(index)) {
          changed = true
        }
      })

      if (changed || !visible.size) {
        commitRange()
      }
    }

    let observer: IntersectionObserver | null = null
    let manualCleanup: (() => void) | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          let changed = false
          for (const entry of entries) {
            const element = entry.target as HTMLElement
            const index = Number.parseInt(element.dataset.lineIndex ?? '-1', 10)
            if (Number.isNaN(index)) continue
            if (entry.isIntersecting && entry.intersectionRatio > 0) {
              if (!visible.has(index)) {
                visible.add(index)
                changed = true
              }
            } else if (visible.delete(index)) {
              changed = true
            }
          }
          if (changed) {
            commitRange()
          }
        },
        {
          root: container,
          threshold: 0,
        }
      )

      lines.forEach((line) => observer?.observe(line))
    } else {
      // Fallback for environments without IntersectionObserver (e.g. Jest)
      const handleScroll = () => measureFromGeometry()
      const handleResize = () => measureFromGeometry()

      container.addEventListener('scroll', handleScroll, { passive: true })
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', handleResize)
      }

      manualCleanup = () => {
        container.removeEventListener('scroll', handleScroll)
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', handleResize)
        }
      }

      measureFromGeometry()
    }

    let rafId = 0
    if (typeof window !== 'undefined') {
      rafId = window.requestAnimationFrame(() => {
        measureFromGeometry()
      })
    }

    return () => {
      if (observer) {
        observer.disconnect()
      }
      if (manualCleanup) {
        manualCleanup()
      }
      if (rafId && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [lineVersion])

  const handleAssignEditorRef = useCallback(
    (node: HTMLDivElement | null) => {
      editorRef.current = node

      if (!ref) return
      if (typeof ref === 'function') {
        ref(node)
        return
      }

      ref.current = node
    },
    [ref]
  )

  const ensureEditorFocus = useCallback(() => {
    const node = editorRef.current
    if (!node) return
    if (document.activeElement !== node) {
      node.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className="flex w-full h-full">
      {/* Editor + overlay */}
      <div
        ref={containerRef}
        data-editor-scroll
        className="relative flex-1 overflow-auto transition-all duration-300"
        style={{
          marginRight: 'var(--panel-right-offset, 0px)',
          maxWidth: 'calc(100% - var(--panel-right-offset, 0px))',
        }}
      >
        <div className="editor-root relative">
          <div className="rl-editor-grid">
            <LineTotalsOverlay
              lineTotals={lineTotals}
              lines={lines}
              showLineTotals={showLineTotals}
              theme={theme}
            />

            <div className="relative min-h-[70vh]">
              {/* Layer contract: highlight (z-0, inert) sits below text; badges (z-20, inert) float above; editable layer owns all focus. */}
              <div
                ref={highlightLayerRef}
                className="pointer-events-none absolute inset-0 z-0"
                aria-hidden="true"
                data-layer="highlight"
                contentEditable={false}
              />
              {/* Overlay for syllable badges */}
              <div
                ref={overlayRef}
                className="pointer-events-none absolute inset-0 z-20"
                aria-hidden="true"
                tabIndex={-1}
                data-layer="overlay"
                contentEditable={false}
              >
                <SyllableOverlay
                  tokens={tokens}
                  activeLineId={activeLineId}
                  hoveredLineId={hoveredLineId}
                  viewportStart={viewportRange.start}
                  viewportEnd={viewportRange.end}
                  enabled={showOverlays}
                />
              </div>

              {/* Editable area */}
              <div
                ref={handleAssignEditorRef}
                id="lyric-editor"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                data-layer="editable"
                onBeforeInput={handleBeforeInput}
                onInput={handleChange}
                onKeyUp={handleChange}
                onBlur={handleChange}
                onKeyDown={handleChange}
                onClick={(event) => {
                  ensureEditorFocus()
                  handleChange()
                  event.stopPropagation()
                }}
                onPointerDown={ensureEditorFocus}
                className="rl-editor relative z-10 outline-none w-full min-h-[70vh] font-mono pointer-events-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

Editor.displayName = 'Editor'

export default Editor
