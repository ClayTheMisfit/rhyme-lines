import { useCallback, useEffect, useRef } from 'react'
import { getActiveWord } from '@/lib/editor/getActiveWord'
import type { SelectionSnapshot } from '@/editor/types'
import { serializeSelection } from './serializeSelection'
import { restoreSelection } from './restoreSelection'

type CaretWord = { word: string; startOffset: number; endOffset: number }

type UseEditorSelectionArgs = {
  editorRef: React.RefObject<HTMLDivElement | null>
  onSelectionChange?: () => void
}

export function useEditorSelection({ editorRef, onSelectionChange }: UseEditorSelectionArgs) {
  const snapshotRef = useRef<SelectionSnapshot | null>(null)

  const getSnapshot = useCallback(() => {
    const root = editorRef.current
    if (!root) return null
    const snapshot = serializeSelection(root, root.ownerDocument.getSelection())
    if (snapshot) {
      snapshotRef.current = snapshot
    }
    return snapshot
  }, [editorRef])

  const restore = useCallback(
    (snapshot: SelectionSnapshot | null) => {
      const root = editorRef.current
      if (!root) return
      restoreSelection(root, snapshot)
    },
    [editorRef]
  )

  const getCaretWord = useCallback((): CaretWord | null => {
    const root = editorRef.current
    if (!root) return null
    const active = getActiveWord(root)
    if (!active) return null
    return {
      word: active.word,
      startOffset: active.startOffset,
      endOffset: active.endOffset,
    }
  }, [editorRef])

  useEffect(() => {
    const handle = () => {
      getSnapshot()
      onSelectionChange?.()
    }
    const doc = editorRef.current?.ownerDocument ?? document
    doc.addEventListener('selectionchange', handle)
    doc.addEventListener('mouseup', handle)
    doc.addEventListener('keyup', handle)
    return () => {
      doc.removeEventListener('selectionchange', handle)
      doc.removeEventListener('mouseup', handle)
      doc.removeEventListener('keyup', handle)
    }
  }, [editorRef, getSnapshot, onSelectionChange])

  return {
    getSnapshot,
    restore,
    getCaretWord,
    snapshotRef,
  }
}
