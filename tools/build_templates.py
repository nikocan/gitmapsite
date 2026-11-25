#!/usr/bin/env python3
"""Gitmapp hazır şablonlarını üretir: tools/tpl altındaki kitler + yapılandırmalar → templates/*.html
Her şablon tek dosyalık, bağımsız çalışan bir HTML'dir (Gitmapp Geliştir'de açılıp yapay zekâyla değiştirilebilir)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "tpl"))
from apps_admin import ADMIN_APPS
from apps_site import SITE_APPS
OUT = os.path.join(HERE, "..", "templates"); os.makedirs(OUT, exist_ok=True)
rd = lambda n: open(os.path.join(HERE, "tpl", n), encoding="utf-8").read()
ACSS, AJS, SCSS, SJS = rd("admin.css"), rd("admin.js"), rd("site.css"), rd("site.js")

# The main app and exported standalone templates use the same versioned glyphs.
with open(os.path.join(HERE, "icons", "duotone.json"), encoding="utf-8") as f:
    ICONS = json.load(f)
with open(os.path.join(HERE, "icons", "LICENSE-Phosphor.txt"), encoding="utf-8") as f:
    LICENSE = f.read().strip()

def embed_icons(names):
    return "/* " + LICENSE + " */\nconst ICON_SVG=" + json.dumps({n: ICONS[n] for n in names}, ensure_ascii=False) + ";"

index_path = os.path.join(HERE, "..", "index.html")
with open(index_path, encoding="utf-8") as f:
    index = f.read()
begin, end = "/* BEGIN shared icons */", "/* END shared icons */"
before, section = index.split(begin, 1)
_, after = section.split(end, 1)
with open(index_path, "w", encoding="utf-8") as f:
    f.write(before + begin + "\n" + embed_icons(ICONS) + "\n" + end + after)

def font_link(f):
    fam = f.replace(" ", "+")
    return f'<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family={fam}:wght@400;500;600;700;800&display=swap" rel="stylesheet">'

ADMIN_ICONS = ['grid', 'users', 'target', 'check', 'list', 'file', 'box', 'truck', 'swap', 'wallet', 'shield', 'alert', 'cal', 'heart', 'tag', 'home', 'cog', 'search', 'bell', 'plus', 'x', 'moon', 'dl', 'print', 'trash', 'edit', 'menu', 'phone', 'star', 'chart', 'key']

SITE_ICONS = ['car','road-horizon','home','wall','storefront','airplane','bed', 'area', 'floor', 'pin', 'heart', 'phone', 'mail', 'clock', 'arrow', 'menu', 'search']

def page(cfg, css, js, var, desc):
    names = ADMIN_ICONS if var == "APP" else SITE_ICONS
    js = js.replace("/* TEMPLATE_ICONS */", embed_icons([*names, "brand_" + cfg["id"]]))
    b = cfg["brand"]; title = cfg["name"] + (" — " + cfg.get("tagline", "") if cfg.get("tagline") else "")
    data = json.dumps(cfg, ensure_ascii=False).replace("</", "<\\/")
    return f"""<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><meta name="theme-color" content="{b['pr']}">
<!-- Gitmapp hazır şablonu · gitmapp.com · Demo veriler kurgusaldır -->
{font_link(cfg.get('font','Inter'))}
<style>{css}
:root{{--pr:{b['pr']};--ac:{b['ac']};--font:'{cfg.get('font','Inter')}'}}</style></head>
<body><script>window.{var}={data};</script><script>{js}</script></body></html>"""

cat = []
for a in ADMIN_APPS:
    open(os.path.join(OUT, a["id"] + ".html"), "w", encoding="utf-8").write(page(a, ACSS, AJS, "APP", a["tagline"]))
    cat.append(a["id"])
for s in SITE_APPS:
    open(os.path.join(OUT, s["id"] + ".html"), "w", encoding="utf-8").write(page(s, SCSS, SJS, "SITE", s["footer"]))
    cat.append(s["id"])
print("Üretilen şablonlar:", ", ".join(cat))
