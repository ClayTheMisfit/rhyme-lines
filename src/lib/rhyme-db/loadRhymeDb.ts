import type { RhymeDbV1 } from '@/lib/rhyme-db/buildRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

let warnedLegacyVersion = false
let warnedFreqInvariant = false

export type ParsedRhymeDb = {
  db: RhymeDbV1
  detectedVersion: number
  freqAvailable: boolean
  legacy: boolean
}

type ParseOptions = {
  expectedVersion?: number
  allowLegacy?: boolean
}

export const parseRhymeDbPayload = (payload: unknown, options: ParseOptions = {}): ParsedRhymeDb => {
  const expectedVersion = options.expectedVersion ?? RHYME_DB_VERSION
  const allowLegacy = options.allowLegacy ?? false

  if (!isRecord(payload)) {
    throw new Error('Invalid rhyme DB payload')
  }

  const db = payload as RhymeDbV1
  const legacy = typeof db.version !== 'number'
  const detectedVersion = legacy ? 1 : db.version

  if (legacy && allowLegacy && process.env.NODE_ENV !== 'production' && !warnedLegacyVersion) {
    warnedLegacyVersion = true
    console.warn('[rhyme-db] Missing version; assuming v1 legacy DB')
  }

  if (detectedVersion !== expectedVersion) {
    throw new Error(`Rhyme DB version mismatch: detected v${detectedVersion}, expected v${expectedVersion}`)
  }

  const wordsLen = Array.isArray(db.words) ? db.words.length : 0
  const freqLen = Array.isArray(db.freqByWordId) ? db.freqByWordId.length : 0
  const freqAvailable = Array.isArray(db.freqByWordId) && freqLen === wordsLen
  const commonLen = Array.isArray(db.isCommonByWordId) ? db.isCommonByWordId.length : 0
  const commonAvailable = Array.isArray(db.isCommonByWordId) && commonLen === wordsLen

  if (!freqAvailable && process.env.NODE_ENV !== 'production' && !warnedFreqInvariant) {
    warnedFreqInvariant = true
    console.warn('[rhyme-db] frequency data unavailable', {
      freqAvailable,
      wordsLen,
      freqLen,
    })
  }

  if (!commonAvailable && process.env.NODE_ENV !== 'production' && !warnedFreqInvariant) {
    warnedFreqInvariant = true
    console.warn('[rhyme-db] common-word flags unavailable', {
      commonAvailable,
      wordsLen,
      commonLen,
    })
  }

  return { db, detectedVersion, freqAvailable, legacy }
}
