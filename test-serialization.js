// Quick test script to verify serialization functions
const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <div id="editor">Line 1<br>Line 2<br>Line 3</div>
</body>
</html>
`);

global.document = dom.window.document;
global.window = dom.window;

// Import our functions
const { serializeFromEditor, hydrateEditorFromText } = require('./lib/editor/serialization.ts');

// Test serialization
const editor = document.getElementById('editor');
console.log('Original HTML:', editor.innerHTML);

const serialized = serializeFromEditor(editor);
console.log('Serialized:', JSON.stringify(serialized));

// Test hydration
const newEditor = document.createElement('div');
hydrateEditorFromText(newEditor, serialized);
console.log('Hydrated HTML:', newEditor.innerHTML);

// Test round-trip
const roundTrip = serializeFromEditor(newEditor);
console.log('Round-trip:', JSON.stringify(roundTrip));
console.log('Round-trip matches:', serialized === roundTrip);
