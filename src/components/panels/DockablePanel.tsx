"use client"

import React from "react"
import { createPortal } from "react-dom"
import { layers } from "@/lib/layers"
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
  headerActions?: React.ReactNode
  children: React.ReactNode
  className?: string
  panelRef?: React.Ref<HTMLDivElement>
  panelProps?: React.HTMLAttributes<HTMLDivElement>
}

const headerButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm leading-none text-white/70 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 motion-reduce:transition-none"

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
  headerActions,
  children,
  className,
  panelRef,
  panelProps,
}: Props) {
  const header = (
    <div className="flex h-12 items-center justify-between border-b border-white/10 bg-[#0d1732]/72 px-3 backdrop-blur">
      <div
        className="rhyme-panel-drag-handle rl-micro-label cursor-move select-none px-1.5"
        aria-label="Move rhyme panel"
      >
        {title}
      </div>
      <div className="flex items-center gap-1.5">
        {headerActions}
        {!isFloating ? (
          <button type="button" className={headerButtonClass} onClick={onUndock} aria-label="Detach panel">
            ⧉
          </button>
        ) : (
          <button type="button" className={headerButtonClass} onClick={onDock} aria-label="Dock panel">
            ⇤
          </button>
        )}
        {onClose ? (
          <button type="button" className={headerButtonClass} onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )

  const basePanelClasses =
    "flex flex-col rounded-[30px] border border-white/10 bg-[#0a142d]/72 text-white shadow-[0_24px_56px_rgba(2,8,24,0.52)] backdrop-blur-xl" +
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
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: layers.panelDock }}>
      <Rnd
        className="pointer-events-auto"
        dragHandleClassName="rhyme-panel-drag-handle"
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
