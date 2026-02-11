import { useCallback, useMemo, useRef } from 'react'

type Source = 'input' | 'paste' | 'drop' | 'program'

type UseEditorInputArgs = {
  commitEditorChange: (source?: Source) => void
  onShortcutKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onBeforeInsertIntoPlaceholder: () => void
  onFocusChange: (focused: boolean) => void
  scheduleMeasurement: () => void
  logDebugEvent: (type: string, payload: Record<string, unknown>) => void
}

export function useEditorInput({
  commitEditorChange,
  onShortcutKeyDown,
  onBeforeInsertIntoPlaceholder,
  onFocusChange,
  scheduleMeasurement,
  logDebugEvent,
}: UseEditorInputArgs) {
  const isComposingRef = useRef(false)

  const scheduleAnalysis = useCallback((source: Source = 'input') => {
    if (isComposingRef.current) return
    commitEditorChange(source)
    scheduleMeasurement()
  }, [commitEditorChange, scheduleMeasurement])

  const handlers = useMemo(
    () => ({
      onBeforeInput: (event: React.FormEvent<HTMLDivElement>) => {
        const nativeEvent = event.nativeEvent as InputEvent
        const inputType = typeof nativeEvent?.inputType === 'string' ? nativeEvent.inputType : ''
        logDebugEvent('beforeinput', { inputType, data: nativeEvent?.data ?? null })
        if (inputType && !inputType.startsWith('insert')) return
        onBeforeInsertIntoPlaceholder()
      },
      onInput: (event: React.FormEvent<HTMLDivElement>) => {
        const nativeEvent = event.nativeEvent as InputEvent
        logDebugEvent('input', { inputType: nativeEvent?.inputType ?? '', data: nativeEvent?.data ?? null })
        if (isComposingRef.current) return
        commitEditorChange('input')
      },
      onKeyDown: onShortcutKeyDown,
      onFocus: () => onFocusChange(true),
      onBlur: () => {
        onFocusChange(false)
        commitEditorChange('input')
      },
      onCompositionStart: () => {
        isComposingRef.current = true
      },
      onCompositionEnd: () => {
        isComposingRef.current = false
        scheduleAnalysis('input')
      },
    }),
    [commitEditorChange, logDebugEvent, onBeforeInsertIntoPlaceholder, onFocusChange, onShortcutKeyDown, scheduleAnalysis]
  )

  return { handlers, scheduleAnalysis, isComposingRef }
}
