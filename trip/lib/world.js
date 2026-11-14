/* Waypoint's world library, the app's side (the design: the "Waypoint World Library — design" doc; the records are
   made by tools/worldlib.js, which a nightly task runs). A city with a record in world/<country-city> has its checked
   facts laid over its lists, the way lib/places.js lays the place check's records:

     opening hours   per weekday for the season of the trip's dates (it.wk, read by W.hoursFor), and a summary in the
                     shape every screen already reads (it.hours: {o, c, closed}); the dates it is always closed
                     (Christmas Day) become closures for the trip's year (it.shut, read by W.shutOn)
     entry           the price, timed entry, booking and how far ahead (it.ticket, it.book, it.lead), so the planner,
                     the To book list and the morning helper's reminders work from the official page's rules
     pins            a pin the library looked up again (the place check's can be wrong: Granada's Alhambra sat by
                     Plaza Nueva), unless a Google pin from your own search is already there
     walks           the walking times between the places of its ready-made days, from Google (W.leg reads them)

   Every fact says where it came from and when (it.wf), and the stop's details say so. Nothing here is trusted more than
   the place check: a fact the library marks unsure is not laid at all. The record is read once a session per trip city
   and kept on the phone (CACHE) for offline use; only the current trip's cities are kept. Second script. */
(function () {
  "use strict";
  var W = window.W;
  var CACHE = "waypoint-world-",
    /* a Google pin or walk may be kept 30 days (Google's terms); past that it is not used */
    G_DAYS = 30;
  var applied = /** @type {Record<string, string>} */ ({}),
    gen = 0;
  var REC = /** @type {Record<string, any>} */ ({}),
    asked = /** @type {Record<string, number>} */ ({}),
    dbP = /** @type {Promise<any> | null} */ (null);
  W.rlWorld = W.rlWorld || {};

  function db() {
    if (!dbP)
      dbP = new Promise(function (res) {
        try {
          if (window.__WP_OFFLINE || !window.claude) return res(null);
          window.claude.use("db").then(
            function (/** @type {any} */ d) {
              res(d || null);
            },
            function () {
              res(null);
            }
          );
        } catch (e) {
          /* no runtime (a test page, the phone-only version): the library is simply not there */
          res(null);
        }
      });
    return dbP;
  }
  function stored(/** @type {string} */ slug) {
    try {
      var s = localStorage.getItem(CACHE + slug);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      /* storage blocked or the copy unreadable: read from the database instead */
      return null;
    }
  }
  function keep(/** @type {string} */ slug, /** @type {any} */ rec) {
    try {
      localStorage.setItem(CACHE + slug, JSON.stringify(rec));
    } catch (e) {
      /* storage full or blocked: the record is still used this session */
    }
  }
  /** only the trip's own cities stay on the phone (v191 kept a copy of every place it ever read, and nothing cleared them) */
  function tidy() {
    var want = /** @type {Record<string, number>} */ ({});
    (W.P && W.P.days ? W.P.days : []).forEach(function (/** @type {any} */ d) {
      if (d.country && d.city) want[CACHE + W.citySlug(d.country, d.city)] = 1;
    });
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(CACHE) === 0 && !want[k]) localStorage.removeItem(k);
      }
    } catch (e) {
      /* storage blocked: there is nothing kept to tidy */
    }
  }
  /** a record as read from the database, checked for shape (it is shared data: nothing in it is trusted) */
  function clean(/** @type {any} */ x) {
    if (!x || x.v !== 1 || typeof x.places !== "object" || !x.places) return null;
    return x;
  }
  /** read a city's record once a session; the phone's copy answers first (offline, or until the read returns) */
  function load(/** @type {string} */ country, /** @type {string} */ city) {
    var slug = W.citySlug(country, city);
    if (REC[slug] !== undefined || asked[slug]) return;
    asked[slug] = 1;
    var have = clean(stored(slug));
    if (have) REC[slug] = have;
    db().then(function (d) {
      if (!d) return;
      d.doc("world/" + slug)
        .get()
        .then(
          function (/** @type {any} */ s) {
            var x = s && s.exists ? clean(W.V && W.V.shared ? W.V.shared(s.data()) : s.data()) : null;
            if (!x) {
              if (!have) REC[slug] = null;
              return;
            }
            REC[slug] = x;
            gen++;
            keep(slug, x);
            tidy();
            W.arrived(); /* (the planner and the screens take the facts in with whatever else arrives) */
          },
          function () {
            /* refused or no signal: the phone's copy, if any, stands; asked again next session */
          }
        );
    });
  }

  /* ---------- facts on a date ---------- */
  function seasonOn(/** @type {any} */ hours, /** @type {string} */ iso) {
    var md = iso.slice(5, 10);
    var z = (hours.seasons || []).filter(function (/** @type {any} */ z) {
      return z.from <= z.to ? md >= z.from && md <= z.to : md >= z.from || md <= z.to;
    })[0];
    return z || null;
  }
  /** the first date the trip is in this city (its season decides the hours), or today */
  function firstDate(/** @type {string} */ country, /** @type {string} */ city) {
    var d = ((W.P && W.P.days) || []).filter(function (/** @type {any} */ d) {
      return d.country === country && d.city === city;
    })[0];
    var dt = d && W.dateOf ? W.dateOf(d.n) : null;
    return W.isoDay(dt || new Date());
  }
  /** every date the trip spends in this city (ISO) */
  function tripDates(/** @type {string} */ country, /** @type {string} */ city) {
    return ((W.P && W.P.days) || [])
      .filter(function (/** @type {any} */ d) {
        return d.country === country && d.city === city;
      })
      .map(function (/** @type {any} */ d) {
        var dt = W.dateOf ? W.dateOf(d.n) : null;
        return dt ? W.isoDay(dt) : "";
      })
      .filter(Boolean);
  }
  function fresh(/** @type {string} */ at, /** @type {number} */ days) {
    return !!at && Date.now() - Date.parse(at) < days * 864e5;
  }
  /** "€22.27 adults, under 12 free · timed entry, book ahead" */
  function ticketText(/** @type {any} */ e) {
    var cur = e.cur === "EUR" ? "€" : e.cur === "GBP" ? "£" : e.cur === "USD" ? "$" : e.cur ? e.cur + " " : "€",
      bits = [];
    if (e.free) bits.push("Free");
    else if (e.adult != null) bits.push(cur + e.adult + " adults" + (e.child != null ? ", " + cur + e.child + " children" : ""));
    if (e.childFree) bits.push("under " + e.childFree + " free");
    var how = [e.timed ? "timed entry" : "", e.need === "required" ? "book ahead" : e.need === "advised" ? "best booked ahead" : ""]
      .filter(Boolean)
      .join(", ");
    return bits.join(", ") + (how ? (bits.length ? " · " : "") + how : "");
  }

  /** lay one city's record over its lists (lib/towns.js, after the place check's records) */
  W.applyWorld = function (/** @type {string} */ country, /** @type {string} */ city, /** @type {any} */ pool) {
    if (!pool || pool.fallback || !country || !city) return pool;
    var slug = W.citySlug(country, city);
    if (REC[slug] === undefined) load(country, city);
    var rec = REC[slug];
    if (!rec) return pool;
    var iso = firstDate(country, city),
      dates = tripDates(country, city);
    /* (W.pool calls this on every read: lay a record once per record, list and trip dates) */
    var stamp = gen + "|" + (pool.spots || []).length + "|" + (pool.food || []).length + "|" + dates.join(",");
    if (applied[slug] === stamp && pool.__world === stamp) return pool;
    var lay = function (/** @type {any[]} */ list) {
      (list || []).forEach(function (/** @type {any} */ it) {
        var p = it && it.n && rec.places[W.norm(it.n)];
        if (!p) return;
        var wf = /** @type {any} */ ({});
        if (p.hours && p.hours.seasons) {
          var z = seasonOn(p.hours, iso);
          if (z && z.wk && z.wk.length === 7) {
            it.wk = z.wk;
            var open = z.wk.filter(Boolean);
            it.hours = open.length
              ? {
                  o: Math.min.apply(
                    null,
                    open.map(function (/** @type {number[]} */ h) {
                      return h[0];
                    })
                  ),
                  c: Math.max.apply(
                    null,
                    open.map(function (/** @type {number[]} */ h) {
                      return h[1];
                    })
                  ),
                  closed: [0, 1, 2, 3, 4, 5, 6].filter(function (wd) {
                    return !z.wk[wd];
                  })
                }
              : { o: 0, c: 0, closed: [0, 1, 2, 3, 4, 5, 6] };
            wf.h = { src: p.hours.src, at: p.hours.at };
          }
          /* the dates it is always closed that fall on this trip's days here, as closures (W.shutOn reads them) */
          if (p.hours.shut && p.hours.shut.length) {
            var add = dates
              .filter(function (d) {
                return p.hours.shut.indexOf(d.slice(5, 10)) > -1;
              })
              .map(function (d) {
                return { f: d, t: d, why: "always closed that day" };
              });
            if (add.length) it.shut = W.cleanShut((it.shut || []).concat(add));
          }
        }
        if (p.entry && !p.entry.unsure) {
          it.ticket = ticketText(p.entry);
          if (p.entry.url) it.book = p.entry.url;
          if (p.entry.lead) it.lead = p.entry.lead;
          it.timed = p.entry.timed ? 1 : undefined;
          wf.e = { src: p.entry.src, at: p.entry.at };
        }
        /* a pin the library looked up again, unless a Google pin from your own search stands */
        if (p.pin && p.pinAt && (p.pinSrc !== "google" || fresh(p.pinAt, G_DAYS)) && !it.igp) {
          it.lat = p.pin[0];
          it.lng = p.pin[1];
          if (p.g) it.gid = p.g;
          if (p.pinSrc === "google") it.gpin = 1;
        }
        /* the place check's own "still open" verdict, carried in the record */
        if (p.exists && p.exists.st === "open" && it.st !== "closed") it.st = "open";
        if (wf.h || wf.e) it.wf = wf;
      });
    };
    lay(pool.spots);
    lay(pool.food);
    applied[slug] = stamp;
    Object.defineProperty(pool, "__world", { value: stamp, configurable: true, writable: true, enumerable: false });
    /* the walks between the places of its ready-made days, where Google gave them (and not past 30 days) */
    Object.keys(rec.legs || {}).forEach(function (id) {
      var l = rec.legs[id],
        ab = id.split("|"),
        a = rec.places[ab[0]],
        b = rec.places[ab[1]];
      if (!l || l.src !== "google" || !l.walk || !a || !b || !a.pin || !b.pin || !fresh(l.at, G_DAYS)) return;
      var A = { lat: a.pin[0], lng: a.pin[1] },
        B = { lat: b.pin[0], lng: b.pin[1] },
        v = [l.walk, Math.round((W.km(A, B) || 0) * 10), 0, l.at];
      W.rlWorld[W.rlKey(A, B)] = v;
      W.rlWorld[W.rlKey(B, A)] = v;
    });
    return pool;
  };

  /** the stop's checked facts, for its details: hours on that day, the entry rule, and where and when they were checked
      @param {any} it @param {any} day */
  W.worldFacts = function (it, day) {
    if (!it || !it.wf) return "";
    var wd = day && W.weekday ? W.weekday(day.n) : null,
      h = wd != null ? W.hoursFor(it, wd) : it.hours,
      lines = [];
    if (it.wf.h && h) {
      var today = wd != null && h.closed.indexOf(wd) > -1 ? "Closed that day" : W.clock(h.o) + "–" + W.clock(h.c % 1440);
      lines.push("<b>Open</b> " + W.esc(today));
    }
    if (it.wf.e && it.ticket) lines.push("<b>Entry</b> " + W.esc(it.ticket));
    var at = [it.wf.h && it.wf.h.at, it.wf.e && it.wf.e.at].filter(Boolean).sort().pop(),
      src = (it.wf.e && it.wf.e.src) || (it.wf.h && it.wf.h.src) || "";
    var host = "";
    try {
      host = new URL(src).hostname.replace(/^www\./, "");
    } catch (e) {
      /* not a web address: the line says only when */
    }
    var p = at ? at.split("-") : null;
    return (
      '<div class="wf"><p>' +
      lines.join("<br>") +
      '</p><p class="small muted">Checked ' +
      (p ? W.esc(W.fmtDate(new Date(+p[0], +p[1] - 1, +p[2]), "md")) : "") +
      (host ? " on " + W.esc(host) : "") +
      "</p></div>"
    );
  };
  /** a city's lists made from its record alone, in the shape Claude's answers take (lib/answers.js): the instant
      start for a library city before anything else has arrived @param {string} country @param {string} city */
  W.worldPool = function (country, city) {
    var rec = REC[W.citySlug(country, city)];
    if (!rec) return null;
    var spots = /** @type {any[]} */ ([]),
      food = /** @type {any[]} */ ([]);
    Object.keys(rec.places).forEach(function (k) {
      var p = rec.places[k];
      if (!p || !p.name || !p.pin) return;
      var base = { n: p.name, d: p.d || "", lat: p.pin[0], lng: p.pin[1], k: p.k || 0, fame: p.fame || 0, dur: p.dur || "" };
      if (p.kind === "food")
        food.push(Object.assign(base, { meal: p.meal || "both", cuisine: p.cuisine || "", price: p.price || "", reserve: !!p.reserve }));
      else
        spots.push(
          Object.assign(base, { s: p.s || "any", t: p.t || [], place: p.place || p.name, ticket: (p.entry && p.entry.hint) || "" })
        );
    });
    return {
      spots: spots,
      food: food,
      stay: rec.stay || [],
      transit: rec.transit || null,
      lat: rec.center ? rec.center[0] : null,
      lng: rec.center ? rec.center[1] : null
    };
  };
  /** for the tests and Settings: the records read this session */
  W.worldHave = function () {
    return Object.keys(REC).filter(function (k) {
      return !!REC[k];
    });
  };
})();
