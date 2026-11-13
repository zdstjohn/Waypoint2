/* The rest of the one door for Claude's answers (lib/validate.js has what the first screen itself uses): the shapes
   the lists are made of (a thing to do, a place to eat, a city, a stay, a journey), the smaller answers, the own-site
   rule for a booking link, and reading a list out of an answer that is still being written. None of it is needed
   before an answer has come or a list written by someone else is read, so it is not in the first script. It rides
   in two files (build/bundle.js BOTH), whichever is in first: with the questions (the "ask" piece, so an answer is
   never kept waiting for the second script) and in the second script (whose nightly lists, searches and prices use
   it, also in an offline copy, which has no "ask" piece). Running it twice only says the same things again. */
(function () {
  "use strict";
  var W = window.W,
    V = W.V;
  /** 0 = hidden gem, 1 = popular, 2 = must-see; undefined when not given */
  V.fame = function (x) {
    return V.intOf(x, [0, 1, 2], undefined);
  };
  /** a review score out of 5, one decimal; undefined when not given or out of range (0 means "don't know") */
  V.rating = function (x) {
    var n = V.num(x);
    return n != null && n > 1 && n <= 5 ? Math.round(n * 10) / 10 : undefined;
  };
  /** interest tags: only the ones the app knows */
  V.tags = function (t) {
    var ok = W.TAGS || [];
    return (Array.isArray(t) ? t : []).filter(function (x) {
      return ok.indexOf(x) > -1;
    });
  };
  /** a link: only through W.bookUrl (own sites only, https) */
  V.url = function (x) {
    return W.bookUrl ? W.bookUrl(x) : "";
  };
  /** a pin near a known place: within `km` of it (day trips can be 150 km out; another country is a wrong pin) */
  V.pinNear = function (lat, lng, center, km) {
    var p = V.pin(lat, lng);
    if (!p || !center || center.lat == null) return p;
    var d = W.km(center, p);
    if (d != null && d > (km || 250)) {
      V.stats.farPins++;
      return null;
    }
    return p;
  };

  /** A link that three or more different places in one list share is no one place's page (a search, a reseller's
      front page, one museum's tickets handed to every sight): it is cleared on all of them, so none of them sends a
      family to the wrong ticket office. Two may share one, as a combined ticket does (Colosseum, Forum and Palatine).
      Compared without the query, so "tickets?1" and "tickets?2" are one page. @template T @param {T[]} list
      @param {string} key @returns {T[]} */
  V.oneEach = function (list, key) {
    /** @type {Record<string, any[]>} */ var by = {};
    list.forEach(function (x) {
      var u = x && /** @type {any} */ (x)[key];
      if (!u) return;
      var k = String(u)
        .toLowerCase()
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/[?#].*$/, "")
        .replace(/\/+$/, "");
      (by[k] = by[k] || []).push(x);
    });
    Object.keys(by).forEach(function (k) {
      /** @type {Record<string, number>} */ var names = {};
      by[k].forEach(function (x) {
        names[String(x.n).toLowerCase()] = 1;
      });
      if (Object.keys(names).length >= 3)
        by[k].forEach(function (x) {
          x[key] = "";
          V.stats.cleared++;
        });
    });
    return list;
  };

  /* ---- the shapes the lists are made of ---- */
  /** @type {readonly TimeOfDay[]} */ var TIMES = ["am", "pm", "eve", "any"];
  /** @type {readonly Meal[]} */ var MEALS = ["breakfast", "lunch", "dinner", "both", "all"];
  /** @type {readonly Kid[]} */ var KID = [1, 0, -1];
  /** a thing to do, as the lists keep it; null when it has no usable name. `center` (the city) checks the pin. */
  V.spot = function (x0, center) {
    if (!x0 || typeof x0 !== "object") {
      V.stats.dropped++;
      return null;
    }
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n);
    if (!n || V.vague(n, false) || V.trainRide(n)) {
      V.stats.dropped++;
      return null;
    }
    var p = V.pinNear(x.lat, x.lng, center);
    if (!p && (x.lat != null || x.lng != null)) V.stats.cleared++;
    return {
      n: n,
      d: V.str(x.d, 240),
      t: V.tags(x.t),
      k: /** @type {Kid} */ (V.intOf(x.k, KID, 0)),
      fame: V.fame(x.fame),
      rating: V.rating(x.rating),
      s: V.oneOf(x.s, TIMES, /** @type {TimeOfDay} */ ("pm")),
      dur: V.str(x.dur, 24),
      ticket: V.str(x.ticket, 80),
      book: V.url(x.book),
      bookV: x.book === undefined ? undefined : 2,
      pic: V.str(x.pic, 24),
      place: V.str(x.place, 90),
      lat: p ? p.lat : null,
      lng: p ? p.lng : null
    };
  };
  /** a place to eat */
  V.food = function (x0, center, dflt) {
    dflt = dflt || {};
    if (!x0 || typeof x0 !== "object") {
      V.stats.dropped++;
      return null;
    }
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n);
    if (!n || V.vague(n, true)) {
      V.stats.dropped++;
      return null;
    }
    var p = V.pinNear(x.lat, x.lng, center);
    if (!p && (x.lat != null || x.lng != null)) V.stats.cleared++;
    /* links the answer was not asked for stay open (undefined), so the later check of this place asks for them */
    var o = /** @type {Food} */ ({
      n: n,
      d: V.str(x.d, 240),
      cuisine: V.str(x.cuisine, 40),
      price: V.str(x.price, 12),
      meal: V.oneOf(x.meal, MEALS, dflt.meal || /** @type {Meal} */ ("both")),
      k: /** @type {Kid} */ (V.intOf(x.k, KID, 0)),
      fame: V.fame(x.fame),
      rating: V.rating(x.rating),
      reserve: x.reserve === true,
      book: x.book === undefined ? /** @type {any} */ (undefined) : V.url(x.book),
      menu: x.menu === undefined ? /** @type {any} */ (undefined) : V.url(x.menu),
      dur: V.str(x.dur, 24),
      fav: x.fav === true,
      pic: V.str(x.pic, 24) || dflt.pic || "",
      place: V.str(x.place, 90),
      lat: p ? p.lat : null,
      lng: p ? p.lng : null,
      fit: V.oneOf(x.fit, ["good", "ok", "poor"], ""),
      fitw: V.str(x.fitw, 120),
      like: x.like === 2 || x.like === "2" ? 2 : x.like === 1 || x.like === "1" ? 1 : 0
    });
    /* a place the answer itself was not sure exists (sure: false) starts as "not checked yet": the day warns, the
       planner picks it last, and the nightly check of places (lib/places.js) settles it either way */
    if (x.sure === false) o.st = "unverified";
    return o;
  };
  /** a destination in a country (the country list) */
  V.city = function (c0) {
    if (!c0 || typeof c0 !== "object") {
      V.stats.dropped++;
      return null;
    }
    var c = /** @type {Record<string, any>} */ (c0);
    var n = V.name(c.n != null ? c.n : c.name);
    if (!n) {
      V.stats.dropped++;
      return null;
    }
    var p = V.pin(c.lat, c.lng);
    var o = /** @type {BuiltCity} */ ({
      name: n,
      region: V.str(c.region, 60) || "Other",
      lat: p ? p.lat : null,
      lng: p ? p.lng : null,
      w: V.clamp(c.w, 1, 4, 2),
      pop: V.clamp(c.pop, 1, 5, 2),
      t: V.tags(c.t),
      d: V.str(c.d, 120)
    });
    /* the island it is on, when it is on one */
    var isl = V.str(c.isl, 60);
    if (isl) o.isl = isl;
    /* a day trip, not a place to stay (a national park, a single sight, a village with nowhere to eat) */
    if (c.base === 0 || c.base === "0" || c.base === false) o.day = 1;
    else if (c.base === 1 || c.base === "1" || c.base === true) o.stay = 1; /* (a city whose name sounds like scenery: Gold Coast) */
    return o;
  };
  /** a where-to-stay area */
  V.stayArea = function (x0, center) {
    if (!x0 || typeof x0 !== "object") return null;
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n);
    if (!n) return null;
    var p = V.pinNear(x.lat, x.lng, center, 120);
    return { n: n, d: V.str(x.d, 160), lat: p ? p.lat : null, lng: p ? p.lng : null };
  };
  /** a place to stay (lodging pick) */
  V.lodging = function (x0, center, tiers, tier) {
    if (!x0 || typeof x0 !== "object") return null;
    var x = /** @type {Record<string, any>} */ (x0);
    var n = V.name(x.n),
      t = /** @type {Tier} */ (tier || x.tier);
    if (!n || tiers.indexOf(t) < 0) return null;
    var p = V.pinNear(x.lat, x.lng, center, 120);
    return {
      n: n,
      tier: t,
      type: V.str(x.type, 20),
      area: V.str(x.area, 60),
      d: V.str(x.d, 200),
      price: V.str(x.price, 24),
      site: V.url(x.site),
      lat: p ? p.lat : null,
      lng: p ? p.lng : null
    };
  };
  /** a place to stay from Booking.com's search (v175): its name, its page on Booking.com itself, its price for the whole
   *  stay and a night, its rating and its pin near the town; anything without a price or with a page elsewhere is dropped
   *  @param {unknown} a0 @param {LatLng | null} center @param {number} nights @returns {LiveLodging | null} */
  V.bkStay = function (a0, center, nights) {
    if (!a0 || typeof a0 !== "object") return null;
    var a = /** @type {Record<string, any>} */ (a0),
      n = V.name(a.name),
      pr = a.price || {},
      total = V.money(pr.book) || 0,
      url = V.web(a.url); /* (not V.url: that one keeps booking sites out, and this is one on purpose) */
    if (!n || !(total > 0) || !(nights > 0) || !/^https:\/\/([a-z0-9-]+\.)*booking\.com\//i.test(url)) return null;
    var loc = a.location || {},
      co = loc.coordinates || {},
      rt = a.rating || {},
      p = V.pinNear(+co.latitude, +co.longitude, center, 120),
      score = +rt.review_score,
      stars = +rt.stars;
    return {
      n: n,
      url: url,
      total: total,
      night: Math.round(total / nights),
      cur: V.currency(pr.currency, "EUR"),
      type: V.str(a.accommodationType, 30),
      area: V.str(loc.district_name, 60),
      score: score > 0 && score <= 10 ? Math.round(score * 10) / 10 : 0,
      reviews: Math.max(0, Math.round(+rt.number_of_reviews || 0)),
      stars: stars > 0 && stars <= 5 ? Math.round(stars) : 0,
      lat: p ? p.lat : null,
      lng: p ? p.lng : null
    };
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
    function m(t) {
      var q = /^(\d{1,2})[:.]?(\d{2})?/.exec(String(t || ""));
      return q ? Math.min(1440, +q[1] * 60 + (+q[2] || 0)) : null;
    }
    var o = m(h.open),
      c = m(h.close);
    if (o == null || c == null) return null;
    if (c <= o) c += 1440; /* past midnight */
    return {
      o: o,
      c: c,
      closed: (Array.isArray(h.closed) ? h.closed : []).map(Number).filter(function (d) {
        return d >= 0 && d <= 6;
      })
    };
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
    var w = Math.round(+b.walk);
    if (w >= 0 && w < 240) o.walk = w;
    if (typeof b.facilities === "boolean") o.facilities = b.facilities;
    if (b.note) o.note = V.str(b.note, 80);
    return o;
  };
  /** the place check's verdict on a place still operating */
  V.status = function (x) {
    return V.oneOf(x, /** @type {const} */ (["open", "closed", "unsure"]), "unsure");
  };
  /** days ahead to book, 0..365 */
  V.lead = function (x) {
    return Math.max(0, Math.min(365, Math.round(V.num(x) || 0)));
  };
  /** an IANA time zone name, or "" */
  V.tz = function (x) {
    var z = V.str(x, 60);
    return /^[A-Za-z_]+\/[A-Za-z_\/-]+$/.test(z) ? z : "";
  };
  /** a non-negative amount of money, or null */
  V.money = function (x) {
    var n = V.num(x);
    return n != null && n >= 0 ? n : null;
  };
  /** an ISO 4217 currency code, or the fallback */
  V.currency = function (x, dflt) {
    var c = V.str(x, 8).toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : dflt || "EUR";
  };
  /** days to spend somewhere: {s, r} (sights pace, relaxed pace) or null */
  V.range = function (y0) {
    if (!y0 || typeof y0 !== "object") return null;
    var y = /** @type {Record<string, any>} */ (y0);
    var a = Math.round(V.num(y.sights) || 0),
      b = Math.round(V.num(y.relaxed) || 0);
    if (!(a >= 1)) return null;
    a = Math.min(14, a);
    return { s: a, r: Math.max(a, Math.min(21, b || a)) };
  };

  /** a list of answers, each through one validator; drops the ones that fail and duplicate names */
  V.list = function (arr, fn) {
    var out = [],
      seen = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      var v = fn(x);
      if (!v) return;
      var k = W.norm(v.n || v.name);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(v);
    });
    return out;
  };
  /* booking links: only the place's own site. Never a search page, a reseller, or a look-alike "tickets" site that adds fees */
  var RESELLERS =
    /(^|\.)(google|bing|duckduckgo|yahoo|getyourguide|viator|tiqets|klook|headout|musement|civitatis|tripadvisor|expedia|booking|hotels|isango|ceetiz|tourradar|golden-?tours|city-?sightseeing|veltra|kkday|trip|agoda|groupon|tickets?(?:\.com|\.net|\.org)|stubhub|viagogo|seatgeek|vivid ?seats|ticketnetwork|ticketsales|tickettoride)\./i;
  W.bookUrl = function (u0) {
    var u = String(u0 || "").trim();
    if (!/^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u)) return "";
    var host = "";
    try {
      host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    } catch (e) {
      return "";
    }
    var parts = host.split("."),
      reg = parts.slice(-2).join(".");
    if (/^(co|com|org|gov|ac|net)\.[a-z]{2}$/.test(reg) && parts.length > 2) reg = parts.slice(-3).join(".");
    if (RESELLERS.test("." + reg + ".")) return ""; /* judged on the site itself, so booking.museum.it style official subdomains pass */
    /* third-party sites that mimic official ones: colosseumtickets.com, rome-skip-the-line.com, sagradafamiliatours.net … */
    if (/(tickets?|tours?|skip-?the-?line|fast-?track|guided)/i.test(reg.split(".")[0])) return "";
    return u.replace(/^http:/i, "https:");
  };
  /* The items of a list in an answer that is still being written: text = the answer so far, key = the list's name in
     the JSON ("spots"), from = where the last call stopped. Gives the items completed since then, where to go on from,
     and (head) the plain fields written before the list, such as the city's pin. A half-written item waits for its end. */
  W.partialList = function (text, key, from) {
    var start = from || 0,
      head = /** @type {any} */ (null);
    if (!start) {
      var m = new RegExp('"' + key + '"\\s*:\\s*\\[').exec(text);
      if (!m) return { items: [], next: 0, head: null };
      start = m.index + m[0].length;
      head = {};
      var pre = text.slice(0, m.index),
        la = /"lat"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(pre),
        lo = /"lng"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(pre),
        d = /"d"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(pre);
      if (la && lo) {
        head.lat = +la[1];
        head.lng = +lo[1];
      }
      if (d) {
        try {
          head.d = JSON.parse(d[1]);
        } catch (e) {}
      }
    }
    var items = [],
      depth = 0,
      inStr = false,
      esc = false,
      obj = -1,
      next = start;
    for (var i = start; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") {
        if (depth === 0) obj = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && obj >= 0) {
          try {
            items.push(JSON.parse(text.slice(obj, i + 1)));
          } catch (e) {}
          next = i + 1;
          obj = -1;
        }
      } else if (ch === "]" && depth === 0) {
        next = i;
        break;
      } /* the list is complete */
    }
    return { items: items, next: next, head: head };
  };
})();
