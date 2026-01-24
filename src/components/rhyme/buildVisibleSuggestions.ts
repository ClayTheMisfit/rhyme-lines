export const DEFAULT_SUGGESTION_CAP = 500

export const buildVisibleSuggestions = (suggestions: string[], cap: number = DEFAULT_SUGGESTION_CAP) =>
  suggestions.slice(0, Math.min(cap, suggestions.length))
