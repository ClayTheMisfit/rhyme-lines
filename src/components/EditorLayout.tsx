'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'
import TopBar from '@/components/TopBar'
import EditorShell from '@/components/EditorShell'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getLastOpenProjectId, setLastOpenProjectId } from '@/lib/projects/storage'

const SIDEBAR_COLLAPSED_KEY = 'rhyme-lines:editor-sidebar-collapsed'
const SIDEBAR_EXPANDED_WIDTH = 232
const SIDEBAR_COLLAPSED_WIDTH = 52

export default function EditorLayout() {
  const searchParams = useSearchParams()
  const { tabs, activeTabId, newTab, setActive } = useTabsStore(
    (state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      newTab: state.actions.newTab,
      setActive: state.actions.setActive,
    }),
    shallow
  )

  const sortedTabs = useMemo(() => [...tabs].sort((a, b) => b.updatedAt - a.updatedAt), [tabs])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sidebarExpanded = !sidebarCollapsed
  const sidebarAriaLabel = sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (stored === 'true') {
        setSidebarCollapsed(true)
      }
    } catch {
      // ignore localStorage read errors
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    } catch {
      // ignore localStorage write errors
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    const handleSidebarShortcut = (event: KeyboardEvent) => {
      const usesShortcut = (event.ctrlKey || event.metaKey) && event.code === 'Backquote'
      if (!usesShortcut || event.altKey || event.shiftKey) return
      event.preventDefault()
      setSidebarCollapsed((current) => !current)
    }

    window.addEventListener('keydown', handleSidebarShortcut)
    return () => window.removeEventListener('keydown', handleSidebarShortcut)
  }, [])

  useEffect(() => {
    const projectFromUrl = searchParams.get('project')
    const projectId = projectFromUrl || getLastOpenProjectId()
    if (!projectId) return
    if (!tabs.some((tab) => tab.id === projectId)) return
    if (activeTabId !== projectId) {
      setActive(projectId)
    }
  }, [activeTabId, searchParams, setActive, tabs])

  useEffect(() => {
    if (activeTabId) {
      setLastOpenProjectId(activeTabId)
    }
  }, [activeTabId])

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--rl-shell-bg)] text-[color:var(--rl-shell-text)]">
      <TopBar />
      <div
        className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-150"
        style={{
          paddingTop: 'var(--header-height, 48px)',
          gridTemplateColumns: `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH}px minmax(0,1fr)`,
        }}
      >
        <aside
          id="editor-documents-sidebar"
          className="hidden overflow-hidden border-r border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-chrome)] px-2 py-4 lg:flex lg:flex-col"
        >
          <div className={`mb-4 flex items-center ${sidebarExpanded ? 'justify-between' : 'justify-center'}`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed((current) => !current)}
                    aria-label={sidebarAriaLabel}
                    aria-expanded={sidebarExpanded}
                    aria-controls="editor-documents-sidebar"
                    title={sidebarAriaLabel}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-elevated)_74%,transparent)] text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
                  >
                    <span className={`text-sm transition-transform duration-150 ${sidebarCollapsed ? 'rotate-180' : ''}`} aria-hidden>
                      ❮
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{sidebarAriaLabel} · Ctrl/Cmd + `</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {sidebarExpanded ? (
              <button
                type="button"
                onClick={newTab}
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] text-[color:var(--rl-shell-muted)] hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
                title="New document"
                aria-label="New document"
              >
                +
              </button>
            ) : null}
          </div>

          {sidebarExpanded ? (
            <>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--rl-shell-muted)]">Documents</p>
              <nav className="space-y-1.5">
                {sortedTabs.map((tab) => {
                  const active = tab.id === activeTabId
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActive(tab.id)}
                      className={`flex w-full items-center justify-between rounded-sm border px-2.5 py-2 text-left text-xs tracking-[0.03em] ${
                        active
                          ? 'border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-text)_8%,transparent)] text-[color:var(--rl-shell-text)]'
                          : 'border-transparent text-[color:var(--rl-shell-muted)] hover:border-[color:var(--rl-shell-border)] hover:text-[color:var(--rl-shell-text)]'
                      }`}
                    >
                      <span className="truncate">{tab.title || 'Untitled'}</span>
                      {tab.isDirty ? <span className="text-amber-500/85">•</span> : null}
                    </button>
                  )
                })}
              </nav>
            </>
          ) : (
            <div className="mt-2 flex flex-1 items-start justify-center">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Open documents"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-elevated)_74%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
              >
                Docs
              </button>
            </div>
          )}
        </aside>
        <main className="min-w-0 bg-[color:var(--rl-editor-lane)]">
          <EditorShell />
        </main>
      </div>
    </div>
  )
}
