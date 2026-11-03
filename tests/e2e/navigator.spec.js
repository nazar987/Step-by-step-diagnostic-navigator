import { test, expect } from '@playwright/test';
import { graph, findPath } from '../../src/data/diagnostics.js';
import path from 'node:path';

test('Every diagnostic result is reachable through its actual answers', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const [id, node] of Object.entries(graph)) {
    if (node.type !== 'result') continue;
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const route = findPath(id);
    for (let i = 1; i < route.length; i++) {
      const option = graph[route[i-1]].options.find(o => o.next === route[i]);
      await page.locator('.options button').filter({ has: page.getByText(option.label, { exact: true }) }).click();
    }
    await expect(page.locator('.question-heading h2')).toHaveText(node.title);
    await expect(page.locator('.result-card')).toContainText(node.causes[0]);
    await expect(page.locator('.result-source')).toContainText(`Фото ${node.sourceIds.join(', ')}`);
  }
  expect(errors).toEqual([]);
});

test('Back, saved notes, unknown answer, source modal, and restart', async ({ page }) => {
  await page.goto('/');
  await page.locator('.options').getByRole('button', { name: 'Нет ТУ, приём ЦС нормальный' }).click();
  await page.getByPlaceholder('Номер ЛП, наблюдаемый индикатор, условия проявления…').fill('ЛП 23, ПР ТУ горит');
  await page.reload();
  await expect(page.locator('.question-heading h2')).toHaveText(graph.tu.title);
  await expect(page.locator('textarea')).toHaveValue('ЛП 23, ПР ТУ горит');
  await page.getByRole('button', { name: 'Не могу определить / мой случай не описан' }).click();
  await expect(page.getByRole('dialog')).toContainText('Недостаточно наблюдений');
  await page.getByRole('dialog').getByRole('button', { name: 'Открыть источник' }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  expect(await page.getByRole('dialog').getByRole('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await page.locator('.option-card').filter({ hasText: 'Нет, ПР ТУ не гаснет' }).click();
  await expect(page.locator('.result-card')).toContainText('8СТ');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.locator('.question-heading h2')).toHaveText(graph.tu.title);
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Начать заново', exact: true }).click();
  await expect(page.locator('.question-heading h2')).toHaveText(graph.start.title);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dc-navigator-session-v1')));
  expect(saved.note).toBe('');
});

test('Tree search opens a result and restores its question history', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name: 'Всё дерево' }).click();
  await expect(page.locator('.tree-group')).toHaveCount(8);
  await page.getByRole('textbox', { name: 'Поиск по дереву' }).fill('8СТ');
  await expect(page.locator('.tree-group')).not.toHaveCount(8);
  await page.locator('.tree-node-link').filter({ hasText: 'Нет, ПР ТУ не гаснет' }).click();
  await expect(page.locator('.question-heading h2')).toHaveText(graph['tu-st'].title);
  await expect(page.locator('.route-card li')).toHaveCount(3);
});

test('SVG controls are accessible and blinking can be paused', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.led-panel [role=button]')).toHaveCount(50);
  const led = page.getByRole('button', { name: 'ПР ТУ: состояние не задано. Изменить состояние', exact: true });
  await led.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'ПР ТУ: горит. Изменить состояние', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Состояние индикатора' }).selectOption('blink');
  await expect(page.locator('.led-bulb.blink')).toHaveCount(1);
  await page.getByRole('button', { name: 'Приостановить анимацию' }).click();
  expect(await page.locator('.led-bulb.blink').evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
  await page.getByRole('button', { name: 'Развернуть панель' }).click();
  await expect(page.getByRole('dialog').locator('.led-panel [role=button]')).toHaveCount(50);
  await page.keyboard.press('Escape');
});

test('Mobile layout, offline navigation, and screenshots', async ({ page, context }) => {
  await page.goto('/');
  if (process.env.NAVIGATOR_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.NAVIGATOR_SCREENSHOTS, 'navigator-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.NAVIGATOR_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.NAVIGATOR_SCREENSHOTS, 'navigator-mobile.png'), fullPage: true });
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth+1).slice(0,15).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })) }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
  await context.setOffline(true);
  await page.locator('.options').getByRole('button', { name: 'Нет ТУ, приём ЦС нормальный' }).click();
  await page.locator('.option-card').filter({ hasText: 'Нет, ПР ТУ не гаснет' }).click();
  await expect(page.locator('.result-card')).toContainText('8СТ');
  await page.getByRole('button', { name: 'Смотреть всё дерево' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(false);
});
