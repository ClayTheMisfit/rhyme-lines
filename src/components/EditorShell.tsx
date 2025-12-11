'use client'

import { useCallback, useRef } from 'react'
import Editor from './Editor'
import RhymePanel from './RhymePanel'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useRhymePanel } from '@/lib/state/rhymePanel'

export default function EditorShell() {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const { isOpen, close } = useRhymePanel((state) => ({
    isOpen: state.isOpen,
    close: state.close,
  }))

  const handleClickOutside = useCallback(() => {
    if (!isOpen) return
    close()
  }, [close, isOpen])

  useClickOutside(shellRef, handleClickOutside)

  return (
    <div ref={shellRef} className="relative flex h-full w-full">
      <Editor />
      <RhymePanel />
    </div>
  )
}
