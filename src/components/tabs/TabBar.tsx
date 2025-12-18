'use client'

import { useEffect, useRef, useState } from 'react'
import type { Tab } from '@/store/tabsStore'
import { cn } from '@/lib/utils'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onNew: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRename: (id: string, title: string) => void
}

export function TabBar({ tabs, activeTabId, onNew, onSelect, onClose, onRename }: TabBarProps) {
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
    <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-auto" role="tablist" aria-label="Lyric tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const isEditing = editingId === tab.id

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={cn(
                'group relative flex items-center gap-2 rounded-md px-3 py-1 text-sm transition-colors whitespace-nowrap',
                isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
              )}
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => startEditing(tab.id, tab.title)}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="w-32 rounded bg-white/10 px-1 py-0.5 text-sm outline-none ring-1 ring-white/30"
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
                <span className="flex items-center gap-1">
                  <span className="truncate">{tab.title || 'Untitled'}</span>
                  {tab.isDirty && <span className="text-xs text-rose-200" aria-label="Unsaved changes">•</span>}
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

      <button
        type="button"
        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-sm text-white transition hover:bg-white/20"
        onClick={onNew}
        aria-label="Add tab"
      >
        +
      </button>
    </div>
  )
}

export default TabBar
