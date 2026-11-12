/* Waypoint's smaller questions to Claude: beaches, getting between two stops, food needs, what's on, what things cost,
   the time zone, where an address is. Split from lib/core.js. */
(function () {
  "use strict";
  var W = window.W,
    V = W.V,
    run = W.run,
    who = W.who,
    changed = W.changed,
    arrived = W.arrived,
    centerOf = W.centerOf;
  /* ---------- beach check ---------- */
  W.isBeach = function (x) {
    return !!x && W.picKind && W.picKind(x, false) === "beach" && !/\b(bar|club|restaurant|taverna|cafe|café|hotel|resort)\b/i.test(x.n);
  };
  /* how good a beach is for little ones: "safe", "care" or "" (unknown or in between) */
  W.beachFit = function (x) {
    var b = x && x.bch;
    if (!b || !b.calm) return "";
    var p = W.party();
    if (b.calm === "often rough" || (p.toddler && b.shallow === false) || (b.sand === "rocks" && p.toddler)) return "care";
    if (b.calm === "calm" && b.shallow !== false) return "safe";
    return "";
  };

  /* getting between two stops: train, bus, ferry, flight or car, with official operator sites */
  W.legKey = function (a, b) {
    return a.country + "|" + a.name + ">" + b.country + "|" + b.name;
  };
  /* comparison and resale sites for trains, buses and ferries: the operator's own site sells the same ticket without the extra fee */
  var LEG_RESELL =
    /(^|\.)(ferryhopper|directferries|direct-ferries|aferry|openseas|ferryscanner|ferriesingreece|greekferries|ferries-?online|rome2rio|omio|goeuro|trainline|raileurope|busbud|wanderu|bookaway|12go|kiwi|skyscanner|kayak|expedia|getbybus|virail|checkmybus)\./i;
  function legUrl(u) {
    u = W.bookUrl(u);
    if (!u) return "";
    var host = "";
    try {
      host = new URL(u).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
    return LEG_RESELL.test("." + host + ".") ? "" : u;
  }
  var LEGV = 2; /* v2: always asks about ferries */
  W.legBusy = function (a, b) {
    return W.status["leg|" + W.legKey(a, b) + "|v" + LEGV] === "loading";
  };
  W.loadLeg = function (a, b) {
    var k = W.legKey(a, b);
    W.C.legs = W.C.legs || {};
    if (W.C.legs[k] && W.C.legs[k].v === LEGV) return;
    run(
      "leg|" + k + "|v" + LEGV,
      "How should this group travel from " +
        a.name +
        ", " +
        a.country +
        " to " +
        b.name +
        ", " +
        b.country +
        "? " +
        who() +
        " Give the 2 to 5 sensible options (train, bus, ferry, flight or car), best first for this group. If a ferry or boat runs on this route or on part of it (between islands, along a coast or a lake, across a strait or a bay), always include it even when something else is faster: one option per ferry company that runs it, with the ports it sails between." +
        " For each: mode, from and to (stations, ports or airports), dur (just the journey, e.g. '1h 35m'), price (typical one-way price per adult in local currency, e.g. '€25–45'), freq (how often, e.g. 'every 30 min'; for a ferry also the months it sails if it is seasonal, e.g. '3 a day, Apr–Oct'), op (the company, e.g. 'Trenitalia / Italo', 'Blue Star Ferries')," +
        " url (the company's OWN official website where tickets are sold, never a reseller or comparison site such as Ferryhopper, Direct Ferries, Openseas, Trainline, Omio, Rome2rio, Kayak or Expedia; empty if you are not sure of the exact address), book (true if it should be booked ahead), note (one short tip for families, e.g. which ferries have cabins or decks for kids)." +
        '\nReply with JSON only: {"opts":[{"mode":"ferry","from":"","to":"","dur":"","price":"","freq":"","op":"","url":"","book":false,"note":""}]}',
      "quick",
      function (r) {
        (W.C.legs || (W.C.legs = {}))[k] = {
          v: LEGV,
          opts: ((r && r.opts) || [])
            .filter(function (o) {
              return o && o.mode;
            })
            .slice(0, 5)
            .map(function (o) {
              return {
                mode: String(o.mode).toLowerCase(),
                from: String(o.from || ""),
                to: String(o.to || ""),
                dur: String(o.dur || ""),
                price: String(o.price || ""),
                freq: String(o.freq || ""),
                op: String(o.op || ""),
                url: legUrl(o.url),
                book: o.book === true,
                note: String(o.note || "")
              };
            })
        };
      }
    );
  };

  /* real journey times from Rome2Rio (your connector), asked for on a tap: up to six ways to go, with how long each takes
     door to door and who runs it. It never books anything; the app keeps the times next to Claude's options. */
  W.checkRoutes = function (a, b) {
    var k = W.legKey(a, b),
      lg = W.C.legs && W.C.legs[k],
      sk = "r2r|" + k;
    if (!lg || W.status[sk] === "loading" || !W.callTool) return;
    W.status[sk] = "loading";
    W.r2rMsg = "";
    changed();
    W.callTool("Rome2Rio", "get-routes", { origin: a.name + ", " + a.country, destination: b.name + ", " + b.country }).then(
      function (res) {
        var p = (res && (res.payload || res.structuredContent)) || res || {};
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
            p = {};
          }
        }
        var list = (Array.isArray(p.available_routes) ? p.available_routes : [])
          .map(function (r) {
            return {
              name: String((r && r.name) || "").slice(0, 60),
              min: Math.round(+(r && r.duration)) || 0,
              carriers: (Array.isArray(r && r.carriers) ? r.carriers : []).slice(0, 3).map(function (c) {
                return String(c).slice(0, 40);
              })
            };
          })
          .filter(function (r) {
            return r.name && r.min > 0 && r.min < 72 * 60;
          })
          .slice(0, 6);
        lg.r2r = { at: Date.now(), routes: list };
        delete W.status[sk];
        arrived();
      },
      function (e) {
        W.status[sk] = "error";
        W.r2rMsg = W.mcpMsg ? W.mcpMsg(e, "Rome2Rio") : "Rome2Rio didn't answer. Try again in a minute.";
        changed();
      }
    );
  };

  /* food needs: check the places already listed once for these needs, and add a few that fit them well */
  W.loadEatFit = function (country, city) {
    var sig = W.eatSig();
    if (!sig || W.readOnly) return;
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    if (!cur || cur.fallback || !(cur.food || []).length || W.cityBusy(ck)) return;
    var todo = cur.food
      .filter(function (x) {
        return !x.eat || x.eat.sig !== sig;
      })
      .slice(0, 60);
    if (todo.length)
      run(
        "eatfit|" + ck + "|" + sig + "|" + todo.length,
        "Places to eat in " +
          city +
          ", " +
          country +
          ". " +
          who() +
          " The group's food needs: " +
          W.eatText() +
          "." +
          " For each place, how well can it feed this group? fit = good (plenty they can eat), ok (some options; tell the staff) or poor (hard to eat there: say why); fitw = one short line on what they can have or what to ask." +
          " Judge from the kind of place and its menu as far as you know it; for allergies, never promise a place is safe." +
          W.eatLikeAsk() +
          "\nPlaces: " +
          todo
            .map(function (x) {
              return x.n + (x.cuisine ? " (" + x.cuisine + ")" : "");
            })
            .join("; ") +
          '\nReply with JSON only: {"fit":[{"n":"the name exactly as given","fit":"good","fitw":""' +
          (W.eatLikeAsk() ? ',"like":0' : "") +
          "}]}",
        "quick",
        function (r) {
          var by = {};
          (r && Array.isArray(r.fit) ? r.fit : []).forEach(function (x) {
            if (x && typeof x.n === "string" && /^(good|ok|poor)$/.test(x.fit))
              by[W.norm(x.n)] = {
                f: x.fit,
                w: String(x.fitw || "")
                  .trim()
                  .slice(0, 120),
                l: W.eatLikeOf(x.like),
                sig: sig
              };
          });
          var c0 = W.C.city[ck];
          ((c0 && c0.food) || []).forEach(function (x) {
            var f = by[W.norm(x.n)];
            if (f) x.eat = f;
          });
          /* a place the answer left out counts as checked (not known either way), so it isn't asked about again */
          todo.forEach(function (x) {
            if (!x.eat || x.eat.sig !== sig) x.eat = { f: "", w: "", sig: sig };
          });
          /* what you love counts now: the meals the planner chose here are chosen again (never the ones you chose) */
          var nd = W.eatNeeds();
          if (nd && nd.love && W.freshMeals) W.freshMeals(country, city);
        }
      );
    /* no extra list of places that suit the food needs: the first list and every "Find more" are asked with them (foodAsk) */
  };

  /* regional holidays and festivals in a city for the days you're there (lib/holidays.js lays them on the days). The
     national holidays are worked out in the app and named in the question, so Claude adds only what they miss; for a
     country the app doesn't know, its national ones too. Asked once per city and dates; anything uncertain is left out. */
  var EVV = 1;
  W.loadEvents = function (country, city, from, to) {
    if (!from || !to || W.readOnly) return;
    var ck = W.cityKey(country, city),
      have = W.C.events[ck];
    if (have && have.v === EVV && have.from <= from && have.to >= to) return;
    var nat = W.holidaysBetween ? W.holidaysBetween(country, from, to) : [],
      known = W.holidaysKnown && W.holidaysKnown(country),
      yr = from.slice(0, 4);
    run(
      "events|" + ck + "|" + from + "|" + to,
      "Public holidays, festivals and big events in or near " +
        city +
        ", " +
        country +
        " between " +
        from +
        " and " +
        to +
        " (" +
        yr +
        "), for a family visiting then. " +
        who() +
        (known
          ? " The national public holidays are already known" +
            (nat.length
              ? " (" +
                nat
                  .map(function (h) {
                    return h.iso + " " + h.n;
                  })
                  .join("; ") +
                ")"
              : " (none fall in these dates)") +
            ": do not repeat them. Include regional, island or city public holidays (a patron saint's day, a region's day) that fall in these dates."
          : " Include the national public holidays that fall in these dates, and any regional or city ones.") +
        " Also festivals, fairs, processions, parades, big sporting or music events a visiting family would notice (crowds, closed streets, higher prices) or might enjoy, with their real dates in " +
        yr +
        "." +
        " Only what you are confident happens on these dates in " +
        yr +
        "; leave out anything uncertain. Up to 10." +
        " For each: n = the name in English (the local name in brackets when it helps), from and to = YYYY-MM-DD (the same for one day), kind = holiday (a public holiday: shops and offices close), festival or event," +
        " closes = true when most shops and many sights close that day, crowds = true when streets or sights get very busy, note = one short practical line for a family (what to expect, what's worth seeing, what to book)." +
        '\nReply with JSON only: {"events":[{"n":"","from":"","to":"","kind":"festival","closes":false,"crowds":false,"note":""}]}',
      "quick",
      function (r) {
        var lo = W.isoDay(new Date(new Date(from + "T12:00").getTime() - 30 * 864e5)),
          hi = W.isoDay(new Date(new Date(to + "T12:00").getTime() + 30 * 864e5)),
          D = /^\d{4}-\d{2}-\d{2}$/;
        var items = (r && Array.isArray(r.events) ? r.events : [])
          .filter(function (e) {
            return e && typeof e.n === "string" && e.n.trim() && D.test(e.from) && D.test(e.to || e.from);
          })
          .map(function (e) {
            var f = e.from,
              t = e.to || e.from;
            if (t < f) {
              var x = f;
              f = t;
              t = x;
            }
            return {
              n: e.n.trim().slice(0, 90),
              from: f,
              to: t,
              kind: /^(holiday|festival|event)$/.test(e.kind) ? e.kind : "event",
              closes: e.closes === true,
              crowds: e.crowds === true,
              note: String(e.note || "")
                .trim()
                .slice(0, 160)
            };
          })
          .filter(function (e) {
            return e.to >= from && e.from <= to && e.from >= lo && e.to <= hi;
          })
          .slice(0, 10);
        W.C.events[ck] = { v: EVV, from: from, to: to, items: items };
      }
    );
  };

  /* typical costs for the budget: meals, getting around and a mid-range room for this group, plus each paid sight's entry for the whole group */
  W.loadCosts = function (country, city) {
    var ck = W.cityKey(country, city),
      pool = W.C.city[ck];
    if (!pool || pool.fallback) return;
    var ages = W.ages().join(","),
      have = /** @type {Costs | null} */ (W.C.cost[ck]);
    if (have && have.ages !== ages) have = null;
    var paid = (pool.spots || []).filter(W.isPaid).map(function (x) {
      return x.n;
    });
    var missing = paid
      .filter(function (n) {
        return !have || !(W.norm(n) in have.tickets);
      })
      .slice(0, 40);
    if (have && !missing.length) return;
    run(
      "cost|" + ck + "|" + ages + "|" + missing.length,
      "Typical travel costs in " +
        city +
        ", " +
        country +
        " for this group. " +
        who() +
        " Use the local currency (cur = its ISO 4217 code) and plain numbers. breakfast, lunch, dinner = the total for the whole group for one typical meal at mid-priced places. transit = the total per day for the group getting around by public transport and the odd taxi. lodge = a typical price per night for a mid-range room or apartment that fits the group. tickets = for each place below, the total entry cost for the whole group, applying children's prices and free entry for small children (0 if free)." +
        (missing.length ? "\nPlaces: " + missing.join("; ") : "") +
        '\nReply with JSON only: {"cur":"EUR","breakfast":0,"lunch":0,"dinner":0,"transit":0,"lodge":0,"tickets":[{"n":"the name exactly as given","total":0}]}',
      "quick",
      function (r) {
        r = r || {};
        var c = W.C.cost[ck] && W.C.cost[ck].ages === ages ? W.C.cost[ck] : { ages: ages, tickets: {} };
        if (!c.cur) {
          c.cur = V.currency(r.cur, "EUR");
          ["breakfast", "lunch", "dinner", "transit", "lodge"].forEach(function (k) {
            c[k] = V.money(r[k]);
          });
        }
        var got = {};
        (Array.isArray(r.tickets) ? r.tickets : []).forEach(function (t) {
          if (t && t.n) got[W.norm(t.n)] = V.money(t.total);
        });
        missing.forEach(function (nm) {
          var k = W.norm(nm);
          c.tickets[k] = k in got ? got[k] : null;
        });
        W.C.cost[ck] = c;
      }
    );
  };
  /* the time zone of a country, for calendar events (a short list is built in; anything else asks Claude once) */
  W.loadTz = function (country) {
    if (W.C.tz[country]) return;
    run(
      "tz|" + country,
      "What is the IANA time zone name for most visitors to " + country + '? Reply with JSON only: {"tz":"Europe/Rome"}',
      "quick",
      function (r) {
        var z = V.tz(r && r.tz);
        if (z) W.C.tz[country] = z;
      }
    );
  };

  /* find coordinates for a hotel or address */
  W.geocode = function (country, city, text, done) {
    var gk = W.cityKey(country, city) + "|" + W.norm(text);
    if (W.C.geo[gk]) return done(W.C.geo[gk]);
    var m = text.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
    if (m) return done({ lat: +m[1], lng: +m[3] });
    run(
      "geo|" + gk,
      'Give the coordinates of this lodging or address: "' +
        text +
        '" in ' +
        city +
        ", " +
        country +
        '. If it is a hotel name, use that hotel. If unsure, use the neighborhood\'s center.\nReply with JSON only: {"lat":0,"lng":0,"label":"short name","area":"neighborhood"}',
      "quick",
      function (r) {
        var q = r && V.pinNear(r.lat, r.lng, centerOf(W.cityKey(country, city)), 120);
        if (q) {
          W.C.geo[gk] = { lat: q.lat, lng: q.lng, area: V.str(r.area, 60) };
          done(W.C.geo[gk]);
        }
      }
    );
  };
})();
