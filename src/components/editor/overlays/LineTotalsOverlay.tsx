import React from "react"

type Props = {
  lineTotals: number[]
  lines: string[]
  showLineTotals: boolean
  theme: 'light' | 'dark'
}

export default function LineTotalsOverlay({ 
  lineTotals,
  lines,
  showLineTotals,
  theme 
}: Props) {
  const gutterLines = lines.map((line, i) => {
    const total = lineTotals[i] ?? 0
    return line.trim() === '' ? '\u00A0' : total.toString()
  })

  const themeClass = theme === 'dark' ? 'gutterMirror-dark' : 'gutterMirror-light'

  return (
    <pre
      aria-hidden
      data-line-totals-gutter
      className={`gutterMirror ${themeClass} ${showLineTotals ? '' : 'opacity-0'} pointer-events-none`}
    >
      {(showLineTotals ? gutterLines : ['\u00A0']).join('\n')}
    </pre>
  )
}
