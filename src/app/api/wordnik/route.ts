import { NextResponse } from 'next/server'
import { buildWordnikSuggestions, type WordnikRelatedResponse } from '@/lib/rhyme/providers/wordnik'
import type { RhymeSuggestion } from '@/lib/rhyme/providers/datamuse'

const WORDNIK_BASE_URL = 'https://api.wordnik.com/v4'
const WORDNIK_RATE_LIMIT_MS = 100
const WORDNIK_CACHE_TTL_MS = 60_000
const WORDNIK_WINDOW_MS = 60_000
const WORDNIK_MAX_REQUESTS_PER_WINDOW = 20

type WordnikQueryType = 'perfect' | 'slant'

let lastRequestTime = 0
let recentRequestTimes: number[] = []
const wordnikCache: Record<
  string,
  { data: { suggestions: RhymeSuggestion[] }; expiresAt: number }
> = {}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const word = searchParams.get('word')?.trim()
  const typeParam = (searchParams.get('type')?.toLowerCase() as WordnikQueryType) || 'perfect'
  const rhymeType: WordnikQueryType = typeParam === 'slant' ? 'slant' : 'perfect'

  if (!word) {
    return NextResponse.json({ error: 'Missing word parameter' }, { status: 400 })
  }

  const apiKey = process.env.WORDNIK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Wordnik API key not configured' }, { status: 500 })
  }

  const normalizedWord = word.toLowerCase()
  const cacheKey = `${normalizedWord}-${rhymeType}`
  const cached = wordnikCache[cacheKey]
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data)
  }

  const now = Date.now()
  if (now - lastRequestTime < WORDNIK_RATE_LIMIT_MS) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  recentRequestTimes = recentRequestTimes.filter((timestamp) => now - timestamp < WORDNIK_WINDOW_MS)
  if (recentRequestTimes.length >= WORDNIK_MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  lastRequestTime = now
  recentRequestTimes.push(now)

  try {
    const url = new URL(
      `${WORDNIK_BASE_URL}/word.json/${encodeURIComponent(normalizedWord)}/relatedWords`
    )
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('relationshipTypes', rhymeType === 'perfect' ? 'rhyme' : 'similar-to')
    url.searchParams.set('limitPerRelationshipType', rhymeType === 'perfect' ? '50' : '30')
    url.searchParams.set('useCanonical', 'true')

    const response = await fetch(url.toString())
    if (!response.ok) {
      return NextResponse.json(
        { error: `Wordnik request failed with status ${response.status}` },
        { status: response.status }
      )
    }

    const data = (await response.json()) as WordnikRelatedResponse[]
    const suggestions = buildWordnikSuggestions(word, data, rhymeType)
    const responseBody = { suggestions }
    wordnikCache[cacheKey] = {
      data: responseBody,
      expiresAt: Date.now() + WORDNIK_CACHE_TTL_MS,
    }

    return NextResponse.json(responseBody)
  } catch (error) {
    console.error('Wordnik API request failed:', error)
    return NextResponse.json({ error: 'Failed to fetch Wordnik data' }, { status: 500 })
  }
}
