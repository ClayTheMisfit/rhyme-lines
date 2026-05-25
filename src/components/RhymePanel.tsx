'use client'

import { forwardRef, useCallback, useEffect, useState, type RefObject } from 'react'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { RhymeSuggestionsPanel } from './rhyme/RhymeSuggestionsPanel'
import type { EditorHandle } from './Editor'

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

  const readEditorSnapshot = useCallback((editorElement: HTMLElement) => {
    const text = (editorElement.innerText ?? editorElement.textContent ?? '').replace(/\r\n?/g, '\n')
    const selection = window.getSelection()
    let caretIndex = 0
    let currentLineText = ''
    let activeLineRect: { top: number; left: number; width: number; height: number } | null = null

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const focusNode = selection.focusNode ?? range.endContainer
      const focusOffset = selection.focusOffset ?? range.endOffset
      if (focusNode && editorElement.contains(focusNode)) {
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(editorElement)
        preCaretRange.setEnd(focusNode, focusOffset)
        caretIndex = preCaretRange.toString().length

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
          currentLineText = (lineElement.innerText ?? lineElement.textContent ?? '').replace(/\r\n?/g, '\n')
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

    if (!currentLineText) {
      const lineElements = Array.from(editorElement.querySelectorAll<HTMLElement>('.line')).filter(
        (line) => line.dataset.placeholderLine !== 'true'
      )
      if (lineElements.length > 0) {
        const fallbackLine = lineElements[lineElements.length - 1]
        currentLineText = (fallbackLine.innerText ?? fallbackLine.textContent ?? '').replace(/\r\n?/g, '\n')
        const rect = fallbackLine.getBoundingClientRect()
        activeLineRect = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      }
    }

    const editorLane = editorElement.closest<HTMLElement>('.editor-surface')
    const editorLaneRect = editorLane
      ? (() => {
          const rect = editorLane.getBoundingClientRect()
          return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        })()
      : null

    return { text, caretIndex, currentLineText, activeLineRect, editorLaneRect }
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
        setEditorSnapshot(readEditorSnapshot(editorElement))
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
      ref={ref}
    />
  )
})

RhymePanel.displayName = 'RhymePanel'

export default RhymePanel
