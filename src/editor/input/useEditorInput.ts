import { useCallback, useMemo, useRef } from 'react'

type Source = 'input' | 'paste' | 'drop' | 'program'

type UseEditorInputArgs = {
  commitEditorChange: (source?: Source) => void
  onShortcutKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onFocusChange: (focused: boolean) => void
  scheduleMeasurement: () => void
  logDebugEvent: (type: string, payload: Record<string, unknown>) => void
}

/**
 * Wires editor input events to commit-and-measure actions, handling IME composition and emitting debug events.
 *
 * @param commitEditorChange - Commits the current editor change; accepts an optional source string.
 * @param onShortcutKeyDown - Handler for keydown events used to detect and handle shortcut keys.
 * @param onFocusChange - Notified with `true`/`false` when the editor gains or loses focus.
 * @param scheduleMeasurement - Schedules a layout/size measurement after changes are committed.
 * @param logDebugEvent - Records debug events with a type and payload for instrumentation.
 * @returns An object containing:
 *  - `handlers`: event handlers to attach to the editor element (beforeinput, input, keydown, focus, blur, compositionstart, compositionend),
 *  - `scheduleAnalysis`: a function to commit changes and schedule a measurement unless an IME composition is active,
 *  - `isComposingRef`: a ref whose `.current` is `true` when an IME composition is in progress and `false` otherwise.
 */
export function useEditorInput({
  commitEditorChange,
  onShortcutKeyDown,
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
    [commitEditorChange, logDebugEvent, onFocusChange, onShortcutKeyDown, scheduleAnalysis]
  )

  return { handlers, scheduleAnalysis, isComposingRef }
}