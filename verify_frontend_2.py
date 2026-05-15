
import asyncio
from playwright.async_api import async_playwright
import os

async def verify_layout():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Load extraer.html directly
        file_path = "file://" + os.path.abspath("extraer.html")
        await page.goto(file_path)

        # Mocking the state where results are visible
        await page.evaluate("""() => {
            document.getElementById('stepper-container').style.display = 'none';
            document.getElementById('video-section').style.display = 'none';
            document.getElementById('result-container').classList.remove('hidden');
            document.getElementById('result-container').style.display = 'block';
        }""")

        # Take screenshot of the results section buttons
        os.makedirs("verification", exist_ok=True)
        await page.screenshot(path="verification/extraer_layout.png")

        # Check if buttons are in a flex container with space-between
        is_flex = await page.evaluate("""() => {
            const container = document.querySelector('.result-actions');
            const style = window.getComputedStyle(container);
            return style.display === 'flex' && style.justifyContent === 'space-between';
        }""")
        print(f"Buttons layout is flex space-between: {is_flex}")

        # Check previsualizacion.html
        file_path_prev = "file://" + os.path.abspath("previsualizacion.html")
        await page.goto(file_path_prev)
        await page.screenshot(path="verification/previsualizacion_load.png")

        has_download_btn = await page.evaluate("""() => {
            return !!document.getElementById('download-sprite-btn');
        }""")
        print(f"Has download button: {has_download_btn}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_layout())
