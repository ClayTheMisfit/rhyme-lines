'use client'

import { useEffect, useRef } from 'react'

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    editorRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col w-full h-screen bg-black text-white p-8">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className="relative outline-none whitespace-pre-wrap break-words w-full h-full text-lg leading-loose font-mono before:content-[attr(data-placeholder)] before:text-gray-500 before:absolute before:top-0 before:left-0 before:pointer-events-none before:opacity-50 empty:before:block"
        data-placeholder="Start writing..."
      ></div>
    </div>
  )
}
