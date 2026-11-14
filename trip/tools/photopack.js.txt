#!/usr/bin/env node
/* Waypoint photo packs: a city's photos in one file (what a pack is, and the app's side: trip/lib/photopack.js).
   A pack is JSON text (v199: the app's file store takes text, not raw binary), named .js for the store as the street
   map's parts are: {"wppk": 2, "slug", "at", "items": [[url, type, base64], ...]}.

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

     node photopack.js plan <db_dir> <out_dir>
         Moving the stored photos into packs. <db_dir> holds the database as ArtifactData saves it (photos and wanted
         at least; every collection there is searched for files still in use). The cities of trips (wanted) keep
         their files; every other city with photos is packed. Writes <out_dir>/plan.json {cities: {<slug>: {fetch:
         [ids of the copies to pack], free: [ids no longer used once it is packed]}}, files, free} and prints a
         summary. Nothing is changed.
     node photopack.js build-parts <photos_doc.json> <files_dir> <out_prefix> [wanted_doc.json]
         The same, in parts of at most about 1.5 MB (v202): a city a trip goes to can have 60+ photos (Granada's
         pack was 7.9 MB), and a phone should fetch only the part a day's photos are in, not the whole city. With
         the trip's wanted document, the photos go in the order the trip uses them (a day's stops share a part), the
         rest after. Writes <out_prefix>.p1.js, .p2.js, ... and prints {slug, n, bytes, parts: [{file, n, bytes}],
         missing, skipped}.
     node photopack.js mark-parts <photos_doc.json> <parts.json> <out.json>
         As mark, for packs in parts: <parts.json> is [{url, file}] in part order (the uploaded address of each part
         file). A photo in part i gets pk: i (1, 2, ...); the index's pack is {url: the first part, parts: [every
         part's address], n, bytes, at}. One part is written exactly as mark writes a single pack.
     node photopack.js mark <photos_doc.json> <pack_url> <pack_file> <out.json>
         The city's photo index with its pack named: each photo the pack holds gets pk: 1 and loses the copies that
         were files of their own (sm, big, the WebP twins and their sizes); its blurred preview stays. Writes the
         document (the data alone) to <out.json>.

   It only reads and writes the files it is given; uploading packs, writing documents and removing files are done
   by whoever runs it, with the owner's yes. */
"use strict";
const fs = require("fs"),
  path = require("path");

const MAX_ONE = 400 * 1024,
  PART_MAX = 1.5e6 /* (a part's text: the base64 of its pictures and a little JSON) */,
  MAX_ITEMS = 400,
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
/** a pack from pictures: [{url, type, bytes: Buffer}] -> its text */
function pack(slug, at, items) {
  return JSON.stringify({ wppk: 2, slug, at, items: items.map(x => [x.url, x.type, x.bytes.toString("base64")]) });
}
/** a pack read back, as the app reads it (trip/lib/photopack.js read): [{url, type, bytes}], or null when it is not one */
function read(text) {
  let x;
  try {
    x = JSON.parse(String(text));
  } catch (e) {
    return null;
  }
  if (!x || x.wppk !== 2 || !Array.isArray(x.items) || x.items.length > MAX_ITEMS) return null;
  const out = [],
    seen = {};
  for (const it of x.items) {
    if (!Array.isArray(it) || typeof it[0] !== "string" || !it[0] || seen[it[0]]) return null;
    if ((it[1] !== "image/webp" && it[1] !== "image/jpeg") || typeof it[2] !== "string" || !it[2] || it[2].length % 4) return null;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(it[2])) return null;
    const bytes = Buffer.from(it[2], "base64");
    if (kind(bytes) !== it[1]) return null;
    seen[it[0]] = 1;
    out.push({ url: it[0], type: it[1], bytes });
  }
  return { slug: String(x.slug || ""), at: String(x.at || ""), items: out };
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
    const text = pack(slug, today(), items);
    if (!read(text)) throw new Error("the pack made does not read back");
    fs.writeFileSync(outFile, text);
    res.bytes = Buffer.byteLength(text);
  }
  return res;
}
function check(packFile, docFile) {
  const text = fs.readFileSync(packFile, "utf8"),
    pk = read(text);
  if (!pk) return null;
  const res = { slug: pk.slug, at: pk.at, n: pk.items.length, bytes: Buffer.byteLength(text) };
  if (docFile) {
    const j = JSON.parse(fs.readFileSync(docFile, "utf8")),
      inPack = {};
    pk.items.forEach(x => (inPack[x.url] = 1));
    res.lacks = wanted(j && j.data ? j.data : j).filter(w => !inPack[w.url]).length;
  }
  return res;
}

/* ---------- moving the stored photos into packs ---------- */
const BLOB = /\/_blob\/([0-9a-f]{32})/g;
const blobsIn = x => new Set([...JSON.stringify(x).matchAll(BLOB)].map(m => m[1]));
function loadDir(dir) {
  const db = {};
  for (const col of fs.readdirSync(dir)) {
    const d = path.join(dir, col);
    if (!fs.statSync(d).isDirectory()) continue;
    db[col] = {};
    for (const f of fs.readdirSync(d))
      if (/^[^.].*\.json$/.test(f)) {
        const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
        db[col][f.slice(0, -5)] = j && j.data ? j.data : j;
      }
  }
  return db;
}
/** the files a packed photo no longer needs: every copy of it that is a file of its own */
function copiesOf(p) {
  return [p.url, p.sm, p.big, p.webp && p.webp.url, p.webp && p.webp.sm, p.webp && p.webp.big].map(idOf).filter(Boolean);
}
/** the photo index once its pack is named: what the app reads (pk), what no longer has a file */
function marked(doc, packUrl, packed, bytes, at, parts) {
  const items = {},
    /* (url -> the part it is in: 1 for a single pack) */
    partOf = Array.isArray(packed) ? Object.fromEntries(packed.map(u => [u, 1])) : packed,
    inPack = new Set(Object.keys(partOf));
  for (const [k, p] of Object.entries(doc.items || {})) {
    if (!p || !inPack.has(p.url) || p.near) {
      items[k] = p;
      continue;
    }
    const q = Object.assign({}, p, { pk: partOf[p.url] });
    for (const f of ["sm", "smw", "w", "big", "webp"]) delete q[f];
    items[k] = q;
  }
  const pack = { url: packUrl, n: inPack.size, bytes, at };
  if (parts && parts.length > 1) pack.parts = parts;
  return Object.assign({}, doc, { items, pack });
}
const normName = s =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** the city's photos in parts of at most PART_MAX, in the order the trip uses them (wanted.used, then wanted.spots and
    food), the rest by name */
function buildParts(docFile, dir, outPrefix, wantedFile) {
  const j = JSON.parse(fs.readFileSync(docFile, "utf8")),
    doc = j && j.data ? j.data : j,
    slug = path.basename(docFile).replace(/\.json$/, ""),
    have = filesIn(dir),
    missing = [],
    skipped = [],
    pics = [];
  let order = [];
  if (wantedFile && fs.existsSync(wantedFile)) {
    const wj = JSON.parse(fs.readFileSync(wantedFile, "utf8")),
      w = wj && wj.data ? wj.data : wj;
    order = [doc.city || w.city || ""]
      .concat((w.used || []).map(u => (Array.isArray(u) ? u[0] : u)))
      .concat(w.spots || [], w.food || [])
      .map(normName);
  }
  const rank = Object.fromEntries(order.map((n, i) => [n, i]).reverse());
  const list = wanted(doc).sort((a, b) => {
    const ra = rank[a.name] === undefined ? 1e9 : rank[a.name],
      rb = rank[b.name] === undefined ? 1e9 : rank[b.name];
    return ra - rb || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  });
  for (const w of list) {
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
    pics.push({ url: w.url, type, bytes });
  }
  const parts = [];
  let cur = [],
    size = 0;
  for (const p of pics) {
    const est = Math.ceil(p.bytes.length / 3) * 4 + p.url.length + 40;
    if (cur.length && (size + est > PART_MAX || cur.length >= MAX_ITEMS)) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += est;
  }
  if (cur.length) parts.push(cur);
  const res = { slug, n: pics.length, bytes: 0, parts: [], missing, skipped };
  parts.forEach((items, i) => {
    const text = pack(slug, today(), items),
      file = outPrefix + ".p" + (i + 1) + ".js";
    if (!read(text)) throw new Error("a part made does not read back: " + file);
    fs.writeFileSync(file, text);
    const b = Buffer.byteLength(text);
    res.bytes += b;
    res.parts.push({ file, n: items.length, bytes: b });
  });
  return res;
}
/** a city's index with its pack in parts named: parts = [{url, file}] in part order */
function markParts(docFile, partsFile, outFile) {
  const j = JSON.parse(fs.readFileSync(docFile, "utf8")),
    doc = j && j.data ? j.data : j,
    list = JSON.parse(fs.readFileSync(partsFile, "utf8")),
    partOf = {};
  let bytes = 0,
    at = "";
  if (!Array.isArray(list) || !list.length) throw new Error("no parts in " + partsFile);
  list.forEach((x, i) => {
    if (!/^\/_blob\/[0-9a-f]{32}$/.test(x.url)) throw new Error("not a file in the app's store: " + x.url);
    const text = fs.readFileSync(x.file, "utf8"),
      pk = read(text);
    if (!pk) throw new Error("not a photo pack: " + x.file);
    pk.items.forEach(it => {
      if (!partOf[it.url]) partOf[it.url] = i + 1;
    });
    bytes += Buffer.byteLength(text);
    at = at || pk.at;
  });
  const out = marked(
    doc,
    list[0].url,
    partOf,
    bytes,
    at,
    list.map(x => x.url)
  );
  fs.writeFileSync(outFile, JSON.stringify(out));
  return { n: Object.keys(partOf).length, parts: list.length, marked: Object.values(out.items).filter(p => p && p.pk).length };
}
function plan(dbDir, outDir) {
  const db = loadDir(dbDir),
    photos = db.photos || {},
    trips = db.wanted || {},
    cities = {};
  /* what stays in use: everything outside the cities to pack, and in them what the marked index still points at
     (the photos left out of a pack: stand-ins from nearby, ones without a file) */
  const keep = new Set();
  for (const [col, docs] of Object.entries(db))
    for (const [id, d] of Object.entries(docs)) if (col !== "photos" || trips[id]) blobsIn(d).forEach(b => keep.add(b));
  for (const [slug, doc] of Object.entries(photos)) {
    if (trips[slug]) continue;
    const want = wanted(doc),
      fetch = want.map(w => idOf(w.webp) || idOf(w.url)).filter(Boolean);
    if (!want.length) continue;
    const after = marked(doc, "", want.map(w => w.url), 0, ""),
      still = new Set();
    for (const p of Object.values(after.items)) if (p && !p.pk) blobsIn(p).forEach(b => still.add(b));
    still.forEach(b => keep.add(b));
    cities[slug] = { fetch, all: [...new Set(want.flatMap(w => copiesOf((doc.items || {})[w.name] || {})))] };
  }
  let files = 0,
    free = 0;
  for (const c of Object.values(cities)) {
    c.free = c.all.filter(b => !keep.has(b));
    delete c.all;
    files += c.fetch.length;
    free += c.free.length;
  }
  fs.mkdirSync(outDir, { recursive: true });
  const out = { cities, files, free, packs: Object.keys(cities).length };
  fs.writeFileSync(path.join(outDir, "plan.json"), JSON.stringify(out, null, 1));
  return { cities: out.packs, fetch: files, free, kept: Object.keys(photos).length - out.packs };
}
function mark(docFile, packUrl, packFile, outFile) {
  const j = JSON.parse(fs.readFileSync(docFile, "utf8")),
    doc = j && j.data ? j.data : j,
    text = fs.readFileSync(packFile, "utf8"),
    pk = read(text);
  if (!pk) throw new Error("not a photo pack: " + packFile);
  if (!/^\/_blob\/[0-9a-f]{32}$/.test(packUrl)) throw new Error("not a file in the app's store: " + packUrl);
  const out = marked(doc, packUrl, pk.items.map(x => x.url), Buffer.byteLength(text), pk.at);
  fs.writeFileSync(outFile, JSON.stringify(out));
  return { n: pk.items.length, marked: Object.values(out.items).filter(p => p && p.pk).length };
}

module.exports = { pack, read, wanted, build, buildParts, check, kind, plan, mark, markParts, marked, PART_MAX };
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
  } else if (cmd === "plan" && a && b) {
    console.log(JSON.stringify(plan(a, b)));
  } else if (cmd === "build-parts" && a && b && c) {
    const r = buildParts(a, b, c, process.argv[6]);
    console.log(JSON.stringify(r));
    process.exit(r.n ? 0 : 1);
  } else if (cmd === "mark-parts" && a && b && c) {
    console.log(JSON.stringify(markParts(a, b, c)));
  } else if (cmd === "mark" && a && b && c && process.argv[6]) {
    console.log(JSON.stringify(mark(a, b, c, process.argv[6])));
  } else {
    console.error("usage: node photopack.js build <photos_doc.json> <files_dir> <out_file> | build-parts <photos_doc.json> <files_dir> <out_prefix> [wanted_doc.json] | mark-parts <photos_doc.json> <parts.json> <out.json> | check <pack_file> [photos_doc.json] | plan <db_dir> <out_dir> | mark <photos_doc.json> <pack_url> <pack_file> <out.json>");
    process.exit(2);
  }
}
