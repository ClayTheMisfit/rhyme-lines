'use client'

import { useMemo } from 'react'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'
import TopBar from '@/components/TopBar'
import EditorShell from '@/components/EditorShell'

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

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-[232px_minmax(0,1fr)]" style={{ paddingTop: 'var(--header-height, 48px)' }}>
        <aside className="hidden border-r border-white/[0.04] bg-[#101012] px-3 py-4 lg:flex lg:flex-col">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Documents</p>
            <button
              type="button"
              onClick={newTab}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-white/[0.08] text-white/68 hover:text-white"
              title="New document"
              aria-label="New document"
            >
              +
            </button>
          </div>

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
        </aside>
        <main className="min-w-0">
          <EditorShell />
        </main>
      </div>
    </div>
  )
}

