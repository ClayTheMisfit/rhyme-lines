import { expect, test } from '@playwright/test'

test.describe('authentication screens', () => {
  test('keeps Google available and validates email login accessibly', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Use 12–128 characters.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('keeps anonymous local drafts intact while moving through signup and back', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify({ version: 3, drafts: [{ id: 'local-auth-draft' }] })))
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await expect(page.getByLabel('Name')).toHaveAttribute('autocomplete', 'name')
    await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email')
    await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toHaveAttribute('autocomplete', 'new-password')
    await page.getByRole('button', { name: 'Show password' }).first().click()
    await expect(page.getByRole('button', { name: 'Hide password' }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Continue without an account' }).click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rhyme-lines:persist:drafts'))).toContain('local-auth-draft')
  })

  test('returns inline validation and restores the signup button', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Enter a name between 1 and 80 characters.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled()
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
