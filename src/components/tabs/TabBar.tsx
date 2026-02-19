'use client'

import { useEffect, useRef, useState } from 'react'
import type { Tab } from '@/store/tabsStore'
import type { AutosaveStatus } from '@/store/autosaveStore'

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  saveStatus: AutosaveStatus
  onNew: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRename: (id: string, title: string) => void
}

export function TabBar({ tabs, activeTabId, saveStatus, onNew, onSelect, onClose, onRename }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editingId) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editingId])

  useEffect(() => {
    if (!editingId) return
    const exists = tabs.some((tab) => tab.id === editingId)
    if (!exists) {
      setEditingId(null)
    }
  }, [editingId, tabs])

  const startEditing = (id: string, currentTitle: string) => {
    setEditingId(id)
    setDraftTitle(currentTitle)
  }

  const commitRename = () => {
    if (!editingId) return
    onRename(editingId, draftTitle)
    setEditingId(null)
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pr-1"
          role="tablist"
          aria-label="Lyric tabs"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isEditing = editingId === tab.id
            const showSavingSpinner = isActive && saveStatus === 'saving'

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={cx(
                  'group relative flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1 text-[13px] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45',
                  isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/6',
                  tab.isDirty && !isActive && 'text-white/85'
                )}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startEditing(tab.id, tab.title)}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    className="w-32 rounded bg-white/10 px-1 py-0.5 text-[13px] outline-none ring-1 ring-white/30"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelRename()
                      }
                    }}
                  />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{tab.title || 'Untitled'}</span>
                    <span className="inline-flex h-3 w-3 items-center justify-center" aria-hidden="true">
                      <span
                        data-testid={isActive ? 'active-tab-save-spinner' : undefined}
                        aria-hidden="true"
                        className={cx(
                          'h-3 w-3 rounded-full border border-current border-t-transparent transition-opacity duration-100',
                          showSavingSpinner ? 'animate-spin opacity-85' : 'pointer-events-none opacity-0'
                        )}
                      />
                    </span>
                  </span>
                )}
                <span
                  role="button"
                  aria-label={`Close tab ${tab.title}`}
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-white/70 transition hover:bg-white/10"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(tab.id)
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-base text-white transition duration-100 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
        onClick={onNew}
        aria-label="Add tab"
      >
        +
      </button>
    </div>
  )
}

export default TabBar
