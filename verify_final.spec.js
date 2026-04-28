const { test, expect } = require('@playwright/test');

test('Verify Login and Audio Page', async ({ page }) => {
  // 1. Verify Login via Hash
  const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX21ldGFkYXRhIjp7InVzZXJuYW1lIjoiVGVzdFVzZXIifSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWQiOiIxMjM0NSJ9.signature";
  await page.goto(`http://localhost:8080/index.html#sso_token=${mockToken}&user_id=12345`);

  // Check for Toast
  const toast = page.locator('.toast.success');
  await expect(toast).toBeVisible();

  // Check for UI update
  const welcome = page.locator('#welcome-name');
  await expect(welcome).toHaveText('TestUser');

  // 2. Verify Audio Page
  await page.goto('http://localhost:8080/audio.html');

  // Check if supabaseClient is available (no ReferenceError)
  const isSupabaseDefined = await page.evaluate(() => typeof supabaseClient !== 'undefined');
  expect(isSupabaseDefined).toBe(true);

  // Select a service
  await page.click('#service-voice');
  const voiceInterface = page.locator('#voice-interface');
  await expect(voiceInterface).toBeVisible();

  // Screenshot
  await page.screenshot({ path: 'verification/final_check.png' });
});
