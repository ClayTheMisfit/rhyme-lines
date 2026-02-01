export type RhymeTokenPosition = {
  tokenId: string
  lineId: string
  lineIndex: number
  rects: Array<{ top: number; left: number; width: number; height: number }>
}
