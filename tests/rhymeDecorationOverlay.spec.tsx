import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { RhymeDecorationOverlay } from '@/components/editor/RhymeDecorationOverlay'

describe('RhymeDecorationOverlay', () => {
  const rects = [
    {
      id: 'line-0-0',
      lineId: 'line-0',
      familyId: 1,
      colorIndex: 1,
      isEndWord: false,
      underline: false,
      rect: { left: 10, top: 4, width: 36, height: 18 },
    },
    {
      id: 'line-0-1',
      lineId: 'line-0',
      familyId: 2,
      colorIndex: 2,
      isEndWord: true,
      underline: true,
      rect: { left: 55, top: 4, width: 40, height: 18 },
    },
  ]

  it('renders visible highlight spans with position and color style variables', () => {
    const { container } = render(
      <RhymeDecorationOverlay rects={rects} enabled activeFamilyId={2} mode="all" hideColors={false} />
    )

    const highlights = container.querySelectorAll('.rl-rhyme-highlight')
    expect(highlights).toHaveLength(2)

    const first = highlights[0] as HTMLElement
    expect(first.getAttribute('data-rhyme-family')).toBe('1')
    expect(first.style.left).toBe('10px')
    expect(first.style.width).toBe('36px')
    expect(first.style.getPropertyValue('--rhyme-color')).toContain('rgba(')
  })

  it('keeps focus mode tied to active family while preserving end-word rendering', () => {
    const { container, rerender } = render(
      <RhymeDecorationOverlay rects={rects} enabled activeFamilyId={null} mode="focus" hideColors={false} />
    )

    expect(container.querySelectorAll('.rl-rhyme-highlight')).toHaveLength(1)

    rerender(<RhymeDecorationOverlay rects={rects} enabled activeFamilyId={1} mode="focus" hideColors={false} />)
    expect(container.querySelectorAll('.rl-rhyme-highlight')).toHaveLength(2)
  })
})

describe('rhyme highlight theme visibility styles', () => {
  it('defines explicit light and dark theme fill strengths for rhyme highlights', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

    expect(css).toContain('body.bg-black .rl-rhyme-highlight[data-rhyme-family]')
    expect(css).toContain('--rhyme-fill-strength: 100%')
    expect(css).toContain('body.bg-white .rl-rhyme-highlight[data-rhyme-family]')
    expect(css).toContain('--rhyme-fill-strength: 92%')
  })
})
