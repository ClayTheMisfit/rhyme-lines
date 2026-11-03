import crypto from 'node:crypto'
import { expect, test } from '@playwright/test'

type RhymeIndex = {
  keys: string[]
  offsets: number[]
  wordIds: number[]
}

type RhymeDb = {
  version: number
  generatedAt: string
  source: { name: string }
  words: string[]
  syllables: number[]
  freqByWordId: number[]
  isCommonByWordId: number[]
  indexes: Record<'perfect' | 'vowel' | 'coda', RhymeIndex>
}

type RhymeDbManifest = {
  version: number
  generatedAt: string
  sha256: string
  sizeBytes: number
}

test('serves the generated v2 rhyme database with matching manifest metadata', async ({ request }) => {
  const [assetResponse, manifestResponse] = await Promise.all([
    request.get('/rhyme-db/rhyme-db.v2.json?v=2'),
    request.get('/rhyme-db/manifest.json'),
  ])

  expect(assetResponse.status(), 'versioned rhyme DB must not return 404').toBe(200)
  expect(assetResponse.headers()['content-type']).toContain('application/json')
  expect(manifestResponse.status()).toBe(200)

  const assetBody = await assetResponse.body()
  const payload = JSON.parse(assetBody.toString('utf8')) as RhymeDb
  const manifest = await manifestResponse.json() as RhymeDbManifest
  const sha256 = crypto.createHash('sha256').update(assetBody).digest('hex')

  expect(assetBody.byteLength).toBeGreaterThan(1_000_000)
  expect(payload.version).toBe(2)
  expect(payload.source.name).toBe('cmudict')
  expect(payload.words.length).toBeGreaterThan(100_000)
  expect(payload.syllables).toHaveLength(payload.words.length)
  expect(payload.freqByWordId).toHaveLength(payload.words.length)
  expect(payload.isCommonByWordId).toHaveLength(payload.words.length)

  for (const name of ['perfect', 'vowel', 'coda'] as const) {
    expect(payload.indexes[name].keys.length).toBeGreaterThan(0)
    expect(payload.indexes[name].offsets).toHaveLength(payload.indexes[name].keys.length + 1)
    expect(payload.indexes[name].wordIds.length).toBeGreaterThan(0)
  }

  expect(manifest).toMatchObject({
    version: 2,
    generatedAt: payload.generatedAt,
    sizeBytes: assetBody.byteLength,
    sha256,
  })
})
