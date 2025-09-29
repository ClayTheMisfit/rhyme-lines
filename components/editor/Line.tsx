import React from "react"
import SyllableWord from "./SyllableWord"

export type Token = {
  text: string
  syl: number
  kind: "word" | "space"
}

type Props = {
  tokens: Token[]
  showCounts: boolean
  className?: string
  wordClassName?: string
}

export default function Line({
  tokens,
  showCounts,
  className = "",
  wordClassName = "",
}: Props) {
  if (tokens.length === 0) {
    return (
      <div className={`rl-overlay-line ${className}`}>
        <span className="whitespace-pre">{" "}</span>
      </div>
    )
  }

  return (
    <div className={`rl-overlay-line ${className}`}>
      {tokens.map((token, index) => {
        if (token.kind === "space") {
          return (
            <span key={index} className="whitespace-pre">
              {token.text}
            </span>
          )
        }

        return (
          <SyllableWord
            key={index}
            word={token.text}
            syllables={token.syl}
            showCounts={showCounts}
            className="mx-0"
            wordClassName={wordClassName}
          />
        )
      })}
    </div>
  )
}
