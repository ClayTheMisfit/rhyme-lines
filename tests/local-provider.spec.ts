import { __testables } from '@/lib/rhyme/providers/local'

describe('local rhyme provider validation', () => {
  it('keeps validating consecutive generated words with vowels', () => {
    const { isValidWord } = __testables
    const generatedWords = ['mate', 'fate', 'late', 'gate', 'date']

    for (const word of generatedWords) {
      expect(isValidWord(word)).toBe(true)
    }
  })
})
