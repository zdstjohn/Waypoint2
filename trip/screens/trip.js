/* Waypoint trip view: route, day picker, the day's plan with reroll, spatial explorer, and more ideas. Also the app controller. */
(function () {
  "use strict";
  var W = window.W,
    $ = W.$,
    esc = W.esc,
    S = W.S;
  function hashView() {
    return location.hash === "#plan"
      ? "setup"
      : location.hash === "#bookings" || location.hash === "#prepare"
        ? "book"
        : location.hash === "#recap"
          ? "recap"
          : location.hash === "#today"
            ? "go"
            : location.hash === "#explore"
              ? "explore"
              : location.hash === "#settings"
                ? "settings"
                : location.hash === "#kids"
                  ? "kids"
                  : "trip";
  }
  /** @type {View} */ var view = hashView();
  var firstRender = true;
  if (window.__WP_OFFLINE && (view === "setup" || view === "settings")) view = "trip";
  var VIEWS = { setup: 0, trip: 1, explore: 1, book: 2, go: 3, recap: 4, kids: 4, settings: 5 },
    HASH = {
      go: "#today",
      setup: "#plan",
      trip: "#trip",
      explore: "#explore",
      book: "#prepare",
      recap: "#recap",
      kids: "#kids",
      settings: "#settings"
    },
    prevView = "trip";
  W.view = function () {
    return view;
  };
  var ICON_CLOCK = W.icon("clock", 2.6);
  /* recommended time to spend at a stop */
  function stayChip(it, food, slot) {
    var t = W.stayText(it, food, slot);
    if (!t) return "";
    return '<span class="dur" title="Recommended time to spend here">' + ICON_CLOCK + (/day$/.test(t) ? t.toLowerCase() : t) + "</span>";
  }
  /* how you get to a stop: a small walk, bus or car mark and the minutes */
  function legSvg(d) {
    return (
      '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      d +
      "</svg>"
    );
  }
  var LEG_IC = {
    walking: legSvg(
      '<circle cx="9" cy="2.8" r="1.4"/><path d="M8.5 5.5L6.8 9l2.4 1.6L8.5 14.5M6.8 9L5 14.5M8.6 5.6l2.6 2.2 1.8.4M8.5 5.5L6 7l-.8 2.2"/>'
    ),
    transit: legSvg(
      '<rect x="3.5" y="2" width="9" height="10" rx="2"/><path d="M3.5 7.5h9M5.5 14l1-2M10.5 14l-1-2"/><circle cx="6" cy="9.8" r=".5" fill="currentColor"/><circle cx="10" cy="9.8" r=".5" fill="currentColor"/>'
    ),
    driving: legSvg(
      '<path d="M3 11V8.2L4.4 5h7.2L13 8.2V11z"/><path d="M3 8.2h10"/><circle cx="5.3" cy="11.3" r="1.1"/><circle cx="10.7" cy="11.3" r="1.1"/>'
    )
  };
  var ICON_MORE =
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12.8" cy="8" r="1.5"/></svg>';
  var ICON_REROLL = W.icon("reroll", 2.5);

  function fmtDate(n, opts) {
    if (!S.start) return "";
    var d = new Date(S.start + "T12:00:00");
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + n - 1);
    return d.toLocaleDateString(undefined, opts || { weekday: "short", month: "short", day: "numeric" });
  }
  /* travel day: how to get from the last place to this one, with the operators' own sites */
  /* how to look at the trip: Day (one day) and Explore (that day's place, with ideas around it). Labelled, so it's
     clear what each does */
  function ic(k) {
    return W.icon(k === "map" ? "explore" : "day", 2.1);
  }
  W.viewSwitch = function () {
    var now = S.tview === "map" ? "map" : "days";
    return (
      '<div class="vsw-row"><div class="vsw" role="tablist" aria-label="How to see the trip">' +
      [
        ["days", "Day"],
        ["map", "Explore"]
      ]
        .map(function (v) {
          return (
            '<button type="button" role="tab" aria-selected="' +
            (v[0] === now) +
            '" data-vsw="' +
            v[0] +
            '">' +
            ic(v[0]) +
            "<span>" +
            v[1] +
            "</span></button>"
          );
        })
        .join("") +
      "</div></div>"
    );
  };
  /* the day the banner shows on a phone (lib/warm.js W.topLine): the Day view's own day, or none on any other screen */
  W.bannerDay = function (P) {
    /* (Simple view has no banner line: there the day keeps its own heading in the page) */
    if (!P || !P.days || !P.days.length || (W.simple && W.simple())) return null;
    /* Today: the day it shows, and the time there while the trip is on */
    if (view === "go" && W.goDayN) {
      var gd = P.days[W.goDayN(P) - 1];
      return gd
        ? {
            city: gd.city,
            date: fmtDate(gd.n),
            /* (and whose time it is, when the phone is somewhere else) */
            level:
              W.todayN(P) === gd.n
                ? "<span>" + W.clock(W.nowMin()) + (W.tripTimeNote(gd.city) ? " · " + esc(W.tripTimeNote(gd.city)) : "") + "</span>"
                : ""
          }
        : null;
    }
    if (view !== "trip" || S.tview === "map") return null;
    var day = P.days[S.day - 1];
    return day ? { city: day.city, date: fmtDate(day.n), level: dayLevel(day, P).replace(/^ · /, "") } : null;
  };
  function legCard(P, day, T) {
    var L = W.legFor(P, day.stop);
    if (!L) return "";
    W.loadLeg(L.a, L.b);
    var tr = T && T.travel,
      busy = W.legBusy(L.a, L.b);
    var tk = tr && tr.ticket;
    var h =
      '<section class="legcard sk"><div class="legcard-h"><h3>Getting here from ' +
      esc(L.a.name) +
      "</h3>" +
      (tr
        ? '<span class="small muted">' + W.clock(tr.start) + "–" + W.clock(tr.end) + (L.guessed && !tk ? " (rough)" : "") + "</span>"
        : "") +
      "</div>";
    /* your ticket, when one is booked with a time: the day is planned around it */
    if (tk)
      h +=
        '<p class="leg-tk"><b>Your ' +
        esc((W.modeName(tk.kind) || "ticket").toLowerCase()) +
        "</b> " +
        esc(W.clock(tk.dep) + (tr.arr != null ? "–" + W.clock(tr.arr % 1440) + (tr.arr >= 1440 ? " next day" : "") : "")) +
        (tk.title ? " · " + esc(tk.title) : "") +
        (tk.ref ? ' <span class="muted">· ' + esc(tk.ref) + "</span>" : "") +
        '<span class="small muted"> Leave by ' +
        W.clock(tr.start) +
        (tk.kind === "flight" ? " for check-in" : "") +
        (T.before ? "; the morning is yours in " + esc(L.a.name) + " (check out first)" : "") +
        ".</span></p>";
    if (L.opts && L.opts.length) {
      /* one row per way to go; the one you're taking opens up with where to book it */
      h +=
        '<div class="legopts" role="radiogroup" aria-label="How you\'ll get here">' +
        L.opts
          .map(function (o, i) {
            var sel = i === L.pick,
              fy = W.isFerry(o.mode),
              fl = /flight|plane/.test(o.mode),
              host = o.url && W.hostOf(o.url);
            var ro = !W.canEdit(),
              head =
                '<button type="button" class="lo-h" role="radio" aria-checked="' +
                sel +
                '"' +
                (sel || ro ? ' tabindex="' + (sel ? 0 : -1) + '"' : "") +
                (ro ? " disabled" : ' data-legpick="' + i + '" data-legkey="' + esc(L.key) + '"') +
                ">" +
                '<span class="lo-dot" aria-hidden="true"></span>' +
                modeIcon(o.mode) +
                '<span class="lo-n"><b>' +
                esc(W.modeName(o.mode)) +
                "</b>" +
                (o.op ? "<span> " + esc(o.op) + "</span>" : "") +
                "</span>" +
                '<span class="lo-m">' +
                esc([o.dur, o.price].filter(Boolean).join(" · ")) +
                "</span></button>";
            if (!sel) return '<div class="lo">' + head + "</div>";
            var where = [[o.from, o.to].filter(Boolean).join(" → "), o.freq]
              .filter(Boolean)
              .map(function (t) {
                return '<span class="nw">' + esc(t) + "</span>";
              })
              .join(" · ");
            var book =
              host && W.safeUrl(o.url)
                ? '<a class="lo-book" href="' +
                  esc(W.safeUrl(o.url)) +
                  '" target="_blank" rel="noopener">Book on ' +
                  esc(host) +
                  ' <span aria-hidden="true">↗</span></a>'
                : fy
                  ? '<a class="lo-book quiet" href="' +
                    esc(W.ferrySearch(o, L.a, L.b).url) +
                    '" target="_blank" rel="noopener">' +
                    esc(W.ferrySearch(o, L.a, L.b).text) +
                    ' <span aria-hidden="true">↗</span></a>'
                  : "";
            /* the ferry on Ferryhopper too, if you use it */
            var alt =
              fy && W.altUrls
                ? W.altUrls("ferry", { a: L.a, b: L.b })
                    .map(function (u) {
                      return link(u[1], esc(u[0]) + " ↗");
                    })
                    .join("")
                : "";
            var extra =
              alt +
              (fl ? link(W.flightsUrl(o.from || L.a.name, o.to || L.b.name, W.dateOf(day.n)), "Compare flights") : "") +
              (o.book
                ? '<button type="button" class="linkish small" data-gobook="' +
                  esc("leg|" + W.legKey(L.a, L.b)) +
                  '">On your To book list</button>'
                : "");
            return (
              '<div class="lo sel">' +
              head +
              '<div class="lo-d">' +
              (where ? '<span class="small">' + where + "</span>" : "") +
              (book || extra ? '<div class="lo-act">' + book + extra + "</div>" : "") +
              (o.note ? '<p class="small muted">' + esc(o.note) + "</p>" : "") +
              "</div></div>"
            );
          })
          .join("") +
        "</div>";
    }
    /* Rome2Rio's real journey times, on a tap (it asks your permission the first time) */
    if (L.opts && L.opts.length && !W.readOnly && !tk) {
      var lgc = W.C.legs[L.key] || {},
        rs = W.status["r2r|" + L.key];
      if (lgc.r2r && lgc.r2r.routes.length)
        h +=
          '<p class="small muted lo-r2r">Rome2Rio: ' +
          lgc.r2r.routes
            .slice(0, 4)
            .map(function (r) {
              return esc(r.name + " " + W.fmtMin(r.min) + (r.carriers.length ? " (" + r.carriers.slice(0, 2).join(", ") + ")" : ""));
            })
            .join(" · ") +
          (L.r2r ? " · the plan uses " + esc(W.fmtMin(L.r2r.min)) : "") +
          "</p>";
      else if (lgc.r2r) h += '<p class="small muted lo-r2r">Rome2Rio has no routes for this journey.</p>';
      else if (rs === "loading") h += '<p class="loading small lo-r2r">Asking Rome2Rio…</p>';
      else
        h +=
          '<p class="lo-r2r">' +
          (rs === "error" && W.r2rMsg ? '<span class="warn small">' + esc(W.r2rMsg) + "</span> " : "") +
          '<button type="button" class="linkish small" data-r2r="' +
          esc(L.key) +
          '">Check real journey times (Rome2Rio)</button></p>';
    }
    if (L.opts && L.opts.length) {
      /* (the options are above) */
    } else if (busy) h += '<div class="loading">Finding trains, ferries and flights…</div>';
    else if (W.sampleState !== "on")
      h +=
        '<p class="small muted">' +
        esc(W.betweenCities(L.km)) +
        ". " +
        link(W.gmapsDir(W.stopAt(L.a), { n: L.b.name + ", " + L.b.country, lat: null }, "transit"), "Navigate") +
        "</p>";
    return h + "</section>";
  }
  /* how tiring the day is (four bars), and making it a rest day */
  /* ---------- beach check ---------- */
  /** @type {[RegExp, string][]} */
  var SHORT = [
    [/^Locals eat around .*calmer, kid-friendly table$/, "Early dinner = calmer"],
    [/^Timed entry: book the (.+?) slot.*$/, "Book the $1 slot"],
    [/^Travel morning: have breakfast before you set off$/, "Breakfast before you set off"],
    [/^Travel day: lunch on the way$/, "Lunch on the way"],
    [/^No time (?:for this today with the journey|left for this today): swap it or save it for another day$/, "No time today: swap it"],
    [/^Closes (.+?): about (.+) there$/, "Closes $1 ($2 there)"],
    [/^Closes (.+?), before you'd get there$/, "Closed by then ($1)"],
    [/^Kitchen opens (.+?): late for kids$/, "Kitchen opens $1"],
    [/^Day trip: carries on after lunch$/, "Day trip, past lunch"],
    [/^May have closed for good\. Check before you go$/, "May have closed"],
    [/^Calm, shallow water: good for little kids$/, "Calm, shallow water"],
    [/^(Often rough|Deep or rocky): keep little ones close$/, "$1"]
  ];
  function shortNote(t) {
    for (var i = 0; i < SHORT.length; i++) if (SHORT[i][0].test(t)) return t.replace(SHORT[i][0], SHORT[i][1]);
    return t;
  }
  W.shortNote = shortNote;
  function beachNote(it, P) {
    if (!W.isBeach || !W.isBeach(it) || !it.bch || !P.p.kid) return "";
    var f = W.beachFit(it);
    return f === "safe"
      ? '<span class="good">Calm, shallow water: good for little kids</span>'
      : f === "care"
        ? '<span class="warn">' + (it.bch.calm === "often rough" ? "Often rough" : "Deep or rocky") + ": keep little ones close</span>"
        : "";
  }
  function beachCheck(it) {
    var b = it.bch;
    if (!W.isBeach || !W.isBeach(it) || !b || !b.calm) return "";
    var chips = [
      b.calm === "calm" ? "Calm water" : b.calm === "some waves" ? "Some waves" : "Often rough",
      b.shallow === true ? "Shallow entry" : b.shallow === false ? "Gets deep quickly" : "",
      b.sand ? { sand: "Sandy", pebbles: "Pebbles", mixed: "Sand and pebbles", rocks: "Rocky" }[b.sand] : "",
      b.shade ? { umbrellas: "Umbrellas to rent", trees: "Shade from trees", little: "Little shade", none: "No shade" }[b.shade] : "",
      b.lifeguard === true ? "Lifeguard in summer" : b.lifeguard === false ? "No lifeguard" : "",
      b.walk != null ? (b.walk <= 2 ? "Right by parking" : b.walk + " min walk from parking") : "",
      b.facilities === true ? "Toilets or café" : b.facilities === false ? "No facilities" : ""
    ].filter(Boolean);
    return (
      '<div class="bcheck"><b>Beach check</b><div class="bc-chips">' +
      chips
        .map(function (c) {
          return '<span class="bc">' + esc(c) + "</span>";
        })
        .join("") +
      "</div>" +
      (b.note ? '<p class="small muted">' + esc(b.note) + "</p>" : "") +
      "</div>"
    );
  }

  /* Explore's filters */
  var INDOOR =
    /museum|gallery|aquarium|palace|palazzo|cathedral|duomo|basilica|church|chapel|chiesa|library|theatre|theater|cinema|indoor|catacomb|planetarium|science|hall/i;
  function isIndoor(it) {
    var k = W.picKind ? W.picKind(it, false) : "";
    return /^(museum|church|temple|spa)$/.test(k) || INDOOR.test(it.n);
  }
  function exChips(F, eat, P, hasBeach, n, total) {
    var c = [["near", "Near today's stops"]];
    if (!eat) c.push(["free", "Free"], ["indoor", "Indoors"]);
    if (P.p.kid) c.push(["kids", P.p.toddler ? "Great for toddlers" : "Great for kids"]);
    if (hasBeach) c.push(["beach", "Calm beaches"]);
    var any = c.some(function (x) {
      return F[x[0]];
    });
    return (
      '<div class="ex-f" role="group" aria-label="Filter ideas">' +
      c
        .map(function (x) {
          return '<button type="button" class="chip" data-exf="' + x[0] + '" aria-pressed="' + !!F[x[0]] + '">' + esc(x[1]) + "</button>";
        })
        .join("") +
      "</div>" +
      (any ? '<p class="small muted ex-n">' + n + " of " + total + (n ? "" : " · nothing matches all of those") + "</p>" : "")
    );
  }
  /* the day picker: each city's name once, with its day numbers under it */
  function dayGroups(P, tn) {
    var out = "",
      cur = null;
    P.days.forEach(function (d) {
      if (!cur || cur.stop !== d.stop) {
        if (cur) out += "</div></div>";
        cur = d;
        out += '<div class="dgroup"><span class="dg-c">' + esc(d.city) + '</span><div class="dg-d">';
      }
      out +=
        '<button type="button" class="dpill' +
        (d.n === tn ? " today" : "") +
        '" data-day="' +
        d.n +
        '" aria-current="' +
        (d.n === S.day) +
        '" aria-label="' +
        (d.n === tn ? "Today, " : "") +
        "Day " +
        d.n +
        ", " +
        esc(d.city) +
        '"><b>' +
        d.n +
        "</b></button>";
    });
    return out + (cur ? "</div></div>" : "");
  }
  /* how full the day is, as a few bars at the end of the day's one line */
  function dayLevel(day, P) {
    if (!day.slots || !day.slots.length) return "";
    var E = W.dayEnergy(day, P, W.dayTimes(day, P));
    if (!E) return "";
    var tip =
      (E.act ? W.fmtMin(Math.round(E.act / 15) * 15) + " of sightseeing · " : "") +
      E.walk +
      " km on foot" +
      (E.travel ? " · " + W.fmtMin(E.travel) + " travelling" : "");
    var bars = "";
    for (var i = 1; i <= 4; i++) bars += "<i" + (i <= E.level ? ' class="on"' : "") + "></i>";
    return (
      ' · <span class="energy lv' +
      E.level +
      '" title="' +
      esc(tip) +
      '"><span class="bars" aria-hidden="true">' +
      bars +
      "</span>" +
      (day.rest ? "Rest day" : E.label + " day") +
      "</span>"
    );
  }
  /* the end of the day: where you sleep, and making it a rest day */
  function dayEnd(day, P, home, geoBusy) {
    var rk = W.restKey(day),
      canRest = !(!W.canEdit() || day.tripFirst || day.moveFrom || day.tripLast);
    return (
      '<div class="day-end sk"><span class="de-i" aria-hidden="true">' +
      W.icon("bed", 2.2) +
      "</span>" +
      (home.none
        ? '<div><span class="small muted">Tonight</span><b>No ' + esc(day.city) + " stay picked yet</b>"
        : '<div><span class="small muted">Staying at</span><b>' + esc(home.label) + "</b>") +
      (geoBusy ? '<span class="small muted">locating…</span>' : "") +
      "</div>" +
      '<div class="de-a">' +
      (W.readOnly
        ? ""
        : '<button type="button" class="chip-a' +
          (home.set ? "" : " pri") +
          '" data-gostay="' +
          day.stop +
          '">' +
          (home.set ? "Change" : "Pick a place") +
          "</button>") +
      (canRest && !day.trip
        ? '<button type="button" class="linkish" data-rest="' +
          esc(rk) +
          '">' +
          (day.rest ? "Undo rest day" : "Make it a rest day") +
          "</button>"
        : "") +
      /* a day out somewhere else (screens/daytrip.js); a day trip the planner chose can be changed for another place */
      (canRest && !day.rest
        ? '<button type="button" class="linkish" data-daytrip="' +
          day.n +
          '">' +
          (day.trip ? (day.trip.mine ? "Undo day trip" : "Change day trip") : "Make it a day trip") +
          "</button>"
        : "") +
      "</div></div>"
    );
  }
  /* small line icons for each way of getting around */
  var ICON = {
    Train:
      '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8.5 20.5 10 16M15.5 20.5 14 16"/><circle cx="9" cy="13" r=".8"/><circle cx="15" cy="13" r=".8"/>',
    Ferry:
      '<path d="M2.5 19c1.6 1.2 3.2 1.2 4.8 0 1.6-1.2 3.2-1.2 4.8 0 1.6 1.2 3.2 1.2 4.8 0 1.6-1.2 3.2-1.2 4.8 0"/><path d="M4.5 15.5 3.5 11h17l-1 4.5"/><path d="M7.5 11V7h9v4M12 7V4"/>',
    Bus: '<rect x="4.5" y="3" width="15" height="14" rx="3"/><path d="M4.5 10.5h15M8 20.5V17M16 20.5V17"/>',
    Flight: '<path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2.2 1.6V21l3.7-1 3.7 1v-1.4L13 18v-5z"/>',
    Car: '<path d="M5 16.5V12l2-5h10l2 5v4.5z"/><path d="M5 12h14"/><circle cx="8.5" cy="16.5" r="1.8"/><circle cx="15.5" cy="16.5" r="1.8"/>'
  };
  function modeIcon(m) {
    var k = W.modeName(m).toLowerCase();
    return W.icon(W.ICONS[k] ? k : "car", 1.9, "lo-i");
  }
  /* jet lag: a few days of shifting sleep before you go, and an easy start */
  function jetCard(P) {
    var J = W.jetlag(P),
      g = Math.abs(J.gap || 0);
    if (g < 3) return "";
    var d1 = W.dateOf(1),
      pre = d1 ? new Date(d1.getTime() - (g >= 7 ? 4 : 3) * 864e5) : null,
      kids = P.p.kid,
      dir = J.east ? "earlier" : "later";
    var city = P.stops[0].name,
      hrs = (g % 1 ? g : Math.round(g)) + " hour" + (g === 1 ? "" : "s");
    var li = [
      "<b>Before you go.</b> " +
        (pre
          ? "From " + pre.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ", move"
          : "For 3 or 4 days before, move") +
        " bedtime and wake-up " +
        dir +
        " by 30 minutes a day" +
        (kids ? ", the kids too. Dim lights in the evening helps." : "."),
      "<b>On the way.</b> " +
        (J.east
          ? "Sleep on the overnight flight if you can; set watches to " + city + " time when you board."
          : "Stay awake on the flight as much as you can; set watches to " + city + " time when you board."),
      "<b>Arrival day.</b> Get outside in daylight" +
        (J.east ? " in the morning" : " in the afternoon") +
        ". Keep naps under 90 minutes and before 3 PM. Early dinner, and bed close to the usual local bedtime.",
      J.days
        ? "<b>The first " +
          (J.days > 1 ? J.days + " days" : "day") +
          ".</b> Kept light: nothing timed before mid-morning, dinner by 6:30 PM."
        : ""
    ].filter(Boolean);
    return (
      '<details class="jetlag sk"' +
      (S.jetOpen ? " open" : "") +
      ' data-fold="jet"><summary><span><b>Jet lag plan</b> <span class="muted">· ' +
      esc(city) +
      " is " +
      esc(hrs) +
      (J.east ? " ahead of" : " behind") +
      " home</span></span>" +
      '<svg class="fold-chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg></summary><ul>' +
      li
        .map(function (t) {
          return "<li>" + t + "</li>";
        })
        .join("") +
      "</ul></details>"
    );
  }
  /* arrival and going home: the flight */
  function flightCard(P, day) {
    var ap = P.ap,
      st = P.stops[day.stop];
    if (!ap) return "";
    var out = day.tripFirst,
      d = W.dateOf(day.n),
      url = out ? W.flightsUrl(ap.code || ap.name, st.name, d) : W.flightsUrl(st.name, ap.code || ap.name, d);
    return (
      '<section class="legcard sk"><div class="legcard-h"><h3>' +
      (out ? "Flying in from " + esc(ap.code || ap.name) : "Flying home to " + esc(ap.code || ap.name)) +
      "</h3>" +
      '<span class="small muted">' +
      esc(W.betweenCities(W.km(ap, W.stopAt(st)))) +
      "</span></div>" +
      '<div class="lo-act">' +
      '<a class="lo-book quiet" href="' +
      esc(url) +
      '" target="_blank" rel="noopener">Find flights <span aria-hidden="true">↗</span></a>' +
      "</div>" +
      '<p class="small muted">' +
      (out
        ? "Times today assume you land early or the night before. If you land later, keep the first stops for tomorrow."
        : "Leave for the airport about 3 hours before an international flight.") +
      "</p></section>"
    );
  }

  W.legIcon = function (mode) {
    return LEG_IC[mode] || LEG_IC.transit;
  };
  /* ---------- today's route beside the day on a big screen (its rows are the ones Today uses: screens/travel.js) ---------- */
  /** today's stops as a route from where you stay and back: the way between each (walk, transit, drive) with its
      directions, the whole day in Google Maps, and the real street map on top where the city has one */
  function routeCard(day, P, T, home, pts, gm, mapBox, zoomBtns) {
    if (!pts.length)
      return '<aside class="explorer rcard sk"><div class="explorer-h"><h3>Today\'s route</h3></div><p class="small muted rc-empty">Nothing planned yet today. Add a place with the search, or from the ideas below.</p></aside>';
    var prev = home,
      rows = "",
      city = day.city;
    pts.forEach(function (p) {
      rows += W.routeLeg(prev, p, city, false);
      var R = T && T.rows[p.slot],
        when = [R && R.start != null && !R.skip ? W.clock(R.start) : "", (R && R.label) || W.SLOT_NAME[p.slot]].filter(Boolean).join(" · ");
      rows += W.routeStop(p, city, esc(when));
      if (p.lat != null) prev = p;
    });
    if (prev !== home) rows += W.routeLeg(prev, home, city, true);
    return (
      '<aside class="explorer rcard sk"><div class="explorer-h"><h3>Today\'s route</h3>' +
      zoomBtns +
      "</div>" +
      mapBox +
      '<ol class="rc-list">' +
      W.routeHome(home) +
      rows +
      "</ol>" +
      W.gmRow(day, gm, 0, true) +
      (mapBox && mapBox.indexOf("vt-slot") > -1 ? '<p class="map-note">© OpenMapTiles © OpenStreetMap contributors</p>' : "") +
      "</aside>"
    );
  }
  /** the parts of today with nothing planned, each with the three best fits (open then, close to the stop before) */
  function freeTime(day, P, T) {
    if (W.readOnly) return "";
    var order = T && T.order ? T.order : ["breakfast", "am", "lunch", "pm", "dinner", "eve"];
    var free = order
      .map(function (sl) {
        return (day.slots || []).filter(function (y) {
          return y.slot === sl;
        })[0];
      })
      .filter(function (x) {
        var R = x && T && T.rows[x.slot];
        return x && !x.item && !x.rest && !x.loading && !(R && R.skip);
      });
    if (!free.length) return "";
    return (
      '<section class="freetime sk"><h3>Free time today</h3>' +
      free
        .map(function (x) {
          var food = W.isFood(x.slot),
            R = T && T.rows[x.slot],
            nm = ((R && R.label) || W.SLOT_NAME[x.slot]).toLowerCase();
          var when = R && R.start != null ? W.clock(R.start) + (R.end != null ? "–" + W.clock(R.end) : "") : "";
          var opts = W.slotOptions(day, x.slot, P).slice(0, 3);
          return (
            '<div class="ft"><div class="ft-h"><b>' +
            esc((R && R.label) || W.SLOT_NAME[x.slot]) +
            "</b>" +
            (when ? '<span class="small muted">' + when + "</span>" : "") +
            (x.free ? '<span class="small muted">left free</span>' : "") +
            "</div>" +
            (opts.length ? swapCards(opts, x, food, day, nm) : '<p class="small muted">No ideas that fit yet.</p>') +
            "</div>"
          );
        })
        .join("") +
      "</section>"
    );
  }

  /* ---------- trip view ---------- */
  var swapOpen = null,
    swapAll = false,
    /* the idea the swap is showing up close (its name), or null for the list: nothing is swapped in until you say Add */
    swapPeek = null,
    /* the Explore idea whose "Add to Day N" is open ("<day>|<name>"): one button per idea, the parts of the day under it */
    /** @type {string | null} */ useOpen = null,
    tab = "do",
    showAll = false;
  var CHEV =
    '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  function stopAt(s) {
    return s.c && s.c.lat != null ? s.c : W.homebase(s.country, s.name);
  }
  var link = W.extLink;

  /* the three closest fits, as photo cards you can tap */
  /* no photo yet: a plain outline icon (fork and knife, or a pin), never a drawing of the place, and no words that repeat the line below */
  var SC_FOOD = W.icon("food", 1.6);
  var SC_PIN = W.icon("pin", 1.6);
  /* "Not for us": never plan or offer this place again in this city (lib/plan.js W.sayNo); a thumbs-down beside each idea */
  var ICON_NO = W.icon("no", 1.9);
  function noBtn(slot, name, cls) {
    return W.canEdit()
      ? '<button type="button" class="' +
          cls +
          '" data-nope="' +
          slot +
          '" data-name="' +
          esc(name) +
          '" aria-label="Not for us: ' +
          esc(name) +
          '" title="Not for us">' +
          ICON_NO +
          "</button>"
      : "";
  }
  function swapCards(list, x, food, day, nm) {
    if (!list.length) return "";
    return (
      '<div class="swapcards">' +
      list
        .map(function (o) {
          var it = o.it,
            ph = W.picture(it, food, day.country, day.city),
            info = [o.km != null ? W.fmtKm(o.km) + " away" : "", food ? it.cuisine || it.price : W.stayText(it, food, x.slot)]
              .filter(Boolean)
              .join(" · ");
          return (
            '<div class="scard-w"><button type="button" class="scard" data-peek="' +
            x.slot +
            '" data-name="' +
            esc(it.n) +
            '" aria-label="' +
            esc(it.n) +
            ": more about it, then add it for " +
            nm +
            ' or skip it">' +
            /* no photo yet: the same space with a plain outline icon, so every card's name and distance line up (never a drawing) */
            (ph
              ? '<span class="sc-pic">' + ph + "</span>"
              : '<span class="sc-pic sc-none" aria-hidden="true">' + (food ? SC_FOOD : SC_PIN) + "</span>") +
            '<span class="nm">' +
            esc(it.n) +
            "</span>" +
            (info ? '<span class="info">' + esc(info) + "</span>" : "") +
            "</button>" +
            noBtn(x.slot, it.n, "sc-no") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  /* one idea up close, inside the swap: its photo, what it is (the cuisine and price for a meal, the ticket for a
     sight), how far and how long, the notes, then Add or Skip; the menu, reviews and links below for a longer look.
     Skip shows the next idea; nothing changes on the plan until Add. */
  function swapPeekHtml(day, x, P, opts, i) {
    var o = opts[i],
      it = o.it,
      food = W.isFood(x.slot),
      nm = W.SLOT_NAME[x.slot].toLowerCase(),
      ph = W.picture(it, food, day.country, day.city, { credit: true }),
      facts = [
        food ? it.cuisine : "",
        food ? it.price : W.priceText(it.ticket, W.curOf(day.country)),
        o.km != null ? W.fmtKm(o.km) + " away" : "",
        W.stayText(it, food, x.slot)
      ].filter(Boolean),
      notes = placeNotes(it, food, P, ""),
      book = food ? "" : W.bookLink(it, day.city, false, day.country);
    return (
      '<div class="sw-peek" role="group" aria-label="' +
      esc(it.n) +
      '">' +
      '<div class="swp-top"><button type="button" class="linkish" data-peekback="1">' +
      W.arrow() +
      "All ideas</button>" +
      '<span class="small muted">' +
      (i + 1) +
      " of " +
      opts.length +
      "</span></div>" +
      (ph ? '<div class="sd-pic">' + ph + "</div>" : "") +
      '<h4 class="swp-n">' +
      esc(it.n) +
      "</h4>" +
      (facts.length ? '<p class="swp-f">' + esc(facts.join(" · ")) + "</p>" : "") +
      (it.d ? '<p class="sd-d">' + esc(it.d) + "</p>" : "") +
      (notes ? '<div class="slot-notes sd-notes">' + notes + "</div>" : "") +
      placeRev(it) +
      '<div class="swp-act"><button type="button" class="btn" data-use="' +
      x.slot +
      '" data-name="' +
      esc(it.n) +
      '">Add for ' +
      nm +
      '</button><button type="button" class="btn quiet" data-peekskip="' +
      x.slot +
      '">Skip</button>' +
      "</div>" +
      (x.item ? '<p class="small muted swp-was">Adding it takes the place of ' + esc(x.item.n) + ".</p>" : "") +
      (book ? '<div class="slot-act">' + book + "</div>" : "") +
      (food && W.menuBlock ? W.menuBlock(it, day) : "") +
      placeLinks(it, day, "") +
      /* (at the foot, apart from Add and Skip, so a thumb can't take it for Skip) */
      (W.canEdit()
        ? '<div class="swp-out"><button type="button" class="linkish sw-no" data-nope="' +
          x.slot +
          '" data-name="' +
          esc(it.n) +
          '" aria-label="Not for us: ' +
          esc(it.n) +
          '">' +
          ICON_NO +
          "Not for us, don't suggest it again</button></div>"
        : "") +
      "</div>"
    );
  }
  /* swap a slot: the next suggestion, or pick from the best options for that time of day */
  function swapPanel(day, x, P) {
    var opts = W.slotOptions(day, x.slot, P),
      food = W.isFood(x.slot),
      n = swapAll ? opts.length : 5,
      ck = W.cityKey(day.country, day.city);
    var busy = W.cityBusy(ck),
      pool = W.pool(day.country, day.city);
    var nm = W.SLOT_NAME[x.slot].toLowerCase();
    var pi = swapPeek == null ? -1 : peekIndex(opts, swapPeek);
    if (pi < 0) swapPeek = null; /* (it was said no to, or added elsewhere: back to the list) */
    if (pi > -1)
      return (
        '<div class="swap sk peek" role="region" aria-label="Swap ' +
        nm +
        '"><div class="swap-h"><b class="swap-l">A closer look for ' +
        nm +
        "</b>" +
        '<button type="button" class="icon-btn" data-swapclose="1" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
        swapPeekHtml(day, x, P, opts, pi) +
        "</div>"
      );
    return (
      '<div class="swap sk" role="region" aria-label="Swap ' +
      nm +
      '"><div class="swap-h">' +
      '<span class="swap-hl"><button type="button" class="btn sm" data-next="' +
      x.slot +
      '">' +
      ICON_REROLL +
      (x.item ? "Next suggestion" : "Suggest one") +
      "</button>" +
      (x.item && W.canEdit()
        ? '<button type="button" class="linkish sw-no" data-nope="' +
          x.slot +
          '" data-name="' +
          esc(x.item.n) +
          '" aria-label="Not for us: ' +
          esc(x.item.n) +
          '">' +
          ICON_NO +
          "Not for us</button>"
        : "") +
      "</span>" +
      '<button type="button" class="icon-btn" data-swapclose="1" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
      (opts.length
        ? '<b class="swap-l">or pick one for ' +
          nm +
          "</b>" +
          swapCards(opts.slice(0, 3), x, food, day, nm) +
          (opts.length > 3 ? '<div class="opts">' : "") +
          opts
            .slice(3, n)
            .map(function (o) {
              var it = o.it,
                info = [
                  W.stayText(it, food, x.slot),
                  o.km != null ? W.fmtKm(o.km) + " away" : "",
                  food ? it.cuisine : W.priceText(it.ticket, W.curOf(day.country))
                ]
                  .filter(Boolean)
                  .join(" · ");
              return (
                '<div class="opt-w"><button type="button" class="opt" data-peek="' +
                x.slot +
                '" data-name="' +
                esc(it.n) +
                '" aria-label="' +
                esc(it.n) +
                ": more about it, then add it for " +
                nm +
                ' or skip it"><span class="nm">' +
                esc(it.n) +
                '</span><span class="desc">' +
                esc(it.d) +
                "</span>" +
                (info ? '<span class="info">' + esc(info) + "</span>" : "") +
                "</button>" +
                noBtn(x.slot, it.n, "op-no") +
                "</div>"
              );
            })
            .join("") +
          (opts.length > 3 ? "</div>" : "")
        : '<p class="small muted">No other ideas nearby yet.</p>') +
      '<div class="swap-f">' +
      (opts.length > n
        ? '<button type="button" class="linkish" data-swapall="1">Show all ' + opts.length + "</button>"
        : swapAll && opts.length > 5
          ? '<button type="button" class="linkish" data-swapall="1">Show fewer</button>'
          : "") +
      (pool && pool.fallback
        ? ""
        : busy
          ? '<span class="loading">Finding more…</span>'
          : W.ideasFull(pool)
            ? ""
            : '<button type="button" class="linkish" data-more="1">Find more ideas</button>') +
      "</div></div>"
    );
  }

  /* the places you said no to in this city, each with a way back */
  function nopeList(day) {
    var l = W.canEdit() ? W.nopeList(day.country, day.city) : [];
    if (!l.length) return "";
    return (
      '<details class="nope-l"><summary>Not for us <span class="muted">(' +
      l.length +
      ")</span></summary><ul>" +
      l
        .map(function (o) {
          return (
            "<li><span>" +
            esc(o.n) +
            '</span><button type="button" class="linkish" data-unnope="' +
            esc(o.k) +
            '" aria-label="Bring back ' +
            esc(o.n) +
            '">Bring back</button></li>'
          );
        })
        .join("") +
      '</ul><p class="small muted">We won\'t plan or suggest these in ' +
      esc(day.city) +
      " again.</p></details>"
    );
  }
  /* the idea a "Not for us" button is about, and the city whose list it came from (on a day trip, the other town) */
  function ideaFor(day, slot, name) {
    var x = slot
        ? (day.slots || []).filter(function (y) {
            return y.slot === slot;
          })[0]
        : null,
      c = x && x.trip && day.trip ? [day.trip.country, day.trip.name] : [day.country, day.city];
    var pl = /** @type {Pool} */ (W.pool(c[0], c[1]) || { spots: [], food: [] }),
      n = W.norm(name),
      list = /** @type {Array<Spot | Food>} */ ([]).concat(
        slot ? (W.isFood(slot) ? pl.food : pl.spots) || [] : (pl.spots || []).concat(/** @type {any} */ (pl.food || []))
      );
    var it = list.filter(function (i) {
      return W.norm(i.n) === n;
    })[0];
    return it ? { it: it, c: c } : null;
  }
  /* The day's stops in order, as the Day tab lists them: today's card, the cards for arriving and leaving, each stop
     with its number and clock notes, the way from one to the next, the nap, and the way back to where you stay.
     Returns the list's HTML, the stops' points in order (for the map and the route link) and the day's times. */
  function dayStops(P, day, home, pool, short) {
    var num = 0,
      pts = [],
      prevPt = home,
      list = "",
      T = W.dayTimes(day, P),
      wasOut = false,
      /* the desktop workspace (lib/desk.js): each card carries its quick actions and each way between two cards the
         time to spare before the next one; a line on top adds the day up */
      desk = W.desk(),
      prevEnd = /** @type {number | null} */ (null),
      sum = { stops: 0, move: 0, first: /** @type {number | null} */ (null), last: /** @type {number | null} */ (null), booked: 0 },
      /* today: what is over is dimmed, what is on now is marked (and the day opens there) */
      nowM = W.isToday(day) ? W.nowMin() : null;
    /* a card's quick actions on the desktop (drag it, open it, a day earlier or later, find it on the map): lib/desk.js */
    function quick(x, it) {
      return desk && W.deskQuick ? W.deskQuick(x, it, day, P) : "";
    }
    /* on its own, a city has only the handful of ideas built into the app: say so where they've run out */
    if (
      W.standalone &&
      W.sampleState !== "on" &&
      day.slots.some(function (x) {
        return !x.item && !(S.free || {})[x.key];
      })
    )
      list +=
        '<div class="sa-info sa-note">This version has only a few ideas built in for ' +
        esc(day.city) +
        " (" +
        (pool.spots || []).length +
        " things to do" +
        ((pool.food || []).length ? ", " + pool.food.length + " places to eat" : ", no restaurants") +
        "), so some parts of the day are open. " +
        (W.cloud
          ? "More come once Claude answers."
          : '<button type="button" class="linkish" data-acct="in">Sign in</button> for fresh ideas for any city.') +
        "</div>";
    list += W.todayRow(day, P, T);
    if (day.moveFrom) list += legCard(P, day, T);
    else if (day.tripFirst) list += flightCard(P, day) + jetCard(P);
    list += W.bookedRow ? W.bookedRow(day) : "";
    (T && T.order
      ? T.order.map(function (sl) {
          return day.slots.filter(function (y) {
            return y.slot === sl;
          })[0];
        })
      : day.slots
    ).forEach(function (x) {
      var it = x.item,
        food = W.isFood(x.slot),
        swap = swapOpen === x.slot,
        R = T && T.rows[x.slot],
        label = (R && R.label) || W.SLOT_NAME[x.slot];
      var tm = R && R.start != null && !R.skip ? '<span class="tm">' + W.clock(R.start) + "</span>" : "";
      var timed = nowM != null && R && !R.skip && R.start != null && R.end != null,
        isPast = timed && R.end <= nowM,
        isNow = timed && R.start <= nowM && nowM < R.end,
        liveCls = isPast ? " past" : isNow ? " is-now" : "",
        nowTag = isNow ? '<span class="now-tag">Now</span>' : "";
      /* the day's clock notes, as one quiet line under the stop: warnings first */
      var notes = R
        ? R.warn
            .map(function (w) {
              return '<span class="warn">' + esc(shortNote(w)) + "</span>";
            })
            .join("") +
          R.info
            .map(function (w) {
              return "<span>" + esc(shortNote(w)) + "</span>";
            })
            .join("")
        : "";
      var bk = it && W.bookingFor ? W.bookingFor(it, day) : null;
      var booked =
        (bk
          ? '<span class="booked-tag" title="' + esc(bk.title || "") + '">✓ Booked' + (bk.ref ? " · " + esc(bk.ref) : "") + "</span>"
          : "") + (it && W.heartBadge ? W.heartBadge(it) : "");
      var rr =
        '<button type="button" class="icon-btn" data-reroll="' +
        x.slot +
        '" aria-expanded="' +
        swap +
        '" aria-label="Swap ' +
        W.SLOT_NAME[x.slot].toLowerCase() +
        '" title="Swap">' +
        ICON_REROLL +
        "</button>";
      /* the end of a day trip: the drive or train back before dinner */
      if (day.trip && !x.trip && wasOut && prevPt !== home) {
        var rb = W.leg(prevPt, home);
        if (rb)
          list +=
            '<div class="travel-note">Back from ' +
            esc(day.trip.name) +
            " to " +
            esc(home.label) +
            " · " +
            W.fmtMin(rb.min) +
            " " +
            rb.label +
            (home.none ? "" : " " + link(W.gmapsDir(prevPt, home, rb.mode), "Navigate")) +
            "</div>";
        prevPt = home;
        wasOut = false;
      }
      if (it && x.trip) wasOut = true;
      if (it) {
        num++;
        pts.push({
          n: it.n,
          lat: it.lat,
          lng: it.lng,
          gid: it.gid,
          gpin: it.gpin,
          num: num,
          i: num,
          food: food,
          slot: x.slot,
          key: x.key,
          it: it
        });
        var lg = W.leg(prevPt, it),
          from = prevPt;
        /* (the desktop's line over the day, and the minutes to spare on the way to this stop) */
        var spare = desk && lg && prevEnd != null && R && !R.skip && R.start != null ? R.start - prevEnd - lg.min : null;
        sum.stops++;
        if (lg) sum.move += lg.min;
        if (bk) sum.booked++;
        if (R && !R.skip && R.start != null) {
          if (sum.first == null) sum.first = R.start;
          if (R.end != null) {
            sum.last = R.end;
            prevEnd = R.end;
          }
        }
        var legTag = lg
          ? '<span class="leg" title="' +
            esc(W.fmtMin(lg.min) + " " + lg.label + " · " + W.fmtKm(lg.d) + (from === home ? " from " + home.label : "")) +
            '"><span class="vh">' +
            esc(lg.label) +
            " </span>" +
            (LEG_IC[lg.mode] || LEG_IC.transit) +
            esc(W.fmtMin(lg.min)) +
            "</span>"
          : "";
        if (it.lat != null) prevPt = it;
        /* the way there, between the cards: "Navigate · 19 min" opens Google Maps directions to this stop from the one
           before (from wherever you are when it's the first stop and no stay is picked yet) */
        if (lg)
          list +=
            '<a class="travel-note nav-leg' +
            (isPast ? " past" : "") +
            (desk ? ' ws-leg" data-wsleg="' + esc(x.key) : "") +
            '" href="' +
            esc(W.gmapsDir(from === home && home.none ? null : from, it, lg.mode)) +
            '" target="_blank" rel="noopener" aria-label="Navigate to ' +
            esc(it.n) +
            ": " +
            esc(W.fmtMin(lg.min) + " " + lg.label) +
            '">' +
            W.icon("dir", 2.2) +
            '<b>Navigate</b><span aria-hidden="true">·</span>' +
            legTag +
            (spare != null && spare >= 10
              ? '<span class="ws-buf' +
                (spare < 20 ? " tight" : "") +
                '"><span aria-hidden="true">· </span>' +
                esc(W.fmtMin(spare)) +
                " to spare</span>"
              : "") +
            '<span class="nl-c" aria-hidden="true">›</span></a>';
        var open = false;
        /* closed: what, when, how long, and the one link you need (tickets or menu). Open: everything else. */
        var main = food ? W.menuBtn(x.key) + W.bookLink(it, day.city, true, day.country) : W.bookLink(it, day.city, false, day.country);
        if (P.p.kid && it.k === -1)
          notes =
            '<span class="warn">' +
            esc(W.notForLine ? W.notForLine(P.p) : P.p.toddler ? "Not for toddlers" : "Not for kids") +
            "</span>" +
            notes;
        var meta = food ? [it.cuisine, it.price] : [W.priceText(it.ticket, W.curOf(day.country))];
        var metaHtml = meta
          .filter(Boolean)
          .map(function (m) {
            return "<span>" + esc(m) + "</span>";
          })
          .join("");
        if (it.st === "closed") notes = '<span class="warn">May have closed</span>' + notes;
        if (it.st === "unfound") notes = '<span class="warn">Couldn\'t find this place</span>' + notes;
        if (it.st === "unverified" && food) notes = '<span class="warn">Not checked yet</span>' + notes;
        if (!food) notes = beachNote(it, P) + notes;
        var rev = placeRev(it);
        var more = open
          ? '<div class="slot-more">' +
            (metaHtml ? '<div class="meta">' + metaHtml + "</div>" : "") +
            (food ? "" : beachCheck(it)) +
            rev +
            (it.st === "unsure" ? "<p class=\"small muted\">Couldn't confirm it's still open. Worth a quick check.</p>" : "") +
            (W.altLinksFor ? W.altLinksFor("activity", { it: it, food: food, day: day }) : "") +
            placeLinks(it, day, "") +
            (W.familyActs ? W.familyActs(it, day, x) : "") +
            "</div>"
          : "";
        var ph = W.picture(it, food, day.country, day.city); /* restaurants show only their own photo (never a nearby one) */
        /* at a glance: what it costs, whether it's booked or due, whether it's indoors */
        var cls = W.classify(it, food),
          bkG = !food && W.bookEntryFor ? W.bookEntryFor(P, day, it) : null,
          bkd = W.bookingFor ? W.bookingFor(it, day) : null;
        var tags = "";
        if (!food && it.ticket)
          tags +=
            '<span class="gt' +
            (W.isPaid(it) ? "" : " free") +
            '">' +
            esc(W.clip(String(W.priceText(it.ticket, W.curOf(day.country))).split(/[,;(·]/)[0], 18)) +
            "</span>";
        if (bkd || (bkG && bkG.done)) tags += '<span class="gt ok">Booked</span>';
        else if (bkG && bkG.past) {
          /* (a day gone by: no deadline to show) */
        } else if (bkG && bkG.by)
          tags += '<span class="gt due' + (bkG.by < W.now() ? " late" : "") + '">' + esc(W.bookByText(bkG)) + "</span>";
        else if (bkG) tags += '<span class="gt due">Book ahead</span>';
        if (!food && cls.indoor) tags += '<span class="gt in">Indoors</span>';
        if (!food && it.fame === 2) tags += '<span class="gt must">Must-see</span>';
        else if (!food && it.fame === 0) tags += '<span class="gt gem">Hidden gem</span>';
        if (W.whoTags) tags += W.whoTags(it, food, cls);
        var glance = tags ? '<span class="gtags">' + tags + "</span>" : "";
        if (food) {
          /* meals: one slim row (time, name, menu); everything else is a tap away */
          /* a stop's card: its marker at the left, in the middle of the card (one column down the whole day, meals
             and sights alike); its photo at the right, never under the marker; the swap button in the bottom-right corner */
          list +=
            '<article class="slot sk food slim' +
            (ph ? " haspic" : "") +
            (R && R.skip ? " skipped" : "") +
            liveCls +
            '" data-slotkey="' +
            esc(x.key) +
            '">' +
            nowTag +
            quick(x, it) +
            W.stopMark(it, true, x.slot, num) +
            '<div class="slot-body"><button type="button" class="slot-toggle" data-open="' +
            esc(x.key) +
            '" aria-haspopup="dialog">' +
            '<span class="sl-l">' +
            tm +
            '<b class="nm">' +
            esc(it.n) +
            "</b></span>" +
            '<span class="when">' +
            label +
            "</span></button>" +
            (notes ? '<div class="slot-notes">' + notes + "</div>" : "") +
            "</div>" +
            '<div class="slim-a">' +
            (ph ? '<div class="thumb sm">' + ph + "</div>" : "") +
            booked +
            W.menuBtn(x.key) +
            (W.canEdit() ? rr : "") +
            "</div></article>";
        } else {
          var th = ph ? '<div class="thumb">' + ph + "</div>" : "";
          list +=
            '<article class="slot sk' +
            (ph ? " haspic" : "") +
            (R && R.skip ? " skipped" : "") +
            liveCls +
            '" data-slotkey="' +
            esc(x.key) +
            '">' +
            nowTag +
            quick(x, it) +
            W.stopMark(it, false, x.slot, num) +
            '<div class="slot-body"><button type="button" class="slot-toggle" data-open="' +
            esc(x.key) +
            '" aria-haspopup="dialog">' +
            '<span class="when">' +
            tm +
            label +
            stayChip(it, food, x.slot) +
            '</span><span class="nm">' +
            esc(it.n) +
            '</span><span class="desc">' +
            esc(it.d) +
            "</span>" +
            glance +
            "</button>" +
            (main || booked ? '<div class="slot-act">' + booked + main + "</div>" : "") +
            (notes ? '<div class="slot-notes">' + notes + "</div>" : "") +
            "</div>" +
            (th || W.canEdit() ? '<div class="slot-btns">' + th + (W.canEdit() ? rr : "") + "</div>" : "") +
            "</article>";
        }
      } else if (R && R.skip && !swap) {
        /* no time for anything here today (a long journey): nothing to show, except a note like "breakfast before you set off" */
        if (R.info.length) list += '<div class="travel-note">' + esc(label) + " · " + esc(R.info.join(" · ")) + "</div>";
      } else if (x.loading) {
        list +=
          '<div class="slot sk skel' +
          (food ? " food" : "") +
          '" aria-hidden="true"><span class="thumb"></span><span class="sl-b"><i></i><i></i><i></i></span></div>';
      } else {
        list +=
          '<article class="slot sk free slim' +
          (food ? " food" : "") +
          liveCls +
          '" data-slotkey="' +
          esc(x.key) +
          '"><span class="num" style="background:var(--soft)"></span><div class="slot-body"><span class="sl-l">' +
          tm +
          '<span class="nm muted">' +
          (x.rest ? "Rest, pool or playground" : x.free ? "Left free" : "Free time") +
          '</span></span><span class="when">' +
          esc(label) +
          (x.free && !W.readOnly ? " · swap to add something" : "") +
          "</span>" +
          (short && !short.said && W.slotShort(x) && x.slot !== "eve" && !x.trip ? ((short.said = true), short.html) : "") +
          "</div>" +
          (!W.canEdit() || x.rest ? "" : '<div class="slim-a">' + rr + "</div>") +
          "</article>";
      }
      if (swap) list += swapPanel(day, x, P);
      if (x.slot === "lunch" && P.p.toddler && T && T.nap)
        list +=
          '<div class="travel-note nap">' +
          (T && T.nap ? '<b class="tm">' + W.clock(T.nap.start) + "–" + W.clock(T.nap.end) + "</b> " : "") +
          (T.nap.away
            ? "Nap in the stroller or the car: you're out in " + esc(day.trip ? day.trip.name : day.city) + " for the day"
            : "Nap or rest break back at " + (home.none ? "your stay" : esc(home.label))) +
          "</div>";
      /* (after a nap back at your stay, the way to the next stop starts there, not at the lunch place) */
      if (x.slot === "lunch" && P.p.toddler && T && T.nap && !T.nap.away && !home.none) prevPt = home;
    });
    var back = W.leg(prevPt, home);
    /* the way back, like the way to each stop; no stay picked yet: no walk to a made-up address, and no directions */
    if (back && prevPt !== home)
      list += home.none
        ? '<div class="travel-note">Back to your stay' + (T && T.back ? ", about " + W.clock(T.back) : "") + "</div>"
        : '<a class="travel-note nav-leg" href="' +
          esc(W.gmapsDir(prevPt, home, back.mode)) +
          '" target="_blank" rel="noopener" aria-label="Navigate back to ' +
          esc(home.label) +
          ": " +
          esc(W.fmtMin(back.min) + " " + back.label) +
          '">' +
          W.icon("dir", 2.2) +
          "<b>Back to " +
          esc(home.label) +
          '</b><span aria-hidden="true">·</span><span class="leg">' +
          (LEG_IC[back.mode] || LEG_IC.transit) +
          esc(W.fmtMin(back.min)) +
          "</span>" +
          (T && T.back ? '<span class="nl-t">about ' + W.clock(T.back) + "</span>" : "") +
          '<span class="nl-c" aria-hidden="true">›</span></a>';
    if (day.tripLast && day.n > 1) list += flightCard(P, day);
    return { list: list, pts: pts, T: T, sum: sum };
  }
  /* Every idea for the day's city: on the Day tab folded away under the stops, in Explore the whole screen. What is on
     the trip comes first (in order), then the rest by what they are near, with Explore's filters and sorting, the
     cards themselves, "find more", and how to get around. pts are the day's stops in order, T its times. Returns HTML. */
  function dayIdeas(P, day, home, pool, pts, T, ck, xp) {
    var h = "";
    /* every idea for this city, folded away until you want it: what's on the trip first (in order), then the rest */
    var dayOf = {},
      SLOT_ORDER = ["breakfast", "am", "lunch", "pm", "dinner", "eve"];
    P.days.forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        if (x.item) dayOf[W.norm(x.item.n)] = { n: d.n, slot: x.slot, ord: d.n * 10 + SLOT_ORDER.indexOf(x.slot) };
      });
    });
    var eat = tab === "eat",
      all = (eat ? pool.food || [] : pool.spots || []).map(function (it) {
        return { it: it, on: dayOf[W.norm(it.n)] };
      });
    /* Explore: filter and sort the ideas */
    var F = /** @type {{ near?: boolean; free?: boolean; indoor?: boolean; kids?: boolean; beach?: boolean }} */ (xp ? S.exF || {} : {}),
      total = all.length,
      hasBeach =
        !eat &&
        P.p.kid &&
        all.some(function (r) {
          return W.beachFit && W.beachFit(r.it) === "safe";
        });
    if (xp) {
      var anchors = [home].concat(pts).filter(function (a) {
        return a && a.lat != null;
      });
      all.forEach(function (r) {
        r.km =
          r.it.lat != null && anchors.length
            ? Math.min.apply(
                null,
                anchors.map(function (a) {
                  return W.km(a, r.it);
                })
              )
            : null;
      });
      all = all.filter(function (r) {
        var it = r.it;
        return (
          (!F.near || (r.km != null && r.km <= 1.5)) &&
          (eat || !F.free || !W.isPaid(it)) &&
          (eat || !F.indoor || isIndoor(it)) &&
          (!F.kids || !P.p.kid || it.k > 0) &&
          (eat || !F.beach || !hasBeach || W.beachFit(it) === "safe")
        );
      });
    }
    /* places the check could not find, and duplicates, stay out of the list altogether */
    all = all.filter(function (x) {
      return x.on || (!W.gone(x.it) && !W.isNope(day.country, day.city, x.it));
    }); /* and what you said no to */
    var planned = all
        .filter(function (x) {
          return x.on;
        })
        .sort(function (a, b) {
          return a.on.ord - b.on.ord;
        }),
      rest = all.filter(function (x) {
        return !x.on;
      });
    var free = day.slots.filter(function (x) {
        return W.isFood(x.slot) === eat;
      }),
      /* the route card already shows today: what's on the trip starts folded (on the desktop workspace, open) */
      folded = W.desk() ? S.tripFolded === true : S.tripFolded !== false;
    /* the rest, by what they're near: each idea under the stop of today it is closest to (or where you stay), with
       the time to get there; then what is further out, then what has no pin */
    var groups = [],
      restShown = [];
    if (xp) {
      var A = /** @type {{ a: any, label: string, sub: string, home?: boolean }[]} */ (
        pts
          .filter(function (p) {
            return p.lat != null;
          })
          .map(function (p) {
            var R = T && T.rows[p.slot];
            return { a: p, label: p.n, sub: (R && R.label) || W.SLOT_NAME[p.slot] };
          })
      ).concat(home.lat != null ? [{ a: home, label: "where you're staying", sub: "", home: true }] : []);
      var byA = A.map(function () {
          return /** @type {any[]} */ ([]);
        }),
        far = [],
        nopin = [];
      rest.forEach(function (r) {
        if (r.it.lat == null || !A.length) {
          nopin.push(r);
          return;
        }
        var best = -1,
          bd = 1e9;
        A.forEach(function (x, i) {
          var d = W.km(x.a, r.it);
          if (d != null && d < bd) {
            bd = d;
            best = i;
          }
        });
        var lg = W.leg(A[best].a, r.it, true);
        r.km = bd;
        r.near = lg ? W.fmtMin(lg.min) + " " + lg.label + " from " + (A[best].home ? "where you're staying" : A[best].label) : "";
        (bd <= 3 ? byA[best] : far).push(r);
      });
      var cap = showAll ? 999 : 3;
      /* in each group the places the nightly check confirmed come first, then those not checked yet, then the doubtful
         ones (couldn't confirm, or not found on the web), each by distance */
      var tier = function (it) {
        return it.st === "open" ? 0 : !it.st ? 1 : it.st === "unsure" ? 2 : 3;
      };
      var byTier = function (a, b) {
        return tier(a.it) - tier(b.it) || a.km - b.km;
      };
      A.forEach(function (x, i) {
        if (!byA[i].length) return;
        byA[i].sort(byTier);
        groups.push({ h: x.home ? "Near where you're staying" : "Near " + x.label, sub: x.sub, rows: byA[i].slice(0, cap) });
      });
      far.sort(byTier);
      nopin.sort(function (a, b) {
        return tier(a.it) - tier(b.it);
      });
      if (far.length) groups.push({ h: "Further out", sub: "", rows: far.slice(0, cap) });
      if (nopin.length) groups.push({ h: "Elsewhere in " + day.city, sub: "", rows: nopin.slice(0, cap) });
      groups.forEach(function (g) {
        restShown = restShown.concat(g.rows);
      });
    }
    var moreBusy = W.cityBusy(ck),
      desk = W.desk();
    /* (the desktop workspace's map pane shows Explore's ideas as small pins: lib/deskmap.js) */
    W.deskIdeas =
      xp && desk
        ? restShown.map(function (r) {
            return { n: r.it.n, lat: r.it.lat, lng: r.it.lng, food: !!eat };
          })
        : [];
    function ideaCard(row) {
      var it = row.it,
        on = row.on,
        info = [
          W.stayText(it, eat, it.meal === "breakfast" ? "breakfast" : it.meal === "dinner" ? "dinner" : ""),
          eat ? it.cuisine : W.priceText(it.ticket, W.curOf(day.country)),
          eat ? it.price : ""
        ]
          .filter(Boolean)
          .join(" · ");
      var ph = W.picture(it, eat, day.country, day.city, { credit: true }),
        onTag = on ? '<span class="on">' + (on.n === day.n ? "Today" : "Day " + on.n) + " · " + W.SLOT_NAME[on.slot] + "</span>" : "";
      var bTag = !eat && P.p.kid && W.beachFit && W.beachFit(it) === "safe" ? '<span class="bc good">Calm and shallow</span>' : "";
      /* the group's food needs (Plan, step 3) */
      var ef = eat && W.eatFit ? W.eatFit(it) : "";
      if (ef === "good") bTag += '<span class="bc good" title="' + esc(W.eatWhy(it)) + '">Good for your food needs</span>';
      else if (ef === "poor") bTag += '<span class="warn" title="' + esc(W.eatWhy(it)) + '">Hard for your food needs</span>';
      return (
        '<div class="idea' +
        (ph ? " has-photo" : "") +
        (desk ? '" data-wsidea="' + esc(it.n) : "") +
        '">' +
        (ph ? '<div class="pic-wrap">' + ph + onTag + "</div>" : onTag) +
        "<h4>" +
        esc(it.n) +
        "</h4>" +
        bTag +
        '<p class="desc">' +
        esc(it.d) +
        "</p>" +
        (row.near ? '<p class="near">' + esc(row.near) + "</p>" : "") +
        (info ? '<p class="small muted">' + esc(info) + "</p>" : "") +
        /* the row: the links only (v118: no "checked" mark, no kids mark, and "Not for us" lives on a stop's own panel
           and on the swap cards, where a place is already on the day) */
        '<div class="small idea-meta">' +
        (eat ? W.menuLink(it, day.city) : "") +
        W.bookLink(it, day.city, eat, day.country) +
        W.iconLink(W.photosUrl(it.n, day.city), "photos", "Photos of " + it.n) +
        W.iconLink(W.gmapsPlace(it, day.city), "map", it.n + " in Google Maps") +
        "</div>" +
        ((on && on.n === day.n) || !free.length ? "" : useBlock(it)) +
        "</div>"
      );
    }
    /* one "Add to Day 2" per idea; a tap shows the parts of the day under it, a free one first, each saying what it would
       take the place of (one part of the day only: the button adds straight to it) */
    function useBlock(it) {
      var opts = free.slice().sort(function (a, b) {
          return (a.item ? 1 : 0) - (b.item ? 1 : 0);
        }),
        key = day.n + "|" + it.n,
        openNow = useOpen === key;
      return (
        '<div class="use">' +
        (opts.length > 1
          ? '<button type="button" class="use-add" data-useopen="' +
            esc(it.n) +
            '" aria-expanded="' +
            openNow +
            '"><span class="use-p" aria-hidden="true">+ </span>Add to Day ' +
            day.n +
            "</button>"
          : "") +
        (opts.length === 1 || openNow
          ? (opts.length > 1 ? '<div class="use-pick" role="group" aria-label="When on Day ' + day.n + '">' : "") +
            opts
              .map(function (x) {
                return (
                  '<button type="button" data-use="' +
                  x.slot +
                  '" data-name="' +
                  esc(it.n) +
                  '" aria-label="Add ' +
                  esc(it.n) +
                  " to Day " +
                  day.n +
                  ", " +
                  W.SLOT_NAME[x.slot].toLowerCase() +
                  (x.item ? ", in place of " + esc(x.item.n) : "") +
                  '"><span class="use-p" aria-hidden="true">+ </span>' +
                  W.SLOT_NAME[x.slot] +
                  /* each says what it costs: the stop it would take the place of, or that the time is free */
                  '<span class="use-x' +
                  (x.item ? "" : " free") +
                  '" aria-hidden="true"> · ' +
                  (x.item ? "replaces " + esc(x.item.n) : "free now") +
                  "</span></button>"
                );
              })
              .join("") +
            (opts.length > 1 ? "</div>" : "")
          : "") +
        "</div>"
      );
    }
    if (xp)
      h +=
        '<section class="ideas sk"><div class="ideas-t"><h2>Ideas in ' +
        esc(day.city) +
        '</h2><span class="small muted">' +
        (pool.spots || []).length +
        " things to do · " +
        (pool.food || []).length +
        " places to eat</span></div>" +
        '<div class="ideas-h"><div class="row"><div class="seg" role="group" aria-label="Ideas">' +
        '<button type="button" data-tab="do" aria-pressed="' +
        !eat +
        '">Things to do (' +
        (pool.spots || []).length +
        ")</button>" +
        '<button type="button" data-tab="eat" aria-pressed="' +
        eat +
        '">Places to eat (' +
        (pool.food || []).length +
        ")</button></div>" +
        (pool.fallback
          ? ""
          : moreBusy
            ? '<span class="loading">Finding more…</span>'
            : W.ideasFull(pool)
              ? '<span class="small muted">Plenty to choose from</span>'
              : '<button type="button" class="btn ghost" data-more="1">Find more</button>') +
        "</div></div>" +
        (xp ? exChips(F, eat, P, hasBeach, all.length, total) : "") +
        '<div class="idea-list">' +
        (planned.length
          ? '<h3 class="idea-group"><button type="button" class="fold" data-foldtrip="1" aria-expanded="' +
            !folded +
            '">' +
            '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' +
            (folded ? "M6 3l5 5-5 5" : "M3 6l5 5 5-5") +
            '"/></svg>' +
            "On your trip <span>(" +
            planned.length +
            ")</span><em>" +
            (folded ? "show" : "hide") +
            "</em></button></h3>" +
            (folded ? "" : planned.map(ideaCard).join(""))
          : "") +
        groups
          .map(function (g) {
            return (
              '<h3 class="idea-group near-g">' +
              esc(g.h) +
              (g.sub ? " <span>(" + esc(g.sub.toLowerCase()) + ")</span>" : "") +
              "</h3>" +
              g.rows.map(ideaCard).join("")
            );
          })
          .join("") +
        "</div>" +
        (rest.length > restShown.length || (showAll && rest.length > 6)
          ? '<div><button type="button" class="btn quiet" data-showall="1">' +
            (showAll ? "Show fewer" : "Show all " + rest.length) +
            "</button></div>"
          : "") +
        nopeList(day) +
        "</section>";

    if (xp && pool.transit) {
      var t = pool.transit,
        rows = [
          ["Transit", t.system],
          ["Best pass", t.pass],
          ["From airport", t.airport],
          ["Tip", t.tip]
        ].filter(function (x) {
          return x[1];
        });
      if (rows.length)
        h +=
          '<details class="transit sk" data-fold="transit"' +
          (S.transitOpen ? " open" : "") +
          "><summary>Getting around " +
          esc(day.city) +
          "</summary>" +
          rows
            .map(function (x) {
              return '<div><span class="k">' + x[0] + "</span><span>" + esc(x[1]) + "</span></div>";
            })
            .join("") +
          "</details>";
    }
    return h;
  }
  var nowSeen = ""; /* today's Day view has been opened at what is on now (see the end of renderTrip) */
  W.renderTrip = function (P, target) {
    /* the map is a way of looking at the trip (Day · Explore); the old Explore view draws the same thing */
    if (S.tview === /** @type {any} */ ("story")) S.tview = "days"; /* the storybook was removed in v118 */
    var xp = target === "explore" || S.tview === "map",
      el = $(target === "explore" ? "viewExplore" : "viewTrip");
    if (target !== "explore") el.classList.toggle("explore-v", xp);
    if (!P.stops.length) {
      el._sig = null;
      el.innerHTML =
        '<div class="empty sk">' +
        (S.countries.length
          ? W.status["country|" + (S.countries[0] || {}).name] === "loading"
            ? '<div class="loading" style="justify-content:center">Finding destinations…</div>'
            : "Pick at least one city under Plan."
          : "Where are you headed? Three quick questions and you'll have a plan.") +
        '<div style="margin-top:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        (S.countries.length ? "" : '<button type="button" class="btn" data-quick="1">Quick start</button>') +
        '<button type="button" class="btn' +
        (S.countries.length ? "" : " quiet") +
        '" data-view="setup">Go to Plan</button></div></div>';
      return;
    }
    W.jumpToToday(P); /* during the trip, open on today */
    S.day = Math.max(1, Math.min(P.N, S.day || 1));
    if (W.familyTick) W.familyTick();
    var day = P.days[S.day - 1],
      ap = P.ap,
      h = "",
      stop = P.stops[day.stop],
      mode = "list",
      vtWant = null,
      xpCols = false;

    W.stayRetry(day.country, day.city); /* (a stay you named whose place isn't known yet: asked for again) */
    /* day picker (during the trip, today's pill says so) */
    var tn = W.todayN(P);
    h +=
      '<div class="daybar"><button type="button" class="icon-btn" data-step="-1" aria-label="Previous day"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3L5 8l5 5"/></svg></button><div class="days" id="dayScroller">' +
      dayGroups(P, tn) +
      '</div><button type="button" class="icon-btn" data-step="1" aria-label="Next day"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l5 5-5 5"/></svg></button>' +
      "</div>" +
      (target === "explore" ? "" : W.viewSwitch());
    /* a year on, a look back */
    if (target !== "explore" && W.anniversary) h += W.anniversary(P);

    h += '<div class="dayflip">';
    /* day header: city, date, what kind of day, and where you start from */
    var home = W.homebase(day.country, day.city),
      sub = [];
    if (fmtDate(day.n)) sub.push(esc(fmtDate(day.n)));
    sub.push("Day " + day.dayInCity + " of " + stop.days);
    if (day.trip)
      sub.push(
        "Day trip to " +
          esc(day.trip.name) +
          (day.trip.min ? " · about " + esc(W.fmtMin(Math.round(day.trip.min / 15) * 15)) + " each way" : "")
      );
    var geoBusy = Object.keys(W.status).some(function (k) {
      return k.indexOf("geo|" + W.cityKey(day.country, day.city)) === 0 && W.status[k] === "loading";
    });
    if (xp)
      h +=
        '<div class="day-h ex-h"><div class="grow"><h2>' +
        (target === "explore" ? "Explore " : "") +
        esc(day.city) +
        '</h2><div class="sub">' +
        sub.join(" · ") +
        "</div></div></div>";
    else {
      /* the city's photo behind the day's name, when there is one */
      var hero = W.cityPhoto
        ? W.cityPhoto(
            day.country,
            day.city,
            (day.slots || [])
              .filter(function (x) {
                return x.item && !W.isFood(x.slot);
              })
              .map(function (x) {
                return x.item;
              })
          )
        : null;
      h +=
        '<div class="day-h' +
        (hero ? " has-hero" : "") +
        '">' +
        (hero ? W.heroImg(hero, day.city) : "") +
        '<div class="grow"><h2>' +
        esc(day.city) +
        '</h2><div class="sub">' +
        sub.join(" · ") +
        dayLevel(day, P) +
        "</div>" +
        (W.isExample
          ? '<div class="small ' +
            (hero ? "hero-note" : "muted") +
            '">Example trip · change anything under <a href="#plan" data-view="setup">Plan</a></div>'
          : "") +
        "</div></div>";
    }
    /* a public holiday or a festival on this day */
    if (!xp && W.holidayLine) h += W.holidayLine(day);
    /* the forecast, when the day is inside Google's ten and the viewer has a Google Maps connection (lib/gmaps.js) */
    if (!xp && W.wxLine) h += W.wxLine(day, W.isToday(day));
    /* the city's first ideas are still being written: the day already shows the ones that are in, and says more are coming */
    if (
      !xp &&
      !day.loading &&
      W.cityBusy(W.cityKey(day.country, day.city)) &&
      (day.slots || []).some(function (x) {
        return x.item;
      })
    )
      h +=
        '<p class="small muted arriving" role="status"><span class="loading">More ideas for ' +
        esc(day.city) +
        " are on the way. This day may still change.</span></p>";
    if (day.farthest > 40 && !day.loading && !day.trip) {
      var mins = Math.round((day.farthest / 60) * 60 + 10);
      h +=
        '<p class="scribble">' +
        (day.fullDay ? "day trip: about " : "far from your lodging today: about ") +
        esc(W.fmtMin(mins)) +
        " each way by car. Staying closer to this area would cut the drive.</p>";
    }

    /* a part of the day the city's first ideas don't fill (a meal, the morning or the afternoon; not an evening left
       open on purpose, a travel day's cut hours or time you freed): more ideas come only when you ask. Said where the
       gap is, in the first such free row of the day (dayStops), not above the plan */
    var dpool = W.pool(day.country, day.city),
      /** @type {{said: boolean, html: string} | null} */ short = null;
    if (
      !xp &&
      !day.loading &&
      dpool &&
      !dpool.fallback &&
      !W.ideasFull(dpool) &&
      (day.slots || []).some(function (x) {
        return W.slotShort(x) && x.slot !== "eve" && !x.trip;
      })
    )
      short = {
        said: false,
        html:
          '<span class="small muted short-note">Nothing in ' +
          esc(day.city) +
          "'s ideas fits here. " +
          (W.cityBusy(W.cityKey(day.country, day.city))
            ? '<span class="loading">Finding more…</span>'
            : '<button type="button" class="linkish" data-more="1">Find more ideas</button>') +
          "</span>"
      };

    /* the day */
    var pool = W.pool(day.country, day.city),
      ck = W.cityKey(day.country, day.city);
    if (pool && !pool.fallback) {
      var firstN = day.slots
        .map(function (x) {
          return x.item && x.item.n;
        })
        .filter(Boolean);
      P.days.forEach(function (d2) {
        if (d2.stop === day.stop && d2 !== day)
          (d2.slots || []).forEach(function (x) {
            if (x.item) firstN.push(x.item.n);
          });
      });
      W.loadBookLinks(day.country, day.city, firstN);
    }
    /* let the photo finder know which places this trip uses */
    P.stops.forEach(function (st) {
      W.wantPhotos(st.country, st.name, W.pool(st.country, st.name), P);
    });
    var err = W.status["spots|" + ck] && W.status["spots|" + ck] !== "loading" ? W.status["spots|" + ck] : null;
    /* when a day's ideas first arrive, its stops slide in one after another */
    var lk = day.n + "|" + ck,
      wasWaiting = W.renderTrip.waiting === lk;
    W.renderTrip.waiting = pool ? null : lk;
    if (pool && wasWaiting)
      W.fxAfter(function () {
        W.fxStagger(".slots > *", { step: 45 });
      });
    if (!pool) {
      h += err
        ? '<div class="note sk">' + esc(err) + ' <button type="button" class="btn quiet" data-retry="1">Try again</button></div>'
        : W.sampleState === "off"
          ? '<div class="note sk">' +
            (W.standalone
              ? "Ideas for " +
                esc(day.city) +
                " come with the full Waypoint, in Claude. This version has ideas built in for " +
                esc(W.builtInCities()) +
                "."
              : "Ideas for " + esc(day.city) + " come from Claude. Open this page in the Claude app and allow it when asked.") +
            "</div>"
          : '<div class="slots skel-list" aria-busy="true"><p class="loading skel-note">Gathering 40+ things to do and places to eat in ' +
            esc(day.city) +
            "…</p>" +
            ["", " food", "", " food"]
              .map(function (f) {
                return (
                  '<div class="slot sk skel' +
                  f +
                  '" aria-hidden="true"><span class="thumb"></span><span class="sl-b"><i></i><i></i><i></i></span></div>'
                );
              })
              .join("") +
            "</div>";
    } else {
      /* (the hops of the day on show are the ones worth asking Google for: W.legWant, lib/core.js) */
      W.legWant++;
      var lr0 = W.legReal,
        /** @type {{pts: any[], list: string, T: any, sum: any}} */ stops;
      try {
        stops = dayStops(P, day, home, pool, short);
      } finally {
        W.legWant--; /* (always: a fault while drawing must not leave every later hop asking Google) */
      }
      var pts = stops.pts,
        list = stops.list,
        T = stops.T;

      var stopsLL = pts.filter(function (p) {
        return p.lat != null;
      });
      /* a stop with no pin at all: ask where it is (once), so every stop can be found */
      if (stopsLL.length < pts.length && W.loadPins && !W.readOnly)
        W.loadPins(
          day.country,
          day.city,
          pts
            .filter(function (p) {
              return p.lat == null;
            })
            .map(function (p) {
              return p.n;
            })
        );
      /* the whole day in Google Maps: every stop in order, by its pin or else by its name */
      var gm = pts.length ? W.dayRouteUrl(day, pts, home) : "";
      if (!xp && W.bannerRoute) W.bannerRoute(gm); /* (on a phone the banner carries the route link) */
      /* a real street map (street names, buildings, landmarks) only for cities that have a map pack; never a sketch */
      var vtSlug = W.vtFor ? W.vtFor(day.country, day.city, home.lat, home.lng) : null,
        mapBox = "";
      /* on the desktop workspace the map has its own pane (lib/deskmap.js), fed from here: this day's stops in order */
      /* (with the map pane hidden by hand, "Hide the map", the day shows its route as a list, not a map of its own) */
      var paneMap = !!(W.deskSplit && W.deskSplit()) || (W.desk() && !!W.wsPrefs && !W.wsPrefs.map);
      W.deskPts = {
        n: day.n,
        country: day.country,
        city: day.city,
        pts: pts,
        home: home.none ? null : home,
        slug: vtSlug,
        xp: !!xp,
        gm: gm
      };
      if (vtSlug && !W.simple() && W.vtState() !== "off" && !xp && !paneMap && W.paneW() > 920) {
        /* (beside the day on a big screen; on a phone the map is on Today) */ /* Simple view: the stops and walks, no map */
        var vtOn = !!W.vtActive();
        mapBox =
          '<div class="map-wrap' +
          (vtOn ? " vt-on" : " vt-want") +
          '"><div class="vt-slot"></div>' +
          (vtOn ? "" : '<p class="loading map-wait">Loading the street map…</p>') +
          "</div>";
        vtWant = {
          slug: vtSlug,
          key: "day|" + day.n + "|" + day.city,
          pts: pts,
          home: home.none ? null : home,
          animate: true,
          city: day.city
        };
      }
      var zoomBtns = mapBox
        ? '<div class="zoom" role="group" aria-label="Map zoom"><button type="button" class="icon-btn" data-zoom="out" aria-label="Zoom out">−</button>' +
          '<button type="button" class="icon-btn" data-zoom="in" aria-label="Zoom in">+</button>' +
          '<button type="button" class="icon-btn fit" data-zoom="fit" aria-label="Fit today\'s stops"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg></button></div>'
        : "";
      if (!xp) {
        /* the Day tab: Google Maps under the day's stops, as on Today */
        list += W.gmRow(day, gm, lr0) + dayEnd(day, P, home, geoBusy);
        if (!W.readOnly)
          list +=
            '<button type="button" class="add-place" data-addplace="1"><span aria-hidden="true">+</span> Add a place of your own</button>';
        /* on a big screen, beside the day: the street map where the city has one, otherwise today's route with the
           whole day in Google Maps (never a sketch) */
        var side = mapBox
          ? '<aside class="explorer sk"><div class="explorer-h"><h3>Today\'s map</h3>' +
            zoomBtns +
            "</div>" +
            mapBox +
            '<p class="map-note">© OpenMapTiles © OpenStreetMap contributors</p></aside>'
          : W.paneW() > 920 && !(W.deskSplit && W.deskSplit())
            ? routeCard(day, P, T, home, pts, "", "", "")
            : "";
        /* the desktop's line over the day (how many stops, how long between them, when it starts and ends): lib/desk.js */
        if (W.desk() && W.deskSum) h += W.deskSum(stops.sum, day);
        h += '<div class="dayview mode-list' + (side ? "" : " solo") + '"><div class="slots">' + list + "</div>" + side + "</div>";
        h += W.dayNav ? W.dayNav(day, P) : "";
        /* the journal lives on Today; here, a way there when the day has one */
        if (W.journalCard && W.journalCard(day))
          h +=
            '<button type="button" class="j-go" data-journalgo="' +
            day.n +
            '"><span><b>Journal</b><span class="small muted"> · Day ' +
            day.n +
            '</span></span><span aria-hidden="true">→</span></button>';
      } else {
        /* Explore: find any place, today's route (on the street map where the city has one), the free time, then
           every idea by what it's near */
        /* (the search comes with the second script: until then, the box it will be) */
        h += W.searchBlock
          ? W.searchBlock(day, P)
          : (W.needLater(),
            '<section class="psearch sk" aria-label="Search for a place"><div class="ps-row"><input class="field" type="search" disabled placeholder="Search any place in ' +
              esc(day.city) +
              '…" aria-label="Search for a place"><button type="button" class="btn" disabled>Search</button></div></section>');
        /* below the search, on a big screen: the route (and street map) on the right, the rest on the left */
        /* (today's route, stop by stop, and today's map are on the Today tab: screens/travel.js) */
        h += '<div class="xp-cols solo">';
        xpCols = true;

        h += freeTime(day, P, T);
      }

      h += dayIdeas(P, day, home, pool, pts, T, ck, xp);
    }
    /* the same day on the same screen is edited in place (lib/patch.js); another day or view is drawn afresh */
    W.draw(
      el,
      h + (xpCols ? "</div>" : "") + "</div>",
      "day|" + S.tripId + "|" + S.day + "|" + (xp ? "map" : "list") + "|" + (W.simple() ? 1 : 0)
    );
    /* today, opened afresh (from another tab or day, or as the app starts): the day opens at what is on now, or at
       what is next, not at a morning that is over. Once per visit to the day: after that the scrolling is yours.
       (A frame later: arriving on a screen puts it at the top first.) */
    var nowKey = xp || !W.isToday(day) ? "" : S.tripId + "|" + day.n;
    if (!nowKey) nowSeen = "";
    else if (nowKey !== nowSeen && el.querySelector(".slots .slot[data-slotkey]")) {
      nowSeen = nowKey;
      requestAnimationFrame(function () {
        var find = function () {
          return view !== "trip" || S.tview === "map"
            ? null
            : el.querySelector(".slots .slot.is-now") || el.querySelector(".slots .slot.past ~ .slot:not(.past)");
        };
        var at = find();
        /* (under the rows that stay at the top on a phone, with the way there showing above it) */
        if (at && at.getBoundingClientRect().top > window.innerHeight * 0.45) holdAt(find, 170);
      });
    }
    /* on a phone in list view the map is hidden: don't run it in the background */
    if (vtWant) {
      var slotEl = el.querySelector(".vt-slot");
      /* the drawing code comes with the second script: until then the place stays held, saying the map is loading */
      if (!W.vtMount) W.needLater();
      else if (slotEl && W.vtMount(slotEl, vtWant)) {
        slotEl.parentNode.classList.add("vt-on");
        slotEl.parentNode.classList.remove("vt-want");
      }
    }
    var pill = el.querySelector('.dpill[aria-current="true"]'),
      sc = $("dayScroller");
    if (pill && sc) {
      var pr = pill.getBoundingClientRect(),
        sr = sc.getBoundingClientRect();
      sc.scrollLeft += pr.left - sr.left - sc.clientWidth / 2 + pr.width / 2;
    }
    /* the day pills fade out at an edge only where there are more to scroll to */
    if (sc) {
      var edges = function () {
        sc.classList.toggle("more-l", sc.scrollLeft > 4);
        sc.classList.toggle("more-r", sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4);
      };
      edges();
      if (!sc._edges) {
        sc._edges = 1;
        sc.addEventListener("scroll", edges, { passive: true });
      }
    }
  };

  /* ---------- controller ---------- */
  W.render = function () {
    if ((W.readOnly || window.__WP_OFFLINE) && (view === "setup" || view === "settings"))
      view = "trip"; /* a shared trip is view only; an offline copy is for the trip itself */
    /* a shared trip: view only ("ro"), or planning together ("co": the plan's controls, not the trip's setup) */
    document.documentElement.classList.toggle("ro", !!W.readOnly && !W.readOnly.edit);
    document.documentElement.classList.toggle("co", !!(W.readOnly && W.readOnly.edit));
    var P = (W.P = W.plan());
    /* travel mode: while the trip is on (or when you pick it), Today replaces Plan */
    var travel = W.travelOn ? W.travelOn(P) : false;
    document.documentElement.classList.toggle("travel", travel);
    if (travel && firstRender && view === "trip" && !W.readOnly) {
      view = "go";
      W.navTo(HASH.go);
    }
    firstRender = false;
    /* the desktop workspace puts its panes in place before the screen is drawn, so the screen is drawn at its real width */
    if (W.deskLayout) W.deskLayout(P);
    if ($("viewKids")) $("viewKids").hidden = view !== "kids";
    $("viewSetup").hidden = view !== "setup";
    $("viewTrip").hidden = view !== "trip";
    $("viewBook").hidden = view !== "book";
    $("viewRecap").hidden = view !== "recap";
    $("viewGo").hidden = view !== "go";
    $("viewExplore").hidden = view !== "explore";
    $("viewSettings").hidden = view !== "settings";
    $("tabGo").setAttribute("aria-current", view === "go" ? "page" : "false");
    $("tabSetup").setAttribute("aria-current", view === "setup" ? "page" : "false");
    $("tabTrip").setAttribute("aria-current", view === "trip" ? "page" : "false");
    $("tabBook").setAttribute("aria-current", view === "book" ? "page" : "false");
    if (W.renderBar) W.renderBar(P);
    if (W.renderNext) W.renderNext(P);
    if (W.autoTick) W.autoTick(P);
    if (W.eventsTick) W.eventsTick(P);
    if (W.offline) W.offline.tick(P);
    if (W.warmTick) W.warmTick(P);
    /* Plan, Prepare, the kids' corner, the recap and settings live in the second script: until it has come, a moment's "Loading…" */
    if (view !== "trip") nowSeen = ""; /* (coming back to today's Day view opens it at what is on now again) */
    var later = view === "kids" || view === "recap" || view === "settings" || view === "book" || view === "setup";
    if (later && !W.needLater()) {
      var lv = $(
        view === "kids"
          ? "viewKids"
          : view === "recap"
            ? "viewRecap"
            : view === "book"
              ? "viewBook"
              : view === "setup"
                ? "viewSetup"
                : "viewSettings"
      );
      if (lv && !lv.firstChild) lv.innerHTML = '<p class="loading later-wait">Loading…</p>';
    } else if (view === "kids") W.renderKids(P);
    else if (view === "setup") W.renderSetup(P);
    else if (view === "book") W.renderBook(P);
    else if (view === "recap") W.renderRecap(P);
    else if (view === "go") W.renderGo(P);
    else if (view === "explore") W.renderTrip(P, "explore");
    else if (view === "settings") W.renderSettings(P);
    else W.renderTrip(P);
    W.save();
    if (W.fxRunAfter) W.fxRunAfter();
    if (W.afterRender) W.afterRender();
    if (W.deskAfter) W.deskAfter(P);
  };
  function slotEl(slot) {
    var b = document.querySelector('[data-reroll="' + slot + '"]');
    return b && b.closest(".slot");
  }
  W.onData(function () {
    if (!W.typingHeld() || view === "setup") W.render();
  });

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-view]");
    if (a) {
      e.preventDefault();
      var to = /** @type {View} */ (a.dataset.view);
      /* the tab of the screen you are on: back to its top */
      if (to === view && a.closest(".tabs")) window.scrollTo({ top: 0, behavior: W.smooth() });
      if (to === view || (W.readOnly && (to === "setup" || to === "settings"))) return;
      if (to === "settings") prevView = view;
      /* a tab takes the place of the screen you are on; a link in the page is a step Back returns from (lib/back.js) */
      var byLink = !a.closest(".tabs");
      W.fxFlip("page", VIEWS[to] > VIEWS[view] ? 1 : -1, function () {
        view = to;
        W.navTo(HASH[view], byLink);
        W.render();
        window.scrollTo(0, 0);
      });
      return;
    }
    var b = e.target.closest("button");
    if (!b || b.closest("#tripbar")) return;
    var d = b.dataset,
      P = W.P;
    /* a shared trip: look around, change nothing */
    /* a shared trip: looking around only; planning together adds swapping stops, rest days, free time and the way you travel */
    var coOk =
      W.readOnly &&
      W.readOnly.edit &&
      (d.reroll ||
        d.next ||
        d.peek ||
        d.peekskip ||
        d.peekback ||
        d.use ||
        d.useopen != null ||
        d.swapall ||
        d.rest ||
        d.daytrip ||
        d.free ||
        d.legpick ||
        d.sheetact ||
        d.r2r ||
        d.undo ||
        d.nope != null ||
        d.unnope ||
        d.bag);
    if (
      W.readOnly &&
      !coOk &&
      !(
        d.day ||
        d.step ||
        d.tab ||
        d.showall ||
        d.foldtrip ||
        d.open ||
        d.zoom ||
        d.ro ||
        d.late ||
        d.heart ||
        d.comment ||
        d.exf ||
        d.psearch ||
        d.awake
      )
    )
      return;
    /* (looking around the example counts as yours for this visit; it stays the example, never sent to your account,
       until you change its plan: see W.save and lib/sync.js) */
    if (!W.readOnly) W.isExample = false;
    /* family: hearts and comments (a comment opens claude.ai's composer on this card, so nothing redraws) */
    if (d.comment) {
      if (W.familyClick) W.familyClick(b, d);
      return;
    }
    if (d.heart) {
      if (W.familyClick) W.familyClick(b, d);
      W.render();
      return;
    }
    if (view === "setup") {
      if (W.setupClick) W.setupClick(b, d, P);
      return;
    }
    if (view === "book") {
      if (W.bookClick) W.bookClick(b, d, P);
      return;
    }
    if (view === "settings") {
      if (W.settingsClick) W.settingsClick(b, d, P);
      return;
    }
    var day = P.days[S.day - 1];
    if (d.day || d.step) {
      var nd = d.day ? +d.day : Math.max(1, Math.min(P.N, S.day + +d.step));
      if (nd === S.day) return;
      W.fxFlip("day", nd > S.day ? 1 : -1, function () {
        S.day = nd;
        swapOpen = null;
        swapAll = false;
        swapPeek = null;
        showAll = false;
        W.render();
      });
      return;
    } else if (d.tab) {
      if (tab === d.tab) return;
      tab = d.tab;
      showAll = false;
      W.fxAfter(function () {
        W.fxStagger(".idea-list > *", { y: 8, step: 25 });
      });
    } else if (d.showall) showAll = !showAll;
    else if (d.exf) {
      var ef = S.exF || (S.exF = {});
      ef[d.exf] = !ef[d.exf];
      showAll = false;
    } else if (d.foldtrip) {
      S.tripFolded = !(W.desk() ? S.tripFolded === true : S.tripFolded !== false);
      if (S.tripFolded === false)
        W.fxAfter(function () {
          var g = document.querySelector("[data-foldtrip]"),
            n = g && g.closest(".idea-group"),
            out = [];
          while (n && (n = n.nextElementSibling) && !n.classList.contains("idea-group")) out.push(n);
          W.fxStagger(out, { step: 30 });
        });
    } else if (d.open) {
      if (W.openStop) W.openStop(d.open);
      if (d.menu)
        setTimeout(function () {
          var m = document.querySelector("#sheethost .menu-b"),
            sh = m && m.closest(".sheet");
          if (m && sh) sh.scrollTop = m.offsetTop - 12;
          else if (m) m.scrollIntoView({ block: "start" });
        }, 60);
      return;
    } else if (d.reroll || d.swapclose) {
      var sw = document.querySelector(".swap");
      if (sw && (d.swapclose || swapOpen === d.reroll)) {
        W.fxCollapse(sw, function () {
          swapOpen = null;
          swapAll = false;
          swapPeek = null;
          W.render();
        });
        return;
      }
      swapOpen = d.reroll;
      swapAll = false;
      swapPeek = null;
      W.fxAfter(function () {
        W.fxExpand(".swap");
      });
    } else if (d.next || d.peek || d.peekskip) {
      /* the next suggestion, an idea tapped, or Skip: shown up close in the swap, with Add and Skip; nothing is
         swapped in yet. With no other idea nearby, the next suggestion looks farther and puts it in (undo is offered) */
      var ps = d.next || d.peek || d.peekskip,
        po = W.slotOptions(day, ps, P);
      if (d.next && !po.length) {
        W.reroll(day, d.next, P);
        W.fxAfter(function () {
          W.fxPulse(slotEl(ps));
        });
      } else {
        var at = d.peek ? peekIndex(po, d.name) : d.peekskip && swapPeek != null ? peekIndex(po, swapPeek) + 1 : 0;
        swapOpen = ps;
        swapPeek = at > -1 && at < po.length ? po[at].it.n : null;
        W.fxAfter(function () {
          var sw = document.querySelector(".swap");
          if (!sw) return;
          /* (from Free time today the slot's swap can be far down the day: bring it into view) */
          var top = sw.getBoundingClientRect().top;
          if (top < 60 || top > window.innerHeight * 0.6) sw.scrollIntoView({ block: "start" });
          var f = sw.querySelector(swapPeek ? ".swp-act [data-use]" : "[data-peek]");
          if (f && f.focus) f.focus({ preventScroll: true });
        });
      }
    } else if (d.peekback) {
      swapPeek = null;
      W.fxAfter(function () {
        W.fxStagger(".swap .scard-w, .swap .opt-w", { y: 6, step: 20 });
      });
    } else if (d.useopen != null) {
      var uk = day.n + "|" + d.useopen;
      useOpen = useOpen === uk ? null : uk;
      W.render();
      return;
    } else if (d.use) {
      useOpen = null;
      var us = d.use,
        un = d.name,
        sw2 = document.querySelector(".swap");
      /* say what happened, with Undo; from Explore also the way to the day it went to */
      var inSwap = !!(sw2 && b.closest(".swap")),
        was = day.slots.filter(function (y) {
          return y.slot === us;
        })[0],
        b4 = W.snapState ? W.snapState() : null,
        said = inSwap
          ? "Changed a stop"
          : "Added to Day " +
            day.n +
            " " +
            (W.SLOT_NAME[us] || "").toLowerCase() +
            (was && was.item && was.item.n !== un ? ", in place of " + W.clip(was.item.n, 26) : "");
      var apply = function () {
        W.useIdea(day, us, un, P);
        W.save();
        if (W.undoPoint) W.undoPoint(b4, said, inSwap || S.tview !== "map" ? 0 : day.n);
        swapOpen = null;
        swapAll = false;
        swapPeek = null;
        W.fxAfter(function () {
          W.fxPulse(slotEl(us));
        });
        W.render();
      };
      if (inSwap) {
        W.fxCollapse(sw2, apply, { dur: 200 });
        return;
      }
      apply();
      return;
    } else if (d.nope != null && d.name) {
      var fi = ideaFor(day, d.nope, d.name);
      if (!fi) return;
      var ns2 = d.nope;
      W.sayNo(fi.c[0], fi.c[1], fi.it, P);
      if (ns2)
        W.fxAfter(function () {
          W.fxPulse(slotEl(ns2));
        });
    } else if (d.unnope) W.unNope(d.unnope);
    else if ((d.bag || d.awake) && W.bagClick) {
      if (!W.bagClick(d)) return;
    } else if (d.swapall) {
      swapAll = !swapAll;
      if (swapAll)
        W.fxAfter(function () {
          W.fxStagger(Array.prototype.slice.call(document.querySelectorAll(".swap .opt"), 5), { y: 6, step: 20 });
        });
    } else if (d.zoom) {
      if (W.vtActive && W.vtActive()) W.vtZoom(d.zoom);
      return;
    } else if (d.addplace) {
      /* "Add a place of your own" on the day: Explore, with the search ready */
      S.tview = "map";
      W.render();
      var q0 = document.getElementById("placeQ");
      if (q0) {
        q0.scrollIntoView({ block: "center" });
        q0.focus();
      }
      return;
    } else if (W.searchClick && W.searchClick(d, day, P)) {
      if (d.psearch || d.padd)
        W.fxAfter(function () {
          var r = document.querySelector(".psearch");
          if (r && r.getBoundingClientRect().top < 0) r.scrollIntoView({ block: "start" });
        });
    } else if (d.r2r) {
      var ls = W.legFor(P, day.stop);
      if (ls && ls.key === d.r2r) W.checkRoutes(ls.a, ls.b);
      else {
        var lp2 = P.stops.findIndex(function (s, i) {
          return i && W.legKey(P.stops[i - 1], s) === d.r2r;
        });
        if (lp2 > 0) W.checkRoutes(P.stops[lp2 - 1], P.stops[lp2]);
      }
    } else if (d.legpick != null && d.legkey) {
      var lp = S.legPick || (S.legPick = {}),
        lgo = (W.C.legs[d.legkey] || {}).opts || [],
        pk = lgo[+d.legpick];
      if (!pk) return;
      lp[d.legkey] = W.legSig(pk);
      W.fxAfter(function () {
        var e = document.querySelector(".lo.sel .lo-d");
        if (e) W.fxExpand(e, { reveal: false });
      });
    } else if (d.late != null) W.lateClick(d);
    else if ((d.offsave || d.offcopy) && W.offline) W.offline.click(d, P);
    else if (d.rescue) {
      var rd = P.days[(S.day || 1) - 1];
      if (rd && W.rescue) {
        W.rescue(rd, P, d.rescue);
        W.fxAfter(function () {
          W.fxStagger(".go-tl li", { step: 30 });
        });
      }
    } else if (d.unrescue) {
      var ud = P.days[(S.day || 1) - 1];
      if (ud && W.unrescue) W.unrescue(ud);
    } else if (d.jdel != null && W.journalClick) W.journalClick(d);
    else if (d.journalgo) {
      if (W.goToDay) W.goToDay(+d.journalgo);
      if (W.goOpen) W.goOpen("journal"); /* (on Today it may be folded to a line: this is the way to it, so it opens) */
      W.goView("go", "#viewGo .journal");
      return;
    } else if ((d.live || d.livepick != null || d.site) && W.liveClick) W.liveClick(d, P);
    else if (d.daytrip) {
      /* "Make it a day trip" / "Change day trip" open the choice; "Undo day trip" gives the day back to its town */
      var dn = +d.daytrip,
        tday = P.days[dn - 1];
      if (!tday) return;
      if (tday.trip && tday.trip.mine) {
        var b4t = W.snapState ? W.snapState() : null;
        if (S.dayTrip) delete S.dayTrip[W.restKey(tday)];
        var mineT = S.mine || {};
        tday.slots.forEach(function (x) {
          if (!mineT[x.key]) delete S.picks[x.key];
        });
        if (W.realChange) W.realChange();
        if (W.undoPoint) W.undoPoint(b4t, "Day " + dn + " is back in " + tday.city);
        W.changed();
      } else
        W.whenLater(function () {
          W.dayTripOpen(dn);
        });
    } else if (d.rest) {
      var rs = S.rest || (S.rest = {});
      if (rs[d.rest]) delete rs[d.rest];
      else {
        rs[d.rest] = 1;
        if (S.dayTrip) delete S.dayTrip[d.rest]; /* (a rest day is not a day out) */
      }
      W.fxAfter(function () {
        W.fxStagger(".slots > .slot", { step: 30 });
      });
    } else if (d.more) {
      var mk = W.cityKey(day.country, day.city);
      ["spots|", "food|"].forEach(function (p) {
        if (W.status[p + mk] !== "loading") delete W.status[p + mk];
      });
      W.loadCity(day.country, day.city, true);
    } else if (d.retry) {
      var rk = W.cityKey(day.country, day.city);
      ["spots|", "food|"].forEach(function (p) {
        delete W.status[p + rk];
      });
      W.loadCity(day.country, day.city);
    } else return;
    W.render();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target.matches("input")) return;
    e.preventDefault();
    if (view === "book") {
      if (W.bookEnter) W.bookEnter(e.target);
      return;
    }
    if (W.setupEnter) W.setupEnter(e.target, W.P);
  });
  document.addEventListener("change", function (e) {
    if (view === "setup" && e.target.matches("input") && W.setupChange) W.setupChange(e.target);
  });
  /* folded sections remember whether you left them open */
  W.saveFold = function (el, open) {
    var f = el && el.dataset && el.dataset.fold;
    if (!f) return;
    if (f === "transit") S.transitOpen = open;
    else if (f === "jet") S.jetOpen = open;
    else if (f.indexOf("step-") === 0) {
      S.stepClosed = S.stepClosed || {};
      S.stepClosed[f.slice(5)] = !open;
    } else if (f === "eat-al" || f === "eat-di") {
      S.eatOpen = S.eatOpen || {};
      S.eatOpen[f.slice(4)] = open;
    }
    W.save();
  };
  document.addEventListener(
    "toggle",
    function (e) {
      if (e.target && !e.target.getAttribute("data-moving")) W.saveFold(e.target, e.target.open);
    },
    true
  );
  window.addEventListener("hashchange", function () {
    view = hashView();
    W.render();
  });
  /* what is known about a place, planned or not, shared by a stop's panel and the swap's closer look: the warnings
     (not for small children, closed, not found, not checked), what it is listed as, the beach, then `mid` (the
     day's own notes) in the middle */
  function placeNotes(it, food, P, mid) {
    var notes = mid || "";
    if (P.p.kid && it.k === -1)
      notes = '<span class="warn">' + (P.p.toddler ? "Not ideal for toddlers" : "Not ideal for kids") + "</span>" + notes;
    if (it.st === "closed") notes = '<span class="warn">May have closed for good. Check before you go</span>' + notes;
    if (it.st === "unfound") notes = '<span class="warn">Couldn\'t find a place by this name. It may not exist</span>' + notes;
    if (it.st === "unverified" && food) notes = '<span class="warn">Not checked yet. Look it up before you go</span>' + notes;
    if (it.place && W.norm(it.place) !== W.norm(it.n)) notes += "<span>Listed as " + esc(it.place) + "</span>";
    if (it.note) notes += "<span>" + esc(it.note) + "</span>";
    if (!food) notes = beachNote(it, P) + notes;
    return notes;
  }
  /* what reviewers love it for, and what to watch for */
  function placeRev(it) {
    return it.love || it.gripe
      ? '<div class="rev">' +
          (it.love ? "<span><b>Loved for</b> " + esc(it.love) + "</span>" : "") +
          (it.gripe ? "<span><b>Watch for</b> " + esc(it.gripe) + "</span>" : "") +
          "</div>"
      : "";
  }
  /* reviews, photos and the place in Google Maps (between `pre` and `post`) */
  function placeLinks(it, day, pre, post) {
    /* three buttons that say what they open (two of them were bare pictures) */
    var b = function (url, icon, text, label) {
      return (
        '<a class="pl-a" href="' +
        esc(url) +
        '" target="_blank" rel="noopener" aria-label="' +
        esc(label) +
        '">' +
        W.icon(icon, 2) +
        text +
        "</a>"
      );
    };
    return (
      '<div class="links">' +
      (pre || "") +
      '<span class="pl-b">' +
      b(W.reviewsUrl(it.n, day.city), "star", "Reviews", "Reviews of " + it.n) +
      b(W.photosUrl(it.n, day.city), "photo", "Photos", "Photos of " + it.n) +
      b(W.gmapsPlace(it, day.city), "map", "Map", it.n + " in Google Maps") +
      "</span>" +
      (post || "") +
      "</div>"
    );
  }
  function peekIndex(opts, name) {
    for (var i = 0; i < opts.length; i++) if (opts[i].it.n === name) return i;
    return -1;
  }
  /* a stop's panel: the photo, when, the full notes, booking, reviews and links */
  W.stopDetails = function (P, day, x, opt) {
    var it = x.item;
    if (!it) return "";
    var food = W.isFood(x.slot),
      T = W.dayTimes(day, P),
      R = T && T.rows[x.slot],
      label = (R && R.label) || W.SLOT_NAME[x.slot];
    var ph = W.picture(it, food, day.country, day.city, { credit: true });
    var notes = placeNotes(
      it,
      food,
      P,
      R
        ? R.warn
            .map(function (w) {
              return '<span class="warn">' + esc(w) + "</span>";
            })
            .join("") +
            R.info
              .map(function (w) {
                return "<span>" + esc(w) + "</span>";
              })
              .join("")
        : ""
    );
    var meta = (food ? [it.cuisine, it.price] : [W.priceText(it.ticket, W.curOf(day.country))])
      .filter(Boolean)
      .map(function (m) {
        return "<span>" + esc(m) + "</span>";
      })
      .join("");
    var bk = W.bookingFor ? W.bookingFor(it, day) : null,
      bkE = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
    var booked = bk
      ? '<span class="booked-tag" title="' + esc(bk.title || "") + '">✓ Booked' + (bk.ref ? " · " + esc(bk.ref) : "") + "</span>"
      : "";
    /* (the sheet shows the tickets or the table as a button of its own, above: then not again here) */
    var main = opt && opt.noMain ? "" : W.bookLink(it, day.city, food, day.country); /* the menu itself is below */
    var rev = placeRev(it);
    var when = [R && R.start != null && !R.skip ? W.clock(R.start) : "", label, W.stayText(it, food, x.slot)].filter(Boolean).join(" · ");
    return (
      '<div class="sd">' +
      (ph ? '<div class="sd-pic">' + ph + "</div>" : "") +
      '<p class="sd-when">' +
      esc(when) +
      "</p>" +
      (it.d ? '<p class="sd-d">' + esc(it.d) + "</p>" : "") +
      (notes ? '<div class="slot-notes sd-notes">' + notes + "</div>" : "") +
      (main || booked ? '<div class="slot-act">' + booked + main + "</div>" : "") +
      (meta ? '<div class="meta">' + meta + "</div>" : "") +
      (food ? "" : beachCheck(it)) +
      rev +
      (food && W.menuBlock ? W.menuBlock(it, day) : "") +
      (it.st === "unsure" ? "<p class=\"small muted\">Couldn't confirm it's still open. Worth a quick check.</p>" : "") +
      (W.altLinksFor ? W.altLinksFor("activity", { it: it, food: food, day: day }) : "") +
      placeLinks(
        it,
        day,
        bkE
          ? '<button type="button" class="linkish" data-gobook="' +
              esc(bkE.key) +
              '">' +
              (bkE.done ? "Booked · see Prepare" : "On your To book list") +
              "</button>"
          : ""
      ) +
      (W.familyActs ? W.familyActs(it, day, x) : "") +
      "</div>"
    );
  };
  W.prevView = function () {
    return prevView === "settings" ? "trip" : prevView;
  };
  /* go to a screen; anchor (a selector) lands on that part of it instead of the top, once the page has changed */
  /* Scroll so that an element sits `gap` px below the top of the screen, and keep it there for a moment: what is
     above it can still grow as it loads (photos, the forecast, the day bag). Your own scrolling ends it at once. */
  function holdAt(find, gap) {
    var until = Date.now() + 1800,
      mine = false,
      stop = function () {
        mine = true;
      };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
      window.addEventListener(ev, stop, { once: true, passive: true });
    });
    (function hold() {
      if (mine || Date.now() > until) return;
      var b = find();
      if (b) {
        var top = b.getBoundingClientRect().top;
        if (Math.abs(top - gap) > 4) window.scrollTo(0, Math.max(0, top + window.pageYOffset - gap));
      }
      requestAnimationFrame(hold);
    })();
  }
  W.goView = function (to, anchor) {
    if (W.closeStop) W.closeStop(); /* a stop's sheet belongs to the screen it was opened on */
    var land = function () {
      if (anchor && document.querySelector(anchor))
        holdAt(function () {
          return document.querySelector(anchor);
        }, 12);
      else window.scrollTo(0, 0);
    };
    if (to === view) {
      W.render();
      if (anchor) land();
      return;
    }
    if (to === "settings") prevView = view;
    W.fxFlip(
      "page",
      VIEWS[to] > VIEWS[view] ? 1 : -1,
      function () {
        view = to;
        W.navTo(HASH[view], true); /* (a jump by a link: Back returns from it) */
        W.render();
        land();
      },
      anchor ? land : null
    );
  };
  W.setView = function (v) {
    if (window.__WP_OFFLINE && (v === "setup" || v === "settings"))
      v = "trip"; /* a copy is for the trip itself: planning needs the live app */
    view = v;
    W.navTo(HASH[v]);
  };
  W.currentView = function () {
    return view;
  };

  if (W.fxEnter) W.fxEnter();
  W.render();
  W.fxStagger("main:not([hidden]) > *", { step: 70, y: 14 }); /* the first view settles in */
  /* the very first open: ask where you're headed, over the example trip */
  try {
    if (W.isExample && !W.readOnly && !localStorage.getItem("waypoint-welcome") && W.quickStart) {
      localStorage.setItem("waypoint-welcome", "1");
      setTimeout(function () {
        W.quickStart(true);
      }, 400);
    }
  } catch (e) {}
})();
