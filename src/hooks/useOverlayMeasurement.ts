import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OverlayToken } from '@/components/editor/SyllableOverlay'
import type { AnalysisResult, AnalysisMode } from '@/hooks/useAnalysisWorker'
import { invalidateDocGeometry, readCachedGeometry, writeCachedGeometry } from '@/lib/overlay/geometryCache'
import type { LineInput } from '@/lib/analysis/compute'

type BadgeMode = 'always' | 'activeLine' | 'hoverLine' | 'off'

type LayoutSignature = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  editorWidth: number
  devicePixelRatio: number
  theme: 'light' | 'dark'
}

type Options = {
  docId: string
  editorRef: React.RefObject<HTMLDivElement>
  containerRef: React.RefObject<HTMLElement>
  lineElementsRef: React.MutableRefObject<HTMLDivElement[]>
  lineInputs: LineInput[]
  analysis: AnalysisResult
  analysisMode: AnalysisMode
  badgeMode: BadgeMode
  enabled: boolean
  activeLineIds: Set<string>
  fontSize: number
  lineHeight: number
  theme: 'light' | 'dark'
}

type PerfSample = {
  measured: number
  reused: number
  durationMs: number
  overlayCount: number
  analysisMode: AnalysisMode
}

const hashText = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

const resolveLayoutSignature = (
  editor: HTMLElement,
  container: HTMLElement,
  base: { fontSize: number; lineHeight: number; theme: 'light' | 'dark' }
): LayoutSignature => {
  const computed = window.getComputedStyle(editor)
  const fontFamily = computed.fontFamily || 'monospace'
  const editorWidth = Math.round(container.getBoundingClientRect().width)
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return {
    fontFamily,
    fontSize: base.fontSize,
    lineHeight: base.lineHeight,
    editorWidth,
    devicePixelRatio,
    theme: base.theme,
  }
}

const layoutKeyFromSignature = (signature: LayoutSignature) =>
  [
    signature.fontFamily,
    signature.fontSize,
    signature.lineHeight,
    signature.editorWidth,
    signature.devicePixelRatio,
    signature.theme,
  ].join('|')

export function useOverlayMeasurement({
  docId,
  editorRef,
  containerRef,
  lineElementsRef,
  lineInputs,
  analysis,
  analysisMode,
  badgeMode,
  enabled,
  activeLineIds,
  fontSize,
  lineHeight,
  theme,
}: Options) {
  const [tokens, setTokens] = useState<OverlayToken[]>([])
  const [perfSample, setPerfSample] = useState<PerfSample | null>(null)
  const layoutKeyRef = useRef<string | null>(null)
  const pendingRafRef = useRef<number | null>(null)
  const measureRequestedRef = useRef(false)

  const lineSignatureMap = useMemo(() => {
    const map = new Map<string, string>()
    lineInputs.forEach((line) => {
      map.set(line.id, hashText(line.text))
    })
    return map
  }, [lineInputs])

  const measureActiveLines = useCallback(() => {
    const editor = editorRef.current
    const container = containerRef.current
    const analysisResult = analysis
    if (!editor || !container || !analysisResult || analysisResult.docId !== docId) {
      setTokens([])
      setPerfSample(null)
      return
    }
    if (!enabled || badgeMode === 'off') {
      setTokens([])
      setPerfSample(null)
      return
    }

    const signature = resolveLayoutSignature(editor, container, { fontSize, lineHeight, theme })
    const layoutKey = layoutKeyFromSignature(signature)
    const layoutChanged = layoutKeyRef.current !== layoutKey
    if (layoutChanged) {
      layoutKeyRef.current = layoutKey
      invalidateDocGeometry(docId)
    }

    const rootRect = editor.getBoundingClientRect()
    const elements = lineElementsRef.current
    const elementById = new Map<string, HTMLDivElement>()
    elements.forEach((element) => {
      const id = element.dataset.lineId
      if (id) {
        elementById.set(id, element)
      }
    })

    const measureStart = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()

    const tokensNext: OverlayToken[] = []
    let measured = 0
    let reused = 0

    const resolveRangeForSpan = (lineElement: HTMLDivElement, start: number, end: number) => {
      const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT)
      let node: Node | null = walker.nextNode()
      let offset = 0
      let startNode: Node | null = null
      let endNode: Node | null = null
      let startOffset = 0
      let endOffset = 0

      while (node) {
        const length = node.textContent?.length ?? 0
        const nextOffset = offset + length
        if (!startNode && start >= offset && start <= nextOffset) {
          startNode = node
          startOffset = start - offset
        }
        if (!endNode && end >= offset && end <= nextOffset) {
          endNode = node
          endOffset = end - offset
        }
        if (startNode && endNode) break
        offset = nextOffset
        node = walker.nextNode()
      }

      if (startNode && endNode) {
        const range = document.createRange()
        range.setStart(startNode, Math.max(0, startOffset))
        range.setEnd(endNode, Math.max(0, endOffset))
        return range
      }
      return null
    }

    for (const lineId of activeLineIds) {
      const lineElement = elementById.get(lineId)
      if (!lineElement) continue
      const lineIndex = Number.parseInt(lineElement.dataset.lineIndex ?? '-1', 10)
      const syllableTokens = analysisResult.wordSyllables[lineId] ?? []
      const contentSignature = lineSignatureMap.get(lineId) ?? ''

      const cached = layoutKeyRef.current
        ? readCachedGeometry(docId, lineId, layoutKeyRef.current, contentSignature)
        : null

      if (cached) {
        reused += 1
        cached.forEach((token) => tokensNext.push(token))
        continue
      }

      measured += 1

      const lineRect = lineElement.getBoundingClientRect()
      const computed = window.getComputedStyle(lineElement)
      const fontSizePx = Number.parseFloat(computed.fontSize) || 16
      let lineHeightPx = Number.parseFloat(computed.lineHeight)
      if (!Number.isFinite(lineHeightPx)) {
        const numericLineHeight = Number.parseFloat(computed.lineHeight)
        lineHeightPx =
          Number.isFinite(numericLineHeight) && numericLineHeight > 0 ? numericLineHeight : fontSizePx * 1.6
      }
      const badgeOffsetEm = Math.min(Math.max(0.95 * (lineHeightPx / fontSizePx), 0.85), 1.25)

      lineElement.style.setProperty('--badge-offset', `${badgeOffsetEm}em`)

      const tokensForLine: OverlayToken[] = []
      syllableTokens.forEach((span, tokenIndex) => {
        const range = resolveRangeForSpan(lineElement, span.start, span.end)
        if (!range) return
        const rects = range.getClientRects()
        if (!rects.length) {
          range.detach()
          return
        }
        const rangeRect = rects[0]
        const topBase = lineRect ? lineRect.top - rootRect.top : rangeRect.top - rootRect.top
        const centerX = rangeRect.left - rootRect.left + rangeRect.width / 2

        const token: OverlayToken = {
          id: `${lineId}-${tokenIndex}`,
          value: span.syllables,
          lineId,
          lineIndex,
          lineOffset: badgeOffsetEm,
          rect: {
            top: topBase,
            centerX,
          },
        }
        tokensNext.push(token)
        tokensForLine.push(token)
        range.detach()
      })

      if (layoutKeyRef.current) {
        writeCachedGeometry(docId, lineId, layoutKeyRef.current, contentSignature, tokensForLine)
      }
    }

    setTokens(tokensNext)
    const measureEnd = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    const durationMs = measureEnd - measureStart
    const sample: PerfSample = {
      measured,
      reused,
      durationMs,
      overlayCount: tokensNext.length,
      analysisMode,
    }
    setPerfSample(sample)
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[overlay] measure', sample)
    }
  }, [
    activeLineIds,
    analysis,
    badgeMode,
    containerRef,
    docId,
    editorRef,
    enabled,
    fontSize,
    lineElementsRef,
    lineHeight,
    lineSignatureMap,
    theme,
    analysisMode,
  ])

  const scheduleMeasure = useCallback(() => {
    if (typeof window === 'undefined') return
    measureRequestedRef.current = true
    if (pendingRafRef.current !== null) return
    pendingRafRef.current = window.requestAnimationFrame(() => {
      pendingRafRef.current = null
      if (!measureRequestedRef.current) return
      measureRequestedRef.current = false
      measureActiveLines()
    })
  }, [measureActiveLines])

  useEffect(() => {
    return () => {
      if (pendingRafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(pendingRafRef.current)
      }
    }
  }, [])

  return { tokens, scheduleMeasure, layoutKey: layoutKeyRef.current, perfSample }
}
