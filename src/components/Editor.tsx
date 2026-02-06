'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { serializeFromEditor, hydrateEditorFromText } from '@/lib/editor/serialization'
import { useSettingsStore } from '@/store/settingsStore'
import { shallow } from 'zustand/shallow'
import { useBadgeShortcuts } from '@/lib/shortcuts/badges'
import { SyllableOverlay } from '@/components/editor/SyllableOverlay'
import { RhymeHighlightOverlay } from '@/components/editor/RhymeHighlightOverlay'
import { useBadgeSettings } from '@/store/settings'
import { useRhymeHighlightStore, type RhymeHighlightState } from '@/store/rhymeHighlightStore'
import LineTotalsOverlay from '@/components/editor/overlays/LineTotalsOverlay'
import { useAnalysisWorker } from '@/hooks/useAnalysisWorker'
import type { LineInput } from '@/lib/analysis/compute'
import { resolveEditorShortcut } from '@/lib/editor/shortcuts'
import { useViewportWindow } from '@/hooks/useViewportWindow'
import { useOverlayMeasurement, invalidateOverlayMeasurementDoc } from '@/hooks/useOverlayMeasurement'
import { resolveTheme } from '@/lib/theme/resolveTheme'
import type { RhymeToken } from '@/lib/rhyme/highlight'
import { buildTokenGroupIndex } from '@/lib/rhyme/highlight'

const PLACEHOLDER_TEXT = 'Start writing...'
const SAVE_STATUS_DELAY_MS = 200
const ANALYSIS_DOC_ID = 'rhyme-editor'
const DEBUG_EDITOR = process.env.NEXT_PUBLIC_DEBUG_EDITOR === '1'
const DEBUG_ACTIVE_LINE = process.env.NEXT_PUBLIC_DEBUG_ACTIVE_LINE === '1'
const ENABLE_RHYME_HIGHLIGHT_SHORTCUTS = process.env.NEXT_PUBLIC_RHYME_HIGHLIGHT_SHORTCUTS === '1'
const LINE_HIGHLIGHT_DEBOUNCE_MS = 50
const DEBUG_PASTE_PERF = process.env.NEXT_PUBLIC_DEBUG_PASTE_PERF === '1'
const PASTE_NORMALIZE_IDLE_TIMEOUT_MS = 500
const ACTIVE_LINE_TUNING = {
  radius: 12,
  yInset: 1,
  hInset: 3,
  bgDark: 0.012,
  borderDark: 0.028,
  bgLight: 0.02,
  borderLight: 0.04,
  opacityBlurred: 0.45,
  motionPosMs: 140,
  motionOpacityMs: 90,
}

type EditorProps = {
  text?: string
  onTextChange?: (text: string) => void
  onDirtyChange?: (dirty: boolean) => void
  hydrated?: boolean
}

export type EditorHandle = {
  focus: () => void
  insertText: (text: string) => boolean
  forceDocumentSync: () => void
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { text = '', onTextChange = () => {}, onDirtyChange, hydrated = false },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const textColRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lineIdSeed = useRef(0)
  const lineElementsRef = useRef<HTMLDivElement[]>([])
  const analysisLinesRef = useRef<LineInput[]>([])

  const lastSerializedRef = useRef<string>('')
  const lastHydratedTextRef = useRef<string>('')
  const lastPropTextRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)
  const saveStatusTimer = useRef<number | null>(null)
  const skipHydrateRef = useRef<string | null>(null)

  const [lineInputs, setLineInputs] = useState<LineInput[]>([])
  const [lineTotals, setLineTotals] = useState<number[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [showOverlays, setShowOverlays] = useState(true)
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null)
  const [lineVersion, setLineVersion] = useState(0)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [lineHighlight, setLineHighlight] = useState({
    top: 0,
    height: 0,
    visible: false,
    foundLine: false,
    lineId: null as string | null,
    debugTextColLeft: 0,
    debugLineLeft: 0,
  })

  const composingRef = useRef(false)
  const highlightDebounceRef = useRef<number | null>(null)
  const lastHighlightRef = useRef(lineHighlight)
  const debugLogRef = useRef(0)
  const debugForceRef = useRef({ forceShow: false })
  const beforeInputPasteHandledRef = useRef(false)
  const postPasteRafRef = useRef<number | null>(null)
  const postPasteIdleRef = useRef<number | null>(null)

  const {
    activeRhymeGroupKey,
    focusLocked,
    setActiveRhymeGroupKey,
    setFocusLocked,
    clearFocus,
  } = useRhymeHighlightStore(
    (state: RhymeHighlightState) => ({
      activeRhymeGroupKey: state.activeRhymeGroupKey,
      focusLocked: state.focusLocked,
      setActiveRhymeGroupKey: state.setActiveRhymeGroupKey,
      setFocusLocked: state.setFocusLocked,
      clearFocus: state.clearFocus,
    }),
    shallow
  )
  const getColorRegistry = useRhymeHighlightStore((state: RhymeHighlightState) => state.getColorRegistry)
  const colorRegistry = useMemo(() => getColorRegistry(ANALYSIS_DOC_ID), [getColorRegistry])

  const {
    fontSize,
    lineHeight,
    showLineTotals,
    theme,
    rhymeHighlightEnabled,
    rhymeHighlightMode,
    includeExactRepeats,
    rhymeIgnoreStopwords,
    setRhymeHighlightEnabled,
    setRhymeHighlightMode,
  } = useSettingsStore(
    (state) => ({
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      showLineTotals: state.showLineTotals,
      theme: state.theme,
      rhymeHighlightEnabled: state.rhymeHighlightEnabled,
      rhymeHighlightMode: state.rhymeHighlightMode,
      includeExactRepeats: state.includeExactRepeats,
      rhymeIgnoreStopwords: state.rhymeIgnoreStopwords,
      setRhymeHighlightEnabled: state.setRhymeHighlightEnabled,
      setRhymeHighlightMode: state.setRhymeHighlightMode,
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

  const { analysis, analysisMode, scheduleAnalysis, metrics } = useAnalysisWorker(ANALYSIS_DOC_ID)
  const { activeLineIds, viewportRange } = useViewportWindow(containerRef, lineElementsRef, lineVersion, {
    bufferLines: 12,
  })
  const rhymeOverlayEnabled = showOverlays && rhymeHighlightEnabled
  const overlayEnabled = showOverlays && badgeMode !== 'off'
  const measurementEnabled = overlayEnabled || rhymeOverlayEnabled
  const { tokens, rhymeTokens, measurementMeta } = useOverlayMeasurement({
    docId: ANALYSIS_DOC_ID,
    enabled: measurementEnabled,
    syllableEnabled: overlayEnabled,
    rhymeEnabled: rhymeOverlayEnabled,
    editorRef,
    containerRef,
    lineElementsRef,
    lineVersion,
    activeLineIds,
    lines: lineInputs,
    analysis,
    theme,
    fontSize,
    lineHeight,
  })

  const rhymeGroups = useMemo(() => analysis?.rhymeHighlights?.groups ?? [], [analysis?.rhymeHighlights?.groups])
  const rhymeTokensByLine = useMemo(() => {
    const map = new Map<string, RhymeToken[]>()
    const analysisTokens = analysis?.rhymeHighlights?.tokens ?? []
    for (const token of analysisTokens) {
      const existing = map.get(token.lineId)
      if (existing) {
        existing.push(token)
      } else {
        map.set(token.lineId, [token])
      }
    }
    return map
  }, [analysis?.rhymeHighlights?.tokens])

  const groupKeyByTokenId = useMemo(() => {
    const map = new Map<string, string>()
    const groupIndex = buildTokenGroupIndex(rhymeGroups)
    groupIndex.forEach((group, tokenId) => {
      map.set(tokenId, group.key)
    })
    return map
  }, [rhymeGroups])

  const captureSelectionSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return null
    const selection = window.getSelection()
    if (!selection) return null
    return {
      anchorOffset: selection.anchorOffset,
      focusOffset: selection.focusOffset,
      anchorNode: selection.anchorNode?.nodeName ?? null,
      focusNode: selection.focusNode?.nodeName ?? null,
      isCollapsed: selection.isCollapsed,
    }
  }, [])

  const logDebugEvent = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      if (!DEBUG_EDITOR) return
      const selection = captureSelectionSnapshot()
      console.debug(`[editor:${type}]`, { ...payload, selection })
    },
    [captureSelectionSnapshot]
  )

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
    logDebugEvent('sync-placeholder', {
      hasContent,
      placeholderPresent: !!placeholderLine,
      lineCount: el.querySelectorAll('.line').length,
    })

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
  }, [createLineElement, editorIsMeaningfullyEmpty, ensureLineHasContent, logDebugEvent, setCaretToLineStart])

  const getActiveLineElementFromSelection = useCallback(
    (selection: Selection | null, root: HTMLElement): HTMLDivElement | null => {
      if (!selection || selection.rangeCount === 0) return null
      const candidateNode = selection.focusNode ?? selection.anchorNode
      if (!candidateNode || !root.contains(candidateNode)) return null
      const anchorElement =
        candidateNode.nodeType === Node.ELEMENT_NODE
          ? (candidateNode as Element)
          : candidateNode.parentElement
      const lineElement =
        anchorElement?.closest<HTMLDivElement>(
          '[data-line-id], [data-line], .editor-line, .line'
        ) ?? null
      if (!lineElement || isPlaceholderLine(lineElement)) return null
      return lineElement
    },
    [isPlaceholderLine]
  )

  const getCaretTokenId = useCallback(
    (selection: Selection | null): string | null => {
      const root = editorRef.current
      if (!selection || !root || selection.rangeCount === 0) return null
      const lineElement = getActiveLineElementFromSelection(selection, root)
      if (!lineElement) return null
      const lineId = lineElement.dataset.lineId
      if (!lineId) return null
      const lineTokens = rhymeTokensByLine.get(lineId) ?? []
      if (!lineTokens.length) return null
      const range = selection.getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(lineElement)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      const offset = preCaretRange.toString().length
      const token = lineTokens.find((candidate) => offset >= candidate.start && offset <= candidate.end)
      return token?.id ?? null
    },
    [getActiveLineElementFromSelection, rhymeTokensByLine]
  )

  const findLineByCaretPosition = useCallback(
    (selection: Selection, root: HTMLElement): HTMLDivElement | null => {
      if (selection.rangeCount === 0) return null
      const range = selection.getRangeAt(0)
      const ancestor = range.commonAncestorContainer
      if (!root.contains(ancestor)) return null
      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
      if (!rect || !rect.height) return null
      const caretY = rect.top + rect.height / 2
      const candidates = Array.from(
        root.querySelectorAll<HTMLDivElement>('[data-line-id], [data-line], .editor-line, .line')
      ).filter((line) => line.getAttribute('data-placeholder-line') !== 'true')
      for (const line of candidates) {
        const lineRect = line.getBoundingClientRect()
        if (caretY >= lineRect.top && caretY <= lineRect.bottom) {
          return line
        }
      }
      return null
    },
    [isPlaceholderLine]
  )

  const measureLineRect = useCallback((lineEl: HTMLElement, textColEl: HTMLElement) => {
    const contentEl =
      lineEl.querySelector<HTMLElement>('[data-line-content], .line-content') ?? lineEl
    const contentRect = contentEl.getBoundingClientRect()
    const textColRect = textColEl.getBoundingClientRect()
    if (!contentRect.height || !textColRect.height) return null
    return {
      top: contentRect.top - textColRect.top,
      height: contentRect.height,
      debugTextColLeft: textColRect.left,
      debugLineLeft: contentRect.left,
    }
  }, [])

  const setHighlightState = useCallback((next: typeof lineHighlight) => {
    const prev = lastHighlightRef.current
    const delta =
      prev.visible !== next.visible ||
      Math.abs(prev.top - next.top) > 0.5 ||
      Math.abs(prev.height - next.height) > 0.5 ||
      prev.foundLine !== next.foundLine ||
      prev.lineId !== next.lineId ||
      (DEBUG_ACTIVE_LINE &&
        (Math.abs(prev.debugLineLeft - next.debugLineLeft) > 0.5 ||
          Math.abs(prev.debugTextColLeft - next.debugTextColLeft) > 0.5))
    if (!delta) return
    lastHighlightRef.current = next
    setLineHighlight(next)
  }, [])

  const updateCurrentLineHighlight = useCallback(() => {
    const editorEl = editorRef.current
    const textColEl = textColRef.current
    if (!editorEl || !textColEl) return

    try {
      const selection = window.getSelection()
      let lineElement = getActiveLineElementFromSelection(selection, editorEl)
      if (!lineElement && selection) {
        lineElement = findLineByCaretPosition(selection, editorEl)
      }
      const forceShow = DEBUG_ACTIVE_LINE ? debugForceRef.current.forceShow : false

      if (forceShow) {
        setHighlightState({
          top: 0,
          height: 24,
          visible: true,
          foundLine: false,
          lineId: null,
          debugTextColLeft: 0,
          debugLineLeft: 0,
        })
        if (DEBUG_ACTIVE_LINE) {
          const now = Date.now()
          if (now - debugLogRef.current > 200) {
            debugLogRef.current = now
            console.debug('[active-line]', {
              hasSelection: !!selection,
              foundLine: false,
              lineId: null,
              top: 0,
              height: 24,
              textColLeft: 0,
              lineLeft: 0,
              forceShow: true,
            })
          }
        }
        return
      }

      if (!lineElement) {
        setActiveLineId((prev) => (prev === null ? prev : null))
        setHighlightState({
          top: 0,
          height: 0,
          visible: false,
          foundLine: false,
          lineId: null,
          debugTextColLeft: 0,
          debugLineLeft: 0,
        })
        if (DEBUG_ACTIVE_LINE) {
          const now = Date.now()
          if (now - debugLogRef.current > 200) {
            debugLogRef.current = now
            console.debug('[active-line]', {
              hasSelection: !!selection,
              foundLine: false,
              lineId: null,
              top: 0,
              height: 0,
              textColLeft: 0,
              lineLeft: 0,
              forceShow: false,
            })
          }
        }
        return
      }

      if (!lineElement.dataset.lineId) {
        lineElement.dataset.lineId = `line-${lineIdSeed.current++}`
      }

      const resolvedLineId = lineElement.dataset.lineId ?? null
      setActiveLineId((prev) => (prev === resolvedLineId ? prev : resolvedLineId))

      // Overlay positioning: measure line rects in viewport space, then convert to text-column
      // coordinates and adjust for the scroll container so the highlight tracks scrolling.
      const lineRect = measureLineRect(lineElement, textColEl)
      if (!lineRect) {
        setHighlightState({
          top: 0,
          height: 0,
          visible: false,
          foundLine: true,
          lineId: resolvedLineId,
          debugTextColLeft: 0,
          debugLineLeft: 0,
        })
        if (DEBUG_ACTIVE_LINE) {
          const now = Date.now()
          if (now - debugLogRef.current > 200) {
            debugLogRef.current = now
            console.debug('[active-line]', {
              hasSelection: !!selection,
              foundLine: true,
              lineId: resolvedLineId,
              top: 0,
              height: 0,
              textColLeft: 0,
              lineLeft: 0,
              forceShow: false,
            })
          }
        }
        return
      }

      const containerEl = containerRef.current
      const scrollTop = containerEl?.scrollTop ?? 0
      const top = lineRect.top + scrollTop
      const height = Math.max(lineRect.height, 18)

      setHighlightState({
        top,
        height,
        visible: true,
        foundLine: true,
        lineId: resolvedLineId,
        debugTextColLeft: lineRect.debugTextColLeft,
        debugLineLeft: lineRect.debugLineLeft,
      })
      if (DEBUG_ACTIVE_LINE) {
        const now = Date.now()
        if (now - debugLogRef.current > 200) {
          debugLogRef.current = now
          console.debug('[active-line]', {
            hasSelection: !!selection,
            foundLine: true,
            lineId: resolvedLineId,
            top: Math.round(top),
            height: Math.round(height),
            textColLeft: Math.round(lineRect.debugTextColLeft),
            lineLeft: Math.round(lineRect.debugLineLeft),
            forceShow: false,
          })
        }
      }
    } catch {
      // Ignore errors
    }
  }, [findLineByCaretPosition, getActiveLineElementFromSelection, measureLineRect, setHighlightState])

  const scheduleCurrentLineHighlight = useCallback(
    (options?: { immediate?: boolean }) => {
      if (composingRef.current) return
      if (highlightDebounceRef.current) {
        window.clearTimeout(highlightDebounceRef.current)
      }
      const delay = options?.immediate ? 0 : LINE_HIGHLIGHT_DEBOUNCE_MS
      highlightDebounceRef.current = window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          updateCurrentLineHighlight()
        })
      }, delay)
    },
    [updateCurrentLineHighlight]
  )

  const resolvedTheme = resolveTheme(theme, { hydrated })
  const isDarkTheme = resolvedTheme === 'dark'

  const adjustedHeight = Math.max(lineHighlight.height - ACTIVE_LINE_TUNING.hInset, 18)
  const highlightStyle = {
    top: `${lineHighlight.top + ACTIVE_LINE_TUNING.yInset}px`,
    height: `${adjustedHeight}px`,
    opacity: lineHighlight.visible ? (isEditorFocused ? 1 : ACTIVE_LINE_TUNING.opacityBlurred) : 0,
    '--rl-active-line-bg': `rgba(${isDarkTheme ? '255, 255, 255' : '0, 0, 0'}, ${
      isDarkTheme ? ACTIVE_LINE_TUNING.bgDark : ACTIVE_LINE_TUNING.bgLight
    })`,
    '--rl-active-line-border': `rgba(${isDarkTheme ? '255, 255, 255' : '0, 0, 0'}, ${
      isDarkTheme ? ACTIVE_LINE_TUNING.borderDark : ACTIVE_LINE_TUNING.borderLight
    })`,
    '--rl-active-line-transition': `${ACTIVE_LINE_TUNING.motionPosMs}ms`,
    '--rl-active-line-opacity-transition': `${ACTIVE_LINE_TUNING.motionOpacityMs}ms`,
  } as const

  const highlightDebugStyle = {
    top: `${Math.max(lineHighlight.top - 16, 0)}px`,
    left: '0px',
    opacity: DEBUG_ACTIVE_LINE ? 1 : 0,
  } as const

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

  const collectLineInputs = useCallback((): { lines: LineInput[]; elements: HTMLDivElement[] } => {
    const el = editorRef.current
    if (!el) return { lines: [], elements: [] }

    const elements = Array.from(el.querySelectorAll<HTMLDivElement>('.line')).filter(
      (line): line is HTMLDivElement => !isPlaceholderLine(line)
    )

    const seenIds = new Set<string>()
    const nextLineId = () => `line-${lineIdSeed.current++}`

    const lines = elements.map((line, index) => {
      const existingId = line.dataset.lineId
      let lineId = existingId ?? nextLineId()
      if (seenIds.has(lineId)) {
        lineId = nextLineId()
      }
      seenIds.add(lineId)
      line.dataset.lineId = lineId
      line.dataset.lineIndex = index.toString()
      return {
        id: lineId,
        text: (line.textContent ?? '').replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n'),
      }
    })

    lineElementsRef.current = elements
    return { lines, elements }
  }, [isPlaceholderLine])

  const announceSave = useCallback(() => {
    window.dispatchEvent(new CustomEvent('rhyme:save-start'))
    if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('rhyme:save-complete'))
    }, SAVE_STATUS_DELAY_MS)
  }, [])

  const handleChange = useCallback((mode: 'typing' | 'paste' = 'typing') => {
    ensureLineStructure()
    syncPlaceholderLine()
    const el = editorRef.current
    logDebugEvent('change', {
      phase: 'post-structure',
      childCount: el?.childNodes.length ?? 0,
    })
    if (!el) return
    const { lines: collectedLines } = collectLineInputs()
    scheduleCurrentLineHighlight()
    analysisLinesRef.current = collectedLines
    setLineInputs(collectedLines)
    setLines(collectedLines.map((line) => line.text))
    scheduleAnalysis(collectedLines, mode, {
      enabled: rhymeHighlightEnabled,
      includeExactRepeats,
      ignoreStopwords: rhymeIgnoreStopwords,
    })
    setLineVersion((v) => v + 1)

    const serialized = serializeFromEditor(el)
    if (serialized !== lastSerializedRef.current) {
      lastSerializedRef.current = serialized
      lastHydratedTextRef.current = serialized
      skipHydrateRef.current = serialized
      onTextChange(serialized)
      onDirtyChange?.(true)
      announceSave()
    }
  }, [
    announceSave,
    collectLineInputs,
    ensureLineStructure,
    includeExactRepeats,
    rhymeIgnoreStopwords,
    logDebugEvent,
    onDirtyChange,
    onTextChange,
    rhymeHighlightEnabled,
    scheduleAnalysis,
    scheduleCurrentLineHighlight,
    syncPlaceholderLine,
  ])

  const handleShortcutKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      logDebugEvent('keydown', {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        defaultPrevented: event.defaultPrevented,
      })
      const shortcut = resolveEditorShortcut(event)
      if (!shortcut) return
      event.preventDefault()
      window.dispatchEvent(new CustomEvent('rhyme:editor-shortcut', { detail: shortcut }))
    },
    [logDebugEvent]
  )

  const handleInputEvent = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const nativeEvent = event.nativeEvent as InputEvent
      logDebugEvent('input', {
        inputType: typeof nativeEvent?.inputType === 'string' ? nativeEvent.inputType : '',
        data: nativeEvent?.data ?? null,
        defaultPrevented: nativeEvent?.defaultPrevented ?? event.isDefaultPrevented(),
      })
      handleChange()
    },
    [handleChange, logDebugEvent]
  )

  const normalizePastedText = useCallback((value: string) => value.replace(/\r\n?/g, '\n'), [])

  const markPastePerf = useCallback((label: string) => {
    if (!DEBUG_PASTE_PERF || typeof performance === 'undefined') return
    performance.mark(label)
  }, [])

  const measurePastePerf = useCallback((name: string, start: string, end: string) => {
    if (!DEBUG_PASTE_PERF || typeof performance === 'undefined') return
    try {
      performance.measure(name, start, end)
      const entries = performance.getEntriesByName(name)
      const entry = entries[entries.length - 1]
      if (entry) {
        console.debug('[paste:perf]', name, entry.duration.toFixed(2))
      }
      performance.clearMeasures(name)
    } catch {
      // ignored
    }
  }, [])

  const normalizeEditorDom = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const normalizedText = serializeFromEditor(el)
    hydrateEditorFromText(el, normalizedText)
    ensureLineStructure()
    syncPlaceholderLine()
  }, [ensureLineStructure, syncPlaceholderLine])

  const insertPlainTextAtSelection = useCallback(
    (textToInsert: string) => {
      const node = editorRef.current
      if (!node) return false
      if (document.activeElement !== node) {
        node.focus({ preventScroll: true })
      }
      try {
        if (typeof document.execCommand === 'function') {
          return document.execCommand('insertText', false, textToInsert)
        }
      } catch {
        // Fall through to range insertion.
      }

      const selection = window.getSelection()
      if (!selection) return false
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
      if (selection.rangeCount === 0) {
        range.selectNodeContents(node)
        range.collapse(false)
      }
      range.deleteContents()
      const textNode = document.createTextNode(textToInsert)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      return true
    },
    []
  )

  const schedulePostPasteWork = useCallback(() => {
    if (postPasteRafRef.current) {
      window.cancelAnimationFrame(postPasteRafRef.current)
    }
    postPasteRafRef.current = window.requestAnimationFrame(() => {
      markPastePerf('paste:raf:start')
      invalidateOverlayMeasurementDoc(ANALYSIS_DOC_ID)
      markPastePerf('paste:cache-invalidated')
      handleChange('paste')
      markPastePerf('paste:analysis-scheduled')
      scheduleCurrentLineHighlight({ immediate: true })
      markPastePerf('paste:measure-scheduled')
      measurePastePerf('paste:raf-total', 'paste:start', 'paste:measure-scheduled')

      const scheduleIdle = (callback: () => void) => {
        if (typeof window.requestIdleCallback === 'function') {
          postPasteIdleRef.current = window.requestIdleCallback(callback, {
            timeout: PASTE_NORMALIZE_IDLE_TIMEOUT_MS,
          })
          return
        }
        postPasteIdleRef.current = window.setTimeout(callback, 32)
      }

      scheduleIdle(() => {
        markPastePerf('paste:normalize:start')
        normalizeEditorDom()
        markPastePerf('paste:normalize:done')
        handleChange('paste')
        markPastePerf('paste:idle:done')
        measurePastePerf('paste:normalize-total', 'paste:normalize:start', 'paste:idle:done')
      })
    })
  }, [handleChange, markPastePerf, measurePastePerf, normalizeEditorDom, scheduleCurrentLineHighlight])

  const processPasteText = useCallback(
    (rawText: string) => {
      const textToInsert = normalizePastedText(rawText)
      if (!insertPlainTextAtSelection(textToInsert)) return false
      schedulePostPasteWork()
      return true
    },
    [insertPlainTextAtSelection, normalizePastedText, schedulePostPasteWork]
  )

  const extractClipboardText = useCallback((clipboardData: DataTransfer | null) => {
    if (!clipboardData) return ''
    return clipboardData.getData('text/plain')
  }, [])

  const hasSelectionInsideEditor = useCallback((editorEl: HTMLDivElement) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    return editorEl.contains(range.commonAncestorContainer)
  }, [])

  const ensureSelectionInEditor = useCallback((editorEl: HTMLDivElement) => {
    const selection = window.getSelection()
    if (!selection) return false
    if (hasSelectionInsideEditor(editorEl)) return true

    selection.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(editorEl)
    range.collapse(false)
    selection.addRange(range)
    return true
  }, [hasSelectionInsideEditor])

  const shouldHandlePasteEvent = useCallback(
    (eventTarget: EventTarget | null) => {
      const editorEl = editorRef.current
      if (!editorEl) return { shouldHandle: false, editorEl: null as HTMLDivElement | null }

      const targetNode = eventTarget instanceof Node ? eventTarget : null
      const targetInsideEditor = targetNode ? editorEl.contains(targetNode) : false
      if (!targetInsideEditor) {
        return { shouldHandle: false, editorEl }
      }

      const activeInsideEditor = document.activeElement === editorEl
      const rangeInsideEditor = hasSelectionInsideEditor(editorEl)

      if (!activeInsideEditor) {
        editorEl.focus({ preventScroll: true })
      }

      if (!rangeInsideEditor && !ensureSelectionInEditor(editorEl)) {
        return { shouldHandle: false, editorEl }
      }

      return { shouldHandle: true, editorEl }
    },
    [ensureSelectionInEditor, hasSelectionInsideEditor]
  )

  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const nativeEvent = event.nativeEvent as InputEvent
      const inputType = typeof nativeEvent?.inputType === 'string' ? nativeEvent.inputType : ''
      logDebugEvent('beforeinput', {
        inputType,
        data: nativeEvent?.data ?? null,
        defaultPrevented: nativeEvent?.defaultPrevented ?? event.isDefaultPrevented(),
      })

      if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
        const { shouldHandle } = shouldHandlePasteEvent(event.target)
        if (!shouldHandle) return
        const clipboardText = extractClipboardText(
          (nativeEvent as InputEvent & { dataTransfer?: DataTransfer }).dataTransfer ?? null
        )
        if (!clipboardText) return
        beforeInputPasteHandledRef.current = true
        event.preventDefault()
        markPastePerf('paste:start')
        processPasteText(clipboardText)
        window.queueMicrotask(() => {
          beforeInputPasteHandledRef.current = false
        })
        return
      }

      if (inputType && !inputType.startsWith('insert')) return

      const el = editorRef.current
      if (!el) return
      const placeholderLine = el.querySelector<HTMLDivElement>('[data-placeholder-line="true"]')
      if (!placeholderLine) return

      const replacement = replacePlaceholderWithEmptyLine(placeholderLine)
      setCaretToLineStart(replacement)
    },
    [
      extractClipboardText,
      logDebugEvent,
      processPasteText,
      markPastePerf,
      replacePlaceholderWithEmptyLine,
      setCaretToLineStart,
      shouldHandlePasteEvent,
    ]
  )

  const handlePasteEvent = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const { shouldHandle } = shouldHandlePasteEvent(event.target)
      if (!shouldHandle) return
      const clipboardText = extractClipboardText(event.clipboardData)
      if (!clipboardText) return
      event.preventDefault()
      window.queueMicrotask(() => {
        if (beforeInputPasteHandledRef.current) {
          return
        }
        markPastePerf('paste:start')
        processPasteText(clipboardText)
      })
    },
    [extractClipboardText, markPastePerf, processPasteText, shouldHandlePasteEvent]
  )

  const updateRhymeFocusFromSelection = useCallback(() => {
    if (!rhymeHighlightEnabled || rhymeHighlightMode !== 'focus' || focusLocked) return
    const selection = window.getSelection()
    if (!selection) return
    const tokenId = getCaretTokenId(selection)
    if (!tokenId) {
      setActiveRhymeGroupKey(null)
      return
    }
    const groupKey = groupKeyByTokenId.get(tokenId) ?? null
    setActiveRhymeGroupKey(groupKey)
  }, [
    focusLocked,
    getCaretTokenId,
    groupKeyByTokenId,
    rhymeHighlightEnabled,
    rhymeHighlightMode,
    setActiveRhymeGroupKey,
  ])

  const lockRhymeFocusFromSelection = useCallback(() => {
    if (!rhymeHighlightEnabled) return
    const selection = window.getSelection()
    if (!selection) return
    const tokenId = getCaretTokenId(selection)
    if (!tokenId) return
    const groupKey = groupKeyByTokenId.get(tokenId)
    if (!groupKey) return
    setActiveRhymeGroupKey(groupKey)
    setFocusLocked(true)
  }, [
    getCaretTokenId,
    groupKeyByTokenId,
    rhymeHighlightEnabled,
    setActiveRhymeGroupKey,
    setFocusLocked,
  ])

  const handleSelectionChange = useCallback(() => {
    scheduleCurrentLineHighlight()
    if (analysisLinesRef.current.length) {
      scheduleAnalysis(analysisLinesRef.current, 'caret', {
        enabled: rhymeHighlightEnabled,
        includeExactRepeats,
        ignoreStopwords: rhymeIgnoreStopwords,
      })
    }
    updateRhymeFocusFromSelection()
  }, [
    includeExactRepeats,
    rhymeIgnoreStopwords,
    rhymeHighlightEnabled,
    scheduleAnalysis,
    scheduleCurrentLineHighlight,
    updateRhymeFocusFromSelection,
  ])

  useEffect(() => {
    if (!showLineTotals) {
      setLineTotals([])
      return
    }
    if (analysisLinesRef.current.length) {
      scheduleAnalysis(analysisLinesRef.current, 'caret', {
        enabled: rhymeHighlightEnabled,
        includeExactRepeats,
        ignoreStopwords: rhymeIgnoreStopwords,
      })
    }
  }, [includeExactRepeats, rhymeHighlightEnabled, rhymeIgnoreStopwords, scheduleAnalysis, showLineTotals])

  useEffect(() => {
    if (!showLineTotals) return
    if (!analysis || analysis.docId !== ANALYSIS_DOC_ID) return
    if (!analysisLinesRef.current.length) return
    const totals = analysisLinesRef.current.map((line) => analysis.lineTotals[line.id] ?? 0)
    setLineTotals(totals)
  }, [analysis, showLineTotals])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && metrics) {
      console.debug('[analysis] metrics', { mode: analysisMode, metrics })
    }
  }, [analysisMode, metrics])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    console.debug('[overlay] render', { tokenCount: tokens.length, measured: measurementMeta?.measured ?? 0 })
  }, [measurementMeta, tokens.length])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (lastPropTextRef.current === text) return
    lastPropTextRef.current = text
    if (skipHydrateRef.current === text) {
      lastHydratedTextRef.current = text
      lastSerializedRef.current = text
      skipHydrateRef.current = null
      return
    }
    skipHydrateRef.current = null
    if (hasInitializedRef.current && text === lastHydratedTextRef.current) return
    if (!hasInitializedRef.current && text === '' && el.querySelectorAll<HTMLDivElement>('.line').length > 0) {
      hasInitializedRef.current = true
      lastHydratedTextRef.current = text
      lastSerializedRef.current = text
      return
    }

    hydrateEditorFromText(el, text)
    ensureLineStructure()
    syncPlaceholderLine()
    lastHydratedTextRef.current = text
    lastSerializedRef.current = text
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      el.focus()
    }
    const { lines: collectedLines } = collectLineInputs()
    analysisLinesRef.current = collectedLines
    setLineInputs(collectedLines)
    setLines(collectedLines.map((line) => line.text))
    setLineVersion((v) => v + 1)
    if (collectedLines.length) {
      scheduleAnalysis(collectedLines, 'typing', {
        enabled: rhymeHighlightEnabled,
        includeExactRepeats,
        ignoreStopwords: rhymeIgnoreStopwords,
      })
    }
    requestAnimationFrame(() => {
      scheduleCurrentLineHighlight({ immediate: true })
    })
  }, [
    collectLineInputs,
    ensureLineStructure,
    includeExactRepeats,
    rhymeIgnoreStopwords,
    rhymeHighlightEnabled,
    scheduleAnalysis,
    scheduleCurrentLineHighlight,
    syncPlaceholderLine,
    text,
  ])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        setShowOverlays((v) => !v)
      }
      if (!ENABLE_RHYME_HIGHLIGHT_SHORTCUTS) return
      const isPrimary = e.metaKey || e.ctrlKey
      if (!isPrimary || !e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'h') {
        e.preventDefault()
        setRhymeHighlightEnabled(!rhymeHighlightEnabled)
      }
      if (key === 'f') {
        e.preventDefault()
        setRhymeHighlightMode(rhymeHighlightMode === 'focus' ? 'all' : 'focus')
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
      if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current)
      if (highlightDebounceRef.current) window.clearTimeout(highlightDebounceRef.current)
    }
  }, [
    handleSelectionChange,
    rhymeHighlightEnabled,
    rhymeHighlightMode,
    setRhymeHighlightEnabled,
    setRhymeHighlightMode,
  ])

  useEffect(() => {
    if (!rhymeHighlightEnabled) {
      clearFocus()
      return
    }
    updateRhymeFocusFromSelection()
  }, [clearFocus, rhymeHighlightEnabled, rhymeHighlightMode, updateRhymeFocusFromSelection])

  useEffect(() => {
    if (!analysisLinesRef.current.length) return
    scheduleAnalysis(analysisLinesRef.current, 'typing', {
      enabled: rhymeHighlightEnabled,
      includeExactRepeats,
      ignoreStopwords: rhymeIgnoreStopwords,
    })
  }, [includeExactRepeats, rhymeHighlightEnabled, rhymeIgnoreStopwords, scheduleAnalysis])

  useEffect(() => {
    if (!activeRhymeGroupKey && !focusLocked) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      const container = containerRef.current
      if (!target || !container) return
      if (container.contains(target)) return
      clearFocus()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearFocus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeRhymeGroupKey, clearFocus, focusLocked])

  useEffect(() => {
    const onResize = () => {
      scheduleCurrentLineHighlight({ immediate: true })
    }
    window.addEventListener('resize', onResize)
    const scroller = containerRef.current
    const onScroll = () => {
      scheduleCurrentLineHighlight()
    }
    scroller?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      scroller?.removeEventListener('scroll', onScroll)
    }
  }, [scheduleCurrentLineHighlight])

  useEffect(() => {
    scheduleCurrentLineHighlight()
  }, [fontSize, lineHeight, scheduleCurrentLineHighlight])

  useEffect(() => {
    if (!DEBUG_ACTIVE_LINE) return
    if (typeof window === 'undefined') return
    const debugWindow = window as typeof window & {
      __rlActiveLineDebug?: { forceShow: boolean; refresh?: () => void }
    }
    if (!debugWindow.__rlActiveLineDebug) {
      debugWindow.__rlActiveLineDebug = {
        forceShow: false,
        refresh: () => scheduleCurrentLineHighlight({ immediate: true }),
      }
    }
    debugForceRef.current = debugWindow.__rlActiveLineDebug
  }, [])

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

  const ensureEditorFocus = useCallback(() => {
    const node = editorRef.current
    if (!node) return
    if (document.activeElement !== node) {
      node.focus({ preventScroll: true })
    }
  }, [])

  const insertText = useCallback(
    (textToInsert: string) => {
      const node = editorRef.current
      if (!node) return false
      ensureEditorFocus()
      try {
        const selection = window.getSelection()
        if (!selection) return false
        const range =
          selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
        if (selection.rangeCount === 0) {
          range.selectNodeContents(node)
          range.collapse(false)
        }
        range.deleteContents()
        const textNode = document.createTextNode(textToInsert)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
        return true
      } catch (error) {
        if (typeof document.execCommand !== 'function') return false
        return document.execCommand('insertText', false, textToInsert)
      }
    },
    [ensureEditorFocus]
  )

  const handleAssignEditorRef = useCallback(
    (node: HTMLDivElement | null) => {
      editorRef.current = node
    },
    []
  )


  useEffect(() => {
    return () => {
      if (postPasteRafRef.current) {
        window.cancelAnimationFrame(postPasteRafRef.current)
      }
      if (postPasteIdleRef.current) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(postPasteIdleRef.current)
        } else {
          window.clearTimeout(postPasteIdleRef.current)
        }
      }
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      focus: ensureEditorFocus,
      insertText,
      forceDocumentSync: () => handleChange('paste'),
    }),
    [ensureEditorFocus, handleChange, insertText]
  )

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
              theme={resolvedTheme}
            />

            <div
              ref={textColRef}
              className="editor-surface relative min-h-[70vh]"
              onPointerDownCapture={ensureEditorFocus}
            >
              {/* Layer contract: highlight (z-0, inert) sits below text; badges (z-20, inert) float above; editable layer owns all focus. */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                aria-hidden="true"
                data-layer="highlight"
                contentEditable={false}
              >
                <div
                  className="rl-current-line-highlight rl-active-line"
                  style={highlightStyle}
                  aria-hidden="true"
                  data-editor-overlay="current-line"
                  data-testid="active-line-highlight"
                  id="rl-active-line-highlight"
                />
                {DEBUG_ACTIVE_LINE ? (
                  <div
                    className="rl-current-line-debug"
                    style={highlightDebugStyle}
                    aria-hidden="true"
                  >
                    {`foundLine:${lineHighlight.foundLine ? 'yes' : 'no'} id:${
                      lineHighlight.lineId ?? 'none'
                    } top:${Math.round(lineHighlight.top)} h:${Math.round(lineHighlight.height)} textColLeft:${Math.round(
                      lineHighlight.debugTextColLeft
                    )} lineLeft:${Math.round(lineHighlight.debugLineLeft)}`}
                  </div>
                ) : null}
              </div>
              {/* Rhyme highlighting overlay (rects measured via useOverlayMeasurement). */}
              <div
                className="pointer-events-none absolute inset-0 z-20"
                aria-hidden="true"
                data-layer="rhyme"
                contentEditable={false}
              >
                <RhymeHighlightOverlay
                  enabled={rhymeOverlayEnabled}
                  docId={ANALYSIS_DOC_ID}
                  groups={rhymeGroups}
                  tokenPositions={rhymeTokens}
                  activeGroupKey={activeRhymeGroupKey}
                  mode={rhymeHighlightMode}
                  viewportStart={viewportRange.start}
                  viewportEnd={viewportRange.end}
                  colorRegistry={colorRegistry}
                />
              </div>
              {/* Overlay for syllable badges */}
              <div
                ref={overlayRef}
                className="pointer-events-none absolute inset-0 z-30"
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
                  enabled={overlayEnabled}
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
                onInput={handleInputEvent}
                onPaste={handlePasteEvent}
                onFocus={() => {
                  setIsEditorFocused(true)
                  const editorEl = editorRef.current
                  if (editorEl) {
                    ensureSelectionInEditor(editorEl)
                  }
                }}
                onBlur={() => {
                  setIsEditorFocused(false)
                  handleChange()
                }}
                onKeyDown={handleShortcutKeyDown}
                onCompositionStart={() => {
                  composingRef.current = true
                }}
                onCompositionEnd={() => {
                  composingRef.current = false
                  scheduleCurrentLineHighlight({ immediate: true })
                }}
                onClick={(event) => {
                  ensureEditorFocus()
                  handleChange()
                  lockRhymeFocusFromSelection()
                  event.stopPropagation()
                }}
                onPointerDown={ensureEditorFocus}
                className="rl-editor relative z-20 outline-none w-full min-h-[70vh] font-mono pointer-events-auto"
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
