import { resolveOverlayCacheReuse } from './useOverlayMeasurement'

describe('resolveOverlayCacheReuse', () => {
  test('requires remeasure when rhymes were not previously measured and rhyme overlay is enabled', () => {
    const decision = resolveOverlayCacheReuse(
      {
        measured: { syllables: true, rhymes: false },
        tokens: [],
      },
      { syllableEnabled: true, rhymeEnabled: true }
    )

    expect(decision.canReuseSyllables).toBe(true)
    expect(decision.canReuseRhymes).toBe(false)
    expect(decision.canReuse).toBe(false)
  })

  test('requires remeasure when syllables were not previously measured and syllable overlay is enabled', () => {
    const decision = resolveOverlayCacheReuse(
      {
        measured: { syllables: false, rhymes: true },
        rhymeTokens: [],
      },
      { syllableEnabled: true, rhymeEnabled: true }
    )

    expect(decision.canReuseSyllables).toBe(false)
    expect(decision.canReuseRhymes).toBe(true)
    expect(decision.canReuse).toBe(false)
  })

  test('allows reuse when enabled overlays were measured previously', () => {
    const decision = resolveOverlayCacheReuse(
      {
        measured: { syllables: true, rhymes: true },
        tokens: [],
        rhymeTokens: [],
      },
      { syllableEnabled: true, rhymeEnabled: true }
    )

    expect(decision.canReuse).toBe(true)
  })
})
