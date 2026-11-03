import { chromium } from '@playwright/test';
import path from 'node:path';
const output = process.env.NAVIGATOR_SCREENSHOTS;
if (!output) throw new Error('Set NAVIGATOR_SCREENSHOTS to the screenshot output directory');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
try {
  await page.goto('http://127.0.0.1:5173');
  await page.locator('.options').getByRole('button', { name: 'Нет контроля ЛП' }).click();
  await page.locator('.options').getByRole('button', { name: 'Постоянно горит ВКЛ. ЛГ' }).click();
  await page.screenshot({ path: path.join(output, 'navigator-result.png'), fullPage: true });
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name: 'Всё дерево' }).click();
  await page.screenshot({ path: path.join(output, 'navigator-tree.png'), fullPage: true });
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', { name: 'Памятка и источники' }).click();
  await page.screenshot({ path: path.join(output, 'navigator-reference.png'), fullPage: true });
} finally { await browser.close(); }
