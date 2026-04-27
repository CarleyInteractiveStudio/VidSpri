import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Start server
        import subprocess
        server = subprocess.Popen(['python3', '-m', 'http.server', '8082'])
        await asyncio.sleep(2)

        try:
            # Check Stepper and Editor in index.html
            await page.goto('http://localhost:8082/index.html')
            await page.click('#video-sprite-btn')
            await page.screenshot(path='/home/jules/verification/fix_stepper_step1.png')

            # Check Config Modal
            await page.goto('http://localhost:8082/configuracion.html')
            await page.click('#open-lang-modal')
            await asyncio.sleep(0.5)
            await page.screenshot(path='/home/jules/verification/fix_lang_modal.png')

            # Check Codes page
            await page.goto('http://localhost:8082/codigos.html')
            await page.screenshot(path='/home/jules/verification/fix_codes_page.png')

        finally:
            server.terminate()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
