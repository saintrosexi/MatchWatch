from playwright.sync_api import sync_playwright
import time

def verify_swipe_real():
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

        # Click the "Выбор" tab to go to the swipe screen
        page.click('text="Выбор"')
        time.sleep(2)

        # We are on the tutorial card. Swipe it right!
        # Playwright way to drag and drop:
        # We find the center of the card, move mouse there, down, move right, up
        card = page.locator('.swipe-card-inner').first
        box = card.bounding_box()
        if box:
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            # Move right by 200px
            page.mouse.move(box["x"] + box["width"] / 2 + 200, box["y"] + box["height"] / 2, steps=10)
            page.mouse.up()

        time.sleep(2) # wait for next card to load

        page.screenshot(path='verification/mobile_swipe_real.png')
        print("Screenshot saved to verification/mobile_swipe_real.png")

        browser.close()

verify_swipe_real()
