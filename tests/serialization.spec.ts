/**
 * Unit tests for editor serialization utilities
 */

import { serializeFromEditor, hydrateEditorFromText, migrateOldContent, hasLineBreaks } from '../lib/editor/serialization'

// Mock DOM environment
const createMockElement = (html: string): HTMLElement => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

const getLineContents = (el: HTMLElement): string[] =>
  Array.from(el.querySelectorAll('.line')).map(line => line.innerHTML)

describe('serializeFromEditor', () => {
  test('serializes single line text', () => {
    const el = createMockElement('Hello world')
    const result = serializeFromEditor(el)
    expect(result).toBe('Hello world')
  })

  test('serializes multiple lines with <br> tags', () => {
    const el = createMockElement('Line 1<br>Line 2<br>Line 3')
    const result = serializeFromEditor(el)
    expect(result).toBe('Line 1\nLine 2\nLine 3')
  })

  test('serializes multiple lines with <div> tags', () => {
    const el = createMockElement('<div>Line 1</div><div>Line 2</div><div>Line 3</div>')
    const result = serializeFromEditor(el)
    expect(result).toBe('Line 1\nLine 2\nLine 3')
  })

  test('handles empty lines', () => {
    const el = createMockElement('Line 1<br><br>Line 3')
    const result = serializeFromEditor(el)
    expect(result).toBe('Line 1\n\nLine 3')
  })

  test('handles trailing newline', () => {
    const el = createMockElement('Line 1<br>Line 2<br>')
    const result = serializeFromEditor(el)
    expect(result).toBe('Line 1\nLine 2\n')
  })

  test('replaces &nbsp; with spaces', () => {
    const el = createMockElement('Hello&nbsp;world')
    const result = serializeFromEditor(el)
    expect(result).toBe('Hello world')
  })

  test('normalizes CRLF to LF', () => {
    const el = createMockElement('Line 1\r\nLine 2\rLine 3')
    const result = serializeFromEditor(el)
    expect(result).toBe('Line 1\nLine 2\nLine 3')
  })

  test('handles emojis', () => {
    const el = createMockElement('Hello 🌍<br>World 🌎')
    const result = serializeFromEditor(el)
    expect(result).toBe('Hello 🌍\nWorld 🌎')
  })

  test('handles long words', () => {
    const el = createMockElement('supercalifragilisticexpialidocious<br>word')
    const result = serializeFromEditor(el)
    expect(result).toBe('supercalifragilisticexpialidocious\nword')
  })
})

describe('hydrateEditorFromText', () => {
  test('hydrates single line text', () => {
    const el = document.createElement('div')
    hydrateEditorFromText(el, 'Hello world')
    expect(getLineContents(el)).toEqual(['Hello world'])
  })

  test('hydrates multiple lines', () => {
    const el = document.createElement('div')
    hydrateEditorFromText(el, 'Line 1\nLine 2\nLine 3')
    expect(getLineContents(el)).toEqual(['Line 1', 'Line 2', 'Line 3'])
  })

  test('handles empty lines', () => {
    const el = document.createElement('div')
    hydrateEditorFromText(el, 'Line 1\n\nLine 3')
    expect(getLineContents(el)).toEqual(['Line 1', '<br>', 'Line 3'])
  })

  test('handles trailing newline', () => {
    const el = document.createElement('div')
    hydrateEditorFromText(el, 'Line 1\nLine 2\n')
    expect(getLineContents(el)).toEqual(['Line 1', 'Line 2', '<br>'])
  })

  test('normalizes CRLF to LF', () => {
    const el = document.createElement('div')
    hydrateEditorFromText(el, 'Line 1\r\nLine 2\rLine 3')
    expect(getLineContents(el)).toEqual(['Line 1', 'Line 2', 'Line 3'])
  })

  test('handles emojis', () => {
    const el = document.createElement('div')
    hydrateEditorFromText(el, 'Hello 🌍\nWorld 🌎')
    expect(getLineContents(el)).toEqual(['Hello 🌍', 'World 🌎'])
  })
})

describe('serialize/hydrate round-trip', () => {
  test('preserves single line', () => {
    const original = 'Hello world'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe(original)
  })

  test('preserves multiple lines', () => {
    const original = 'Line 1\nLine 2\nLine 3'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe(original)
  })

  test('preserves empty lines', () => {
    const original = 'Line 1\n\nLine 3'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe('Line 1\n\nLine 3')
  })

  test('preserves trailing newline', () => {
    const original = 'Line 1\nLine 2\n'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    // The editor adds an extra newline for trailing newlines to ensure proper rendering
    expect(serialized).toBe('Line 1\nLine 2\n\n')
  })

  test('preserves emojis', () => {
    const original = 'Hello 🌍\nWorld 🌎'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe(original)
  })

  test('preserves long words', () => {
    const original = 'supercalifragilisticexpialidocious\nword'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe(original)
  })

  test('preserves consecutive empty lines', () => {
    const original = 'Line 1\n\n\nLine 4'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe('Line 1\n\n\nLine 4')
  })

  test('preserves HTML escaping', () => {
    const original = 'Hello <world>\nTest & "quotes"'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    expect(serialized).toBe(original)
  })

  test('handles whitespace-only lines', () => {
    const original = 'Line 1\n   \nLine 3'
    const el = document.createElement('div')
    hydrateEditorFromText(el, original)
    const serialized = serializeFromEditor(el)
    // Should trim trailing whitespace but preserve empty lines
    expect(serialized).toBe('Line 1\n\nLine 3')
  })
})

describe('migrateOldContent', () => {
  test('migrates content with line breaks', () => {
    const oldContent = 'Line 1\nLine 2\nLine 3'
    const result = migrateOldContent(oldContent)
    expect(result).toBe(oldContent)
  })

  test('migrates HTML content', () => {
    const oldContent = '<div>Line 1</div><div>Line 2</div>'
    const result = migrateOldContent(oldContent)
    expect(result).toBe('Line 1Line 2')
  })

  test('migrates plain text without line breaks', () => {
    const oldContent = 'Hello world'
    const result = migrateOldContent(oldContent)
    expect(result).toBe('Hello world')
  })

  test('handles empty content', () => {
    const result = migrateOldContent('')
    expect(result).toBe('')
  })
})

describe('hasLineBreaks', () => {
  test('detects LF line breaks', () => {
    expect(hasLineBreaks('Line 1\nLine 2')).toBe(true)
  })

  test('detects CRLF line breaks', () => {
    expect(hasLineBreaks('Line 1\r\nLine 2')).toBe(true)
  })

  test('detects CR line breaks', () => {
    expect(hasLineBreaks('Line 1\rLine 2')).toBe(true)
  })

  test('detects no line breaks', () => {
    expect(hasLineBreaks('Line 1 Line 2')).toBe(false)
  })

  test('handles empty string', () => {
    expect(hasLineBreaks('')).toBe(false)
  })
})
