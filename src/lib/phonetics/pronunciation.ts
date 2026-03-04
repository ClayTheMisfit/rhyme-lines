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
}

const CMU_PRONUNCIATIONS: Record<string, string[]> = {
  fine: ['F', 'AY1', 'N'],
  moon: ['M', 'UW1', 'N'],
  soon: ['S', 'UW1', 'N'],
  light: ['L', 'AY1', 'T'],
  night: ['N', 'AY1', 'T'],
  sight: ['S', 'AY1', 'T'],
  cat: ['K', 'AE1', 'T'],
  hat: ['HH', 'AE1', 'T'],
}

const cache = new LRUCache<string, Pronunciation>(10_000)

export function normalizeWord(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/^[^a-z']+|[^a-z']+$/g, '')
}

const isAlphabeticToken = (token: string) => /^[a-z']+$/i.test(token)

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
  const unstressed = findLastStress('0')
  const target = stressed !== -1 ? stressed : secondary !== -1 ? secondary : unstressed

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
  const silentENormalized = normalized.replace(/e$/, '')
  const tail = silentENormalized.slice(-4)
  return tail || silentENormalized || normalized
}

const lookupPhones = (normalized: string): { source: PronunciationSource; phones: string[] } | null => {
  const apostropheFree = normalized.replace(/'/g, '')
  const candidates = apostropheFree === normalized ? [normalized] : [normalized, apostropheFree]

  for (const candidate of candidates) {
    const override = OVERRIDE_PHONES[candidate]
    if (override) return { source: 'override', phones: override }
  }

  for (const candidate of candidates) {
    const cmu = CMU_PRONUNCIATIONS[candidate]
    if (cmu) return { source: 'cmu', phones: cmu }
  }

  return null
}

export function getPronunciation(token: string): Pronunciation {
  const normalized = normalizeWord(token)
  if (!normalized) {
    return { word: token, normalized: '', phones: [], syllables: 0, rhymeKey: '', source: 'heuristic' }
  }

  const cached = cache.get(normalized)
  if (cached) {
    return { ...cached, word: token }
  }

  const lookup = lookupPhones(normalized)
  const phones = lookup?.phones ?? []
  const source = lookup?.source ?? 'heuristic'

  let syllables = phones.length
    ? Math.max(1, phones.reduce((count, phone) => (isVowelPhone(phone) ? count + 1 : count), 0))
    : estimateSyllables(normalized)

  if (isAlphabeticToken(normalized)) {
    syllables = Math.max(1, syllables)
  }

  const rhymeKey = phones.length ? computeRhymeKey(phones) : computeSpellingRhymeKey(normalized)

  const value: Pronunciation = {
    word: token,
    normalized,
    phones,
    syllables,
    rhymeKey,
    source,
  }

  cache.set(normalized, value)
  return value
}
