import fs from 'node:fs'
import path from 'node:path'

const outPath = path.join(process.cwd(), 'public', 'rhyme-db', 'rhyme-db.v2.json')

if (!fs.existsSync(outPath)) {
  console.error('Missing generated rhyme DB at public/rhyme-db/rhyme-db.v2.json')
  process.exit(1)
}

console.log(`Found generated rhyme DB at ${outPath}`)
