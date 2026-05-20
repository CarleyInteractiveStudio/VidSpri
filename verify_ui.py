import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Verificar Index
        await page.goto('http://localhost:8081/index.html')
        await page.screenshot(path='screenshot_index_final.png')
        print("Index verificado")

        # Verificar Configuración
        await page.goto('http://localhost:8081/configuracion.html')
        await page.screenshot(path='screenshot_config_final.png')
        print("Configuración verificada")

        # Verificar Códigos
        await page.goto('http://localhost:8081/codigos.html')
        await page.screenshot(path='screenshot_codigos_final.png')
        print("Códigos verificado")

        # Verificar Ayuda
        await page.goto('http://localhost:8081/ayuda.html')
        await page.screenshot(path='screenshot_ayuda_final.png')
        print("Ayuda verificada")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
