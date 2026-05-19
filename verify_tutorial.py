from playwright.sync_api import sync_playwright
import time

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        iphone_13 = p.devices['iPhone 13']
        context = browser.new_context(**iphone_13)
        page = context.new_page()

        print("Navigating to http://localhost:3000/")
        page.goto("http://localhost:3000/")
        page.wait_for_load_state("networkidle")

        # Click the "Выбор" tab (bottom navigation) to trigger the solo swiping mode which shows the tutorial card first
        print("Clicking Выбор tab...")
        page.click("text=Выбор")

        # Wait for the view to load with the tutorial card
        print("Waiting for tutorial card to appear...")
        page.wait_for_timeout(3000)

        # Capture screenshot of the tutorial
        print("Capturing tutorial screenshot...")
        page.screenshot(path="verification/tutorial_card_solo.png")

        print("Done.")

        browser.close()

verify()
