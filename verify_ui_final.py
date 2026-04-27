import os
from playwright.sync_api import sync_playwright

def verify_all_pages():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        base_url = f"file://{os.getcwd()}"

        pages = [
            ("index.html", "index_final.png"),
            ("extraer.html", "extraer_final.png"),
            ("configuracion.html", "config_final.png"),
            ("previsualizacion.html", "preview_final.png"),
            ("ayuda.html", "ayuda_final.png"),
            ("codigos.html", "codigos_final.png"),
            ("privacidad.html", "privacidad_final.png")
        ]

        for html_file, screenshot_name in pages:
            url = f"{base_url}/{html_file}"
            print(f"Verifying {url}...")
            page.goto(url)
            # Wait for any JS to run
            page.wait_for_timeout(1000)

            # For configuration, let's open the language modal to see it
            if html_file == "configuracion.html":
                page.click("#open-lang-modal")
                page.wait_for_timeout(500)
                page.screenshot(path=f"screenshot_modal_lang.png")
                page.click("#close-lang-modal")
                page.wait_for_timeout(500)

            page.screenshot(path=f"screenshot_{screenshot_name}")

        browser.close()

if __name__ == "__main__":
    verify_all_pages()
