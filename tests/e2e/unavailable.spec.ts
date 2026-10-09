import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { defineLayoutScenarios } from './layout-scenarios';

defineLayoutScenarios();

// Run only against an isolated build whose DB endpoint is deliberately closed.
// These are genuine HTTP/browser failure paths, never positive corpus evidence.
test('database outage is visible, retry works and drafts stay closed', async ({ page, request }, testInfo) => {
  const revision = JSON.parse(readFileSync('.next/release.json', 'utf8')).revision;
  const live = await request.get('/api/live');
  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: 'alive', revision });
  for (const path of ['/api/health', '/api/ready']) {
    const readiness = await request.get(path);
    expect(readiness.status()).toBe(503);
    expect(await readiness.json()).toEqual({ status: 'unavailable', revision });
    expect(readiness.headers()['cache-control']).toBe('no-store');
  }
  await page.goto('/search?q=' + encodeURIComponent('Ин 3:16'));
  await expect(page.getByRole('heading', { name: 'Корпус временно недоступен' })).toBeVisible();
  const retry = page.getByRole('button', { name: 'Повторить', exact: true });
  await page.keyboard.press('Tab');
  await expect(retry).toBeFocused();
  const box = await retry.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Корпус временно недоступен' })).toBeVisible();
  await page.reload();
  await expect(retry).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('database-unavailable.png'), fullPage: true });
  const disabled = await request.post('/api/questions', { data: { text: 'Synthetic private draft only', consent: true } });
  expect(disabled.status()).toBe(503);
  expect(await disabled.json()).toEqual({ error: 'intake_disabled' });
});

test('empty search, keyboard search and malformed verse need no fake corpus', async ({ page }, testInfo) => {
  await page.goto('/search');
  await expect(page.getByRole('heading', { name: 'Введите стих, цитату или вопрос' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Стих, цитата или вопрос' }).focus();
  await page.keyboard.type('% _ !!!');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Найти', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'В корпусе пока нет готового совпадения' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'В корпусе пока нет готового совпадения' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('empty-search.png'), fullPage: true });
  const malformed = await page.goto('/verse/%25');
  expect(malformed?.status()).toBe(404);
});
