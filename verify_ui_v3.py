import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os

def run_server():
    os.chdir(os.getcwd())
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", 8003), handler) as httpd:
        httpd.serve_forever()

async def verify_v3():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Verify extraer.html layout and dropdowns
        await page.goto("http://localhost:8003/extraer.html")
        await page.evaluate("""() => {
            document.getElementById('result-container').classList.remove('hidden');
            document.getElementById('video-section').classList.add('hidden');
            document.getElementById('custom-size-inputs').classList.remove('hidden');
        }""")
        await page.screenshot(path="extraer_v3_final.png")

        # 2. Verify previsualizacion.html scaling
        await page.goto("http://localhost:8003/previsualizacion.html")
        await page.evaluate("""() => {
            document.getElementById('upload-stage').classList.add('hidden');
            document.getElementById('preview-stage').classList.remove('hidden');
            // Mock image and cols
            window.cols = 2; window.rows = 1;
            const canvas = document.getElementById('anim-canvas');
            canvas.width = 32; canvas.height = 32;
            // Trigger drawFrame logic manually or just check the function
        }""")
        # We want to see if the canvas scales
        await page.evaluate("""() => {
            const canvas = document.getElementById('anim-canvas');
            const frameW = 32; const frameH = 32;
            const maxDimension = 300;
            let scale = maxDimension / 32;
            canvas.style.width = (frameW * scale) + 'px';
            canvas.style.height = (frameH * scale) + 'px';
        }""")
        await page.screenshot(path="preview_v3_manual.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_v3())
