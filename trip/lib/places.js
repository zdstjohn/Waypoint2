/* Waypoint place records: what is actually known about each suggested place, checked against real sources
   (OpenStreetMap, the place's own website, recent reviews) by the audit and the nightly checker, and kept in the
   app's database under places/<country-city>. A record can fix a pin, add the official site and hours, say that a
   place has closed for good, and name a replacement. The records are laid over a city's list when it is read, so
   every screen (the planner, the map, the links) sees the checked facts without knowing where they came from. */
(function () {
  "use strict";
  var W = window.W;
  var REC = {},
    applied = {},
    gen = 0;

  /* the checked record for one place, if there is one */
  W.placeInfo = function (it, country, city) {
    var c = REC[W.slug(country + " " + city)];
    if (!c || !it || !it.n) return null;
    return c.items[W.norm(it.n)] || null;
  };

  /** a record's closures for a stretch (a renovation, the winter), made safe: [{f, t, why}] with real dates, at most
      4, or undefined @param {any} v */
  W.cleanShut = function (v) {
    if (!Array.isArray(v)) return undefined;
    var day = /^\d{4}-\d{2}-\d{2}$/;
    var out = v
      .filter(function (s) {
        return s && typeof s.f === "string" && typeof s.t === "string" && day.test(s.f) && day.test(s.t) && s.f <= s.t;
      })
      .slice(0, 4)
      .map(function (s) {
        return { f: s.f, t: s.t, why: typeof s.why === "string" ? s.why.slice(0, 40) : "" };
      });
    return out.length ? out : undefined;
  };
  /** the closure that covers trip day n, when the place is shut that day @param {any} it @param {number} n */
  W.shutOn = function (it, n) {
    if (!it || !it.shut || n == null) return null;
    var d = W.dateOf(n);
    if (!d) return null;
    var iso = W.isoDay(d);
    return (
      it.shut.filter(function (/** @type {{f: string, t: string}} */ s) {
        return s.f <= iso && iso <= s.t;
      })[0] || null
    );
  };
  /** "Closed Dec 20 – Jan 10 (winter holidays)" @param {{f: string, t: string, why: string}} s */
  W.shutText = function (s) {
    var fmt = function (/** @type {string} */ iso) {
      var p = iso.split("-");
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };
    return "Closed " + (s.f === s.t ? fmt(s.f) : fmt(s.f) + " – " + fmt(s.t)) + (s.why ? " (" + s.why + ")" : "");
  };

  /* lay the checked facts over one list: a verified pin wins over a guessed one; a place that has closed is marked so
     the planner skips it; the official site fills an empty booking or menu link; hours fill in where unknown */
  function lay(list, items, food, added, pool) {
    (list || []).forEach(function (it) {
      var r = it && it.n && items[W.norm(it.n)];
      if (!r) return;
      /* the list's own pin, kept before any record moves it, so a record that is later corrected can give it back.
         "was" is a pin an earlier check got wrong: a saved list that still carries it has no own pin to go back to. */
      if (it.g === undefined) it.g = it.lat != null && it.lng != null ? [it.lat, it.lng] : null;
      var was = r.was && r.was.length === 2 ? r.was : null,
        same = function (a, b) {
          return Math.abs(a - b) < 2e-6;
        };
      if (was && it.g && same(it.g[0], was[0]) && same(it.g[1], was[1])) it.g = null;
      /* Google's place ID opens the exact listing from every "Google Maps" link. A pin taken from Google ("gpin") may
         be kept for 30 days only, and is never drawn on the free street map. */
      it.gid = r.g || it.ig || undefined; /* (ig, igp: the ID and pin of a place you added from Google's search) */
      var gOk = !r.gpin || (r.gat && Date.now() - Date.parse(r.gat) < 30 * 864e5);
      it.gpin = r.gpin && gOk ? 1 : undefined;
      if (r.lat != null && r.lng != null && gOk) {
        it.lat = r.lat;
        it.lng = r.lng;
      } else if (r.nopin) {
        /* a guessed pin that landed far out in the water, with the real place not found yet: no pin beats a wrong one */
        it.lat = null;
        it.lng = null;
      } else {
        it.lat = it.g ? it.g[0] : null;
        it.lng = it.g ? it.g[1] : null;
        if (it.igp && it.lat != null) it.gpin = 1;
      }
      if (r.st) it.st = r.st;
      if (r.site) {
        if (food) {
          if (!it.menu) it.menu = r.site;
        } else if (!it.book) it.book = r.site;
      }
      if (r.hours && !it.hours) it.hours = r.hours;
      if (r.k != null) it.k = r.k;
      /* the meals a place really serves, where the check found the list wrong ("A dinner restaurant, not a breakfast
         café"): the planner then never puts it at breakfast */
      if (food && (r.meal === "breakfast" || r.meal === "lunch" || r.meal === "dinner" || r.meal === "both" || r.meal === "all")) {
        it.meal = r.meal;
        it.mealOk = 1; /* (checked: the planner takes it at its word, not by its name: lib/plan.js breakfastOK) */
      }
      if (r.note) it.note = r.note;
      /* shut for a stretch (the nightly "still open" check): warned on the days it covers, and kept off them */
      it.shut = W.cleanShut(r.shut);
      if (r.place) it.place = r.place;
      /* a closed place names what to go to instead: added to the list once, with its own checked facts */
      if (r.replace && r.replace.n && !added[W.norm(r.replace.n)]) {
        /* (marked "rp" so the limit on ideas on show never sets it aside: W.fitIdeas. Without the mark the two took
           turns, one adding it and the other setting it aside, and the page redrew without end. One set aside by the
           version that did that comes back) */
        var exists =
          list.filter(function (x) {
            return W.norm(x.n) === W.norm(r.replace.n);
          })[0] || (pool ? W.fromRest(pool, r.replace.n, food) : null);
        if (exists) exists.rp = 1;
        if (!exists)
          list.push(
            Object.assign(
              food
                ? { meal: it.meal || "both", cuisine: it.cuisine || "", price: it.price || "", reserve: false }
                : { t: it.t || [], s: it.s || "any", ticket: "" },
              JSON.parse(JSON.stringify(r.replace)),
              { rp: 1 }
            )
          );
        added[W.norm(r.replace.n)] = 1;
      }
    });
  }
  W.applyPlaces = function (country, city, pool) {
    if (!pool || pool.fallback) return pool;
    var slug = W.slug(country + " " + city),
      c = REC[slug];
    if (!c) return pool;
    var stamp = slug + "|" + gen + "|" + (pool.spots || []).length + "|" + (pool.food || []).length;
    if (applied[slug] === stamp) return pool;
    var added = {};
    /* the city's centre (where you stay until you pick a place) when the guessed one sits in the water */
    if (c.center && c.center.length === 2) {
      pool.lat = c.center[0];
      pool.lng = c.center[1];
    }
    lay(pool.spots, c.items, false, added, pool);
    lay(pool.food, c.items, true, added, pool);
    (pool.stay || []).forEach(function (x) {
      var r = x && x.n && c.items[W.norm(x.n)];
      if (!r) return;
      if (r.lat != null && r.lng != null) {
        x.lat = r.lat;
        x.lng = r.lng;
      } else if (r.nopin) {
        x.lat = null;
        x.lng = null;
      }
    });
    applied[slug] = slug + "|" + gen + "|" + (pool.spots || []).length + "|" + (pool.food || []).length;
    return pool;
  };

  try {
    if (window.claude && window.claude.use)
      window.claude.use("db").then(
        function (db) {
          if (!db) return;
          db.collection("places").onSnapshot(
            function (snap) {
              REC = {};
              snap.docs.forEach(function (d) {
                var x = W.V.shared(d.data()) || {};
                REC[d.id] = { items: x.items && typeof x.items === "object" ? x.items : {}, center: x.center || null };
              });
              gen++;
              applied = {};
              W.arrived(); /* (a snapshot: planned and drawn with whatever else arrives with it) */
            },
            function () {}
          );
        },
        function () {}
      );
  } catch (e) {}
})();
