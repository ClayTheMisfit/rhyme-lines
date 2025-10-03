'use client'

import { useState, useEffect } from 'react'
import { setupCaretListener } from '@/lib/editor/getActiveWord'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { RhymeSuggestionsPanel } from './rhyme/RhymeSuggestionsPanel'

export default function RhymePanel() {
  const { isOpen, close } = useRhymePanel((state) => ({
    isOpen: state.isOpen,
    close: state.close,
  }))
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null)

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
      onClose={close}
      activeWord={activeWord}
    />
  )
}