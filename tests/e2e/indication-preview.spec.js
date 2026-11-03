import { test, expect } from '@playwright/test';

const lpQuestion = 'Какая индикация сопровождает потерю контроля?';
const generatorAnswer = 'Постоянно горит ВКЛ. ЛГ или необычно работают Г1–Г8';
const previewName = label => `Показать индикацию: ${label}`;
const led = (panel, label, state) => panel.locator(`.led-cell[aria-label="${label}: ${state}. Изменить состояние"]`);
const route = page => page.evaluate(() => JSON.parse(localStorage.getItem('dc-navigator-session-v1')).path);

async function answer(page, label) {
  await page.locator('.options button').filter({ has: page.getByText(label, { exact: true }) }).click();
}
async function openLp(page) {
  await page.goto('/');
  await answer(page, 'Нет контроля ЛП');
  await expect(page.locator('.question-heading h2')).toHaveText(lpQuestion);
}

test('Question focuses relevant LEDs; preview illustrates an answer without advancing the route', async ({ page }) => {
  await openLp(page);
  const panel = page.locator('.diagnostic-aside .indicator-panel');
  await expect(panel.locator('.is-context-focus[aria-hidden="false"]').first()).toBeVisible();
  await expect(panel.locator('.ip-context')).toBeVisible();
  // An unanswered question must not invent a running light pattern.
  await expect(panel.locator('.led-bulb.on, .led-bulb.blink, .led-bulb.fast')).toHaveCount(0);
  const before = await route(page);

  await page.getByRole('button', { name: previewName(generatorAnswer), exact: true }).click();
  await expect(panel.locator('.ip-context')).toContainText(generatorAnswer);
  await expect(panel.locator('.ip-context-detail')).toBeVisible();
  await expect(led(panel, 'ВКЛ. ЛГ', 'горит')).toBeVisible();
  await expect(led(panel, 'Г1', 'горит')).toHaveCount(1);
  await expect(page.locator('.question-heading h2')).toHaveText(lpQuestion);
  expect(await route(page)).toEqual(before);

  await panel.getByRole('button', { name: 'Как на фото 1', exact: true }).click();
  await expect(panel.locator('.ip-context')).toHaveCount(0);
  await expect(led(panel, 'ВКЛ. ЛГ', 'выключен')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Текущий шаг', exact: true }).click();
  await expect(panel.locator('.ip-context')).toContainText(generatorAnswer);
  await expect(led(panel, 'ВКЛ. ЛГ', 'горит')).toHaveCount(1);

  // Reset the preview after a manual override: both preview and override must clear.
  await panel.getByRole('combobox', { name: 'Индикатор', exact: true }).selectOption('ПР ТУ');
  await panel.getByRole('combobox', { name: 'Состояние индикатора' }).selectOption('on');
  await expect(led(panel, 'ПР ТУ', 'горит')).toBeVisible();
  await panel.getByRole('button', { name: 'К вопросу', exact: true }).click();
  await expect(panel.locator('.ip-context.is-preview')).toHaveCount(0);
  await expect(led(panel, 'ПР ТУ', 'выключен')).toHaveCount(1);
  await expect(panel.locator('.is-context-focus[aria-hidden="false"]').first()).toBeVisible();
  expect(await route(page)).toEqual(before);

  // Advancing to another question must not carry manual lamp settings into it.
  await panel.getByRole('combobox', { name: 'Индикатор', exact: true }).selectOption('ПР ТУ');
  await panel.getByRole('combobox', { name: 'Состояние индикатора' }).selectOption('on');
  await answer(page, 'Распределители ТС заторможены');
  await expect(page.locator('.question-heading h2')).toHaveText('Реле ЦС щёлкает?');
  await expect(led(page.locator('.diagnostic-aside .indicator-panel'), 'ПР ТУ', 'выключен')).toHaveCount(1);
});

test('Normal-indication preview keeps the missing reference-pattern explanation visible', async ({ page }) => {
  await openLp(page);
  await page.getByRole('button', { name: previewName('Индикация нормальная'), exact: true }).click();
  const panel = page.locator('.diagnostic-aside .indicator-panel');
  await expect(panel.locator('.ip-context')).toContainText('Индикация нормальная');
  await expect(panel.locator('.ip-context-detail')).toContainText(/эталон|нормальн|не задан/i);
  await expect(panel.locator('.led-bulb.on, .led-bulb.blink, .led-bulb.fast')).toHaveCount(0);
  await expect(page.locator('.question-heading h2')).toHaveText(lpQuestion);
});

for (const width of [320, 390]) {
  test(`Mobile ${width}px: preview opens the panel and manual state survives section/full-view switching`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openLp(page);
    await page.getByRole('button', { name: previewName(generatorAnswer), exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const panel = dialog.locator('.indicator-panel');
    await expect(panel.locator('.ip-context')).toContainText(generatorAnswer);
    await expect(panel.locator('.led-panel [role="button"]')).toHaveCount(50);
    await expect(led(panel, 'ВКЛ. ЛГ', 'горит')).toHaveCount(1);
    const fits = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= -1 && bounds.right <= innerWidth + 1;
    });
    expect(fits).toBe(true);

    await panel.getByRole('combobox', { name: 'Индикатор', exact: true }).selectOption('ВКЛ. ЛГ');
    await panel.getByRole('combobox', { name: 'Состояние индикатора' }).selectOption('blink');
    await panel.getByRole('button', { name: 'Вся панель', exact: true }).click();
    await expect(led(panel, 'ВКЛ. ЛГ', 'мигает')).toHaveCount(1);
    await panel.getByRole('button', { name: 'Крупнее по секциям', exact: true }).click();
    await expect(panel.getByRole('combobox', { name: 'Индикатор', exact: true })).toHaveValue('ВКЛ. ЛГ');
    await expect(panel.getByRole('combobox', { name: 'Состояние индикатора' })).toHaveValue('blink');
    await expect(led(panel, 'ВКЛ. ЛГ', 'мигает')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.question-heading h2')).toHaveText(lpQuestion);
    await answer(page, 'Распределители ТС заторможены');
    await expect(page.locator('.question-heading h2')).toHaveText('Реле ЦС щёлкает?');
    await expect(led(page.locator('.diagnostic-aside .indicator-panel'), 'ВКЛ. ЛГ', 'выключен')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
