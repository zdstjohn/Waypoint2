/* One door for everything Claude sends back. Every answer is checked here before it reaches the lists: a name must be
   a real, short string; coordinates must be numbers on Earth, not 0,0, and within reach of the city they were asked
   for (a pin on another continent is dropped, not drawn); ratings, kid scores, tags, times of day and meals must be one
   of the values the app knows; links go through W.bookUrl. What fails a check is either dropped (the whole item, when
   it has no usable name) or cleared (one bad field), and counted in W.V.stats so a test can see the door working. */
(function () {
  "use strict";
  var W = window.W = window.W || /** @type {Waypoint} */ ({});   /* loaded first: core.js adds to this same object */
  var V = W.V = /** @type {Validators} */ ({ stats: { dropped: 0, cleared: 0, farPins: 0 } });

  /* ---- fields ---- */
  /** @param {unknown} x @param {number} [max] @returns {string} */
  V.str = function (x, max) { var s = x == null ? "" : String(x).trim(); return max ? s.slice(0, max) : s; };
  /** a name: a non-empty string, trimmed, at most 90 characters; null when unusable */
  V.name = function (x) { var s = V.str(x, 90); return s.length >= 2 && !/^(null|undefined|n\/a|none|unknown)$/i.test(s) ? s : null; };
  /** @returns {number|null} */
  V.num = function (x) { var n = typeof x === "number" ? x : parseFloat(String(x)); return isFinite(n) ? n : null; };
  /** a whole number within [lo, hi]; the fallback when not a number */
  V.clamp = function (x, lo, hi, dflt) { var n = V.num(x); return n == null ? dflt : Math.min(hi, Math.max(lo, Math.round(n))); };
  /** one of a fixed list, or the fallback */
  V.oneOf = function (x, list, dflt) { return list.indexOf(/** @type {any} */ (x)) > -1 ? /** @type {any} */ (x) : dflt; };
  /** an integer in a fixed set, or the fallback */
  V.intOf = function (x, set, dflt) { var n = /** @type {any} */ (Number(x)); return x !== null && x !== "" && set.indexOf(n) > -1 ? n : dflt; };
  /** 0 = hidden gem, 1 = popular, 2 = must-see; undefined when not given */
  V.fame = function (x) { return V.intOf(x, [0, 1, 2], undefined); };
  /** a review score out of 5, one decimal; undefined when not given or out of range (0 means "don't know") */
  V.rating = function (x) { var n = V.num(x); return n != null && n > 1 && n <= 5 ? Math.round(n * 10) / 10 : undefined; };
  /** interest tags: only the ones the app knows */
  V.tags = function (t) { var ok = W.TAGS || []; return (Array.isArray(t) ? t : []).filter(function (x) { return ok.indexOf(x) > -1; }); };
  /** a link: only through W.bookUrl (own sites only, https) */
  V.url = function (x) { return W.bookUrl ? W.bookUrl(x) : ""; };

  /* ---- coordinates ---- */
  /** a pin: both numbers, on Earth, not the 0,0 placeholder; {lat,lng} or null */
  V.pin = function (lat, lng) {
    var a = V.num(lat), b = V.num(lng);
    if (a == null || b == null || Math.abs(a) > 90 || Math.abs(b) > 180 || (Math.abs(a) < 0.01 && Math.abs(b) < 0.01)) return null;
    return { lat: a, lng: b };
  };
  /** a pin near a known place: within `km` of it (day trips can be 150 km out; another country is a wrong pin) */
  V.pinNear = function (lat, lng, center, km) {
    var p = V.pin(lat, lng); if (!p || !center || center.lat == null) return p;
    var d = W.km(center, p);
    if (d != null && d > (km || 250)) { V.stats.farPins++; return null; }
    return p;
  };

  /* ---- the shapes the lists are made of ---- */
  /** @type {readonly TimeOfDay[]} */ var TIMES = ["am", "pm", "eve", "any"];
  /** @type {readonly Meal[]} */ var MEALS = ["breakfast", "lunch", "dinner", "both", "all"];
  /** @type {readonly Kid[]} */ var KID = [1, 0, -1];
  /** a thing to do, as the lists keep it; null when it has no usable name. `center` (the city) checks the pin. */
  V.spot = function (x0, center) {
    if (!x0 || typeof x0 !== "object") { V.stats.dropped++; return null; }
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n); if (!n) { V.stats.dropped++; return null; }
    var p = V.pinNear(x.lat, x.lng, center); if (!p && (x.lat != null || x.lng != null)) V.stats.cleared++;
    return { n: n, d: V.str(x.d, 240), t: V.tags(x.t), k: /** @type {Kid} */ (V.intOf(x.k, KID, 0)), fame: V.fame(x.fame), rating: V.rating(x.rating),
      s: V.oneOf(x.s, TIMES, /** @type {TimeOfDay} */ ("pm")), dur: V.str(x.dur, 24), ticket: V.str(x.ticket, 80), book: V.url(x.book), bookV: 2, pic: V.str(x.pic, 24),
      place: V.str(x.place, 90), lat: p ? p.lat : null, lng: p ? p.lng : null };
  };
  /** a place to eat */
  V.food = function (x0, center, dflt) {
    dflt = dflt || {};
    if (!x0 || typeof x0 !== "object") { V.stats.dropped++; return null; }
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n); if (!n) { V.stats.dropped++; return null; }
    var p = V.pinNear(x.lat, x.lng, center); if (!p && (x.lat != null || x.lng != null)) V.stats.cleared++;
    return { n: n, d: V.str(x.d, 240), cuisine: V.str(x.cuisine, 40), price: V.str(x.price, 12), meal: V.oneOf(x.meal, MEALS, dflt.meal || /** @type {Meal} */ ("both")),
      k: /** @type {Kid} */ (V.intOf(x.k, KID, 0)), fame: V.fame(x.fame), rating: V.rating(x.rating), reserve: x.reserve === true, book: V.url(x.book), menu: V.url(x.menu),
      dur: V.str(x.dur, 24), fav: x.fav === true, pic: V.str(x.pic, 24) || dflt.pic || "", place: V.str(x.place, 90), lat: p ? p.lat : null, lng: p ? p.lng : null };
  };
  /** a destination in a country (the country list) */
  V.city = function (c0) {
    if (!c0 || typeof c0 !== "object") { V.stats.dropped++; return null; }
    var c = /** @type {Record<string, any>} */ (c0);
    var n = V.name(c.n != null ? c.n : c.name); if (!n) { V.stats.dropped++; return null; }
    var p = V.pin(c.lat, c.lng);
    return { name: n, region: V.str(c.region, 60) || "Other", lat: p ? p.lat : null, lng: p ? p.lng : null,
      w: V.clamp(c.w, 1, 4, 2), pop: V.clamp(c.pop, 1, 5, 2), t: V.tags(c.t), d: V.str(c.d, 120) };
  };
  /** a where-to-stay area */
  V.stayArea = function (x0, center) {
    if (!x0 || typeof x0 !== "object") return null;
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n); if (!n) return null;
    var p = V.pinNear(x.lat, x.lng, center, 120);
    return { n: n, d: V.str(x.d, 160), lat: p ? p.lat : null, lng: p ? p.lng : null };
  };
  /** a place to stay (lodging pick) */
  V.lodging = function (x0, center, tiers, tier) {
    if (!x0 || typeof x0 !== "object") return null;
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n), t = /** @type {Tier} */ (tier || x.tier); if (!n || tiers.indexOf(t) < 0) return null;
    var p = V.pinNear(x.lat, x.lng, center, 120);
    return { n: n, tier: t, type: V.str(x.type, 20), area: V.str(x.area, 60), d: V.str(x.d, 200), price: V.str(x.price, 24), site: V.url(x.site), lat: p ? p.lat : null, lng: p ? p.lng : null };
  };
  /** transit notes */
  V.transit = function (t0) {
    if (!t0 || typeof t0 !== "object") return null;
    var t = /** @type {Record<string, any>} */ (t0);
    var o = { system: V.str(t.system, 240), pass: V.str(t.pass, 120), airport: V.str(t.airport, 240), tip: V.str(t.tip, 200) };
    return o.system || o.airport ? o : null;
  };

  /* ---- the smaller answers ---- */
  /** opening hours as minutes since midnight: {o, c, closed:[weekdays]}, or null when unknown */
  V.hours = function (h0) {
    if (!h0 || typeof h0 !== "object") return null;
    var h = /** @type {Record<string, any>} */ (h0);
    function m(t) { var q = /^(\d{1,2})[:.]?(\d{2})?/.exec(String(t || "")); return q ? Math.min(1440, +q[1] * 60 + (+q[2] || 0)) : null; }
    var o = m(h.open), c = m(h.close);
    if (o == null || c == null) return null;
    if (c <= o) c += 1440;   /* past midnight */
    return { o: o, c: c, closed: (Array.isArray(h.closed) ? h.closed : []).map(Number).filter(function (d) { return d >= 0 && d <= 6; }) };
  };
  /** what parents need to know about a beach */
  V.beach = function (b0) {
    if (!b0 || typeof b0 !== "object") return {};
    var b = /** @type {Record<string, any>} */ (b0);
    var o = {};
    if (/^(calm|some waves|often rough)$/.test(b.calm)) o.calm = b.calm;
    if (typeof b.shallow === "boolean") o.shallow = b.shallow;
    if (/^(umbrellas|trees|little|none)$/.test(b.shade)) o.shade = b.shade;
    if (typeof b.lifeguard === "boolean") o.lifeguard = b.lifeguard;
    if (/^(sand|pebbles|mixed|rocks)$/.test(b.sand)) o.sand = b.sand;
    var w = Math.round(+b.walk); if (w >= 0 && w < 240) o.walk = w;
    if (typeof b.facilities === "boolean") o.facilities = b.facilities;
    if (b.note) o.note = V.str(b.note, 80);
    return o;
  };
  /** the place check's verdict on a place still operating */
  V.status = function (x) { return V.oneOf(x, /** @type {const} */ (["open", "closed", "unsure"]), "unsure"); };
  /** days ahead to book, 0..365 */
  V.lead = function (x) { return Math.max(0, Math.min(365, Math.round(V.num(x) || 0))); };
  /** an IANA time zone name, or "" */
  V.tz = function (x) { var z = V.str(x, 60); return /^[A-Za-z_]+\/[A-Za-z_\/-]+$/.test(z) ? z : ""; };
  /** a non-negative amount of money, or null */
  V.money = function (x) { var n = V.num(x); return n != null && n >= 0 ? n : null; };
  /** an ISO 4217 currency code, or the fallback */
  V.currency = function (x, dflt) { var c = V.str(x, 8).toUpperCase(); return /^[A-Z]{3}$/.test(c) ? c : dflt || "EUR"; };
  /** days to spend somewhere: {s, r} (sights pace, relaxed pace) or null */
  V.range = function (y0) {
    if (!y0 || typeof y0 !== "object") return null;
    var y = /** @type {Record<string, any>} */ (y0);
    var a = Math.round(V.num(y.sights) || 0), b = Math.round(V.num(y.relaxed) || 0);
    if (!(a >= 1)) return null;
    a = Math.min(14, a); return { s: a, r: Math.max(a, Math.min(21, b || a)) };
  };

  /** a list of answers, each through one validator; drops the ones that fail and duplicate names */
  V.list = function (arr, fn) {
    var out = [], seen = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      var v = fn(x); if (!v) return;
      var k = W.norm(v.n || v.name); if (seen[k]) return; seen[k] = 1; out.push(v);
    });
    return out;
  };
})();
