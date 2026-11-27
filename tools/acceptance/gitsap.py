"""Exercise the GitSap starter through Studio at both supported viewport sizes."""
from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright


def post(frame, action, reference, quantity):
    frame.locator("#action").select_option(action)
    frame.locator("#ref").fill(reference)
    frame.locator("#qty").fill(str(quantity))
    frame.get_by_role("button", name="Belgeyi işle").click()


with sync_playwright() as playwright:
    for width in (390, 1440):
        browser, page = setup(playwright, width)
        page.route("**/api/health", lambda route: route.fulfill(json={"ok": True}))
        page.route("**/api/ai/models", lambda route: route.fulfill(json={"platform": [], "byok": []}))
        page.goto(BASE_URL + "/#sablonlar", wait_until="domcontentloaded")
        card = page.locator(".tpc").filter(has_text="GitSap Üretim Mutabakatı").first
        card.get_by_text("Stüdyo’da kullan", exact=True).click()
        frame = page.frame_locator('iframe[title="Önizleme"]').first
        expect(frame.locator("#open")).to_have_text("100 kg")
        post(frame, "receive", "MK-01", 60)
        post(frame, "receive", "MK-01", 20)
        expect(frame.locator("#message")).to_contain_text("benzersiz")
        post(frame, "receive", "MK-02", 41)
        expect(frame.locator("#message")).to_contain_text("aşıyor")
        post(frame, "produce", "UR-01", 40)
        post(frame, "invoice", "FT-01", 50)
        expect(frame.locator("#trail li")).to_have_count(4)
        expect(frame.locator("#open")).to_have_text("40 kg")
        expect(frame.locator("#raw")).to_have_text("20 kg")
        expect(frame.locator("#goods")).to_have_text("800 adet")
        expect(frame.locator("#unbilled")).to_have_text("2.000 TL")
        expect(frame.locator("#ledger tr")).to_have_count(3)
        expect(frame.locator("#balance")).to_contain_text("Toplam borç 30.000 TL · Toplam alacak 30.000 TL")
        expect(frame.locator("#balance")).to_contain_text("Satıcı bakiyesi 10.000 TL")
        expect(frame.locator("#reconciliation")).to_contain_text("uzlaşıyor")
        page.locator("textarea.gta").fill("Mal kabul ekranına açıklama ekle")
        page.route("**/api/ai/generate", lambda route: route.fulfill(status=503, json={"error":"Test bitti"}))
        with page.expect_request(lambda request: request.url.endswith("/api/ai/generate")) as sent:
            page.locator(".gsend").click()
        assert set(sent.value.post_data_json["businessSkillIds"]) == {
            "gitsap-tedarik", "gitsap-uretim", "gitsap-fatura", "gitsap-finans"
        }
        browser.close()
        print(width, "px GitSap mutabakatı geçti")
