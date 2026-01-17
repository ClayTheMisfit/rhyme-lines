import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const targetPath = path.join(rootDir, 'public', 'rhyme-db', 'rhyme-db.v2.json')

try {
  const stats = fs.statSync(targetPath)
  if (!stats.isFile()) {
    throw new Error('Path exists but is not a file')
  }
  console.log(`[check:rhyme-db] found ${targetPath} (${stats.size} bytes)`)
} catch (error) {
  console.error(`[check:rhyme-db] missing file: ${targetPath}`)
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
