import { render } from '@testing-library/react'
import LineTotalsOverlay from '@/components/editor/overlays/LineTotalsOverlay'

describe('LineTotalsOverlay', () => {
  it('renders one visible total per non-empty line for punctuation and compact numeric lines', () => {
    const lines = [
      'Glow, SNOW. show!',
      'Phone, alone? STONE!',
      '',
      '24/7 on my mind',
    ]

    render(
      <LineTotalsOverlay
        lineTotals={[3, 4, 0, 8]}
        lines={lines}
        showLineTotals
        theme="dark"
      />
    )

    const gutter = document.querySelector('[data-line-totals-gutter]')
    const rows = Array.from(document.querySelectorAll('[data-line-totals-row]')).map((node) => node.textContent)
    expect(gutter).toBeTruthy()
    expect(rows).toEqual(['3', '4', '\u00A0', '8'])
  })
})
