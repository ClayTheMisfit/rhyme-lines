export type EditorShortcut = 'palette' | 'rhymes' | 'export' | 'rhymeHighlightMode'

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'defaultPrevented'>

export function resolveEditorShortcut(event: KeyLike): EditorShortcut | null {
  if (event.defaultPrevented) return null

  const key = event.key.toLowerCase()
  const hasPrimaryModifier = event.metaKey || event.ctrlKey

  if (hasPrimaryModifier && key === 'k') return 'palette'
  if (hasPrimaryModifier && key === 's') return 'export'
  if (!hasPrimaryModifier && event.altKey && key === 'r') return 'rhymes'
  if (!hasPrimaryModifier && event.altKey && key === 'h') return 'rhymeHighlightMode'

  return null
}
