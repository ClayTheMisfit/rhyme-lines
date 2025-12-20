import { useEffect, useMemo, useState } from 'react'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import type { OverlayToken } from '@/components/editor/SyllableOverlay'
import type { AnalysisResult } from '@/hooks/useAnalysisWorker'
import type { LineInput } from '@/lib/analysis/compute'
import { GeometryCache } from '@/lib/overlay/geometryCache'
import type { SettingsState } from '@/store/settingsStore'

type UseOverlayMeasurementArgs = {
  docId: string
  enabled: boolean
  editorRef: React.RefObject<HTMLDivElement | null>
  containerRef: React.RefObject<HTMLElement | null>
  lineElementsRef: React.RefObject<HTMLDivElement[]>
  lineVersion: number
  activeLineIds: Set<string>
  lines: LineInput[]
  analysis: AnalysisResult
  theme: SettingsState['theme']
  fontSize: number
  lineHeight: number
}

type MeasurementMeta = {
  measured: number
  reused: number
  durationMs: number
}

const cache = new GeometryCache()

const hashText = (text: string) => {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(16)
}

export function useOverlayMeasurement({
  docId,
  enabled,
  editorRef,
  containerRef,
  lineElementsRef,
  lineVersion,
  activeLineIds,
  lines,
  analysis,
  theme,
  fontSize,
  lineHeight,
}: UseOverlayMeasurementArgs) {
  const [tokens, setTokens] = useState<OverlayToken[]>([])
  const [measurementMeta, setMeasurementMeta] = useState<MeasurementMeta | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [devicePixelRatio, setDevicePixelRatio] = useState(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  )

  const lineSignatures = useMemo(() => {
    const map = new Map<string, string>()
    lines.forEach((line) => {
      map.set(line.id, hashText(line.text))
    })
    return map
  }, [lines])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setDevicePixelRatio(window.devicePixelRatio || 1)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      const node = containerRef.current
      if (node) {
        setContainerWidth(node.clientWidth)
      }
      return
    }
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(Math.max(0, Math.floor(entry.contentRect.width)))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [containerRef])

  const layoutKey = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const lineElements = lineElementsRef.current
    const sample =
      lineElements?.find((line) => activeLineIds.has(line.dataset.lineId ?? '')) ?? lineElements?.[0]
    if (!sample) return ''
    const style = window.getComputedStyle(sample)
    const fontFamily = style.fontFamily || 'monospace'
    const fontSizePx = Number.parseFloat(style.fontSize) || fontSize
    const resolvedLineHeight = Number.parseFloat(style.lineHeight) || fontSizePx * lineHeight
    return `${fontFamily}|${fontSizePx}|${resolvedLineHeight}|${containerWidth}|${devicePixelRatio}|${theme}`
  }, [activeLineIds, containerWidth, devicePixelRatio, fontSize, lineElementsRef, lineHeight, theme])

  useEffect(() => {
    if (!enabled || !analysis || analysis.docId !== docId || !isClient()) {
      setTokens([])
      return
    }
    assertClientOnly('overlay:measure')
    const root = editorRef.current
    const linesDom = lineElementsRef.current
    if (!root || !linesDom || !linesDom.length) {
      setTokens([])
      return
    }
    if (!layoutKey || !activeLineIds.size) {
      setTokens([])
      return
    }

    let rafId: number | null = null

    const measure = () => {
      const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const rootRect = root.getBoundingClientRect()
      const nextTokens: OverlayToken[] = []
      let measured = 0
      let reused = 0

      for (const lineElement of linesDom) {
        const lineId = lineElement.dataset.lineId ?? ''
        if (!lineId || !activeLineIds.has(lineId)) continue
        const lineIndex = Number.parseInt(lineElement.dataset.lineIndex ?? '-1', 10)
        const contentSignature = lineSignatures.get(lineId) ?? ''
        const cached = cache.get(docId, lineId, layoutKey, contentSignature)
        if (cached) {
          reused += 1
          lineElement.style.setProperty('--badge-offset', `${cached.lineOffset}em`)
          nextTokens.push(...cached.tokens)
          continue
        }
        const lineRect = lineElement.getBoundingClientRect()
        const computed = window.getComputedStyle(lineElement)
        const fontSizePx = Number.parseFloat(computed.fontSize) || fontSize
        const lineHeightPxRaw = Number.parseFloat(computed.lineHeight)
        const lineHeightPx = Number.isFinite(lineHeightPxRaw) && lineHeightPxRaw > 0
          ? lineHeightPxRaw
          : fontSizePx * lineHeight
        const badgeOffsetEm = Math.min(Math.max(0.95 * (lineHeightPx / fontSizePx), 0.85), 1.25)
        lineElement.style.setProperty('--badge-offset', `${badgeOffsetEm}em`)

        const syllableTokens = analysis.wordSyllables[lineId] ?? []
        let tokenId = 0
        const measureForSpan = (start: number, end: number) => {
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
              break
            }
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

        const lineTokens: OverlayToken[] = []
        for (const span of syllableTokens) {
          const range = measureForSpan(span.start, span.end)
          if (!range) continue
          const rects = range.getClientRects()
          if (!rects.length) {
            range.detach()
            continue
          }
          const rect = rects[0]
          const topBase = lineRect.top - rootRect.top
          const centerX = rect.left - rootRect.left + rect.width / 2
          lineTokens.push({
            id: `${lineId}-${tokenId++}`,
            value: span.syllables,
            lineId,
            lineIndex,
            lineOffset: badgeOffsetEm,
            rect: {
              top: topBase,
              centerX,
            },
          })
          range.detach()
        }

        cache.set(docId, lineId, layoutKey, contentSignature, {
          tokens: lineTokens,
          lineOffset: badgeOffsetEm,
        })
        nextTokens.push(...lineTokens)
        measured += 1
      }

      setTokens(nextTokens)
      setMeasurementMeta({
        measured,
        reused,
        durationMs: Math.max(
          0,
          (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - startedAt
        ),
      })
    }

    rafId = window.requestAnimationFrame(measure)

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [
    activeLineIds,
    analysis,
    containerRef,
    docId,
    editorRef,
    enabled,
    layoutKey,
    fontSize,
    lineElementsRef,
    lineHeight,
    lineSignatures,
    lineVersion,
  ])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !measurementMeta) return
    console.debug('[overlay] measure', { docId, ...measurementMeta })
  }, [docId, measurementMeta])

  return { tokens, layoutKey, measurementMeta }
}
