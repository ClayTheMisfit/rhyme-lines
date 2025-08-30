'use client'

import { useEffect, useRef } from 'react'

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)

  const updatePlaceholder = () => {
    const el = editorRef.current
    if (!el) return
    const hasText = (el.textContent || '').trim().length > 0
    el.classList.toggle('show-placeholder', !hasText)
  }

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    updatePlaceholder()
  }, [])

  return (
    <div className="flex flex-col w-full h-screen bg-black text-white p-8">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder="Start writing..."
        onInput={updatePlaceholder}
        onBlur={updatePlaceholder}
        onKeyUp={updatePlaceholder}
        className="relative outline-none whitespace-pre-wrap break-words w-full h-full text-lg leading-loose font-mono"
      />
    </div>
  )
}
