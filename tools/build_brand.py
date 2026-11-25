"""Generate the favicon, monochrome signature files and install icons from the master."""
from pathlib import Path
import subprocess
import tempfile
from xml.etree import ElementTree

root = Path(__file__).resolve().parents[1]
brand = root / "brand"
ns = "http://www.w3.org/2000/svg"
ElementTree.register_namespace("", ns)
master = ElementTree.parse(brand / "squirrel.svg").getroot()
mark = master.find(f"{{{ns}}}g[@id='agent']")
if mark is None:
    raise ValueError("Missing agent silhouette in brand/squirrel.svg")
shape = ElementTree.tostring(mark, encoding="unicode").strip()
viewbox = master.attrib["viewBox"]
ink = "#171c21"
paper = "#f2f4f5"


def icon(color, inset=False, backdrop=""):
    symbol = f'<g transform="translate(7.2 7.2) scale(.85)">{shape}</g>' if inset else shape
    return (f'<svg xmlns="{ns}" viewBox="{viewbox}" fill="{color}">\n'
            f'  <title>Gitmapp</title>\n{backdrop}{symbol}\n</svg>\n')


# Keep the existing light/dark download URLs usable with the current identity.
(brand / "lockup-light.svg").write_text(icon(ink))
(brand / "lockup-dark.svg").write_text(icon(paper))
background = '<rect width="96" height="96" rx="22" fill="#e4ff3d"/>\n'
(brand / "app-icon.svg").write_text(icon(ink, inset=True, backdrop=background))
with tempfile.TemporaryDirectory() as directory:
    source = Path(directory) / "app-icon.svg"
    source.write_text(icon(ink, inset=True, backdrop='<rect width="96" height="96" fill="#e4ff3d"/>\n'))
    for size in (180, 192, 512):
        subprocess.run(["inkscape", str(source), "--export-width", str(size),
                        "--export-filename", str(root / f"pwa/icon-{size}.png")], check=True)
