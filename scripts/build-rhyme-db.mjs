import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, 'data', 'cmudict', 'cmudict.dict')
process.env.TSX_TSCONFIG_PATH = path.join(rootDir, 'tsconfig.json')
process.env.ESBUILD_BINARY_PATH =
  process.env.ESBUILD_BINARY_PATH ??
  path.join(rootDir, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe')
process.env.TSX_RESOLVE_EXTENSIONS =
  process.env.TSX_RESOLVE_EXTENSIONS ?? '.ts,.tsx,.js,.jsx,.mjs,.cjs'

const main = async () => {
  if (!fs.existsSync(sourcePath)) {
    console.error('Missing pronunciation dictionary.')
    console.error(`Expected file at: ${sourcePath}`)
    console.error('Add a CMUdict-style file at data/cmudict/cmudict.dict and retry.')
    process.exit(1)
  }

  const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const buildScript = path.join(rootDir, 'scripts', 'build-rhyme-db.ts')
  const result = spawnSync(process.execPath, [tsxCli, buildScript], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: process.env.TSX_TSCONFIG_PATH,
      ESBUILD_BINARY_PATH: process.env.ESBUILD_BINARY_PATH,
      TSX_RESOLVE_EXTENSIONS: process.env.TSX_RESOLVE_EXTENSIONS,
    },
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  const versionContent = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'rhyme-db', 'version.ts'), 'utf8')
  const versionMatch = versionContent.match(/RHYME_DB_VERSION\s*=\s*(\d+)/)
  const RHYME_DB_VERSION = versionMatch ? Number(versionMatch[1]) : NaN
  if (!Number.isFinite(RHYME_DB_VERSION)) {
    throw new Error('Unable to parse RHYME_DB_VERSION')
  }

  const outputDir = path.join(rootDir, 'public', 'rhyme-db')
  const outputPath = path.join(outputDir, `rhyme-db.v${RHYME_DB_VERSION}.json`)
  const size = fs.statSync(outputPath).size
  console.log(`[build:rhyme-db] wrote ${outputPath} (${size} bytes)`)
}

main().catch((error) => {
  console.error('[build:rhyme-db] failed', error)
  process.exit(1)
})
