'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type EditorHandle } from './Editor'
import RhymePanel from './RhymePanel'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'
import { useAutosave } from '@/hooks/useAutosave'
import { useAutosaveStore } from '@/store/autosaveStore'
import StatusBar from '@/components/StatusBar'
import { trackEvent } from '@/lib/analytics/events'

/**
 * Render the editor shell that coordinates the lyric Editor and RhymePanel, manages hydration, focus, keyboard shortcuts, click-outside behavior, and autosave status.
 *
 * Mounts after route-level app hydration, then coordinates the Editor and RhymePanel, focus helpers, keyboard shortcuts, click-outside behavior, and autosave status.
 *
 * @returns The EditorShell React element
 */
export default function EditorShell() {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const floatingPanelRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const [cursor, setCursor] = useState<{ line: number; column: number } | null>(null)
  const ready = true
  const lastTextActivityAtRef = useRef(0)
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


  useEffect(() => {
    setCursor(null)
  }, [activeTabId])

  useEffect(() => {
    if (!ready) return
    trackEvent('app_loaded')
  }, [ready])

  useEffect(() => {
    if (!ready || !activeTabId) return
    trackEvent('draft_opened', { source: 'editor_shell' })
  }, [activeTabId, ready])

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

  const handleSaved = useCallback(() => {
    useTabsStore.getState().actions.markAllClean()
  }, [])

  const { markTextChanged } = useAutosave({ onSaved: handleSaved })

  const handleTextChange = useCallback(
    (text: string) => {
      if (!activeTab) return
      if (text === activeTab.snapshot.text) return
      actions.updateSnapshot(activeTab.id, { text })
      actions.markDirty(activeTab.id, true)
      const now = Date.now()
      if (now - lastTextActivityAtRef.current > 15000) {
        lastTextActivityAtRef.current = now
        trackEvent('text_activity')
      }
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
    <div ref={shellRef} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {!ready ? (
        <div className="flex h-full w-full flex-1 min-h-0" aria-hidden />
      ) : (
        <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden">
          <Editor
            ref={editorRef}
            documentId={activeTab?.id ?? 'editor-empty'}
            hydrated={ready}
            text={activeTab?.snapshot.text ?? ''}
            onCursorChange={setCursor}
            onTextChange={handleTextChange}
            onDirtyChange={handleDirtyChange}
          />
          <RhymePanel ref={floatingPanelRef} editorRef={editorRef} />
          <StatusBar documentId={activeTab?.id ?? null} text={activeTab?.snapshot.text ?? ''} cursor={cursor} />
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {saveLiveLabel}
      </span>
    </div>
  )
}
