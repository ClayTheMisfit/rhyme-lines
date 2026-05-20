// Quick test script to verify serialization functions
async function main() {
  const { pathToFileURL } = await import('node:url')
  const { JSDOM } = await import('jsdom')

  // Mock DOM environment
  const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <div id="editor">Line 1<br>Line 2<br>Line 3</div>
</body>
</html>
`)

  globalThis.document = dom.window.document
  globalThis.window = dom.window
  globalThis.Node = dom.window.Node
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.Element = dom.window.Element

  // Import our functions
  const { tsImport } = await import('tsx/esm/api')
  const { serializeFromEditor, hydrateEditorFromText } = await tsImport(
    './src/lib/editor/serialization.ts',
    pathToFileURL(__filename).toString()
  )

  // Test serialization
  const editor = document.getElementById('editor')
  if (!editor) {
    throw new Error('Expected #editor fixture element to exist before serialization')
  }
  console.log('Original HTML:', editor.innerHTML)

  const serialized = serializeFromEditor(editor)
  console.log('Serialized:', JSON.stringify(serialized))

  // Test hydration
  const newEditor = document.createElement('div')
  hydrateEditorFromText(newEditor, serialized)
  console.log('Hydrated HTML:', newEditor.innerHTML)

  // Test round-trip
  const roundTrip = serializeFromEditor(newEditor)
  console.log('Round-trip:', JSON.stringify(roundTrip))
  console.log('Round-trip matches:', serialized === roundTrip)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
