import { test, expect } from '@playwright/test';

test('transition to extraer.html', async ({ page }) => {
  await page.goto('http://localhost:8081/index.html');
  await page.click('text="Generar Sprite a partir de Video"');
  await expect(page).toHaveURL(/extraer.html/);
  await expect(page.locator('h2[data-i18n="step_upload"]')).toBeVisible();
});
