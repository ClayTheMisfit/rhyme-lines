import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import nextVitals from 'eslint-config-next/core-web-vitals.js'
import nextTypescript from 'eslint-config-next/typescript.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.config(nextVitals),
  ...compat.config(nextTypescript),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
]
