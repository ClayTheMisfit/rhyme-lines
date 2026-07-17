import { isEnglishWord } from '@/lib/rhyme-db/isEnglishWord'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import type { RawThesaurusConcept, ThesaurusConcept, ThesaurusResult } from '@/lib/thesaurus/types'

export const THESAURUS_SYNONYM_LIMIT = 8
export const THESAURUS_RELATED_LIMIT = 12
export const THESAURUS_COMBINED_LIMIT = 20

const normalizeDisplayWord = (word: string) => word.trim().replace(/\s+/g, ' ')
const isSingleUsableWord = (word: string, normalized: string) =>
  Boolean(normalized) &&
  !/[\s_]/.test(word) &&
  /^[a-z][a-z'-]*$/i.test(word) &&
  isEnglishWord(normalized)

/**
 * Produces deterministic, bounded, single-word thesaurus groups for a target.
 * Synonyms win over duplicate related concepts and lyric target echoes are excluded.
 */
export function normalizeThesaurusResults(target: string, rawConcepts: RawThesaurusConcept[]): ThesaurusResult {
  const normalizedTarget = normalizeToken(target)
  const byWord = new Map<string, ThesaurusConcept>()

  for (const raw of rawConcepts) {
    const word = normalizeDisplayWord(raw.word)
    const normalizedWord = normalizeToken(word)
    if (!isSingleUsableWord(word, normalizedWord)) continue
    if (normalizedWord === normalizedTarget) continue

    const score = Number.isFinite(raw.score) ? Math.max(0, Number(raw.score)) : 0
    const existing = byWord.get(normalizedWord)
    if (existing) {
      if (existing.relationship === 'synonym') {
        byWord.set(normalizedWord, { ...existing, score: Math.max(existing.score, score) })
      } else if (raw.relationship === 'synonym') {
        byWord.set(normalizedWord, {
          ...existing,
          word,
          relationship: 'synonym',
          score: Math.max(existing.score, score),
          partOfSpeech: raw.partOfSpeech ?? existing.partOfSpeech,
          frequency: raw.frequency ?? existing.frequency,
        })
      } else {
        byWord.set(normalizedWord, { ...existing, score: Math.max(existing.score, score) })
      }
      continue
    }

    byWord.set(normalizedWord, {
      word,
      normalizedWord,
      relationship: raw.relationship,
      score,
      source: raw.source,
      partOfSpeech: raw.partOfSpeech,
      frequency: raw.frequency,
    })
  }

  const sorted = Array.from(byWord.values()).sort((a, b) => {
    if (a.relationship !== b.relationship) return a.relationship === 'synonym' ? -1 : 1
    if (b.score !== a.score) return b.score - a.score
    if ((b.frequency ?? 0) !== (a.frequency ?? 0)) return (b.frequency ?? 0) - (a.frequency ?? 0)
    return a.normalizedWord.localeCompare(b.normalizedWord)
  })
  const synonyms = sorted.filter((item) => item.relationship === 'synonym').slice(0, THESAURUS_SYNONYM_LIMIT)
  const related = sorted.filter((item) => item.relationship === 'related').slice(0, THESAURUS_RELATED_LIMIT)
  const concepts = [...synonyms, ...related].slice(0, THESAURUS_COMBINED_LIMIT)
  return { target: normalizedTarget, concepts, synonyms: concepts.filter((c) => c.relationship === 'synonym'), related: concepts.filter((c) => c.relationship === 'related') }
}
