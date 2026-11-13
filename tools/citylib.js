#!/usr/bin/env node
/* Waypoint's nightly city library fill (v184). The app keeps Claude's answers for a country's towns and a city's first
   lists in its shared database (trip/lib/citylib.js: citylib/<place>), keyed by the question's words with the place
   left out; it notes the words its owner's trips ask (data/users/<owner>/libq/q/<hash>). A scheduled task runs this
   script to ask those same questions ahead of time, for the most visited countries first, so a city is ready before
   anyone picks it. The task answers the questions itself; this script only plans, fills in the place and checks.

     node citylib.js plan  <db_dir> <work_dir> [cities_a_night=15] [countries_a_night=6]
         <db_dir> holds the database as ArtifactData saves it with out_dir: citylib/*.json and data/users/<id>/libq/q/*.json
         Writes <work_dir>/tasks.json [{id, kind, country, city, slug, h, prompt}] and <work_dir>/<id>.prompt.txt
     node citylib.js check <db_dir> <work_dir>
         Reads each answer <work_dir>/<id>.json (the JSON the question asks for), checks its shape, and writes
         <work_dir>/out/<slug>.json (the document's fields to write) and <work_dir>/writes.json
         [{collection: "citylib", doc_id, op: "set" | "update", if_version, file}]
     node citylib.js pack  > citylib.js.txt
         This script with the country list built in, for the scheduled task to fetch from the artifact.

   Countries come in the app's order (trip/data/data2.js TOP_COUNTRIES, the most visited first), named as the app names
   them (English). A country's cities are its towns as the library's answer lists them: places to stay (base 1), the
   most popular first, 8 for the 20 most visited countries, 4 for the next 40, 2 for the rest. Only questions noted in
   the last 30 days are asked, and of each kind the two noted last (a trip whose interests changed asks the new way). */
"use strict";
const fs = require("fs"),
  path = require("path");
const EMBED_TOP = null; /* (pack fills this in) */
const NOTE_DAYS = 30,
  KINDS_KEPT = 2;

function top() {
  if (EMBED_TOP) return EMBED_TOP;
  const src = fs.readFileSync(path.join(__dirname, "..", "trip", "data", "data2.js"), "utf8");
  const m = src.match(/window\.TOP_COUNTRIES\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("TOP_COUNTRIES not found in trip/data/data2.js");
  return m[1].split(" ");
}
/* the app's own name rules (lib/core.js W.norm, lib/photos.js W.slug and W.citySlug) */
const norm = s =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const slug = s => norm(s).replace(/ /g, "-").slice(0, 80) || "x";
const citySlug = (country, city) => slug(country + " " + city);
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
function notesIn(db) {
  /* data/users/<id>/libq/q/*.json: the owner's id is whatever ArtifactData resolved "me" to */
  const users = path.join(db, "data", "users"),
    out = {};
  if (!fs.existsSync(users)) return out;
  for (const u of fs.readdirSync(users)) Object.assign(out, docsIn(path.join(users, u, "libq", "q")));
  return out;
}
const answer = (lib, s, h) => {
  const e = lib[s] && lib[s].data && lib[s].data.q && lib[s].data.q[h];
  return e && e.r && typeof e.r === "object" ? e.r : null;
};
const fill = (t, country, city) => t.split("{CITY}").join(city || "").split("{COUNTRY}").join(country);

function plan(db, work, citiesN = 15, countriesN = 6) {
  const lib = docsIn(path.join(db, "citylib")),
    notes = notesIn(db),
    now = Date.now();
  const fresh = Object.entries(notes)
    .map(([h, d]) => ({ h, kind: d.data.kind, t: d.data.t, at: +d.data.at || 0 }))
    .filter(n => n.t && now - n.at < NOTE_DAYS * 864e5)
    .sort((a, b) => b.at - a.at);
  const of = kind => fresh.filter(n => n.kind === kind).slice(0, KINDS_KEPT);
  const cityQ = of("cities"),
    listQ = of("spots").concat(of("food"));
  const tasks = [];
  let countries = 0,
    cities = 0;
  if (!cityQ.length) console.log("No question for a country's towns noted yet: the owner opens the app once to note them.");
  top().forEach((code, rank) => {
    const country = countryName(code),
      cs = slug(country);
    let towns = null;
    for (const q of cityQ) {
      const r = answer(lib, cs, q.h);
      if (r && Array.isArray(r.cities)) towns = towns || r.cities;
      else if (countries < countriesN) {
        tasks.push({ kind: "cities", country, city: "", slug: cs, h: q.h, prompt: fill(q.t, country, "") });
        countries++;
      }
    }
    if (!towns || cities >= citiesN) return;
    const k = rank < 20 ? 8 : rank < 60 ? 4 : 2;
    const pick = towns
      .map((c, i) => ({ c, i }))
      .filter(x => x.c && typeof x.c.name === "string" && x.c.name && x.c.base !== 0)
      .sort((a, b) => (+b.c.pop || 0) - (+a.c.pop || 0) || a.i - b.i)
      .slice(0, k)
      .map(x => x.c.name);
    for (const city of pick) {
      if (cities >= citiesN) break;
      const s = citySlug(country, city);
      const missing = listQ.filter(q => !answer(lib, s, q.h));
      if (!missing.length) continue;
      missing.forEach(q => tasks.push({ kind: q.kind, country, city, slug: s, h: q.h, prompt: fill(q.t, country, city) }));
      cities++;
    }
  });
  fs.mkdirSync(work, { recursive: true });
  tasks.forEach((t, i) => {
    t.id = "t" + (i + 1);
    fs.writeFileSync(path.join(work, t.id + ".prompt.txt"), t.prompt);
  });
  fs.writeFileSync(path.join(work, "tasks.json"), JSON.stringify(tasks, null, 1));
  console.log(
    JSON.stringify({ tasks: tasks.length, countryLists: tasks.filter(t => t.kind === "cities").length, cities, questionsNoted: { cities: cityQ.length, lists: listQ.length } })
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

function check(db, work) {
  const lib = docsIn(path.join(db, "citylib")),
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
    return had ? { collection: "citylib", doc_id: s, op: "update", if_version: had.version, file } : { collection: "citylib", doc_id: s, op: "set", file };
  });
  fs.writeFileSync(path.join(work, "writes.json"), JSON.stringify(writes, null, 1));
  console.log(JSON.stringify(Object.assign(report, { documents: writes.length })));
}

function pack() {
  const src = fs.readFileSync(__filename, "utf8").replace("const EMBED_TOP = null;", "const EMBED_TOP = " + JSON.stringify(top()) + ";");
  process.stdout.write(src);
}

module.exports = { norm, slug, citySlug, parse, ok, plan, check };
if (require.main === module) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === "plan") plan(a, b, +c || 15, +d || 6);
  else if (cmd === "check") check(a, b);
  else if (cmd === "pack") pack();
  else {
    console.error("usage: citylib.js plan <db_dir> <work_dir> [cities] [countries] | check <db_dir> <work_dir> | pack");
    process.exit(2);
  }
}
