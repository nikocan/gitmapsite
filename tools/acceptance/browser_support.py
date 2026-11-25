"""Shared local web server and Chromium fixtures for the Studio acceptance checks."""

from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.shutdown)
BASE_URL = "http://127.0.0.1:" + str(server.server_port)


def setup(p, w=390):
    browser = p.chromium.launch(
        executable_path=os.getenv("CHROMIUM") or shutil.which("chromium")
    )
    page = browser.new_page(
        has_touch=w == 390,
        is_mobile=w == 390,
        viewport={"width": w, "height": 900},
        reduced_motion="reduce",
    )
    if os.getenv("BROWSER_LIB"):
        libs = Path(os.environ["BROWSER_LIB"])
        page.route(
            "https://unpkg.com/**",
            lambda route: route.fulfill(
                path=libs / route.request.url.split("/")[-1],
                content_type="application/javascript",
            ),
        )
    page.route("https://api.gitmapp.com/**", lambda route: route.fulfill(json={}))
    page.add_init_script(
        "window.SpeechRecognition=class {start(){window.rec=this} stop(){this.onend?.()}}"
    )
    return browser, page
