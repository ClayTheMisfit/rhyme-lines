import { applyRhymeReplacement, preserveWordCase, resolveRhymeTarget } from '@/lib/editor/rhymeReplacement'

describe('rhyme replacement', () => {
  it.each([
    ['brain,', 'pain,'],
    ['brain.', 'pain.'],
    ['brain!', 'pain!'],
    ['brain?', 'pain?'],
    ['“brain”', '“pain”'],
    ['(brain)', '(pain)'],
  ])('preserves punctuation in %s', (source, expected) => {
    const target = resolveRhymeTarget(source, Math.floor(source.length / 2))
    expect(target).not.toBeNull()
    expect(applyRhymeReplacement(source, target!, 'pain')?.text).toBe(expected)
  })

  it.each([
    ['brain', 'pain'],
    ['Brain', 'Pain'],
    ['BRAIN', 'PAIN'],
  ])('preserves case from %s', (source, expected) => {
    expect(preserveWordCase(source, 'pain')).toBe(expected)
  })

  it('refuses a stale range instead of replacing unrelated text', () => {
    const target = resolveRhymeTarget('my brain', 8)!
    expect(applyRhymeReplacement('my timing', target, 'pain')).toBeNull()
  })
})
