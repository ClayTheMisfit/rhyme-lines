import { useEffect, useRef, useState } from 'react'
import type { DecorationsByLine } from '@/editor/types'
import { diffDecorations, type DecorationPatchOp } from './diffDecorations'

export function useDecorationDiff<TDecoration>(decorationsByLine: DecorationsByLine<TDecoration>) {
  const prevRef = useRef<DecorationsByLine<TDecoration>>(new Map())
  const [patch, setPatch] = useState<DecorationPatchOp<TDecoration>[]>([])

  useEffect(() => {
    const nextPatch = diffDecorations(prevRef.current, decorationsByLine)
    setPatch(nextPatch)
    prevRef.current = decorationsByLine
  }, [decorationsByLine])

  return patch
}
