from browser_support import ROOT, BASE_URL, json, setup, sync_playwright
from playwright.sync_api import expect
import urllib.request as u, urllib.parse as url, sys

root = ROOT / "validation"
live = "--live" in sys.argv
answers = []
requests = []
pending = []
hold = False
school = (ROOT / "templates/derslik.html").read_text()
food = (ROOT / "templates/sofra.html").read_text()
with sync_playwright() as p:
    b, g = setup(p, 1440)
    g.set_default_timeout(10000)
    g.on("dialog", lambda d: d.accept())
    g.add_init_script(
        """if(top===self){localStorage.gms_tok='"fixture"';localStorage.gms_cpSpeak='false';localStorage.gms_cpMsgs='[{"role":"user","content":"Eski kayıt"}]'}"""
    )

    def api(r):
        path = url.urlsplit(r.request.url).path
        if path == "/api/ai/copilot":
            body = r.request.post_data_json
            requests.append(body)
            ctx = body["context"]["studyo"]["proje"]
            if hold:
                pending.append(r)
                return
            if live:
                payload = {
                    "messages": body["messages"],
                    "context": body["context"],
                    "stream": False,
                }
                req = u.Request(
                    "https://api.gitmapp.com/api/ai/copilot",
                    json.dumps(payload).encode(),
                    {"Content-Type": "application/json"},
                )
                try:
                    reply = json.load(u.urlopen(req, timeout=45))["reply"]
                except Exception as e:
                    print("LIVE unavailable", e, getattr(e, "read", lambda: b"")()[:600], flush=True)
                    raise
            else:
                reply = "Test yanıtı " + ctx["dal"]
            answers.append([ctx, reply])
            r.fulfill(
                content_type="text/event-stream",
                body="data: " + json.dumps({"t": "done", "reply": reply}) + "\n\n",
            )
            return
        if path.endswith("/git/branch"):
            branch = url.parse_qs(url.urlsplit(r.request.url).query)["name"][0]
            data = {
                "head": "ab123456",
                "history": [],
                "html": food if branch == "main" else school,
            }
        else:
            data = {
                "/api/auth/me": {
                    "user": {"id": "fixture-user", "name": "Test", "credits": 10}
                },
                "/api/health": {"ok": True},
                "/api/apps": {"apps": []},
                "/api/apps/one/git": {
                    "branches": ["main", "ogrenci"],
                    "defaultBranch": "main",
                    "repo": None,
                },
                "/api/ai/models": {"platform": [], "byok": []},
            }.get(path, {})
        r.fulfill(json=data)

    g.route("https://api.gitmapp.com/**", api)
    g.goto(BASE_URL + "/#studio", wait_until="domcontentloaded")
    g.wait_for_function("window.__gmStudio?.scope?.includes('fixture-user')")

    def project(id, title, content):
        g.evaluate(
            """p=>dispatchEvent(new CustomEvent('gm:studio',{detail:p}))""",
            dict(appId=id, title=title, html=content, msgs=[]),
        )
        expect(g.locator(".ws-title")).to_have_value(title)

    def ask(text="Ana ekranı iyileştir"):
        g.locator(".cp-box textarea").fill(text)
        g.locator(".cp-send").click()
        if not hold:
            expect(g.locator(".cp-u")).to_have_count(1)
            expect(g.locator(".cp-m .cp-t").last).to_be_visible()
            if live:
                g.locator(".cp").screenshot(
                    path=str(
                        root / "screens" / ("asistan-" + str(len(answers)) + ".png")
                    )
                )

    def branch(name):
        g.get_by_role("button", name="Sürüm kontrolü", exact=True).click()
        d = g.locator(".vc-dialog")
        d.get_by_label("Dal", exact=True).select_option(name)
        d.get_by_role("button", name="Dal sürümünü aç").click()
        expect(d).to_have_count(0)

    project("one", "Restoran", food)
    g.evaluate("dispatchEvent(new Event('gm:cp'))")
    expect(g.locator(".cp-u")).to_have_count(0)
    ask()
    project("two", "Okul", school)
    expect(g.locator(".cp-u")).to_have_count(0)
    ask()
    project("one", "Restoran", food)
    expect(g.locator(".cp-u")).to_have_count(1)
    branch("main")
    expect(g.locator(".cp-u")).to_have_count(0)
    ask()
    branch("ogrenci")
    expect(g.locator(".cp-u")).to_have_count(0)
    ask()
    hold = True
    ask("Sürmekte olan istek")
    g.wait_for_timeout(150)
    assert pending
    branch("main")
    try:
        pending[0].fulfill(
            content_type="text/event-stream",
            body='data: {"t":"done","reply":"GECIKMIS <eylem>[{\\"t\\":\\"yap\\"}]</eylem>"}\n\n',
        )
    except:
        pass
    expect(g.locator(".cp-u")).to_have_count(1)
    assert "GECIKMIS" not in g.locator(".cp").inner_text()
    expect(
        g.frame_locator('iframe[title="Önizleme"]').first.locator("h1")
    ).to_have_text("Avluda bu akşam")
    for i, body in enumerate(requests[:4]):
        assert len(body["messages"]) == 1
        ctx = body["context"]["studyo"]["proje"]
        outline = " ".join(ctx["ekranlar"])
        assert ("menü" if i in (0, 2) else "Ders") in outline, ctx
    if live:
        for i, (_, reply) in enumerate(answers[:4]):
            text = reply.lower()
            if i in (0, 2):
                assert "menü" in text and ("rezerv" in text or "masa ayır" in text)
            else:
                assert "ders" in text and ("öğrenci" in text or "ödev" in text)
    (root / ("asistan-canli.json" if live else "asistan-tarayıcı.json")).write_text(
        json.dumps(answers, ensure_ascii=False, indent=2)
    )
    print("PASS projects, branches, restoration, stale reply", flush=True)
