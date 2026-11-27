"""Check that the storefront, detail dialog and Studio use the same template."""
from datetime import date, timedelta

from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright


CASES = {
    "molaseans": ("Mola Seans", "Kendinize zaman ayırın.", "[data-choice]"),
    "pilates": ("Forme Pilates", "Hareket için sakin bir alan.", ".offer"),
    "fotostudyo": ("Lento Fotoğraf", "Dönüp bakmak isteyeceğiniz kareler.", ".offer"),
    "patik": ("Patik Veteriner", "Küçük dostlara özenli bakım.", ".offer"),
}


def signature(frame):
    return frame.locator("html").evaluate("""el => ({
      title: document.querySelector("h1").textContent.trim(),
      image: document.querySelector(".hero-art img, .hero img, main img")?.src,
      theme: el.dataset.gmTemplateTheme,
      mode: el.dataset.gmMode,
      color: getComputedStyle(el).getPropertyValue("--pr").trim(),
      heading: getComputedStyle(document.querySelector("h1")).fontFamily,
      width: innerWidth
    })""")


with sync_playwright() as playwright:
    for width in (390, 1440):
        browser, page = setup(playwright, width)
        page.set_default_timeout(12000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/api/health", lambda route: route.fulfill(json={"ok": True}))
        page.route("**/api/ai/models", lambda route: route.fulfill(json={"platform": [], "byok": []}))
        page.route("**/api/store**", lambda route: route.fulfill(json={"apps": []}))

        for key, (name, heading, action) in CASES.items():
            page.goto(BASE_URL + "/#magaza?q=" + name, wait_until="domcontentloaded")
            tile = page.get_by_role("button", name=name + " · Ayrıntılar", exact=True).first
            expect(tile.locator(".tpl-phone-shot")).to_have_attribute("src", f"templates/previews/{key}-mobile.webp")
            tile.locator(".tpl-phone-shot").evaluate("image => image.decode()")
            tile.locator(".tpl-phone-shot").click()
            modal = page.get_by_role("dialog", name=name + " · Şablon")
            expect(modal.locator(".cx-template-shot img")).to_have_attribute("src", f"templates/previews/{key}-light-0.webp")
            modal.get_by_label("Önizleme teması").select_option("ivory")
            modal.get_by_role("button", name="Koyu", exact=True).click()
            modal.get_by_role("button", name="Tablet", exact=True).click()
            demo = modal.frame_locator("iframe")
            expect(demo.locator("h1")).to_have_text(heading)
            expect(demo.locator("html")).to_have_attribute("data-gm-template-theme", "ivory")
            expect(demo.locator("html")).to_have_attribute("data-gm-mode", "dark")
            expect(demo.locator(action).first).to_be_visible()
            before = signature(demo)
            assert before["width"] == 768
            modal.get_by_role("button", name="Bu şablonla başla").click()
            studio = page.frame_locator('iframe[title="Önizleme"]').first
            expect(studio.locator("html")).to_have_attribute("data-gm-mode", "dark")
            expect(studio.locator(action).first).to_be_visible()
            assert signature(studio) == before
            if key == "molaseans":
                page.locator(".ws-top").get_by_title("Telefon", exact=True).click()
                studio.get_by_role("button", name="Seans seç").first.click()
                studio.get_by_label("Randevu günü").fill((date.today() + timedelta(days=1)).isoformat())
                studio.get_by_role("button", name="10:30", exact=True).click()
                studio.get_by_role("button", name="Randevuyu onayla").click()
                expect(studio.get_by_role("heading", name="Randevu kaydedildi.")).to_be_visible()
                page.wait_for_function("""() => {
                    const scope = window.__gmStudio.scope;
                    const saved = LS.get("templateState:" + scope, "");
                    return saved.includes("10:30");
                }""")
                page.reload(wait_until="domcontentloaded")
                visits = studio.get_by_role("button", name="Randevularım", exact=True)
                visits.scroll_into_view_if_needed()
                visits.click()
                expect(studio.get_by_role("heading", name="Randevularım")).to_be_visible()
                expect(studio.get_by_role("button", name="İptal et")).to_have_count(1)

        page.goto(BASE_URL + "/#sablonlar", wait_until="domcontentloaded")
        if width == 390:
            page.get_by_role("button", name="Filtreler").click()
        page.get_by_label("Şablon ara").fill("Patik Veteriner")
        page.get_by_label("Katalog teması").select_option("gallery-plum")
        tile = page.get_by_role("button", name="Patik Veteriner · Ayrıntılar", exact=True)
        themed = tile.frame_locator("iframe").first
        expect(themed.locator("html")).to_have_attribute("data-gm-template-theme", "gallery-plum")
        expect(tile.locator("img.tpl-phone-shot")).to_have_count(0)
        tile.click()
        modal = page.get_by_role("dialog", name="Patik Veteriner · Şablon")
        expect(modal.frame_locator("iframe").locator("html")).to_have_attribute("data-gm-template-theme", "gallery-plum")
        modal.get_by_role("button", name="Önizlemeyi kapat").click()
        page.locator(".mobile-promo-phone.back").click()
        expect(page.get_by_role("dialog", name="Paylı Adisyon · Şablon")).to_be_visible()
        page.get_by_role("button", name="Önizlemeyi kapat").click()
        page.goto(BASE_URL + "/#ui-kitler", wait_until="domcontentloaded")
        kit = page.locator(".kit-catalog-card").filter(has_text="Mola Seans")
        kit.get_by_role("button", name="Saat seçimi ekranını incele").click()
        expect(page.locator(".tpl-dialog .cx-template-shot img")).to_have_attribute("src", "templates/previews/molaseans-light-1.webp")
        assert not errors, errors
        print(f"{width}px Keşfet, temalar, UI kitleri ve Stüdyo eşleşiyor", flush=True)
        browser.close()
