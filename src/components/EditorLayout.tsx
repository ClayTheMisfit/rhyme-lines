'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'
import TopBar from '@/components/TopBar'
import EditorShell from '@/components/EditorShell'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const SIDEBAR_COLLAPSED_KEY = 'rhyme-lines:editor-sidebar-collapsed'
const SIDEBAR_EXPANDED_WIDTH = 232
const SIDEBAR_COLLAPSED_WIDTH = 52

export default function EditorLayout() {
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

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
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
          className="hidden overflow-hidden border-r border-white/[0.04] bg-[#101012] px-2 py-4 lg:flex lg:flex-col"
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.08] bg-white/[0.02] text-white/62 transition-colors hover:border-white/[0.16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
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
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-white/[0.08] text-white/68 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                title="New document"
                aria-label="New document"
              >
                +
              </button>
            ) : null}
          </div>

          {sidebarExpanded ? (
            <>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/35">Documents</p>
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
                          ? 'border-white/[0.16] bg-white/[0.06] text-white/90'
                          : 'border-transparent text-white/42 hover:border-white/[0.08] hover:text-white/72'
                      }`}
                    >
                      <span className="truncate">{tab.title || 'Untitled'}</span>
                      {tab.isDirty ? <span className="text-[#f2d000]/85">•</span> : null}
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.06] bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                Docs
              </button>
            </div>
          )}
        </aside>
        <main className="min-w-0">
          <EditorShell />
        </main>
      </div>
    </div>
  )
}
