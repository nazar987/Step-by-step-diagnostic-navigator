import { chromium } from '@playwright/test';
import path from 'node:path';
const output = process.env.NAVIGATOR_SCREENSHOTS;
if (!output) throw new Error('Set NAVIGATOR_SCREENSHOTS');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.screenshot({ path: path.join(output, 'design-desktop.png'), fullPage: true });
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({ path: path.join(output, 'design-mobile.png'), fullPage: false });
  await page.locator('.option-card').filter({hasText:'Нет контроля ЛП'}).click();
  await page.screenshot({ path: path.join(output, 'design-mobile-question.png'), fullPage: false });
  await page.getByRole('button', {name:'Показать индикацию: Постоянно горит ВКЛ. ЛГ или необычно работают Г1–Г8',exact:true}).click();
  await page.screenshot({ path: path.join(output, 'design-mobile-panel.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({ path: path.join(output, 'design-question.png'), fullPage: true });
  await page.getByRole('button', {name:'Развернуть панель',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Как на фото 1',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Вся панель',exact:true}).click();
  await page.getByRole('dialog').locator('.panel-housing').screenshot({ path: path.join(output, 'design-vector-panel.png'), animations: 'disabled' });
  await page.screenshot({ path: path.join(output, 'design-panel-overview.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('button',{name:'Всё дерево',exact:true}).click();
  await page.screenshot({ path: path.join(output, 'design-tree.png'), fullPage: true });
} finally { await browser.close(); }
