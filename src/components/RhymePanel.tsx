'use client'

import { forwardRef, useEffect, useState } from 'react'
import { setupCaretListener } from '@/lib/editor/getActiveWord'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { RhymeSuggestionsPanel } from './rhyme/RhymeSuggestionsPanel'

const RhymePanel = forwardRef<HTMLDivElement>((_, ref) => {
  const { isOpen, close } = useRhymePanel((state) => ({
    isOpen: state.isOpen,
    close: state.close,
  }))
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null)

  const focusEditor = () => {
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
    close()
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
      isOpen={isOpen}
      onClose={handleClose}
      activeWord={activeWord}
      ref={ref}
    />
  )
})

RhymePanel.displayName = 'RhymePanel'

export default RhymePanel
