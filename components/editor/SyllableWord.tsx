import React from "react"

export type SyllableWordProps = {
  word: string
  syllables: number
  showCounts?: boolean
  className?: string
  wordClassName?: string
}

export default function SyllableWord({
  word,
  syllables,
  showCounts = true,
  className = "",
  wordClassName = "",
}: SyllableWordProps) {
  return (
    <span className={`inline-flex flex-col items-center mx-0.5 align-baseline ${className}`}>
      {showCounts && (
        <span
          className="text-[10px] leading-none text-muted-foreground/90 select-none pointer-events-none mb-0.5 tabular-nums"
          aria-hidden="true"
        >
          {syllables}
        </span>
      )}
      <span className={`whitespace-pre ${wordClassName}`}>{word}</span>
    </span>
  )
}
