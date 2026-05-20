import { isEditableShortcutTarget } from '@/lib/shortcuts/keyboard'

describe('isEditableShortcutTarget', () => {
  it('returns true for form fields', () => {
    expect(isEditableShortcutTarget(document.createElement('input'))).toBe(true)
    expect(isEditableShortcutTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableShortcutTarget(document.createElement('select'))).toBe(true)
  })

  it('returns true for contenteditable elements and descendants', () => {
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const child = document.createElement('span')
    editable.appendChild(child)

    expect(isEditableShortcutTarget(editable)).toBe(true)
    expect(isEditableShortcutTarget(child)).toBe(true)
  })

  it('returns true for textbox roles', () => {
    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')
    const child = document.createElement('span')
    textbox.appendChild(child)

    expect(isEditableShortcutTarget(textbox)).toBe(true)
    expect(isEditableShortcutTarget(child)).toBe(true)
  })

  it('returns false for non-editable targets', () => {
    expect(isEditableShortcutTarget(document.createElement('button'))).toBe(false)
    expect(isEditableShortcutTarget(window)).toBe(false)
    expect(isEditableShortcutTarget(null)).toBe(false)
  })
})
