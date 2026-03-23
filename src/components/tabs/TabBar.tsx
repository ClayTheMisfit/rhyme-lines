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

/**
 * Renders a horizontal tab bar for managing lyric tabs with selection, creation, renaming, and closing.
 *
 * @param tabs - Array of tab objects to display (each should include `id`, `title`, and `isDirty`).
 * @param activeTabId - The id of the currently selected tab.
 * @param saveStatus - Current autosave status; when equal to `'saving'` a spinner is shown on the active tab.
 * @param onNew - Callback invoked when the Add tab button is clicked.
 * @param onSelect - Callback invoked with a tab id when a tab is selected.
 * @param onClose - Callback invoked with a tab id when its close button is clicked.
 * @param onRename - Callback invoked with `(id, newTitle)` when a tab rename is committed (on blur or Enter).
 * @returns A React element representing the tab bar.
 */
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
                  'group relative flex min-h-8 items-center gap-2 border px-2 py-1 text-[12px] tracking-[0.01em] whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rl-accent)]',
                  isActive
                    ? 'border-[color:var(--rl-accent)] text-[color:var(--rl-text)]'
                    : 'border-transparent text-[color:var(--rl-muted)] hover:border-[color:var(--rl-border)] hover:text-[color:var(--rl-text)]',
                  tab.isDirty && !isActive && 'text-[color:var(--rl-text)]'
                )}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startEditing(tab.id, tab.title)}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    className="w-32 border border-[color:var(--rl-border)] bg-[color:var(--rl-panel)] px-1 py-0.5 text-[12px] outline-none ring-1 ring-[color:var(--rl-accent)]/40"
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
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center text-xs text-[color:var(--rl-muted)] transition-colors hover:text-[color:var(--rl-text)]"
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
        className="inline-flex h-8 w-8 items-center justify-center border border-[color:var(--rl-accent)] bg-[color:var(--rl-accent)] text-base text-black transition duration-75 hover:brightness-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rl-accent)]"
        onClick={onNew}
        aria-label="Add tab"
      >
        +
      </button>
    </div>
  )
}

export default TabBar
