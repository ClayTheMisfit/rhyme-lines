'use client'

import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'rhyme-lines:doc:current'
const SAVE_DELAY_MS = 250

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | null>(null)

  // Toggle placeholder visibility (don’t rely on :empty)
  const updatePlaceholder = () => {
    const el = editorRef.current
    if (!el) return
    const hasText = (el.textContent || '').trim().length > 0
    el.classList.toggle('show-placeholder', !hasText)
  }

  // Save/restore via localStorage
  const saveNow = () => {
    const el = editorRef.current
    if (!el) return
    try {
      const text = (el.textContent || '').replace(/\u00A0/g, ' ')
      localStorage.setItem(STORAGE_KEY, text)
    } catch {
      // ignore quota/privacy mode issues
    }
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(saveNow, SAVE_DELAY_MS)
  }

  const handleChange = () => {
    updatePlaceholder()
    scheduleSave()
  }

  useEffect(() => {
    const el = editorRef.current
    if (!el) return

    // Restore
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) el.textContent = saved
    } catch {}

    updatePlaceholder()
    el.focus()

    // Flush before unload
    const beforeUnload = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveNow()
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div className="flex flex-col w-full h-screen bg-black text-white p-8">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder="Start writing..."
        onInput={handleChange}
        onKeyUp={handleChange}
        onBlur={handleChange}
        className="relative outline-none whitespace-pre-wrap break-words w-full h-full text-lg leading-loose font-mono"
      />
    </div>
  )
}
