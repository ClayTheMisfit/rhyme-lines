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

if (!fs.existsSync(outputPath)) {
  console.error(`[check-rhyme-db] Missing rhyme DB file at ${outputPath}`)
  process.exit(1)
}

const size = fs.statSync(outputPath).size
console.log(`[check-rhyme-db] Found ${outputPath} (${size} bytes)`) 

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

console.log(`[check-rhyme-db] Verified rhyme DB version v${RHYME_DB_VERSION}`)
