// Simple heuristic fallback; use your real engine if available.
export function estimateSyllables(word: string): number {
  const normalized = (word || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")

  if (!normalized) return 0

  let count = (normalized.match(/[aeiouy]{1,2}/g) || []).length

  if (normalized.endsWith("e")) count -= 1

  if (/(ia|io|ii|eo|ua)/.test(normalized)) count += 1

  if (/(cial|tia|cius|cian|giu|ion|iou)$/.test(normalized)) count += 1

  if (/(ted|tes|ses|ied)$/.test(normalized)) count -= 1

  return Math.max(1, count)
}
