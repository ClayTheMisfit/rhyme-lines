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
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-sm leading-none text-slate-600 transition duration-150 ease-out hover:border-[color:var(--rl-accent-border)] hover:bg-white/35 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--rl-shell-elevated)] motion-reduce:transition-none dark:text-white/55 dark:hover:border-[#7c8cff]/25 dark:hover:bg-[#7c8cff]/10 dark:hover:text-white/90 dark:focus-visible:ring-[#7c8cff]/35 dark:focus-visible:ring-offset-[#101012]"

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
    <div className="flex h-11 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] px-3 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.015]">
      <div
        className="rhyme-panel-drag-handle cursor-move select-none px-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500/90 dark:text-white/48"
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
    "flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(12,12,14,0.86)] text-slate-900 shadow-2xl shadow-black/35 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[rgba(12,12,14,0.86)] dark:text-white" +
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
