#!/usr/bin/env node
/* The nightly copy, step 2 of 3. Step 1 (Supabase connector): select public.import_begin(10);
   Step 2: node tools/copy_to_cloud.js <dir> [--packs <dir2>]   — <dir> holds <collection>/<id>.json files exported
   from the Claude version's database (photos, places, menus, morefood, links, fx, maps, and the city library
   citylib, v185, which the nightly city library task sends on its own after it fills it, and the world library's
   records, world, v196). It sends them to the staging
   table with the public key (only accepted while the window is open) and prints the count and fingerprint.
   Map packs: a maps/<slug> document lists its pack's parts in the Claude version's file store ("/_blob/<id>"), which
   other sites can't open. Each part is stored once in this project's file storage (bucket "maps", named by its id);
   "--need" lists the ids not stored yet, <dir2> holds those as files (<id>.js, as the Artifact tool saves an asset),
   and the document copied here points at the stored parts. A document whose parts can't all be stored is left out.
   Step 3 (connector): select public.import_finish('<fingerprint>', <count>);  — copies them in only if they match. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const URL0 = process.env.WP_CLOUD_URL || "https://fbgubkesrlvtcnbaxuef.supabase.co";
const KEY = process.env.WP_CLOUD_KEY || "sb_publishable_oPm5lh5CA7zbkLH-xxlhMQ_k1ZSN-xj";
const KINDS = ["photos", "places", "menus", "morefood", "links", "fx", "maps", "citylib", "world"], OK = /^[A-Za-z0-9_.:@+~-]{1,200}$/;
/* Photos in the Claude version point at its own file store ("/_blob/..."), which other sites can't open;
   here each one points at the same picture on Wikimedia Commons instead (its "page" says which file). */
function commonsSized(it) {
  const m = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/.exec((it && it.page) || "");
  if (!m) return null;
  let name; try { name = decodeURIComponent(m[1]); } catch (e) { return null; }
  return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(name.replace(/ /g, "_")) + "?width=960";
}
function forTheWeb(kind, data) {
  /* (a nightly place's fit for the owner's food needs stays out of the shared copy: it could say what they can't eat) */
  if (kind === "morefood" && Array.isArray(data.items))
    return Object.assign({}, data, { items: data.items.map(it => { const o = Object.assign({}, it); delete o.fit; delete o.fitw; delete o.like; return o; }) });
  if (kind !== "photos" || !data.items || typeof data.items !== "object") return data;
  const items = {};
  for (const [k, it] of Object.entries(data.items)) {
    if (!it || typeof it !== "object") continue;
    if (typeof it.url === "string" && it.url.startsWith("/_blob/")) { const u = commonsSized(it); if (!u) continue; items[k] = Object.assign({}, it, { url: u }); }
    else items[k] = Object.assign({}, it);
    delete items[k].big;   /* a large copy in the Claude file store: here the app asks Commons for the size it needs */
    /* the small copy, the WebP twins and the sizes that go with them are files in the Claude file store too: here the app asks
       Commons for the small width itself. The blurred preview (lq) is text inside the record, so it comes along. */
    delete items[k].sm; delete items[k].smw; delete items[k].w; delete items[k].webp;
  }
  return Object.assign({}, data, { items });
}
const md5 = s => crypto.createHash("md5").update(s, "utf8").digest("hex");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const PUBLIC = URL0 + "/storage/v1/object/public/maps/";
/* one part of a map pack, by its id in the Claude version's file store: stored here once, as maps/<slug>/p<n>-<id>.json
   (the id changes whenever a pack is rebuilt, so a stored part never changes). Already stored: its address, no file
   needed. Not yet: its file from the packs folder, checked (it is the part it says it is), sent; null if that fails. */
const exists = name => fetch(PUBLIC + name, { method: "HEAD" }).then(r => r.ok, () => false);
function partName(slug, i, blob) {
  const m = /^\/_blob\/([0-9a-f]{32})$/.exec(String(blob || ""));
  return m && /^[a-z0-9-]{1,90}$/.test(slug) ? { id: m[1], name: slug + "/p" + i + "-" + m[1] + ".json" } : null;
}
async function storePart(packs, slug, i, blob, log) {
  const pn = partName(slug, i, blob);
  if (!pn) { log.push("odd part " + slug + " " + i + ": " + blob); return null; }
  if (await exists(pn.name)) return PUBLIC + pn.name;
  const file = packs ? path.join(packs, pn.id + ".js") : "";
  if (!file || !fs.existsSync(file)) { log.push("no file for " + slug + " part " + i + " (" + pn.id + ")"); return null; }
  const buf = fs.readFileSync(file);
  let j; try { j = JSON.parse(buf.toString("utf8")); } catch (e) { log.push("not JSON: " + file); return null; }
  if (!j || j.slug !== slug || j.part !== i || typeof (j.v === 2 ? j.d : j.b64) !== "string") { log.push("not " + slug + " part " + i + ": " + file); return null; }
  const r = await fetch(URL0 + "/storage/v1/object/maps/" + pn.name, { method: "POST",
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", "x-upsert": "false", "cache-control": "31536000" }, body: buf });
  if (!r.ok && r.status !== 409) { log.push("upload failed for " + pn.name + ": " + r.status + " " + (await r.text()).slice(0, 200)); return null; }
  return PUBLIC + pn.name;
}
/* a map pack's document, pointing at the parts stored here; null when a part couldn't be stored */
async function mapsForTheWeb(data, packs, log) {
  if (!data || !data.slug || !Array.isArray(data.parts) || !data.parts.length || !Array.isArray(data.b)) return null;
  const urls = [];
  for (let i = 0; i < data.parts.length; i++) {
    const p = data.parts[i];
    if (typeof p === "string" && p.startsWith(PUBLIC)) { urls.push(p); continue; }
    const u = await storePart(packs, data.slug, i, p, log);
    if (!u) return null;
    urls.push(u);
  }
  return Object.assign({}, data, { parts: urls });
}
async function main() {
  const dir = process.argv[2], pi = process.argv.indexOf("--packs"), packs = pi > 2 ? process.argv[pi + 1] : null, log = [];
  if (!dir) { console.error("usage: node tools/copy_to_cloud.js <dir> [--packs <dir>] | <dir> --need"); process.exit(2); }
  /* --need: the map pack parts not stored here yet, one file-store id a line (fetch those into the packs folder) */
  if (process.argv.includes("--need")) {
    const d = path.join(dir, "maps"), out = [];
    for (const f of fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".json")).sort() : []) {
      let m; try { m = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (e) { continue; }
      for (let i = 0; m && Array.isArray(m.parts) && i < m.parts.length; i++) {
        const pn = partName(m.slug, i, m.parts[i]);
        if (pn && !(await exists(pn.name))) out.push(pn.id);
      }
    }
    out.forEach(id => console.log(id));
    return;
  }
  const rows = [];
  for (const k of KINDS) {
    const d = path.join(dir, k); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith(".json")).sort()) {
      const id = f.slice(0, -5); if (!OK.test(id)) { console.error("skipped (odd name): " + k + "/" + f); continue; }
      let data; try { data = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (e) { console.error("skipped (not JSON): " + k + "/" + f); continue; }
      if (!data || typeof data !== "object" || Array.isArray(data)) { console.error("skipped (not an object): " + k + "/" + f); continue; }
      const web = k === "maps" ? await mapsForTheWeb(data, packs, log) : forTheWeb(k, data);
      if (!web) { console.error("skipped (its map pack isn't at hand): " + k + "/" + f); continue; }
      const body = JSON.stringify(web);
      if (body.length >= 300000) { console.error("skipped (too big): " + k + "/" + f); continue; }
      rows.push({ path: k + "/" + id, body });
    }
  }
  rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (let i = 0; i < rows.length; i += 40) {
    const r = await fetch(URL0 + "/rest/v1/import_staging", { method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 40)) });
    if (!r.ok) { console.error("upload failed at " + i + ": " + r.status + " " + (await r.text()).slice(0, 300)); process.exit(1); }
  }
  const fp = md5(rows.map(r => r.path + "\t" + md5(r.body)).join("\n"));
  log.forEach(l => console.error(l));
  console.log(JSON.stringify({ count: rows.length, fingerprint: fp }));
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
