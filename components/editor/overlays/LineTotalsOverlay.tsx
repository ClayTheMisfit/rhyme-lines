import React, { useEffect, useMemo, useRef, useState } from "react"

type Props = {
  scrollContainerRef: React.RefObject<HTMLElement | null>
  editorRootRef: React.RefObject<HTMLElement | null>
  lineTotals: number[]
  showLineTotals: boolean
  theme: 'light' | 'dark'
}

type Pos = { 
  id: string
  y: number
  h: number
  hidden?: boolean
  total?: number
}

export default function LineTotalsOverlay({ 
  scrollContainerRef, 
  editorRootRef, 
  lineTotals,
  showLineTotals,
  theme 
}: Props) {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  const [positions, setPositions] = useState<Pos[]>([])
  const rafId = useRef<number | null>(null)
  const measureQueued = useRef(false)

  const queueMeasure = (why: string) => {
    if (measureQueued.current) return
    measureQueued.current = true
    rafId.current = requestAnimationFrame(() => {
      measureQueued.current = false
      measure()
    })
  }

  const measure = () => {
    const sc = scrollContainerRef.current
    const root = editorRootRef.current
    if (!sc || !root) return

    // READ PHASE
    const scRect = sc.getBoundingClientRect()
    const next: Pos[] = []
    
    // Get all line elements in order
    const lineElements = Array.from(root.querySelectorAll<HTMLElement>('[data-line-id]'))
    
    lineElements.forEach((el, index) => {
      const lineId = el.dataset.lineId
      if (!lineId) return
      
      const r = el.getBoundingClientRect()
      const top = r.top - scRect.top + sc.scrollTop
      const y = Math.round(top * dpr) / dpr
      const total = lineTotals[index] || 0
      
      next.push({ 
        id: lineId, 
        y, 
        h: r.height, 
        hidden: r.height === 0,
        total: total > 0 ? total : undefined
      })
    })
    
    setPositions(next)
  }

  // OBSERVERS & LISTENERS
  useEffect(() => {
    const sc = scrollContainerRef.current
    const root = editorRootRef.current
    if (!sc || !root) return

    const ro = new ResizeObserver(() => queueMeasure("resize"))
    ro.observe(sc)
    ro.observe(root)

    const mo = new MutationObserver(() => queueMeasure("mutation"))
    mo.observe(root, { subtree: true, childList: true, characterData: true })

    let scrollTick = false
    const onScroll = () => {
      if (scrollTick) return
      scrollTick = true
      setTimeout(() => { scrollTick = false; queueMeasure("scroll") }, 50)
    }
    sc.addEventListener("scroll", onScroll, { passive: true })
    
    const onWindowResize = () => queueMeasure("window-resize")
    const onSelectionChange = () => queueMeasure("selection")
    
    window.addEventListener("resize", onWindowResize)
    document.addEventListener("selectionchange", onSelectionChange)

    queueMeasure("mount")
    
    return () => {
      ro.disconnect()
      mo.disconnect()
      sc.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onWindowResize)
      document.removeEventListener("selectionchange", onSelectionChange)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  // Re-measure when data changes
  useEffect(() => { 
    queueMeasure("data-change") 
  }, [lineTotals])

  // Don't render if not showing totals
  if (!showLineTotals) return null

  // WRITE PHASE
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 w-full h-0 z-20"
      style={{ transform: "translateZ(0)" }}
    >
      {/* Gutter column */}
      <div
        className="absolute top-0 left-0 w-[2.25rem] md:w-[2.5rem] text-right pr-1"
        data-line-totals-gutter
      >
        {positions.map((p) => {
          if (p.hidden || p.total == null) return null
          
          const badgeH = 18
          const y = p.y + Math.max(0, (p.h - badgeH) / 2)
          
          return (
            <div
              key={p.id}
              className="absolute right-0 rounded px-1.5 h-[18px] leading-[18px] text-[11px] font-medium font-mono"
              style={{ transform: `translateY(${y}px)` }}
            >
              <span className="text-white/95">{p.total}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
