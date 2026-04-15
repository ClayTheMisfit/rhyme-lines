import { DEFAULT_HIGHLIGHT_MODE, type RhymeHighlightMode } from '@/lib/persist/schema'

export type RhymeHighlightSettings = {
  showInternalRhymes: boolean
  highlightStopwords: boolean
  highlightMode: RhymeHighlightMode
  hideColorfulWords: boolean
}

export const RHYME_HIGHLIGHT_DEFAULTS: RhymeHighlightSettings = {
  showInternalRhymes: true,
  highlightStopwords: false,
  highlightMode: DEFAULT_HIGHLIGHT_MODE,
  hideColorfulWords: false,
}

export const RHYME_HIGHLIGHT_STORAGE_KEY = 'rhymeLines:rhymeHighlightSettings:v1'

const MODE_SET = new Set<RhymeHighlightMode>(['off', 'end', 'focus', 'all'])

export function loadRhymeHighlightSettings(): RhymeHighlightSettings {
  if (typeof window === 'undefined') return RHYME_HIGHLIGHT_DEFAULTS

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY)
  } catch {
    const legacy = loadFromLegacySettingsPayload()
    return legacy ?? RHYME_HIGHLIGHT_DEFAULTS
  }

  if (!raw) {
    const legacy = loadFromLegacySettingsPayload()
    return legacy ?? RHYME_HIGHLIGHT_DEFAULTS
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return RHYME_HIGHLIGHT_DEFAULTS
    return sanitizeRhymeHighlightSettings(parsed as Partial<RhymeHighlightSettings>)
  } catch {
    return RHYME_HIGHLIGHT_DEFAULTS
  }
}

export function saveRhymeHighlightSettings(settings: RhymeHighlightSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RHYME_HIGHLIGHT_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // no-op
  }
}

function sanitizeRhymeHighlightSettings(input: Partial<RhymeHighlightSettings>): RhymeHighlightSettings {
  return {
    showInternalRhymes: typeof input.showInternalRhymes === 'boolean'
      ? input.showInternalRhymes
      : RHYME_HIGHLIGHT_DEFAULTS.showInternalRhymes,
    highlightStopwords: typeof input.highlightStopwords === 'boolean'
      ? input.highlightStopwords
      : RHYME_HIGHLIGHT_DEFAULTS.highlightStopwords,
    highlightMode: MODE_SET.has(input.highlightMode as RhymeHighlightMode)
      ? (input.highlightMode as RhymeHighlightMode)
      : RHYME_HIGHLIGHT_DEFAULTS.highlightMode,
    hideColorfulWords: typeof input.hideColorfulWords === 'boolean'
      ? input.hideColorfulWords
      : RHYME_HIGHLIGHT_DEFAULTS.hideColorfulWords,
  }
}

function loadFromLegacySettingsPayload(): RhymeHighlightSettings | null {
  let legacyRaw: string | null = null
  try {
    legacyRaw = window.localStorage.getItem('rhyme-lines:persist:settings')
  } catch {
    return null
  }
  if (!legacyRaw) return null
  try {
    const parsed = JSON.parse(legacyRaw) as { data?: Record<string, unknown> } | Record<string, unknown>
    const payload = 'data' in parsed && parsed.data && typeof parsed.data === 'object'
      ? parsed.data as Record<string, unknown>
      : parsed as Record<string, unknown>

    const candidate: Partial<RhymeHighlightSettings> = {
      showInternalRhymes: payload.showInternalRhymes as boolean | undefined,
      highlightStopwords: payload.highlightStopwords as boolean | undefined,
      highlightMode: payload.rhymeHighlightMode as RhymeHighlightMode | undefined,
      hideColorfulWords: payload.hideRhymeColors as boolean | undefined,
    }

    return sanitizeRhymeHighlightSettings(candidate)
  } catch {
    return null
  }
}
