#!/usr/bin/env node
/* Waypoint's nightly city library fill (v185). The app keeps Claude's answers for a country's towns and a city's first
   lists in its shared database (trip/lib/citylib.js: citylib/<place>), keyed by the question's words with the place
   left out. Its general questions (asked for no one in particular) are in tools/citylib-questions.json, word for word
   as the app asks them (the citylib suite keeps the two equal). A scheduled task runs this script each night to build
   up the library for anyone who uses the app: random countries of the 150 most visited, and random towns in them.
   The task answers the questions itself; this script only plans, fills in the place and checks.

     node citylib.js plan  <db_dir> <work_dir> [cities_a_night=15] [countries_a_night=6]
         <db_dir> holds the database as ArtifactData saves it with out_dir: citylib/*.json
         Writes <work_dir>/tasks.json [{id, kind, country, city, slug, h, prompt}] and <work_dir>/<id>.prompt.txt
     node citylib.js check <db_dir> <work_dir>
         Reads each answer <work_dir>/<id>.json (the JSON the question asks for), checks its shape, and writes
         <work_dir>/out/<slug>.json (the document's fields to write) and <work_dir>/writes.json
         [{collection: "citylib", doc_id, op: "set" | "update", if_version, file}]
     node citylib.js gaps  <db_dir>
         Prints what the library is still missing: countries with no town list, towns with no first lists.
     node citylib.js doctor <db_dir>
         Checks every stored answer against today's rules (its shape, that a city's lists are on a city); prints the
         broken ones and exits 1 if there are any.
     node citylib.js pack  > citylib.js.txt
         This script with the country list and the questions built in, for the scheduled task to fetch.

   Countries come from trip/data/data2.js TOP_COUNTRIES, named as the app names them (English). A country's towns are
   its towns as the library lists them: places to stay (base 1), the most popular, 8 for the 20 most visited
   countries, 4 for the next 40, 2 for the rest. Each night takes countries without a town list and towns without both
   lists at random (a night with few towns to fill takes twice the countries). */
"use strict";
const fs = require("fs"),
  path = require("path");
const EMBED_TOP = null; /* (pack fills these in) */
const EMBED_Q = null;

function top() {
  if (EMBED_TOP) return EMBED_TOP;
  const src = fs.readFileSync(path.join(__dirname, "..", "trip", "data", "data2.js"), "utf8");
  const m = src.match(/window\.TOP_COUNTRIES\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("TOP_COUNTRIES not found in trip/data/data2.js");
  return m[1].split(" ");
}
/* the app's own name rules (lib/core.js W.norm, lib/photos.js W.slug and W.citySlug) */
/* (kept in step with the app's rule by the tools suite; this script is fetched on its own, so it has its own copy) */
const FOLD = { ł: "l", ø: "o", ß: "ss", đ: "d", æ: "ae", þ: "th", ı: "i" }; /* (letters that are no base letter plus an accent) */
function norm(s) {
  const t = String(s || "")
      .toLowerCase()
      .replace(/[łøßđæþı]/g, c => FOLD[c])
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
    a = t.replace(/[^a-z0-9]+/g, " ").trim();
  /* a name with no Latin letters or digits at all (Αθήνα, 東京) is "u" and the hex of each code point */
  return a || (t.match(/[\p{L}\p{N}]/gu) || []).map(c => "u" + c.codePointAt(0).toString(16)).join(" ");
}
const slug = s => norm(s).replace(/ /g, "-").slice(0, 80) || "x";
const citySlug = (country, city) => slug(norm(country) + " " + norm(city));
function questions() {
  return EMBED_Q || JSON.parse(fs.readFileSync(path.join(__dirname, "citylib-questions.json"), "utf8"));
}
/* the app's fingerprint of a question (trip/lib/ideastore.js W.textHash) */
function textHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return s.length + ":" + (h >>> 0).toString(36);
}
/** a shuffled copy (seed: a number, for tests; otherwise random) */
function shuffle(list, seed) {
  let x = seed || Math.floor(Math.random() * 2147483646) + 1;
  const rnd = () => (x = (x * 48271) % 2147483647) / 2147483647;
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const countryName = code => new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;

/** every *.json under dir (as ArtifactData saves them: the document, or {id, data, version}) */
function docsIn(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const data = j && typeof j === "object" && j.data && typeof j.data === "object" ? j.data : j;
      out[f.slice(0, -5)] = { data, version: j && j.version };
    } catch (e) {
      console.error("unreadable", f, e.message);
    }
  }
  return out;
}
const answer = (lib, s, h) => {
  const e = lib[s] && lib[s].data && lib[s].data.q && lib[s].data.q[h];
  return e && e.r && typeof e.r === "object" ? e.r : null;
};
const fill = (t, country, city) =>
  t
    .split("{CITY}")
    .join(city || "")
    .split("{COUNTRY}")
    .join(country);

/** what the library is still missing: countries with no town list, and the towns (the ones plan would fill) with no
    first lists @returns {{codes: string[], bare: string[], open: {country: string, city: string, slug: string, kinds: string[]}[]}} */
function gapsIn(lib, Q) {
  const codes = top();
  /* every town that could be filled: the countries with a town list, their most popular towns to stay in */
  const open = [],
    bare = [];
  codes.forEach((code, rank) => {
    const country = countryName(code),
      cs = slug(country),
      r = answer(lib, cs, Q.cities.h);
    if (!r || !Array.isArray(r.cities)) return bare.push(country);
    const k = rank < 20 ? 8 : rank < 60 ? 4 : 2;
    r.cities
      .map((c, i) => ({ c, i }))
      .filter(x => x.c && typeof x.c.name === "string" && x.c.name && x.c.base !== 0)
      .sort((a, b) => (+b.c.pop || 0) - (+a.c.pop || 0) || a.i - b.i)
      .slice(0, k)
      .forEach(x => {
        const s = citySlug(country, x.c.name);
        const kinds = ["spots", "food"].filter(kind => !answer(lib, s, Q[kind].h));
        if (kinds.length) open.push({ country, city: x.c.name, slug: s, kinds });
      });
  });
  return { codes, bare, open };
}

/** check every stored answer against today's rules; print what is broken (and return the list) */
function doctor(db, lib0 = null) {
  const lib = lib0 || docsIn(path.join(db, "citylib")),
    bad = [];
  let answers = 0,
    docs = 0;
  Object.keys(lib)
    .sort()
    .forEach(s => {
      if (s === "_stats") return;
      docs++;
      const d = lib[s].data || {},
        q = d.q;
      if (!q || typeof q !== "object") return bad.push(s + ": no answers (q is missing)");
      if (d.city === undefined || d.country === undefined) bad.push(s + ": no country or city name");
      const size = Buffer.byteLength(JSON.stringify(d));
      if (size > 200000) bad.push(s + ": " + size + " bytes (too big for one document)");
      Object.keys(q).forEach(h => {
        const e = q[h];
        if (!e || e.drop) return; /* (a dropped answer is a marker, not an answer) */
        answers++;
        const r = e.r;
        if (!r || typeof r !== "object") return bad.push(s + " " + h + ": the answer is not an object");
        const kind = Array.isArray(r.cities) ? "cities" : Array.isArray(r.spots) ? "spots" : Array.isArray(r.food) ? "food" : "";
        if (!kind) return bad.push(s + " " + h + ": not a list of towns, things to do or places to eat");
        if ((kind === "cities") !== !d.city)
          bad.push(s + " " + h + ": a " + kind + " list on a " + (d.city ? "city" : "country") + " document");
        const why = ok(kind, r);
        if (why) bad.push(s + " " + h + " (" + kind + "): " + why);
        if (!(e.at > 0)) bad.push(s + " " + h + ": no time it was kept");
      });
    });
  console.log(JSON.stringify({ documents: docs, answers, broken: bad.length }));
  bad.forEach(b => console.log("  " + b));
  return bad;
}

/** print the gaps (a plain list) */
function gaps(db, lib0 = null) {
  const lib = lib0 || docsIn(path.join(db, "citylib")),
    g = gapsIn(lib, questions());
  console.log("Countries with no town list yet (" + g.bare.length + " of " + g.codes.length + "): " + g.bare.join(", "));
  const by = {};
  g.open.forEach(t => (by[t.country] = by[t.country] || []).push(t.city + " (" + t.kinds.join(" + ") + ")"));
  console.log("Towns missing lists (" + g.open.length + "):");
  Object.keys(by)
    .sort()
    .forEach(c => console.log("  " + c + ": " + by[c].join(", ")));
}

/* (plan, check, gaps and doctor each take the library as already read, `lib`, when a caller has it: it is up to 650
   documents of 200 KB, and one process that runs two steps reads it once) */
function plan(db, work, citiesN = 15, countriesN = 6, seed = 0, lib0 = null) {
  const lib = lib0 || docsIn(path.join(db, "citylib")),
    Q = questions();
  for (const k of ["cities", "spots", "food"])
    if (textHash(Q[k].t) !== Q[k].h) throw new Error("the " + k + " question's fingerprint does not match");
  const { codes, bare, open } = gapsIn(lib, Q);
  const tasks = [];
  const nCountries = open.length < citiesN ? countriesN * 2 : countriesN;
  /* the most visited first (the list is in that order): a night picks at random among the next few that are empty, so the
     likeliest picks fill before the rare ones, and no two nights are the same */
  shuffle(bare.slice(0, Math.max(nCountries * 4, 12)), seed)
    .slice(0, nCountries)
    .forEach(country =>
      tasks.push({ kind: "cities", country, city: "", slug: slug(country), h: Q.cities.h, prompt: fill(Q.cities.t, country, "") })
    );
  const towns = shuffle(open, seed && seed + 1).slice(0, citiesN);
  towns.forEach(t =>
    t.kinds.forEach(kind =>
      tasks.push({ kind, country: t.country, city: t.city, slug: t.slug, h: Q[kind].h, prompt: fill(Q[kind].t, t.country, t.city) })
    )
  );
  fs.mkdirSync(work, { recursive: true });
  tasks.forEach((t, i) => {
    t.id = "t" + (i + 1);
    fs.writeFileSync(path.join(work, t.id + ".prompt.txt"), t.prompt);
  });
  fs.writeFileSync(path.join(work, "tasks.json"), JSON.stringify(tasks, null, 1));
  const filled = codes.length - bare.length;
  console.log(
    JSON.stringify({
      tasks: tasks.length,
      countryLists: tasks.filter(t => t.kind === "cities").length,
      towns: towns.length,
      library: { countries: filled + " of " + codes.length, townsLeft: open.length }
    })
  );
}

/** the answer's JSON (a fenced block or the first {...} in the text) */
function parse(text) {
  const t = String(text).replace(/^﻿/, "");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
  return JSON.parse(body);
}
const named = (list, min, key) =>
  Array.isArray(list) && list.filter(x => x && typeof x === "object" && typeof x[key] === "string" && x[key].trim()).length >= min;
function ok(kind, r) {
  if (!r || typeof r !== "object") return "not an object";
  if (kind === "cities") return named(r.cities, 10, "name") ? "" : "fewer than 10 towns with a name";
  if (kind === "spots") return named(r.spots, 8, "n") ? "" : "fewer than 8 things to do with a name";
  if (kind === "food") return named(r.food, 8, "n") ? "" : "fewer than 8 places to eat with a name";
  return "unknown kind " + kind;
}

function check(db, work, lib0 = null) {
  const lib = lib0 || docsIn(path.join(db, "citylib")),
    tasks = JSON.parse(fs.readFileSync(path.join(work, "tasks.json"), "utf8")),
    by = {},
    report = { kept: 0, missing: 0, refused: [] };
  for (const t of tasks) {
    const f = path.join(work, t.id + ".json");
    if (!fs.existsSync(f)) {
      report.missing++;
      continue;
    }
    let r;
    try {
      r = parse(fs.readFileSync(f, "utf8"));
    } catch (e) {
      report.refused.push(t.id + " " + t.slug + ": not JSON");
      continue;
    }
    const why = ok(t.kind, r);
    if (why) {
      report.refused.push(t.id + " " + t.slug + ": " + why);
      continue;
    }
    const d = (by[t.slug] = by[t.slug] || { country: t.country, city: t.city, q: {} });
    d.q[t.h] = { r, at: Date.now() };
    report.kept++;
  }
  const out = path.join(work, "out");
  fs.mkdirSync(out, { recursive: true });
  const writes = Object.entries(by).map(([s, body]) => {
    const file = path.join(out, s + ".json");
    const size = Buffer.byteLength(JSON.stringify(body));
    if (size > 200000) throw new Error(s + " is " + size + " bytes: too big for one document");
    fs.writeFileSync(file, JSON.stringify(body));
    const had = lib[s];
    /* update merges q into what is there (the app's other answers stay); a new place is set */
    return had
      ? { collection: "citylib", doc_id: s, op: "update", if_version: had.version, file }
      : { collection: "citylib", doc_id: s, op: "set", file };
  });
  /* the library's size after tonight, for the app's Settings (citylib/_stats): countries with a town list, and towns with
     both first lists (what is there now, with what this night adds) */
  const Q = questions(),
    have = (s, h) => !!(by[s] && by[s].q[h]) || !!answer(lib, s, h);
  const slugs = new Set(
    Object.keys(lib)
      .concat(Object.keys(by))
      .filter(s => s !== "_stats")
  );
  let countries = 0,
    cities = 0;
  slugs.forEach(s => {
    const meta = (by[s] && by[s].city !== undefined ? by[s] : lib[s] && lib[s].data) || {};
    if (meta.city) {
      if (have(s, Q.spots.h) && have(s, Q.food.h)) cities++;
    } else if (have(s, Q.cities.h)) countries++;
  });
  const stats = { countries, cities, at: Date.now() },
    sfile = path.join(out, "_stats.json");
  fs.writeFileSync(sfile, JSON.stringify(stats));
  writes.push(
    lib._stats
      ? { collection: "citylib", doc_id: "_stats", op: "update", if_version: lib._stats.version, file: sfile }
      : { collection: "citylib", doc_id: "_stats", op: "set", file: sfile }
  );
  fs.writeFileSync(path.join(work, "writes.json"), JSON.stringify(writes, null, 1));
  console.log(JSON.stringify(Object.assign(report, { documents: writes.length - 1, library: stats })));
}

function pack() {
  const src = fs
    .readFileSync(__filename, "utf8")
    .replace("const EMBED_TOP = null;", "const EMBED_TOP = " + JSON.stringify(top()) + ";")
    .replace("const EMBED_Q = null;", "const EMBED_Q = " + JSON.stringify(questions()) + ";");
  process.stdout.write(src);
}

module.exports = { docsIn, norm, slug, citySlug, textHash, shuffle, parse, ok, plan, check, gaps, doctor };
if (require.main === module) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === "plan") plan(a, b, +c || 15, +d || 6, +process.env.CITYLIB_SEED || 0);
  else if (cmd === "check") check(a, b);
  else if (cmd === "gaps") gaps(a);
  else if (cmd === "doctor") process.exitCode = doctor(a).length ? 1 : 0;
  else if (cmd === "pack") pack();
  else {
    console.error(
      "usage: citylib.js plan <db_dir> <work_dir> [cities] [countries] | check <db_dir> <work_dir> | gaps <db_dir> | doctor <db_dir> | pack"
    );
    process.exit(2);
  }
}
