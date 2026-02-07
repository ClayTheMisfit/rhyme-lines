import { useEffect, useMemo, useState } from 'react'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import type { AnalysisResult } from '@/hooks/useAnalysisWorker'
import type { LineInput } from '@/lib/analysis/compute'
import { GeometryCache } from '@/lib/overlay/geometryCache'
import type { SettingsState } from '@/store/settingsStore'

export type RhymeOverlayToken = {
  id: string
  lineId: string
  lineIndex: number
  tokenIndex: number
  rect: { top: number; left: number; width: number; height: number }
}

type UseRhymeOverlayMeasurementArgs = {
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

export function useRhymeOverlayMeasurement({
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
}: UseRhymeOverlayMeasurementArgs) {
  const [tokens, setTokens] = useState<RhymeOverlayToken[]>([])
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
    assertClientOnly('overlay:measure:rhyme')
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
      const nextTokens: RhymeOverlayToken[] = []
      let measured = 0
      let reused = 0

      for (const lineElement of linesDom) {
        const lineId = lineElement.dataset.lineId ?? ''
        if (!lineId || !activeLineIds.has(lineId)) continue
        const lineIndex = Number.parseInt(lineElement.dataset.lineIndex ?? '-1', 10)
        const contentSignature = lineSignatures.get(lineId) ?? ''
        const cached = cache.get<RhymeOverlayToken>(docId, lineId, layoutKey, contentSignature, 'rhymes')
        if (cached) {
          reused += 1
          nextTokens.push(...cached.tokens)
          continue
        }

        const lineRect = lineElement.getBoundingClientRect()
        const lineTokens = analysis.lineTokens[lineId] ?? []
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

        const measuredTokens: RhymeOverlayToken[] = []
        for (const token of lineTokens) {
          const range = measureForSpan(token.start, token.end)
          if (!range) continue
          const rects = range.getClientRects()
          if (!rects.length) {
            range.detach()
            continue
          }
          const rect = rects[0]
          measuredTokens.push({
            id: `${lineId}-${tokenId++}`,
            lineId,
            lineIndex,
            tokenIndex: token.index,
            rect: {
              top: rect.top - rootRect.top,
              left: rect.left - rootRect.left,
              width: rect.width,
              height: rect.height || lineRect.height,
            },
          })
          range.detach()
        }

        cache.set(docId, lineId, layoutKey, contentSignature, 'rhymes', { tokens: measuredTokens })
        nextTokens.push(...measuredTokens)
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
    console.debug('[overlay] measure:rhyme', { docId, ...measurementMeta })
  }, [docId, measurementMeta])

  return { tokens, layoutKey, measurementMeta }
}
