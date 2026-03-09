import { useCallback } from 'react'
import { normalizePastedText } from './normalizePastedText'

type UseEditorClipboardArgs = {
  insertPlainText: (text: string) => boolean
  scheduleSyncFromDom: (source: 'paste' | 'drop') => void
}

export function useEditorClipboard({ insertPlainText, scheduleSyncFromDom }: UseEditorClipboardArgs) {
  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const clipboardText = event.clipboardData?.getData('text/plain') ?? ''
      if (!clipboardText) return
      event.preventDefault()
      const normalized = normalizePastedText(clipboardText)
      if (!normalized) return
      insertPlainText(normalized)
      scheduleSyncFromDom('paste')
    },
    [insertPlainText, scheduleSyncFromDom]
  )

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const droppedText = event.dataTransfer?.getData('text/plain') ?? ''
      if (!droppedText) return
      insertPlainText(droppedText)
      scheduleSyncFromDom('drop')
    },
    [insertPlainText, scheduleSyncFromDom]
  )

  return { onPaste, onDragOver, onDrop }
}
