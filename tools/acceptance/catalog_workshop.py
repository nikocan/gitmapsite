"""Exercise the collection navigation, preview dismissal and owned code edits."""
from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright


with sync_playwright() as play:
    for width in (390, 1440):
        browser, page = setup(play, width)
        page.set_default_timeout(9000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("**/api/health", lambda r: r.fulfill(json={"ok": True}))
        page.route("**/api/store?**", lambda r: r.fulfill(json={"apps": []}))
        page.route("**/api/skills", lambda r: r.fulfill(json={
            "sectors": [{"id": "spor", "name": "Spor", "desc": "Stüdyo ve kulüp"}],
            "skills": [{"id": "plan-pilates", "name": "Pilates planı", "sector": "spor",
                        "kind": "gelistirme", "body": "MODÜLLER: Seanslar, Randevular",
                        "who": "Stüdyolar", "uses": 0, "version": 1}]}))
        page.route("**/api/ai/engineering", lambda r: r.fulfill(json={
            "review": "Beklenmeyen istisnayı çağırana ilet.", "code": "BEGIN NULL; END;",
            "tests": ["Eksik kayıtla istisna yolunu kontrol et."], "credits": None}))
        page.goto(BASE_URL + "/#magaza", wait_until="domcontentloaded")
        try:
            nav = page.get_by_role("navigation", name="Koleksiyonlar")
            expect(nav).to_be_visible()
            search=page.get_by_role("combobox",name="Uygulama, şablon veya fikir ara")
            search.fill("randevu")
            option=page.get_by_role("option").filter(has=page.locator(".ks-mini")).first
            expect(option).to_be_visible()
            option.click()
            expect(page.locator(".gallery-detail")).to_be_visible()
            page.keyboard.press("Escape")
            nav.get_by_role("button", name="Şablonlar").click()
            first = page.locator(".tpl-group .tpc").first
            if width == 1440:
                first.hover()
                expect(page.locator(".gallery-peek")).to_be_visible()
                page.keyboard.press("Escape")
                expect(page.locator(".gallery-peek")).to_have_count(0)
            first.click()
            dialog = page.locator(".gallery-detail")
            expect(dialog).to_be_visible()
            expect(dialog.get_by_role("button", name="Telefon önizlemesi")).to_be_visible()
            page.mouse.click(2, 2)
            expect(dialog).to_have_count(0)
            nav.get_by_role("button", name="Eklentiler").click()
            page.get_by_role("button", name="WhatsApp · Ayrıntılar").click()
            expect(page.get_by_role("dialog")).to_contain_text("Telefon numarası")
            page.keyboard.press("Escape")
            nav.get_by_role("button", name="Bağdaştırıcılar").click()
            page.get_by_role("button", name="Özel API ekle").click()
            expect(page.get_by_text("Adres (https)", exact=True)).to_be_visible()
            page.get_by_role("button", name="Vazgeç").click()
            nav.get_by_role("button", name="Beceriler").click()
            page.get_by_role("button", name="Spor · Ayrıntılar").click()
            page.get_by_role("button", name="Pilates planı · Ayrıntılar").click()
            expect(page.get_by_role("dialog")).to_contain_text("Seanslar")
            page.keyboard.press("Escape")
            page.get_by_role("button",name="Tüm sektörler").click()
            page.get_by_role("button",name="Tümünü yönet").click()
            page.locator(".skill-manager-grid .gallery-tile").first.click()
            expect(page.get_by_role("dialog")).to_contain_text("Pilates planı")
            page.get_by_role("button",name="Beceriyi yükle",exact=True).click()
            page.keyboard.press("Escape")
            page.keyboard.press("Escape")
            nav.get_by_role("button", name="Oracle ve SAP").click()
            editor = page.locator(".eng-work:visible")
            editor.get_by_role("button", name="Örnek yükle").click()
            expect(editor).to_contain_text("Hata sessizce yutuluyor")
            expect(editor).to_contain_text("Kayıt bulunamadı")
            code = editor.get_by_label("Oracle kaynak kodu")
            original = code.input_value()
            editor.get_by_role("button", name="Kod önerisi al").click()
            editor.get_by_role("button", name="Öneriyi editöre uygula").click()
            expect(code).to_have_value("BEGIN NULL; END;")
            editor.get_by_role("button", name="Değişikliği geri al").click()
            expect(code).to_have_value(original)
            page.get_by_role("button", name="SAP · ABAP", exact=True).click()
            editor.get_by_role("button", name="Örnek yükle").click()
            expect(editor).to_contain_text("Dahili tabloda satır bulunamadı")
            engine_example=page.get_by_label("SAP kaynak kodu").input_value()
            editor.get_by_role("button",name="Taslağı bu cihazda kaydet").click()
            page.reload(wait_until="domcontentloaded")
            page.get_by_role("button",name="SAP · ABAP",exact=True).click()
            expect(page.get_by_label("SAP kaynak kodu")).to_have_value(engine_example)
            assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
            assert not errors, errors
            print(width, "px · koleksiyon ve atölye akışları geçti", flush=True)
        except Exception:
            print("page errors:", errors, flush=True)
            raise
        finally:
            browser.close()

