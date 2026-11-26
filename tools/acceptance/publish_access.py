"""Exercise the publish dialog without creating an order or publishing an app."""

import json
import re
from urllib.parse import urlsplit

from playwright.sync_api import expect
from browser_support import BASE_URL, ROOT, setup, sync_playwright


def open_publish(p, width):
    browser, page = setup(p, width)
    page.set_default_timeout(7000)
    app = dict(id="ux", title="AI Akışı", html="<h1>Program</h1>", status="draft")
    domains = [
        {"domain": "uzun-bir-marka-adi.com", "available": True},
        {"domain": "uzun-bir-marka-adi.net", "available": False},
    ]
    reply = "Ücretsiz **app.gitmapp.com** adresini açın.\n- Projeyi kaydedin\n- Yayın adresini seçin"
    responses = {
        "/api/health": {"ok": True, "domain": True},
        "/api/auth/me": {"user": {"id": "test", "name": "Test", "credits": 99}},
        "/api/apps": {"apps": [app]},
        "/api/apps/ux": {"app": app},
        "/api/ai/models": {"platform": [], "byok": []},
        "/api/ai/assist": {"reply": reply},
        "/api/domain/check": {"results": domains},
    }
    page.route("https://api.gitmapp.com/**", lambda r: r.fulfill(json=responses.get(urlsplit(r.request.url).path, {})))
    page.add_init_script("""if(top===self)localStorage.gms_tok='"fixture"'""")
    page.goto(BASE_URL + "/#studio", wait_until="domcontentloaded")
    page.wait_for_function("window.__gmStudio?.scope?.includes('test')")
    page.evaluate("""app=>dispatchEvent(new CustomEvent('gm:studio',{detail:{appId:app.id,title:app.title,html:app.html,msgs:[]}}))""", app)
    trigger = page.get_by_role("button", name="Yayınla", exact=True).first
    trigger.click()
    dialog = page.get_by_role("dialog", name="Yayın merkezi")
    expect(dialog).to_be_visible()
    return browser, page, dialog, trigger


def luminance(css):
    rgb = [int(n) / 255 for n in re.findall(r"\d+", css)[:3]]
    linear = [n / 12.92 if n <= 0.04045 else ((n + 0.055) / 1.055) ** 2.4 for n in rgb]
    return sum(n * weight for n, weight in zip(linear, [0.2126, 0.7152, 0.0722]))


def measure(page, dialog, trigger, width):
    for field in ["Yayın adresi", "Alan adı", "Mağaza kategorisi", "Fiyat (₺)", "Mağaza açıklaması", "Yayın asistanına sor"]:
        expect(dialog.get_by_label(field, exact=True)).to_be_attached()
    dialog.get_by_role("button", name="Sorgula").click()
    table = dialog.get_by_role("table", name="Alan adı sonuçları")
    expect(table.get_by_role("columnheader")).to_have_count(2)
    expect(table.get_by_role("rowheader")).to_have_count(2)
    expect(table.get_by_role("rowheader").last).to_contain_text("Alınmış")
    chip = dialog.get_by_role("button", name="Alan adı nedir?")
    chip.focus()
    page.keyboard.press("Enter")
    field = dialog.get_by_label("Yayın asistanına sor")
    expect(field).to_be_focused()
    expect(field).to_have_value("Alan adı nedir?")
    field.press("Enter")
    expect(dialog.get_by_role("log").locator("strong")).to_have_text("app.gitmapp.com")
    expect(dialog.get_by_role("log").get_by_role("listitem")).to_have_count(2)
    user = dialog.locator(".publish-msg.user")
    fg, bg = user.evaluate("el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]")
    dark, light = sorted([luminance(fg), luminance(bg)])
    ratio = (light + 0.05) / (dark + 0.05)
    assert ratio >= 4.5
    assert dialog.evaluate("el=>el.scrollWidth<=el.clientWidth")
    assert dialog.locator(".publish-transcript").evaluate("el=>el.scrollWidth<=el.clientWidth")
    controls = dialog.locator(".btn:visible,.ib:visible,.chip:visible,.in:visible")
    assert min(el.bounding_box()["height"] for el in controls.all()) >= 44
    assert dialog.evaluate("el=>el.contains(document.activeElement)")
    if width == 1440:
        dialog.evaluate("el=>el.scrollTop=0")
    else:
        user.scroll_into_view_if_needed()
    page.screenshot(path=str(ROOT / "validation/screens" / f"yayin-erisim-{width}.png"))
    page.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()
    expect(trigger).to_be_focused()
    return dict(genislik=width, sohbet_kontrasti=round(ratio, 2), sonuc="Geçti")


with sync_playwright() as p:
    results = []
    for width in [390, 1440]:
        browser, page, dialog, trigger = open_publish(p, width)
        results.append(measure(page, dialog, trigger, width))
        browser.close()
    evidence = {
        "başlangıç": {"commit": "4b0808d", "yazı": "#f5f5f7", "zemin": "#e4ff3d", "oran": 1.03,
                      "klavyeye_açık_hazır_soru": 0},
        "sonuçlar": results,
        "test": "Sahte hesap ve yanıtlarla Chromium: alan etiketleri, alan adı sonuçları, klavyeyle soru seçimi ve gönderim, zengin metin, kontrast, 44 px denetimler, taşma, Escape ve odak dönüşü.",
    }
    (ROOT / "validation/yayin-erisim.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(results, ensure_ascii=False))
