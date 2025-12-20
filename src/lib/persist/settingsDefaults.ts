import { DEFAULT_SETTINGS, type SettingsSchema } from './schema'

export const applySettingsDefaults = (incoming: SettingsSchema): SettingsSchema => ({
  ...DEFAULT_SETTINGS,
  ...incoming,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters, ...incoming.rhymeFilters },
  lastUpdatedAt: incoming.lastUpdatedAt || Date.now(),
})

export const SETTINGS_DEFAULTS: SettingsSchema = applySettingsDefaults({
  ...DEFAULT_SETTINGS,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters },
  lastUpdatedAt: Date.now(),
})
