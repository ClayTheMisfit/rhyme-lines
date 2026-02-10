const WORD_CLEAN_REGEX = /(^[^a-z0-9]+|[^a-z0-9]+$)/gi

const STOPWORDS_LIST = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have', 'had',
  'he', 'her', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just',
  'me', 'my', 'mine', 'no', 'not', 'of', 'on', 'or', 'our', 'ours', 'out', 'she', 'so', 'that',
  'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to',
  'too', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'will',
  'with', 'you', 'your', 'yours',
]

export const STOPWORDS = new Set(STOPWORDS_LIST)

export const normalizeStopword = (word: string) =>
  word
    .toLowerCase()
    .replace(WORD_CLEAN_REGEX, '')

export const isStopword = (word: string) => {
  const normalized = normalizeStopword(word)
  if (!normalized) return false
  return STOPWORDS.has(normalized)
}
