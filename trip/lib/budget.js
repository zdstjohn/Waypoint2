/* Waypoint's budget and the "Prices in" choice: what the trip costs (booked, and estimated where nothing is booked
   yet), read by Prepare, and the currency picker of Prepare and Settings. Both are drawn only by screens of the
   second script, so they come with it; the money every screen shows (W.money, W.priceText, which booking belongs to
   what) stays in lib/bookcore.js. */
(function () {
  "use strict";
  var W = window.W,
    S = W.S;
  var K = W._bk,
    add = K.add,
    bookings = K.bookings,
    stayBooking = K.stayBooking,
    legBooking = K.legBooking,
    flightBooking = K.flightBooking,
    liveOf = W.stayLive;
  /* ---------- money written as text ---------- */
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
  K.amount = amount;
  /* ---------- the "Prices in" choice ---------- */
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
      return c && a.indexOf(c) === i && (c === "EUR" || !K.fx().rates || K.fx().rates[c]);
    });
    var name = function (c) {
      try {
        return new Intl.DisplayNames([navigator.language || "en"], { type: "currency" }).of(c) + " (" + c + ")";
      } catch (e) {
        return c;
      }
    };
    var dt = W.fxDate(),
      when = dt ? W.fmtDate(new Date(dt + "T12:00"), "md") : "";
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
        ? K.fx().rates
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
})();
