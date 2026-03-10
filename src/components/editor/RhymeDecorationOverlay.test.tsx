import { render, screen } from '@testing-library/react'
import { RhymeDecorationOverlay } from '@/components/editor/RhymeDecorationOverlay'
import { OverlayBadge } from '@/components/editor/OverlayBadge'

describe('RhymeDecorationOverlay', () => {
  it('renders visible rhyme highlight metadata when family ids are present', () => {
    const rects = [
      {
        id: 'line-0-0-0',
        lineId: 'line-0',
        familyId: 2,
        colorIndex: 2,
        isEndWord: true,
        underline: false,
        rect: { left: 8, top: 12, width: 20, height: 16 },
      },
    ]

    const { container } = render(
      <RhymeDecorationOverlay
        rects={rects}
        enabled
        activeFamilyId={2}
        mode="all"
        hideColors={false}
      />
    )

    const highlight = container.querySelector('.rl-rhyme-highlight[data-rhyme-family="2"]')
    expect(highlight).not.toBeNull()
    expect(highlight).toHaveAttribute('data-rhyme-active')
  })

  it('keeps syllable badges and rhyme highlights renderable together', () => {
    const rects = [
      {
        id: 'line-0-0-0',
        lineId: 'line-0',
        familyId: 0,
        colorIndex: 0,
        isEndWord: true,
        underline: true,
        rect: { left: 0, top: 0, width: 30, height: 18 },
      },
    ]

    const { container } = render(
      <div>
        <RhymeDecorationOverlay
          rects={rects}
          enabled
          activeFamilyId={0}
          mode="all"
          hideColors={false}
        />
        <OverlayBadge value={1} active position={{ left: 4, top: 4, lineOffset: 1 }} lineId="line-0" />
      </div>
    )

    expect(container.querySelector('.rl-rhyme-highlight[data-rhyme-family="0"]')).not.toBeNull()
    expect(container.querySelector('.rl-rhyme-underline[data-rhyme-family="0"]')).not.toBeNull()
    expect(screen.getByTitle('1 syllable')).toHaveClass('syllable-badge')
  })
})
