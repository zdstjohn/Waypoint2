/* asks.js's questions to Claude, word for word, and what is done with each answer: only needed once Claude is
   asked, so they come after the first screen (the "ask" piece; lib/core.js W.run sends a question when it is in).
   Each entry: q = the question, ok = the answer's handler, stream = the items handed over while the answer is written;
   all three are given what the loader in lib/asks.js had at hand when it asked. */
(function () {
  "use strict";
  var W = window.W,
    X = W.ASK_X.asks,
    EVV = X.EVV,
    LEGV = X.LEGV;
  var V = W.V;
  var who = W.who;
  var centerOf = W.centerOf;
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
  W.ASKS["asks.0"] = {
    q: function (a, b, k) {
      return (
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
        " url (the company's OWN official website where tickets are sold, never a reseller or comparison site such as Ferryhopper, Direct Ferries, Openseas, Trainline, Omio, Rome2rio, Kayak or Expedia; empty if you are not sure of the exact address), book (true if it should be booked ahead), note (one short tip" + (W.party().kids.length ? " for families, e.g. which ferries have cabins or decks for kids" : ", e.g. which ferries have cabins or decks") + ")." +
        '\nReply with JSON only: {"opts":[{"mode":"ferry","from":"","to":"","dur":"","price":"","freq":"","op":"","url":"","book":false,"note":""}]}'
      );
    },
    ok: function (a, b, k) {
      return function (r) {
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
      };
    }
  };
  W.ASKS["asks.1"] = {
    q: function (city, ck, country, sig, todo) {
      return (
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
        "\nPlaces: " +
        todo
          .map(function (x) {
            return x.n + (x.cuisine ? " (" + x.cuisine + ")" : "");
          })
          .join("; ") +
        '\nReply with JSON only: {"fit":[{"n":"the name exactly as given","fit":"good","fitw":""}]}'
      );
    },
    ok: function (city, ck, country, sig, todo) {
      return function (r) {
        var by = {};
        (r && Array.isArray(r.fit) ? r.fit : []).forEach(function (x) {
          if (x && typeof x.n === "string" && /^(good|ok|poor)$/.test(x.fit))
            by[W.norm(x.n)] = {
              f: x.fit,
              w: String(x.fitw || "")
                .trim()
                .slice(0, 120),
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
      };
    }
  };
  W.ASKS["asks.2"] = {
    q: function (city, ck, country, from, known, nat, to, yr) {
      return (
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
        '\nReply with JSON only: {"events":[{"n":"","from":"","to":"","kind":"festival","closes":false,"crowds":false,"note":""}]}'
      );
    },
    ok: function (city, ck, country, from, known, nat, to, yr) {
      return function (r) {
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
      };
    }
  };
  W.ASKS["asks.3"] = {
    q: function (ages, city, ck, country, missing) {
      return (
        "Typical travel costs in " +
        city +
        ", " +
        country +
        " for this group. " +
        who() +
        " Use the local currency (cur = its ISO 4217 code) and plain numbers. breakfast, lunch, dinner = the total for the whole group for one typical meal at mid-priced places. transit = the total per day for the group getting around by public transport and the odd taxi. lodge = a typical price per night for a mid-range room or apartment that fits the group. tickets = for each place below, the total entry cost for the whole group, applying children's prices and free entry for small children (0 if free)." +
        (missing.length ? "\nPlaces: " + missing.join("; ") : "") +
        '\nReply with JSON only: {"cur":"EUR","breakfast":0,"lunch":0,"dinner":0,"transit":0,"lodge":0,"tickets":[{"n":"the name exactly as given","total":0}]}'
      );
    },
    ok: function (ages, city, ck, country, missing) {
      return function (r) {
        r = r || {};
        var c = /** @type {any} */ (W.C.cost[ck] && W.C.cost[ck].ages === ages ? W.C.cost[ck] : { ages: ages, tickets: {} });
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
      };
    }
  };
  W.ASKS["asks.4"] = {
    q: function (country) {
      return "What is the IANA time zone name for most visitors to " + country + '? Reply with JSON only: {"tz":"Europe/Rome"}';
    },
    ok: function (country) {
      return function (r) {
        var z = V.tz(r && r.tz);
        if (z) W.C.tz[country] = z;
      };
    }
  };
  W.ASKS["asks.5"] = {
    q: function (city, country, done, gk, text) {
      return (
        'Give the coordinates of this lodging or address: "' +
        text +
        '" in ' +
        city +
        ", " +
        country +
        '. If it is a hotel name, use that hotel. If unsure, use the neighborhood\'s center.\nReply with JSON only: {"lat":0,"lng":0,"label":"short name","area":"neighborhood"}'
      );
    },
    ok: function (city, country, done, gk, text) {
      return function (r) {
        var q = r && V.pinNear(r.lat, r.lng, centerOf(W.cityKey(country, city)), 120);
        if (q) {
          W.C.geo[gk] = { lat: q.lat, lng: q.lng, area: V.str(r.area, 60) };
          done(W.C.geo[gk]);
        }
      };
    }
  };
})();
