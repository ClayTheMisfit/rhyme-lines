import { DEFAULT_SETTINGS, type SettingsSchema } from './schema'

export const applySettingsDefaults = (incoming: SettingsSchema): SettingsSchema => ({
  ...DEFAULT_SETTINGS,
  ...incoming,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters, ...incoming.rhymeFilters },
  rhymeHighlightColors: { ...DEFAULT_SETTINGS.rhymeHighlightColors, ...(incoming.rhymeHighlightColors ?? {}) },
  showVariants: false,
  lastUpdatedAt: incoming.lastUpdatedAt || Date.now(),
})

export const SETTINGS_DEFAULTS: SettingsSchema = applySettingsDefaults({
  ...DEFAULT_SETTINGS,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters },
  rhymeHighlightColors: { ...DEFAULT_SETTINGS.rhymeHighlightColors },
  lastUpdatedAt: Date.now(),
})
