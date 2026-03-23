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
  "inline-flex h-7 w-7 items-center justify-center border border-transparent text-xs leading-none text-[color:var(--rl-muted)] transition-colors hover:border-[color:var(--rl-border)] hover:text-[color:var(--rl-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rl-accent)]"

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
    <div className="flex h-10 items-center justify-between border-b border-[color:var(--rl-border)] bg-[color:var(--rl-panel)] px-2">
      <div
        className="rhyme-panel-drag-handle cursor-move select-none px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[color:var(--rl-muted)]"
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
    "border border-[color:var(--rl-border)] bg-[color:var(--rl-panel)] text-[color:var(--rl-text)] flex flex-col" +
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
