from browser_support import ROOT, BASE_URL, json, setup, sync_playwright
from playwright.sync_api import expect

sentence = "Uygulamayı uçtan uca çalışır hale getir"
result = []
with sync_playwright() as p:
    for kind in ["ses", "klavye", "hazır komut"]:
        b, g = setup(p)
        g.set_default_timeout(8000)

        def api(r):
            if r.request.url.endswith("/api/ai/generate"):
                result.append([kind, r.request.post_data_json["prompt"]])
                r.fulfill(
                    content_type="text/event-stream",
                    body="data: "
                    + json.dumps(
                        {"t": "done", "html": "<h1>Sonuç</h1>", "summary": "Tamam"}
                    )
                    + "\n\n",
                )
            else:
                r.fulfill(json={"ok": True, "platform": [], "byok": []})

        g.route("https://api.gitmapp.com/**", api)
        g.goto(BASE_URL + "/#studio", wait_until="domcontentloaded")
        ta = g.locator("textarea.gta")
        expect(ta).to_be_visible()
        if kind == "ses":
            g.get_by_title("Sesle yaz", exact=True).click()
            g.evaluate(
                """()=>{const parts=['Uygulamayı','Uygulamayı uçtan','Uygulamayı uçtan uca çalışır hale getir'];rec.onresult({results:parts.map((transcript,i)=>Object.assign([{transcript}],{isFinal:i===2}))});rec.stop()}"""
            )
        if kind == "klavye":
            ta.focus()
            ta.dispatch_event("compositionstart")
            ta.fill(sentence + " tekrar tekrar")
            ta.dispatch_event(
                "keydown", {"key": "Enter", "isComposing": True, "keyCode": 229}
            )
            ta.dispatch_event("compositionend")
        if kind == "hazır komut":
            g.evaluate(
                """text=>new Promise(done=>dispatchEvent(new CustomEvent('gm:act',{detail:{a:{t:'prompt',metin:text},done}})))""",
                sentence,
            )
        expected = sentence + (" tekrar tekrar" if kind == "klavye" else "")
        expect(ta).to_have_value(expected)
        assert len(result) == ["ses", "klavye", "hazır komut"].index(kind)
        g.locator(".gsend").click()
        g.wait_for_function(
            """()=>JSON.parse(localStorage.getItem('gms_studio:guest'))?.html?.includes('Sonuç')"""
        )
        users = g.evaluate(
            """()=>JSON.parse(localStorage.getItem('gms_studio:guest')).msgs.filter(m=>m.role==='user').map(m=>m.content)"""
        )
        assert users == [expected], users
        print(kind, users, flush=True)
        b.close()
(ROOT / "validation/girdi.json").write_text(
    json.dumps(result, indent=2, ensure_ascii=False)
)
