import { NextResponse } from 'next/server'
import { buildWordnikSuggestions, type WordnikRelatedResponse } from '@/lib/rhyme/providers/wordnik'

const WORDNIK_BASE_URL = 'https://api.wordnik.com/v4'

type WordnikQueryType = 'perfect' | 'slant'

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

  try {
    const url = new URL(
      `${WORDNIK_BASE_URL}/word.json/${encodeURIComponent(word.toLowerCase())}/relatedWords`
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

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Wordnik API request failed:', error)
    return NextResponse.json({ error: 'Failed to fetch Wordnik data' }, { status: 500 })
  }
}
