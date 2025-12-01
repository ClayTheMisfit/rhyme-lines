import { test, expect } from '@playwright/test'

/**
 * E2E test to prevent regressions where the editor header gets cut off
 * when the Rhyme Suggestions panel is open.
 * 
 * This test guards against the header clipping bug where opening the
 * rhyme panel caused the header to lose vertical breathing room.
 */
test.describe('Editor Header Height Regression', () => {
  test('keeps header height consistent when rhyme panel is toggled', async ({ page }) => {
    // Navigate to the editor page
    await page.goto('/')

    // Wait for the header to render
    const header = page.locator('[data-testid="editor-header"]')
    await expect(header).toBeVisible()

    // Get panel and toggle button locators
    const panel = page.locator('[data-testid="rhyme-panel"]')
    const toggleButton = page.locator('[data-testid="toggle-rhyme-panel"]')
    await expect(toggleButton).toBeVisible()

    // Wait for initial render and any animations
    await page.waitForTimeout(500)

    // Determine initial panel state and ensure it's closed first
    // The panel might be open by default (isOpen: true in state)
    // When closed, the panel returns null and won't be in the DOM
    const initialPanelCount = await panel.count()
    const isPanelInitiallyOpen = initialPanelCount > 0
    
    if (isPanelInitiallyOpen) {
      // Close the panel first to measure header in closed state
      await toggleButton.click()
      await page.waitForTimeout(500) // Wait for transition and DOM update
      
      // Verify panel is closed (it should not be in DOM - returns null)
      const panelCountAfterClose = await panel.count()
      expect(panelCountAfterClose).toBe(0)
      await page.waitForTimeout(300)
    }

    // Measure header height when panel is closed
    const headerBoxClosed = await header.boundingBox()
    expect(headerBoxClosed).not.toBeNull()
    const headerHeightClosed = headerBoxClosed!.height
    expect(headerHeightClosed).toBeGreaterThan(0)

    // Open the rhyme panel by clicking the toggle button
    await toggleButton.click()

    // Wait for the panel to appear (it should be in DOM and visible)
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Wait a bit for any layout transitions to complete
    await page.waitForTimeout(300)

    // Measure header height when panel is open
    const headerBoxOpen = await header.boundingBox()
    expect(headerBoxOpen).not.toBeNull()
    const headerHeightOpen = headerBoxOpen!.height

    // Assert that the header heights are effectively the same
    // Allowing a 1px tolerance for potential rounding differences
    const heightDifference = Math.abs(headerHeightClosed - headerHeightOpen)
    expect(heightDifference).toBeLessThanOrEqual(1)

    // Additional assertion: verify header is fully visible at the top
    const viewportSize = page.viewportSize()
    expect(viewportSize).not.toBeNull()
    
    // Header should be at the very top of the viewport
    expect(headerBoxOpen!.y).toBeLessThanOrEqual(1)
    
    // Verify header is not clipped (top should be 0 or very close)
    expect(headerBoxOpen!.y).toBeGreaterThanOrEqual(0)
  })
})

