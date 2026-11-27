"""Verify the Oracle training cases and the project-scoped skill selection."""
from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright

with sync_playwright() as playwright:
    for width in (390, 1440):
        browser, page = setup(playwright, width)
        page.route("**/api/health", lambda r: r.fulfill(json={"ok": True}))
        page.route("**/api/ai/models", lambda r: r.fulfill(json={"platform": [], "byok": []}))
        page.goto(BASE_URL + "/#sablonlar", wait_until="domcontentloaded")
        card = page.locator(".tpc").filter(has_text="Oracle Teşhis Atölyesi").first
        card.click()
        page.get_by_role("button", name="Bu şablonla başla").click()
        if width == 390:
            page.get_by_role("button", name="Önizlemeye git").click()
        view = page.frame_locator('iframe[title="Önizleme"]').first
        finding = view.locator("#finding")
        submit = view.get_by_role("button", name="Kanıtı değerlendir")
        expect(finding).to_have_text("Teslim farkı 15 adet.")
        view.locator("#match").select_option("2")
        submit.click()
        expect(finding).to_contain_text("farkı görünmüyor")
        view.locator("#billed").fill("120")
        submit.click()
        expect(finding).to_have_text("Sipariş aşımı 20 adet.")
        view.locator("#kind").select_option("job")
        expect(finding).to_contain_text("tek gözlem")
        view.locator("#phase").select_option("Inactive / No Manager")
        submit.click()
        expect(finding).to_contain_text("uygun yönetici bulunamadı")
        view.locator("#kind").select_option("group")
        expect(finding).to_contain_text("20 TL")
        view.locator("#credit").fill("500")
        submit.click()
        expect(finding).to_contain_text("eşleşiyor")
        page.locator("textarea.gta").fill("Teşhis kaydına dönem alanı ekle")
        page.route("**/api/ai/generate", lambda r: r.fulfill(status=503, json={"error":"Test tamamlandı"}))
        with page.expect_request(lambda r:r.url.endswith("/api/ai/generate")) as request:
            page.locator(".gsend").click()
        assert set(request.value.post_data_json["businessSkillIds"]) == {"oracle-ap","oracle-queue","oracle-hfm"}
        browser.close()
        print(width, "px Oracle teşhis ve beceri seçimi geçti")
