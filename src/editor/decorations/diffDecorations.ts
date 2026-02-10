import type { DecorationsByLine } from '@/editor/types'

export type DecorationPatchOp<TDecoration> =
  | { type: 'add'; lineId: string; decorations: TDecoration[] }
  | { type: 'remove'; lineId: string }
  | { type: 'update'; lineId: string; decorations: TDecoration[] }

const sameDecorations = <TDecoration>(a: TDecoration[] | undefined, b: TDecoration[] | undefined) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false
  }
  return true
}

export function diffDecorations<TDecoration>(
  prevDecorationsByLine: DecorationsByLine<TDecoration>,
  nextDecorationsByLine: DecorationsByLine<TDecoration>
): DecorationPatchOp<TDecoration>[] {
  const patch: DecorationPatchOp<TDecoration>[] = []

  for (const [lineId, prev] of prevDecorationsByLine) {
    if (!nextDecorationsByLine.has(lineId)) {
      patch.push({ type: 'remove', lineId })
      continue
    }
    const next = nextDecorationsByLine.get(lineId)
    if (!sameDecorations(prev, next)) {
      patch.push({ type: 'update', lineId, decorations: next ?? [] })
    }
  }

  for (const [lineId, next] of nextDecorationsByLine) {
    if (!prevDecorationsByLine.has(lineId)) {
      patch.push({ type: 'add', lineId, decorations: next })
    }
  }

  return patch
}
