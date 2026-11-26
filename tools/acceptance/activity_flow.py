from browser_support import ROOT, BASE_URL, setup, sync_playwright
from playwright.sync_api import expect
import os

with sync_playwright() as p:
    for width in (390, 1440):
        browser, page = setup(p, width)
        page.set_default_timeout(9000)
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.route("**/api/health", lambda r: r.fulfill(json={"ok": True}))
        page.route("**/api/ai/models", lambda r: r.fulfill(json={"platform": [], "byok": []}))
        # Hold the response between actual SSE frames, without spending account credits.
        page.add_init_script("""if (top === self) {
          const original = window.fetch;
          window.fetch = (url, init) => {
            if (!String(url).endsWith('/api/ai/generate')) return original(url, init);
            return Promise.resolve(new Response(new ReadableStream({start(c) {
              const emit = data => c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(data)+'\\n\\n'));
              emit({t:'phase',phase:'connected'});
              window.writePart=()=>emit({t:'delta',d:'<main><style>p{color:black}</style></main>'});
              window.endWork=()=>{emit({t:'done',html:'<h1>Menü</h1>',summary:'Menü hazır',spent:3});c.close()};
              init.signal.addEventListener('abort',()=>c.error(new DOMException('Durduruldu','AbortError')));
            }})));
          };
        }""")
        page.goto(os.getenv("FLOW_SITE", BASE_URL) + "/#studio", wait_until="domcontentloaded")
        if os.getenv("FLOW_SITE"):
            expect(page.locator("html")).to_have_count(1)
            assert page.evaluate('VERSION') == "5.26.0"
        field = page.locator("textarea.gta")
        expect(page.locator(".gsend")).to_be_disabled()
        page.get_by_title("Ekle", exact=True).click()
        with page.expect_file_chooser() as chooser:
            page.get_by_role("menuitem", name="Görsel ya da çizim ekle").click()
        chooser.value.set_files(ROOT / "pwa/icon-180.png")
        expect(page.locator(".tray .att")).to_have_count(1)
        page.get_by_title("Kaldır", exact=True).click()
        expect(page.locator(".tray .att")).to_have_count(0)
        for item, panel in (("Tasarım teması", ".dg"), ("Dil modeli", ".mp"), ("Beceriler", ".skm"), ("Asistanla konuş", ".cp")):
            page.get_by_title("Ekle", exact=True).click()
            page.get_by_role("menuitem", name=item).click()
            expect(page.locator(panel)).to_be_visible()
            page.keyboard.press("Escape")
            expect(page.locator(panel)).not_to_be_visible()
        page.get_by_title("Ekle", exact=True).click()
        page.get_by_role("menuitem", name="Komutlar").click()
        expect(field).to_have_value("/")
        page.locator(".slashm button").first.click()
        assert field.input_value().startswith("/")
        field.fill("Menü ve rezervasyon ekranını oluştur")
        page.get_by_role("button", name="İstek bilgisi").click()
        expect(page.locator("#composer-request-info")).to_contain_text("Yeni proje")
        page.locator(".gsend").click()
        expect(page.locator(".flow-list")).to_be_visible()
        toggle = page.get_by_role("button", name="İşlem akışı", exact=True)
        toggle.click()
        expect(page.locator(".flow-list")).to_have_count(0)
        toggle.click()
        expect(page.locator(".flow-list")).to_contain_text("Model isteği kabul etti")
        page.evaluate("writePart()")
        expect(page.locator(".flow-list")).to_contain_text("Stil kodu")
        page.locator(".flow-detail summary").click()
        expect(page.locator(".cx-card")).to_be_visible()
        field.fill("İletişim alanını düzenle")
        page.get_by_title("Sıraya ekle (Enter)").click()
        page.get_by_role("button", name="Sıradan çıkar").click()
        page.locator(".flow-detail summary").click()
        page.locator(".flow-update").scroll_into_view_if_needed()
        page.screenshot(path=str(ROOT / "validation/screens" / f"akis-canli-{width}.png"))
        page.evaluate("endWork()")
        expect(page.locator(".flow-credit")).to_contain_text("3 kredi")
        expect(page.locator(".studio-message-text").last).to_contain_text("Menü hazır")
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        page.locator(".flow-credit").scroll_into_view_if_needed()
        page.wait_for_timeout(1600)
        page.screenshot(path=str(ROOT / "validation/screens" / f"akis-{width}.png"))
        page.reload(wait_until="domcontentloaded")
        page.locator(".cx-head").last.click()
        expect(page.locator(".flow-credit")).to_contain_text("3 kredi")
        field.fill("Renkleri güncelle")
        page.locator(".gsend").click()
        page.get_by_role("button", name="Durdur", exact=True).click()
        expect(page.locator(".cx-status").last).to_contain_text("durduruldu")
        assert not errors, errors
        print(width, "PASS", flush=True)
        browser.close()
