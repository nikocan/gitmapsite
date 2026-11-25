from browser_support import ROOT, BASE_URL, json, setup, sync_playwright
from playwright.sync_api import expect

with sync_playwright() as p:
    b, g = setup(p)
    g.set_default_timeout(8000)
    g.goto(BASE_URL + "/#sablonlar", wait_until="domcontentloaded")

    def clone():
        card = g.locator(".tp-grid .tpc").filter(has_text="Derslik")
        card.get_by_text("Stüdyo’da kullan").click()
        return g.frame_locator('iframe[title="Önizleme"]').first

    st = clone()
    st.locator("select").select_option(index=1)
    st.locator("[name=title]").fill("İlk ödev")
    st.locator("textarea").fill("Çalışma örneği")
    st.locator("button").click()
    expect(st.locator("#records")).to_contain_text("İlk ödev")
    id1 = g.evaluate("window.__gmStudio.proje.kimlik")
    g.reload(wait_until="domcontentloaded")
    expect(st.locator("#records")).to_contain_text("İlk ödev")
    assert g.evaluate("window.__gmStudio.proje.kimlik") == id1
    g.evaluate("location.hash='sablonlar'")
    clone()
    expect(st.locator("#empty")).to_be_visible()
    assert g.evaluate("window.__gmStudio.proje.kimlik") != id1
    assert g.locator(".tp-grid iframe").count() == 0
    g.evaluate("location.hash='uygulamalarim'")
    g.get_by_role("button", name="Yerel taslaklar", exact=True).click()
    drafts = g.locator(".pj-grid button").filter(has_text="Derslik")
    expect(drafts).to_have_count(2)
    drafts.last.click()
    expect(st.locator("#records")).to_contain_text("İlk ödev")
    assert g.evaluate("window.__gmStudio.proje.kimlik") == id1
    print("PASS template clone, runtime data isolation and persistent draft identity")
