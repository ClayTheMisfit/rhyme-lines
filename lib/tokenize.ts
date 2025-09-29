export function tokenizeKeepPunctuation(input: string): string[] {
  const re = /\S+(?:[)\]\.,!?:;…'\"])?|\n/g
  return Array.from(input.matchAll(re)).map(match => match[0])
}
