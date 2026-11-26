"""Use templates, design, models, and prompt snippets without losing an active draft."""
from browser_support import BASE_URL, ROOT, setup, sync_playwright
from playwright.sync_api import expect
import re

with sync_playwright() as playwright:
    for width in (390, 1440):
        browser, page = setup(playwright, width)
        page.set_default_timeout(6500)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/api/health", lambda route: route.fulfill(json={"ok": True}))
        page.route("**/api/ai/models", lambda route: route.fulfill(json={
            "default": "gpt-5.2", "byok": [],
            "platform": [{"id":"gpt-5.2","family":"gpt","credits":3,"tier":"dengeli"}],
        }))
        page.goto(BASE_URL + "/#studio", wait_until="domcontentloaded")
        field = page.locator("textarea.gta")
        bar = page.get_by_role("group", name="Stüdyo kaynakları")
        launch = bar.get_by_role("button", name="Şablon ve örnekler")
        dialog = page.get_by_role("dialog", name="Şablon ve örnekler")
        def library():
            launch.click()
            expect(dialog).to_be_visible()
        def card(name):
            return dialog.locator("article").filter(has=page.get_by_role("heading", name=name,exact=True))
        expect(field).to_be_visible()
        field.fill("Markamın renklerini kullan.")
        page.locator(".studio-start .tpl-grid button").first.click()
        expect(field).to_have_value(re.compile(r"^Markamın renklerini kullan\.\n\n.+"))
        text = field.input_value()
        library()
        dialog.get_by_role("searchbox", name="Şablon ara").fill("xzy000")
        expect(dialog.get_by_text("Eşleşen şablon bulunamadı.")).to_be_visible()
        dialog.get_by_role("button", name="Filtreleri temizle").click()
        dialog.get_by_role("combobox",name="Tür",exact=True).select_option("site")
        dialog.get_by_role("searchbox").fill("avlu")
        card("Avlu Sofrası").get_by_role("button", name="Canlı dene").click()
        demo = page.get_by_role("dialog", name="Avlu Sofrası · Canlı demo")
        expect(demo.frame_locator("iframe").locator("h1")).to_have_text("Avluda bu akşam")
        demo.get_by_role("button", name="Masaüstü",exact=True).click()
        demo.get_by_role("button", name="Ayrı taslak oluştur").click()
        expect(dialog.get_by_role("status")).to_contain_text("Avlu Sofrası")
        assert page.evaluate("JSON.parse(localStorage['gms_localDrafts:guest']).length") == 1
        dialog.get_by_role("button", name="İstem ve kod örnekleri").click()
        faq = card("Sık sorulan sorular")
        faq.locator("summary").click()
        expect(faq.locator("code")).to_contain_text("<details>")
        faq.get_by_role("button", name="Kodla birlikte isteme ekle").click()
        assert field.input_value().startswith(text + "\n\n") and "<summary>" in field.input_value()
        expect(field).to_be_focused()
        old_prompt=field.input_value()
        bar.get_by_role("button", name="Model · gpt-5.2").click()
        expect(page.get_by_role("dialog",name="Dil modeli seç")).to_be_visible()
        page.keyboard.press("Escape")
        bar.get_by_role("button", name="Tasarım",exact=True).click()
        expect(page.get_by_role("dialog",name="Tasarım galerisi")).to_be_visible()
        page.keyboard.press("Escape")
        expect(field).to_have_value(old_prompt)
        field.fill("")
        library()
        card("Avlu Sofrası").get_by_role("button",name="Şablonla başla").click()
        frame=page.frame_locator('iframe[title="Önizleme"]').first
        expect(frame.locator("h1")).to_have_text("Avluda bu akşam")
        original_scope=page.evaluate("window.__gmStudio.scope")
        field.fill("Rezervasyon saatlerini güncelle.")
        library()
        dialog.get_by_role("searchbox").fill("derslik")
        card("Derslik").get_by_role("button",name="Ayrı taslak oluştur").click()
        expect(dialog.get_by_role("status")).to_contain_text("Derslik")
        card("Derslik").get_by_role("button",name="Canlı dene").click()
        page.get_by_role("button",name="Bu akışı isteme ekle").click()
        assert field.input_value().startswith("Rezervasyon saatlerini güncelle.\n\n")
        assert "Derslik" in field.input_value()
        amended=field.input_value()
        expect(frame.locator("h1")).to_have_text("Avluda bu akşam")
        assert page.evaluate("window.__gmStudio.scope")==original_scope
        page.reload(wait_until="domcontentloaded")
        expect(field).to_have_value(amended)
        library()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        assert dialog.locator("button").first.bounding_box()["height"]>=44
        page.screenshot(path=str(ROOT / "validation/screens" / f"studyo-kaynaklar-{width}.png"))
        page.keyboard.press("Escape")
        page.evaluate("location.hash='uygulamalarim'")
        page.get_by_role("button", name="Yerel taslaklar", exact=True).click()
        page.locator(".pj-grid button").filter(has_text="Derslik").click()
        expect(frame.locator("h1")).to_have_text("Öğrenci çalışma alanı")
        assert page.evaluate("window.__gmStudio.scope")!=original_scope
        assert not errors, errors
        print(width, "PASS", flush=True)
        browser.close()
