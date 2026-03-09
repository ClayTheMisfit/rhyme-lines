import { DEFAULT_SETTINGS, type SettingsSchema } from './schema'

export const applySettingsDefaults = (incoming: SettingsSchema): SettingsSchema => ({
  ...DEFAULT_SETTINGS,
  ...incoming,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters, ...incoming.rhymeFilters },
  showVariants: false,
  showRhymeDecorations: incoming.showRhymeDecorations ?? DEFAULT_SETTINGS.showRhymeDecorations,
  showInternalRhymes: incoming.showInternalRhymes ?? DEFAULT_SETTINGS.showInternalRhymes,
  highlightStopwords: incoming.highlightStopwords ?? DEFAULT_SETTINGS.highlightStopwords,
  rhymeHighlightMode: incoming.rhymeHighlightMode ?? DEFAULT_SETTINGS.rhymeHighlightMode,
  hideRhymeColors: incoming.hideRhymeColors ?? DEFAULT_SETTINGS.hideRhymeColors,
  rhymeDebugOverlay: incoming.rhymeDebugOverlay ?? DEFAULT_SETTINGS.rhymeDebugOverlay,
  useOnlineRhymeProviders: incoming.useOnlineRhymeProviders ?? DEFAULT_SETTINGS.useOnlineRhymeProviders,
  lastUpdatedAt: incoming.lastUpdatedAt || Date.now(),
})

export const SETTINGS_DEFAULTS: SettingsSchema = applySettingsDefaults({
  ...DEFAULT_SETTINGS,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters },
  lastUpdatedAt: Date.now(),
})
