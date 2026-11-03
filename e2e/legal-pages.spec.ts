import { expect, test } from '@playwright/test'
import { openTestEditor } from './fixtures/project'

function colorChannels(color: string) {
  const channels = color.match(/[\d.]+/g)?.map(Number)
  if (!channels || channels.length < 3) throw new Error(`Unsupported color: ${color}`)
  return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 }
}

function relativeLuminance(color: string) {
  const { rgb: channels } = colorChannels(color)
  const linear = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

function contrastRatio(foreground: string, background: string) {
  const foregroundChannels = colorChannels(foreground)
  const backgroundChannels = colorChannels(background)
  const compositedForeground = foregroundChannels.rgb.map((channel, index) =>
    (channel * foregroundChannels.alpha) + (backgroundChannels.rgb[index] * (1 - foregroundChannels.alpha)))
  const foregroundLuminance = relativeLuminance(`rgb(${compositedForeground.join(', ')})`)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
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

  test('keeps editor-menu legal links above WCAG AA contrast in both themes', async ({ page }) => {
    await openTestEditor(page)
    const backgrounds = new Set<string>()

    for (let themeIndex = 0; themeIndex < 2; themeIndex += 1) {
      await page.getByRole('button', { name: 'More actions' }).click()
      const legalNavigation = page.getByRole('navigation', { name: 'Legal' })

      for (const name of ['Privacy', 'Terms']) {
        const link = legalNavigation.getByRole('link', { name, exact: true })
        const colors = await link.evaluate((element) => {
          const style = getComputedStyle(element)
          const background = getComputedStyle(element.closest('nav')?.parentElement ?? document.body).backgroundColor
          return { foreground: style.color, background }
        })
        backgrounds.add(colors.background)
        expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
        await link.focus()
        await expect(link).toBeFocused()
      }

      if (themeIndex === 0) {
        await page.getByRole('button', { name: 'More actions' }).click()
        const currentBodyClass = await page.locator('body').getAttribute('class')
        await page.getByRole('button', { name: 'Toggle theme' }).click()
        await expect.poll(() => page.locator('body').getAttribute('class')).not.toBe(currentBodyClass)
      }
    }

    expect(backgrounds.size).toBe(2)
  })
})
