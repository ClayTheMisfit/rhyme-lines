import { describe, expect, it } from '@jest/globals'
import { getPronunciation } from '@/lib/phonetics/pronunciation'

describe('getPronunciation', () => {
  it('returns expected syllable counts for regression words', () => {
    expect(getPronunciation('fine').syllables).toBe(1)
    expect(getPronunciation('line').syllables).toBe(1)
    expect(getPronunciation('resign').syllables).toBe(2)
    expect(getPronunciation('moon').syllables).toBe(1)
    expect(getPronunciation('soon').syllables).toBe(1)
    expect(getPronunciation('tune').syllables).toBe(1)
    expect(getPronunciation('light').syllables).toBe(1)
    expect(getPronunciation('height').syllables).toBe(1)
    expect(getPronunciation('night').syllables).toBe(1)
    expect(getPronunciation('sight').syllables).toBe(1)
  })

  it('groups rhyme keys for expected families', () => {
    const fine = getPronunciation('fine').rhymeKey
    const line = getPronunciation('line').rhymeKey
    const resign = getPronunciation('resign').rhymeKey
    expect(fine).toBe(line)
    expect(line).toBe(resign)

    const moon = getPronunciation('moon').rhymeKey
    const soon = getPronunciation('soon').rhymeKey
    const tune = getPronunciation('tune').rhymeKey
    expect(moon).toBe(soon)
    expect(soon).toBe(tune)

    const light = getPronunciation('light').rhymeKey
    const height = getPronunciation('height').rhymeKey
    const night = getPronunciation('night').rhymeKey
    const sight = getPronunciation('sight').rhymeKey
    expect(light).toBe(height)
    expect(height).toBe(night)
    expect(night).toBe(sight)
  })

  it('never returns 0 syllables for alphabetic tokens', () => {
    expect(getPronunciation('blorple').syllables).toBeGreaterThanOrEqual(1)
  })

  it('uses override source for known overrides', () => {
    expect(getPronunciation('height').source).toBe('override')
    expect(getPronunciation('resign').source).toBe('override')
    expect(getPronunciation('line').source).toBe('override')
    expect(getPronunciation('tune').source).toBe('override')
  })
})
