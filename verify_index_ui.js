const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8081/index.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/jules/verification/index_ui.png' });
  await browser.close();
})();
