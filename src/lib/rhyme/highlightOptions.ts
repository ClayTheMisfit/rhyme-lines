import type { RhymeHighlightMode } from '@/lib/persist/schema'

export function resolveInternalRhymesEnabled(
  showInternalRhymes: boolean,
  highlightMode: RhymeHighlightMode
): boolean {
  return showInternalRhymes || highlightMode === 'all'
}
