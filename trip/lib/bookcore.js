/* Waypoint bookings, the part every screen needs: your bookings and ticks, money, which booking belongs to a stop or a
   day and the "book by" checklist (the next-step bar and the readiness ring read them on the first screen).
   The budget and the "Prices in" choice (lib/budget.js) and the Prepare screen itself (screens/book.js: Gmail import,
   calendar export, the PDF, the lists) come with the second script. */
(function () {
  "use strict";
  var W = window.W,
    $ = W.$,
    esc = W.esc,
    S = W.S;
  var link = W.extLink;
  function bookings() {
    return S.bookings || (S.bookings = []);
  }
  function ticks() {
    return S.booked || (S.booked = {});
  }
  function fmtDay(d, o) {
    return W.fmtDate(d, o || "wmd");
  }

  /* ---------- the currency costs are shown in ----------
     Each phone chooses (Prepare and Settings: "Prices in"): as listed (each price in its own currency), or one currency
     for everything, converted at the European Central Bank's daily rates (the database's fx/latest, refreshed nightly)
     and marked "≈". A currency with no rate stays as listed. */
  var FX = { base: "EUR", rates: null, date: "" };
  try {
    if (window.claude && window.claude.use)
      window.claude.use("db").then(
        function (db) {
          /* rates change what prices read, not what's planned: a redraw, and only when they changed */
          if (db)
            db.doc("fx/latest").onSnapshot(
              function (s) {
                var d = s && s.exists && s.data();
                if (d && d.rates && typeof d.rates === "object") {
                  var nx = { base: String(d.base || "EUR"), rates: d.rates, date: String(d.date || "") };
                  if (JSON.stringify(nx) === JSON.stringify(FX)) return;
                  FX = nx;
                  if (W.render) W.render();
                }
              },
              function () {}
            );
        },
        function () {}
      );
  } catch (e) {
    W.caught(e, "exchange rates");
  }
  W.fxDate = function () {
    return FX.rates ? FX.date : "";
  };
  W.fxRate = function (from, to) {
    if (!from || !to) return null;
    if (from === to) return 1;
    var r = FX.rates;
    if (!r) return null;
    var a = from === FX.base ? 1 : +r[from],
      b = to === FX.base ? 1 : +r[to];
    return a > 0 && b > 0 ? b / a : null;
  };
  var COUNTRY_CUR = {
    "United States": "USD",
    "United Kingdom": "GBP",
    Switzerland: "CHF",
    Japan: "JPY",
    Mexico: "MXN",
    Canada: "CAD",
    Australia: "AUD",
    "New Zealand": "NZD",
    Thailand: "THB",
    Turkey: "TRY",
    Iceland: "ISK",
    Czechia: "CZK",
    Hungary: "HUF",
    Poland: "PLN",
    Denmark: "DKK",
    Sweden: "SEK",
    Norway: "NOK",
    Brazil: "BRL",
    India: "INR",
    Singapore: "SGD",
    "Hong Kong": "HKD",
    "South Korea": "KRW",
    China: "CNY",
    "South Africa": "ZAR",
    Israel: "ILS",
    Indonesia: "IDR",
    Philippines: "PHP",
    Malaysia: "MYR",
    Romania: "RON"
  };
  var EURO_C = [
    "Spain",
    "Portugal",
    "Italy",
    "France",
    "Germany",
    "Netherlands",
    "Belgium",
    "Austria",
    "Greece",
    "Ireland",
    "Finland",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Slovenia",
    "Slovakia",
    "Croatia",
    "Malta",
    "Cyprus",
    "Luxembourg",
    "Monaco",
    "Montenegro",
    "Bulgaria"
  ];
  W.curOf = function (country) {
    return COUNTRY_CUR[country] || (EURO_C.indexOf(country) > -1 ? "EUR" : "");
  };
  W.curView = function () {
    try {
      var c = localStorage.getItem("waypoint-cur") || "";
      return /^[A-Z]{3}$/.test(c) ? c : "";
    } catch (e) {
      return "";
    }
  };
  W.setCurView = function (c) {
    try {
      if (c) localStorage.setItem("waypoint-cur", c);
      else localStorage.removeItem("waypoint-cur");
    } catch (e) {}
    W.changed();
  };
  function fmt(n, cur) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR", maximumFractionDigits: 0 }).format(
        Math.round(n)
      );
    } catch (e) {
      return (cur || "") + " " + Math.round(n);
    }
  }
  /** A chosen stay's Booking.com price, while it is still for the nights it was found for: change the dates or the
   *  nights and it was the price of other nights (the place is still yours; the price is asked for again)
   *  @param {Stay | undefined} st @param {Stop} s @param {Plan} P */
  function liveOf(st, s, P) {
    var L = st && st.live,
      dt = L && L.total && L.in && W.stayDates ? W.stayDates(s, P) : null;
    return L && L.total && (!L.in || (dt && dt.in === L.in && dt.out === L.out)) ? L : null;
  }
  W.stayLive = liveOf;
  /* an amount, in the currency you chose to see (≈ when converted), else as given; raw = always as given */
  W.money = function (n, cur, raw) {
    var c = cur || "EUR",
      v = !raw && W.curView();
    if (v && v !== c) {
      var k = W.fxRate(c, v);
      if (k) return "≈" + fmt(n * k, v);
    }
    return fmt(n, c);
  };
  /* prices written in text ("€15, book ahead", "£8–12", "USD 20"), converted the same way */
  var CUR_SYM = {
    "€": "EUR",
    "£": "GBP",
    "US$": "USD",
    "A$": "AUD",
    "C$": "CAD",
    "NZ$": "NZD",
    "¥": "JPY",
    "₹": "INR",
    "₺": "TRY",
    "kr": "",
    "CHF": "CHF"
  };
  W.priceText = function (s, local) {
    var v = W.curView();
    s = s == null ? "" : String(s);
    if (!v || !s) return s;
    return s.replace(
      /(US\$|A\$|C\$|NZ\$|€|£|¥|₹|₺|\$|\b(?:EUR|USD|GBP|CHF|JPY|CAD|AUD|MXN|TRY|SEK|NOK|DKK|CZK|HUF|PLN|THB|ISK|INR)\b)\s?(\d+(?:[.,]\d+)*)(?:\s?[–-]\s?(\d+(?:[.,]\d+)*))?/g,
      function (m, sym, a, b) {
        var c = CUR_SYM[sym] || (sym === "$" ? (local && /^(USD|MXN|CAD|AUD|NZD|SGD|HKD)$/.test(local) ? local : "USD") : sym);
        if (!c || c === v) return m;
        var k = W.fxRate(c, v);
        if (!k) return m;
        var num = function (x) {
            return Number(String(x).replace(/,/g, ""));
          },
          A = num(a),
          B = b != null ? num(b) : null;
        if (!(A >= 0)) return m;
        return B != null ? "≈" + fmt(A * k, v) + "–" + fmt(B * k, v).replace(/^[^\d]*/, "") : "≈" + fmt(A * k, v);
      }
    );
  };
  function add(bag, cur, n) {
    if (!(n > 0)) return;
    cur = cur || "?";
    bag[cur] = (bag[cur] || 0) + n;
  }
  function sumText(bag) {
    var k = Object.keys(bag);
    return k.length
      ? k
          .map(function (c) {
            return c === "?" ? Math.round(bag[c]) + "" : W.money(bag[c], c);
          })
          .join(" + ")
      : "—";
  }

  /* ---------- matching bookings to the trip ---------- */
  var STOP = {
    the: 1,
    and: 1,
    of: 1,
    di: 1,
    del: 1,
    della: 1,
    dei: 1,
    delle: 1,
    la: 1,
    le: 1,
    il: 1,
    lo: 1,
    de: 1,
    du: 1,
    des: 1,
    el: 1,
    los: 1,
    las: 1,
    tou: 1,
    ton: 1,
    tis: 1,
    at: 1,
    in: 1,
    on: 1
  };
  /* a name's words that tell it apart: longer than two letters, or with a number in it; each once */
  function toks(s) {
    var seen = /** @type {Record<string, number>} */ ({});
    return W.norm(s)
      .split(" ")
      .filter(function (w) {
        if (!w || STOP[w] || seen[w] || (w.length < 3 && !/\d/.test(w))) return false;
        return (seen[w] = 1);
      });
  }
  /* a word in a list of words: a word may be the start of a longer one ("museum" in "museums"), a number must be whole
     ("2" is not "20") */
  function inWords(hay, w) {
    return hay.indexOf(" " + w + (/\d/.test(w) ? " " : "")) > -1;
  }
  /** how well a place's name is found in a booking's words: 0 when under 3 in 5 of the name's words are there; otherwise
      that share plus the share of the booking's words found in the name, so "Sight 2-2" is closer to a "Sight 2-2"
      ticket than "Sight 2-7" is @param {string} name @param {string} text */
  W.nameRank = function (name, text) {
    var A = toks(name),
      Bw = toks(text);
    if (!A.length || !Bw.length) return 0;
    var B = " " + Bw.join(" ") + " ",
      An = " " + A.join(" ") + " ";
    var fwd =
      A.filter(function (w) {
        return inWords(B, w);
      }).length / A.length;
    if (fwd < 0.6) return 0;
    return (
      fwd +
      Bw.filter(function (w) {
        return inWords(An, w);
      }).length /
        Bw.length
    );
  };
  /** a place's name is in a booking's words @param {string} name @param {string} text */
  var nameMatch = (W.nameMatch = function (name, text) {
    return W.nameRank(name, text) > 0;
  });
  function bkDay(b) {
    return W.dayOfDate(b.start);
  }
  var SIGHT = { ticket: 1, tour: 1, activity: 1, other: 1, restaurant: 1 };
  /* a booking for this stop on this day (tickets, tours, tables) */
  W.bookingFor = function (it, day) {
    var list = bookings();
    if (!list.length) return null;
    return (
      list.filter(function (b) {
        if (!SIGHT[b.kind]) return false;
        var n = bkDay(b);
        if (n != null && day && n !== day.n) return false;
        return nameMatch(it.n, (b.title || "") + " " + (b.what || "") + " " + (b.provider || ""));
      })[0] || null
    );
  };
  function stayBooking(s, P) {
    var first = P.days.filter(function (d) {
      return d.stop === P.stops.indexOf(s);
    })[0];
    return (
      bookings().filter(function (b) {
        if (b.kind !== "lodging") return false;
        if (b.place && (nameMatch(s.name, b.place) || nameMatch(b.place, s.name))) return true;
        var n = bkDay(b);
        return first && n != null && n >= first.n && n < first.n + s.days;
      })[0] || null
    );
  }
  function legBooking(P, si) {
    var day = P.days.filter(function (d) {
        return d.stop === si && d.dayInCity === 1;
      })[0],
      a = P.stops[si - 1],
      b = P.stops[si];
    return (
      bookings().filter(function (x) {
        if (!/^(train|ferry|bus|flight|car)$/.test(x.kind)) return false;
        if (x.place && x.to && nameMatch(a.name, x.place) && nameMatch(b.name, x.to)) return true;
        return day && bkDay(x) === day.n && x.kind !== "car";
      })[0] || null
    );
  }
  /* the ticket for the journey into a stop, when its booking has a time: when it leaves and when it arrives (minutes from
     midnight; an arrival on a later day counts on past 24:00, a day for each day between the two dates). Without a
     time there is no ticket to plan around. A flight that lands no later than it left, by the clock, crossed time zones
     (Tokyo 5:20 PM to Los Angeles 11:05 AM the same day): its times stand as booked, each on its own clock (zone), and
     no length is worked out from them. */
  function hhmm(iso) {
    var m = /T(\d{2}):(\d{2})/.exec(iso || "");
    return m ? +m[1] * 60 + +m[2] : null;
  }
  W.legTicket = function (P, si) {
    if (!P || !si || !P.stops || !P.stops[si] || !P.stops[si - 1]) return null;
    var b = legBooking(P, si);
    if (!b) return null;
    var dep = hhmm(b.start);
    if (dep == null) return null;
    var at = hhmm(b.end),
      d0 = String(b.start).slice(0, 10),
      d1 = String(b.end || "").slice(0, 10) || d0,
      plus = Math.round((Date.parse(d1 + "T00:00:00Z") - Date.parse(d0 + "T00:00:00Z")) / 864e5),
      arr = at == null ? null : at + 1440 * (plus > 0 && plus < 4 ? plus : 0),
      zone = arr != null && arr <= dep && b.kind === "flight" && plus <= 0 && plus >= -1;
    return {
      kind: b.kind,
      title: b.title || "",
      provider: b.provider || "",
      ref: b.ref || "",
      dep: dep,
      arr: arr != null && (arr > dep || zone) ? arr : null,
      zone: zone
    };
  };
  function flightBooking(P, home) {
    return (
      bookings().filter(function (x) {
        if (x.kind !== "flight") return false;
        var n = bkDay(x);
        if (n == null) return false;
        return home ? Math.abs(n - P.N) <= 1 : n >= 0 && n <= 1;
      })[0] || null
    );
  }

  /* bookings that fall on a day, for the top of that day in My trip */
  var KIND = {
    lodging: "Stay",
    flight: "Flight",
    train: "Train",
    ferry: "Ferry",
    bus: "Bus",
    car: "Car",
    ticket: "Tickets",
    tour: "Tour",
    restaurant: "Table",
    activity: "Activity",
    other: "Booking"
  };
  function timeOf(iso) {
    var m = /T(\d{2}):(\d{2})/.exec(iso || "");
    return m ? W.clock(+m[1] * 60 + +m[2]) : "";
  }
  /* "Mon, Jun 7, 3:00 PM" */
  function when(iso) {
    if (!iso) return "";
    var d = new Date(String(iso).slice(0, 10) + "T12:00:00");
    if (isNaN(d.getTime())) return String(iso);
    return fmtDay(d) + (timeOf(iso) ? ", " + timeOf(iso) : "");
  }
  W.bookedRow = function (day) {
    var list = bookings();
    if (!list.length || W.readOnly) return "";
    var on = [];
    list.forEach(function (b) {
      var s = bkDay(b),
        e = b.end ? W.dayOfDate(b.end) : null;
      if (s === day.n) on.push({ b: b, what: b.kind === "lodging" ? "Check in" : "", t: timeOf(b.start) });
      else if (b.kind === "lodging" && e === day.n) on.push({ b: b, what: "Check out", t: timeOf(b.end) });
    });
    if (!on.length) return "";
    return (
      '<div class="booked-row">' +
      on
        .map(function (o) {
          var b = o.b;
          return (
            '<span class="bchip"><b>' +
            esc(KIND[b.kind] || "Booking") +
            "</b> " +
            esc([o.what, b.title].filter(Boolean).join(": ")) +
            (o.t ? " · " + esc(o.t) : "") +
            (b.ref ? ' · <span class="ref">' + esc(b.ref) + "</span>" : "") +
            (b.url ? " " + link(b.url, "Email") : "") +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  };

  /* ---------- book-ahead checklist ---------- */
  function stopDay(P, si) {
    return P.days.filter(function (d) {
      return d.stop === si;
    })[0];
  }
  /* getting there and staying first, then the things you do, then where you eat */
  var GROUPS = [
    ["flight", "Flights"],
    ["transport", "Transport"],
    ["stay", "Lodging"],
    ["activity", "Activities"],
    ["food", "Restaurants"]
  ];
  W.checkGroups = function (list) {
    return GROUPS.map(function (g) {
      return {
        key: g[0],
        label: g[1],
        items: list.filter(function (c) {
          return c.group === g[0];
        })
      };
    }).filter(function (g) {
      return g.items.length;
    });
  };
  /** still to book: not booked, and its day still ahead (or today) */
  W.leftToBook = function (c) {
    return !!c && !c.done && !c.past;
  };
  /** where a booking stands, in a word or two, by the trip's clock: never a date that has gone by */
  W.bookByText = function (c, short) {
    if (!c) return "";
    if (c.done) return "Booked";
    if (c.past) return "Did you book it?";
    if (!c.by) return "";
    if (c.by < W.now()) return "Book now";
    return (short ? "by " : "Book by ") + W.fmtDate(c.by, "md");
  };
  W.checklist = function (P) {
    var out = [],
      T = ticks(),
      seen = {};
    function push(o) {
      var d = W.dateOf(o.day),
        by = null;
      if (d) {
        by = new Date(d);
        by.setDate(by.getDate() - o.lead);
      }
      o.date = d;
      o.by = by;
      /* a confirmation the autopilot found overnight counts like one found here */
      var af = !o.match && W.autoFound ? W.autoFound(o.key) : null;
      if (af) {
        o.match = { title: af.title || "", provider: af.provider || "", ref: af.ref || "", url: af.url || "", when: af.when || "" };
        o.autopilot = true;
      }
      o.auto = !!o.match;
      if (o.match) o.why = "Booked: " + (o.match.title || o.match.provider || "") + (o.match.ref ? " · " + o.match.ref : "");
      o.done = T[o.key] === 1 || (T[o.key] !== 0 && o.auto);
      /* its day has come and gone on the trip's clock and it was never marked booked: not "Book now" any more, but
         "Did you book it?" (a flight you already took, the stay you are in) */
      o.past = !o.done && !!d && W.isoDay(d) < W.isoDay(W.now());
      out.push(o);
    }
    var ap = P.ap;
    if (ap && P.stops.length)
      push({
        key: "flight|out",
        kind: "Flight",
        group: "flight",
        short: (ap.code || ap.name) + " → " + P.stops[0].name,
        title: "Flights from " + (ap.code || ap.name) + " to " + P.stops[0].name,
        lead: 75,
        day: 1,
        url: W.flightsUrl(ap.code || ap.name, P.stops[0].name, W.dateOf(1)),
        urlText: "Google Flights",
        why: "Fares climb as seats fill, most of all in summer and holidays.",
        match: flightBooking(P, false)
      });
    P.stops.forEach(function (s, si) {
      var ck = W.cityKey(s.country, s.name),
        st = S.stays[ck],
        nights = W.nightsAt(P, si),
        fd = stopDay(P, si);
      if (si > 0) {
        var L = W.legFor(P, si),
          o = L && L.best;
        var anyFerry =
          L &&
          (L.opts || []).some(function (f) {
            return W.isFerry(f.mode);
          });
        if (!o || o.book || anyFerry || /flight/.test(o.mode) || W.isFerry(o.mode))
          push({
            key: "leg|" + W.legKey(L.a, L.b),
            kind: o ? W.modeName(o.mode) : "Travel",
            group: o && /flight|plane/.test(o.mode) ? "flight" : "transport",
            short: L.a.name + " → " + L.b.name,
            sub: o ? [W.modeName(o.mode), o.dur, o.price, o.op].filter(Boolean).join(" · ") : "Pick how to get there on Trip",
            title: L.a.name + " → " + L.b.name + (o ? " by " + W.modeName(o.mode).toLowerCase() : ""),
            lead: o ? (/flight/.test(o.mode) ? 45 : W.isFerry(o.mode) ? 30 : 21) : 21,
            day: fd.n,
            url: o && (o.url || (W.isFerry(o.mode) ? W.ferrySearch(o, L.a, L.b).url : "")),
            urlText: o && o.url ? W.hostOf(o.url) : o && W.isFerry(o.mode) ? W.ferrySearch(o, L.a, L.b).text : "",
            why: o
              ? [o.op, o.dur, o.price].filter(Boolean).join(" · ") + ((L.opts || []).length > 1 ? " · other ways on the travel day" : "")
              : "Open that travel day in My trip to see the options.",
            match: legBooking(P, si)
          });
      }
      if (nights > 0) {
        var lodge =
          st &&
          st.label &&
          ((W.C.city[ck] && W.C.city[ck].lodging) || []).filter(function (l) {
            return l.n === st.label;
          })[0];
        var stLive = liveOf(st, s, P);
        push({
          key: "stay|" + ck,
          kind: "Stay",
          group: "stay",
          title: "Where to stay in " + s.name + " (" + W.nightsText(P, si) + ")",
          lead: 90,
          day: fd.n,
          short: s.name + " · " + W.nightsText(P, si),
          sub: st && st.label ? st.label + (stLive ? " · " + W.money(stLive.total, stLive.cur) : "") : "Not picked yet",
          url:
            st && st.live && st.live.url
              ? st.live.url
              : lodge
                ? lodge.site || W.priceUrl(lodge, s.name)
                : "https://www.google.com/travel/hotels/" + encodeURIComponent(s.name),
          urlText:
            st && st.live && st.live.url
              ? "Book on Booking.com"
              : lodge
                ? lodge.site
                  ? W.hostOf(lodge.site)
                  : "Compare prices"
                : "Compare prices",
          why:
            st && st.label
              ? "Chosen: " + st.label + (stLive ? " · " + W.money(stLive.total, stLive.cur) + " on Booking.com" : "")
              : "Not picked yet. Suggestions are under Plan.",
          match: stayBooking(s, P)
        });
      }
    });
    P.days.forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        var it = x.item;
        if (!it) return;
        var food = W.isFood(x.slot),
          need = W.needsBooking(it) || (food && it.reserve),
          k = "item|" + W.cityKey(d.country, d.city) + "|" + W.norm(it.n);
        if (seen[k]) return;
        var lead = it.lead != null ? it.lead : need ? (food ? 7 : 14) : 0;
        if (!lead && !need) return;
        if (!food && !W.isPaid(it) && !need && !lead) return;
        seen[k] = 1;
        var off = W.officialUrl(it, food, d.country, d.city);
        push({
          key: k,
          kind: food ? "Table" : "Tickets",
          group: food ? "food" : "activity",
          title: it.n,
          item: it,
          sub: food ? it.cuisine || "" : String(W.priceText(it.ticket, W.curOf(d.country)) || "").replace(/,?\s*book ahead\.?$/i, ""),
          lead: Math.max(lead, 1),
          day: d.n,
          slot: x.slot,
          city: d.city,
          url: off ? off.url : "",
          urlText: off ? off.host : "",
          why: (food ? it.cuisine : W.priceText(it.ticket, W.curOf(d.country))) || "",
          match: W.bookingFor(it, d)
        });
      });
    });
    if (ap && P.N > 1 && P.stops.length)
      push({
        key: "flight|home",
        kind: "Flight",
        group: "flight",
        short: P.stops[P.stops.length - 1].name + " → " + (ap.code || ap.name),
        title: "Flights home from " + P.stops[P.stops.length - 1].name + " to " + (ap.code || ap.name),
        lead: 75,
        day: P.N,
        url: W.flightsUrl(P.stops[P.stops.length - 1].name, ap.code || ap.name, W.dateOf(P.N)),
        urlText: "Google Flights",
        why: "",
        match: flightBooking(P, true)
      });
    /* soonest deadline first; without dates, whatever sells out furthest ahead first */
    out.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.by && b.by) return a.by - b.by || b.lead - a.lead;
      return b.lead - a.lead || a.day - b.day;
    });
    return out;
  };

  function mcpMsg(e, server) {
    var c = e && e.code;
    if (c === "needs_reauth") return "Reconnect " + server + " in claude.ai Settings → Connectors, then try again.";
    if (c === "server_not_connected" || c === "server_not_found")
      return "Connect " + server + " in claude.ai Settings → Connectors, then try again.";
    if (c === "not_in_manifest" || c === "approval_required" || c === "consent_required")
      return server + " access wasn't allowed. Tap again and allow it when asked.";
    if (c === "blocked_by_policy") return "Your organization doesn't allow " + server + " here.";
    if (c === "selection_required") return "Choose which " + server + " account to use when Claude asks, then try again.";
    if (c === "server_unavailable" || c === "rate_limited") return server + " didn't answer. Try again in a minute.";
    if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed")
      return server + " isn't available in this view. Open the trip in the Claude app.";
    return "Something went wrong with " + server + ". Try again.";
  }
  W.mcpMsg = function (e, s) {
    return mcpMsg(e, s);
  };
  W.getMcp = function () {
    return getMcp();
  };
  function getMcp() {
    try {
      return window.claude && window.claude.use ? window.claude.use("mcp") : Promise.resolve(null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* what screens/book.js shares from here */
  W._bk = {
    KIND: KIND,
    add: add,
    /* (for lib/budget.js: the exchange rates as they stand, and which booking covers a stay, a journey, the flights) */
    fx: function () {
      return FX;
    },
    stayBooking: stayBooking,
    legBooking: legBooking,
    flightBooking: flightBooking,
    bkDay: bkDay,
    bookings: bookings,
    fmtDay: fmtDay,
    sumText: sumText,
    ticks: ticks,
    when: when
  };
})();
