import eslintConfigNext from 'eslint-config-next'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...eslintConfigNext,
  ...nextTypescript,
  {
    // Keep lint baseline stable after moving to eslint-config-next public flat exports.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
