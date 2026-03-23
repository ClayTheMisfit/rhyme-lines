'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type EditorHandle } from './Editor'
import RhymePanel from './RhymePanel'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useTabsStore, hydrateTabsFromPersisted } from '@/store/tabsStore'
import { hydrateSettingsStore } from '@/store/settingsStore'
import { hydrateRhymePanel } from '@/store/rhymePanelStore'
import { hydrateBadgeSettings } from '@/store/settings'
import { loadPersistedAppState } from '@/lib/persist/appState'
import { shallow } from 'zustand/shallow'
import { useHydrated } from '@/hooks/useHydrated'
import { useAutosave } from '@/hooks/useAutosave'
import { useAutosaveStore } from '@/store/autosaveStore'

/**
 * Render the editor shell that coordinates the lyric Editor and RhymePanel, manages hydration, focus, keyboard shortcuts, click-outside behavior, and autosave status.
 *
 * Renders a placeholder until client and app state hydration complete, then mounts the Editor and RhymePanel, wires focus helpers (including Alt+R to open the panel), subscribes to persisted state hydration, listens for outside clicks to hide the panel, and exposes a visually hidden live region reporting autosave status.
 *
 * @returns The EditorShell React element
 */
export default function EditorShell() {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const floatingPanelRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const hydrated = useHydrated()
  const [appStateReady, setAppStateReady] = useState(false)
  const ready = hydrated && appStateReady
  const { mode, setMode } = useRhymePanel((state) => ({
    mode: state.mode,
    setMode: state.setMode,
  }))
  const { tabs, activeTabId, actions } = useTabsStore(
    (state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      actions: state.actions,
    }),
    shallow
  )

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  )

  const { saveStatus, saveError } = useAutosaveStore((state) => ({
    saveStatus: state.status,
    saveError: state.lastError,
  }), shallow)
  const saveLiveLabel = !ready
    ? ''
    : saveStatus === 'saving'
      ? 'Saving'
      : saveStatus === 'error'
        ? `Save failed${saveError ? `: ${saveError}` : ''}`
        : saveStatus === 'dirty'
          ? 'Changes pending save'
          : ''
  const saveDisplayLabel = saveStatus === 'saving'
    ? 'SYNCING'
    : saveStatus === 'dirty'
      ? 'PENDING'
      : saveStatus === 'error'
        ? 'ERROR'
        : 'SAVED'

  const focusRhymePanel = useCallback(() => {
    const panelElement = floatingPanelRef.current
    if (panelElement) {
      panelElement.focus()
      return
    }

    window.requestAnimationFrame(() => {
      floatingPanelRef.current?.focus()
    })
  }, [])

  const focusEditor = useCallback(() => {
    const editorElement = document.getElementById('lyric-editor')
    if (!editorElement) return

    editorElement.focus()

    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    range.selectNodeContents(editorElement)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const handleClickOutside = useCallback(() => {
    if (mode === 'hidden') return
    setMode('hidden')
    focusEditor()
  }, [focusEditor, mode, setMode])

  useEffect(() => {
    if (mode === 'hidden') return

    const handleDocumentClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return

      const shellElement = shellRef.current
      const panelElement = floatingPanelRef.current

      const insideShell = shellElement ? shellElement.contains(target) : false
      const insidePanel = panelElement ? panelElement.contains(target) : false

      if (insideShell || insidePanel) return

      handleClickOutside()
    }

    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('touchstart', handleDocumentClick)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('touchstart', handleDocumentClick)
    }
  }, [handleClickOutside, mode])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    const snapshot = loadPersistedAppState()
    hydrateSettingsStore(snapshot.settings)
    hydrateTabsFromPersisted(snapshot.drafts)
    hydrateRhymePanel(snapshot.panel)
    hydrateBadgeSettings()
    if (!cancelled) {
      setAppStateReady(true)
    }
    return () => {
      cancelled = true
    }
  }, [hydrated])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== 'r') return
      event.preventDefault()

      if (mode === 'hidden') {
        setMode('docked')
        window.requestAnimationFrame(() => {
          focusRhymePanel()
          window.requestAnimationFrame(() => {
            focusRhymePanel()
          })
        })
        return
      }

      focusRhymePanel()
      window.requestAnimationFrame(() => {
        focusRhymePanel()
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusRhymePanel, mode, setMode])

  const { markTextChanged } = useAutosave({
    onSaved: () => {
      const state = useTabsStore.getState()
      const currentTab = state.tabs.find((tab) => tab.id === state.activeTabId)
      if (currentTab) {
        state.actions.markDirty(currentTab.id, false)
      }
    },
  })

  const handleTextChange = useCallback(
    (text: string) => {
      if (!activeTab) return
      if (text === activeTab.snapshot.text) return
      actions.updateSnapshot(activeTab.id, { text })
      actions.markDirty(activeTab.id, true)
      markTextChanged()
    },
    [actions, activeTab, markTextChanged]
  )

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      if (!activeTab) return
      actions.markDirty(activeTab.id, dirty)
    },
    [actions, activeTab]
  )

  return (
    <div ref={shellRef} className="relative flex h-full w-full flex-col">
      {!ready ? (
        <div className="flex h-full w-full flex-1 min-h-0" aria-hidden />
      ) : (
        <div className="flex h-full w-full flex-1 min-h-0 bg-[color:var(--rl-bg)]">
          <aside className="hidden h-full w-[272px] shrink-0 border-r border-[color:var(--rl-border)] bg-[color:var(--rl-panel)] md:flex md:flex-col">
            <div className="border-b border-[color:var(--rl-border)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--rl-muted)]">Project</div>
              <div className="mt-2 text-sm text-[color:var(--rl-text)]">Current Draft</div>
            </div>
            <div className="border-b border-[color:var(--rl-border)] px-3 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--rl-muted)]">Drafts</div>
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => actions.setActive(tab.id)}
                      className={`flex w-full items-center justify-between border px-2 py-1.5 text-left text-xs ${
                        isActive
                          ? 'border-[color:var(--rl-accent)] text-[color:var(--rl-text)]'
                          : 'border-transparent text-[color:var(--rl-muted)] hover:border-[color:var(--rl-border)] hover:text-[color:var(--rl-text)]'
                      }`}
                    >
                      <span className="truncate">{tab.title || 'Untitled'}</span>
                      {tab.isDirty && <span className="text-[10px] text-[color:var(--rl-accent)]">●</span>}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={actions.newTab}
                className="mt-3 inline-flex w-full items-center justify-center border border-[color:var(--rl-accent)] bg-[color:var(--rl-accent)] px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-black"
              >
                New Draft
              </button>
            </div>
            <div className="mt-auto border-t border-[color:var(--rl-border)] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-[color:var(--rl-muted)]">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className={saveStatus === 'idle' ? 'text-[color:var(--rl-accent)]' : ''}>{saveDisplayLabel}</span>
              </div>
            </div>
          </aside>
          <div className="flex min-h-0 flex-1">
            <Editor
              ref={editorRef}
              hydrated={ready}
              text={activeTab?.snapshot.text ?? ''}
              onTextChange={handleTextChange}
              onDirtyChange={handleDirtyChange}
            />
            <RhymePanel ref={floatingPanelRef} editorRef={editorRef} />
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {saveLiveLabel}
      </span>
    </div>
  )
}
