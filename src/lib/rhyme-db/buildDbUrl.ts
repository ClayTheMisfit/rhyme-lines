export const buildDbUrl = (baseUrl: string) => {
  return new URL('/rhyme-db/rhyme-db.v1.json', baseUrl).toString()
}
