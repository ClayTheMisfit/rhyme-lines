'use client'

import { forwardRef, useCallback, useEffect, useState, type RefObject } from 'react'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { RhymeSuggestionsPanel } from './rhyme/RhymeSuggestionsPanel'
import type { EditorHandle } from './Editor'
import { getEditorLineElements, getEditorPlainText, getEditorPlainTextIndexFromSelection, getLinePlainText } from '@/lib/editor/plainText'
import { resolveRhymeTarget, type RhymeTargetRange } from '@/lib/editor/rhymeReplacement'

const DEBUG_RHYME_TARGET = process.env.NEXT_PUBLIC_DEBUG_RHYME_TARGET === '1'

type RhymePanelProps = {
  editorRef?: RefObject<EditorHandle | null>
}

const RhymePanel = forwardRef<HTMLDivElement, RhymePanelProps>(({ editorRef }, ref) => {
  const { mode, setMode } = useRhymePanel((state) => ({
    mode: state.mode,
    setMode: state.setMode,
  }))
  const [editorSnapshot, setEditorSnapshot] = useState({
    text: '',
    caretIndex: 0,
    currentLineText: '',
    activeLineRect: null as { top: number; left: number; width: number; height: number } | null,
    editorLaneRect: null as { top: number; left: number; width: number; height: number } | null,
    targetRange: null as RhymeTargetRange | null,
  })

  const focusEditor = () => {
    if (editorRef?.current) {
      editorRef.current.focus()
      return
    }
    const editorElement = document.getElementById('lyric-editor')
    if (!editorElement) return

    editorElement.focus()

    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    range.selectNodeContents(editorElement)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const handleClose = () => {
    setMode('hidden')
    focusEditor()
  }

  const readEditorSnapshot = useCallback((
    editorElement: HTMLElement,
    previous?: {
      caretIndex: number
      currentLineText: string
      activeLineRect: { top: number; left: number; width: number; height: number } | null
      targetRange?: RhymeTargetRange | null
    }
  ) => {
    const text = getEditorPlainText(editorElement)
    const selection = window.getSelection()
    const previousHasSelection = Boolean(previous?.currentLineText || previous?.activeLineRect || previous?.caretIndex)
    let hasEditorSelection = false
    let caretIndex = previous?.caretIndex ?? 0
    let currentLineText = previous?.currentLineText ?? ''
    let activeLineRect: { top: number; left: number; width: number; height: number } | null = previous?.activeLineRect ?? null

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const focusNode = selection.focusNode ?? range.endContainer
      if (focusNode && editorElement.contains(focusNode)) {
        hasEditorSelection = true
        currentLineText = ''
        activeLineRect = null
        const caretSnapshot = getEditorPlainTextIndexFromSelection(editorElement, selection)
        caretIndex = caretSnapshot?.index ?? previous?.caretIndex ?? 0

        let node: Node | null = focusNode
        let lineElement: HTMLElement | null = null
        while (node && node !== editorElement) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (element.classList.contains('line')) {
              lineElement = element
              break
            }
          }
          node = node.parentNode
        }

        if (lineElement && lineElement.dataset.placeholderLine !== 'true') {
          currentLineText = getLinePlainText(lineElement)
          const rect = lineElement.getBoundingClientRect()
          activeLineRect = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }
        }
      }
    }

    if (!hasEditorSelection && previousHasSelection) {
      // Keep the last editor-derived caret target while focus moves through the rhyme panel.
    } else if (!currentLineText) {
      const lineElements = getEditorLineElements(editorElement)
      if (lineElements.length > 0) {
        const fallbackLine = lineElements[lineElements.length - 1]
        currentLineText = getLinePlainText(fallbackLine)
        const rect = fallbackLine.getBoundingClientRect()
        activeLineRect = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      }
    }

    if (DEBUG_RHYME_TARGET && typeof console !== 'undefined') {
      console.debug('[rhyme-target:snapshot]', {
        visibleText: text,
        editorInnerText: editorElement.innerText,
        editorTextContent: editorElement.textContent,
        canonicalDocumentText: text,
        selectionAnchorNode: selection?.anchorNode?.nodeName ?? null,
        selectionAnchorOffset: selection?.anchorOffset ?? null,
        selectionFocusNode: selection?.focusNode?.nodeName ?? null,
        selectionFocusOffset: selection?.focusOffset ?? null,
        computedCaretIndex: caretIndex,
        currentLineText,
      })
    }

    const editorLane = editorElement.closest<HTMLElement>('.editor-surface')
    const editorLaneRect = editorLane
      ? (() => {
          const rect = editorLane.getBoundingClientRect()
          return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        })()
      : null

    const targetRange = hasEditorSelection
      ? resolveRhymeTarget(text, caretIndex)
      : previous
        ? previous.targetRange ?? null
        : null
    return { text, caretIndex, currentLineText, activeLineRect, editorLaneRect, targetRange }
  }, [])

  useEffect(() => {
    const editorElement = document.getElementById('lyric-editor')
    if (!editorElement) return
    let frameId: number | null = null

    const scheduleUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        setEditorSnapshot((previous) => readEditorSnapshot(editorElement, previous))
      })
    }

    scheduleUpdate()

    editorElement.addEventListener('input', scheduleUpdate)
    editorElement.addEventListener('keyup', scheduleUpdate)
    editorElement.addEventListener('click', scheduleUpdate)
    document.addEventListener('selectionchange', scheduleUpdate)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      editorElement.removeEventListener('input', scheduleUpdate)
      editorElement.removeEventListener('keyup', scheduleUpdate)
      editorElement.removeEventListener('click', scheduleUpdate)
      document.removeEventListener('selectionchange', scheduleUpdate)
    }
  }, [readEditorSnapshot])

  return (
    <RhymeSuggestionsPanel
      mode={mode}
      onClose={handleClose}
      text={editorSnapshot.text}
      caretIndex={editorSnapshot.caretIndex}
      currentLineText={editorSnapshot.currentLineText}
      activeLineRect={editorSnapshot.activeLineRect}
      editorLaneRect={editorSnapshot.editorLaneRect}
      editorRef={editorRef}
      targetRange={editorSnapshot.targetRange}
      ref={ref}
    />
  )
})

RhymePanel.displayName = 'RhymePanel'

export default RhymePanel
