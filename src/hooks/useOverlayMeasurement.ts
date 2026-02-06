import { useEffect, useMemo, useState } from 'react'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import type { OverlayToken } from '@/components/editor/SyllableOverlay'
import type { AnalysisResult } from '@/hooks/useAnalysisWorker'
import type { LineInput } from '@/lib/analysis/compute'
import { GeometryCache } from '@/lib/overlay/geometryCache'
import type { RhymeTokenPosition } from '@/lib/overlay/types'
import type { RhymeToken } from '@/lib/rhyme/highlight'
import type { SettingsState } from '@/store/settingsStore'

type UseOverlayMeasurementArgs = {
  docId: string
  enabled: boolean
  syllableEnabled: boolean
  rhymeEnabled: boolean
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


type CacheReuseDecision = { canReuseSyllables: boolean; canReuseRhymes: boolean; canReuse: boolean }

export function resolveOverlayCacheReuse(
  cached:
    | {
        measured: { syllables: boolean; rhymes: boolean }
        tokens?: OverlayToken[]
        rhymeTokens?: RhymeTokenPosition[]
      }
    | null,
  options: { syllableEnabled: boolean; rhymeEnabled: boolean }
): CacheReuseDecision {
  if (!cached) {
    return { canReuseSyllables: false, canReuseRhymes: false, canReuse: false }
  }

  const canReuseSyllables = !options.syllableEnabled || cached.measured.syllables
  const canReuseRhymes = !options.rhymeEnabled || cached.measured.rhymes
  return {
    canReuseSyllables,
    canReuseRhymes,
    canReuse: canReuseSyllables && canReuseRhymes,
  }
}

export function invalidateOverlayMeasurementDoc(docId: string) {
  cache.invalidateDoc(docId)
}

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
  syllableEnabled,
  rhymeEnabled,
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
  const [rhymeTokens, setRhymeTokens] = useState<RhymeTokenPosition[]>([])
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

  const rhymeTokensByLine = useMemo(() => {
    const map = new Map<string, RhymeToken[]>()
    if (!analysis?.rhymeHighlights?.tokens) return map
    analysis.rhymeHighlights.tokens.forEach((token) => {
      const existing = map.get(token.lineId)
      if (existing) {
        existing.push(token)
      } else {
        map.set(token.lineId, [token])
      }
    })
    return map
  }, [analysis?.rhymeHighlights?.tokens])

  useEffect(() => {
    if (!enabled || !analysis || analysis.docId !== docId || !isClient()) {
      setTokens([])
      setRhymeTokens([])
      return
    }
    assertClientOnly('overlay:measure')
    const root = editorRef.current
    const linesDom = lineElementsRef.current
    if (!root || !linesDom || !linesDom.length) {
      setTokens([])
      setRhymeTokens([])
      return
    }
    if (!layoutKey || !activeLineIds.size) {
      setTokens([])
      setRhymeTokens([])
      return
    }

    let rafId: number | null = null

    const measure = () => {
      const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const rootRect = root.getBoundingClientRect()
      const nextTokens: OverlayToken[] = []
      const nextRhymeTokens: RhymeTokenPosition[] = []
      let measured = 0
      let reused = 0

      for (const lineElement of linesDom) {
        const lineId = lineElement.dataset.lineId ?? ''
        if (!lineId || !activeLineIds.has(lineId)) continue
        const lineIndex = Number.parseInt(lineElement.dataset.lineIndex ?? '-1', 10)
        const contentSignature = lineSignatures.get(lineId) ?? ''
        const cached = cache.get(docId, lineId, layoutKey, contentSignature)
        const reuseDecision = resolveOverlayCacheReuse(cached, { syllableEnabled, rhymeEnabled })
        if (cached && reuseDecision.canReuse) {
          reused += 1
          lineElement.style.setProperty('--badge-offset', `${cached.lineOffset}em`)
          if (syllableEnabled && cached.tokens) {
            nextTokens.push(...cached.tokens)
          }
          if (rhymeEnabled && cached.rhymeTokens) {
            nextRhymeTokens.push(...cached.rhymeTokens)
          }
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
        if (syllableEnabled) {
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
        }

        const lineRhymeTokens: RhymeTokenPosition[] = []
        if (rhymeEnabled) {
          const rhymeTokensForLine = rhymeTokensByLine.get(lineId) ?? []
          for (const token of rhymeTokensForLine) {
            const range = measureForSpan(token.start, token.end)
            if (!range) continue
            const rects = Array.from(range.getClientRects())
            if (!rects.length) {
              range.detach()
              continue
            }
            const tokenRects = rects.map((rect) => ({
              top: rect.top - rootRect.top,
              left: rect.left - rootRect.left,
              width: rect.width,
              height: rect.height,
            }))
            lineRhymeTokens.push({
              tokenId: token.id,
              lineId,
              lineIndex,
              rects: tokenRects,
            })
            range.detach()
          }
        }

        cache.set(docId, lineId, layoutKey, contentSignature, {
          lineOffset: badgeOffsetEm,
          measured: {
            syllables: syllableEnabled,
            rhymes: rhymeEnabled,
          },
          tokens: syllableEnabled ? lineTokens : undefined,
          rhymeTokens: rhymeEnabled ? lineRhymeTokens : undefined,
        })
        if (syllableEnabled) {
          nextTokens.push(...lineTokens)
        }
        if (rhymeEnabled) {
          nextRhymeTokens.push(...lineRhymeTokens)
        }
        measured += 1
      }

      setTokens(nextTokens)
      setRhymeTokens(nextRhymeTokens)
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
    rhymeEnabled,
    rhymeTokensByLine,
    syllableEnabled,
  ])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !measurementMeta) return
    console.debug('[overlay] measure', { docId, ...measurementMeta })
  }, [docId, measurementMeta])

  return { tokens, rhymeTokens, layoutKey, measurementMeta }
}
