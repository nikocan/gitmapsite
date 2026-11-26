"""Run against the Gitmapp root served at the URL passed on the command line."""
import shutil
import sys
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which("chromium"))
    for width in (390, 1440):
        page = browser.new_page(viewport={"width": width, "height": 900})
        for template in ("adisyon", "iade", "yoklama"):
            page.goto(f"{sys.argv[1]}/templates/{template}.html")
            if template == "adisyon":
                page.locator("[name=name]").fill("Masa 4")
                page.locator("[name=coffee]").fill("2")
                page.locator("[name=toast]").fill("2")
                page.locator("[name=people]").fill("3")
                checks = ["Masa 4", "136,67", "136,66"]
            elif template == "iade":
                page.locator("[name=product]").select_option("havlu")
                page.locator("[name=qty]").fill("2")
                page.locator("[name=reason]").fill("Örnek iade")
                checks = ["Örnek iade", "360"]
            else:
                page.locator("[name=name]").fill("Salı dersi")
                for field in page.get_by_role("checkbox").all()[:2]:
                    field.check()
                checks = ["Salı dersi", "%50", "Can, Umut"]
            page.locator("button[type=submit]").click()
            for check in checks:
                expect(page.locator("#records")).to_contain_text(check)
            print(width, template, "PASS")
        page.goto(f"{sys.argv[1]}/skills/index.html")
        expect(page.locator("article")).to_have_count(7)
        page.get_by_role("searchbox").fill("Expo")
        expect(page.locator("article")).to_have_count(3)
        page.get_by_role("searchbox").fill("bulunamayan")
        expect(page.get_by_role("status")).to_contain_text("Eşleşen beceri yok")
        print(width, "catalog PASS")
        page.close()
    browser.close()
