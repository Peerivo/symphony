import { test, expect } from '@playwright/test';
import { defineLayoutScenarios } from './layout-scenarios';

defineLayoutScenarios();

test('read-only scripture journey, sources and interrupted navigation', async({page,request}, testInfo)=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Спросите так, как думаете.'})).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.getByRole('textbox',{name:'Стих, цитата или вопрос'}).fill('Ин 3:16');
  await page.getByRole('button',{name:'Найти',exact:true}).click();
  await expect(page.getByRole('link',{name:'Евангелие от Иоанна 3:16',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Евангелие от Иоанна 3:16',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Евангелие от Иоанна 3:16',exact:true})).toBeVisible();
  await expect(page.locator('blockquote').first()).toContainText('Ибо так возлюбил Бог мир');
  await expect(page.getByText('Приём вопросов появится после открытия редакционной очереди.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Передать редакции'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Открыть источник ↗'})).toHaveAttribute('href','https://ebible.org/russyn/JHN03.htm#V16');
  await page.screenshot({ path: testInfo.outputPath('verse.png'), fullPage: true });
  await page.goBack(); await expect(page.getByRole('heading',{name:'«Ин 3:16»'})).toBeVisible();
  await page.goForward(); await expect(page.getByRole('heading',{name:'Евангелие от Иоанна 3:16',exact:true})).toBeVisible();
  await page.reload(); await expect(page.locator('blockquote').first()).toContainText('Ибо так возлюбил Бог мир');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/sources'); await expect(page.getByText('Статус прав: общественное достояние.',{exact:false})).toBeVisible();
  await page.goto('/corpus'); await expect(page.getByRole('heading',{name:'Читать корпус',exact:true})).toBeVisible();
  expect(await page.getByRole('link').count()).toBeGreaterThan(30);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const health = await request.get('/api/health'); expect(health.status()).toBe(200); expect((await health.json()).status).toBe('ok');
  const disabled = await request.post('/api/questions',{headers:{origin:new URL(page.url()).origin},data:{text:'Synthetic draft only',osis:'John.3.16',consent:true}});
  expect(disabled.status()).toBe(503); expect(await disabled.json()).toEqual({error:'intake_disabled'});
});
test('approximate quotation, unknown query and nonexistent verse stay honest', async({page})=>{
  await page.goto('/search?q='+encodeURIComponent('разных ветров учения'));
  await expect(page.getByRole('link',{name:'Послание к Ефесянам 4:14',exact:true})).toBeVisible();
  await page.goto('/search?q='+encodeURIComponent('несуществующееабракадабра'));
  await expect(page.getByRole('heading',{name:'В корпусе пока нет готового совпадения'})).toBeVisible();
  await page.goto('/search?q='+encodeURIComponent('Ин 3:16')+'&q=ignored');
  await expect(page.getByRole('link',{name:'Евангелие от Иоанна 3:16',exact:true})).toBeVisible();
  const malformed=await page.goto('/verse/%25'); expect(malformed?.status()).toBe(404);
  const missing=await page.goto('/verse/John.999.999'); expect(missing?.status()).toBe(404);
});
