import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('theme root wiring', () => {
  test('root layout forces dark classes for first paint', () => {
    const layoutPath = join(process.cwd(), 'src/app/layout.tsx')
    const source = readFileSync(layoutPath, 'utf8')

    expect(source).toContain('className="dark"')
    expect(source).toContain('data-theme="dark"')
    expect(source).toContain('bg-black font-sans text-white')
  })
})
