import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = await readFile(resolve(root, "index.html"), "utf8");

// Use the same catalog, sector names and theme renderer as the Studio preview.
const catalogStart = index.indexOf("const TEMPLATE_LIB=");
const catalogEnd = index.indexOf("const activeTemplateProject", catalogStart);
if (catalogStart < 0 || catalogEnd < 0) throw new Error("Gitmapp şablon kataloğu bulunamadı.");
const { catalog, groups, sectorSlug, applyTheme } = runInNewContext(
  index.slice(catalogStart, catalogEnd) +
    "\n({catalog:TEMPLATE_LIB,groups:TPL_THEME_GROUPS,sectorSlug:templateSectorSlug,applyTheme:templateAppearance})",
);

const destination = resolve(root, "templates", "sectors");
const sectors = new Map();
for (const template of catalog) {
  if (!sectors.has(template.sector)) sectors.set(template.sector, []);
  sectors.get(template.sector).push(template);
}
const sources = new Map(
  await Promise.all(catalog.map(async ({ id }) => [
    id,
    (await readFile(resolve(root, "templates", id + ".html"), "utf8"))
      .replace(/url\("\.\/art\//g, 'url("../../art/'),
  ])),
);
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

await mkdir(destination, { recursive: true });
const directories = [];
const slugSet = new Set();
let count = 0;
for (const [sector, templates] of [...sectors].sort(([a], [b]) => a.localeCompare(b, "tr"))) {
  const slug = sectorSlug(sector);
  if (!slug || slugSet.has(slug)) throw new Error("Tekil sektör klasörü oluşturulamadı: " + sector);
  slugSet.add(slug);
  const folder = resolve(destination, slug);
  await mkdir(folder, { recursive: true });

  const links = [];
  for (const [position, { label, options }] of groups.entries()) {
    const template = templates[position % templates.length];
    const source = sources.get(template.id);
    const batch = options.map(theme => {
      const file = theme.id + ".html";
      const title = escape(template.name + " · " + theme.label);
      const page = applyTheme(source, theme.id).replace(/<title>[^<]*<\/title>/i, "<title>" + title + "</title>");
      links.push(`<li><a href="${slug}/${file}">${escape(theme.label)}</a><span>${escape(template.name)}</span></li>`);
      return writeFile(resolve(folder, file), page);
    });
    if (options.length !== 5) throw new Error("Eksik tema grubu: " + label);
    await Promise.all(batch);
    count += options.length;
  }
  directories.push(`<details id="${slug}"><summary>${escape(sector)}</summary><ul>${links.join("")}</ul></details>`);
}

await writeFile(resolve(destination, "index.html"), `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gitmapp sektör şablonları</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f4ee;color:#202820;font:16px/1.5 system-ui,sans-serif}
main{width:min(calc(100% - 36px),940px);margin:36px auto 64px}
h1{font-size:clamp(34px,6vw,62px);line-height:1.08;letter-spacing:-.05em;margin:.35em 0}
a{color:#274b38;text-underline-offset:3px}details{border-top:1px solid #aeb8a8}details:last-of-type{border-bottom:1px solid #aeb8a8}
summary{cursor:pointer;padding:14px 4px;font-size:18px;font-weight:700}ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:8px;margin:0;padding:4px 0 20px;list-style:none}
li{background:#fff;border:1px solid #d3dbce;border-radius:8px;padding:10px 12px}li span{display:block;color:#485249;font-size:14px}
:focus-visible{outline:3px solid #2359a5;outline-offset:3px}
</style></head><body><main>
<a href="../../index.html#sablonlar">Gitmapp Şablonlar</a>
<h1>Sektör HTML dosyaları</h1>
<p>${sectors.size} sektörün her biri için ${count / sectors.size} çalışan şablon. Bir sektörü açıp görmek istediğiniz stili seçin.</p>
${directories.join("\n")}
</main><script>
function openSector(){
 const sector = document.getElementById(location.hash.slice(1));
 if(sector?.tagName==="DETAILS"){sector.open=true;sector.scrollIntoView();}
}
openSector();
addEventListener("hashchange",openSector);
</script></body></html>\n`);
console.log(`${sectors.size} sektör, ${count} HTML dosyası.`);
