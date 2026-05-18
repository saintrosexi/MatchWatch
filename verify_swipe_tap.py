from playwright.sync_api import sync_playwright
import time

def verify_swipe_tap():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use iPhone 13 Pro Max dimensions
        context = browser.new_context(
            viewport={'width': 428, 'height': 926},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        page.goto('http://localhost:3000')
        page.wait_for_selector('.app-container', timeout=10000)
        time.sleep(2)

        # We need to click the "Выбор" tab to go to the swipe screen
        page.click('text="Выбор"')
        time.sleep(2)

        # Tap the card inner to show info
        try:
            page.click('.swipe-card-inner', timeout=5000)
            time.sleep(1) # wait for animation
            page.screenshot(path='verification/mobile_swipe_tap.png')
            print("Screenshot saved to verification/mobile_swipe_tap.png")
        except Exception as e:
            print("Failed to click deck container:", e)
            page.screenshot(path='verification/mobile_swipe_tap_failed.png')
            print("Screenshot saved to verification/mobile_swipe_tap_failed.png")

        browser.close()

verify_swipe_tap()
