"""Exercise GT's Studio entry, evidence, assistant and app smoke test."""
import json
from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright

with sync_playwright() as playwright:
    for width in (390, 1440):
        browser,page=setup(playwright,width)
        page.set_default_timeout(6500)
        page.route("**/api/health",lambda r:r.fulfill(json={"ok":True}))
        page.route("**/api/ai/models",lambda r:r.fulfill(json={"platform":[],"byok":[]}))
        page.route("**/api/ai/gt",lambda r:r.fulfill(json={"reply":"PAYMENT_PENDING · olay zamanını kontrol et."}))
        page.goto(BASE_URL+"/#studio",wait_until="domcontentloaded")
        page.get_by_role("button",name="GitmappGT teknik destek").click()
        panel=page.locator(".gt-dialog")
        evidence=page.evaluate("GT_SAMPLE")
        panel.get_by_label("Şema ve sinyalleri yükle").set_input_files({"name":"context.json","mimeType":"application/json","buffer":json.dumps(evidence).encode()})
        expect(panel).to_contain_text("PAYMENT_PENDING")
        panel.get_by_label("Teknik soru").fill("Ödeme neden bekliyor?")
        with page.expect_request(lambda r:r.url.endswith("/api/ai/gt")) as sent:
            panel.get_by_text("GT’ye sor").click()
        assert sent.value.post_data_json["snapshot"]["links"]==evidence["links"]
        expect(panel.locator(".gt-answer")).to_contain_text("olay zamanını")
        panel.get_by_text("Uygulama testi",exact=True).click()
        for body,outcome in [("<h1>Hasar</h1>","Geçti"),("<script>throw Error('test')</script><h1>Hasar</h1>","Başarısız")]:
            panel.get_by_label("Test için HTML yükle").set_input_files({"name":"app.html","mimeType":"text/html","buffer":("<title>Hasar</title>"+body).encode()})
            expect(panel.get_by_text(outcome+" · Başlangıç hatası yok",exact=True)).to_be_visible()
        html="<!doctype html><html><head><title>Hasar</title></head><body><h1>Hasar</h1></body></html>"
        page.route("**/api/ai/generate",lambda r:r.fulfill(content_type="text/event-stream",body="data: "+json.dumps({"t":"done","html":html,"title":"Hasar","summary":"Örnek"})+"\n\n"))
        panel.get_by_text("Taslakta geliştir ve test et").click()
        expect(panel.get_by_text("Geçti · Başlangıç hatası yok",exact=True)).to_be_visible()
        panel.get_by_text("Kapat",exact=True).click()
        expect(page.frame_locator('iframe[title="Önizleme"]').first.locator("h1")).to_have_text("Hasar")
        browser.close()
        print(width,"px GT akışı geçti")
