import { test, expect } from '@playwright/test';

const sizes = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 960 },
];

// Internal scrolling (the full panel or an original-sized source photo) is
// intentional. The page itself must remain bounded by the viewport.
async function expectBoundedPage(page, screen) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, `${screen}: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `${screen}: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.viewport + 1);
}

// A visible DOM node may still be covered by a sticky header, bottom navigation
// or another control. Check the actual hit target after normal scrolling.
async function expectReachable(control) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return rect.width > 0 && rect.height > 0 &&
      x >= 0 && x < innerWidth && y >= 0 && y < innerHeight &&
      (hit === element || element.contains(hit));
  }), { message: 'The control should be reachable without an overlay covering it' }).toBe(true);
}

async function expectVisibleNavigation(page) {
  const navigation = page.getByRole('navigation', { name: 'Основная навигация' });
  // Do not scroll to the navigation: it should remain available after scrolling
  // long content on both the desktop rail and the phone's bottom navigation.
  for (const title of ['Пошаговая диагностика', 'Всё дерево', 'Памятка и источники']) {
    const button = navigation.getByRole('button', { name: title, exact: true });
    await expect(button).toBeInViewport();
    const hitIsButton = await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    });
    expect(hitIsButton, `Navigation should remain usable: ${title}`).toBe(true);
  }
}

for (const viewport of sizes) {
  test.describe(`Responsive navigator ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('Diagnosis, tree, sources and panel stay usable at this screen size', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await expect(page.locator('.options button')).toHaveCount(8);
      await expectBoundedPage(page, 'symptom selection');

      if (viewport.width <= 1100) {
        const shortcut = page.getByRole('button', { name: 'Открыть панель индикации', exact: true });
        await expect(shortcut).toBeInViewport();
        await expectReachable(shortcut);
        await shortcut.click();
      } else {
        const expand = page.getByRole('button', { name: 'Развернуть панель', exact: true });
        await expectReachable(expand);
        await expand.click();
      }

      const panelDialog = page.getByRole('dialog');
      await expect(panelDialog).toBeVisible();
      await expectBoundedPage(page, 'expanded panel');
      // The semantic panel retains all indicators, even when its readable view
      // presents them by section. Do not require all 50 to fit in one viewport.
      await expect(panelDialog.locator('.led-panel [role="button"]')).toHaveCount(50);
      const indicatorState = panelDialog.getByRole('combobox', { name: 'Состояние индикатора', exact: true });
      await expectReachable(indicatorState);
      await indicatorState.selectOption('blink');
      await expect(panelDialog.locator('.led-bulb.blink')).toHaveCount(1);
      const closePanel = panelDialog.getByRole('button', { name: 'Закрыть', exact: true });
      await expectReachable(closePanel);
      await closePanel.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await expectReachable(page.locator('.options button').last());
      await expectVisibleNavigation(page);
      await page.locator('.options button').filter({
        has: page.getByText('Нет ТУ, приём ЦС нормальный', { exact: true }),
      }).click();
      await page.locator('.options button').filter({
        has: page.getByText('Нет, ПР ТУ не гаснет', { exact: true }),
      }).click();
      await expect(page.locator('.result-card')).toContainText('8СТ');
      await expectBoundedPage(page, 'diagnostic result');
      await expectReachable(page.getByRole('button', { name: 'Назад', exact: true }));

      const sourceButton = page.locator('.result-source').getByRole('button', { name: 'Сверить с оригиналом' });
      await expectReachable(sourceButton);
      await sourceButton.click();
      const sourceDialog = page.getByRole('dialog');
      await expect.poll(() => sourceDialog.getByRole('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      await expectBoundedPage(page, 'source photograph');
      await sourceDialog.getByRole('button', { name: 'Оригинальный размер', exact: true }).click();
      await expectBoundedPage(page, 'original-sized source photograph');
      const closeSource = sourceDialog.getByRole('button', { name: 'Закрыть', exact: true });
      await expectReachable(closeSource);
      await closeSource.click();

      const navigation = page.getByRole('navigation', { name: 'Основная навигация' });
      await navigation.getByRole('button', { name: 'Всё дерево', exact: true }).click();
      await expect(page.locator('.tree-group')).toHaveCount(8);
      await expectBoundedPage(page, 'all branches');
      const treeSearch = page.getByRole('textbox', { name: 'Поиск по дереву', exact: true });
      await expectReachable(treeSearch);
      await treeSearch.fill('8СТ');
      await expectBoundedPage(page, 'filtered branches');
      const resultLink = page.locator('.tree-node-link').filter({ hasText: 'Нет, ПР ТУ не гаснет' });
      await expectReachable(resultLink);
      await resultLink.click();
      await expect(page.locator('.result-card')).toContainText('8СТ');

      await navigation.getByRole('button', { name: 'Памятка и источники', exact: true }).click();
      await expect(page.locator('.source-card')).toHaveCount(5);
      await expectBoundedPage(page, 'reference materials');
      await expectReachable(page.locator('.source-card').last());
      await expectVisibleNavigation(page);
      expect(errors).toEqual([]);
    });
  });
}
