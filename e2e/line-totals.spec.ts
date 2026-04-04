import { expect, test } from '@playwright/test'

test.describe('Line totals gutter', () => {
  test('renders totals after blank lines', async ({ page }) => {
    await page.goto('/')

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('spin test')
    await editor.press('Enter')
    await editor.press('Enter')
    await editor.type('spin test')

    const gutter = page.locator('[data-line-totals-gutter]')
    const editorLines = page.locator('.rl-editor .line')
    const readGutter = async () => (await gutter.innerText()).split('\n').map((line) => line.trim())

    await expect(editorLines).toHaveCount(3)

    await expect.poll(readGutter).toEqual(['2', '0', '2'])
  })

  test('persists per-line totals after inserting new lines', async ({ page }) => {
    await page.goto('/')

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('spin spin')

    const gutter = page.locator('[data-line-totals-gutter]')
    const readGutter = async () => (await gutter.innerText()).split('\n').map((line) => line.trim())

    await expect.poll(readGutter).toEqual(['2'])

    await editor.press('Enter')

    await expect.poll(readGutter).toEqual(['2', '0'])

    await editor.type('cat')

    await expect.poll(readGutter).toEqual(['2', '1'])
  })

  test('keeps gutter rows vertically aligned with editor line boxes', async ({ page }) => {
    await page.goto('/')

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await page.keyboard.insertText(
      `tag bag flag rag gag wag
mat cat hat rat
time fine rhyme
glow snow show
stone alone phone
light night sight
keep deep sleep
crash ash stash
Glow, SNOW. show!
Phone, alone? STONE!

tag home sleep car
stone crash deep mat

1999 was wild
2001 felt strange
2026 looks bright
11 o'clock at night
12:05 in the morning
24/7 on my mind`
    )

    const alignment = await page.evaluate(() => {
      const rowNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-line-totals-row]'))
      const lineNodes = Array.from(document.querySelectorAll<HTMLElement>('.rl-editor .line'))
      if (rowNodes.length === 0 || lineNodes.length === 0 || rowNodes.length !== lineNodes.length) return null

      const centers = lineNodes.map((line, index) => {
        const lineRect = line.getBoundingClientRect()
        const rowRect = rowNodes[index].getBoundingClientRect()
        const lineCenter = lineRect.top + lineRect.height / 2
        const gutterCenter = rowRect.top + rowRect.height / 2
        return {
          index,
          lineCenter,
          gutterCenter,
          delta: Math.abs(lineCenter - gutterCenter),
        }
      })

      return {
        maxDelta: centers.reduce((max, row) => Math.max(max, row.delta), 0),
        sample: centers.slice(0, 4).concat(centers.slice(-4)),
      }
    })

    expect(alignment).not.toBeNull()
    expect(alignment?.maxDelta ?? Number.POSITIVE_INFINITY).toBeLessThan(1.1)
  })
})
