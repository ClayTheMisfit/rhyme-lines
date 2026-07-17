import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { normalizeThesaurusResults } from '@/lib/thesaurus/normalizeThesaurusResults'
import type { DatamusePartOfSpeech, RawThesaurusConcept, ThesaurusResult } from '@/lib/thesaurus/types'

const DATAMUSE_BASE = 'https://api.datamuse.com/words'
const RAW_LIMIT = 40
const DATAMUSE_PARTS_OF_SPEECH = new Set<DatamusePartOfSpeech>(['n', 'v', 'adj', 'adv', 'u'])

interface DatamuseThesaurusResponse {
  word?: unknown
  score?: unknown
  tags?: unknown
}

const extractFrequency = (tags: unknown): number | undefined => {
  if (!Array.isArray(tags)) return undefined
  const tag = tags.find((item): item is string => typeof item === 'string' && item.startsWith('f:'))
  if (!tag) return undefined
  const parsed = Number.parseFloat(tag.slice(2))
  return Number.isFinite(parsed) ? parsed : undefined
}

const extractPartOfSpeech = (tags: unknown): DatamusePartOfSpeech | undefined => {
  if (!Array.isArray(tags)) return undefined
  return tags.find((item): item is DatamusePartOfSpeech => (
    typeof item === 'string' && DATAMUSE_PARTS_OF_SPEECH.has(item as DatamusePartOfSpeech)
  ))
}

const fetchRelationship = async (
  target: string,
  relationship: 'synonym' | 'related',
  signal?: AbortSignal
): Promise<RawThesaurusConcept[]> => {
  const url = new URL(DATAMUSE_BASE)
  url.searchParams.set(relationship === 'synonym' ? 'rel_syn' : 'ml', target)
  url.searchParams.set('md', 'fp')
  url.searchParams.set('max', String(RAW_LIMIT))

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error(`Datamuse thesaurus request failed: HTTP ${response.status}`)
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('Datamuse thesaurus response was malformed')

  return (data as DatamuseThesaurusResponse[]).flatMap((item) => {
    if (typeof item.word !== 'string') return []
    return [{
      word: item.word,
      relationship,
      score: typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : 0,
      source: 'datamuse' as const,
      partOfSpeech: extractPartOfSpeech(item.tags),
      frequency: extractFrequency(item.tags),
    }]
  })
}

/**
 * Fetches Datamuse synonym and meaning-related concepts, then normalizes them
 * into the thesaurus domain without exposing raw API records to the UI.
 */
export async function fetchDatamuseThesaurus(target: string, signal?: AbortSignal): Promise<ThesaurusResult> {
  const normalizedTarget = normalizeToken(target)
  if (!normalizedTarget) return normalizeThesaurusResults('', [])

  const [synonyms, related] = await Promise.all([
    fetchRelationship(normalizedTarget, 'synonym', signal),
    fetchRelationship(normalizedTarget, 'related', signal),
  ])

  return normalizeThesaurusResults(normalizedTarget, [...synonyms, ...related])
}
