const { test, expect } = require('@playwright/test');

test('Verify button alignment in extraer.html', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/extraer.html');

  // We need to trigger the result container to see the buttons
  // But we can just check the DOM and CSS
  const resultActions = await page.locator('.result-actions');
  const display = await resultActions.evaluate(el => getComputedStyle(el).display);
  const gap = await resultActions.evaluate(el => getComputedStyle(el).gap);

  console.log('Result actions display:', display);
  console.log('Result actions gap:', gap);

  expect(display).toBe('flex');
});

test('Verify progress message logic in script-extraer.js', async ({ page }) => {
  const content = await require('fs').promises.readFile('script-extraer.js', 'utf8');
  expect(content).toContain('Procesando: ${processed} de ${total} fotogramas');
});

test('Verify previsualizacion.html features', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/previsualizacion.html');

  // Check for download button (it starts hidden but exists in DOM)
  const downloadBtn = await page.locator('#download-sprite-link');
  expect(await downloadBtn.count()).toBe(1);

  // Check for localStorage logic
  const scriptContent = await page.evaluate(() => {
    return document.querySelector('script').textContent;
  });
  // The second script block contains the logic
  const scripts = await page.locator('script').all();
  let found = false;
  for (const s of scripts) {
      const text = await s.textContent();
      if (text.includes('vidspri_last_sprite')) {
          found = true;
          break;
      }
  }
  expect(found).toBe(true);
});
