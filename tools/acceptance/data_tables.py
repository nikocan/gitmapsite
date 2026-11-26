"""Exercise pricing, model guidance, account history and the admin cost report."""

from urllib.parse import urlsplit
from playwright.sync_api import expect
from browser_support import BASE_URL, ROOT, json, setup, sync_playwright


def fixture(route):
    # An unusually long identifier also exercises the budget recommendation above the table.
    model_id = "ornek-" + "uzunkimlik" * 8
    path = urlsplit(route.request.url).path
    payloads = {
        "/api/health": {"ok": True},
        "/api/auth/me": {"user": {"id": "ornek", "name": "Örnek", "email": "ornek@example.test", "credits": 17, "admin": True}},
        "/api/apps": {"apps": []},
        "/api/ai/models": {"platform": [], "byok": []},
        "/api/admin/overview": {"stats": {"pending": 0}},
        "/api/admin/users": {"rows": [{"id":"a","name":"Test","email":"test@example.test","credits":3}], "total":1},
        "/api/admin/projects": {"rows": [{"id":"b","owner":"test@example.test","title":"Örnek","status":"draft","updated":"2026-11-20"}], "total":1},
        "/api/admin/orders": {"orders": [{"id":"GM-TEST","name":"Test","brand":"Örnek",
                                          "tier":"site","total":1500,"monthly":0,"created":"2026-11-20","ai":[]}],
                              "total":1,"stats":{"total":1,"pending":1,"revenue":0,"monthly":0}},
        "/api/me/usage": {"credits": 17, "usage": [
            {"created": "2026-11-20 10:00:00", "kind": "build", "model": model_id, "provider": "gitmapp", "credits": 3}
        ]},
        "/api/admin/costs": {"settings": {}, "rows": [
            {"provider": "gitmapp", "kind": "build", "model": model_id, "calls": 982, "tokens": 9999, "cost": 1250, "missing": 0}
        ], "integrations": [], "rates": [], "total": 1250},
    }
    route.fulfill(json=payloads.get(path, {}))


def contrast(element):
    return element.evaluate("""el => {
      function luminance(rgb) {
        const [r,g,b] = rgb.match(/[\\d.]+/g).slice(0,3).map(v => {
          const s = Number(v) / 255;
          return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
        });
        return .2126*r + .7152*g + .0722*b;
      }
      let bg=el;
      while(bg.parentElement && getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)') bg=bg.parentElement;
      const a=luminance(getComputedStyle(el).color), b=luminance(getComputedStyle(bg).backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    }""")


results = []
with sync_playwright() as playwright:
    for width in (320, 390, 1440):
        browser, page = setup(playwright, width)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.add_init_script("""if(top===self)localStorage.gms_tok='"ornek"';""")
        page.route("https://api.gitmapp.com/**", fixture)
        for route, name in (("paketler", "Ek hizmetler"), ("modeller", "İşe göre dil modeli seçimi"),
                            ("hesabim", "Kullanım geçmişi"), ("maliyetler", "Model ve işlem kullanımı"),
                            ("ai-destek", "İşe göre model sınıfı"), ("kullanicilar", "Hesaplar"),
                            ("yonetim-projeler", "Projeler"), ("siparisler", "Siparişler")):
            page.goto(BASE_URL + "/#" + route, wait_until="domcontentloaded")
            table = page.get_by_role("table", name=name, exact=True)
            expect(table).to_be_visible()
            headers = table.locator("thead th")
            assert headers.count() > 0
            assert all(h.get_attribute("scope") == "col" for h in headers.all())
            ratios = [contrast(h) for h in headers.all()]
            assert min(ratios) >= 4.5
            result = {"sayfa": route, "genişlik": width, "tablo": name,
                      "en_düşük_başlık_kontrastı": round(min(ratios), 2)}
            if route == "paketler":
                expect(table.get_by_role("rowheader")).to_have_count(4)
                badge = page.get_by_text("En çok tercih edilen", exact=True)
                result["rozet_kontrastı"] = round(contrast(badge), 2)
                assert result["rozet_kontrastı"] >= 4.5
            numbers = table.locator("td.table-number")
            assert all(n.evaluate("el=>['end','right'].includes(getComputedStyle(el).textAlign)") for n in numbers.all())
            if route in ("hesabim","maliyetler","kullanicilar","yonetim-projeler","siparisler"):
                region = page.get_by_role("region", name=name, exact=True)
                if width < 640:
                    expect(region).to_be_visible()
                    region.focus()
                    expect(region).to_be_focused()
                    region.press("ArrowRight")
                    page.wait_for_function("document.activeElement.scrollLeft > 0")
                    result["klavyeyle_yatay_kaydırma"] = True
                    region.evaluate("""el=>new Promise(done=>{
                        const timer=setTimeout(done,500);
                        el.addEventListener('scrollend',()=>{clearTimeout(timer);done()},{once:true});
                    })""")
                    region.evaluate("el=>el.scrollTo({left:0,behavior:'instant'})")
                else:
                    expect(region).to_have_count(0)
            doc_width = page.evaluate("document.documentElement.scrollWidth")
            assert doc_width == width, (width, route, doc_width)
            result["sayfa_genişliği"] = doc_width
            if route == "hesabim" and width in (390, 1440):
                table.locator("../..").screenshot(path=ROOT/"validation/screens"/f"kullanim-tablosu-{width}.png")
            results.append(result)
        assert not errors, errors
        browser.close()
(ROOT/"validation"/"veri-tablolari.json").write_text(json.dumps(results, ensure_ascii=False, indent=2)+"\n")
print("PASS", len(results), "page/viewport combinations")
