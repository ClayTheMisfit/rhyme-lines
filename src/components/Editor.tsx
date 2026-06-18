'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { serializeFromEditor, hydrateEditorFromText } from '@/lib/editor/serialization'
import { getEditorLineElements, getLinePlainText, getPlainTextOffsetWithinLine, clearLineCache } from '@/lib/editor/plainText'
import { useSettingsStore } from '@/store/settingsStore'
import { RHYME_HIGHLIGHT_ORDER } from '@/lib/persist/schema'
import { useRhymeHighlightSettingsStore } from '@/store/rhymeHighlightSettingsStore'
import { shallow } from 'zustand/shallow'
import { useBadgeShortcuts } from '@/lib/shortcuts/badges'
import { SyllableOverlay } from '@/components/editor/SyllableOverlay'
import { useBadgeSettings } from '@/store/settings'
import { useAnalysisWorker } from '@/hooks/useAnalysisWorker'
import type { LineInput } from '@/lib/analysis/compute'
import { resolveEditorShortcut } from '@/lib/editor/shortcuts'
import { useOverlayMeasurement, useLineVirtualization, useEditorInput, useEditorClipboard, useEditorSelection, useDecorationDiff } from '@/editor'
import { resolveTheme } from '@/lib/theme/resolveTheme'
import { buildRhymeDecorations, DEFAULT_UNDERLINE_TARGETS, resolveActiveRhymeFamilyId } from '@/lib/rhyme/rhymeDecorations'
import { resolveInternalRhymesEnabled } from '@/lib/rhyme/highlightOptions'
import { useRhymeDecorationOverlay } from '@/hooks/useRhymeDecorationOverlay'
import { RhymeDecorationOverlay } from '@/components/editor/RhymeDecorationOverlay'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PLACEHOLDER_TEXT = 'Start writing…'
const ANALYSIS_DOC_ID = 'rhyme-editor'
const DEBUG_EDITOR = process.env.NEXT_PUBLIC_DEBUG_EDITOR === '1'
const DEBUG_ACTIVE_LINE = process.env.NEXT_PUBLIC_DEBUG_ACTIVE_LINE === '1'
const LINE_HIGHLIGHT_DEBOUNCE_MS = 50
const RHYME_DECORATION_DEBOUNCE_MS = 180
const ACTIVE_LINE_TUNING = {
  radius: 2,
  yInset: 1,
  hInset: 2,
  bgDark: 0.003,
  borderDark: 0.008,
  bgLight: 0.008,
  borderLight: 0.014,
  opacityBlurred: 0.24,
  motionPosMs: 90,
  motionOpacityMs: 90,
}

type EditorProps = {
  text?: string
  onTextChange?: (text: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onCursorChange?: (cursor: { line: number; column: number } | null) => void
  hydrated?: boolean
}

export type EditorHandle = {
  focus: () => void
  insertText: (text: string) => boolean
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { text = '', onTextChange = () => {}, onDirtyChange, onCursorChange, hydrated = false },
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
  const skipHydrateRef = useRef<string | null>(null)

  const [lineInputs, setLineInputs] = useState<LineInput[]>([])
  const [showOverlays, setShowOverlays] = useState(true)
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null)
  const [lineVersion, setLineVersion] = useState(0)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [isEditorEmpty, setIsEditorEmpty] = useState(true)
  const [activeRhymeFamilyId, setActiveRhymeFamilyId] = useState<number | null>(null)
  const [lineHighlight, setLineHighlight] = useState({
    top: 0,
    height: 0,
    visible: false,
    foundLine: false,
    lineId: null as string | null,
    debugTextColLeft: 0,
    debugLineLeft: 0,
  })
  const highlightDebounceRef = useRef<number | null>(null)
  const lastHighlightRef = useRef(lineHighlight)
  const debugLogRef = useRef(0)
  const debugForceRef = useRef({ forceShow: false })

  const {
    fontSize,
    lineHeight,
    showLineTotals,
    showRhymeDecorations,
    rhymeDebugOverlay,
    theme,
  } = useSettingsStore(
    (state) => ({
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      showLineTotals: state.showLineTotals,
      showRhymeDecorations: state.showRhymeDecorations,
      rhymeDebugOverlay: state.rhymeDebugOverlay,
      theme: state.theme,
    }),
    shallow
  )

  const {
    showInternalRhymes,
    highlightStopwords,
    highlightMode,
    hideColorfulWords,
  } = useRhymeHighlightSettingsStore((state) => ({
    showInternalRhymes: state.showInternalRhymes,
    highlightStopwords: state.highlightStopwords,
    highlightMode: state.highlightMode,
    hideColorfulWords: state.hideColorfulWords,
  }), shallow)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--editor-font-size', `${fontSize}px`)
    root.style.setProperty('--editor-line-height', lineHeight.toString())
  }, [fontSize, lineHeight])

  

  const badgeMode = useBadgeSettings((state) => state.badgeMode)

  useBadgeShortcuts()

  const { analysis, analysisMode, scheduleAnalysis, metrics } = useAnalysisWorker(ANALYSIS_DOC_ID)
  const { activeLineIds, viewportRange } = useLineVirtualization({
    containerRef,
    lineElementsRef,
    lineVersion,
    overscan: 12,
  })
  const overlayEnabled = showOverlays && badgeMode !== 'off'
  const { tokens, measurementMeta } = useOverlayMeasurement({
    docId: ANALYSIS_DOC_ID,
    enabled: overlayEnabled,
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

  const [rhymeRecomputeSignal, setRhymeRecomputeSignal] = useState(0)
  const debouncedLineInputsForRhymes = useDebouncedValue(lineInputs, RHYME_DECORATION_DEBOUNCE_MS)


  useEffect(() => {
    const handleRecompute = () => {
      window.requestAnimationFrame(() => {
        setRhymeRecomputeSignal((value) => value + 1)
      })
    }
    window.addEventListener('rhyme:recompute', handleRecompute)
    return () => {
      window.removeEventListener('rhyme:recompute', handleRecompute)
    }
  }, [])

  const rhymeDecorations = useMemo(
    () =>
      buildRhymeDecorations(debouncedLineInputsForRhymes, DEFAULT_UNDERLINE_TARGETS, {
        showInternalRhymes: resolveInternalRhymesEnabled(showInternalRhymes, highlightMode),
        highlightStopwords,
      }),
    [debouncedLineInputsForRhymes, highlightMode, highlightStopwords, rhymeRecomputeSignal, showInternalRhymes]
  )

  const decorationPatch = useDecorationDiff(rhymeDecorations.tokensByLine)

  const rhymeRects = useRhymeDecorationOverlay({
    enabled: showRhymeDecorations,
    editorRef,
    lineElementsRef,
    decorations: rhymeDecorations,
    viewportRange,
    lineVersion,
  })

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
      if (!lineElement) return null
      return lineElement
    },
    []
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
      )
      for (const line of candidates) {
        const lineRect = line.getBoundingClientRect()
        if (caretY >= lineRect.top && caretY <= lineRect.bottom) {
          return line
        }
      }
      return null
    },
    []
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
      if (isComposingRef.current) return
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


  const createLineElement = useCallback((doc: Document) => {
    const line = doc.createElement('div')
    line.className = 'line'
    if (!line.dataset.lineId) {
      line.dataset.lineId = `line-${lineIdSeed.current++}`
    }
    return line
  }, [])

  const ensureLineHasContent = useCallback(
    (line: HTMLDivElement, doc: Document) => {
      const hasBreak = Array.from(line.childNodes).some((node) => node.nodeName === 'BR')
      if (!hasBreak) {
        line.appendChild(doc.createElement('br'))
      }
    },
    []
  )

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
  }, [createLineElement, ensureLineHasContent])

  const collectLineInputs = useCallback((): { lines: LineInput[]; elements: HTMLDivElement[] } => {
    const el = editorRef.current
    if (!el) return { lines: [], elements: [] }

    const elements = getEditorLineElements(el) as HTMLDivElement[]

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
        text: getLinePlainText(line),
      }
    })

    lineElementsRef.current = elements
    return { lines, elements }
  }, [])

  const applyLineTotalsToDom = useCallback(
    (totals: Array<number | undefined>) => {
      lineElementsRef.current.forEach((lineElement, index) => {
        const lineText = analysisLinesRef.current[index]?.text ?? ''
        if (!showLineTotals || lineText.trim().length === 0) {
          delete lineElement.dataset.lineTotalDisplay
          return
        }
        const total = totals[index] ?? 0
        lineElement.dataset.lineTotalDisplay = total === 0 ? '·' : total.toString()
      })
    },
    [showLineTotals]
  )

  const schedulePostLayoutMeasurement = useCallback(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setLineVersion((v) => v + 1)
        scheduleCurrentLineHighlight({ immediate: true })
      })
    })
  }, [scheduleCurrentLineHighlight])

  const commitEditorChange = useCallback((source: 'input' | 'paste' | 'drop' | 'program' = 'input') => {
    ensureLineStructure()
    clearLineCache()
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
    applyLineTotalsToDom([])
    setIsEditorEmpty(collectedLines.every((line) => line.text.trim().length === 0))
    const analysisMode = source === 'paste' || source === 'drop' ? 'caret' : 'typing'
    scheduleAnalysis(collectedLines, analysisMode)
    setLineVersion((v) => v + 1)

    const serialized = serializeFromEditor(el)
    if (serialized !== lastSerializedRef.current) {
      lastSerializedRef.current = serialized
      lastHydratedTextRef.current = serialized
      skipHydrateRef.current = serialized
      onTextChange(serialized)
      onDirtyChange?.(true)
    }
  }, [
    applyLineTotalsToDom,
    collectLineInputs,
    ensureLineStructure,
    logDebugEvent,
    onDirtyChange,
    onTextChange,
    scheduleAnalysis,
  ])

  const scheduleSyncFromDom = useCallback(
    (source: 'paste' | 'drop') => {
      if (typeof window === 'undefined') return
      const run = () => {
        window.requestAnimationFrame(() => {
          commitEditorChange(source)
          window.requestAnimationFrame(() => {
            schedulePostLayoutMeasurement()
          })
        })
      }
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(run)
      } else {
        Promise.resolve().then(run)
      }
    },
    [commitEditorChange, schedulePostLayoutMeasurement]
  )

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
      if (shortcut === 'rhymeHighlightMode') {
        const currentIndex = RHYME_HIGHLIGHT_ORDER.indexOf(useRhymeHighlightSettingsStore.getState().highlightMode)
        const nextMode = RHYME_HIGHLIGHT_ORDER[(currentIndex + 1) % RHYME_HIGHLIGHT_ORDER.length]
        useRhymeHighlightSettingsStore.getState().setHighlightMode(nextMode)
        return
      }
      window.dispatchEvent(new CustomEvent('rhyme:editor-shortcut', { detail: shortcut }))
    },
    [logDebugEvent]
  )



  const resolveActiveFamilyFromSelection = useCallback(() => {
    if (typeof window === 'undefined') return null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    const focusNode = range.endContainer
    const lineElement =
      focusNode instanceof Element
        ? focusNode.closest('.line')
        : focusNode.parentElement?.closest('.line')
    if (!lineElement) return null
    const lineId = lineElement.getAttribute('data-line-id')
    if (!lineId) return null
    const caretOffset = getPlainTextOffsetWithinLine(lineElement as HTMLElement, focusNode, range.endOffset)
    if (caretOffset === null) return null
    return resolveActiveRhymeFamilyId(rhymeDecorations, { lineId, caretOffset })
  }, [rhymeDecorations])

  const resolveCursorFromSelection = useCallback((): { line: number; column: number } | null => {
    if (typeof window === 'undefined') return null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const focusNode = selection.focusNode
    const focusOffset = selection.focusOffset
    if (!focusNode) return null

    const lineElement =
      focusNode instanceof Element
        ? focusNode.closest('.line')
        : focusNode.parentElement?.closest('.line')
    if (!lineElement || !editorRef.current) return null

    const lines = getEditorLineElements(editorRef.current)
    const lineIndex = lines.findIndex((line) => line === lineElement)
    if (lineIndex === -1) return null

    const caretOffset = getPlainTextOffsetWithinLine(lineElement as HTMLElement, focusNode, focusOffset)
    if (caretOffset === null) return null
    return { line: lineIndex + 1, column: caretOffset + 1 }
  }, [])

  const handleSelectionChange = useCallback(() => {
    scheduleCurrentLineHighlight()
    if (analysisLinesRef.current.length) {
      scheduleAnalysis(analysisLinesRef.current, 'caret')
    }
    if (showRhymeDecorations) {
      setActiveRhymeFamilyId(resolveActiveFamilyFromSelection())
    }
    onCursorChange?.(resolveCursorFromSelection())
  }, [onCursorChange, resolveActiveFamilyFromSelection, resolveCursorFromSelection, scheduleAnalysis, scheduleCurrentLineHighlight, showRhymeDecorations])

  useEditorSelection({
    editorRef,
    onSelectionChange: handleSelectionChange,
  })

  useEffect(() => {
    if (!showRhymeDecorations) {
      setActiveRhymeFamilyId(null)
      return
    }
    setActiveRhymeFamilyId(resolveActiveFamilyFromSelection())
  }, [resolveActiveFamilyFromSelection, showRhymeDecorations])

  const { handlers: inputHandlers, isComposingRef } = useEditorInput({
    commitEditorChange,
    onShortcutKeyDown: handleShortcutKeyDown,
    onFocusChange: setIsEditorFocused,
    scheduleMeasurement: () => scheduleCurrentLineHighlight({ immediate: true }),
    logDebugEvent,
  })

  useEffect(() => {
    if (!showLineTotals) return
    if (analysisLinesRef.current.length) {
      scheduleAnalysis(analysisLinesRef.current, 'caret')
    }
  }, [scheduleAnalysis, showLineTotals])

  useEffect(() => {
    if (!showLineTotals) {
      applyLineTotalsToDom([])
      return
    }
    if (!analysis || analysis.docId !== ANALYSIS_DOC_ID) return
    if (!analysisLinesRef.current.length) return
    const totals = analysisLinesRef.current.map((line) => analysis.lineTotals[line.id])
    const hasMissingNonEmptyTotal = totals.some(
      (total, index) => total === undefined && analysisLinesRef.current[index]?.text.trim().length
    )
    if (hasMissingNonEmptyTotal) {
      scheduleAnalysis(analysisLinesRef.current, 'caret')
      return
    }
    applyLineTotalsToDom(totals)
  }, [analysis, applyLineTotalsToDom, scheduleAnalysis, showLineTotals])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && metrics) {
      console.debug('[analysis] metrics', { mode: analysisMode, metrics })
    }
  }, [analysisMode, metrics])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    console.debug('[overlay] render', { tokenCount: tokens.length, measured: measurementMeta?.measured ?? 0, decorationPatch: decorationPatch.length })
  }, [decorationPatch.length, measurementMeta, tokens.length])

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
    lastHydratedTextRef.current = text
    lastSerializedRef.current = text
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      el.focus()
    }
    const { lines: collectedLines } = collectLineInputs()
    analysisLinesRef.current = collectedLines
    setLineInputs(collectedLines)
    applyLineTotalsToDom([])
    setIsEditorEmpty(collectedLines.every((line) => line.text.trim().length === 0))
    setLineVersion((v) => v + 1)
    if (collectedLines.length) {
      scheduleAnalysis(collectedLines, 'typing')
    }
    requestAnimationFrame(() => {
      scheduleCurrentLineHighlight({ immediate: true })
    })
  }, [collectLineInputs, scheduleAnalysis, text, scheduleCurrentLineHighlight, ensureLineStructure, applyLineTotalsToDom])

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

    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('rhyme:toggle-overlays', onToggleEvent as EventListener)
      if (highlightDebounceRef.current) window.clearTimeout(highlightDebounceRef.current)
      clearLineCache()
    }
  }, [])

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

  const insertPlainText = useCallback(
    (textToInsert: string) => {
      const node = editorRef.current
      if (!node) return false
      ensureEditorFocus()
      const normalized = textToInsert.replace(/\r\n?/g, '\n')
      if (typeof document.execCommand === 'function') {
        return document.execCommand('insertText', false, normalized)
      }
      const selection = window.getSelection()
      if (!selection) return false
      const range =
        selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
      if (selection.rangeCount === 0) {
        range.selectNodeContents(node)
        range.collapse(false)
      }
      range.deleteContents()
      const textNode = document.createTextNode(normalized)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
      return true
    },
    [ensureEditorFocus]
  )

  const { onPaste } = useEditorClipboard({
    insertPlainText,
    scheduleSyncFromDom,
  })

  const handleAssignEditorRef = useCallback(
    (node: HTMLDivElement | null) => {
      editorRef.current = node
    },
    []
  )

  useImperativeHandle(
    ref,
    () => ({
      focus: ensureEditorFocus,
      insertText,
    }),
    [ensureEditorFocus, insertText]
  )

  return (
    <div className="flex h-full w-full">
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
        <div className="editor-root relative mr-auto w-full max-w-[1480px]">
          <div className="rl-editor-grid">
            <div aria-hidden className="gutterSpacer" />

            <div ref={textColRef} className="editor-surface relative min-h-[70vh] w-full max-w-none">
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
              <div
                className="pointer-events-none absolute inset-0"
                style={{ zIndex: 15 }}
                aria-hidden="true"
                data-layer="rhyme-decoration"
                contentEditable={false}
              >
                <RhymeDecorationOverlay
                  rects={rhymeRects}
                  enabled={showRhymeDecorations}
                  activeFamilyId={activeRhymeFamilyId}
                  mode={highlightMode}
                  hideColors={hideColorfulWords}
                />
              </div>
              {rhymeDebugOverlay && process.env.NODE_ENV !== 'production' ? (
                <div className="pointer-events-none absolute left-3 top-3 z-40 rounded bg-black/70 px-2 py-1 text-[11px] text-white" data-testid="rhyme-debug-overlay">
                  {(() => {
                    if (activeRhymeFamilyId === null) return 'Rhyme Debug: no active family'
                    for (const lineTokens of rhymeDecorations.tokensByLine.values()) {
                      const token = lineTokens.find((candidate) => candidate.familyId === activeRhymeFamilyId)
                      if (token) {
                        return `Rhyme Debug: word=${token.word} key=${token.familyKey} source=${token.source ?? 'fallback'}`
                      }
                    }
                    return 'Rhyme Debug: active family not found'
                  })()}
                </div>
              ) : null}

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
                role="textbox"
                aria-multiline="true"
                aria-label="Lyric editor"
                aria-describedby="lyric-editor-instructions"
                data-layer="editable"
                onBeforeInput={inputHandlers.onBeforeInput}
                onInput={inputHandlers.onInput}
                onFocus={inputHandlers.onFocus}
                onBlur={inputHandlers.onBlur}
                onKeyDown={inputHandlers.onKeyDown}
                onPaste={onPaste}
                onCompositionStart={inputHandlers.onCompositionStart}
                onCompositionEnd={inputHandlers.onCompositionEnd}
                onClick={(event) => {
                  ensureEditorFocus()
                  commitEditorChange('input')
                  event.stopPropagation()
                }}
                onPointerDown={ensureEditorFocus}
                data-placeholder={PLACEHOLDER_TEXT}
                data-empty={isEditorEmpty ? 'true' : 'false'}
                className="rl-editor relative z-20 min-h-[70vh] w-full outline-none pointer-events-auto"
              />
              <p id="lyric-editor-instructions" className="sr-only">
                Write lyrics here. Press Command or Control plus K to open commands, Alt plus R to toggle rhyme panel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

Editor.displayName = 'Editor'

export default Editor
