from browser_support import BASE_URL, setup, sync_playwright
from playwright.sync_api import expect

with sync_playwright() as p:
    for width in [1440,390]:
        browser,page=setup(p,width)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(BASE_URL + "/#studio",wait_until="domcontentloaded")
        page.get_by_role('button',name='Tüm tasarımlar').first.click()
        gallery=page.get_by_role('dialog',name='Tasarım galerisi')
        gallery.get_by_role('button',name='Tasarım temaları',exact=True).click()
        if width==390:
            gallery.locator(".gallery-mobile select").first.select_option("bahce")
        else:
            gallery.get_by_role('searchbox').fill("bahce")
            gallery.get_by_role('button',name='Bahçe & Bitkiler 300').click()
        expect(gallery.locator('.cx-card').first).to_contain_text('Bahçe & Bitkiler')
        gallery.locator('.cx-card').first.click()
        detail=page.get_by_role("dialog").last
        expect(detail.locator('.cx-scene')).to_contain_text('Seralar')
        detail.locator('.cx-story button').last.click()
        detail.get_by_role('button',name='Koyu').click()
        expect(detail.locator('.cx-scene [data-preview-mode=dark]')).to_have_count(1)
        expect(detail.locator('.cx-story button')).to_have_count(4)
        expect(detail.locator('.cx-scene')).to_contain_text('Bakım takvimi')
        detail.get_by_role('button',name='Önizlemeyi kapat').click()
        gallery.get_by_role('button',name='Web',exact=True).click()
        expect(gallery.locator('.cx-card .cx-screen.cx-site').first).to_be_visible()
        gallery.get_by_role('button',name='Oyun',exact=True).click()
        expect(gallery.locator('.cx-card .cx-screen.cx-game').first).to_be_visible()
        gallery.get_by_role('button',name='Paneller',exact=True).click()
        gallery.locator('.pk-stage').first.click()
        detail=page.get_by_role("dialog").last
        expect(detail.locator('.cx-story button')).to_have_count(4)
        detail.locator('.cx-story button').last.click()
        detail.get_by_role('button',name='Açık').click()
        expect(detail.locator('.cx-panel-preview .pk-scr.acik')).to_be_visible()
        detail.get_by_role('button',name='Önizlemeyi kapat').click()
        gallery.get_by_role('button',name='Ücretsiz temalar').click()
        expect(gallery.locator('.cx-card')).to_have_count(4)
        for prefix in ["AstroWind","Tabler","Ionic Conference","Godot Minimal Game Template"]:
            gallery.get_by_role('button',name=prefix+' · 4 ekranı incele').click()
            detail=page.get_by_role("dialog").last
            expect(detail.locator('.cx-story button')).to_have_count(4)
            detail.locator('.cx-story button').last.click()
            detail.get_by_role('button',name='Gravity' if prefix.startswith('Godot') else 'Koyu',exact=True).click()
            img=detail.locator('.cx-template-shot img')
            expect(img).to_be_visible()
            img.evaluate("(img)=>img.decode()")
            expect(detail.get_by_role('link',name='MIT lisansı')).to_be_visible()
            detail.get_by_role('button',name='Önizlemeyi kapat').click()
        gallery.get_by_role('button',name='Çalışan şablonlar').click()
        expect(gallery.locator('.catalog-example').first).to_be_visible()
        gallery.locator('.catalog-example').first.click()
        detail=page.get_by_role("dialog").last
        expect(detail.locator('.cx-story button')).to_have_count(4)
        detail.locator('.cx-story button').last.click()
        detail.get_by_role('button',name='Koyu').click()
        detail.locator('.cx-template-shot img').evaluate("(img)=>img.decode()")
        detail.get_by_role('button',name='Canlı önizleme').click()
        iframe=detail.frame_locator('iframe')
        expect(iframe.locator('html')).to_have_attribute('data-gm-mode','dark')
        detail.get_by_role('button',name='Telefon',exact=True).click()
        expect(detail.locator('iframe')).to_have_class('frame-m')
        detail.get_by_role('button',name='Bu şablonla başla').click()
        expect(page.get_by_role('dialog',name='Tasarım galerisi')).to_have_count(0)
        assert not errors,errors
        browser.close()
        print(f'{width}px katalog akışları tamamlandı')
