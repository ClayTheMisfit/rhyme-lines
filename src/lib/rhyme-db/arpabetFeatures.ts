export type VowelFeature = {
  height: 'high' | 'mid' | 'low'
  backness: 'front' | 'central' | 'back'
  rounding: 'rounded' | 'unrounded'
  tense: 'tense' | 'lax'
}

export type ConsonantFeature = {
  place:
    | 'bilabial'
    | 'labiodental'
    | 'dental'
    | 'alveolar'
    | 'postalveolar'
    | 'palatal'
    | 'velar'
    | 'glottal'
  manner: 'stop' | 'affricate' | 'fricative' | 'nasal' | 'lateral' | 'approximant'
  voicing: 'voiced' | 'voiceless'
}

export type Tail = {
  vowel: string
  coda: string[]
  lastConsonants: string[]
}

const VOWEL_FEATURES: Record<string, VowelFeature> = {
  AA: { height: 'low', backness: 'back', rounding: 'unrounded', tense: 'tense' },
  AE: { height: 'low', backness: 'front', rounding: 'unrounded', tense: 'lax' },
  AH: { height: 'mid', backness: 'central', rounding: 'unrounded', tense: 'lax' },
  AO: { height: 'mid', backness: 'back', rounding: 'rounded', tense: 'tense' },
  AW: { height: 'low', backness: 'back', rounding: 'rounded', tense: 'tense' },
  AY: { height: 'low', backness: 'front', rounding: 'unrounded', tense: 'tense' },
  EH: { height: 'mid', backness: 'front', rounding: 'unrounded', tense: 'lax' },
  ER: { height: 'mid', backness: 'central', rounding: 'rounded', tense: 'tense' },
  EY: { height: 'mid', backness: 'front', rounding: 'unrounded', tense: 'tense' },
  IH: { height: 'high', backness: 'front', rounding: 'unrounded', tense: 'lax' },
  IY: { height: 'high', backness: 'front', rounding: 'unrounded', tense: 'tense' },
  OW: { height: 'mid', backness: 'back', rounding: 'rounded', tense: 'tense' },
  OY: { height: 'mid', backness: 'back', rounding: 'rounded', tense: 'tense' },
  UH: { height: 'high', backness: 'back', rounding: 'rounded', tense: 'lax' },
  UW: { height: 'high', backness: 'back', rounding: 'rounded', tense: 'tense' },
}

const CONSONANT_FEATURES: Record<string, ConsonantFeature> = {
  B: { place: 'bilabial', manner: 'stop', voicing: 'voiced' },
  CH: { place: 'postalveolar', manner: 'affricate', voicing: 'voiceless' },
  D: { place: 'alveolar', manner: 'stop', voicing: 'voiced' },
  DH: { place: 'dental', manner: 'fricative', voicing: 'voiced' },
  F: { place: 'labiodental', manner: 'fricative', voicing: 'voiceless' },
  G: { place: 'velar', manner: 'stop', voicing: 'voiced' },
  HH: { place: 'glottal', manner: 'fricative', voicing: 'voiceless' },
  JH: { place: 'postalveolar', manner: 'affricate', voicing: 'voiced' },
  K: { place: 'velar', manner: 'stop', voicing: 'voiceless' },
  L: { place: 'alveolar', manner: 'lateral', voicing: 'voiced' },
  M: { place: 'bilabial', manner: 'nasal', voicing: 'voiced' },
  N: { place: 'alveolar', manner: 'nasal', voicing: 'voiced' },
  NG: { place: 'velar', manner: 'nasal', voicing: 'voiced' },
  P: { place: 'bilabial', manner: 'stop', voicing: 'voiceless' },
  R: { place: 'alveolar', manner: 'approximant', voicing: 'voiced' },
  S: { place: 'alveolar', manner: 'fricative', voicing: 'voiceless' },
  SH: { place: 'postalveolar', manner: 'fricative', voicing: 'voiceless' },
  T: { place: 'alveolar', manner: 'stop', voicing: 'voiceless' },
  TH: { place: 'dental', manner: 'fricative', voicing: 'voiceless' },
  V: { place: 'labiodental', manner: 'fricative', voicing: 'voiced' },
  W: { place: 'velar', manner: 'approximant', voicing: 'voiced' },
  Y: { place: 'palatal', manner: 'approximant', voicing: 'voiced' },
  Z: { place: 'alveolar', manner: 'fricative', voicing: 'voiced' },
  ZH: { place: 'postalveolar', manner: 'fricative', voicing: 'voiced' },
}

const VOWELS = new Set(Object.keys(VOWEL_FEATURES))

const stripStress = (phone: string) => phone.replace(/\d/g, '')

export const isVowel = (phoneBase: string) => VOWELS.has(stripStress(phoneBase))

export const vowelSimilarity = (a: string, b: string) => {
  const baseA = stripStress(a)
  const baseB = stripStress(b)
  if (baseA === baseB) return 1
  const featuresA = VOWEL_FEATURES[baseA]
  const featuresB = VOWEL_FEATURES[baseB]
  if (!featuresA || !featuresB) return 0

  const matches =
    Number(featuresA.height === featuresB.height) +
    Number(featuresA.backness === featuresB.backness) +
    Number(featuresA.rounding === featuresB.rounding) +
    Number(featuresA.tense === featuresB.tense)
  return matches / 4
}

export const consonantSimilarity = (a: string, b: string) => {
  const baseA = stripStress(a)
  const baseB = stripStress(b)
  if (baseA === baseB) return 1
  const featuresA = CONSONANT_FEATURES[baseA]
  const featuresB = CONSONANT_FEATURES[baseB]
  if (!featuresA || !featuresB) return 0

  const matches =
    Number(featuresA.place === featuresB.place) +
    Number(featuresA.manner === featuresB.manner) +
    Number(featuresA.voicing === featuresB.voicing)
  return matches / 3
}

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

export const codaSimilarity = (codaA: string[], codaB: string[]) => {
  if (arraysEqual(codaA, codaB)) return 1
  if (codaA.length === 0 || codaB.length === 0) return 0

  const lastA = codaA[codaA.length - 1]
  const lastB = codaB[codaB.length - 1]
  if (lastA && lastB && lastA === lastB) return 0.85

  const tailA = codaA.slice(-3)
  const tailB = codaB.slice(-3)
  const pairs = Math.min(tailA.length, tailB.length)
  if (pairs === 0) return 0
  let total = 0
  for (let index = 0; index < pairs; index += 1) {
    const aPhone = tailA[tailA.length - 1 - index]
    const bPhone = tailB[tailB.length - 1 - index]
    if (aPhone && bPhone) {
      total += consonantSimilarity(aPhone, bPhone)
    }
  }
  const average = total / pairs
  return 0.4 + 0.4 * average
}

export const tailSimilarity = (target: Tail, cand: Tail) => {
  const vowelScore = vowelSimilarity(target.vowel, cand.vowel)

  const tailA = target.lastConsonants.slice(-3)
  const tailB = cand.lastConsonants.slice(-3)
  const pairs = Math.min(tailA.length, tailB.length)
  let consonantScore = 0.5
  if (pairs > 0) {
    let total = 0
    for (let index = 0; index < pairs; index += 1) {
      const aPhone = tailA[tailA.length - 1 - index]
      const bPhone = tailB[tailB.length - 1 - index]
      if (aPhone && bPhone) {
        total += consonantSimilarity(aPhone, bPhone)
      }
    }
    consonantScore = total / pairs
  }

  return vowelScore * 0.7 + consonantScore * 0.3
}
