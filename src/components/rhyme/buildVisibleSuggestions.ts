type BuildVisibleSuggestionsOptions = {
  limit?: number
}

export const buildVisibleSuggestions = (
  suggestions: string[],
  options: BuildVisibleSuggestionsOptions = {}
) => {
  const { limit = Number.POSITIVE_INFINITY } = options
  const unique: string[] = []
  const seen = new Set<string>()

  for (const suggestion of suggestions) {
    const normalized = suggestion.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(suggestion)
    if (unique.length >= limit) break
  }

  return unique
}
