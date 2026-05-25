type BuildVisibleSuggestionsOptions = {
  limit?: number
}

export const buildVisibleSuggestions = (
  suggestions: string[],
  options: BuildVisibleSuggestionsOptions = {}
) => {
  const { limit = Number.POSITIVE_INFINITY } = options
  if (limit <= 0) return []

  const unique: string[] = []
  const seen = new Set<string>()

  for (const suggestion of suggestions) {
    const normalized = suggestion.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    if (unique.length >= limit) break
    seen.add(normalized)
    unique.push(suggestion)
  }

  return unique
}
