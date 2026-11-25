"""Regenerate the standalone favicon and install icons from the Gitmapp squirrel."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
master = (root / "brand/squirrel.svg").read_text()
tile = master.replace('<g id="tail">', '<rect width="96" height="96" rx="22" fill="#e4ff3d"/>\n  <g id="tail">', 1)
source = root / "brand/app-icon.svg"
source.write_text(tile)
for size in (180, 192, 512):
    subprocess.run(["inkscape", str(source), "--export-width", str(size),
                    "--export-filename", str(root / f"pwa/icon-{size}.png")], check=True)
