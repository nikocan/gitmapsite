"""Verify sector workflows, template appearance and hand-off to Studio."""
from datetime import date, timedelta
import re
from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright

NEW_TEMPLATES = {
    "mimari": (20, 680, False),
    "cicek": (2, 900, False),
    "pilates": (2, 1550, True),
    "etkinlik": (25, 2300, False),
    "detaygaraj": (2, 2750, True),
    "kavurma": (2, 425, False),
    "patik": (2, 800, True),
    "fotostudyo": (2, 6250, False),
}

TODAY = (date.today() + timedelta(days=2)).isoformat()


def add_record(surface, quantity=2, booking=False):
    expect(surface.locator("#total")).to_have_text(re.compile("₺"))
    surface.locator(".offer").nth(1).click()
    expect(surface.locator('[name="service"]')).to_have_value("1")
    surface.locator('[name="quantity"]').fill(str(quantity))
    surface.locator('[name="day"]').fill(TODAY)
    if booking:
        surface.locator('[name="slot"]').select_option("10:30")
    surface.locator('[name="customer"]').fill("Deneme Müşteri")
    surface.locator('button[type="submit"]').click()
    expect(surface.locator("#records li")).to_contain_text("Deneme Müşteri")


with sync_playwright() as playwright:
    for width in (390, 1440):
        browser, page = setup(playwright, width)
        page.set_default_timeout(7500)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        for template, (quantity, rate, booking) in NEW_TEMPLATES.items():
            page.goto(f"{BASE_URL}/templates/{template}.html")
            assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
            expect(page.locator("#empty")).to_be_visible()
            add_record(page, quantity, booking)
            expect(page.locator("#records")).to_contain_text(f"{quantity * rate:,}".replace(",", "."))
            page.reload()
            expect(page.locator("#records li")).to_have_count(1)
            if booking:
                page.locator('[name="day"]').fill(TODAY)
                expect(page.locator('[name="slot"] option[value="10:30"]')).to_have_count(0)
        page.goto(f"{BASE_URL}/#sablonlar", wait_until="domcontentloaded")
        expect(page.locator(".tpl-group .tpc")).to_have_count(36)
        page.get_by_role("button", name="Premium koleksiyon").click()
        expect(page.locator(".tpl-group .tpc")).to_have_count(8)
        page.get_by_label("Katalog teması").select_option("ivory")
        card = page.locator(".tpc").filter(has_text="Forme Pilates")
        expect(card.locator(".tpl-phone-shot")).to_have_attribute("src", "templates/previews/pilates-ivory-mobile.webp")
        card.get_by_role("button", name="Telefon").click()
        dialog = page.locator(".tpl-dialog")
        demo = dialog.frame_locator("iframe")
        expect(demo.locator("html")).to_have_attribute("data-gm-template-theme", "ivory")
        add_record(demo, booking=True)
        dialog.get_by_label("Önizleme teması").select_option("noir")
        expect(demo.locator("html")).to_have_attribute("data-gm-template-theme", "noir")
        expect(demo.locator("#records li")).to_have_count(1)
        dialog.get_by_role("button", name="Bu şablonla başla").click()
        stage = page.frame_locator('iframe[title="Önizleme"]').first
        expect(stage.locator("html")).to_have_attribute("data-gm-template-theme", "noir")
        expect(stage.locator("#records li")).to_have_count(0)
        add_record(stage, booking=True)
        page.reload(wait_until="domcontentloaded")
        expect(stage.locator("#records li")).to_have_count(1)
        page.goto(f"{BASE_URL}/?test=2#sablonlar", wait_until="domcontentloaded")
        legacy = page.locator(".tpc").filter(has_text="Nova CRM")
        legacy.get_by_role("button", name="Detaylar").click()
        page.get_by_role("button", name="Açık projeye uyarlama isteği hazırla").click()
        expect(page.get_by_role("textbox",name="Değişiklik isteği")).to_have_value(re.compile("Nova CRM.*Mevcut sayfaları ve verileri koruyarak"))
        expect(stage.locator("#records li")).to_have_count(1)
        assert not errors, errors
        print(width, "premium workflows, appearance and Studio hand-off passed", flush=True)
        browser.close()
