import { expect, test } from '@playwright/test'

function relativeLuminance(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${color}`)
  const linear = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test.describe('public legal pages', () => {
  test('opens privacy and terms without authentication', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveTitle(/Privacy Policy/)
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Local-first writing' })).toBeVisible()

    await page.getByRole('link', { name: 'Terms', exact: true }).first().click()
    await expect(page).toHaveURL('/terms')
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible()
  })

  for (const path of ['/privacy', '/terms']) {
    test(`keeps ${path} readable on mobile and desktop`, async ({ page }) => {
      for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport)
        await page.goto(path)

        const article = page.locator('article')
        await expect(article).toBeVisible()
        await expect(page.getByRole('link', { name: 'Return to the workspace' })).toBeVisible()
        expect((await article.boundingBox())?.width).toBeLessThanOrEqual(viewport.width)
      }
    })
  }

  test('keeps dashboard legal links above WCAG AA contrast', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport)
      await page.goto('/')

      for (const name of ['Privacy', 'Terms']) {
        const link = page.getByRole('link', { name, exact: true })
        await expect(link).toBeVisible()
        const colors = await link.evaluate((element) => {
          const style = getComputedStyle(element)
          const background = getComputedStyle(element.closest('main') ?? document.body).backgroundColor
          return { foreground: style.color, background }
        })
        expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
        await link.focus()
        await expect(link).toBeFocused()
      }
    }
  })

  test('places legal acknowledgement beside the sign-in choice', async ({ page }) => {
    await page.goto('/signin')

    await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue without an account' })).toBeVisible()
  })
})
