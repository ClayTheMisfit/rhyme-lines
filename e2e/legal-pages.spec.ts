import { expect, test } from '@playwright/test'

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

  test('keeps the legal documents readable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/privacy')

    const article = page.locator('article')
    await expect(article).toBeVisible()
    await expect(page.getByRole('link', { name: 'Return to the workspace' })).toBeVisible()
    expect((await article.boundingBox())?.width).toBeLessThanOrEqual(390)
  })
})
