import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const versionPath = path.join(rootDir, 'src', 'lib', 'rhyme-db', 'version.ts')

const versionContent = fs.readFileSync(versionPath, 'utf8')
const versionMatch = versionContent.match(/RHYME_DB_VERSION\s*=\s*(\d+)/)
const RHYME_DB_VERSION = versionMatch ? Number(versionMatch[1]) : NaN

if (!Number.isFinite(RHYME_DB_VERSION)) {
  console.error('[check-rhyme-db] Unable to parse RHYME_DB_VERSION')
  process.exit(1)
}

const outputDir = path.join(rootDir, 'public', 'rhyme-db')
const outputPath = path.join(outputDir, `rhyme-db.v${RHYME_DB_VERSION}.json`)
const manifestPath = path.join(outputDir, 'manifest.json')

if (!fs.existsSync(outputPath)) {
  console.error(`[check-rhyme-db] Missing rhyme DB file at ${outputPath}`)
  process.exit(1)
}

const size = fs.statSync(outputPath).size
console.log(`[check-rhyme-db] Found ${outputPath} (${size} bytes)`) 

if (size < 1_000_000) {
  console.error(`[check-rhyme-db] Rhyme DB is unexpectedly small: ${size} bytes`)
  process.exit(1)
}

let payload
try {
  payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
} catch (error) {
  console.error('[check-rhyme-db] Failed to parse rhyme DB JSON', error)
  process.exit(1)
}

if (payload?.version !== RHYME_DB_VERSION) {
  console.error(
    `[check-rhyme-db] Version mismatch: expected v${RHYME_DB_VERSION}, got v${payload?.version ?? 'unknown'}`
  )
  process.exit(1)
}

const indexes = payload?.indexes
const requiredIndexes = ['perfect', 'vowel', 'coda']
const wordsLength = Array.isArray(payload?.words) ? payload.words.length : 0
const hasValidIndex = (index) =>
  index &&
  Array.isArray(index.keys) &&
  Array.isArray(index.offsets) &&
  Array.isArray(index.wordIds) &&
  index.offsets.length === index.keys.length + 1

if (
  wordsLength === 0 ||
  !Array.isArray(payload?.syllables) ||
  payload.syllables.length !== wordsLength ||
  !Array.isArray(payload?.freqByWordId) ||
  payload.freqByWordId.length !== wordsLength ||
  !Array.isArray(payload?.isCommonByWordId) ||
  payload.isCommonByWordId.length !== wordsLength ||
  payload?.source?.name !== 'cmudict' ||
  !requiredIndexes.every((name) => hasValidIndex(indexes?.[name]))
) {
  console.error('[check-rhyme-db] Invalid rhyme DB structure')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
} catch (error) {
  console.error('[check-rhyme-db] Failed to parse rhyme DB manifest', error)
  process.exit(1)
}

const sha256 = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex')
if (
  manifest?.version !== RHYME_DB_VERSION ||
  manifest?.sizeBytes !== size ||
  manifest?.sha256 !== sha256 ||
  manifest?.generatedAt !== payload.generatedAt
) {
  console.error('[check-rhyme-db] Manifest metadata does not match the generated asset', {
    expectedVersion: RHYME_DB_VERSION,
    actualVersion: manifest?.version,
    expectedSize: size,
    actualSize: manifest?.sizeBytes,
    expectedSha256: sha256,
    actualSha256: manifest?.sha256,
  })
  process.exit(1)
}

console.log(
  `[check-rhyme-db] Verified v${RHYME_DB_VERSION}, ${wordsLength} words, ${size} bytes, sha256 ${sha256}`
)
