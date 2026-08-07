import type { RhymeSuggestion } from './providers/datamuse'
import type { ProviderCandidate, RhymeProvider } from './providers'
import { providers } from './providers'
import { classifyCandidate } from './wordQuality'

export type RhymeQuality = 'perfect' | 'near' | 'slant'

export interface RhymeFilterSelection {
  perfect: boolean
  near: boolean
  slant: boolean
}

export interface LexicalFlags {
  isProperNoun: boolean
  isAbbreviation: boolean
  isArchaic: boolean
  isDialectal: boolean
  isMalformed: boolean
  isObscure: boolean
}

export interface ScoreBreakdown {
  category: number
  phoneticSimilarity: number
  frequency: number
  providerConfidence: number
  lexicalQuality: number
  syllableFit: number
  providerAgreement: number
  penalties: number
}

export interface AggregatedSuggestion {
  word: string
  normalized: string
  quality: RhymeQuality
  score: number
  rawScore?: number
  syllables?: number
  sources: string[]
  providers: string[]
  sourceWords?: string[]
  providerConfidence?: number
  frequencyScore?: number
  lexicalQuality?: number
  syllableFit?: number
  phoneticSimilarity?: number
  finalScore?: number
  lexicalFlags?: LexicalFlags
  scoreBreakdown?: ScoreBreakdown
  retainedReason?: string
}

export interface AggregationResult {
  suggestions: AggregatedSuggestion[]
  buckets: Record<RhymeQuality, AggregatedSuggestion[]>
  providerStates: ProviderStateSnapshot[]
  diagnostics?: AggregationDiagnostics
}

export interface AggregationDiagnostics {
  rankingVersion: string
  rawCandidateCount: number
  normalizedCandidateCount: number
  validatedCandidateCount: number
  lexicalCandidateCount: number
  scoredCandidateCount: number
  rejected: CandidateRejection[]
  durationMs: number
}

export interface CandidateRejection {
  word: string
  normalized: string
  provider: string
  reason: string
}

export interface ProviderStateSnapshot {
  name: string
  ok: boolean
  error?: string
  durationMs: number
  skipped?: boolean
}

export interface AggregateOptions {
  filters: RhymeFilterSelection
  signal: AbortSignal
  offline?: boolean
  limit?: number
}

const QUALITY_PRIORITY: RhymeQuality[] = ['perfect', 'near', 'slant']
export const RHYME_RANKING_VERSION = 'lexical-v4'
const DEFAULT_MAX_RESULTS = 50
const DEFAULT_VISIBLE_LIMIT = 6
const COMMON_WORDS = new Set([
  'rain','pain','train','chain','gain','main','plain','lane','drain','strain','vein','reign','sane','crane','time','rhyme','line','fine','mine','shine','light','night','right','bright','heart','part','start','art','alone','stone','phone','home','motion','ocean','better','letter','show','flow','glow','cold','old','gold','dream','team','seem','rose','hope','grace'
])
const ARCHAIC_OR_DIALECT = new Set(['ane','eftsoons','yclept'])
const PROVIDER_MAX_SCORE: Record<string, number> = { datamuse: 1000, rhymebrain: 100, local: 100 }
const PUNCT_WRAPPERS = /^[\s"“”'‘’`´.,!?;:()[\]{}<>]+|[\s"“”'‘’`´.,!?;:()[\]{}<>]+$/gu
const VALID_WORD = /^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u

interface ProviderState { lastStart: number; failCount: number; backoffUntil: number }
const providerState = new Map<string, ProviderState>()

function qualityPriority(quality: RhymeQuality): number {
  const idx = QUALITY_PRIORITY.indexOf(quality)
  return idx === -1 ? QUALITY_PRIORITY.length : idx
}

export function normalizeQuality(type: RhymeSuggestion['type'] | 'near'): RhymeQuality {
  if (type === 'perfect') return 'perfect'
  if (type === 'near') return 'near'
  return 'slant'
}

function normalizeCandidateWord(word: string): string {
  return word.normalize('NFKC').replace(/[’‘`´]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\.{2,}$/u, '').replace(PUNCT_WRAPPERS, '').trim().toLowerCase()
}

function validateCandidate(item: ProviderCandidate, query: string): CandidateRejection | null {
  const normalized = normalizeCandidateWord(item.word)
  if (!normalized) return { word: item.word, normalized, provider: item.provider, reason: 'empty' }
  if (normalized === query) return { word: item.word, normalized, provider: item.provider, reason: 'query-word' }
  if (/[\r\n\u0000-\u001f\u007f]/u.test(item.word)) return { word: item.word, normalized, provider: item.provider, reason: 'control-or-linebreak' }
  if (/<[^>]+>/u.test(item.word)) return { word: item.word, normalized, provider: item.provider, reason: 'html-like' }
  if (/^\d+$/u.test(normalized)) return { word: item.word, normalized, provider: item.provider, reason: 'numeric-only' }
  if (/^https?:\/\//u.test(normalized) || normalized.includes('@')) return { word: item.word, normalized, provider: item.provider, reason: 'url-or-email' }
  if (/\s/u.test(normalized)) return { word: item.word, normalized, provider: item.provider, reason: 'multi-word' }
  if (!VALID_WORD.test(normalized)) return { word: item.word, normalized, provider: item.provider, reason: 'malformed' }
  return null
}

function normalizeProviderScore(item: ProviderCandidate): number {
  const max = PROVIDER_MAX_SCORE[item.provider] ?? Math.max(100, item.score || 0)
  return Math.max(0, Math.min(1, (Number.isFinite(item.score) ? item.score : 0) / max))
}

function inferFrequency(item: ProviderCandidate, normalized: string): number | undefined {
  if (typeof item.frequency === 'number') return Math.max(0, Math.min(1, item.frequency / 100))
  if (COMMON_WORDS.has(normalized)) return 0.82
  return undefined
}

function lexicalFlags(item: ProviderCandidate, normalized: string, frequencyKnown: boolean, mergedNameEvidence: boolean): LexicalFlags {
  const tags = item.tags ?? []
  const properTag = tags.some((tag) => /^(prop|name|surname|given-name|proper)$/i.test(tag))
  const archaicTag = tags.some((tag) => /^(archaic|obsolete)$/i.test(tag))
  const dialectTag = tags.some((tag) => /^(dialect|dialectal|regional)$/i.test(tag))
  const abbreviationTag = tags.some((tag) => /^(abbr|acronym|initialism)$/i.test(tag))
  const lexicalClassification = classifyCandidate(item.word, {
    frequency: item.frequency,
    tags,
  })
  const isArchaic = archaicTag || ARCHAIC_OR_DIALECT.has(normalized)
  const isDialectal = dialectTag
  return {
    isProperNoun: mergedNameEvidence || properTag || lexicalClassification.isProper,
    isAbbreviation: abbreviationTag || /^[A-Z.]{2,}$/.test(item.word.trim()),
    isArchaic,
    isDialectal,
    isMalformed: false,
    isObscure: !frequencyKnown && !COMMON_WORDS.has(normalized),
  }
}

function phoneticSimilarity(quality: RhymeQuality): number {
  return quality === 'perfect' ? 1 : quality === 'near' ? 0.72 : 0.52
}

function syllableFit(querySyllables: number | undefined, syllables: number | undefined): number {
  if (!querySyllables || !syllables) return 0.5
  const diff = Math.abs(querySyllables - syllables)
  return diff === 0 ? 1 : diff === 1 ? 0.72 : Math.max(0.35, 1 - diff * 0.18)
}

function scoreCandidate(item: AggregatedSuggestion, querySyllables: number | undefined): AggregatedSuggestion {
  const category = item.quality === 'perfect' ? 4 : item.quality === 'near' ? 2.4 : 1.2
  const phonetic = (item.phoneticSimilarity ?? 0) * 2
  const frequency = (item.frequencyScore ?? 0) * 1.3
  const providerConfidence = (item.providerConfidence ?? 0) * 0.7
  const lexicalQuality = (item.lexicalQuality ?? 0) * 1.2
  const fit = syllableFit(querySyllables, item.syllables) * 0.35
  const providerAgreement = Math.min(0.45, (item.providers.length - 1) * 0.18)
  const penalties =
    (item.lexicalFlags?.isProperNoun ? 5 : 0) +
    (item.lexicalFlags?.isAbbreviation ? 4 : 0) +
    (item.lexicalFlags?.isArchaic ? 3.8 : 0) +
    (item.lexicalFlags?.isDialectal ? 2.5 : 0) +
    (item.lexicalFlags?.isObscure ? 1.15 : 0)
  const breakdown = { category, phoneticSimilarity: phonetic, frequency, providerConfidence, lexicalQuality, syllableFit: fit, providerAgreement, penalties }
  const finalScore = category + phonetic + frequency + providerConfidence + lexicalQuality + fit + providerAgreement - penalties
  return { ...item, syllableFit: fit / 0.35, scoreBreakdown: breakdown, finalScore, score: finalScore }
}

function mergeCandidates(raw: ProviderCandidate[], filters: RhymeFilterSelection, query = '', querySyllables?: number): AggregatedSuggestion[] {
  const rejected: CandidateRejection[] = []
  return buildRankedCandidates(raw, filters, query, rejected, DEFAULT_MAX_RESULTS, querySyllables).suggestions
}

function buildRankedCandidates(raw: ProviderCandidate[], filters: RhymeFilterSelection, query: string, rejected: CandidateRejection[], limit = DEFAULT_MAX_RESULTS, querySyllables?: number) {
  const normalizedQuery = normalizeCandidateWord(query)
  const map = new Map<string, AggregatedSuggestion>()
  const mergedNameEvidence = new Set<string>()

  // Risk evidence is aggregated before filtering so a pronunciation-only source
  // cannot reintroduce a name flagged by another provider. This pre-pass is
  // deterministic and remains linear in the already-bounded candidate pool.
  for (const item of raw) {
    const normalized = normalizeCandidateWord(item.word)
    const hasProperTag = item.tags?.some((tag) => /^(prop|name|surname|given-name|proper)$/i.test(tag)) ?? false
    if (hasProperTag || classifyCandidate(item.word, { frequency: item.frequency, tags: item.tags }).isProper) {
      mergedNameEvidence.add(normalized)
    }
  }

  for (const item of raw) {
    const normalized = normalizeCandidateWord(item.word)
    const invalid = validateCandidate(item, normalizedQuery)
    if (invalid) { rejected.push(invalid); continue }
    if (!filters[item.quality]) { rejected.push({ word: item.word, normalized, provider: item.provider, reason: 'inactive-filter' }); continue }
    const frequencyValue = inferFrequency(item, normalized)
    const frequencyKnown = frequencyValue !== undefined
    const flags = lexicalFlags(item, normalized, frequencyKnown, mergedNameEvidence.has(normalized))
    if (flags.isProperNoun || flags.isAbbreviation || flags.isArchaic || flags.isDialectal) {
      rejected.push({ word: item.word, normalized, provider: item.provider, reason: flags.isProperNoun ? 'proper-name' : flags.isAbbreviation ? 'abbreviation' : flags.isArchaic ? 'archaic' : 'dialectal' })
      continue
    }
    const existing = map.get(normalized)
    const providerConfidence = normalizeProviderScore(item)
    if (!existing) {
      const lexicalQuality = flags.isObscure ? 0.35 : frequencyKnown ? 0.92 : 0.62
      map.set(normalized, {
        word: normalized,
        normalized,
        quality: item.quality,
        rawScore: item.score,
        score: 0,
        syllables: item.syllables,
        sources: [item.provider],
        providers: [item.provider],
        sourceWords: [item.word],
        providerConfidence,
        frequencyScore: frequencyValue ?? 0.42,
        lexicalQuality,
        syllableFit: 0.5,
        phoneticSimilarity: item.phoneticSimilarity ?? phoneticSimilarity(item.quality),
        finalScore: 0,
        lexicalFlags: flags,
        scoreBreakdown: { category: 0, phoneticSimilarity: 0, frequency: 0, providerConfidence: 0, lexicalQuality: 0, syllableFit: 0, providerAgreement: 0, penalties: 0 },
        retainedReason: 'valid-rhyme-evidence',
      })
      continue
    }
    if (qualityPriority(item.quality) < qualityPriority(existing.quality)) existing.quality = item.quality
    existing.rawScore = Math.max(existing.rawScore ?? 0, item.score)
    existing.providerConfidence = Math.max(existing.providerConfidence ?? 0, providerConfidence)
    existing.frequencyScore = Math.max(existing.frequencyScore ?? 0, frequencyValue ?? existing.frequencyScore ?? 0)
    existing.phoneticSimilarity = Math.max(existing.phoneticSimilarity ?? 0, item.phoneticSimilarity ?? phoneticSimilarity(item.quality))
    if (item.syllables && !existing.syllables) existing.syllables = item.syllables
    if (!existing.providers.includes(item.provider)) existing.providers.push(item.provider)
    if (!existing.sources.includes(item.provider)) existing.sources.push(item.provider)
    existing.sourceWords ??= []
    if (!existing.sourceWords.includes(item.word)) existing.sourceWords.push(item.word)
  }

  const scored = Array.from(map.values()).map((item) => {
    item.providers.sort()
    item.sources.sort()
    item.sourceWords?.sort()
    return scoreCandidate(item, querySyllables)
  })
  scored.sort((a, b) =>
    (b.finalScore ?? 0) - (a.finalScore ?? 0) ||
    qualityPriority(a.quality) - qualityPriority(b.quality) ||
    (b.phoneticSimilarity ?? 0) - (a.phoneticSimilarity ?? 0) ||
    (b.frequencyScore ?? 0) - (a.frequencyScore ?? 0) ||
    b.providers.length - a.providers.length ||
    Math.abs((a.syllables ?? 99) - (querySyllables ?? 99)) - Math.abs((b.syllables ?? 99) - (querySyllables ?? 99)) ||
    a.normalized.length - b.normalized.length ||
    a.normalized.localeCompare(b.normalized)
  )
  return { suggestions: scored.slice(0, limit), scoredCount: scored.length }
}

async function wait(ms: number, signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  if (ms <= 0) return
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function invokeProvider(word: string, provider: RhymeProvider, options: AggregateOptions): Promise<{ candidates: ProviderCandidate[]; snapshot: ProviderStateSnapshot }> {
  const state = providerState.get(provider.name) ?? { lastStart: 0, failCount: 0, backoffUntil: 0 }
  const now = Date.now()
  if (state.backoffUntil > now) return { candidates: [], snapshot: { name: provider.name, ok: false, skipped: true, durationMs: 0, error: 'backoff' } }
  const minIntervalMs = provider.minIntervalMs ?? 150
  const nextStart = Math.max(now, state.lastStart + minIntervalMs)
  providerState.set(provider.name, { lastStart: nextStart, failCount: state.failCount, backoffUntil: state.backoffUntil })
  const waitMs = nextStart - now
  if (waitMs > 0) {
    try {
      await wait(waitMs, options.signal)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error
      throw error
    }
  }
  const started = Date.now()
  try {
    const results = await provider.fetch(word, options)
    const currentState = providerState.get(provider.name) ?? { lastStart: 0, failCount: 0, backoffUntil: 0 }
    providerState.set(provider.name, { lastStart: Math.max(currentState.lastStart, Date.now()), failCount: 0, backoffUntil: 0 })
    return { candidates: results, snapshot: { name: provider.name, ok: true, durationMs: Date.now() - started } }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error
    const nextFail = state.failCount + 1
    const currentState = providerState.get(provider.name) ?? { lastStart: 0, failCount: 0, backoffUntil: 0 }
    providerState.set(provider.name, { lastStart: Math.max(currentState.lastStart, Date.now()), failCount: nextFail, backoffUntil: Date.now() + Math.min(1000 + nextFail * 250, 4000) })
    return { candidates: [], snapshot: { name: provider.name, ok: false, durationMs: Date.now() - started, error: error instanceof Error ? error.message : 'Unknown error' } }
  }
}

const collectAggregatedRhymes = async (word: string, options: AggregateOptions, activeProviders: RhymeProvider[]): Promise<AggregationResult> => {
  const started = Date.now()
  const tasks = activeProviders.filter((provider) => options.offline ? provider.supportsOffline : true).map((provider) => invokeProvider(word, provider, options))
  const settled = await Promise.all(tasks)
  const candidates = settled.flatMap((item) => item.candidates).slice(0, 250)
  const snapshots = settled.map((item) => item.snapshot)
  const rejected: CandidateRejection[] = []
  const normalizedQuery = normalizeCandidateWord(word)
  const querySyllables = candidates.find((item) => normalizeCandidateWord(item.word) === normalizedQuery)?.syllables ?? undefined
  const ranked = buildRankedCandidates(candidates, options.filters, word, rejected, options.limit ?? DEFAULT_MAX_RESULTS, querySyllables)
  const buckets: AggregationResult['buckets'] = { perfect: [], near: [], slant: [] }
  for (const suggestion of ranked.suggestions) buckets[suggestion.quality].push(suggestion)
  return { suggestions: ranked.suggestions, buckets, providerStates: snapshots, diagnostics: { rankingVersion: RHYME_RANKING_VERSION, rawCandidateCount: candidates.length, normalizedCandidateCount: new Set(candidates.map((item) => normalizeCandidateWord(item.word))).size, validatedCandidateCount: candidates.length - rejected.filter((item) => ['empty','query-word','control-or-linebreak','html-like','numeric-only','url-or-email','multi-word','malformed'].includes(item.reason)).length, lexicalCandidateCount: ranked.scoredCount, scoredCandidateCount: ranked.scoredCount, rejected, durationMs: Date.now() - started } }
}

export async function fetchAggregatedRhymes(word: string, options: AggregateOptions): Promise<AggregationResult> { return collectAggregatedRhymes(word, options, providers) }
export async function fetchAggregatedRhymesWithProviders(word: string, options: AggregateOptions, activeProviders: RhymeProvider[]): Promise<AggregationResult> { return collectAggregatedRhymes(word, options, activeProviders) }
export function resetProviderState() { providerState.clear() }
export function dedupeForTest(candidates: ProviderCandidate[], filters: RhymeFilterSelection, query = '', querySyllables?: number) { return mergeCandidates(candidates, filters, query, querySyllables) }
export const __testables = { buildRankedCandidates, normalizeCandidateWord, DEFAULT_VISIBLE_LIMIT }
