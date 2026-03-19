import { LRUCache } from '@/lib/cache/lru'

export type PronunciationSource = 'override' | 'cmu' | 'heuristic'

export type Pronunciation = {
  word: string
  normalized: string
  phones: string[]
  syllables: number
  rhymeKey: string
  source: PronunciationSource
}

const STRESS_DIGIT_REGEX = /\d/g
const VOWEL_PHONE_REGEX = /^[A-Z]{2}\d?$/

const OVERRIDE_PHONES: Record<string, string[]> = {
  height: ['HH', 'AY1', 'T'],
  resign: ['R', 'IH0', 'Z', 'AY1', 'N'],
  line: ['L', 'AY1', 'N'],
  tune: ['T', 'UW1', 'N'],
  yall: ['Y', 'AO1', 'L'],
}

const CMU_PRONUNCIATIONS: Record<string, string[]> = {
  fine: ['F', 'AY1', 'N'],
  moon: ['M', 'UW1', 'N'],
  soon: ['S', 'UW1', 'N'],
  light: ['L', 'AY1', 'T'],
  night: ['N', 'AY1', 'T'],
  sight: ['S', 'AY1', 'T'],
  its: ['IH1', 'T', 'S'],
  were: ['W', 'ER1'],
  dogs: ['D', 'AO1', 'G', 'Z'],
  cat: ['K', 'AE1', 'T'],
  hat: ['HH', 'AE1', 'T'],
}

const cache = new LRUCache<string, Pronunciation>(10_000)

export function normalizeApostrophes(s: string): string {
  return s.replace(/[\u2018\u2019]/g, "'")
}

const basicNormalize = (token: string): string =>
  token
    .trim()
    .toLowerCase()
    .replace(/^[^a-z'’‘]+|[^a-z'’‘]+$/g, '')

export function normalizeWord(token: string): string {
  const candidates = getLookupCandidates(token)
  return candidates[0] ?? ''
}

export function getLookupCandidates(token: string): string[] {
  const t0 = basicNormalize(token)
  const t1 = normalizeApostrophes(t0)
  if (!t1) return []

  const out: string[] = [t1]
  const hasApostrophe = t1.includes("'")

  if (hasApostrophe) {
    if (t1.endsWith("'s") && t1.length > 2) {
      out.push(t1.slice(0, -2))
    }
    if (t1.endsWith("s'") && t1.length > 1) {
      out.push(t1.slice(0, -1))
    }
    out.push(t1.replace(/'/g, ''))
  }

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const cand of out) {
    if (!cand) continue
    if (seen.has(cand)) continue
    seen.add(cand)
    deduped.push(cand)
  }
  return deduped
}

const isAlphabeticToken = (token: string) => /^[a-z']+$/i.test(token) && /[a-z]/i.test(token)

const stripStress = (phone: string) => phone.replace(STRESS_DIGIT_REGEX, '')

const hasStress = (phone: string, stress: '1' | '2' | '0') => new RegExp(`${stress}$`).test(phone)

const isVowelPhone = (phone: string) => VOWEL_PHONE_REGEX.test(phone) && /[AEIOU]/.test(stripStress(phone))

export function computeRhymeKey(phones: string[]): string {
  if (!phones.length) return ''

  const findLastStress = (stress: '1' | '2' | '0') => {
    for (let index = phones.length - 1; index >= 0; index -= 1) {
      const phone = phones[index]
      if (isVowelPhone(phone) && hasStress(phone, stress)) return index
    }
    return -1
  }

  const stressed = findLastStress('1')
  const secondary = findLastStress('2')

  let lastVowel = -1
  for (let index = phones.length - 1; index >= 0; index -= 1) {
    if (isVowelPhone(phones[index])) {
      lastVowel = index
      break
    }
  }

  const target = stressed !== -1 ? stressed : secondary !== -1 ? secondary : lastVowel

  if (target === -1) return ''

  return phones
    .slice(target)
    .map((phone) => stripStress(phone))
    .join('-')
}

const estimateSyllables = (word: string) => {
  const core = word.replace(/e\b/, '')
  const vowelGroups = core.match(/[aeiouy]+/g)
  return Math.max(1, vowelGroups?.length ?? 0)
}

const computeSpellingRhymeKey = (normalized: string) => {
  if (normalized.endsWith('ight')) return 'AY-T'
  const silentENormalized = normalized.replace(/e$/, '')
  const tail = silentENormalized.slice(-4)
  return tail || silentENormalized || normalized
}

export function getPronunciation(token: string): Pronunciation {
  const candidates = getLookupCandidates(token)
  const fallbackNormalized = candidates[0] ?? ''

  if (!fallbackNormalized) {
    return { word: token, normalized: '', phones: [], syllables: 0, rhymeKey: '', source: 'heuristic' }
  }

  for (const candidate of candidates) {
    const cached = cache.get(candidate)
    if (cached) {
      return { ...cached, word: token, phones: [...cached.phones] }
    }

    const override = OVERRIDE_PHONES[candidate]
    if (override) {
      const overridePhones = [...override]
      const value: Pronunciation = {
        word: token,
        normalized: candidate,
        phones: overridePhones,
        syllables: Math.max(1, overridePhones.reduce((count, phone) => (isVowelPhone(phone) ? count + 1 : count), 0)),
        rhymeKey: computeRhymeKey(overridePhones),
        source: 'override',
      }
      cache.set(candidate, { ...value, phones: [...overridePhones] })
      return { ...value, phones: [...overridePhones] }
    }

    const cmu = CMU_PRONUNCIATIONS[candidate]
    if (cmu) {
      const cmuPhones = [...cmu]
      const value: Pronunciation = {
        word: token,
        normalized: candidate,
        phones: cmuPhones,
        syllables: Math.max(1, cmuPhones.reduce((count, phone) => (isVowelPhone(phone) ? count + 1 : count), 0)),
        rhymeKey: computeRhymeKey(cmuPhones),
        source: 'cmu',
      }
      cache.set(candidate, { ...value, phones: [...cmuPhones] })
      return { ...value, phones: [...cmuPhones] }
    }
  }

  let syllables = estimateSyllables(fallbackNormalized)
  if (isAlphabeticToken(fallbackNormalized)) {
    syllables = Math.max(1, syllables)
  }

  const value: Pronunciation = {
    word: token,
    normalized: fallbackNormalized,
    phones: [],
    syllables,
    rhymeKey: computeSpellingRhymeKey(fallbackNormalized),
    source: 'heuristic',
  }

  cache.set(fallbackNormalized, { ...value, phones: [...value.phones] })
  return { ...value, phones: [...value.phones] }
}
