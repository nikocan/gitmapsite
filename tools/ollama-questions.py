"""Probe the Studio copilot with synthetic project context. Run sequentially."""
import json
import sys
import time
import urllib.request

cases = [
    ("restoran", {"proje": "Restoran", "anaEylem": "Masa ayırt"}, "Bu projenin ana eylemi hangisi? Yalnızca düğmenin etiketini yaz.", "Masa ayırt"),
    ("okul", {"proje": "Okul", "anaEylem": "Ödev yükle"}, "Bu projenin ana eylemi hangisi? Yalnızca düğmenin etiketini yaz.", "Ödev yükle"),
    ("eksik bilgi", {"proje": "Kafe", "ekran": "Menü"}, "Bu kafenin kaç masası var? Bilgi verilmediyse yalnızca Bilinmiyor yaz.", "Bilinmiyor"),
]
passed = 0
for name, context, question, expected in cases:
    payload = {"messages": [{"role": "user", "content": question}], "context": context}
    request = urllib.request.Request(sys.argv[1] + "/api/ai/copilot",
                                     json.dumps(payload).encode(), {"Content-Type": "application/json"})
    start = time.monotonic()
    with urllib.request.urlopen(request, timeout=300) as response:
        reply = json.load(response)["reply"]
    ok = reply.strip().rstrip(".").casefold() == expected.casefold()
    passed += int(ok)
    print(json.dumps({"case": name, "seconds": round(time.monotonic() - start, 2),
                      "ok": ok,
                      "reply": reply}, ensure_ascii=False), flush=True)
sys.exit(0 if passed == len(cases) else 1)
