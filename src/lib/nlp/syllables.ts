const SYLLABLE_OVERRIDES: Record<string, number> = {
  the: 1, a: 1, i: 1, you: 1, are: 1, fire: 1, hour: 1, choir: 1,
  people: 2, every: 2, evening: 3, queue: 1, queued: 1, queues: 1,
  business: 2, camera: 2, chocolate: 2, family: 2,
}

export function countSyllables(wordRaw: string): number {
  const word = wordRaw.toLowerCase().replace(/[^a-z']/g, '')
  if (!word) return 0

  // 1. Check dictionary overrides
  if (word in SYLLABLE_OVERRIDES) return SYLLABLE_OVERRIDES[word]

  // 2. Base count: Vowel groups (remove silent 'e')
  const core = word.replace(/e\b/, '')
  const vowelGroups = core.match(/[aeiouy]+/g)
  let count = vowelGroups ? vowelGroups.length : 0

  // 3. Additions (Suffixes)
  if (/(ion|ian|ious|iest|ial|tia|cius|cian|giu|uo|ie|io|ii|eo|ua)\b/.test(word)) {
    count += 1
  }
  if (/[bcdfghjklmnpqrstvwxyz]le\b/.test(word)) {
    count += 1
  }

  // 4. Edge cases
  if (/^[ai]$/.test(word)) count = 1

  return Math.max(1, count)
}
