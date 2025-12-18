'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import Editor from './Editor'
import RhymePanel from './RhymePanel'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'

export default function EditorShell() {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const floatingPanelRef = useRef<HTMLDivElement | null>(null)
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
    actions.hydrate()
  }, [actions])

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

  const handleTextChange = useCallback(
    (text: string) => {
      if (!activeTab) return
      actions.updateSnapshot(activeTab.id, { text })
      actions.markDirty(activeTab.id, true)
    },
    [actions, activeTab]
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
      <div className="flex h-full w-full flex-1 min-h-0">
        <Editor text={activeTab?.snapshot.text ?? ''} onTextChange={handleTextChange} onDirtyChange={handleDirtyChange} />
        <RhymePanel ref={floatingPanelRef} />
      </div>
    </div>
  )
}
