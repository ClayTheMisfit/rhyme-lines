"use client"

import React from "react"
import { createPortal } from "react-dom"

type RndComponent = typeof import("react-rnd").Rnd

type DockBounds = {
  x?: number
  y?: number
  width?: number
  height?: number
}

type Props = {
  title: string
  isFloating: boolean
  x: number
  y: number
  width: number
  height: number
  onMoveResize: (bounds: DockBounds) => void
  onUndock: () => void
  onDock: () => void
  onClose?: () => void
  children: React.ReactNode
  className?: string
}

const headerButtonClass =
  "text-sm leading-none opacity-70 hover:opacity-100 transition-opacity"

export function DockablePanel({
  title,
  isFloating,
  x,
  y,
  width,
  height,
  onMoveResize,
  onUndock,
  onDock,
  onClose,
  children,
  className,
}: Props) {
  const [RndComponentRef, setRndComponentRef] = React.useState<RndComponent | null>(null)

  React.useEffect(() => {
    if (!isFloating || RndComponentRef) return
    let isMounted = true
    void import("react-rnd").then((mod) => {
      if (isMounted) {
        setRndComponentRef(() => mod.Rnd)
      }
    })
    return () => {
      isMounted = false
    }
  }, [RndComponentRef, isFloating])

  const header = (
    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-slate-900/80 backdrop-blur">
      <h3 className="text-sm font-semibold tracking-wide text-white/90">{title}</h3>
      <div className="flex items-center gap-2">
        {!isFloating ? (
          <button type="button" className={headerButtonClass} onClick={onUndock} title="Undock panel">
            ⧉
          </button>
        ) : (
          <button type="button" className={headerButtonClass} onClick={onDock} title="Dock panel">
            ⇤
          </button>
        )}
        {onClose ? (
          <button type="button" className={headerButtonClass} onClick={onClose} title="Close panel">
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )

  const panelClasses =
    "border border-white/10 rounded-xl shadow-xl bg-slate-900 text-slate-100 flex flex-col" +
    (className ? ` ${className}` : "")

  if (!isFloating) {
    return (
      <div className={panelClasses}>
        {header}
        <div className="min-h-[200px] flex-1 overflow-hidden">{children}</div>
      </div>
    )
  }

  if (typeof window === "undefined") return null

  const FloatingShell = () => (
    <div className={panelClasses}>
      {header}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )

  const content = (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {RndComponentRef ? (
        <RndComponentRef
          className="pointer-events-auto"
          bounds="window"
          minWidth={280}
          minHeight={240}
          size={{ width, height }}
          position={{ x, y }}
          onDragStop={(_, data) => onMoveResize({ x: data.x, y: data.y })}
          onResizeStop={(_, __, ref, ___, position) =>
            onMoveResize({
              width: parseInt(ref.style.width, 10),
              height: parseInt(ref.style.height, 10),
              x: position.x,
              y: position.y,
            })
          }
        >
          <FloatingShell />
        </RndComponentRef>
      ) : (
        <div
          className="pointer-events-auto"
          style={{ width, height, position: "absolute", left: x, top: y }}
        >
          <FloatingShell />
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
