"""Exercise the design catalog, three working UI kits, and the Studio hand-off."""
from datetime import date, timedelta
from playwright.sync_api import expect
from browser_support import BASE_URL, setup, sync_playwright


def shop(surface):
    surface.get_by_label("Ürün ara").fill("Kupa")
    expect(surface.locator(".product")).to_have_count(1)
    surface.get_by_role("button", name="İncele").click()
    surface.get_by_role("button", name="Favorilere ekle").click()
    surface.get_by_role("button", name="Sepete ekle").click()
    surface.get_by_role("button", name="Favoriler", exact=True).click()
    expect(surface.get_by_role("heading", name="Ada Seramik Kupa")).to_be_visible()
    surface.locator('header [data-view=cart]').click()
    surface.get_by_role("button", name="Ada Seramik Kupa artır").click()
    surface.get_by_role("button", name="Teslimata geç").click()
    surface.get_by_label("Teslimat seçeneği").select_option("79")
    expect(surface.locator("#checkout-sum")).to_contain_text("1.059")
    surface.get_by_role("button", name="Deneme siparişini tamamla").click()
    expect(surface.get_by_role("heading", name="Deneme siparişi alındı.")).to_be_visible()


def booking(page):
    page.get_by_role("button", name="Seans seç").first.click()
    day = (date.today() + timedelta(days=1)).isoformat()
    page.get_by_label("Randevu günü").fill(day)
    page.get_by_role("button", name="10:30").click()
    page.get_by_role("button", name="Randevuyu onayla").click()
    expect(page.get_by_role("heading", name="Randevu kaydedildi.")).to_be_visible()
    page.get_by_role("button", name="Seanslar").click()
    page.get_by_role("button", name="Seans seç").first.click()
    expect(page.get_by_role("button", name="10:30")).to_be_disabled()
    page.get_by_role("button", name="Randevularım").click()
    page.get_by_role("button", name="İptal et").click()
    expect(page.get_by_text("Henüz bir randevunuz yok.")).to_be_visible()


def operations(page):
    page.get_by_role("button", name="Yeni iş").click()
    page.get_by_label("İş başlığı").fill("Deneme raporu")
    page.get_by_label("Sorumlu ekip").fill("Deneme")
    page.get_by_role("button", name="İşi kaydet").click()
    page.get_by_label("Ara", exact=True).fill("Deneme raporu")
    expect(page.locator(".row-card")).to_have_count(1)
    page.get_by_role("button", name="İşi aç").click()
    page.get_by_label("Durum").select_option("2")
    page.get_by_role("button", name="Güncelle").click()
    row = page.locator(".row-card").filter(has_text="Deneme raporu")
    expect(row).to_contain_text("Tamamlandı")
    page.reload()
    expect(row).to_contain_text("Tamamlandı")


with sync_playwright() as play:
    for width in (390, 1440):
        browser, page = setup(play, width)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE_URL + "/#ana", wait_until="domcontentloaded")
        page.locator(".home-box").get_by_role("button", name="Web sitesi", exact=True).click()
        page.get_by_label("Yeni proje fikri").fill("Ürün filtreleri olan butik mağaza")
        starter = page.locator(".catalog-starter")
        expect(starter.get_by_role("heading", name="Web sitesi örnekleri")).to_be_visible()
        expect(starter.locator(".catalog-example").first).to_contain_text("Forma Mağaza")
        starter.locator(".catalog-example").first.click()
        page.locator(".tpl-dialog").get_by_role("button", name="Bu şablonla başla").click()
        expect(page.get_by_role("textbox", name="Değişiklik isteği")).to_have_value("Ürün filtreleri olan butik mağaza")
        page.goto(BASE_URL + "/?design_theme=1#temalar", wait_until="domcontentloaded")
        theme = page.locator(".theme-catalog-card").filter(has_text="Atelier")
        expect(page.locator(".theme-catalog-card")).to_have_count(4)
        page.get_by_label("Karşılaştırma örneği").select_option("forma")
        theme.get_by_role("button", name="Temayı canlı dene").click()
        dialog = page.locator(".tpl-dialog")
        demo = dialog.frame_locator("iframe")
        expect(demo.locator("html")).to_have_attribute("data-gm-template-theme", "atelier")
        shop(demo)
        dialog.get_by_role("button", name="Bu şablonla başla").click()
        stage = page.frame_locator('iframe[title="Önizleme"]').first
        expect(stage.locator("html")).to_have_attribute("data-gm-template-theme", "atelier")
        expect(stage.get_by_role("heading", name="Her güne iyi gelen parçalar.")).to_be_visible()
        page.goto(BASE_URL + "/?design_check=1#ui-kitler", wait_until="domcontentloaded")
        expect(page.locator(".kit-catalog-card")).to_have_count(3)
        assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
        page.goto(BASE_URL + "/templates/molaseans.html")
        booking(page)
        page.goto(BASE_URL + "/templates/akisoperasyon.html")
        operations(page)
        assert not errors, errors
        print(f"{width}: context, catalog, theme, commerce, booking and operations passed", flush=True)
        browser.close()
