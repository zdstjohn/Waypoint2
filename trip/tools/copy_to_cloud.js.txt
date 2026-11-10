#!/usr/bin/env node
/* The nightly copy, step 2 of 3. Step 1 (Supabase connector): select public.import_begin(10);
   Step 2: node tools/copy_to_cloud.js <dir>   — <dir> holds <collection>/<id>.json files exported from the
   Claude version's database (photos, places, menus, morefood, links, fx). It sends them to the staging table
   with the public key (only accepted while the window is open) and prints the count and fingerprint.
   Step 3 (connector): select public.import_finish('<fingerprint>', <count>);  — copies them in only if they match. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const URL0 = process.env.WP_CLOUD_URL || "https://fbgubkesrlvtcnbaxuef.supabase.co";
const KEY = process.env.WP_CLOUD_KEY || "sb_publishable_oPm5lh5CA7zbkLH-xxlhMQ_k1ZSN-xj";
const KINDS = ["photos", "places", "menus", "morefood", "links", "fx"], OK = /^[A-Za-z0-9_.:@+~-]{1,200}$/;
/* Photos in the Claude version point at its own file store ("/_blob/..."), which other sites can't open;
   here each one points at the same picture on Wikimedia Commons instead (its "page" says which file). */
function commonsSized(it) {
  const m = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/.exec((it && it.page) || "");
  if (!m) return null;
  let name; try { name = decodeURIComponent(m[1]); } catch (e) { return null; }
  return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(name.replace(/ /g, "_")) + "?width=960";
}
function forTheWeb(kind, data) {
  if (kind !== "photos" || !data.items || typeof data.items !== "object") return data;
  const items = {};
  for (const [k, it] of Object.entries(data.items)) {
    if (!it || typeof it !== "object") continue;
    if (typeof it.url === "string" && it.url.startsWith("/_blob/")) { const u = commonsSized(it); if (!u) continue; items[k] = Object.assign({}, it, { url: u }); }
    else items[k] = Object.assign({}, it);
    delete items[k].big;   /* a large copy in the Claude file store: here the app asks Commons for the size it needs */
  }
  return Object.assign({}, data, { items });
}
const md5 = s => crypto.createHash("md5").update(s, "utf8").digest("hex");
async function main() {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: node tools/copy_to_cloud.js <dir>"); process.exit(2); }
  const rows = [];
  for (const k of KINDS) {
    const d = path.join(dir, k); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith(".json")).sort()) {
      const id = f.slice(0, -5); if (!OK.test(id)) { console.error("skipped (odd name): " + k + "/" + f); continue; }
      let data; try { data = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (e) { console.error("skipped (not JSON): " + k + "/" + f); continue; }
      if (!data || typeof data !== "object" || Array.isArray(data)) { console.error("skipped (not an object): " + k + "/" + f); continue; }
      const body = JSON.stringify(forTheWeb(k, data));
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
  console.log(JSON.stringify({ count: rows.length, fingerprint: fp }));
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
