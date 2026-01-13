/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import { buildRhymeDb, parseCmuDict } from '@/lib/rhyme-db/buildRhymeDb'

const loadFixture = () => {
  const fixturePath = path.join(__dirname, '__fixtures__', 'cmudict.sample.dict')
  const content = fs.readFileSync(fixturePath, 'utf8')
  return buildRhymeDb(parseCmuDict(content))
}

const getPostings = (keys: string[], offsets: number[], wordIds: number[], key: string) => {
  const keyIndex = keys.indexOf(key)
  if (keyIndex === -1) {
    return null
  }

  const start = offsets[keyIndex]
  const end = offsets[keyIndex + 1]
  return wordIds.slice(start, end)
}

describe('buildRhymeDb', () => {
  it('creates perfect rhyme postings for TIME', () => {
    const db = loadFixture()
    const timeId = db.words.indexOf('time')

    expect(timeId).toBeGreaterThanOrEqual(0)
    const postings = getPostings(
      db.indexes.perfect.keys,
      db.indexes.perfect.offsets,
      db.indexes.perfect.wordIds,
      'AY-M'
    )

    expect(postings).not.toBeNull()
    expect(postings).toContain(timeId)
  })

  it('groups BLUE and THROUGH under the same perfect key', () => {
    const db = loadFixture()
    const blueId = db.words.indexOf('blue')
    const throughId = db.words.indexOf('through')

    const postings = getPostings(
      db.indexes.perfect.keys,
      db.indexes.perfect.offsets,
      db.indexes.perfect.wordIds,
      'UW'
    )

    expect(postings).not.toBeNull()
    expect(postings).toEqual(expect.arrayContaining([blueId, throughId]))
  })

  it('dedupes READ in words but includes both pronunciations in indexes', () => {
    const db = loadFixture()
    const readId = db.words.indexOf('read')

    expect(db.words.filter((word) => word === 'read')).toHaveLength(1)
    expect(db.syllables[readId]).toBe(1)

    const iyPostings = getPostings(
      db.indexes.perfect.keys,
      db.indexes.perfect.offsets,
      db.indexes.perfect.wordIds,
      'IY-D'
    )
    const ehPostings = getPostings(
      db.indexes.perfect.keys,
      db.indexes.perfect.offsets,
      db.indexes.perfect.wordIds,
      'EH-D'
    )

    expect(iyPostings).toContain(readId)
    expect(ehPostings).toContain(readId)
  })

  it('builds the expected perfect key for NATION', () => {
    const db = loadFixture()
    const nationId = db.words.indexOf('nation')

    const postings = getPostings(
      db.indexes.perfect.keys,
      db.indexes.perfect.offsets,
      db.indexes.perfect.wordIds,
      'EY-SH-AH-N'
    )

    expect(postings).not.toBeNull()
    expect(postings).toContain(nationId)
  })

  it('assigns frequency ranks when available', () => {
    const db = loadFixture()
    const timeId = db.words.indexOf('time')
    const unknownId = db.words.indexOf('through')

    expect(db.freqByWordId?.[timeId]).toBeGreaterThan(0)
    expect(db.freqByWordId?.[unknownId]).toBe(0)
  })
})
