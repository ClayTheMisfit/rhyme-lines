import { act, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useRhymeDecorationOverlay } from '@/hooks/useRhymeDecorationOverlay'
import { RhymeDecorationOverlay } from '@/components/editor/RhymeDecorationOverlay'
import type { RhymeDecorationSnapshot } from '@/lib/rhyme/rhymeDecorations'

let measuredLeft = 10

const decorations: RhymeDecorationSnapshot = {
  tokensByLine: new Map([
    [
      'line-1',
      [
        {
          id: 'line-1-0',
          lineId: 'line-1',
          lineIndex: 0,
          start: 0,
          end: 3,
          word: 'mat',
          familyKey: 'AE T',
          familyId: 0,
          colorIndex: 0,
          underline: true,
          isEndWord: true,
        },
      ],
    ],
  ]),
  familyCount: 1,
  tokenIdToFamilyId: new Map([['line-1-0', 0]]),
  rhymeKeyToTokenIds: new Map([['AE T', ['line-1-0']]]),
}

function Harness({ geometryVersion }: { geometryVersion: number }) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lineElementsRef = useRef<HTMLDivElement[]>([])
  const [, setMounted] = useState(false)

  const rects = useRhymeDecorationOverlay({
    enabled: true,
    editorRef,
    lineElementsRef,
    decorations,
    viewportRange: { start: 0, end: 0 },
    lineVersion: 0,
    geometryVersion,
  })

  return (
    <div
      ref={(node) => {
        editorRef.current = node
        if (node) {
          Object.defineProperty(node, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ left: 0, top: 0, width: 500, height: 80, right: 500, bottom: 80 }),
          })
          setMounted(true)
        }
      }}
      data-testid="editor"
    >
      <div
        ref={(node) => {
          lineElementsRef.current = node ? [node] : []
        }}
        data-testid="line"
        data-line-id="line-1"
        data-line-index="0"
      >
        mat cat rat
      </div>
      <RhymeDecorationOverlay rects={rects} enabled activeFamilyId={null} mode="all" hideColors={false} />
    </div>
  )
}

describe('rhyme decoration overlay geometry invalidation', () => {
  const originalCreateRange = document.createRange
  const originalRequestAnimationFrame = window.requestAnimationFrame

  beforeEach(() => {
    measuredLeft = 10
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    }) as typeof window.requestAnimationFrame
    document.createRange = (() => ({
      setStart: jest.fn(),
      setEnd: jest.fn(),
      detach: jest.fn(),
      getClientRects: () => [{ left: measuredLeft, top: 20, width: 30, height: 18 }] as unknown as DOMRectList,
    })) as typeof document.createRange
  })

  afterEach(() => {
    document.createRange = originalCreateRange
    window.requestAnimationFrame = originalRequestAnimationFrame
  })

  it('replaces stale rhyme highlight and underline geometry when the shared geometry version changes', () => {
    const { rerender } = render(<Harness geometryVersion={0} />)
    expect(screen.getByTestId('editor').querySelector('.rl-rhyme-highlight')).toHaveStyle({ left: '10px' })

    measuredLeft = 42
    act(() => rerender(<Harness geometryVersion={1} />))

    expect(screen.getByTestId('editor').querySelector('.rl-rhyme-highlight')).toHaveStyle({ left: '42px' })
    expect(screen.getByTestId('editor').querySelector('.rl-rhyme-underline')).toHaveStyle({ left: '42px' })
  })
})
