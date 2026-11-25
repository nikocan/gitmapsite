from browser_support import ROOT, BASE_URL, json, setup, sync_playwright
from playwright.sync_api import expect

with sync_playwright() as p:
    b, g = setup(p, 1440)
    g.set_default_timeout(9000)
    g.on("dialog", lambda d: d.accept())
    g.add_init_script(
        """if(top===self){if(!localStorage.gms_tok)localStorage.gms_tok='"a"';localStorage.gms_cpSpeak='false';const fetch0=window.fetch;window.fetch=(url,opts)=>String(url).endsWith('/api/ai/generate')?new Promise(resolve=>window.finishOld=()=>resolve(new Response('data: '+JSON.stringify({t:'done',html:'<h1>ESKİ KOD</h1>',summary:'ESKİ YANIT'})+'\\n\\n'))):fetch0(url,opts)}"""
    )
    from urllib.parse import urlsplit, parse_qs

    def api(r):
        path = urlsplit(r.request.url).path
        if path.endswith("/git/branch"):
            branch = parse_qs(urlsplit(r.request.url).query)["name"][0]
            out = {"head": "abcdef0", "history": [], "html": "<h1>" + branch + "</h1>"}
        else:
            out = {
                "/api/health": {"ok": True},
                "/api/auth/me": {
                    "user": {
                        "id": r.request.headers.get(
                            "authorization", "Bearer a"
                        ).split()[-1],
                        "credits": 10,
                    }
                },
                "/api/apps": {"apps": []},
                "/api/apps/one/git": {
                    "branches": ["main", "okul"],
                    "defaultBranch": "main",
                },
                "/api/ai/models": {"platform": [], "byok": []},
            }.get(path, {})
        r.fulfill(json=out)

    g.route("https://api.gitmapp.com/**", api)
    g.goto(BASE_URL + "/#studio", wait_until="domcontentloaded")
    g.wait_for_function("window.__gmStudio?.scope?.startsWith('[\"a\"')")
    g.evaluate(
        """()=>dispatchEvent(new CustomEvent('gm:studio',{detail:{appId:'one',html:'<h1>main</h1>',title:'Proje',msgs:[],gitContext:{source:'gitmapp',name:'main'}}}))"""
    )
    expect(g.locator(".ws-title")).to_have_value("Proje")
    g.locator("textarea.gta").fill("Ana ekranı iyileştir")
    g.locator(".gsend").click()
    g.wait_for_function('typeof finishOld==="function"')
    g.get_by_role("button", name="Sürüm kontrolü", exact=True).click()
    d = g.locator(".vc-dialog")
    d.get_by_label("Dal", exact=True).select_option("okul")
    d.get_by_text("Dal sürümünü aç").click()
    g.evaluate("finishOld()")
    g.wait_for_timeout(150)
    expect(g.frame_locator('[title="Önizleme"]').first.locator("h1")).to_have_text(
        "okul"
    )
    assert (
        g.evaluate("""()=>JSON.parse(localStorage['gms_studio:a']).msgs.length""") == 0
    )
    g.evaluate("""localStorage.gms_tok='"b"';location.reload()""")
    g.wait_for_function("window.__gmStudio?.scope?.startsWith('[\"b\"')")
    assert not g.evaluate("window.__gmStudio.acikUygulama")
    print(
        "PASS late generator ignoring AbortSignal, branch code/history isolation and account transition"
    )
