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
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-transparent text-sm leading-none text-slate-500 transition-colors hover:border-slate-300/60 hover:bg-slate-100/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:text-white/55 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/90 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#101012]"

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
    <div className="flex h-11 items-center justify-between border-b border-slate-200/70 bg-slate-100/70 px-2.5 backdrop-blur-sm dark:border-white/[0.08] dark:bg-[#0f0f11]/90">
      <div
        className="rhyme-panel-drag-handle cursor-move select-none px-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500/90 dark:text-white/42"
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
    "flex flex-col rounded-lg border border-slate-200/70 bg-white/95 text-slate-900 shadow-lg shadow-slate-900/5 dark:border-white/[0.08] dark:bg-[#101012] dark:text-white" +
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
