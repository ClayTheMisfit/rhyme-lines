'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'

export default function DocumentHeader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const { tabs, activeTabId, renameTab } = useTabsStore(
    (state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      renameTab: state.actions.renameTab,
    }),
    shallow
  )

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0], [activeTabId, tabs])
  const title = activeTab?.title?.trim() || 'Untitled'

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(title)
    }
  }, [isEditing, title])

  useEffect(() => {
    if (!isEditing) return
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [isEditing])

  const commit = useCallback(() => {
    if (!activeTab) return
    renameTab(activeTab.id, draftTitle || 'Untitled')
    setIsEditing(false)
  }, [activeTab, draftTitle, renameTab])

  const cancel = useCallback(() => {
    setDraftTitle(title)
    setIsEditing(false)
  }, [title])

  if (!activeTab) {
    return <div className="text-sm text-white/70">Untitled</div>
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {isEditing ? (
        <input
          ref={inputRef}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          className="h-8 w-[min(44vw,520px)] min-w-[180px] rounded-sm border border-white/15 bg-white/5 px-2.5 text-sm font-medium tracking-tight text-white outline-none focus:border-white/35"
          aria-label="Document title"
        />
      ) : (
        <>
          <button
            type="button"
            className="max-w-[min(46vw,560px)] truncate text-left text-sm font-medium tracking-tight text-white/92 hover:text-white"
            onDoubleClick={() => setIsEditing(true)}
            onClick={() => setIsEditing(true)}
            title="Rename document"
            aria-label="Rename document title"
          >
            {title}
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-white/[0.06] bg-white/[0.03] text-[10px] text-white/60 transition-colors hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            onClick={() => setIsEditing(true)}
            title="Rename (Enter to save, Esc to cancel)"
            aria-label="Edit title"
          >
            ✎
          </button>
        </>
      )}
    </div>
  )
}
