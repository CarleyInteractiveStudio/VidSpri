from playwright.sync_api import Page, expect, sync_playwright
import time

def test_login_and_audio_ui(page: Page):
    # 1. Verify Login via Hash
    mock_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX21ldGFkYXRhIjp7InVzZXJuYW1lIjoiVGVzdFVzZXIifSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWQiOiIxMjM0NSJ9.signature"
    url = f"http://localhost:8080/index.html#sso_token={mock_token}&user_id=12345"
    print(f"Navigating to {url}")
    page.goto(url)

    # Wait for toast
    expect(page.locator(".toast.success")).to_be_visible()
    print("Toast visible")

    # Check UI update
    expect(page.locator("#welcome-name")).to_have_text("TestUser")
    print("UI name updated")

    # 2. Verify Audio Page
    page.goto("http://localhost:8080/audio.html")

    # Check if supabaseClient is defined in global scope
    is_defined = page.evaluate("typeof supabaseClient !== 'undefined'")
    if not is_defined:
        raise Exception("supabaseClient is NOT defined in audio.html")
    print("supabaseClient is defined")

    # Select service
    page.click("#service-voice")
    expect(page.locator("#voice-interface")).to_be_visible()
    print("Voice interface visible")

    # Final screenshot
    page.screenshot(path="/home/jules/verification/final_verification.png")
    print("Screenshot saved")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_login_and_audio_ui(page)
        finally:
            browser.close()
