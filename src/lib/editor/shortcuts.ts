export type EditorShortcut = 'palette' | 'theme' | 'rhymes' | 'export'

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'defaultPrevented'>

export function resolveEditorShortcut(event: KeyLike): EditorShortcut | null {
  if (event.defaultPrevented) return null

  const key = event.key.toLowerCase()
  const hasPrimaryModifier = event.metaKey || event.ctrlKey

  if (hasPrimaryModifier && key === 'k') return 'palette'
  if (hasPrimaryModifier && key === 'j') return 'theme'
  if (hasPrimaryModifier && key === 's') return 'export'
  if (!hasPrimaryModifier && event.altKey && key === 'r') return 'rhymes'

  return null
}
