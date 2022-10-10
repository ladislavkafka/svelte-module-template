const { test, expect } = require('@playwright/test')

test('component1', async ({ page }) => {
  await page.goto('http://localhost:5000/')
  const h1 = page.locator('h1')
  await expect(h1).toHaveText('This is component!')
})
