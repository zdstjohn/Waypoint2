/* Waypoint bookings, the part every screen needs: your bookings and ticks, money, which booking belongs to a stop or a
   day, the "book by" checklist and the budget (the next-step bar and the readiness ring read them on the first screen).
   The Prepare screen itself (screens/book.js: Gmail import, calendar export, the PDF, the lists) comes with the second
   script. */
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
    return d ? d.toLocaleDateString(undefined, o || { weekday: "short", month: "short", day: "numeric" }) : "";
  }

  /* ---------- money ---------- */
  var SYM = {
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₺": "TRY",
    "₹": "INR",
    "₩": "KRW",
    "฿": "THB",
    "₫": "VND",
    "zł": "PLN",
    "kč": "CZK",
    "kn": "HRK",
    "chf": "CHF",
    "us$": "USD",
    "a$": "AUD",
    "c$": "CAD",
    "nz$": "NZD",
    "$": "USD"
  };
  function curOf(str, dflt) {
    var s = String(str || "").toLowerCase(),
      m = /\b([a-z]{3})\b/i.exec(String(str || ""));
    if (
      m &&
      /^(EUR|USD|GBP|JPY|CHF|AUD|CAD|NZD|SEK|NOK|DKK|PLN|CZK|HUF|TRY|MAD|EGP|THB|VND|INR|MXN|BRL|ARS|CLP|COP|PEN|ZAR|ISK|AED|ILS|JOD|KRW|SGD|HRK|RON|BGN|ALL)$/.test(
        m[1].toUpperCase()
      )
    )
      return m[1].toUpperCase();
    for (var k in SYM) if (s.indexOf(k) > -1) return k === "$" && dflt && dflt !== "EUR" && /\$/.test(dflt) ? dflt : SYM[k];
    return dflt || "";
  }
  /* "€90–120" -> 105, "1,250" -> 1250 */
  function amount(str) {
    var nums = String(str || "")
      .replace(/(\d)[,.](\d{3})(?!\d)/g, "$1$2")
      .match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    var ns = nums.map(Number).filter(function (n) {
      return n > 0;
    });
    if (!ns.length) return null;
    return ns.length > 1 ? (ns[0] + ns[1]) / 2 : ns[0];
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
  W.CURS = [
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "NZD",
    "CHF",
    "JPY",
    "MXN",
    "SEK",
    "NOK",
    "DKK",
    "INR",
    "SGD",
    "HKD",
    "ZAR",
    "BRL",
    "CNY",
    "KRW",
    "THB",
    "TRY",
    "PLN",
    "CZK",
    "HUF",
    "ILS",
    "ISK"
  ];
  /* the currency where you live, from the phone's own region (for the first choice offered) */
  var REGION_CUR = {
    US: "USD",
    GB: "GBP",
    CA: "CAD",
    AU: "AUD",
    NZ: "NZD",
    CH: "CHF",
    JP: "JPY",
    MX: "MXN",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    IN: "INR",
    SG: "SGD",
    HK: "HKD",
    ZA: "ZAR",
    BR: "BRL",
    CN: "CNY",
    KR: "KRW",
    TH: "THB",
    TR: "TRY",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    IL: "ILS",
    IS: "ISK"
  };
  W.homeCur = function () {
    try {
      var loc = new Intl.NumberFormat().resolvedOptions().locale || navigator.language || "",
        m = /-([A-Z]{2})\b/.exec(loc);
      return (m && REGION_CUR[m[1]]) || (m ? "EUR" : "USD");
    } catch (e) {
      return "USD";
    }
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
  /* the "Prices in" choice (Prepare and Settings): as listed, your home currency, the trip's own, then the rest */
  W.curPicker = function (P) {
    var v = W.curView(),
      home = W.homeCur(),
      local = [];
    ((P && P.stops) || []).forEach(function (s) {
      var c = W.curOf(s.country);
      if (c && local.indexOf(c) < 0) local.push(c);
    });
    var order = [home].concat(local, W.CURS).filter(function (c, i, a) {
      return c && a.indexOf(c) === i && (c === "EUR" || !FX.rates || FX.rates[c]);
    });
    var name = function (c) {
      try {
        return new Intl.DisplayNames([navigator.language || "en"], { type: "currency" }).of(c) + " (" + c + ")";
      } catch (e) {
        return c;
      }
    };
    var dt = W.fxDate(),
      when = dt ? new Date(dt + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    return (
      '<div class="cur-pick"><label for="curPick">Prices in</label><select class="field" id="curPick" data-curpick="1">' +
      '<option value=""' +
      (v ? "" : " selected") +
      ">As listed</option>" +
      order
        .map(function (c) {
          return (
            '<option value="' +
            c +
            '"' +
            (v === c ? " selected" : "") +
            ">" +
            W.esc(name(c)) +
            (local.indexOf(c) > -1 ? " · this trip" : c === home ? " · yours" : "") +
            "</option>"
          );
        })
        .join("") +
      '</select><span class="small muted">' +
      (v
        ? FX.rates
          ? "Converted at the European Central Bank's rate" + (when ? " of " + when : "") + ", so about."
          : "Exchange rates haven't loaded yet: prices show as listed."
        : "") +
      "</span></div>"
    );
  };
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-curpick")) W.setCurView(t.value || "");
  });
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
    return (short ? "by " : "Book by ") + c.by.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

  /* ---------- budget ---------- */
  function payers() {
    return (
      W.ages().filter(function (a) {
        return a >= 4;
      }).length || 1
    );
  }
  W.budget = function (P) {
    var rows = {
      stay: "Places to stay",
      travel: "Flights, trains and ferries",
      tickets: "Tickets and tours",
      food: "Food",
      around: "Getting around",
      other: "Other bookings"
    };
    var B = {};
    Object.keys(rows).forEach(function (k) {
      B[k] = { label: rows[k], booked: {}, est: {}, open: 0 };
    });
    var used = {};
    function cat(b) {
      return b.kind === "lodging"
        ? "stay"
        : /^(flight|train|ferry|bus)$/.test(b.kind)
          ? "travel"
          : /^(ticket|tour|activity)$/.test(b.kind)
            ? "tickets"
            : b.kind === "restaurant"
              ? "food"
              : b.kind === "car"
                ? "around"
                : "other";
    }
    bookings().forEach(function (b) {
      if (b.price > 0) add(B[cat(b)].booked, b.cur, b.price);
    });
    P.stops.forEach(function (s, si) {
      var ck = W.cityKey(s.country, s.name),
        c = W.C.cost[ck],
        cur = c && c.cur,
        nights = W.nightsAt(P, si);
      W.loadCosts(s.country, s.name);
      /* lodging: booked, else your chosen place's price, else a typical mid-range price */
      if (nights > 0 && !stayBooking(s, P)) {
        var st = S.stays[ck],
          lodge =
            st &&
            ((W.C.city[ck] && W.C.city[ck].lodging) || []).filter(function (l) {
              return l.n === st.label;
            })[0],
          per = lodge && amount(lodge.price);
        var lv = liveOf(st, s, P);
        if (lv) add(B.stay.est, lv.cur, lv.total); /* the live price for your dates */
        else if (per) add(B.stay.est, curOf(lodge.price, cur), per * nights);
        else if (c && c.lodge) add(B.stay.est, cur, c.lodge * nights);
        else B.stay.open++;
      }
      if (si > 0 && !legBooking(P, si)) {
        var L = W.legFor(P, si),
          o = L && L.best,
          pr = o && amount(o.price);
        if (pr) add(B.travel.est, curOf(o.price, cur), pr * payers());
        else B.travel.open++;
      }
      var days = P.days.filter(function (d) {
        return d.stop === si;
      });
      if (c) {
        add(B.food.est, cur, days.length * ((c.breakfast || 0) + (c.lunch || 0) + (c.dinner || 0)));
        add(B.around.est, cur, days.length * (c.transit || 0));
      } else {
        B.food.open++;
        B.around.open++;
      }
      days.forEach(function (d) {
        (d.slots || []).forEach(function (x) {
          var it = x.item;
          if (!it || W.isFood(x.slot) || !W.isPaid(it)) return;
          var k = ck + "|" + W.norm(it.n);
          if (used[k]) return;
          used[k] = 1;
          if (W.bookingFor(it, d)) return;
          var v = c && c.tickets[W.norm(it.n)];
          if (v != null) add(B.tickets.est, cur, v);
          else B.tickets.open++;
        });
      });
    });
    /* flights from home: booked, else the cheapest live fare you checked, else a typical fare (kept apart as well, so the
       budget can say it is an estimate), else not counted (and the budget says so) */
    /** @type {Array<"out" | "home">} */ (["out", "home"]).forEach(function (dir) {
      if (!P.ap || flightBooking(P, dir === "home")) return;
      var f = W.fareMin && W.fareMin(dir, P),
        g = !f && W.fareGuess ? W.fareGuess(dir, P) : null;
      if (f) add(B.travel.est, f.cur, f.total);
      else if (g) {
        add(B.travel.est, g.cur, g.total);
        add((B.travel.guess = B.travel.guess || {}), g.cur, g.total);
      } else (B.travel.flights = B.travel.flights || []).push(dir);
    });
    var tot = { booked: {}, est: {} };
    Object.keys(B).forEach(function (k) {
      ["booked", "est"].forEach(function (w) {
        Object.keys(B[k][w]).forEach(function (c) {
          add(tot[w], c, B[k][w][c]);
        });
      });
    });
    return { rows: B, tot: tot };
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
    amount: amount,
    bkDay: bkDay,
    bookings: bookings,
    fmtDay: fmtDay,
    sumText: sumText,
    ticks: ticks,
    when: when
  };
})();
