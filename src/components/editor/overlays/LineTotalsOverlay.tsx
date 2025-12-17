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
  if (!showLineTotals) return null

  const gutterLines = lines.map((line, i) => {
    const total = lineTotals[i] ?? 0
    return line.trim() === '' ? '\u00A0' : total.toString()
  })

  const themeClass = theme === 'dark' ? 'gutterMirror-dark' : 'gutterMirror-light'

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 w-full h-0 z-20"
      style={{ transform: "translateZ(0)" }}
    >
      <div
        className="absolute top-0 left-0 w-[2.25rem] md:w-[2.5rem] text-right pr-1"
        data-line-totals-gutter
      >
        <pre className={`gutterMirror ${themeClass}`}>
          {gutterLines.join('\n')}
        </pre>
      </div>
    </div>
  )
}
