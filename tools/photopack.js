#!/usr/bin/env node
/* Waypoint photo packs: a city's photos in one file (what a pack is, and the app's side: trip/lib/photopack.js).

     node photopack.js build <photos_doc.json> <files_dir> <out_file>
         <photos_doc.json> is the city's photo index as ArtifactData saves it (photos/<country-city>).
         <files_dir> holds the city's pictures, each named by the last part of its address (the 32 letters and digits
         of "/_blob/<id>"), with any ending or none. For each photo, one copy goes in: its 720 px WebP when it has one
         (the smallest good copy), else its 720 px JPEG; in the pack it is named by the photo's own address (url),
         which is what the app looks a photo up by. A "nearby" stand-in is left out (it is not this place's photo), as
         is a picture that is missing, is not a JPEG or WebP, or is over 400 KB. Prints
         {slug, n, bytes, missing: [names], skipped: [names]} and exits 1 when nothing went in.
     node photopack.js check <pack_file> [photos_doc.json]
         Reads a pack back the way the app does; with the photo index, also says which of its photos the pack lacks.
         Prints {slug, at, n, bytes, lacks?: n}; exits 1 when it is not a pack.

   It only reads and writes the files it is given. Putting a pack in the app's store, and naming it in the city's
   photo index (photos/<city>.pack = {url, n, bytes, at}), is the nightly photo task's job. */
"use strict";
const fs = require("fs"),
  path = require("path");

const MAGIC = "WPPK1\n",
  MAX_ONE = 400 * 1024,
  today = () => new Date().toISOString().slice(0, 10);

/** JPEG or WebP, by the file's own first bytes (never by its name) */
function kind(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return "";
}
const idOf = u => {
  const m = /\/_blob\/([0-9a-f]{32})(?:[?#].*)?$/.exec(String(u || ""));
  return m ? m[1] : "";
};
/** the pictures in a directory, by id */
function filesIn(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    const m = /^([0-9a-f]{32})(?:\.[a-z0-9]+)?$/.exec(f);
    if (m) out[m[1]] = path.join(dir, f);
  }
  return out;
}
/** a pack from pictures: [{url, type, bytes: Buffer}] */
function pack(slug, at, items) {
  const index = Buffer.from(JSON.stringify({ v: 1, slug, at, items: items.map(x => [x.url, x.type, x.bytes.length]) }), "utf8"),
    len = Buffer.alloc(4);
  len.writeUInt32LE(index.length, 0);
  return Buffer.concat([Buffer.from(MAGIC, "latin1"), len, index].concat(items.map(x => x.bytes)));
}
/** a pack read back, as the app reads it (trip/lib/photopack.js read): null when it is not one */
function read(buf) {
  if (!buf || buf.length < MAGIC.length + 4 || buf.toString("latin1", 0, MAGIC.length) !== MAGIC) return null;
  const L = buf.readUInt32LE(MAGIC.length),
    at = MAGIC.length + 4;
  if (!L || L > 262144 || at + L > buf.length) return null;
  let idx;
  try {
    idx = JSON.parse(buf.toString("utf8", at, at + L));
  } catch (e) {
    return null;
  }
  if (!idx || idx.v !== 1 || !Array.isArray(idx.items)) return null;
  let pos = at + L;
  const out = [],
    seen = {};
  for (const it of idx.items) {
    if (!Array.isArray(it) || typeof it[0] !== "string" || !it[0] || seen[it[0]]) return null;
    if ((it[1] !== "image/webp" && it[1] !== "image/jpeg") || !Number.isInteger(it[2]) || it[2] <= 0 || pos + it[2] > buf.length) return null;
    seen[it[0]] = 1;
    out.push({ url: it[0], type: it[1], start: pos, end: pos + it[2] });
    pos += it[2];
  }
  return { slug: String(idx.slug || ""), at: String(idx.at || ""), items: out };
}
/** the photos of an index that a pack is for: its own photos with an address in the app's store, once each */
function wanted(doc) {
  const items = (doc && doc.items) || {},
    out = [],
    seen = {};
  for (const k of Object.keys(items).sort()) {
    const p = items[k];
    if (!p || !p.url || p.near || !idOf(p.url) || seen[p.url]) continue;
    seen[p.url] = 1;
    out.push({ name: k, url: p.url, webp: (p.webp && p.webp.url) || "" });
  }
  return out;
}
function build(docFile, dir, outFile) {
  const j = JSON.parse(fs.readFileSync(docFile, "utf8")),
    doc = j && j.data ? j.data : j,
    slug = path.basename(docFile).replace(/\.json$/, ""),
    have = filesIn(dir),
    items = [],
    missing = [],
    skipped = [];
  for (const w of wanted(doc)) {
    const f = have[idOf(w.webp)] || have[idOf(w.url)];
    if (!f) {
      missing.push(w.name);
      continue;
    }
    const bytes = fs.readFileSync(f),
      type = kind(bytes);
    if (!type || bytes.length > MAX_ONE) {
      skipped.push(w.name);
      continue;
    }
    items.push({ url: w.url, type, bytes });
  }
  const res = { slug, n: items.length, bytes: 0, missing, skipped };
  if (items.length) {
    const buf = pack(slug, today(), items);
    if (!read(buf)) throw new Error("the pack made does not read back");
    fs.writeFileSync(outFile, buf);
    res.bytes = buf.length;
  }
  return res;
}
function check(packFile, docFile) {
  const buf = fs.readFileSync(packFile),
    pk = read(buf);
  if (!pk) return null;
  const res = { slug: pk.slug, at: pk.at, n: pk.items.length, bytes: buf.length };
  if (docFile) {
    const j = JSON.parse(fs.readFileSync(docFile, "utf8")),
      inPack = {};
    pk.items.forEach(x => (inPack[x.url] = 1));
    res.lacks = wanted(j && j.data ? j.data : j).filter(w => !inPack[w.url]).length;
  }
  return res;
}

module.exports = { pack, read, wanted, build, check, kind };
if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "build" && a && b && c) {
    const r = build(a, b, c);
    console.log(JSON.stringify(r));
    process.exit(r.n ? 0 : 1);
  } else if (cmd === "check" && a) {
    const r = check(a, b);
    console.log(JSON.stringify(r || { error: "not a photo pack" }));
    process.exit(r ? 0 : 1);
  } else {
    console.error("usage: node photopack.js build <photos_doc.json> <files_dir> <out_file> | check <pack_file> [photos_doc.json]");
    process.exit(2);
  }
}
