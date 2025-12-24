'use client'

import { forwardRef, useEffect, useState, type RefObject } from 'react'
import { setupCaretListener } from '@/lib/editor/getActiveWord'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { RhymeSuggestionsPanel } from './rhyme/RhymeSuggestionsPanel'
import type { EditorHandle } from './Editor'

type RhymePanelProps = {
  editorRef?: RefObject<EditorHandle | null>
}

const RhymePanel = forwardRef<HTMLDivElement, RhymePanelProps>(({ editorRef }, ref) => {
  const { mode, setMode } = useRhymePanel((state) => ({
    mode: state.mode,
    setMode: state.setMode,
  }))
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null)

  const focusEditor = () => {
    if (editorRef?.current) {
      editorRef.current.focus()
      return
    }
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
  }

  const handleClose = () => {
    setMode('hidden')
    focusEditor()
  }

  // Setup caret listener for active word detection
  useEffect(() => {
    const editorElement = document.getElementById('lyric-editor')
    if (!editorElement) return

    const cleanup = setupCaretListener(editorElement, (word) => {
      setActiveWord(word)
    })

    return cleanup
  }, [])

  return (
    <RhymeSuggestionsPanel
      mode={mode}
      onClose={handleClose}
      activeWord={activeWord}
      editorRef={editorRef}
      ref={ref}
    />
  )
})

RhymePanel.displayName = 'RhymePanel'

export default RhymePanel
