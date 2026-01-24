import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PANEL_STATE,
  DEFAULT_RHYME_FILTERS,
  DEFAULT_SETTINGS,
  DraftCollection,
  DraftLine,
  DraftSchema,
  PanelSchema,
  SettingsSchema,
  createDefaultDraftCollection,
  createEmptyDraft,
} from './schema'
import { migrateOldContent } from '../editor/serialization'

export type StoredValueCandidate = { key: string; value: string }

export interface VersionedResult<T> {
  version: number
  data: T
}

export function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const toNumber = (value: unknown, fallback: number): number => (isFiniteNumber(value) ? value : fallback)

const toBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const toStringValue = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const normalizeRhymeFilters = (value: unknown) => {
  const base = { ...DEFAULT_RHYME_FILTERS }
  if (!isRecord(value)) return base
  const legacySlant = toBoolean(value.slant, false)
  return {
    perfect: toBoolean(value.perfect, base.perfect),
    near: toBoolean(value.near, base.near) || legacySlant,
  }
}

const normalizeSettings = (value: unknown): SettingsSchema => {
  const payload = isRecord(value) ? value : {}
  const themeValue = toStringValue(payload.theme)
  const theme: SettingsSchema['theme'] =
    themeValue === 'light' || themeValue === 'system' ? themeValue : 'dark'

  const fontSize = toNumber(payload.fontSize, DEFAULT_SETTINGS.fontSize)
  const lineHeight = toNumber(payload.lineHeight, DEFAULT_SETTINGS.lineHeight)
  const badgeSizeValue = toStringValue(payload.badgeSize)
  const badgeSize: SettingsSchema['badgeSize'] =
    badgeSizeValue === 'xs' || badgeSizeValue === 'md' ? badgeSizeValue : DEFAULT_SETTINGS.badgeSize
  const debounceModeValue = toStringValue(payload.debounceMode)
  const debounceMode: SettingsSchema['debounceMode'] =
    debounceModeValue === 'cursor-50' ? 'cursor-50' : DEFAULT_SETTINGS.debounceMode

  const keyboardShortcuts = isRecord(payload.keyboardShortcuts)
    ? (Object.fromEntries(
        Object.entries(payload.keyboardShortcuts).filter(
          ([key, value]) => typeof key === 'string' && typeof value === 'string'
        )
      ) as Record<string, string>)
    : undefined

  const rhymeFilters = normalizeRhymeFilters(payload.rhymeFilters)
  const showLineTotals = toBoolean(payload.showLineTotals, DEFAULT_SETTINGS.showLineTotals ?? true)
  const rhymeAutoRefresh = toBoolean(payload.rhymeAutoRefresh, DEFAULT_SETTINGS.rhymeAutoRefresh ?? true)
  const includeRareWords = toBoolean(
    payload.includeRareWords,
    toBoolean(payload.includeRareRhymes, DEFAULT_SETTINGS.includeRareWords ?? false)
  )
  const commonWordsOnly = toBoolean(payload.commonWordsOnly, DEFAULT_SETTINGS.commonWordsOnly ?? false)
  const highContrast = toBoolean(payload.highContrast, DEFAULT_SETTINGS.highContrast ?? false)
  const lastUpdatedAt = toNumber(payload.lastUpdatedAt, Date.now())

  return {
    theme,
    fontSize,
    lineHeight,
    highContrast,
    keyboardShortcuts,
    rhymeFilters,
    includeRareWords,
    commonWordsOnly,
    lastUpdatedAt,
    badgeSize,
    showLineTotals,
    rhymeAutoRefresh,
    debounceMode,
  }
}

const normalizeLine = (line: unknown, fallbackId: string, fallbackText: string): DraftLine => {
  if (!isRecord(line)) {
    return { id: fallbackId, text: fallbackText }
  }
  const id = toStringValue(line.id) ?? fallbackId
  const text = toStringValue(line.text) ?? fallbackText
  return { id, text }
}

const normalizeDraft = (value: unknown, fallbackId: string): DraftSchema => {
  if (!isRecord(value)) {
    return createEmptyDraft(fallbackId)
  }

  const docId = toStringValue(value.docId) ?? fallbackId
  const createdAt = toNumber(value.createdAt, Date.now())
  const updatedAt = toNumber(value.updatedAt, createdAt)
  const title = toStringValue(value.title) ?? 'Untitled'
  const linesSource = Array.isArray(value.lines) ? value.lines : []
  const lines = linesSource.map((line, index) => normalizeLine(line, `${docId}-line-${index}`, ''))

  const selectionValue = isRecord(value.selection) ? value.selection : null
  const selection =
    selectionValue && toStringValue(selectionValue.lineId) && isFiniteNumber(selectionValue.offset)
      ? { lineId: selectionValue.lineId as string, offset: selectionValue.offset as number }
      : undefined

  return {
    docId,
    title,
    createdAt,
    updatedAt,
    lines: lines.length ? lines : [{ id: `${docId}-line-0`, text: '' }],
    selection,
  }
}

const normalizeDraftCollection = (value: unknown): DraftCollection => {
  if (!isRecord(value)) {
    return createDefaultDraftCollection()
  }

  const draftsSource = Array.isArray(value.drafts) ? value.drafts : []
  const drafts =
    draftsSource.length > 0
      ? draftsSource.map((draft, index) => normalizeDraft(draft, `draft-${index}`))
      : createDefaultDraftCollection().drafts

  const activeId = toStringValue(value.activeId) ?? drafts[0]?.docId ?? createDefaultDraftCollection().activeId
  return { drafts, activeId }
}

const normalizePanel = (value: unknown): PanelSchema => {
  if (!isRecord(value)) return DEFAULT_PANEL_STATE

  const panelValue = isRecord(value.rhymePanel) ? value.rhymePanel : {}
  const positionValue = isRecord(panelValue.position) ? panelValue.position : undefined
  const filters = normalizeRhymeFilters(value.filters)

  return {
    rhymePanel: {
      isOpen: toBoolean(panelValue.isOpen, DEFAULT_PANEL_STATE.rhymePanel.isOpen),
      isDetached: toBoolean(panelValue.isDetached, DEFAULT_PANEL_STATE.rhymePanel.isDetached),
      width: toNumber(panelValue.width, DEFAULT_PANEL_STATE.rhymePanel.width),
      height: panelValue.height ? toNumber(panelValue.height, DEFAULT_PANEL_STATE.rhymePanel.height ?? 0) : undefined,
      position:
        positionValue && isFiniteNumber(positionValue.x) && isFiniteNumber(positionValue.y)
          ? { x: positionValue.x, y: positionValue.y }
          : DEFAULT_PANEL_STATE.rhymePanel.position,
    },
    filters,
    lastTargetWord: toStringValue(value.lastTargetWord) ?? undefined,
    searchQuery: toStringValue(value.searchQuery) ?? '',
    selectedIndex: isFiniteNumber(value.selectedIndex) ? value.selectedIndex : null,
    syllableFilter: isFiniteNumber(value.syllableFilter) ? value.syllableFilter : DEFAULT_PANEL_STATE.syllableFilter,
    multiSyllablePerfect: toBoolean(value.multiSyllablePerfect, DEFAULT_PANEL_STATE.multiSyllablePerfect ?? false),
  }
}

const parseCandidates = (candidates: StoredValueCandidate[]): unknown => {
  for (const candidate of candidates) {
    const parsed = safeParseJSON<unknown>(candidate.value, null as unknown as null)
    if (parsed !== null) return parsed
  }
  return null
}

export function migrateSettings(candidates: StoredValueCandidate[]): VersionedResult<SettingsSchema> {
  const fallback: VersionedResult<SettingsSchema> = {
    version: CURRENT_SCHEMA_VERSION,
    data: { ...DEFAULT_SETTINGS, lastUpdatedAt: Date.now(), rhymeFilters: { ...DEFAULT_RHYME_FILTERS } },
  }

  if (!candidates.length) return fallback

  const parsed = parseCandidates(candidates)
  if (!parsed || !isRecord(parsed)) {
    return fallback
  }

  let version = isFiniteNumber(parsed.version) ? parsed.version : 0
  let workingData: unknown = 'data' in parsed ? (parsed as Record<string, unknown>).data : parsed

  if (!version && 'state' in parsed) {
    version = 0
    workingData = (parsed as { state?: unknown }).state
  }

  let normalized = normalizeSettings(workingData)
  if (version === 0) {
    normalized = normalizeSettings({ ...DEFAULT_SETTINGS, ...normalized, lastUpdatedAt: Date.now() })
    version = 1
  }

  if (version === 1) {
    normalized = normalizeSettings({ ...normalized, lastUpdatedAt: normalized.lastUpdatedAt || Date.now() })
    version = 2
  }

  return { version: CURRENT_SCHEMA_VERSION, data: normalized }
}

const buildDraftFromText = (text: string): DraftCollection => {
  const docId = `draft-${Date.now().toString(16)}`
  const normalized = migrateOldContent(text)
  const lines = normalized.split('\n').map((line, index) => ({ id: `${docId}-line-${index}`, text: line }))
  const draft: DraftSchema = {
    docId,
    title: 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lines: lines.length ? lines : [{ id: `${docId}-line-0`, text: '' }],
  }
  return { drafts: [draft], activeId: docId }
}

const migrateLegacyTabs = (value: unknown): DraftCollection => {
  if (!isRecord(value)) return createDefaultDraftCollection()

  const tabs = Array.isArray(value.tabs) ? value.tabs : []
  const activeTabId = toStringValue(value.activeTabId)
  if (!tabs.length) return createDefaultDraftCollection()

  const drafts: DraftSchema[] = tabs.map((tab, index) => {
    if (!isRecord(tab)) return createEmptyDraft(`draft-${index}`)
    const docId = toStringValue(tab.id) ?? `draft-${index}`
    const title = toStringValue(tab.title) ?? 'Untitled'
    const createdAt = toNumber(tab.createdAt, Date.now())
    const updatedAt = toNumber(tab.updatedAt, createdAt)
    const snapshot = isRecord(tab.snapshot) ? tab.snapshot : {}
    const text = migrateOldContent(toStringValue(snapshot.text) ?? '')
    const lines = text.split('\n').map((line, lineIndex) => ({
      id: `${docId}-line-${lineIndex}`,
      text: line,
    }))

    return {
      docId,
      title,
      createdAt,
      updatedAt,
      lines: lines.length ? lines : [{ id: `${docId}-line-0`, text: '' }],
    }
  })

  const activeId = drafts.find((draft) => draft.docId === activeTabId)?.docId ?? drafts[0]?.docId ?? activeTabId ?? ''
  return drafts.length ? { drafts, activeId } : createDefaultDraftCollection()
}

export function migrateDrafts(candidates: StoredValueCandidate[]): VersionedResult<DraftCollection> {
  const fallback = { version: CURRENT_SCHEMA_VERSION, data: createDefaultDraftCollection() }
  if (!candidates.length) return fallback

  for (const candidate of candidates) {
    const parsed = safeParseJSON<unknown>(candidate.value, null as unknown as null)
    if (parsed !== null) {
      if (isRecord(parsed) && (parsed.tabs || parsed.activeTabId)) {
        const migrated = migrateLegacyTabs(parsed)
        return { version: CURRENT_SCHEMA_VERSION, data: migrated }
      }

      if (isRecord(parsed) && ('drafts' in parsed || 'activeId' in parsed || 'version' in parsed)) {
        const version = isFiniteNumber(parsed.version) ? parsed.version : 1
        const data = 'data' in parsed ? (parsed as Record<string, unknown>).data : parsed

        let normalized = normalizeDraftCollection(data)
        if (version === 1) {
          normalized = normalizeDraftCollection({ ...normalized })
        }
        return { version: CURRENT_SCHEMA_VERSION, data: normalized }
      }
    }
  }

  const textCandidate = candidates.find((candidate) => candidate.value && candidate.value.trim().length > 0)
  if (textCandidate) {
    return { version: CURRENT_SCHEMA_VERSION, data: buildDraftFromText(textCandidate.value) }
  }

  return fallback
}

const mergePanelCandidates = (candidates: StoredValueCandidate[]): Record<string, unknown> => {
  const merged: Record<string, unknown> = {}
  for (const candidate of candidates) {
    const parsed = safeParseJSON<Record<string, unknown> | null>(candidate.value, null)
    if (!parsed) continue
    if ('state' in parsed) {
      Object.assign(merged, (parsed as { state?: Record<string, unknown> }).state ?? {})
    } else {
      Object.assign(merged, parsed)
    }
  }
  return merged
}

export function migratePanel(candidates: StoredValueCandidate[]): VersionedResult<PanelSchema> {
  const fallback: VersionedResult<PanelSchema> = {
    version: CURRENT_SCHEMA_VERSION,
    data: {
      rhymePanel: {
        ...DEFAULT_PANEL_STATE.rhymePanel,
        position: DEFAULT_PANEL_STATE.rhymePanel.position
          ? { ...DEFAULT_PANEL_STATE.rhymePanel.position }
          : undefined,
      },
      filters: { ...DEFAULT_PANEL_STATE.filters },
      lastTargetWord: DEFAULT_PANEL_STATE.lastTargetWord,
      searchQuery: DEFAULT_PANEL_STATE.searchQuery,
      selectedIndex: DEFAULT_PANEL_STATE.selectedIndex,
      syllableFilter: DEFAULT_PANEL_STATE.syllableFilter,
    },
  }
  if (!candidates.length) return fallback

  const merged = mergePanelCandidates(candidates)
  if (!Object.keys(merged).length) return fallback

  const normalized = normalizePanel(merged)
  const version = isFiniteNumber((merged as { version?: number }).version) ? (merged as { version?: number }).version : 1

  if (version === 1) {
    const hydrated = normalizePanel({ ...normalized })
    return { version: CURRENT_SCHEMA_VERSION, data: hydrated }
  }

  return { version: CURRENT_SCHEMA_VERSION, data: normalized }
}
