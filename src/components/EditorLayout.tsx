'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getOrderedTabs, MAX_TAB_TITLE_LENGTH, type Tab, useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'
import TopBar from '@/components/TopBar'
import EditorShell from '@/components/EditorShell'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getLastOpenProjectId, setLastOpenProjectId } from '@/lib/projects/storage'

const SIDEBAR_COLLAPSED_KEY = 'rhyme-lines:editor-sidebar-collapsed'
const SIDEBAR_EXPANDED_WIDTH = 232
const SIDEBAR_COLLAPSED_WIDTH = 52

type EditorLayoutProps = {
  projectId?: string | null
}

type DocumentRowProps = {
  tab: Tab
  active: boolean
  indexInGroup: number
  groupLength: number
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onPinToggle: (id: string, isPinned: boolean) => void
  onMove: (id: string, direction: -1 | 1) => void
  onDelete: (id: string) => void
  onDragStart: (id: string) => void
  onDropOn: (id: string) => void
}

function DocumentRow({
  tab,
  active,
  indexInGroup,
  groupLength,
  onSelect,
  onRename,
  onPinToggle,
  onMove,
  onDelete,
  onDragStart,
  onDropOn,
}: DocumentRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(tab.title || 'Untitled')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  useEffect(() => {
    if (confirmingDelete) cancelRef.current?.focus()
  }, [confirmingDelete])

  const finishRename = (save: boolean) => {
    if (save) onRename(tab.id, draftTitle)
    setRenaming(false)
    setMenuOpen(false)
    requestAnimationFrame(() => rowRef.current?.focus())
  }

  const startRename = () => {
    setDraftTitle(tab.title || 'Untitled')
    setRenaming(true)
    setMenuOpen(false)
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'F2') {
      event.preventDefault()
      startRename()
      return
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      onMove(tab.id, event.key === 'ArrowUp' ? -1 : 1)
    }
  }

  const title = tab.title || 'Untitled'
  const canMoveUp = indexInGroup > 0
  const canMoveDown = indexInGroup < groupLength - 1

  return (
    <div
      ref={rowRef}
      tabIndex={0}
      role="listitem"
      aria-label={`${title}${active ? ', active document' : ''}${tab.isPinned ? ', pinned' : ''}`}
      onKeyDown={handleRowKeyDown}
      onDragOver={(event) => {
        event.preventDefault()
        event.currentTarget.dataset.dragOver = 'true'
      }}
      onDragLeave={(event) => {
        delete event.currentTarget.dataset.dragOver
      }}
      onDrop={(event) => {
        event.preventDefault()
        delete event.currentTarget.dataset.dragOver
        onDropOn(tab.id)
      }}
      className={`group relative rounded-sm border text-xs tracking-[0.03em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)] data-[drag-over=true]:border-[color:var(--rl-accent,#b88cff)] ${
        active
          ? 'border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-text)_8%,transparent)] text-[color:var(--rl-shell-text)]'
          : 'border-transparent text-[color:var(--rl-shell-muted)] hover:border-[color:var(--rl-shell-border)] hover:text-[color:var(--rl-shell-text)]'
      }`}
    >
      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
        <button
          type="button"
          draggable={!renaming}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', tab.id)
            onDragStart(tab.id)
          }}
          aria-label={`Drag ${title}`}
          title="Drag to reorder"
          className="inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded-sm text-[color:var(--rl-shell-muted)] hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
        >
          ⋮
        </button>
        {renaming ? (
          <input
            ref={inputRef}
            value={draftTitle}
            maxLength={MAX_TAB_TITLE_LENGTH}
            aria-label={`Rename ${title}`}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={() => finishRename(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') finishRename(true)
              if (event.key === 'Escape') finishRename(false)
            }}
            className="min-w-0 flex-1 rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-bg)] px-1.5 py-1 text-xs text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(tab.id)}
            onDoubleClick={startRename}
            className="min-w-0 flex-1 truncate rounded-sm px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
            title={title}
            aria-label={title}
          >
            <span className="truncate">{title}</span>
          </button>
        )}
        {tab.isPinned ? <span aria-label="Pinned" title="Pinned" className="shrink-0 text-[10px] opacity-70">⌖</span> : null}
        {tab.isDirty ? <span aria-label="Unsaved changes" className="shrink-0 text-amber-500/85">•</span> : null}
        <button
          type="button"
          aria-label={`Actions for ${title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[color:var(--rl-shell-muted)] opacity-80 hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)] group-hover:opacity-100"
        >
          ⋯
        </button>
      </div>

      {menuOpen ? (
        <div role="menu" className="absolute right-1 top-8 z-20 w-36 rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] p-1 shadow-lg">
          <button role="menuitem" type="button" onClick={startRename} className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">Rename</button>
          <button role="menuitem" type="button" onClick={() => { onPinToggle(tab.id, tab.isPinned); setMenuOpen(false) }} className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">{tab.isPinned ? 'Unpin' : 'Pin'}</button>
          <button role="menuitem" type="button" disabled={!canMoveUp} onClick={() => { onMove(tab.id, -1); setMenuOpen(false) }} className="w-full rounded-sm px-2 py-1.5 text-left disabled:opacity-35 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">Move up</button>
          <button role="menuitem" type="button" disabled={!canMoveDown} onClick={() => { onMove(tab.id, 1); setMenuOpen(false) }} className="w-full rounded-sm px-2 py-1.5 text-left disabled:opacity-35 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">Move down</button>
          <button role="menuitem" type="button" onClick={() => { setConfirmingDelete(true); setMenuOpen(false) }} className="w-full rounded-sm px-2 py-1.5 text-left text-red-300 hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">Delete</button>
        </div>
      ) : null}

      {confirmingDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Delete ${title}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setConfirmingDelete(false)
              requestAnimationFrame(() => rowRef.current?.focus())
            }
            if (event.key === 'Tab') {
              event.preventDefault()
              const deleteButton = event.currentTarget.querySelector('button[type="button"]:last-of-type') as HTMLButtonElement | null
              if (event.shiftKey) {
                if (document.activeElement === cancelRef.current) {
                  deleteButton?.focus()
                } else {
                  cancelRef.current?.focus()
                }
              } else {
                if (document.activeElement === deleteButton) {
                  cancelRef.current?.focus()
                } else {
                  deleteButton?.focus()
                }
              }
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] p-4 text-[color:var(--rl-shell-text)] shadow-xl">
            <p className="text-sm font-medium">Delete "{title}"?</p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--rl-shell-muted)]">This permanently removes the document from this device.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => { setConfirmingDelete(false); requestAnimationFrame(() => rowRef.current?.focus()) }} className="rounded-sm border border-[color:var(--rl-shell-border)] px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">Cancel</button>
              <button type="button" onClick={() => { onDelete(tab.id); setConfirmingDelete(false) }} className="rounded-sm border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function EditorLayout({ projectId }: EditorLayoutProps = {}) {
  const router = useRouter()
  const { tabs, activeTabId, actions } = useTabsStore(
    (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId, actions: state.actions }),
    shallow
  )

  const orderedTabs = useMemo(() => getOrderedTabs(tabs), [tabs])
  const routeProject = useMemo(
    () => (projectId ? tabs.find((tab) => tab.id === projectId) ?? null : null),
    [projectId, tabs]
  )
  const routeProjectIdIsInvalid = Boolean(projectId) && !routeProject
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const sidebarExpanded = !sidebarCollapsed
  const sidebarAriaLabel = sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (stored === 'true') setSidebarCollapsed(true)
    } catch {}
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed)) } catch {}
  }, [sidebarCollapsed])

  useEffect(() => {
    const handleSidebarShortcut = (event: globalThis.KeyboardEvent) => {
      const usesShortcut = (event.ctrlKey || event.metaKey) && event.code === 'Backquote'
      if (!usesShortcut || event.altKey || event.shiftKey) return
      event.preventDefault()
      setSidebarCollapsed((current) => !current)
    }
    window.addEventListener('keydown', handleSidebarShortcut)
    return () => window.removeEventListener('keydown', handleSidebarShortcut)
  }, [])

  useEffect(() => {
    const targetProjectId = projectId || getLastOpenProjectId()
    if (!targetProjectId) return
    const targetProject = tabs.find((tab) => tab.id === targetProjectId)
    if (!targetProject) {
      const fallback = orderedTabs[0]
      if (getLastOpenProjectId() === targetProjectId) setLastOpenProjectId(fallback?.id ?? null)
      if (projectId) router.replace(fallback ? `/editor/${fallback.id}` : '/editor')
      return
    }
    if (activeTabId !== targetProjectId) actions.setActive(targetProjectId)
  }, [activeTabId, actions, orderedTabs, projectId, router, tabs])

  useEffect(() => {
    if (!activeTabId) return
    const activeTabExists = tabs.some((tab) => tab.id === activeTabId)
    if (!activeTabExists) return
    setLastOpenProjectId(activeTabId)
    const routeIsDrivingSelection = Boolean(projectId) && projectId !== activeTabId
    if (routeIsDrivingSelection) return
    if (!routeProjectIdIsInvalid && projectId !== activeTabId) router.replace(`/editor/${activeTabId}`)
  }, [activeTabId, projectId, routeProjectIdIsInvalid, router, tabs])

  const layoutStyle: CSSProperties & { '--editor-layout-columns': string } = {
    paddingTop: 'var(--header-height, 48px)',
    '--editor-layout-columns': `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH}px minmax(0,1fr)`,
  }

  const handleDropOn = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const dragged = tabs.find((tab) => tab.id === draggedId)
    const target = tabs.find((tab) => tab.id === targetId)
    if (!dragged || !target || dragged.isPinned !== target.isPinned) return
    const group = orderedTabs.filter((tab) => tab.isPinned === dragged.isPinned)
    actions.moveTabToIndex(draggedId, group.findIndex((tab) => tab.id === targetId))
    setDraggedId(null)
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[color:var(--rl-shell-bg)] text-[color:var(--rl-shell-text)]">
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden transition-[grid-template-columns] duration-150 lg:[grid-template-columns:var(--editor-layout-columns)]" style={layoutStyle}>
        <aside id="editor-documents-sidebar" className="hidden overflow-hidden border-r border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-chrome)] px-2 py-4 lg:flex lg:flex-col">
          <div className={`mb-4 flex items-center ${sidebarExpanded ? 'justify-between' : 'justify-center'}`}>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarAriaLabel} aria-expanded={sidebarExpanded} aria-controls="editor-documents-sidebar" title={sidebarAriaLabel} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-elevated)_74%,transparent)] text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"><span className={`text-sm transition-transform duration-150 ${sidebarCollapsed ? 'rotate-180' : ''}`} aria-hidden>❮</span></button></TooltipTrigger><TooltipContent side="right">{sidebarAriaLabel} · Ctrl/Cmd + `</TooltipContent></Tooltip></TooltipProvider>
            {sidebarExpanded ? <button type="button" onClick={actions.newTab} className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] text-[color:var(--rl-shell-muted)] hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]" title="New document" aria-label="New document">+</button> : null}
          </div>

          {sidebarExpanded ? (
            <>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--rl-shell-muted)]">Documents</p>
              <nav className="space-y-1.5" aria-label="Documents" role="list">
                {orderedTabs.map((tab) => {
                  const group = orderedTabs.filter((item) => item.isPinned === tab.isPinned)
                  return <DocumentRow key={tab.id} tab={tab} active={tab.id === activeTabId} indexInGroup={group.findIndex((item) => item.id === tab.id)} groupLength={group.length} onSelect={actions.setActive} onRename={actions.renameTab} onPinToggle={(id, pinned) => pinned ? actions.unpinTab(id) : actions.pinTab(id)} onMove={actions.moveTab} onDelete={actions.deleteTab} onDragStart={setDraggedId} onDropOn={handleDropOn} />
                })}
              </nav>
            </>
          ) : (
            <div className="mt-2 flex flex-1 items-start justify-center"><button type="button" onClick={() => setSidebarCollapsed(false)} aria-label="Open documents" className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-elevated)_74%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]">Docs</button></div>
          )}
        </aside>
        <main className="flex min-h-0 min-w-0 bg-[color:var(--rl-editor-lane)]">{routeProjectIdIsInvalid ? null : <EditorShell />}</main>
      </div>
    </div>
  )
}
