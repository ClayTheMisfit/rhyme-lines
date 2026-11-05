import { expect, test } from '@playwright/test'

test.describe('authentication screens', () => {
  test('supports password-only login without exposing disabled Google OAuth', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByText('New account registration is not currently available. Existing users can continue to sign in.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
    await expect(page.getByText('OR CONTINUE WITH EMAIL')).toHaveCount(0)
    const providersResponse = await page.request.get('/api/auth/providers')
    expect(providersResponse.ok()).toBe(true)
    const providers = await providersResponse.json() as Record<string, unknown>
    expect(providers).toHaveProperty('credentials')
    expect(providers).not.toHaveProperty('google')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Use 12–128 characters.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('keeps anonymous local drafts intact while moving through signup and back', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify({ version: 3, drafts: [{ id: 'local-auth-draft' }] })))
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Account registration is closed' })).toBeVisible()
    await expect(page.getByText('Account registration is not currently available.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with email' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Sign in to an existing account' })).toHaveAttribute('href', '/signin')
    await page.getByRole('link', { name: 'Continue without an account' }).click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rhyme-lines:persist:drafts'))).toContain('local-auth-draft')
  })

  test('does not expose registration controls when the release flag is missing', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByLabel('Name')).toHaveCount(0)
    await expect(page.getByLabel('Email')).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: /Terms of Service/i })).toHaveCount(0)
  })

  test('renders recovery and confirmation states without dead links', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
    await page.goto('/verify-email?sent=1')
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resend verification' })).toBeVisible()
    await page.goto('/reset-password')
    await expect(page.getByText('This reset link is missing or invalid.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset password' })).toBeDisabled()
  })

  test('does not overflow a 320px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/signup')
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(widths.scroll).toBeLessThanOrEqual(widths.client)
  })
})
