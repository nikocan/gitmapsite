"""Capture the four real template views shown in the catalog in both appearance modes."""
import sys
from browser_support import BASE_URL, ROOT, setup, sync_playwright
from io import BytesIO
from datetime import date, timedelta
from PIL import Image, ImageOps
import json

OUT = ROOT / "templates/previews"
THEME = (ROOT / "catalog/template-theme.js").read_text().split("`")[1]
CSS = THEME.split("<style data-catalog-theme>")[1].split("</style>")[0]
MANIFEST = ROOT / "catalog/template-screens.js"
LABELS = json.loads(MANIFEST.read_text().split(" = ", 1)[1].strip().removesuffix(";")) if MANIFEST.exists() else {}
ONLY_MISSING = "--missing" in sys.argv
PAGES = {
 "akisoperasyon": [("Operasyon özeti", None), ("İş listesi", "button[data-view=list]"), ("İş detayı", "#list button"), ("Yeni iş", "button[data-view=new]")],
 "forma": [("Mağaza", None), ("Ürün detayı", "[data-product]"), ("Favoriler", "header [data-view=favorites]"), ("Sepet", "header [data-view=cart]")],
 "molaseans": [("Seanslar", None), ("Saat seçimi", "[data-choice]"), ("Seans onayı", "[data-confirm]"), ("Randevularım", "header [data-view=visits]")],
}
SECTIONS = {
 "gitsap": [("Stok ve açık sipariş", "main section:nth-of-type(1)"), ("Belge işle", "main section:nth-of-type(2)"), ("Belge zinciri", "main section:nth-of-type(3)"), ("Muhasebe fişleri", "main section:nth-of-type(4)")],
 "oracle-teshis": [("Atölye", None), ("Olay inceleme", "#caseForm"), ("Teşhis kaydı", "section[aria-live]"), ("İşlem adımları", "details:first-of-type")]
}


def capture(page, element, id, mode, index):
    shot = page.screenshot(animations="disabled") if element is None else element.screenshot(animations="disabled")
    image = Image.open(BytesIO(shot)).convert("RGB")
    background = image.getpixel((max(0, image.width - 2), 2))
    image = ImageOps.contain(image, (720, 450), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (720, 450), background)
    canvas.paste(image, ((720 - image.width) // 2, (450 - image.height) // 2))
    canvas.save(OUT / f"{id}-{mode}-{index}.webp", quality=83, method=4)


def fill_example(page, id):
    if id == "dukkan":
        page.locator("#cart input").first.fill("2")
    if id == "ziyaret":
        page.locator("#budget").select_option("32000")
    for el in page.locator("form [name]").all():
        if el.get_attribute("readonly") is not None:
            continue
        tag, kind, name = el.evaluate("el => [el.tagName, el.type, el.name]")
        if tag == "SELECT":
            if el.locator("option").count() > 1:
                el.select_option(index=1)
        elif kind == "file":
            el.set_input_files(ROOT / "catalog/araclar.webp")
        elif kind == "checkbox":
            el.check()
        elif kind != "hidden":
            el.fill({
                "number": "3" if name == "people" else "2",
                "date": (date.today() + timedelta(days=10 if name == "departure" else 7)).isoformat(),
                "time": "11:00" if name == "end" else "09:00",
                "datetime-local": "2027-01-22T10:00",
            }.get(kind, "Örnek çalışma"))
    page.locator("form").evaluate("form => form.requestSubmit()")


with sync_playwright() as p:
    browser, page = setup(p, 1152)
    page.set_viewport_size({"width": 1152, "height": 720})
    page.set_default_timeout(4500)
    for path in sorted((ROOT / "templates").glob("*.html")):
        id = path.stem
        if ONLY_MISSING and id in LABELS:
            continue
        print("Capturing", id, flush=True)
        for mode in ("light", "dark"):
            page.goto(f"{BASE_URL}/templates/{path.name}", wait_until="domcontentloaded")
            page.evaluate("Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,350))])")
            page.add_style_tag(content=CSS + ".reveal{opacity:1!important;transform:none!important}")
            page.evaluate("(mode) => document.documentElement.dataset.gmMode=mode", mode)
            native = page.locator("#th")
            if id in PAGES:
                LABELS[id] = [label for label, _ in PAGES[id]]
                for i, (_, selector) in enumerate(PAGES[id]):
                    if selector:
                        if id == "molaseans" and i == 2:
                            page.locator("#day").fill((date.today()+timedelta(days=1)).isoformat())
                            page.locator("[data-hour]:enabled").first.click()
                        if id == "forma" and i == 2:
                            page.locator("main [data-fav]").first.click()
                            page.locator("main [data-add]").first.click()
                        page.locator(selector).first.click()
                    capture(page, None, id, mode, i)
            elif id in SECTIONS:
                LABELS[id] = [label for label, _ in SECTIONS[id]]
                for i, (_, selector) in enumerate(SECTIONS[id]):
                    if selector and selector.startswith("details"):
                        page.locator(selector+" summary").click()
                    capture(page, page.locator(selector) if selector else None, id, mode, i)
            elif native.count():
                page.evaluate("""mode => {
                  document.documentElement.dataset.gmNative="";
                  if(document.documentElement.dataset.theme!==mode)document.querySelector("#th").click();
                }""", mode)
                views = page.evaluate("APP.nav.slice(0,4).map(n=>[n.id,n.label])")
                LABELS[id] = [label for _, label in views]
                for i, (view, _) in enumerate(views):
                    page.locator(f".sb [data-v='{view}']").click()
                    capture(page, None, id, mode, i)
            elif page.locator("#task").count():
                elements = [page.locator("main h2").first.locator(".."), page.locator("#task"), page.locator(".history").first]
                LABELS[id] = [page.locator("h1").first.inner_text(), *[el.locator("h2").first.inner_text() for el in elements]]
                capture(page, None, id, mode, 0)
                if id not in {"cicek","detaygaraj","etkinlik","fotostudyo","kavurma","mimari","patik","pilates"}:
                    fill_example(page, id)
                for i, el in enumerate(elements, 1):
                    capture(page, el, id, mode, i)
                page.evaluate("localStorage.clear()")
            else:
                sections = page.locator("body > section:has(h1), body > section:has(h2)")
                ranked = [sections.nth(0), *[sections.nth(i) for i in range(1, 4)]]
                LABELS[id] = [el.locator("h1,h2").first.inner_text().replace("\n", " ") for el in ranked]
                capture(page, None, id, mode, 0)
                for i, el in enumerate(ranked[1:], 1):
                    capture(page, el, id, mode, i)
        assert len(LABELS[id]) == 4, id
        MANIFEST.write_text(
            "// Generated by tools/acceptance/catalog_previews.py.\nconst templateScreenLabels = "
            + json.dumps(LABELS, ensure_ascii=False, indent=2, sort_keys=True) + ";\n"
        )
        print(id, flush=True)
    browser.close()
