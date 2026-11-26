"""Exercise model selection and task search in the template library."""
from browser_support import BASE_URL, ROOT, setup, sync_playwright
from playwright.sync_api import expect

models = {
    "default": "claude-sonnet-test",
    "tiers": {"hizli": 1, "dengeli": 3, "guclu": 8},
    "byok": [],
    "platform": [
        {"id": "gpt-test", "family": "gpt", "tier": "hizli", "credits": 1},
        {"id": "claude-sonnet-test", "family": "claude", "tier": "dengeli", "credits": 3},
    ],
}

with sync_playwright() as runtime:
    for width in (320, 390, 1440):
        browser, page = setup(runtime, width)
        page.set_default_timeout(8000)
        page.route("**/api/health", lambda r: r.fulfill(json={"ok": True}))
        page.route("**/api/ai/models", lambda r: r.fulfill(json=models))
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE_URL + "/#studio", wait_until="domcontentloaded")
        draft = page.locator("textarea.gta")
        draft.fill("Mevsim menüsüne rezervasyon düğmesi ekle")
        def open_models():
            page.get_by_title("Ekle", exact=True).click()
            page.get_by_role("menuitem", name="Dil modeli").click()
        open_models()
        picker = page.get_by_role("dialog", name="Dil modeli seç")
        expect(picker.locator(".mp-m").first).to_have_attribute("aria-pressed", "true")
        expect(picker.locator(".mp-m").first).to_contain_text("claude-sonnet-test")
        search = picker.get_by_label("Model ara")
        search.fill("eşleşmeyen")
        expect(picker.locator(".mp-m")).to_have_count(0)
        picker.get_by_role("button", name="Aramayı temizle").click()
        search.fill("gpt")
        expect(picker.locator(".mp-m")).to_have_count(1)
        picker.locator(".mp-m").click()
        expect(draft).to_have_value("Mevsim menüsüne rezervasyon düğmesi ekle")
        open_models()
        expect(picker.locator(".mp-h")).to_contain_text("gpt-test")
        expect(picker.locator(".mp-m").first).to_have_attribute("aria-pressed", "true")
        expect(search).to_have_value("")
        if width == 390:
            page.screenshot(path=str(ROOT / "validation/screens/model-secimi-390.png"))
        page.keyboard.press("Escape")
        page.evaluate("location.hash='sablonlar'")
        query = page.get_by_label("Ne yapmak istiyorsun?", exact=True)
        query.fill("rezervasyon")
        cards = page.locator(".tp-grid .tpc")
        expect(cards.first).to_be_visible()
        assert 0 < cards.count() < 28
        expect(page.locator(".tp-grid iframe")).to_have_count(0)
        query.fill("zzzzzz")
        expect(cards).to_have_count(0)
        page.get_by_role("button", name="Filtreleri temizle").click()
        expect(query).to_have_value("")
        cards.filter(has_text="Avlu Sofrası").get_by_role("button", name="Telefon", exact=True).click()
        expect(page.get_by_role("dialog")).to_be_visible()
        page.keyboard.press("Escape")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
        assert not errors, errors
        print(width, "PASS", flush=True)
        browser.close()
