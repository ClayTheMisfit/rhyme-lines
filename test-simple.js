// Simple test to verify the logic works
console.log('Testing multiline serialization logic...');

// Test data
const testCases = [
  {
    name: 'Single line',
    input: 'Hello world',
    expected: 'Hello world'
  },
  {
    name: 'Multiple lines with \\n',
    input: 'Line 1\nLine 2\nLine 3',
    expected: 'Line 1\nLine 2\nLine 3'
  },
  {
    name: 'Empty lines',
    input: 'Line 1\n\nLine 3',
    expected: 'Line 1\n\nLine 3'
  },
  {
    name: 'Trailing newline',
    input: 'Line 1\nLine 2\n',
    expected: 'Line 1\nLine 2\n'
  }
];

// Simulate the serialization logic
function simulateSerialize(text) {
  // Replace &nbsp; with spaces
  text = text.replace(/\u00A0/g, ' ');
  
  // Normalize line endings
  text = text.replace(/\r\n?/g, '\n');
  
  // Remove trailing whitespace from each line but preserve empty lines
  text = text.split('\n').map(line => line.trimEnd()).join('\n');
  
  return text;
}

// Simulate the hydration logic
function simulateHydrate(text) {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n?/g, '\n');
  
  // Convert \n to <br> elements
  const html = normalizedText
    .split('\n')
    .map(line => line || '<br>') // Empty lines become <br>
    .join('<br>');
  
  return html;
}

// Run tests
testCases.forEach(testCase => {
  console.log(`\n--- ${testCase.name} ---`);
  console.log('Input:', JSON.stringify(testCase.input));
  
  const serialized = simulateSerialize(testCase.input);
  console.log('Serialized:', JSON.stringify(serialized));
  
  const hydrated = simulateHydrate(serialized);
  console.log('Hydrated HTML:', hydrated);
  
  const roundTrip = simulateSerialize(hydrated.replace(/<br>/g, '\n'));
  console.log('Round-trip:', JSON.stringify(roundTrip));
  
  const matches = serialized === roundTrip;
  console.log('✅ Round-trip matches:', matches);
  
  if (!matches) {
    console.log('❌ FAILED');
  }
});

console.log('\n✅ All tests completed!');
