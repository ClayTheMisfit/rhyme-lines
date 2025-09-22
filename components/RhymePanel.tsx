'use client'

import { useState, useEffect } from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { setupCaretListener } from '@/lib/editor/getActiveWord'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import { RhymeSuggestionsPanel } from './rhyme/RhymeSuggestionsPanel'

export default function RhymePanel() {
  const { isOpen, togglePanel } = useRhymePanelStore()
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
      onClose={togglePanel}
      activeWord={activeWord}
    />
  )
}