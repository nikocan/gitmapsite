#!/usr/bin/env python3
"""Build the in-app mobile references from the Envato research CSV."""
import csv
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "validation/catalog/envato-mobil-2026.csv"
OUTPUT = ROOT / "templates/mobile-references.json"


def source_link(value):
    url = urlsplit(value)
    if url.scheme != "https" or url.query or url.fragment:
        return False
    if url.netloc == "elements.envato.com":
        return re.fullmatch(r"/[a-z0-9-]+-[A-Z0-9]{7}", url.path)
    if url.netloc == "app.envato.com":
        return re.fullmatch(r"/search/graphic-templates/[0-9a-f-]{36}", url.path)
    return False


with SOURCE.open(encoding="utf-8-sig", newline="") as file:
    references = []
    links = set()
    for row in csv.DictReader(file):
        title = row["Ürün"].strip()
        if re.search(r"\b(?:landing page|wordpress|webflow|web template)\b", title, re.I):
            continue
        url = row["Envato"].strip()
        if not source_link(url) or url in links or "Figma" not in row["Uygulamalar"]:
            continue
        links.add(url)
        references.append({
            "title": title,
            "sector": row["Sektör"],
            "related": row["Diğer eşleşmeler"].split(" · ") if row["Diğer eşleşmeler"] else [],
            "formats": row["Uygulamalar"],
            "recent": row["Tarih kanıtı"] == "2026 · Son 6 ay filtresi",
            "kind": row["Kapsam"],
            "note": row["Görsel not"],
            "colors": [s for s in row["Yaklaşık palet"].split(",") if re.fullmatch(r"#[\da-f]{6}", s)],
            "url": url,
        })

references.sort(key=lambda row: (not row["recent"], not row["note"], row["title"].casefold(), row["url"]))
if not references:
    raise ValueError("Kataloğa uygun mobil referans bulunamadı.")
OUTPUT.write_text(json.dumps(references, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(references)} referans, {sum(row['recent'] for row in references)} adet 2026 kaydı.")
