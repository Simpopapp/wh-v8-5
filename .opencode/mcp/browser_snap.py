"""Playwright helper for the browser--screenshot MCP tool. Args via JSON on argv[1]."""
import asyncio, json, sys
from playwright.async_api import async_playwright

async def main(a):
    logs, errors = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": a.get("width", 1280), "height": a.get("height", 900)})).new_page()
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"[:500]))
        page.on("pageerror", lambda e: errors.append(str(e)[:500]))
        await page.goto(a["url"], wait_until="networkidle", timeout=30000)
        for act in a.get("actions", []):
            t = act.get("type")
            if t == "click": await page.click(act["selector"], timeout=10000)
            elif t == "fill": await page.fill(act["selector"], act.get("value", ""), timeout=10000)
            elif t == "wait": await page.wait_for_timeout(int(act.get("ms", 1000)))
            elif t == "press": await page.keyboard.press(act.get("key", "Enter"))
        target = page.locator(a["selector"]).first if a.get("selector") else page
        await target.screenshot(path=a["out"])
        text = (await page.inner_text("body"))[:4000]
        print(json.dumps({"url": page.url, "title": await page.title(), "console": logs[-40:], "errors": errors, "text": text}))
        await b.close()

asyncio.run(main(json.loads(sys.argv[1])))
