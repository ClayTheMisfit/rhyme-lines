import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('theme root wiring', () => {
  test('root layout body uses semantic theme classes', () => {
    const layoutPath = join(process.cwd(), 'src/app/layout.tsx')
    const source = readFileSync(layoutPath, 'utf8')

    expect(source).toContain('bg-background')
    expect(source).toContain('text-foreground')
    expect(source).not.toContain('bg-black font-sans text-white')
  })
})
