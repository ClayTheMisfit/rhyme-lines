import fs from 'node:fs'
import path from 'node:path'
import { buildRhymeDb, parseCmuDict } from '@/lib/rhyme-db/buildRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, 'data', 'cmudict', 'cmudict.dict')

const build = async () => {
  if (!fs.existsSync(sourcePath)) {
    console.error('Missing pronunciation dictionary.')
    console.error(`Expected file at: ${sourcePath}`)
    console.error('Add a CMUdict-style file at data/cmudict/cmudict.dict and retry.')
    process.exit(1)
  }

  const content = fs.readFileSync(sourcePath, 'utf8')
  const entries = parseCmuDict(content)
  const db = buildRhymeDb(entries)

  const outDir = path.join(rootDir, 'public', 'rhyme-db')
  const outPath = path.join(outDir, 'rhyme-db.v2.json')

  await fs.promises.mkdir(outDir, { recursive: true })
  const payload = {
    ...db,
    version: RHYME_DB_VERSION,
    generatedAt: new Date().toISOString(),
  }

  await fs.promises.writeFile(outPath, `${JSON.stringify(payload)}\n`, 'utf8')
  if (!fs.existsSync(outPath)) {
    throw new Error('rhyme-db.v2.json was not generated')
  }

  console.log(`Wrote rhyme database to ${outPath}`)
}

build().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
