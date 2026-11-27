from browser_support import ROOT, BASE_URL, json, setup, sync_playwright
from playwright.sync_api import expect

root = ROOT / "validation"
long = "Öğrencilerimizin sürdürülebilirlik çalışmaları için hazırlanan ayrıntılı Türkçe değerlendirme"
results = []
def complete_task(view, id):
    if id == "dukkan":
        view.locator("#cart input").first.fill("2")
    if id == "ziyaret":
        view.locator("#budget").select_option("20000")
        expect(view.locator("#homes")).to_have_text("Bu bütçeye uygun ilan yok.")
        view.locator("#budget").select_option("32000")
    for el in view.locator("form [name]").all():
        if el.get_attribute("readonly") is not None:
            continue
        tag, typ = el.evaluate("el=>[el.tagName,el.type]")
        if tag == "SELECT":
            el.select_option(index=1)
        elif typ == "file":
            el.set_input_files(ROOT / "pwa/icon-180.png")
        else:
            el.fill(
                {
                    "number": "2",
                    "time": "11:00" if el.get_attribute("name") == "end" else "09:00",
                    "date": "2027-01-25"
                    if el.get_attribute("name") == "departure"
                    else "2027-01-22",
                    "datetime-local": "2027-01-22T10:00",
                }.get(typ, long)
            )
    if id == "adisyon":
        view.locator("[name=people]").fill("3")
    if id in ("yoklama", "rota"):
        for checkbox in view.locator("form [type=checkbox]").all()[:2]:
            checkbox.check()
    if id == "kasa":
        view.locator("[name=count]").fill("1")
    view.locator("button[type=submit]").click()
    expect(view.locator("#records li")).to_contain_text(long)
    if id == "sira":
        view.locator("#call").click()
        expect(view.locator("#waiting")).to_have_text("0 kişi")
    expected = {
        "adisyon": ["136,67", "136,66"], "iade": ["360"],
        "sira": ["Çağrıldı"], "takip": ["2027-01-29"],
        "yoklama": ["%50", "Can, Umut"], "kiyas": ["40.000", "44.000"],
        "rota": ["09:00 · Çarşı", "09:40 · Kent müzesi"],
        "bakim": ["5002 km", "5000 km kaldı"], "kasa": ["1,00"],
        "mesai": ["118 dk", "3,93"],
    }
    for fragment in expected.get(id, []):
        expect(view.locator("#records")).to_contain_text(fragment)
    if id == "fatura":
        expect(view.locator("#records")).to_contain_text("₺4,80")
    if id == "konak":
        expect(view.locator("#records")).to_contain_text("3 gece")
    if id == "dukkan":
        expect(view.locator("#records")).to_contain_text("Taş baskı defter × 2")
    if id == "firsat":
        view.get_by_text("Teklife taşı").click()
        view.get_by_text("Kazanıldı olarak işaretle").click()
        expect(view.locator('[data-stage="2"]')).to_have_text("1")


with sync_playwright() as p:
    for id, name in [
        ("adisyon", "Paylı Adisyon"),
        ("iade", "İade Tezgâhı"),
        ("sira", "Sıram Geldi"),
        ("takip", "Kontrol Takvimi"),
        ("yoklama", "Ders İmzası"),
        ("kiyas", "Konut Kıyası"),
        ("rota", "Yürüyüş Rotası"),
        ("bakim", "Bakım Sayacı"),
        ("kasa", "Vardiya Kasası"),
        ("mesai", "Ajans Mesaisi"),
        ("sofra", "Avlu Sofrası"),
        ("derslik", "Derslik"),
        ("usta", "Atölye Defteri"),
        ("percem", "Perçem Randevu"),
        ("dukkan", "Kutu Dükkân"),
        ("fatura", "Hesap Pusulası"),
        ("konak", "Kıyı Pansiyon"),
        ("ziyaret", "Sokak Rehberi"),
        ("firsat", "Teklif Masası"),
        ("muayene", "Poliklinik Ajandası"),
    ]:
        for w in (390, 1440):
            b, g = setup(p, w)
            g.set_default_timeout(6000)
            errors = []
            g.on("pageerror", lambda e: errors.append(str(e)))
            g.goto(BASE_URL + "/templates/" + id + ".html")
            assert g.locator("#empty").is_visible()
            g.keyboard.press("Tab")
            assert g.locator(":focus-visible").count()
            g.locator("button[type=submit]").click()
            assert (
                g.locator("form :invalid").count()
                and g.locator("#records li").count() == 0
            )
            complete_task(g, id)
            g.reload()
            expect(g.locator("#records li")).to_contain_text(long)
            if id == "iade":
                g.locator("[name=product]").select_option("havlu")
                expect(g.locator("#remaining")).to_have_text("1 adet")
                g.locator("[name=qty]").fill("2")
                g.locator("[name=reason]").fill("Fazladan iade")
                g.locator("button[type=submit]").click()
                assert g.locator("[name=qty]").evaluate("el=>el.validity.customError")
                expect(g.locator("#records li")).to_have_count(1)
                g.locator("form").evaluate("form=>form.reset()")
                g.locator("[name=product]").dispatch_event("input")
            if id == "usta":
                expect(g.locator("#records img")).to_be_visible()
            assert g.evaluate("document.documentElement.scrollWidth===innerWidth")
            contrast = g.evaluate(
                """()=>{function lum(css){const a=css.match(/[0-9.]+/g).slice(0,3).map(x=>{let s=+x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]}return [...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).every(el=>{let bg=el;while(bg.parentElement&&getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)')bg=bg.parentElement;let l=lum(getComputedStyle(bg).backgroundColor),f=lum(getComputedStyle(el).color);return (Math.max(l,f)+.05)/(Math.min(l,f)+.05)>=4.5})}"""
            )
            assert contrast, (id, w)
            g.screenshot(path=str(root / "screens" / f"{id}-{w}.png"), full_page=True)
            g.goto(BASE_URL + "/#sablonlar", wait_until="domcontentloaded")
            assert g.locator(".tp-grid iframe").count() == 0
            card = g.locator(".tp-grid .tpc").filter(has_text=name)
            card.click()
            g.get_by_role("button", name="Telefon önizlemesi" if w == 390 else "Masaüstü önizlemesi").click()
            demo = g.locator(".tpl-dialog")
            expect(demo.frame_locator("iframe").locator("h1")).to_be_visible()
            complete_task(demo.frame_locator("iframe"), id)
            demo.get_by_text("Tasarımı düzenle", exact=True).click()
            scene = g.locator(".ds-modal")
            target = scene.frame_locator("iframe").locator("h1")
            target.click()
            g.wait_for_timeout(250)
            if not scene.locator(".ds-fields").count():
                target.click()
            field = g.get_by_label("Başlangıç ikonu")
            field.select_option("★")
            g.get_by_label("Yazı rengi").fill("#442244")
            text = scene.locator(".ds-fields input[type=text]")
            text.fill("Düzenlenen başlık")
            scene.get_by_text("Seçime uygula").click()
            field.select_option(label="Simge yok")
            if id == "sofra" and w == 390:
                scene.locator(".ds-fields").screenshot(
                    path=str(root / "screens" / "tasarim-telefon.png")
                )
            if w == 390:
                assert all(el.is_visible() and el.bounding_box()["height"] >= 44
                           for el in scene.locator(".ds-fields input, .ds-fields select").all())
                assert all(el.is_visible() for el in scene.locator(".ds-fields label").all())
                assert (
                    len(
                        set(
                            round(el.bounding_box()["x"])
                            for el in scene.locator(".ds-fields label").all()
                        )
                    )
                    == 1
                )
            scene.get_by_text("Taslağa kaydet").click()
            g.reload(wait_until="domcontentloaded")
            st = g.frame_locator('iframe[title="Önizleme"]').first
            expect(st.locator("h1")).to_have_text("Düzenlenen başlık")
            assert st.locator("h1").evaluate(
                'el=>[getComputedStyle(el).color,getComputedStyle(el,"::before").content]'
            ) == ["rgb(68, 34, 68)", "none"]
            expect(st.locator("#empty")).to_be_visible()
            complete_task(st, id)
            g.wait_for_function("""() => Object.keys(localStorage).some(k =>
                k.startsWith('gms_templateRows:') && JSON.parse(localStorage[k]).length)""")
            g.reload(wait_until="domcontentloaded")
            expect(st.locator("#records li")).to_contain_text(long)
            assert not errors, errors
            results.append(
                dict(
                    sablon=id,
                    genislik=w,
                    sonuc="Geçti",
                    ekran="screens/" + id + "-" + str(w) + ".png",
                    kontroller=[
                        "Ana görev: bağımsız sayfa, canlı demo ve Stüdyo",
                        "Stüdyo görev kaydı yeniden açıldı",
                        "Uzun Türkçe metin",
                        "Boş durum",
                        "Geçersiz form",
                        "Klavye odağı",
                        "Metin kontrastı ≥ 4,5:1",
                        "Yatay taşma",
                        "Stüdyo düzenle, simgeyi seç ve kaldır, kaydet ve yeniden aç",
                    ],
                )
            )
            print(id, w, "PASS", flush=True)
            b.close()
(root / "sablon-testleri.json").write_text(
    json.dumps(results, ensure_ascii=False, indent=2) + "\n"
)
