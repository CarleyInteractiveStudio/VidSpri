const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Serve the files using a simple http server or just open the file
  // Since we are in a sandbox, opening the file directly might work if paths are relative
  const filePath = 'file://' + path.resolve('audio.html');
  await page.goto(filePath);

  // Wait for translations and other JS to run
  await page.waitForTimeout(1000);

  // Simulate a completed job to show the trimmer
  await page.evaluate(() => {
    document.getElementById('step-queue').classList.add('hidden');
    document.getElementById('step-result').classList.remove('hidden');
    document.getElementById('audio-trimmer').classList.remove('hidden');

    // Set some test values
    const start = document.getElementById('range-start');
    const end = document.getElementById('range-end');
    const highlight = document.getElementById('range-highlight');

    start.value = 20;
    end.value = 80;

    // Trigger the input events to update highlight
    start.dispatchEvent(new Event('input'));
    end.dispatchEvent(new Event('input'));
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'trimmer_verification.png' });

  // Check if both handles are clickable (overlapping)
  // We check if the CSS is applied
  const startStyles = await page.evaluate(() => {
    const el = document.getElementById('range-start');
    return window.getComputedStyle(el).pointerEvents;
  });

  console.log('Start slider pointer-events:', startStyles);

  await browser.close();
})();
