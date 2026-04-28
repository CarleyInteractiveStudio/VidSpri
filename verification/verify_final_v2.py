from playwright.sync_api import Page, expect, sync_playwright

def test_everything(page: Page):
    # 1. Test Login Persistence and Toast
    mock_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX21ldGFkYXRhIjp7InVzZXJuYW1lIjoiVGVzdFVzZXIifSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWQiOiIxMjM0NSJ9.signature"
    url = f"http://localhost:8080/index.html#sso_token={mock_token}&user_id=12345"
    print(f"Navigating to {url}")
    page.goto(url)

    # Wait for toast
    expect(page.locator(".toast.success")).to_be_visible()
    print("Login Toast visible")

    # Check UI update
    expect(page.locator("#welcome-name")).to_have_text("TestUser")
    print("Login name updated")

    # 2. Test Audio Interface
    page.goto("http://localhost:8080/audio.html")

    # Check if supabaseClient is defined in global scope
    is_defined = page.evaluate("typeof supabaseClient !== 'undefined'")
    if not is_defined:
        raise Exception("supabaseClient is NOT defined in audio.html")
    print("supabaseClient is globally defined")

    # Interact with service cards
    page.click("#service-voice")
    expect(page.locator("#voice-interface")).to_be_visible()

    page.click("#service-sound")
    expect(page.locator("#generic-interface")).to_be_visible()

    # Final screenshot
    page.screenshot(path="final_everything.png")
    print("Final screenshot saved")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_everything(page)
        finally:
            browser.close()
