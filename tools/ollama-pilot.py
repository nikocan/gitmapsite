"""Exercise two synthetic Studio projects concurrently on an isolated local API."""
import concurrent.futures
import json
import sys
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright
import shutil

CASES = [
    ("Restoran", "Menü", "Rezervasyon", "Masa seçildi"),
    ("Okul", "Ders programı", "Ödev teslimi", "Ders seçildi"),
]


def generate(case):
    title, heading, action, result = case
    html = f"""<!doctype html><html lang="tr"><title>{title}</title><h1>{heading}</h1>
    <button onclick="document.querySelector('output').textContent='{result}'">{action}</button>
    <output></output></html>"""
    payload = {"prompt": "Ana ekranı iyileştir", "html": html, "stream": True,
               "projectContext": {"purpose": title, "screens": [heading], "branch": "pilot"}}
    start = time.monotonic()
    record = {"project": title, "first_delta_s": None, "ok": False}
    req = urllib.request.Request(sys.argv[1] + "/api/ai/generate", json.dumps(payload).encode(),
                                 {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=360) as response:
            for line in response:
                if not line.startswith(b"data:"):
                    continue
                event = json.loads(line[5:])
                if event["t"] == "delta" and record["first_delta_s"] is None:
                    record["first_delta_s"] = round(time.monotonic() - start, 2)
                if event["t"] == "error":
                    raise ValueError(event["error"])
                if event["t"] == "done":
                    record["html"] = event["html"]
                    record["model"] = event["model"]
    except urllib.error.HTTPError as error:
        record["error"] = f"HTTP {error.code}: " + error.read(1000).decode(errors="replace")
    except Exception as error:
        record["error"] = str(error)
    record["seconds"] = round(time.monotonic() - start, 2)
    return record


with concurrent.futures.ThreadPoolExecutor(2) as pool:
    records = list(pool.map(generate, CASES))
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which("chromium"))
    for record, (_, heading, action, result) in zip(records, CASES):
        html = record.pop("html", "")
        if not html:
            continue
        page = browser.new_page(java_script_enabled=True)
        page.route("**/*", lambda route: route.abort())
        try:
            visual = """() => ['body','h1','button'].map(tag => {
                const element = document.querySelector(tag);
                if (!element) return null;
                const style = getComputedStyle(element);
                return [style.color, style.backgroundColor, style.fontFamily, style.fontSize,
                        style.padding, style.margin, style.borderRadius, style.textAlign];
            })"""
            record["viewports"] = []
            for width in (390, 1440):
                page.set_viewport_size({"width": width, "height": 900})
                page.set_content("<h1>Başlık</h1><button>Eylem</button>")
                original = page.evaluate(visual)
                page.set_content(html)
                page.get_by_text(heading, exact=False).first.wait_for(timeout=2500)
                button = page.get_by_role("button", name=action).first
                button.click(timeout=2500)
                page.get_by_text(result, exact=True).first.wait_for(timeout=2500)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                assert page.evaluate(visual) != original
                record["viewports"].append(width)
            record["ok"] = True
        except Exception:
            record["error"] = "Başlık, eylem, stil veya ekran genişliği kontrolü geçmedi."
        finally:
            page.close()
    browser.close()
print(json.dumps(records, ensure_ascii=False, indent=2))
sys.exit(0 if all(record["ok"] for record in records) else 1)
