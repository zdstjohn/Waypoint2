#!/usr/bin/env node
/* Waypoint's world library (design: the "Waypoint World Library — design" doc). One checked record per destination,
   world/<country-city>, so a trip to a library city fills in at once, works offline, and the planner and the book-by
   list run on facts with a source and a date. This script makes the records; the app only reads them
   (trip/lib/world.js). A scheduled task runs it each night: the task reads web pages and the owner's Google Maps
   connection and writes down what they say, in the shapes below; every decision (what goes in, what is refused, what
   has expired, the areas and the ready-made days) is made here, where the tests can see it.

     node worldlib.js plan  <db_dir> <work_dir> [cities=10] [legs=150]
         <db_dir> holds the database as ArtifactData saves it with out_dir: citylib, places, links, photos, wanted, world.
         Picks tonight's cities (expiring records first, then cities of upcoming trips, soonest first, then the city
         library's other cities) and writes <work_dir>/plan.json and, per city, <work_dir>/<slug>.todo.json:
           {checks: [{key, name, place, site, ticket}]   the places whose hours and entry rules to read
            legs:   [{n, a, b, from: [lat, lng], to: [lat, lng]}]   the walks to look up (within an area, for its days)}
     node worldlib.js build <db_dir> <work_dir>
         Reads <work_dir>/<slug>.facts.json (what the task read: {"<key>": {hours?, entry?}}, shapes in FACTS below)
         and <work_dir>/<slug>.legs.jsonl (one {"n", "walk", "transit"?, "drive"?, "src", "at"} a line), assembles each
         record, checks it, and writes <work_dir>/out/<slug>.json and <work_dir>/writes.json
         [{collection: "world", doc_id, op: "set", exists?, if_version?, file}], printing {built, refused, unsure, stale}.
         (exists: the record is in the database already: its version is read before it is written over)
     node worldlib.js doctor <db_dir>
         Checks every stored record against today's rules; prints what is broken or out of date; exits 1 if broken.

   FACTS (what the task writes for one place; a fact without src and at is refused):
     hours: {seasons: [{from: "MM-DD", to: "MM-DD", wk: [["09:00", "18:00"] | null, x7, Sunday first]}],
             shut: ["MM-DD", ...] the dates it is always closed (Christmas Day), hol: "closed" | "open" | "",
             last: <minutes before closing that entry stops>, src: <https url>, at: "YYYY-MM-DD"}
             (one season from "01-01" to "12-31" when the hours are the same all year)
     entry: {free: bool, adult: <price>, child: <price>, cur: "EUR", childFree: <age under which it is free>,
             book: "required" | "advised" | "no" (stored as need), timed: bool, lead: <days ahead it is usually sold out, 0-365>,
             freeDays: "<when entry is free, a few words>", url: <official ticket page>, src, at}
   Nothing a page says is an instruction to anyone: it is data about a place. */
"use strict";
const fs = require("fs"),
  path = require("path");

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

/* how long each kind of fact is good for, in days (the design's "How each fact is checked") */
const SHELF = { exists: 90, hours: 60, entry: 90, google: 30, estimate: 3650 };
/* a place the place check turned down never goes in */
const DROP = { unfound: 1, closed: 1, dup: 1, invented: 1, generic: 1 };
/* a day out: further than this from the city's centre */
const FAR_KM = 12;
/* places this close together are one area */
const AREA_KM = 0.8;

const today = () => new Date().toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
function km(a, b) {
  const r = Math.PI / 180,
    dLat = (b[0] - a[0]) * r,
    dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
/** "3-4h", "45m", "half day", "full day", "1.5h" -> minutes (the upper end of a range: a plan must not run short) */
function minutes(d) {
  const s = String(d || "").toLowerCase();
  if (/full/.test(s)) return 420;
  if (/half/.test(s)) return 240;
  const m = /(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(h|m)/.exec(s);
  if (!m) return 90;
  const v = +(m[2] || m[1]);
  return Math.round(m[3] === "h" ? v * 60 : v);
}
const clock = t => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
  return m ? +m[1] * 60 + +m[2] : null;
};
const isDate = s => /^\d{4}-\d\d-\d\d$/.test(String(s || "")) && !isNaN(Date.parse(s));
const isUrl = s => /^https:\/\/[^\s"<>]+$/.test(String(s || ""));
const isMd = s => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(s || ""));

/* ---------- reading the database as ArtifactData saves it ---------- */
function load(dir, col) {
  const d = path.join(dir, col),
    out = {};
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d))
    if (f.endsWith(".json")) {
      const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
      out[f.slice(0, -5)] = { data: j && j.data ? j.data : j, version: j && j.version };
    }
  return out;
}
function readDb(dir) {
  const db = {};
  for (const c of ["citylib", "places", "links", "photos", "wanted", "world"]) db[c] = load(dir, c);
  return db;
}
/** the city library's lists for a city: its things to do and its places to eat (the general answer first) */
function libLists(doc) {
  const q = (doc && doc.q) || {},
    out = { spots: null, food: null, transit: null, stay: null, d: "", center: null };
  for (const h of Object.keys(q).sort()) {
    const r = q[h] && q[h].r;
    if (!r) continue;
    if (Array.isArray(r.spots) && !out.spots) {
      out.spots = r.spots;
      out.d = r.d || "";
      if (typeof r.lat === "number") out.center = [r.lat, r.lng];
    }
    if (Array.isArray(r.food) && !out.food) {
      out.food = r.food;
      out.transit = r.transit || null;
      out.stay = r.stay || null;
    }
  }
  return out;
}

/* ---------- facts ---------- */
/** a checked hours fact, or why it is refused */
function checkHours(h) {
  if (!h || typeof h !== "object") return { bad: "no hours" };
  if (!isUrl(h.src) || !isDate(h.at)) return { bad: "hours without a source page and a date" };
  const seasons = (Array.isArray(h.seasons) ? h.seasons : []).map(z => {
    if (!z || !isMd(z.from) || !isMd(z.to) || !Array.isArray(z.wk) || z.wk.length !== 7) return null;
    const wk = z.wk.map(p => {
      if (p === null) return null;
      const o = Array.isArray(p) ? clock(p[0]) : null,
        c = Array.isArray(p) ? clock(p[1]) : null;
      if (o == null || c == null) return undefined;
      return [o, c <= o ? c + 1440 : c];
    });
    return wk.some(x => x === undefined) ? null : { from: z.from, to: z.to, wk };
  });
  if (!seasons.length || seasons.some(z => !z)) return { bad: "hours not in the weekly shape" };
  const out = { seasons, src: h.src, at: h.at };
  /* dates it is always closed ("12-25") */
  const shut = (Array.isArray(h.shut) ? h.shut : []).filter(isMd);
  if (shut.length) out.shut = shut.slice(0, 12);
  if (h.hol === "closed" || h.hol === "open") out.hol = h.hol;
  const last = Math.round(+h.last || 0);
  if (last > 0 && last < 240) out.last = last;
  return { ok: out };
}
/** a checked entry fact, or why it is refused */
function checkEntry(e) {
  if (!e || typeof e !== "object") return { bad: "no entry rule" };
  if (!isUrl(e.src) || !isDate(e.at)) return { bad: "entry rule without a source page and a date" };
  const out = { src: e.src, at: e.at, free: !!e.free };
  const price = x => (typeof x === "number" && x >= 0 && x < 1000 ? Math.round(x * 100) / 100 : undefined);
  if (!out.free) {
    if (price(e.adult) !== undefined) out.adult = price(e.adult);
    if (price(e.child) !== undefined) out.child = price(e.child);
    if (/^[A-Z]{3}$/.test(e.cur || "")) out.cur = e.cur;
  }
  if (e.childFree > 0 && e.childFree < 19) out.childFree = Math.round(e.childFree);
  /* (named "need", not "book": the app reads a field called book as a link) */
  out.need = /^(required|advised|no)$/.test(e.book) ? e.book : "no";
  out.timed = !!e.timed;
  const lead = Math.round(+e.lead || 0);
  if (lead > 0 && lead <= 365) out.lead = lead;
  if (e.freeDays) out.freeDays = String(e.freeDays).slice(0, 80);
  if (isUrl(e.url)) out.url = e.url;
  return { ok: out };
}
/** a looked-up leg, or null */
function checkLeg(l) {
  if (!l || !isDate(l.at) || !l.src) return null;
  const m = x => (typeof x === "number" && x > 0 && x < 600 ? Math.round(x) : undefined);
  const out = { walk: m(l.walk), transit: m(l.transit), drive: m(l.drive), src: String(l.src).slice(0, 40), at: l.at };
  return out.walk || out.transit || out.drive ? out : null;
}
/** the season a date falls in ("MM-DD" ranges may run over New Year) */
function seasonOn(hours, date) {
  if (!hours || !hours.seasons) return null;
  const md = String(date).slice(5, 10);
  for (const z of hours.seasons) {
    const inside = z.from <= z.to ? md >= z.from && md <= z.to : md >= z.from || md <= z.to;
    if (inside) return z;
  }
  return null;
}
/** a place's hours on a date: [open, close] in minutes, null when closed, undefined when unknown */
function hoursOn(hours, date, holiday) {
  const z = seasonOn(hours, date);
  if (!z) return undefined;
  if (holiday && hours.hol === "closed") return null;
  if (hours.shut && hours.shut.includes(String(date).slice(5, 10))) return null;
  return z.wk[new Date(date + "T12:00:00Z").getUTCDay()];
}
/** what the city library's own ticket words suggest, kept only as an unsure hint ("About €19 adults, book ahead") */
function ticketHint(s) {
  const t = String(s || "");
  if (!t) return null;
  const out = { hint: t.slice(0, 80), unsure: true };
  if (/^free\b/i.test(t)) out.free = true;
  if (/book (weeks|well|days|ahead)|advance|reserv/i.test(t)) out.need = "advised";
  return out;
}

/* ---------- areas and days ---------- */
/** places grouped into areas: greedy around the best-known places, day trips apart */
function areasOf(places, center) {
  const list = Object.values(places).filter(p => p.pin),
    areas = [];
  /* things to do name the areas (the best known first); places to eat join the nearest one */
  list.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "spot" ? -1 : 1) ||
      (b.fame || 0) - (a.fame || 0) ||
      a.key.localeCompare(b.key)
  );
  for (const p of list) {
    if (center && km(center, p.pin) > FAR_KM) {
      p.area = "out-" + slug(p.key);
      areas.push({ id: p.area, name: p.name, c: p.pin, out: true, n: 1 });
      continue;
    }
    let best = null,
      bd = AREA_KM,
      bd2 = Infinity;
    for (const a of areas)
      if (!a.out) {
        const d = km(a.c, p.pin);
        if (d < bd) ((bd = d), (best = a));
      }
    if (!best && p.kind === "food") {
      for (const a of areas)
        if (!a.out) {
          const d = km(a.c, p.pin);
          if (d < 2 * AREA_KM && (!best || d < bd2)) ((best = a), (bd2 = d));
        }
    }
    if (!best) {
      best = {
        id: "a" + (areas.filter(a => !a.out).length + 1),
        name: "Around " + p.name,
        c: p.pin.slice(),
        n: 0,
        by: p.key
      };
      areas.push(best);
    }
    p.area = best.id;
    best.n++;
  }
  return areas;
}
/** ready-made days, one area each: morning, lunch, afternoon, dinner, evening (kids: only places fine with children) */
function daysOf(rec, kids) {
  const all = Object.values(rec.places),
    spots = all.filter(p => p.kind === "spot" && p.pin && (!kids || (p.k || 0) >= 0)),
    food = all.filter(p => p.kind === "food" && p.pin && (!kids || (p.k || 0) >= 0)),
    used = {},
    out = [];
  const near = (list, at, ok) =>
    list
      .filter(p => !used[p.key] && ok(p))
      .map(p => [p, km(at, p.pin)])
      .filter(x => x[1] < 2.5)
      .sort((a, b) => a[1] - b[1] || (b[0].fame || 0) - (a[0].fame || 0))
      .map(x => x[0])[0];
  /* round after round over the areas (the biggest first), a day each, until six days or no morning left */
  const areas = rec.areas.filter(a => !a.out).sort((x, y) => y.n - x.n);
  for (let round = 0, more = true; more && out.length < 6; round++) {
    more = false;
    for (const a of areas) {
      if (out.length >= 6) break;
      const here = spots.filter(p => p.area === a.id && !used[p.key]).sort((x, y) => (y.fame || 0) - (x.fame || 0));
      const am = here.find(p => p.s === "am") || here.find(p => p.s !== "eve");
      if (!am) continue;
      more = true;
      used[am.key] = 1;
      const long = minutes(am.dur) >= 180;
      const pm = near(spots, am.pin, p => p.s !== "eve" && (!long || minutes(p.dur) <= 120));
      if (pm) used[pm.key] = 1;
      const eve = near(
        spots,
        (pm || am).pin,
        p => p.s === "eve" || /stroll|walk|sunset|mirador|viewpoint/i.test(p.name)
      );
      if (eve) used[eve.key] = 1;
      const lunch = food
        .filter(p => !used[p.key] && /lunch|both|all/.test(p.meal || "both"))
        .map(p => [p, km(am.pin, p.pin) + (pm ? km(p.pin, pm.pin) : 0)])
        .filter(x => x[1] < 3)
        .sort((x, y) => x[1] - y[1] || (y[0].fame || 0) - (x[0].fame || 0))
        .map(x => x[0])[0]; /* between the morning and the afternoon, not back across town */
      if (lunch) used[lunch.key] = 1;
      const dinner = near(food, (eve || pm || am).pin, p => /dinner|both|all/.test(p.meal || "both"));
      if (dinner) used[dinner.key] = 1;
      const slots = {
        am: am.key,
        lunch: lunch && lunch.key,
        pm: pm && pm.key,
        dinner: dinner && dinner.key,
        eve: eve && eve.key
      };
      out.push({
        id: (kids ? "k" : "d") + (out.length + 1),
        area: a.id,
        title: am.name + (pm ? " and " + pm.name : ""),
        kids: !!kids,
        slots
      });
      if (pm && pm.s === "am" && am.s !== "am") ((slots.am = pm.key), (slots.pm = am.key));
    }
  }
  /* each day's weekdays: those its places with checked hours are open for their slot (none known: every day, to check) */
  /* when each part of the day starts (a morning may wait for doors that open by 11) */
  const start = { am: 570, pm: 870, eve: 1170 };
  for (const d of out) {
    d.on = [];
    d.check = [];
    for (let wd = 0; wd < 7; wd++) {
      let ok = true;
      for (const s of ["am", "pm", "eve"]) {
        const p = d.slots[s] && rec.places[d.slots[s]];
        if (!p) continue;
        if (!p.hours) {
          if (wd === 0) d.check.push(p.key);
          continue;
        }
        const z = p.hours.seasons[0];
        /* every season must have the place open at that time: a day is offered only where it always works */
        for (const zz of p.hours.seasons) {
          const h = zz.wk[wd];
          if (!h || h[0] > start[s] + (s === "am" ? 90 : 30) || h[1] - (p.hours.last || 0) < start[s] + Math.min(minutes(p.dur), 120))
            ok = false;
        }
        void z;
      }
      if (ok) d.on.push(wd);
    }
  }
  return out;
}
/** a walk estimate between two pins, marked as one (straight line x1.3 at 4.5 km/h) */
function walkEstimate(a, b) {
  return Math.max(1, Math.round((km(a, b) * 1.3 * 60) / 4.5));
}

/* ---------- assembling one record ---------- */
function assemble(sl, db, facts, legs, when) {
  const lib = libLists(db.citylib[sl] && db.citylib[sl].data),
    want = (db.wanted[sl] && db.wanted[sl].data) || {},
    checks = (db.places[sl] && db.places[sl].data && db.places[sl].data.items) || {},
    links = (db.links[sl] && db.links[sl].data && db.links[sl].data.items) || {},
    photos = (db.photos[sl] && db.photos[sl].data && db.photos[sl].data.items) || {},
    at = when || today(),
    tally = { refused: [], unsure: 0, checked: 0, dropped: [] };
  const cdoc = (db.citylib[sl] && db.citylib[sl].data) || {};
  const country = cdoc.country || want.country,
    city = cdoc.city || want.city;
  if (!country || !city || !lib.spots || !lib.food) return { err: "the city library has no lists for " + sl };
  const center = (want.center && want.center.length === 2 && want.center) || lib.center;
  const rec = {
    v: 1,
    slug: sl,
    country,
    city,
    d: lib.d,
    center,
    transit: lib.transit,
    stay: (lib.stay || []).slice(0, 4).map(s => ({ n: s.n, d: s.d, lat: s.lat, lng: s.lng })),
    built: at,
    places: {},
    areas: [],
    days: [],
    legs: {}
  };
  const take = (x, kind) => {
    const key = norm(x.n),
      chk = checks[key] || {};
    if (!key || rec.places[key]) return;
    if (DROP[chk.st]) return tally.dropped.push(x.n + " (" + chk.st + ")");
    const p = {
      key,
      kind,
      name: x.n,
      d: String(x.d || "").slice(0, 160),
      fame: x.fame || 0,
      k: x.k || 0,
      dur: x.dur || ""
    };
    if (kind === "spot")
      Object.assign(p, { s: x.s || "any", t: (x.t || []).slice(0, 4), place: chk.name || x.place || x.n });
    else
      Object.assign(p, {
        meal: x.meal || "both",
        price: x.price || "",
        cuisine: x.cuisine || "",
        reserve: !!x.reserve
      });
    /* the pin: a checked one (the place check's), else Claude's, marked */
    if (typeof chk.lat === "number" && chk.st === "open") {
      p.pin = [chk.lat, chk.lng];
      p.pinSrc = chk.gpin ? "google" : "osm"; /* (g alone is Google's ID for links: the pin may still be the map's own) */
      tally.checked++;
    } else if (typeof x.lat === "number" && x.lat) {
      p.pin = [x.lat, x.lng];
      p.pinSrc = "claude";
      p.unsure = 1;
      tally.unsure++;
    }
    if (chk.st === "open") p.exists = { st: "open", at: chk.checked || chk.oc || at };
    if (chk.g) p.g = chk.g;
    if (links[key] && isUrl(links[key].url)) p.site = links[key].url;
    if (photos[key]) p.ph = key;
    const f = (facts && facts[key]) || {};
    if (f.pin && typeof f.pin.lat === "number" && isDate(f.pin.at) && f.pin.src) {
      p.pin = [f.pin.lat, f.pin.lng];
      p.pinSrc = String(f.pin.src).slice(0, 20);
      p.pinAt = f.pin.at;
      if (f.pin.g) p.g = f.pin.g;
      delete p.unsure;
    } else if (p.pin && p.pinSrc !== "claude" && typeof x.lat === "number" && km(p.pin, [x.lat, x.lng]) > 0.8)
      p.pinFar = 1; /* the check and the library disagree: look again */
    if (f.hours) {
      const h = checkHours(f.hours);
      if (h.ok) ((p.hours = h.ok), tally.checked++);
      else tally.refused.push(x.n + ": " + h.bad);
    }
    if (f.entry) {
      const e = checkEntry(f.entry);
      if (e.ok) ((p.entry = e.ok), tally.checked++);
      else tally.refused.push(x.n + ": " + e.bad);
    }
    if (!p.entry && x.ticket) p.entry = ticketHint(x.ticket);
    if (!p.hours) tally.unsure++;
    rec.places[key] = p;
  };
  lib.spots.forEach(x => take(x, "spot"));
  lib.food.forEach(x => take(x, "food"));
  rec.areas = areasOf(rec.places, center);
  const adult = daysOf(rec, false),
    same = d => adult.some(x => JSON.stringify(x.slots) === JSON.stringify(d.slots));
  rec.days = adult.concat(daysOf(rec, true).filter(d => !same(d)));
  /* walks within each day: the looked-up ones, else estimates, marked */
  for (const d of rec.days) {
    const seq = ["am", "lunch", "pm", "dinner", "eve"].map(s => d.slots[s]).filter(Boolean);
    for (let i = 1; i < seq.length; i++) {
      const id = seq[i - 1] + "|" + seq[i],
        a = rec.places[seq[i - 1]],
        b = rec.places[seq[i]];
      if (rec.legs[id]) continue;
      const got = legs && (legs[id] || legs[seq[i] + "|" + seq[i - 1]]);
      rec.legs[id] = got
        ? checkLeg(got) || { walk: walkEstimate(a.pin, b.pin), src: "estimate", at }
        : { walk: walkEstimate(a.pin, b.pin), src: "estimate", at };
    }
  }
  for (const d of rec.days) {
    const seq = ["am", "lunch", "pm", "dinner", "eve"].map(s => d.slots[s]).filter(Boolean),
      long = [];
    for (let i = 1; i < seq.length; i++) {
      const l = rec.legs[seq[i - 1] + "|" + seq[i]];
      if (l && l.walk > 30) long.push(seq[i - 1] + "|" + seq[i]);
    }
    if (long.length) d.long = long;
  }
  const size = JSON.stringify(rec).length;
  if (size > 200 * 1024)
    return { err: sl + " is " + Math.round(size / 1024) + " KB, over the 200 KB a record may take" };
  return { rec, tally };
}

/* ---------- checking a stored record ---------- */
/** what is wrong with a record (broken) and what has expired (stale) on a date */
function doctorOne(rec, on) {
  const broken = [],
    stale = [];
  const d = on || today();
  if (!rec || rec.v !== 1 || !rec.country || !rec.city || !rec.places) return { broken: ["not a world record"], stale };
  for (const p of Object.values(rec.places)) {
    if (p.pin && (Math.abs(p.pin[0]) > 90 || Math.abs(p.pin[1]) > 180)) broken.push(p.name + ": pin out of range");
    if (p.hours) {
      if (
        !checkHours(
          Object.assign({}, p.hours, {
            seasons: p.hours.seasons.map(z => ({
              from: z.from,
              to: z.to,
              wk: z.wk.map(h => (h ? [hm(h[0]), hm(h[1] % 1440)] : null))
            }))
          })
        ).ok
      )
        broken.push(p.name + ": hours");
      else if (days(p.hours.at, d) > SHELF.hours) stale.push(p.name + ": hours from " + p.hours.at);
    }
    if (p.entry && !p.entry.unsure) {
      if (!isUrl(p.entry.src) || !isDate(p.entry.at)) broken.push(p.name + ": entry without a source");
      else if (days(p.entry.at, d) > SHELF.entry) stale.push(p.name + ": entry rule from " + p.entry.at);
    }
    if (p.exists && days(p.exists.at, d) > SHELF.exists) stale.push(p.name + ": last seen open " + p.exists.at);
  }
  for (const [id, l] of Object.entries(rec.legs || {}))
    if (l.src !== "estimate" && days(l.at, d) > SHELF.google) stale.push("walk " + id + " from " + l.at);
  for (const day of rec.days || [])
    for (const s of Object.values(day.slots))
      if (s && !rec.places[s]) broken.push("day " + day.id + " names a missing place");
  return { broken, stale };
}
function hm(m) {
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

/* ---------- the nightly steps ---------- */
function plan(dbDir, work, nCities, nLegs) {
  const db = readDb(dbDir),
    t = today(),
    pick = [];
  const ready = s => {
    const l = libLists(db.citylib[s] && db.citylib[s].data);
    return !!(l.spots && l.food);
  };
  /* 1. records with expired facts; 2. cities of upcoming trips, soonest first; 3. the library's other cities */
  for (const [s, w] of Object.entries(db.world)) if (doctorOne(w.data, t).stale.length) pick.push(s);
  const trips = Object.entries(db.wanted)
    .filter(([s, w]) => ready(s) && !db.world[s])
    .map(([s, w]) => [s, isDate(w.data.when) ? w.data.when : "9999"])
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  trips.forEach(x => pick.includes(x[0]) || pick.push(x[0]));
  Object.keys(db.citylib)
    .filter(s => s.includes("-") && ready(s) && !db.world[s])
    .sort()
    .forEach(s => pick.includes(s) || pick.push(s));
  const tonight = pick.slice(0, nCities || 10);
  fs.mkdirSync(work, { recursive: true });
  let legBudget = nLegs || 150;
  for (const s of tonight) {
    const a = assemble(s, db, {}, {});
    if (a.err) continue;
    const r = a.rec,
      old = db.world[s] && db.world[s].data;
    const checks = Object.values(r.places)
      .filter(
        p =>
          p.kind === "spot" &&
          (!old ||
            !old.places[p.key] ||
            doctorOne({ v: 1, country: 1, city: 1, places: { x: old.places[p.key] } }, t).stale.length ||
            !old.places[p.key].hours)
      )
      .sort((x, y) => (y.fame || 0) - (x.fame || 0))
      .slice(0, 16)
      .map(p => ({
        key: p.key,
        name: p.name,
        place: p.place,
        site: p.site || "",
        ticket: (p.entry && p.entry.hint) || ""
      }));
    const legs = [];
    for (const id of Object.keys(r.legs)) {
      if (legBudget <= 0) break;
      const [a, b] = id.split("|");
      legs.push({ n: legs.length + 1, a, b, from: r.places[a].pin, to: r.places[b].pin });
      legBudget--;
    }
    fs.writeFileSync(
      path.join(work, s + ".todo.json"),
      JSON.stringify({ city: r.city, country: r.country, checks, legs }, null, 1)
    );
  }
  fs.writeFileSync(path.join(work, "plan.json"), JSON.stringify({ cities: tonight, at: t }, null, 1));
  return { cities: tonight };
}
function build(dbDir, work) {
  const db = readDb(dbDir),
    p = JSON.parse(fs.readFileSync(path.join(work, "plan.json"), "utf8")),
    writes = [],
    sum = { built: [], refused: [], unsure: 0, stale: 0, failed: [] };
  fs.mkdirSync(path.join(work, "out"), { recursive: true });
  for (const s of p.cities) {
    const fp = path.join(work, s + ".facts.json"),
      lp = path.join(work, s + ".legs.jsonl");
    const facts = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : {};
    const todo = fs.existsSync(path.join(work, s + ".todo.json"))
      ? JSON.parse(fs.readFileSync(path.join(work, s + ".todo.json"), "utf8"))
      : { legs: [] };
    const legs = {};
    if (fs.existsSync(lp))
      for (const line of fs.readFileSync(lp, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const l = JSON.parse(line),
            t = todo.legs.find(x => x.n === l.n);
          if (t) legs[t.a + "|" + t.b] = l;
        } catch (e) {
          sum.refused.push(s + ": a legs line that is not JSON");
        }
      }
    /* facts kept from the stored record that are still good stay */
    const old = db.world[s] && db.world[s].data;
    if (old)
      for (const [k, op] of Object.entries(old.places || {})) {
        const f = (facts[k] = facts[k] || {});
        if (!f.hours && op.hours && days(op.hours.at, today()) <= SHELF.hours)
          f.hours = Object.assign({}, op.hours, {
            seasons: op.hours.seasons.map(z => ({
              from: z.from,
              to: z.to,
              wk: z.wk.map(h => (h ? [hm(h[0]), hm(h[1] % 1440)] : null))
            }))
          });
        if (!f.entry && op.entry && !op.entry.unsure && days(op.entry.at, today()) <= SHELF.entry) f.entry = op.entry;
      }
    const a = assemble(s, db, facts, legs);
    if (a.err) {
      sum.failed.push(a.err);
      continue;
    }
    const doc = doctorOne(a.rec);
    if (doc.broken.length) {
      sum.failed.push(s + ": " + doc.broken.join("; "));
      continue;
    }
    const file = path.join(work, "out", s + ".json");
    fs.writeFileSync(file, JSON.stringify(a.rec));
    const w = { collection: "world", doc_id: s, op: "set", file };
    if (db.world[s]) w.exists = true; /* (a write to a record that exists needs its version: the task reads it first) */
    if (db.world[s] && db.world[s].version) w.if_version = db.world[s].version;
    writes.push(w);
    sum.built.push(s);
    sum.refused.push(...a.tally.refused.map(x => s + ": " + x));
    sum.unsure += a.tally.unsure;
    sum.stale += doc.stale.length;
  }
  fs.writeFileSync(path.join(work, "writes.json"), JSON.stringify(writes, null, 1));
  return sum;
}
function doctor(dbDir) {
  const db = readDb(dbDir);
  let bad = 0,
    stale = 0,
    n = 0;
  for (const [s, w] of Object.entries(db.world)) {
    const r = doctorOne(w.data);
    n++;
    if (r.broken.length) (bad++, console.log(s, "BROKEN", r.broken.join("; ")));
    if (r.stale.length) (stale++, console.log(s, "stale", r.stale.length));
  }
  console.log(JSON.stringify({ records: n, broken: bad, stale })); /* (one line, so a quiet run still says it looked) */
  return bad;
}

if (require.main === module) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === "plan") console.log(JSON.stringify(plan(a, b, +c || 10, +d || 150)));
  else if (cmd === "build") console.log(JSON.stringify(build(a, b)));
  else if (cmd === "doctor") process.exit(doctor(a) ? 1 : 0);
  else {
    console.error("usage: node worldlib.js plan|build|doctor ...");
    process.exit(2);
  }
}
module.exports = {
  norm,
  slug,
  citySlug,
  km,
  minutes,
  checkHours,
  checkEntry,
  checkLeg,
  hoursOn,
  seasonOn,
  ticketHint,
  areasOf,
  daysOf,
  assemble,
  doctorOne,
  plan,
  build,
  readDb,
  SHELF
};
