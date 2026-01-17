import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'

export const buildDbUrl = (baseUrl: string, version: number = RHYME_DB_VERSION) => {
  const url = new URL(`/rhyme-db/rhyme-db.v${version}.json`, baseUrl)
  url.searchParams.set('v', String(version))
  return url.toString()
}
