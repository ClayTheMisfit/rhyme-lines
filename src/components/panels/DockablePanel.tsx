"use client"

import React from "react"
import { createPortal } from "react-dom"
import { Rnd } from "react-rnd"

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
  panelRef?: React.Ref<HTMLDivElement>
  panelProps?: React.HTMLAttributes<HTMLDivElement>
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
  panelRef,
  panelProps,
}: Props) {
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

  const basePanelClasses =
    "border border-white/10 rounded-xl shadow-xl bg-slate-900 text-slate-100 flex flex-col" +
    (className ? ` ${className}` : "")
  const panelClasses = panelProps?.className
    ? `${basePanelClasses} ${panelProps.className}`
    : basePanelClasses

  const mergedPanelProps = panelProps ? { ...panelProps, className: panelClasses } : { className: panelClasses }

  if (!isFloating) {
    return (
      <div ref={panelRef} {...mergedPanelProps}>
        {header}
        <div className="min-h-[200px] flex-1 overflow-hidden">{children}</div>
      </div>
    )
  }

  if (typeof window === "undefined") return null

  const content = (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <Rnd
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
        <div ref={panelRef} {...mergedPanelProps}>
          {header}
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </Rnd>
    </div>
  )

  return createPortal(content, document.body)
}
