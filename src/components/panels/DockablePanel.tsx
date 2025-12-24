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
  headerActions?: React.ReactNode
  children: React.ReactNode
  className?: string
  panelRef?: React.Ref<HTMLDivElement>
  panelProps?: React.HTMLAttributes<HTMLDivElement>
}

const headerButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100 dark:focus-visible:ring-offset-slate-900"

/**
 * Render a panel that can be either docked inline or floated as a draggable, resizable window with header controls.
 *
 * When `isFloating` is false the panel renders inline; when true it renders into a portal attached to `document.body`
 * and becomes draggable/resizable within the window. The header includes the title, optional `headerActions`, and
 * controls to dock/undock and close the panel.
 *
 * @param isFloating - Whether the panel is rendered as a floating window (`true`) or inline (`false`).
 * @param x - X position for the floating panel (ignored when `isFloating` is false).
 * @param y - Y position for the floating panel (ignored when `isFloating` is false).
 * @param width - Width for the floating panel (ignored when `isFloating` is false).
 * @param height - Height for the floating panel (ignored when `isFloating` is false).
 * @param onMoveResize - Called when the floating panel is moved or resized with the updated bounds (`{ x?, y?, width?, height? }`).
 * @param onUndock - Called to switch the panel from docked to floating.
 * @param onDock - Called to switch the panel from floating to docked.
 * @param onClose - Optional callback invoked when the panel's close button is pressed.
 * @param headerActions - Optional React nodes rendered in the header alongside the dock/undock and close controls.
 * @param panelRef - Ref attached to the panel's root element.
 * @param panelProps - Optional props spread onto the panel root; provided `className` will be merged with the component's classes.
 * @returns The panel element (or `null` on server when a floating panel cannot be rendered).
 */
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
    <div className="flex h-11 items-center justify-between border-b border-slate-200/60 bg-white/70 px-2 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
      <div
        className="rhyme-panel-drag-handle px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500/90 dark:text-slate-300/80 cursor-move select-none"
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
    "border border-slate-200/60 rounded-xl shadow-xl bg-white text-slate-900 flex flex-col dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100" +
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