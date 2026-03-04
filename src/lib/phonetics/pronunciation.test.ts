import { describe, expect, it } from '@jest/globals'
import { getLookupCandidates, getPronunciation, normalizeApostrophes } from '@/lib/phonetics/pronunciation'

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

  it('unifies possessives with base pronunciations for syllables and rhyme keys', () => {
    const night = getPronunciation('night')
    const nights = getPronunciation("night's")
    expect(nights.syllables).toBe(night.syllables)
    expect(nights.rhymeKey).toBe(night.rhymeKey)

    const height = getPronunciation('height')
    const heightsCurly = getPronunciation('height’s')
    expect(heightsCurly.syllables).toBe(height.syllables)
    expect(heightsCurly.rhymeKey).toBe(height.rhymeKey)

    const light = getPronunciation('light')
    const lights = getPronunciation("light's")
    expect(lights.syllables).toBe(light.syllables)
    expect(lights.rhymeKey).toBe(light.rhymeKey)

    const dogs = getPronunciation('dogs')
    const dogsPossessive = getPronunciation("dogs'")
    expect(dogsPossessive.syllables).toBe(dogs.syllables)
    expect(dogsPossessive.rhymeKey).toBe(dogs.rhymeKey)
  })

  it("normalizes contractions and keeps 'its' stable", () => {
    const its = getPronunciation('its')
    const itsContraction = getPronunciation("it's")
    expect(itsContraction.syllables).toBe(its.syllables)
    expect(itsContraction.rhymeKey).toBe(its.rhymeKey)

    expect(getLookupCandidates("we're")).toContain('were')
    expect(getLookupCandidates('its')).toEqual(['its'])
  })


  it('keeps rhyme keys stable across punctuation and casing', () => {
    const base = getPronunciation('light').rhymeKey
    expect(getPronunciation('Light,').rhymeKey).toBe(base)
    expect(getPronunciation('HEIGHT.').rhymeKey).toBe(base)
    expect(getPronunciation('night!').rhymeKey).toBe(base)
    expect(getPronunciation('Sight?').rhymeKey).toBe(base)
  })

  it('normalizes curly possessives for syllables and rhyme keys', () => {
    expect(getPronunciation('night’s').syllables).toBe(1)
    expect(getPronunciation('height’s').syllables).toBe(1)
    expect(getPronunciation('night’s').rhymeKey).toBe(getPronunciation('night').rhymeKey)
    expect(getPronunciation('height’s').rhymeKey).toBe(getPronunciation('height').rhymeKey)
  })

  it("treats y’all like yall with one syllable", () => {
    const curly = getPronunciation('y’all')
    const plain = getPronunciation('yall')
    expect(curly.syllables).toBe(1)
    expect(curly.rhymeKey).toBe(plain.rhymeKey)
    expect(curly.rhymeKey.length).toBeGreaterThan(0)
  })

  it('normalizes curly apostrophes', () => {
    expect(normalizeApostrophes('night’s')).toBe("night's")
    expect(normalizeApostrophes('dogs‘')).toBe("dogs'")
  })
})
