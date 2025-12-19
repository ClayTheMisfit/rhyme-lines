import { resolveEditorShortcut } from '@/lib/editor/shortcuts'

const baseEvent = {
  key: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  defaultPrevented: false,
}

const buildEvent = (overrides: Partial<typeof baseEvent>) => ({
  ...baseEvent,
  ...overrides,
})

describe('resolveEditorShortcut', () => {
  it('ignores normal typing keys', () => {
    expect(resolveEditorShortcut(buildEvent({ key: 'a' }))).toBeNull()
    expect(resolveEditorShortcut(buildEvent({ key: 'Backspace' }))).toBeNull()
  })

  it('detects owned shortcuts only', () => {
    expect(resolveEditorShortcut(buildEvent({ key: 'k', ctrlKey: true }))).toBe('palette')
    expect(resolveEditorShortcut(buildEvent({ key: 'K', metaKey: true }))).toBe('palette')
    expect(resolveEditorShortcut(buildEvent({ key: 'j', ctrlKey: true }))).toBe('theme')
    expect(resolveEditorShortcut(buildEvent({ key: 's', metaKey: true }))).toBe('export')
    expect(resolveEditorShortcut(buildEvent({ key: 'r', altKey: true }))).toBe('rhymes')
  })

  it('respects default prevention', () => {
    expect(resolveEditorShortcut(buildEvent({ key: 'k', ctrlKey: true, defaultPrevented: true }))).toBeNull()
  })
})
