import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { buildRhymeDb, parseCmuDict } from '@/lib/rhyme-db/buildRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, 'data', 'cmudict', 'cmudict.dict')

if (!fs.existsSync(sourcePath)) {
  console.error('Missing pronunciation dictionary.')
  console.error(`Expected file at: ${sourcePath}`)
  console.error('Add a CMUdict-style file at data/cmudict/cmudict.dict and retry.')
  process.exit(1)
}

const content = fs.readFileSync(sourcePath, 'utf8')
const entries = parseCmuDict(content)
const db = buildRhymeDb(entries)

const outputDir = path.join(rootDir, 'public', 'rhyme-db')
const outputPath = path.join(outputDir, `rhyme-db.v${RHYME_DB_VERSION}.json`)
const manifestPath = path.join(outputDir, 'manifest.json')

fs.mkdirSync(outputDir, { recursive: true })

const generatedAt =
  process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString()

const payload = {
  ...db,
  version: RHYME_DB_VERSION,
  generatedAt,
}

fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, 'utf8')

const fileBuffer = fs.readFileSync(outputPath)
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')
const sizeBytes = fileBuffer.byteLength

const manifest = {
  version: RHYME_DB_VERSION,
  generatedAt,
  sha256,
  sizeBytes,
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Wrote rhyme database to ${outputPath}`)
console.log(`Wrote rhyme database manifest to ${manifestPath}`)
