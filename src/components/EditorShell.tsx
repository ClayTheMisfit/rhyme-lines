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

  const wordCount = useMemo(() => {
    const text = activeTab?.snapshot.text ?? ''
    return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length
  }, [activeTab?.snapshot.text])

  return (
    <div ref={shellRef} className="relative flex h-full w-full flex-col">
      {!ready ? (
        <div className="flex h-full w-full flex-1 min-h-0" aria-hidden />
      ) : (
        <div className="flex h-full w-full flex-1 min-h-0 bg-[color:var(--rl-bg)]">
          <aside className="hidden h-full w-[272px] shrink-0 border-r border-[color:var(--rl-border)] bg-[#161618] md:flex md:flex-col">
            <div className="border-b border-[color:var(--rl-border)] px-6 py-8">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rl-accent)]">Project Alpha</div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--rl-muted)]">Drafting Stage</div>
            </div>

            <div className="border-b border-[color:var(--rl-border)] py-2">
              <button type="button" className="flex w-full items-center gap-3 border-l-2 border-[color:var(--rl-accent)] bg-[#2a2a2d] px-6 py-3 text-left text-xs uppercase tracking-[0.1em] text-[color:var(--rl-text)]">
                <span className="text-[color:var(--rl-accent)]">✎</span>
                Editor
              </button>
              <button type="button" onClick={() => setMode(mode === 'hidden' ? 'docked' : 'hidden')} className="flex w-full items-center gap-3 px-6 py-3 text-left text-xs uppercase tracking-[0.1em] text-[color:var(--rl-muted)] hover:text-[color:var(--rl-text)]">
                <span>✦</span>
                Rhymes
              </button>
              <button type="button" className="flex w-full items-center gap-3 px-6 py-3 text-left text-xs uppercase tracking-[0.1em] text-[color:var(--rl-muted)] hover:text-[color:var(--rl-text)]">
                <span>≡</span>
                Structure
              </button>
            </div>

            <div className="px-4 py-4">
              <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--rl-muted)]">Drafts</div>
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => actions.setActive(tab.id)}
                      className={`relative flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] ${
                        isActive
                          ? 'bg-[#2a2a2d] text-[color:var(--rl-text)]'
                          : 'text-[color:var(--rl-muted)] hover:bg-[color:var(--rl-panel)] hover:text-[color:var(--rl-text)]'
                      }`}
                    >
                      {isActive && <span className="absolute bottom-0 left-0 top-0 w-[2px] bg-[color:var(--rl-accent)]" aria-hidden="true" />}
                      <span className="truncate pl-2">{tab.title || 'Untitled'}</span>
                      {tab.isDirty && <span className="text-[10px] text-[color:var(--rl-accent)]">●</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-auto space-y-4 px-8 pb-8">
              <button
                type="button"
                onClick={actions.newTab}
                className="inline-flex w-full items-center justify-center rounded-[6px] bg-[color:var(--rl-accent)] px-2 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black"
              >
                New Verse
              </button>
              <button type="button" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--rl-muted)] hover:text-[color:var(--rl-text)]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--rl-border)]">?</span>
                Help
              </button>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-start px-6 pt-6 md:px-10">
              <div className="hidden w-20 shrink-0 pt-20 text-[11px] uppercase tracking-[0.2em] text-[color:var(--rl-muted)] xl:block">
                <div className="mb-8">
                  <div className="mb-2 text-[color:var(--rl-dim)]">BPM</div>
                  <div className="text-lg normal-case tracking-normal text-[color:var(--rl-muted)]">92</div>
                </div>
                <div>
                  <div className="mb-2 text-[color:var(--rl-dim)]">Key</div>
                  <div className="text-lg normal-case tracking-normal text-[color:var(--rl-muted)]">Am</div>
                </div>
              </div>
              <div className="min-h-0 w-full max-w-[960px]">
                <Editor
                  ref={editorRef}
                  hydrated={ready}
                  text={activeTab?.snapshot.text ?? ''}
                  onTextChange={handleTextChange}
                  onDirtyChange={handleDirtyChange}
                />
              </div>
            </div>

            <footer className="mx-6 border-t border-[color:var(--rl-border)] py-4 text-[11px] uppercase tracking-[0.1em] text-[color:var(--rl-muted)] md:mx-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                  <div>
                    <div className="mb-1 text-[color:var(--rl-dim)]">Rhyme Scheme</div>
                    <div className="flex items-center gap-1">
                      <span className="border border-[color:var(--rl-accent)] bg-[color:var(--rl-accent)]/10 px-2 py-1 text-[color:var(--rl-accent)]">A</span>
                      <span className="border border-[color:var(--rl-border)] px-2 py-1">B</span>
                      <span className="border border-[color:var(--rl-border)] px-2 py-1">B</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[color:var(--rl-dim)]">Sync Status</div>
                    <div className={saveStatus === 'idle' ? 'text-[color:var(--rl-accent)]' : ''}>{saveDisplayLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span>{wordCount} Words</span>
                  <span>UTF-8</span>
                </div>
              </div>
            </footer>
          </div>

          <RhymePanel ref={floatingPanelRef} editorRef={editorRef} />
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {saveLiveLabel}
      </span>
    </div>
  )
}
