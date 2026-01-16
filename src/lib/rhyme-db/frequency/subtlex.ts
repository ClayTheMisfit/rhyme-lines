type SubtlexEntry = {
  word: string
  count: number
}

const normalizeWord = (word: string) => word.trim().toLowerCase()

const isProperLike = (word: string) => {
  if (!word) return false
  if (word === word.toLowerCase()) return false
  return /^[A-Z]/.test(word)
}

export const buildFrequencyMaps = ({ topN = 50000 }: { topN?: number } = {}) => {
  const dataset = require('subtlex-word-frequencies') as SubtlexEntry[]
  const entries = dataset.slice().sort((a, b) => b.count - a.count)
  const rankByWord = new Map<string, number>()
  const properLike = new Set<string>()

  for (const entry of entries) {
    const normalized = normalizeWord(entry.word)
    if (!normalized) continue
    if (!rankByWord.has(normalized)) {
      rankByWord.set(normalized, rankByWord.size + 1)
    }
    if (isProperLike(entry.word) && normalized !== 'i') {
      properLike.add(normalized)
    }
  }

  return { rankByWord, properLike, topN }
}
