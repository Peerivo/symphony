import { test, expect } from '@playwright/test';

export function defineLayoutScenarios() {
  test('long search input stays within the viewport after reload', async ({ page }, testInfo) => {
    await page.goto('/search?q=' + encodeURIComponent('_'.repeat(400)));
    await expect(page.getByRole('heading', { name: 'В корпусе пока нет готового совпадения' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('long-search.png'), fullPage: true });
    const lines = await page.getByRole('button', { name: 'Найти', exact: true }).evaluate(button => {
      const range = document.createRange();
      range.selectNodeContents(button);
      return new Set(Array.from(range.getClientRects(), rect => rect.top)).size;
    });
    expect(lines, 'Search button label must remain on one line').toBe(1);
  });
}
