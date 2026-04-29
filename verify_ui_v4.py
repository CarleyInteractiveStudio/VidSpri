import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 1200})
        page = await context.new_page()

        # Inject script to populate IndexedDB before page loads
        await page.add_init_script("""
            const request = indexedDB.open('VidSpriHistory', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('sprites')) {
                    db.createObjectStore('sprites', { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const transaction = db.transaction(['sprites'], 'readwrite');
                const store = transaction.objectStore('sprites');
                const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
                store.add({
                    dataUrl: dataUrl,
                    timestamp: Date.now(),
                    metadata: { cols: 4, rows: 2 }
                });
            };
        """)

        # Go to previsualizacion.html
        url = "file://" + os.path.abspath("previsualizacion.html")
        await page.goto(url)

        # Wait for history to load
        await page.wait_for_selector("#history-grid > div", timeout=5000)

        await page.screenshot(path="preview_with_history.png")

        history_items = await page.query_selector_all("#history-grid > div")
        print(f"History items found: {len(history_items)}")

        if len(history_items) > 0:
            await history_items[0].click()
            await page.wait_for_selector("#animation-card", timeout=5000)

            anim_card_visible = await page.is_visible("#animation-card")
            export_card_visible = await page.is_visible("#export-card")
            print(f"Animation card visible: {anim_card_visible}")
            print(f"Export card visible: {export_card_visible}")
            await page.screenshot(path="preview_after_history_click.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
