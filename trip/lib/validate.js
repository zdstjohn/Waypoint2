/* One door for everything Claude sends back. Every answer is checked here before it reaches the lists: a name must be
   a real, short string; coordinates must be numbers on Earth, not 0,0, and within reach of the city they were asked
   for (a pin on another continent is dropped, not drawn); ratings, kid scores, tags, times of day and meals must be one
   of the values the app knows; links go through W.bookUrl. What fails a check is either dropped (the whole item, when
   it has no usable name) or cleared (one bad field), and counted in W.V.stats so a test can see the door working.
   Here: what the first screen itself uses (the fields, names that are not one place, data someone else wrote, pins).
   The shapes of Claude's answers are in lib/answers.js, which comes with the questions themselves and with the
   second script. */
(function () {
  "use strict";
  var W = (window.W = window.W || /** @type {Waypoint} */ ({})); /* loaded first: core.js adds to this same object */
  var V = (W.V = /** @type {Validators} */ ({ stats: { dropped: 0, cleared: 0, farPins: 0 } }));

  /* ---- fields ---- */
  /** @param {unknown} x @param {number} [max] @returns {string} */
  V.str = function (x, max) {
    var s = x == null ? "" : String(x).trim();
    return max ? s.slice(0, max) : s;
  };
  /** a name: a non-empty string, trimmed, at most 90 characters; null when unusable */
  V.name = function (x) {
    var s = V.str(x, 90);
    return s.length >= 2 && !/^(null|undefined|n\/a|none|unknown)$/i.test(s) && !/[<>]/.test(s) ? s : null;
  }; /* no place is named with markup */
  /** A name that is not one real place (the owner's Greece trip: "Ammoudara Beach Tavernas", "Kafeneio Santorini
   *  (Perissa bakery cafés)", "Archaeological Museum / Santorini Mega Gialos Lost Atlantis Experience", "Evening dinner
   *  in Old Town tavernas" as a thing to do). The lists drop them as they come in, and the planner never picks one from
   *  a list kept from before (you can still add one yourself). food: the name is a place to eat.
   *  @param {string} n @param {boolean} food */
  V.vague = function (n, food) {
    var s = String(n || "");
    /* two places in one ("A / B", "A or B"), or a group of them ("seafront tavernas", "the cafés on the square") */
    if (/\s\/\s|\bor\b|\b(any|various|several) of\b/i.test(s)) return true;
    if (
      /\b(tavernas|restaurants|ristoranti|trattorias|osterias|cafes|cafés|caffès|bars|eateries|stalls|stands|kiosks|bakeries|food trucks|street food)\b/i.test(
        s
      )
    )
      return true;
    /* a meal as a thing to do ("Evening dinner in the old town"): the day has its own lunch and dinner */
    if (!food && /^(evening |late |long |early )?(dinner|lunch|breakfast|brunch)\s+(in|at|on|by|near|along)\b/i.test(s)) return true;
    return false;
  };
  /** A train journey offered as a thing to do ("Scenic train ride to Sóller", "Bernina Express", "A day on the Jacobite
   *  steam train"): trains are for moving between towns, never a day's outing. A place about trains is still a place
   *  (a railway museum, a grand station, a viaduct to look at), and so is a funicular or a cable car up a hill.
   *  @param {string} n */
  V.trainRide = function (n) {
    var s = String(n || "");
    if (!/\b(trains?|railways?|railroad|rail|express)\b/i.test(s)) return false;
    if (
      /\b(museum|museo|mus[ée]e|station|market|bridge|viaduct|park|memorial|hotel|caf[eé]|restaurant|bar|pub|cemetery|trail|path|greenway)\b/i.test(
        s
      )
    )
      return false;
    return /\b(trains?|railways?|railroad|rail)\b/i.test(s) || /\bexpress\b.*\b(ride|journey|trip|line)\b/i.test(s);
  };
  /** @returns {number|null} */
  V.num = function (x) {
    var n = typeof x === "number" ? x : parseFloat(String(x));
    return isFinite(n) ? n : null;
  };
  /** a whole number within [lo, hi]; the fallback when not a number */
  V.clamp = function (x, lo, hi, dflt) {
    var n = V.num(x);
    return n == null ? dflt : Math.min(hi, Math.max(lo, Math.round(n)));
  };
  /** one of a fixed list, or the fallback */
  V.oneOf = function (x, list, dflt) {
    return list.indexOf(/** @type {any} */ (x)) > -1 ? /** @type {any} */ (x) : dflt;
  };
  /** an integer in a fixed set, or the fallback */
  V.intOf = function (x, set, dflt) {
    var n = /** @type {any} */ (Number(x));
    return x !== null && x !== "" && set.indexOf(n) > -1 ? n : dflt;
  };
  /** a web link and nothing else: http or https, no spaces or quotes. Anything else (javascript:, data:, a bare word)
      gives "". Every link drawn from data goes through this (W.safeUrl), whoever wrote the data. */
  V.web = function (x) {
    var u = typeof x === "string" ? x.trim() : "";
    return /^https?:\/\/[^\s"'<>`]+$/i.test(u) && u.length < 2000 ? u : "";
  };
  W.safeUrl = V.web;
  /* Data someone else wrote (a shared trip's plan and ideas, the nightly lists in the shared database) is not
     Claude's answer and has not been through the checks above. V.shared makes it safe to use as it is: plain data
     only, nothing deeper than 8 levels, lists no longer than 2000, text no longer than 4000 letters, and every link
     (book, menu, site, url, link, src, href, web) a web link or empty (src may also be a short label). */
  var LINK_KEYS = { book: 1, menu: 1, site: 1, url: 1, link: 1, src: 1, href: 1, web: 1 };
  /* src is a link in some records and a short label in others ("map", "Booking.com"): either, never anything else */
  function linkOr(k, v) {
    var u = V.web(v);
    return u || (k === "src" && typeof v === "string" && /^[\w .&+'-]{1,40}$/.test(v) ? v : "");
  }
  V.shared = function (x, depth) {
    depth = depth || 0;
    if (x == null || typeof x === "boolean") return x;
    if (typeof x === "number") return isFinite(x) ? x : null;
    if (typeof x === "string") return x.length > 4000 ? x.slice(0, 4000) : x;
    if (depth > 8 || typeof x !== "object") return null;
    if (Array.isArray(x))
      return x.slice(0, 2000).map(function (y) {
        return V.shared(y, depth + 1);
      });
    var o = {};
    Object.keys(x).forEach(function (k) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") return;
      o[k] = LINK_KEYS[k] && typeof x[k] !== "object" ? linkOr(k, x[k]) : V.shared(x[k], depth + 1);
    });
    return o;
  };
  /** a city's ideas as someone else wrote them: V.shared, and each list a list of named places with a pin or none
      @returns {Pool | null} */
  V.pool = function (p) {
    var o = /** @type {any} */ (V.shared(p));
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    ["spots", "food"].forEach(function (k) {
      o[k] = (Array.isArray(o[k]) ? o[k] : []).filter(function (it) {
        return it && typeof it === "object" && !Array.isArray(it) && typeof it.n === "string" && it.n.trim();
      });
      o[k].forEach(function (it) {
        it.n = it.n.trim().slice(0, 120);
        var pin = V.pin(it.lat, it.lng);
        it.lat = pin ? pin.lat : null;
        it.lng = pin ? pin.lng : null;
        if (it.t !== undefined)
          it.t = (Array.isArray(it.t) ? it.t : []).filter(function (t) {
            return typeof t === "string";
          });
        ["d", "dur", "ticket", "price", "cuisine", "place", "pic", "s", "meal"].forEach(function (f) {
          if (it[f] != null && typeof it[f] !== "string") delete it[f];
        });
      });
    });
    if (o.rest) {
      if (typeof o.rest !== "object" || Array.isArray(o.rest)) delete o.rest;
      else
        ["spots", "food"].forEach(function (k) {
          if (!Array.isArray(o.rest[k])) o.rest[k] = [];
          o.rest[k] = o.rest[k].filter(function (it) {
            return it && typeof it === "object" && typeof it.n === "string";
          });
        });
    }
    var c = V.pin(o.lat, o.lng);
    o.lat = c ? c.lat : null;
    o.lng = c ? c.lng : null;
    return o;
  };

  /* ---- coordinates ---- */
  /** a pin: both numbers, on Earth, not the 0,0 placeholder; {lat,lng} or null */
  V.pin = function (lat, lng) {
    var a = V.num(lat),
      b = V.num(lng);
    if (a == null || b == null || Math.abs(a) > 90 || Math.abs(b) > 180 || (Math.abs(a) < 0.01 && Math.abs(b) < 0.01)) return null;
    return { lat: a, lng: b };
  };
})();
