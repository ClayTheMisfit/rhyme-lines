import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'

export const buildDbUrl = (baseUrl: string) => {
  const url = new URL(`/rhyme-db/rhyme-db.v${RHYME_DB_VERSION}.json`, baseUrl)
  url.searchParams.set('v', String(RHYME_DB_VERSION))
  return url.toString()
}
