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
    G_DAYS = 30,
    /* how long a checked fact is shown as fresh, in days; the same numbers as SHELF in tools/worldlib.js, where the nightly
       task renews what is older. Past these a stop's details say the fact may have changed. */
    HOURS_DAYS = 60,
    ENTRY_DAYS = 90;
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
  /** only the trip's own cities stay on the phone (v191 kept a copy of every place it ever read, and nothing cleared
      them), and the cities saved for offline before any trip goes there (Settings, World library: lib/photopack.js) */
  function tidy() {
    var want = /** @type {Record<string, number>} */ ({});
    (W.P && W.P.days ? W.P.days : []).forEach(function (/** @type {any} */ d) {
      if (d.country && d.city) want[CACHE + W.citySlug(d.country, d.city)] = 1;
    });
    Object.keys(W.offCities ? W.offCities() : {}).forEach(function (slug) {
      want[CACHE + slug] = 1;
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
  /** a city's document: under its id, else under the id it had before v201 (a name in another script was "x", ł ø ß
      were dropped) when only that one has it */
  function readDoc(/** @type {any} */ d, /** @type {string} */ country, /** @type {string} */ city) {
    var old = W.citySlugOld && W.citySlugOld(country, city);
    return d
      .doc("world/" + W.citySlug(country, city))
      .get()
      .then(function (/** @type {any} */ s) {
        return (s && s.exists) || !old ? s : d.doc("world/" + old).get();
      });
  }
  /** read a city's record once a session; the phone's copy answers first (offline, or until the read returns) */
  function load(/** @type {string} */ country, /** @type {string} */ city, /** @type {(() => void) | undefined} */ then) {
    var slug = W.citySlug(country, city);
    if (REC[slug] !== undefined || asked[slug]) {
      if (then) then();
      return;
    }
    asked[slug] = 1;
    var have = clean(stored(slug));
    if (have) REC[slug] = have;
    /* (whoever waits for the read is told once: when it settles, or after a moment if it never does) */
    var told = false,
      tell = function () {
        if (told) return;
        told = true;
        if (then) then();
      };
    if (have) tell();
    else setTimeout(tell, 1500);
    db().then(function (d) {
      if (!d) return tell();
      readDoc(d, country, city).then(
          function (/** @type {any} */ s) {
            var x = s && s.exists ? clean(W.V && W.V.shared ? W.V.shared(s.data()) : s.data()) : null;
            if (!x) {
              if (!have) REC[slug] = null;
              return tell();
            }
            REC[slug] = x;
            gen++;
            keep(slug, x);
            tidy();
            tell();
            W.arrived(); /* (the planner and the screens take the facts in with whatever else arrives) */
          },
          function () {
            /* refused or no signal: the phone's copy, if any, stands; asked again next session */
            tell();
          }
        );
    });
  }
  /* which cities the library holds (world/_index, written by tools/worldlib.js: { v: 1, at, cities: { <slug>:
     { n: name, c: country, p: places, at } } }): read once, so only a library city's first lists wait the moment its
     record takes to read, and Settings can list them. Kept on the phone, so the list is there with no signal. No list
     (an older library): only the cities whose records this phone already keeps. */
  var INDEX_KEY = "waypoint-worldindex-v1",
    INDEX = /** @type {Record<string, any> | null} */ (null);
  function indexOf(/** @type {any} */ x) {
    return x && x.v === 1 && x.cities && typeof x.cities === "object" ? x.cities : null;
  }
  try {
    INDEX = indexOf(JSON.parse(localStorage.getItem(INDEX_KEY) || "null"));
  } catch (e) {
    /* no copy on the phone: the list comes from the database */
  }
  /* (a city added in the moment before the list has come waits for it, a second and a half at most: indexSoon) */
  var indexKnown = !!INDEX,
    indexAsked = /** @type {Record<string, number>} */ ({}),
    indexWaits = /** @type {(() => void)[]} */ ([]);
  function indexSettled() {
    if (indexKnown) return;
    indexKnown = true;
    indexWaits.splice(0).forEach(function (fn) {
      fn();
    });
  }
  setTimeout(indexSettled, 1500);
  db().then(function (d) {
    if (!d) return indexSettled();
    d.doc("world/_index")
      .get()
      .then(
        function (/** @type {any} */ s) {
          var x = s && s.exists ? W.V.shared(s.data()) : null,
            c = indexOf(x);
          if (!c) return indexSettled();
          INDEX = c;
          indexSettled();
          try {
            localStorage.setItem(INDEX_KEY, JSON.stringify({ v: 1, cities: c }));
          } catch (e) {
            /* storage full or blocked: asked again next visit */
          }
          if (W.worldCardDraw) W.worldCardDraw(); /* (Settings, if it is open: screens/settings.js) */
        },
        function () {
          /* no list: see above */
          indexSettled();
        }
      );
  });
  /** the library's cities, by name: [{ slug, name, country, places }] (Settings, World library) */
  W.worldCities = function () {
    return Object.keys(INDEX || {})
      .map(function (slug) {
        var c = (INDEX || {})[slug] || {};
        return { slug: slug, name: String(c.n || ""), country: String(c.c || ""), places: +c.p || 0 };
      })
      .filter(function (c) {
        return c.name && c.country && W.citySlug(c.country, c.name) === c.slug;
      })
      .sort(function (a, b) {
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
  };
  /** a city's record, read now and kept on the phone (saving a city before any trip goes there: lib/photopack.js)
      @param {string} country @param {string} city @returns {Promise<any>} */
  W.worldRead = function (country, city) {
    var slug = W.citySlug(country, city);
    return db().then(function (d) {
      if (!d) return REC[slug] || clean(stored(slug));
      return readDoc(d, country, city).then(function (/** @type {any} */ s) {
          var x = s && s.exists ? clean(W.V && W.V.shared ? W.V.shared(s.data()) : s.data()) : null;
          if (!x) return null;
          REC[slug] = x;
          gen++;
          keep(slug, x);
          return x;
        });
    });
  };

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
  var MUST_TIMED = 30,
    MUST_DAYS = 14,
    ALWAYS = "always closed that day";
  function fresh(/** @type {string} */ at, /** @type {number} */ days) {
    return !!at && Date.now() - Date.parse(at) < days * 864e5;
  }
  /** a week's opening hours in the shape every screen reads: {o, c, closed} @param {any[]} wk @param {any[]} open */
  function weekHours(wk, open) {
    return open.length
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
            return !wk[wd];
          })
        }
      : { o: 0, c: 0, closed: [0, 1, 2, 3, 4, 5, 6] };
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
    /* (W.pool calls this on every read: lay a record once per record, list and trip dates. Each place is marked as it
       is laid, so one put in a list afterwards, in another's place, is seen: v198; until then a list changed without
       changing its length kept its new places without their facts) */
    /* (and after the place check's records are laid again, which set a place's pin and closures: lib/places.js) */
    var stamp = gen + "|" + (W.placesLaid || 0) + "|" + (pool.spots || []).length + "|" + (pool.food || []).length + "|" + dates.join(",");
    var laid = function (/** @type {any} */ it) {
      return !it || it.__w === stamp;
    };
    if (applied[slug] === stamp && pool.__world === stamp && (pool.spots || []).every(laid) && (pool.food || []).every(laid)) return pool;
    var lay = function (/** @type {any[]} */ list) {
      (list || []).forEach(function (/** @type {any} */ it) {
        if (it) Object.defineProperty(it, "__w", { value: stamp, configurable: true, writable: true, enumerable: false });
        var p = it && it.n && rec.places[W.norm(it.n)];
        if (!p) return;
        var wf = /** @type {any} */ ({});
        if (p.hours && p.hours.seasons) {
          var z = seasonOn(p.hours, iso);
          if (z && z.wk && z.wk.length === 7) {
            it.wk = z.wk;
            var open = z.wk.filter(Boolean);
            /* (the official page's hours win over the map's and Claude's, whichever came first: W.fact) */
            W.fact(it, "hours", weekHours(z.wk, open), "official");
            wf.h = { src: p.hours.src, at: p.hours.at };
          }
          /* the dates it is always closed that fall on this trip's days here, as closures (W.shutOn reads them) */
          if (p.hours.shut && p.hours.shut.length) {
            var add = dates
              .filter(function (d) {
                return p.hours.shut.indexOf(d.slice(5, 10)) > -1;
              })
              .map(function (d) {
                return { f: d, t: d, why: ALWAYS };
              });
            /* (laid again when the dates or the lists change: the ones laid before go first, so none is there twice) */
            var kept = (it.shut || []).filter(function (/** @type {any} */ s) {
              return s.why !== ALWAYS;
            });
            if (add.length || kept.length !== (it.shut || []).length) it.shut = W.cleanShut(kept.concat(add));
          }
        }
        if (p.entry && !p.entry.unsure) {
          W.fact(it, "ticket", ticketText(p.entry), "official");
          /* (bookV: the link is settled, so Claude is not asked for one. Until v198 it was, and its answer took the
             official ticket page's place a few seconds after the record was laid: lib/stays.js W.loadBookLinks) */
          if (p.entry.url) {
            W.fact(it, "book", p.entry.url, "official");
            it.bookV = 2;
          }
          /* how far ahead to book: what its own page says; else, where there is no entry without a booked ticket,
             the app's own rule (a month for a timed entry, two weeks otherwise), never shorter than a lead it has */
          if (p.entry.lead) W.fact(it, "lead", p.entry.lead, "official");
          else if (p.entry.need === "required") W.fact(it, "lead", Math.max(it.lead || 0, p.entry.timed ? MUST_TIMED : MUST_DAYS), "official");
          it.timed = p.entry.timed ? 1 : undefined;
          it.must = p.entry.need === "required" ? 1 : undefined; /* (To book says so: lib/bookcore.js, screens/book.js) */
          wf.e = { src: p.entry.src, at: p.entry.at };
        } else if (p.entry && p.entry.unsure && p.kind !== "food" && (p.entry.need || /[€£$]|\d/.test(p.entry.hint || ""))) {
          /* a paid or bookable place whose own page has not been read yet: its details say to look first */
          wf.q = 1;
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
        if (wf.h || wf.e || wf.q) it.wf = wf;
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
    /* known to the library, its own page not read yet: say so, plainly, and nothing else */
    if (!it.wf.h && !it.wf.e)
      return it.wf.q
        ? '<div class="wf wf-q"><p><b>Not checked yet</b> Its hours and tickets haven\'t been read from its own page. Look before you go.</p></div>'
        : "";
    var wd = day && W.weekday ? W.weekday(day.n) : null,
      h = wd != null ? W.hoursFor(it, wd) : it.hours,
      lines = [];
    if (it.wf.h && h) {
      var today = wd != null && h.closed.indexOf(wd) > -1 ? "Closed that day" : W.clock(h.o) + "–" + W.clock(h.c % 1440);
      lines.push("<b>Open</b> " + W.esc(today));
    }
    else if (it.wf.e) lines.push("<b>Hours</b> not checked yet: look on its page for your date");
    if (it.wf.e && it.ticket) lines.push("<b>Entry</b> " + W.esc(it.ticket));
    if (it.must) lines.push("<b>Tickets</b> No entry without a booked ticket");
    var hAt = it.wf.h && it.wf.h.at,
      eAt = it.wf.e && it.wf.e.at,
      at = [hAt, eAt].filter(Boolean).sort().pop(),
      src = (it.wf.e && it.wf.e.src) || (it.wf.h && it.wf.h.src) || "";
    var host = "";
    try {
      host = new URL(src).hostname.replace(/^www\./, "");
    } catch (e) {
      /* not a web address: the line says only when */
    }
    var p = at ? at.split("-") : null;
    /* the newest fact shown is past its shelf life (hours 60 days, the entry rule 90; counted from today, not from the
       trip's date; when both were read the same day it is the hours', which go first): say it may have changed */
    var old = false;
    if (p) {
      var now = new Date(),
        ago = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 864e5);
      old = ago > (hAt === at ? HOURS_DAYS : ENTRY_DAYS);
    }
    return (
      '<div class="wf' + (old ? " wf-old" : "") + '"><p>' +
      lines.join("<br>") +
      '</p><p class="small muted">Checked ' +
      (p ? W.esc(W.fmtDate(new Date(+p[0], +p[1] - 1, +p[2]), "md")) : "") +
      (host ? " on " + W.esc(host) : "") +
      (old ? " · may have changed since" : "") +
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
  /* A library city's first lists, at once (v198): where the app would ask Claude for a city's 15 things to do and 15
     places to eat (lib/ideas.js W.loadCity), a city with a record takes them from it instead: no question, no wait,
     and it works without a signal when the phone keeps the record. True when the record gives the lists (now, or in
     the moment its read takes: `again` is then called to carry on); false when the library has nothing for the city,
     and the question is asked as before. "Find more" asks Claude as it always did. */
  var firstTried = /** @type {Record<string, number>} */ ({});
  W.worldFirst = function (/** @type {string} */ country, /** @type {string} */ city, /** @type {() => void} */ again) {
    var slug = W.citySlug(country, city),
      ck = W.cityKey(country, city);
    if (REC[slug]) {
      var pool = W.worldPool(country, city);
      if (!pool || pool.spots.length < 8 || pool.food.length < 6) return false; /* (too thin to plan days from) */
      W.C.city[ck] = Object.assign(pool, { lib: 1 });
      W.libFromWorld = W.libFromWorld || {};
      W.libFromWorld[ck] = 1;
      W.dataV = (W.dataV || 0) + 1;
      W.arrived();
      return true;
    }
    if (REC[slug] === null || firstTried[slug]) return false;
    if (!(INDEX && INDEX[slug]) && !clean(stored(slug))) {
      /* not a library city as far as is known; if the library's list is still on its way, ask again when it is in */
      if (indexKnown) return false;
      if (!indexAsked[slug]) {
        indexAsked[slug] = 1;
        indexWaits.push(again);
      }
      return true;
    }
    firstTried[slug] = 1;
    load(country, city, again);
    return true;
  };
  /** a city's record as read this session, or null (the tests: test/suites/late.js) */
  W.worldRecord = function (/** @type {string} */ country, /** @type {string} */ city) {
    return REC[W.citySlug(country, city)] || null;
  };
    /** for the tests and Settings: the records read this session */
  W.worldHave = function () {
    return Object.keys(REC).filter(function (k) {
      return !!REC[k];
    });
  };
})();
