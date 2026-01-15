export const CURRENT_SCHEMA_VERSION = 2 as const

export const STORAGE_KEYS = {
  settings: 'rhyme-lines:persist:settings',
  drafts: 'rhyme-lines:persist:drafts',
  panel: 'rhyme-lines:persist:panel',
} as const

export type StorageKey = keyof typeof STORAGE_KEYS

export type ThemeSetting = 'dark' | 'light' | 'system'
export type DebounceMode = 'cursor-50' | 'typing-250'
export type BadgeSize = 'xs' | 'sm' | 'md'
export type RhymeFilters = { perfect: boolean; near: boolean; slant: boolean }

export interface SettingsSchema {
  theme: ThemeSetting
  fontSize: number
  lineHeight: number
  highContrast?: boolean
  keyboardShortcuts?: Record<string, string>
  rhymeFilters: RhymeFilters
  includeRareWords?: boolean
  includeRareRhymes?: boolean
  lastUpdatedAt: number
  badgeSize?: BadgeSize
  showLineTotals?: boolean
  rhymeAutoRefresh?: boolean
  debounceMode?: DebounceMode
}

export interface DraftLine {
  id: string
  text: string
}

export interface DraftSelection {
  lineId: string
  offset: number
}

export interface DraftSchema {
  docId: string
  title?: string
  createdAt: number
  updatedAt: number
  lines: DraftLine[]
  selection?: DraftSelection
}

export interface DraftCollection {
  drafts: DraftSchema[]
  activeId: string
}

export interface PanelPosition {
  x: number
  y: number
}

export interface PanelSchema {
  rhymePanel: {
    isOpen: boolean
    isDetached: boolean
    width: number
    height?: number
    position?: PanelPosition
  }
  filters: RhymeFilters
  lastTargetWord?: string
  searchQuery?: string
  selectedIndex?: number | null
  syllableFilter?: number
}

export const DEFAULT_RHYME_FILTERS: RhymeFilters = {
  perfect: true,
  near: true,
  slant: true,
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'dark',
  fontSize: 18,
  lineHeight: 1.6,
  highContrast: false,
  rhymeFilters: { ...DEFAULT_RHYME_FILTERS },
  includeRareWords: false,
  lastUpdatedAt: 0,
  badgeSize: 'sm',
  showLineTotals: true,
  rhymeAutoRefresh: true,
  debounceMode: 'typing-250',
}

export const DEFAULT_PANEL_STATE: PanelSchema = {
  rhymePanel: {
    isOpen: false,
    isDetached: false,
    width: 360,
    height: 560,
    position: { x: 96, y: 96 },
  },
  filters: { ...DEFAULT_RHYME_FILTERS },
  searchQuery: '',
  selectedIndex: null,
  syllableFilter: 0,
}

export function createEmptyDraft(docId: string, title = 'Untitled'): DraftSchema {
  const now = Date.now()
  return {
    docId,
    title,
    createdAt: now,
    updatedAt: now,
    lines: [{ id: `${docId}-line-0`, text: '' }],
  }
}

export function createDefaultDraftCollection(): DraftCollection {
  const draft = createEmptyDraft(`draft-${Date.now().toString(16)}`)
  return {
    drafts: [draft],
    activeId: draft.docId,
  }
}
