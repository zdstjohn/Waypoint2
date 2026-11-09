/* Waypoint trip view: route, day picker, the day's plan with reroll, spatial explorer, and more ideas. Also the app controller. */
(function () {
  "use strict";
  var W = window.W, $ = W.$, esc = W.esc, S = W.S;
  function hashView() { return location.hash === "#plan" ? "setup" : location.hash === "#bookings" || location.hash === "#prepare" ? "book" : location.hash === "#recap" ? "recap" : location.hash === "#today" ? "go" : location.hash === "#explore" ? "explore" : location.hash === "#settings" ? "settings" : location.hash === "#kids" ? "kids" : "trip"; }
  /** @type {View} */ var view = hashView(); var explorerState = "none"; var firstRender = true;
  var VIEWS = { setup: 0, trip: 1, explore: 1, book: 2, go: 3, recap: 4, kids: 4, settings: 5 }, HASH = { go: "#today", setup: "#plan", trip: "#trip", explore: "#explore", book: "#prepare", recap: "#recap", kids: "#kids", settings: "#settings" }, prevView = "trip";
  W.view = function () { return view; };
  var ICON_CLOCK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/></svg>';
  /* recommended time to spend at a stop */
  function stayChip(it, food, slot) {
    var t = W.stayText(it, food, slot); if (!t) return "";
    return '<span class="dur" title="Recommended time to spend here">' + ICON_CLOCK + (/day$/.test(t) ? t.toLowerCase() : t) + "</span>";
  }
  /* how you get to a stop: a small walk, bus or car mark and the minutes */
  function legSvg(d) { return '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; }
  var LEG_IC = {
    walking: legSvg('<circle cx="9" cy="2.8" r="1.4"/><path d="M8.5 5.5L6.8 9l2.4 1.6L8.5 14.5M6.8 9L5 14.5M8.6 5.6l2.6 2.2 1.8.4M8.5 5.5L6 7l-.8 2.2"/>'),
    transit: legSvg('<rect x="3.5" y="2" width="9" height="10" rx="2"/><path d="M3.5 7.5h9M5.5 14l1-2M10.5 14l-1-2"/><circle cx="6" cy="9.8" r=".5" fill="currentColor"/><circle cx="10" cy="9.8" r=".5" fill="currentColor"/>'),
    driving: legSvg('<path d="M3 11V8.2L4.4 5h7.2L13 8.2V11z"/><path d="M3 8.2h10"/><circle cx="5.3" cy="11.3" r="1.1"/><circle cx="10.7" cy="11.3" r="1.1"/>')
  };
  var ICON_MORE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12.8" cy="8" r="1.5"/></svg>';
  var ICON_REROLL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 2.5v3h-3"/></svg>';

  function fmtDate(n, opts) {
    if (!S.start) return "";
    var d = new Date(S.start + "T12:00:00"); if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + n - 1);
    return d.toLocaleDateString(undefined, opts || { weekday: "short", month: "short", day: "numeric" });
  }
  /* menu: the restaurant's own menu page when Claude knows it, otherwise a search for that restaurant's menu */
  function menuLink(it, city) {
    var url = it.menu || "https://www.google.com/search?q=" + encodeURIComponent(it.n + " " + city + " menu"), host = "";
    if (it.menu) { try { host = new URL(it.menu).hostname.replace(/^www\./, ""); } catch (e) {} }
    return '<a class="menu-btn" href="' + esc(url) + '" target="_blank" rel="noopener" title="' + esc(host ? "Menu on " + host : "Search for the menu") + '">Menu</a>';
  }
  /* tickets: straight to the place's own official site, never a reseller or a search page.
     Verified links (checked against Wikidata) win; otherwise Claude's official link if it passes the reseller filter; otherwise nothing. */
  W.reviewsUrl = function (name, city) { return "https://www.google.com/search?q=" + encodeURIComponent(name + " " + city + " reviews"); };
  W.officialUrl = function (it, food, country, city) {
    var off = !food && W.officialLink && W.officialLink(it, country, city), url = it.book || "", verified = false;
    if (off) {
      var offHost = hostOf(off.url), bookHost = hostOf(url);
      /* keep Claude's deeper ticket page when it is on the same official site; otherwise use the verified site */
      if (!(url && bookHost && regOf(bookHost) === regOf(offHost))) url = off.url;
      verified = true;
    }
    var host = hostOf(url);
    if (!url || !host) return null;
    if (food && !W.needsBooking(it)) return null;
    if (!food && !W.isPaid(it) && !W.needsBooking(it)) return null;
    return { url: url, host: host, verified: verified };
  };
  W.hostOf = hostOf;
  function bookLink(it, city, food, country) {
    var o = W.officialUrl(it, food, country, city); if (!o) return "";
    return '<a class="book" href="' + esc(o.url) + '" target="_blank" rel="noopener" title="' + (o.verified ? "Official site, checked" : "Official site") + '">' + (food ? "Reserve" : "Tickets") + " · " + esc(o.host) + (o.verified ? ' <span class="ok" aria-label="checked official site">✓</span>' : "") + "</a>";
  }
  /* flights: a Google Flights search (airlines and fares change too often to pick one) */
  W.flightsUrl = function (from, to, d) {
    return "https://www.google.com/travel/flights?q=" + encodeURIComponent("Flights from " + from + " to " + to + (d ? " on " + W.isoDay(d) : "") + " one way");
  };
  var MODE = { train: "Train", bus: "Bus", ferry: "Ferry", catamaran: "Ferry", hydrofoil: "Ferry", vaporetto: "Ferry", ship: "Ferry", flight: "Flight", plane: "Flight", car: "Car", drive: "Car", boat: "Ferry", coach: "Bus" };
  /* a ferry whose own site Claude wasn't sure of: a search that finds the company's site (never a reseller we picked) */
  W.ferrySearch = function (o, a, b) {
    return { url: "https://www.google.com/search?q=" + encodeURIComponent((o.op ? o.op + " " : "") + "ferry " + (o.from || a.name) + " to " + (o.to || b.name) + " official site"),
      text: o.op ? "Find " + o.op + " online" : "Find the ferry company online" };
  };
  W.isFerry = function (m) { return /ferry|boat|catamaran|hydrofoil|vaporetto|ship/i.test(m || ""); };
  W.modeName = function (m) { m = String(m || "").toLowerCase(); for (var k in MODE) if (m.indexOf(k) > -1) return MODE[k]; return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Travel"; };
  /* travel day: how to get from the last place to this one, with the operators' own sites */
  /* how to look at the trip: one day, that day on the map, or every day at a glance. Labelled, so it's clear what each
     one does. (The storybook, the whole trip a page a day, opens from the trip menu and from All days.) */
  var VSW_IC = {
    days: '<path d="M6.5 5h10M6.5 10h10M6.5 15h10"/><circle cx="3.3" cy="5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.3" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="3.3" cy="15" r=".9" fill="currentColor" stroke="none"/>',
    map: '<path d="M2.5 5.5l5-2 5 2 5-2v11l-5 2-5-2-5 2z"/><path d="M7.5 3.5v11M12.5 5.5v11"/>',
    all: '<rect x="2.5" y="3" width="15" height="14" rx="2"/><path d="M2.5 7.5h15M7.5 7.5V17M12.5 7.5V17"/>',
    story: '<path d="M10 5.5C8.2 4.2 5.7 3.8 3 4.2v11.3c2.7-.4 5.2 0 7 1.3 1.8-1.3 4.3-1.7 7-1.3V4.2c-2.7-.4-5.2 0-7 1.3zM10 5.5v11.3"/>'
  };
  W.viewSwitch = function () {
    var cur = S.glanceOpen ? "all" : S.tview === "map" ? "map" : "days";
    return '<div class="vsw" role="radiogroup" aria-label="How to see the trip">' + [["days", "Day"], ["map", "Map"], ["all", "All days"]].map(function (v) {
      return '<button type="button" role="radio" aria-checked="' + (cur === v[0]) + '" data-vsw="' + v[0] + '"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + VSW_IC[v[0]] + "</svg><span>" + v[1] + "</span></button>";
    }).join("") + "</div>";
  };
  function legCard(P, day, T) {
    var L = W.legFor(P, day.stop); if (!L) return "";
    W.loadLeg(L.a, L.b);
    var tr = T && T.travel, busy = W.legBusy(L.a, L.b);
    var h = '<section class="legcard sk"><div class="legcard-h"><h3>Getting here from ' + esc(L.a.name) + "</h3>" +
      (tr ? '<span class="small muted">' + W.clock(tr.start) + "–" + W.clock(tr.end) + (L.guessed ? " (rough)" : "") + "</span>" : "") + "</div>";
    if (L.opts && L.opts.length) {
      /* one row per way to go; the one you're taking opens up with where to book it */
      h += '<div class="legopts" role="radiogroup" aria-label="How you\'ll get here">' + L.opts.map(function (o, i) {
        var sel = i === L.pick, fy = W.isFerry(o.mode), fl = /flight|plane/.test(o.mode), host = o.url && hostOf(o.url);
        var head = '<button type="button" class="lo-h" role="radio" aria-checked="' + sel + '"' + (sel || W.readOnly ? ' tabindex="' + (sel ? 0 : -1) + '"' : "") +
          (W.readOnly ? " disabled" : ' data-legpick="' + i + '" data-legkey="' + esc(L.key) + '"') + ">" +
          '<span class="lo-dot" aria-hidden="true"></span>' + modeIcon(o.mode) +
          '<span class="lo-n"><b>' + esc(W.modeName(o.mode)) + "</b>" + (o.op ? '<span> ' + esc(o.op) + "</span>" : "") + "</span>" +
          '<span class="lo-m">' + esc([o.dur, o.price].filter(Boolean).join(" · ")) + "</span></button>";
        if (!sel) return '<div class="lo">' + head + "</div>";
        var where = [[o.from, o.to].filter(Boolean).join(" → "), o.freq].filter(Boolean).map(function (t) { return '<span class="nw">' + esc(t) + "</span>"; }).join(" · ");
        var book = host ? '<a class="lo-book" href="' + esc(o.url) + '" target="_blank" rel="noopener">Book on ' + esc(host) + ' <span aria-hidden="true">↗</span></a>'
          : fy ? '<a class="lo-book quiet" href="' + esc(W.ferrySearch(o, L.a, L.b).url) + '" target="_blank" rel="noopener">' + esc(W.ferrySearch(o, L.a, L.b).text) + ' <span aria-hidden="true">↗</span></a>' : "";
        /* the ferry on Ferryhopper too, if you use it */
        var alt = fy && W.altUrls ? W.altUrls("ferry", { a: L.a, b: L.b }).map(function (u) { return link(u[1], esc(u[0]) + " ↗"); }).join("") : "";
        var extra = alt + (fl ? link(W.flightsUrl(o.from || L.a.name, o.to || L.b.name, W.dateOf(day.n)), "Compare flights") : "") + (o.book ? '<button type="button" class="linkish small" data-gobook="' + esc("leg|" + W.legKey(L.a, L.b)) + '">On your To book list</button>' : "");
        return '<div class="lo sel">' + head + '<div class="lo-d">' + (where ? '<span class="small">' + where + "</span>" : "") +
          (book || extra ? '<div class="lo-act">' + book + extra + "</div>" : "") +
          (o.note ? '<p class="small muted">' + esc(o.note) + "</p>" : "") + "</div></div>";
      }).join("") + "</div>";
    } else if (busy) h += '<div class="loading">Finding trains, ferries and flights…</div>';
    else if (W.sampleState !== "on") h += '<p class="small muted">' + esc(W.betweenCities(L.km)) + ". " + link(W.gmapsDir(W.stopAt(L.a), { n: L.b.name + ", " + L.b.country, lat: null }, "transit"), "Directions") + "</p>";
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
  function shortNote(t) { for (var i = 0; i < SHORT.length; i++) if (SHORT[i][0].test(t)) return t.replace(SHORT[i][0], SHORT[i][1]); return t; }
  W.shortNote = shortNote;
  function beachNote(it, P) {
    if (!W.isBeach || !W.isBeach(it) || !it.bch || !P.p.kid) return "";
    var f = W.beachFit(it);
    return f === "safe" ? '<span class="good">Calm, shallow water: good for little kids</span>' : f === "care" ? '<span class="warn">' + (it.bch.calm === "often rough" ? "Often rough" : "Deep or rocky") + ": keep little ones close</span>" : "";
  }
  function beachCheck(it) {
    var b = it.bch; if (!W.isBeach || !W.isBeach(it) || !b || !b.calm) return "";
    var chips = [
      b.calm === "calm" ? "Calm water" : b.calm === "some waves" ? "Some waves" : "Often rough",
      b.shallow === true ? "Shallow entry" : b.shallow === false ? "Gets deep quickly" : "",
      b.sand ? { sand: "Sandy", pebbles: "Pebbles", mixed: "Sand and pebbles", rocks: "Rocky" }[b.sand] : "",
      b.shade ? { umbrellas: "Umbrellas to rent", trees: "Shade from trees", little: "Little shade", none: "No shade" }[b.shade] : "",
      b.lifeguard === true ? "Lifeguard in summer" : b.lifeguard === false ? "No lifeguard" : "",
      b.walk != null ? (b.walk <= 2 ? "Right by parking" : b.walk + " min walk from parking") : "",
      b.facilities === true ? "Toilets or café" : b.facilities === false ? "No facilities" : ""
    ].filter(Boolean);
    return '<div class="bcheck"><b>Beach check</b><div class="bc-chips">' + chips.map(function (c) { return '<span class="bc">' + esc(c) + "</span>"; }).join("") + "</div>" +
      (b.note ? '<p class="small muted">' + esc(b.note) + "</p>" : "") + "</div>";
  }

  /* Explore's filters */
  var INDOOR = /museum|gallery|aquarium|palace|palazzo|cathedral|duomo|basilica|church|chapel|chiesa|library|theatre|theater|cinema|indoor|catacomb|planetarium|science|hall/i;
  function isIndoor(it) { var k = W.picKind ? W.picKind(it, false) : ""; return /^(museum|church|temple|spa)$/.test(k) || INDOOR.test(it.n); }
  function exChips(F, eat, P, hasBeach, n, total) {
    var c = [["near", "Near today's stops"]];
    if (!eat) c.push(["free", "Free"], ["indoor", "Indoors"]);
    if (P.p.kid) c.push(["kids", P.p.toddler ? "Great for toddlers" : "Great for kids"]);
    if (hasBeach) c.push(["beach", "Calm beaches"]);
    var any = c.some(function (x) { return F[x[0]]; });
    return '<div class="ex-f" role="group" aria-label="Filter ideas">' + c.map(function (x) { return '<button type="button" class="chip" data-exf="' + x[0] + '" aria-pressed="' + !!F[x[0]] + '">' + esc(x[1]) + "</button>"; }).join("") +
      '<button type="button" class="chip" data-exsort="1" aria-pressed="' + (S.exSort === "near") + '">Nearest first</button></div>' +
      (any ? '<p class="small muted ex-n">' + n + " of " + total + (n ? "" : " · nothing matches all of those") + "</p>" : "");
  }
  /* the day picker: each city's name once, with its day numbers under it */
  function dayGroups(P, tn) {
    var out = "", cur = null;
    P.days.forEach(function (d) {
      if (!cur || cur.stop !== d.stop) { if (cur) out += "</div></div>"; cur = d; out += '<div class="dgroup"><span class="dg-c">' + esc(d.city) + '</span><div class="dg-d">'; }
      out += '<button type="button" class="dpill' + (d.n === tn ? " today" : "") + '" data-day="' + d.n + '" aria-current="' + (d.n === S.day) + '" aria-label="' + (d.n === tn ? "Today, " : "") + "Day " + d.n + ", " + esc(d.city) + '"><b>' + d.n + "</b></button>";
    });
    return out + (cur ? "</div></div>" : "");
  }
  /* how full the day is, as a few bars at the end of the day's one line */
  function dayLevel(day, P) {
    if (!day.slots || !day.slots.length) return "";
    var E = W.dayEnergy(day, P, W.dayTimes(day, P)); if (!E) return "";
    var tip = (E.act ? W.fmtMin(Math.round(E.act / 15) * 15) + " of sightseeing · " : "") + E.walk + " km on foot" + (E.travel ? " · " + W.fmtMin(E.travel) + " travelling" : "");
    var bars = ""; for (var i = 1; i <= 4; i++) bars += "<i" + (i <= E.level ? ' class="on"' : "") + "></i>";
    return ' · <span class="energy lv' + E.level + '" title="' + esc(tip) + '"><span class="bars" aria-hidden="true">' + bars + "</span>" + (day.rest ? "Rest day" : E.label + " day") + "</span>";
  }
  /* the end of the day: where you sleep, and making it a rest day */
  function dayEnd(day, P, home, geoBusy) {
    var rk = W.restKey(day), canRest = !(W.readOnly || day.tripFirst || day.moveFrom || day.tripLast);
    return '<div class="day-end sk"><span class="de-i" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 15.5v-9M2.5 12.5h15v3M17.5 12.5v-2a2.5 2.5 0 0 0-2.5-2.5H9v4.5"/><circle cx="5.8" cy="9.8" r="1.6"/></svg></span>' +
      '<div><span class="small muted">Staying at</span><b>' + esc(home.label) + "</b>" + (geoBusy ? '<span class="small muted">locating…</span>' : "") + "</div>" +
      '<div class="de-a">' + (W.readOnly ? "" : '<button type="button" class="chip-a' + (home.set ? "" : " pri") + '" data-gostay="' + day.stop + '">' + (home.set ? "Change" : "Pick a place") + "</button>") +
      (canRest ? '<button type="button" class="linkish" data-rest="' + esc(rk) + '">' + (day.rest ? "Undo rest day" : "Make it a rest day") + "</button>" : "") + "</div></div>";
  }
  /* small line icons for each way of getting around */
  var ICON = {
    Train: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8.5 20.5 10 16M15.5 20.5 14 16"/><circle cx="9" cy="13" r=".8"/><circle cx="15" cy="13" r=".8"/>',
    Ferry: '<path d="M2.5 19c1.6 1.2 3.2 1.2 4.8 0 1.6-1.2 3.2-1.2 4.8 0 1.6 1.2 3.2 1.2 4.8 0 1.6-1.2 3.2-1.2 4.8 0"/><path d="M4.5 15.5 3.5 11h17l-1 4.5"/><path d="M7.5 11V7h9v4M12 7V4"/>',
    Bus: '<rect x="4.5" y="3" width="15" height="14" rx="3"/><path d="M4.5 10.5h15M8 20.5V17M16 20.5V17"/>',
    Flight: '<path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2.2 1.6V21l3.7-1 3.7 1v-1.4L13 18v-5z"/>',
    Car: '<path d="M5 16.5V12l2-5h10l2 5v4.5z"/><path d="M5 12h14"/><circle cx="8.5" cy="16.5" r="1.8"/><circle cx="15.5" cy="16.5" r="1.8"/>'
  };
  function modeIcon(m) { var k = W.modeName(m); return '<svg class="lo-i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ICON[k] || ICON.Car) + "</svg>"; }
  /* jet lag: a few days of shifting sleep before you go, and an easy start */
  function jetCard(P) {
    var J = W.jetlag(P), g = Math.abs(J.gap || 0); if (g < 3) return "";
    var d1 = W.dateOf(1), pre = d1 ? new Date(d1.getTime() - (g >= 7 ? 4 : 3) * 864e5) : null, kids = P.p.kid, dir = J.east ? "earlier" : "later";
    var city = P.stops[0].name, hrs = (g % 1 ? g : Math.round(g)) + " hour" + (g === 1 ? "" : "s");
    var li = [
      "<b>Before you go.</b> " + (pre ? "From " + pre.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ", move" : "For 3 or 4 days before, move") + " bedtime and wake-up " + dir + " by 30 minutes a day" + (kids ? ", the kids too. Dim lights in the evening helps." : "."),
      "<b>On the way.</b> " + (J.east ? "Sleep on the overnight flight if you can; set watches to " + city + " time when you board." : "Stay awake on the flight as much as you can; set watches to " + city + " time when you board."),
      "<b>Arrival day.</b> Get outside in daylight" + (J.east ? " in the morning" : " in the afternoon") + ". Keep naps under 90 minutes and before 3 PM. Early dinner, and bed close to the usual local bedtime.",
      J.days ? "<b>The first " + (J.days > 1 ? J.days + " days" : "day") + ".</b> Kept light: nothing timed before mid-morning, dinner by 6:30 PM." : ""
    ].filter(Boolean);
    return '<details class="jetlag sk"' + (S.jetOpen ? " open" : "") + ' data-fold="jet"><summary><span><b>Jet lag plan</b> <span class="muted">· ' + esc(city) + " is " + esc(hrs) + (J.east ? " ahead of" : " behind") + " home</span></span>" +
      '<svg class="fold-chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg></summary><ul>' + li.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul></details>";
  }
  /* arrival and going home: the flight */
  function flightCard(P, day) {
    var ap = P.ap, st = P.stops[day.stop]; if (!ap) return "";
    var out = day.tripFirst, d = W.dateOf(day.n), url = out ? W.flightsUrl(ap.code || ap.name, st.name, d) : W.flightsUrl(st.name, ap.code || ap.name, d);
    return '<section class="legcard sk"><div class="legcard-h"><h3>' + (out ? "Flying in from " + esc(ap.code || ap.name) : "Flying home to " + esc(ap.code || ap.name)) + "</h3>" +
      '<span class="small muted">' + esc(W.betweenCities(W.km(ap, W.stopAt(st)))) + "</span></div>" +
      '<div class="lo-act">' + '<a class="lo-book quiet" href="' + esc(url) + '" target="_blank" rel="noopener">Find flights <span aria-hidden="true">↗</span></a>' + "</div>" +
      '<p class="small muted">' + (out ? "Times today assume you land early or the night before. If you land later, keep the first stops for tomorrow." : "Leave for the airport about 3 hours before an international flight.") + "</p></section>";
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function regOf(h) { var p = h.split("."), r = p.slice(-2).join("."); return /^(co|com|org|gov|ac|net)\.[a-z]{2}$/.test(r) && p.length > 2 ? p.slice(-3).join(".") : r; }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function short(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  /* ---------- spatial explorer ---------- */
  /* ---------- area sketch beneath the pins ---------- */
  var SIDE = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [0.71, -0.71], NW: [-0.71, -0.71], SE: [0.71, 0.71], SW: [-0.71, 0.71] };
  function inPoly(pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function polyPath(ps) { return "M" + ps.map(function (q) { return q.x.toFixed(1) + " " + q.y.toFixed(1); }).join(" L") + "Z"; }
  function underlay(area, toScreen, landPts) {
    var out = "";
    (area.water || []).forEach(function (w) {
      var ps = w.pts.map(function (p) { return toScreen({ lat: p[0], lng: p[1] }); });
      if (ps.length < 2) return;
      if (w.kind === "river" || w.kind === "canal") {
        out += '<polyline points="' + ps.map(function (q) { return q.x.toFixed(1) + "," + q.y.toFixed(1); }).join(" ") + '" fill="none" stroke="var(--water)" stroke-width="' + (w.kind === "canal" ? 4 : 7) + '" stroke-linecap="round" stroke-linejoin="round" filter="url(#rough)"/>';
        return;
      }
      var closed = w.side === "IN" || Math.hypot(ps[0].x - ps[ps.length - 1].x, ps[0].y - ps[ps.length - 1].y) < 6;
      var shape = null;
      if (closed) shape = ps;
      else {
        var v = SIDE[w.side]; if (!v) return;
        var a0 = ps[0], a1 = ps[1], z0 = ps[ps.length - 1], z1 = ps[ps.length - 2];
        function ext(p, q) { var dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1; return { x: p.x + dx / d * 2000, y: p.y + dy / d * 2000 }; }
        var e0 = ext(a0, a1), e1 = ext(z0, z1);
        function build(sgn) { return [e0].concat(ps, [e1, { x: e1.x + v[0] * sgn * 4000, y: e1.y + v[1] * sgn * 4000 }, { x: e0.x + v[0] * sgn * 4000, y: e0.y + v[1] * sgn * 4000 }]); }
        /* sanity check: your lodging and today's stops should be on land; if the water would cover them, flip it or draw just the shore */
        function wet(poly) { return landPts.filter(function (q) { return inPoly(q, poly); }).length; }
        var A = build(1), B = build(-1), wa = wet(A), wb = wet(B);
        shape = wa <= landPts.length / 3 ? A : wb <= landPts.length / 3 ? B : null;
        if (!shape) { out += '<polyline points="' + ps.map(function (q) { return q.x.toFixed(1) + "," + q.y.toFixed(1); }).join(" ") + '" fill="none" stroke="var(--water)" stroke-width="4" filter="url(#rough)"/>'; return; }
      }
      if (closed && landPts.length && inPoly(landPts[0], shape)) { out += '<path d="' + polyPath(shape) + '" fill="none" stroke="var(--water)" stroke-width="3" filter="url(#rough)"/>'; return; }
      out += '<path d="' + polyPath(shape) + '" fill="var(--water)" stroke="var(--water-edge)" stroke-width="2" filter="url(#rough)"/>';
    });
    return out;
  }

  /** the explorer view; explorerState says what it drew (read by the map note) */
  function explorer(day, home, pts, pool) {
    /* phones get a narrower canvas so labels stay readable once it scales down */
    var narrow = window.innerWidth < 560, Wd = narrow ? 340 : 500, Hd = narrow ? 330 : 440, pad = 34;
    var origin = home.lat != null ? home : pts.filter(function (p) { return p.lat != null; })[0];
    if (!origin) return '<div class="empty" style="margin:14px;border-style:solid">The map appears once this city\'s places load.</div>';
    var c = Math.cos(origin.lat * Math.PI / 180);
    function xy(p) { return { x: (p.lng - origin.lng) * c * 111.32, y: -(p.lat - origin.lat) * 110.57 }; }
    var stops = pts.filter(function (p) { return p.lat != null; }).map(function (p) { var q = xy(p); q.p = p; return q; });
    /* a real street map for this city, when one has been built into the app */
    var M = W.cityMap(day.country, day.city, origin.lat, origin.lng), mapSt = W.cityMapState(day.country, day.city, origin.lat, origin.lng);
    /* fit the view to your lodging and every stop; every pin is drawn exactly where the place is */
    var minX = 0, maxX = 0, minY = 0, maxY = 0;
    stops.forEach(function (q) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); });
    var midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    var halfX = Math.max(0.35, (maxX - minX) / 2), halfY = Math.max(0.35, (maxY - minY) / 2);
    var sc = Math.min((Wd / 2 - pad) / halfX, (Hd / 2 - pad) / halfY);
    if (M) sc /= 1.1;                     /* a little surrounding street context */
    sc *= (S.mapZoom || 1);
    var cx = Wd / 2 - midX * sc, cy = Hd / 2 - midY * sc;   /* where your lodging falls on screen */
    function P(q) { return { x: cx + q.x * sc, y: cy + q.y * sc }; }
    function inView(a, m) { m = m || 0; return a.x >= m && a.x <= Wd - m && a.y >= m && a.y <= Hd - m; }
    var ringsAll = [0.25, 0.5, 1, 2, 3, 5, 10, 20], rings = M ? [] : ringsAll.filter(function (r) { return r * sc < Wd / 2 - 8 && r * sc > 18; }).slice(-3);
    var svg = '<svg class="map" viewBox="0 0 ' + Wd + " " + Hd + '" role="img" aria-label="Map of today\'s stops around where you\'re staying">';
    /* the area sketch (only where no street map exists): shorelines, rivers, parks and named places */
    var half = Math.max(Wd, Hd) / 2 / sc, buckets = [1, 2, 4, 8, 15, 30, 60], radius = 60;
    for (var bi = 0; bi < buckets.length; bi++) if (buckets[bi] >= half * 1.15) { radius = buckets[bi]; break; }
    var area = !M && mapSt === "none" ? W.loadArea(day.country, day.city, { lat: origin.lat, lng: origin.lng, label: home.label }, radius) : null;
    explorerState = M ? "map" : mapSt === "loading" ? "maploading" : area ? "ready" : W.status["area|" + W.areaKey(day.country, day.city, origin, radius)] === "loading" ? "loading" : "none";
    var toScreen = function (p) { return P(xy(p)); };
    var homeAt = { x: cx, y: cy };
    var landPts = [homeAt].concat(stops.map(function (q) { return P(q); }));
    var places = (area ? area.places : []).slice();
    if (M) {
      /* real streets, water, parks and neighborhood names, in the same projection as the pins */
      var mres = W.drawMap(M, { lat0: origin.lat, lng0: origin.lng, c: c, sc: sc, cx: cx, cy: cy, Wd: Wd, Hd: Hd });
      svg += mres.svg;
      places = mres.labels.map(function (l) { return { n: l.n, type: l.t === "city" || l.t === "town" ? "town" : l.t === "village" || l.t === "hamlet" ? "village" : "district", lat: l.lat, lng: l.lng }; });
    } else {
      (pool && pool.stay || []).forEach(function (n) { if (n.lat != null && !places.some(function (p) { return W.norm(p.n) === W.norm(n.n); })) places.push({ n: n.n, type: "district", lat: n.lat, lng: n.lng }); });
    }
    if (area) svg += underlay(area, toScreen, landPts);
    places.forEach(function (pl) {
      if (pl.type !== "park" && pl.type !== "beach") return;
      var q = toScreen(pl), r = Math.max(10, Math.min(40, 0.35 * sc));
      svg += '<ellipse cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" rx="' + f1(r * 1.3) + '" ry="' + f1(r) + '" fill="var(--' + (pl.type === "park" ? "park" : "sandsoft") + ')" filter="url(#rough)"/>';
    });
    var ringBoxes = [];
    rings.forEach(function (r) {
      var lx = cx + r * sc * 0.707 + 3, ly = cy - r * sc * 0.707 - 3;
      if (lx + 44 < Wd && ly > 14 && lx > 0 && !(lx + 44 > Wd - 36 && ly < 48)) ringBoxes.push({ x1: lx, y1: ly - 13, x2: lx + 42, y2: ly + 3, x: lx, y: ly, t: r < 1 ? r * 1000 + " m" : r + " km" });
      svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (r * sc).toFixed(1) + '" fill="none" stroke="var(--ring)" stroke-width="1.5" stroke-dasharray="4 5" filter="url(#rough)"/>';
    });
    svg += '<g font-family="var(--f-label)" font-size="15" fill="var(--fg)" paint-order="stroke" stroke="var(--map)" stroke-width="3"><text x="' + (Wd - 22) + '" y="22" text-anchor="middle">N</text><path d="M' + (Wd - 22) + ' 27 l-4 9 h8 z" fill="var(--fg)"/></g>';
    if (M) {
      /* scale bar instead of rings on a real map */
      var nice = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50], bar = nice.filter(function (k) { return k * sc <= Wd * 0.28; }).pop() || 0.05, bw = bar * sc;
      svg += '<g transform="translate(12 ' + (Hd - 14) + ')" font-family="var(--f-body)" font-size="11" font-weight="800" fill="var(--fg)"><rect x="-4" y="-16" width="' + f1(bw + 8 + 42) + '" height="22" rx="6" fill="var(--map)" opacity=".85"/><path d="M0 0 H' + f1(bw) + ' M0 -4 V0 M' + f1(bw) + ' -4 V0" stroke="var(--fg)" stroke-width="2"/><text x="' + f1(bw + 6) + '" y="0">' + (bar < 1 ? bar * 1000 + " m" : bar + " km") + "</text></g>";
    }
    /* route: lodging, each stop in order, back to the lodging (through the true positions) */
    var ordered = stops.slice().sort(function (a, b) { return a.p.i - b.p.i; });
    var seq = [homeAt].concat(ordered.map(function (q) { return P(q); })).concat([homeAt]);
    svg += '<polyline points="' + seq.map(function (s) { return s.x.toFixed(1) + "," + s.y.toFixed(1); }).join(" ") + '" fill="none" stroke="var(--fg)" stroke-width="2.2" stroke-dasharray="7 6" stroke-linejoin="round" stroke-linecap="round" opacity=".7"/>';
    /* lodging marker, exactly at the lodging */
    if (inView(homeAt, -12)) svg += '<g transform="translate(' + cx.toFixed(1) + "," + cy.toFixed(1) + ')"><rect x="-11" y="-11" width="22" height="22" rx="6" fill="var(--fg)"/><path d="M-6 1 L0 -5 L6 1 V6 H-6 Z" fill="var(--bg)"/></g>';
    /* pins: places closer together than a pin's width share one marker at their common spot; nothing is moved */
    var groups = [], off = [];
    ordered.forEach(function (q) {
      var a = P(q);
      if (!inView(a, 4)) { off.push({ q: q, at: a }); return; }
      var g = groups.filter(function (g) { return Math.hypot(g.at.x - a.x, g.at.y - a.y) < 18; })[0];
      if (g) { g.items.push(q); g.at = { x: (g.at.x * (g.items.length - 1) + a.x) / g.items.length, y: (g.at.y * (g.items.length - 1) + a.y) / g.items.length }; }
      else groups.push({ at: a, items: [q] });
    });
    var boxes = [{ x1: cx - 12, y1: cy - 12, x2: cx + 12, y2: cy + 12 }, { x1: Wd - 34, y1: 6, x2: Wd - 10, y2: 40 }], marks = "", labels = "";
    groups.forEach(function (g) {
      var txt = g.items.map(function (q) { return q.p.num; }).join("·"), w = Math.max(24, 10 + txt.length * 8);
      g.w = w; boxes.push({ x1: g.at.x - w / 2, y1: g.at.y - 12, x2: g.at.x + w / 2, y2: g.at.y + 12 });
    });
    ringBoxes.forEach(function (rb) {
      if (boxes.some(function (o) { return rb.x1 < o.x2 && rb.x2 > o.x1 && rb.y1 < o.y2 && rb.y2 > o.y1; })) return;
      boxes.push(rb); svg += '<text x="' + rb.x.toFixed(1) + '" y="' + rb.y.toFixed(1) + '" font-size="15" font-family="var(--f-note)" fill="var(--muted)" paint-order="stroke" stroke="var(--map)" stroke-width="3" stroke-linejoin="round">' + rb.t + "</text>";
    });
    function hit(b) { return b.x1 < 4 || b.x2 > Wd - 4 || b.y1 < 4 || b.y2 > Hd - 4 || boxes.some(function (o) { return b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1; }); }
    groups.forEach(function (g) {
      var first = g.items[0].p, col = g.items.length > 1 ? "var(--fg)" : first.food ? "var(--food)" : "var(--accent)", ink = g.items.length > 1 ? "var(--bg)" : "var(--accent-ink)";
      var txt = g.items.map(function (q) { return q.p.num; }).join("·"), at = g.at, w = g.w;
      marks += w > 24
        ? '<rect x="' + (at.x - w / 2).toFixed(1) + '" y="' + (at.y - 12).toFixed(1) + '" width="' + w + '" height="24" rx="12" fill="' + col + '" stroke="var(--map)" stroke-width="2"/>'
        : '<circle cx="' + at.x.toFixed(1) + '" cy="' + at.y.toFixed(1) + '" r="12" fill="' + col + '" stroke="var(--fg)" stroke-width="2"/>';
      marks += '<text x="' + at.x.toFixed(1) + '" y="' + (at.y + 4).toFixed(1) + '" text-anchor="middle" font-size="12" font-family="var(--f-display)" fill="' + ink + '">' + txt + "</text>";
      var label = g.items.length > 1 ? short(first.n, 16) + " +" + (g.items.length - 1) : short(first.n, 22), lw = label.length * 7.4 + 8;
      var tries = [[w / 2 + 4, 4, "start"], [-w / 2 - 4, 4, "end"], [0, -17, "middle"], [0, 27, "middle"]];
      for (var t = 0; t < tries.length; t++) {
        var tx = at.x + tries[t][0], ty = at.y + tries[t][1], an = tries[t][2];
        var x1 = an === "start" ? tx : an === "end" ? tx - lw : tx - lw / 2, b = { x1: x1, y1: ty - 12, x2: x1 + lw, y2: ty + 4 };
        if (!hit(b)) { boxes.push(b); labels += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + an + '" font-size="12.5" font-family="var(--f-body)" font-weight="800" fill="var(--fg)" paint-order="stroke" stroke="var(--map)" stroke-width="3.5">' + esc(label) + "</text>"; break; }
      }
    });
    /* stops outside the frame: an arrow at the edge pointing toward them (they aren't drawn as if they were there) */
    var vc = { x: Wd / 2, y: Hd / 2 };
    var edges = [];
    off.concat(inView(homeAt, -12) ? [] : [{ home: true, at: homeAt }]).forEach(function (o) {
      var dx = o.at.x - vc.x, dy = o.at.y - vc.y, m = 16;
      var t = Math.min(dx > 0 ? (Wd - m - vc.x) / dx : dx < 0 ? (m - vc.x) / dx : 1e9, dy > 0 ? (Hd - m - vc.y) / dy : dy < 0 ? (m - vc.y) / dy : 1e9);
      var e = { x: vc.x + dx * t, y: vc.y + dy * t, ang: Math.atan2(dy, dx) * 180 / Math.PI, km: Math.hypot(dx, dy) / sc * (1 - t), o: o };
      /* arrows that would sit on top of each other share one */
      var same = edges.filter(function (g) { return Math.hypot(g.x - e.x, g.y - e.y) < 20; })[0];
      if (same) { same.items.push(e); same.km = Math.min(same.km, e.km); } else { e.items = [e]; edges.push(e); }
    });
    edges.forEach(function (g) {
      var nums = g.items.map(function (e) { return e.o.home ? "⌂" : e.o.q.p.num; }).join("·"), w = Math.max(20, 8 + nums.length * 7);
      marks += '<g opacity=".92"><g transform="translate(' + g.x.toFixed(1) + "," + g.y.toFixed(1) + ") rotate(" + g.ang.toFixed(0) + ')"><path d="M' + (w / 2 + 4) + ' 0 L' + (w / 2 - 5) + ' -6 L' + (w / 2 - 5) + ' 6 Z" fill="var(--fg)"/></g>' +
        '<rect x="' + (g.x - w / 2).toFixed(1) + '" y="' + (g.y - 10).toFixed(1) + '" width="' + w + '" height="20" rx="10" fill="var(--surface)" stroke="var(--fg)" stroke-width="1.6" stroke-dasharray="3 2"/>' +
        '<text x="' + g.x.toFixed(1) + '" y="' + (g.y + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-family="var(--f-display)" fill="var(--fg)">' + nums + "</text></g>";
      var first = g.items[0].o, lab = (first.home ? "Lodging" : short(first.q.p.n, 16)) + (g.items.length > 1 ? " +" + (g.items.length - 1) : "") + " · " + W.fmtKm(g.km) + " away", lw = lab.length * 6.6 + 8;
      var ly = g.y + (g.y > Hd / 2 ? -16 : 24), lx = Math.max(6, Math.min(Wd - lw - 6, g.x - lw / 2)), b = { x1: lx, y1: ly - 11, x2: lx + lw, y2: ly + 3 };
      if (!hit(b)) { boxes.push(b); labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" font-size="11.5" font-family="var(--f-body)" font-weight="700" fill="var(--muted)" paint-order="stroke" stroke="var(--map)" stroke-width="3">' + esc(lab) + "</text>"; }
    });
    /* named places, only where they don't collide with pins or their labels */
    var placeLbl = "";
    places.forEach(function (pl) {
      var q = toScreen(pl); if (q.x < 6 || q.x > Wd - 6 || q.y < 10 || q.y > Hd - 6) return;
      var town = pl.type === "town" || pl.type === "village" || pl.type === "district";
      var txt = short(pl.n, 20), w = txt.length * (town ? 7.6 : 6.6) + 6, bx = { x1: q.x - w / 2, y1: q.y - 13, x2: q.x + w / 2, y2: q.y + 5 };
      if (hit(bx)) return;
      boxes.push(bx);
      placeLbl += (pl.type === "landmark" ? '<circle cx="' + q.x.toFixed(1) + '" cy="' + (q.y + 6).toFixed(1) + '" r="2" fill="var(--muted)"/>' : "") +
        '<text x="' + q.x.toFixed(1) + '" y="' + q.y.toFixed(1) + '" text-anchor="middle" font-size="' + (town ? 14 : 15) + '" font-family="var(' + (town ? "--f-label" : "--f-note") + ')" letter-spacing="' + (town ? ".06em" : "0") + '" fill="var(--place)" paint-order="stroke" stroke="var(--map)" stroke-width="3.5" stroke-linejoin="round">' + esc(town ? txt.toUpperCase() : txt) + "</text>";
    });
    svg += placeLbl + marks + labels;
    return svg + "</svg>";
  }

  /* ---------- trip view ---------- */
  var swapOpen = null, swapAll = false, tab = "do", showAll = false;
  var CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  function stopAt(s) { return s.c && s.c.lat != null ? s.c : W.homebase(s.country, s.name); }
  var link = W.extLink;

  /* the three closest fits, as photo cards you can tap */
  function swapCards(list, x, food, day, nm) {
    if (!list.length) return "";
    return '<div class="swapcards">' + list.map(function (o) {
      var it = o.it, ph = W.picture(it, food, day.country, day.city), info = [o.km != null ? W.fmtKm(o.km) + " away" : "", food ? it.cuisine || it.price : W.stayText(it, food, x.slot)].filter(Boolean).join(" · ");
      return '<button type="button" class="scard" data-use="' + x.slot + '" data-name="' + esc(it.n) + '" aria-label="Use ' + esc(it.n) + " for " + nm + '">' +
        (ph ? '<span class="sc-pic">' + ph + "</span>" : "") + "<span class=\"nm\">" + esc(it.n) + "</span>" + (info ? '<span class="info">' + esc(info) + "</span>" : "") + "</button>";
    }).join("") + "</div>";
  }
  /* swap a slot: the next suggestion, or pick from the best options for that time of day */
  function swapPanel(day, x, P) {
    var opts = W.slotOptions(day, x.slot, P), food = W.isFood(x.slot), n = swapAll ? opts.length : 5, ck = W.cityKey(day.country, day.city);
    var busy = W.cityBusy(ck), pool = W.pool(day.country, day.city);
    var nm = W.SLOT_NAME[x.slot].toLowerCase();
    return '<div class="swap sk" role="region" aria-label="Swap ' + nm + '"><div class="swap-h">' +
      '<button type="button" class="btn sm" data-next="' + x.slot + '">' + ICON_REROLL + (x.item ? "Next suggestion" : "Suggest one") + "</button>" +
      '<button type="button" class="icon-btn" data-swapclose="1" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
      (opts.length ? '<b class="swap-l">or pick one for ' + nm + "</b>" + swapCards(opts.slice(0, 3), x, food, day, nm) + (opts.length > 3 ? '<div class="opts">' : "") + opts.slice(3, n).map(function (o) {
        var it = o.it, info = [W.stayText(it, food, x.slot), o.km != null ? W.fmtKm(o.km) + " away" : "", food ? it.cuisine : it.ticket].filter(Boolean).join(" · ");
        return '<button type="button" class="opt" data-use="' + x.slot + '" data-name="' + esc(it.n) + '" aria-label="Use ' + esc(it.n) + " for " + nm + '"><span class="nm">' + esc(it.n) + '</span><span class="desc">' + esc(it.d) + "</span>" + (info ? '<span class="info">' + esc(info) + "</span>" : "") + "</button>";
      }).join("") + (opts.length > 3 ? "</div>" : "") : '<p class="small muted">No other ideas nearby yet.</p>') +
      '<div class="swap-f">' + (opts.length > n ? '<button type="button" class="linkish" data-swapall="1">Show all ' + opts.length + "</button>" : swapAll && opts.length > 5 ? '<button type="button" class="linkish" data-swapall="1">Show fewer</button>' : "") +
      (pool && pool.fallback ? "" : busy ? '<span class="loading">Finding more…</span>' : '<button type="button" class="linkish" data-more="1">Find more ideas</button>') + "</div></div>";
  }

  W.renderTrip = function (P, target) {
    /* the map is a way of looking at the trip (list · map · storybook); the old Explore view draws the same thing */
    var xp = target === "explore" || (S.tview === "map" && target !== "story"), el = $(target === "explore" ? "viewExplore" : "viewTrip");
    if (target !== "explore") el.classList.toggle("explore-v", xp);
    if (!P.stops.length) {
      el.innerHTML = '<div class="empty sk">' + (S.countries.length ? (W.status["country|" + (S.countries[0] || {}).name] === "loading" ? '<div class="loading" style="justify-content:center">Finding destinations…</div>' : "Pick at least one city under Plan.") : "Where are you headed? Three quick questions and you'll have a plan.") +
        '<div style="margin-top:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' + (S.countries.length ? "" : '<button type="button" class="btn" data-quick="1">Quick start</button>') + '<button type="button" class="btn' + (S.countries.length ? "" : " quiet") + '" data-view="setup">Go to Plan</button></div></div>';
      return;
    }
    W.jumpToToday(P);   /* during the trip, open on today */
    S.day = Math.max(1, Math.min(P.N, S.day || 1));
    W.familyTick();
    /* the whole trip as a storybook, one photo page per day */
    if (!xp && S.tview === "story" && W.storyHtml) {
      P.stops.forEach(function (st) { W.wantPhotos(st.country, st.name, W.pool(st.country, st.name)); });
      el.innerHTML = W.tripTop(P) + W.storyHtml(P); W.storyMount(); return;
    }
    var day = P.days[S.day - 1], ap = P.ap, h = "", stop = P.stops[day.stop], mode = "list", vtWant = null;

    /* day picker (during the trip, today's pill says so) */
    var tn = W.todayN(P);
    /* All days: the places in the order you stay in them (sized by nights), stuck to the top while you scroll the
       days below; the place you're looking at is lit, and a tap jumps to it */
    if (S.glanceOpen && target !== "explore" && W.glance) {
      el.innerHTML = W.stayBar(P, tn) + W.viewSwitch() + '<div class="all-days">' + W.glance(P) + "</div>";
      W.stayTrack(true); return;
    }
    h += '<div class="daybar"><button type="button" class="icon-btn" data-step="-1" aria-label="Previous day"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3L5 8l5 5"/></svg></button><div class="days" id="dayScroller">' +
      dayGroups(P, tn) +
      '</div><button type="button" class="icon-btn" data-step="1" aria-label="Next day"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l5 5-5 5"/></svg></button>' +
      "</div>" + (target === "explore" ? "" : W.viewSwitch());
    /* a year on, a look back */
    if (target !== "explore" && W.anniversary) h += W.anniversary(P);

    h += '<div class="dayflip">';
    /* day header: city, date, what kind of day, and where you start from */
    var home = W.homebase(day.country, day.city), sub = [];
    if (fmtDate(day.n)) sub.push(esc(fmtDate(day.n)));
    sub.push("Day " + day.dayInCity + " of " + stop.days);
    if (day.trip) sub.push("Day trip to " + esc(day.trip.name) + (day.trip.min ? " · about " + esc(W.fmtMin(Math.round(day.trip.min / 15) * 15)) + " each way" : ""));
    var geoBusy = Object.keys(W.status).some(function (k) { return k.indexOf("geo|" + W.cityKey(day.country, day.city)) === 0 && W.status[k] === "loading"; });
    if (xp) h += '<div class="day-h ex-h"><div class="grow"><h2>' + (target === "explore" ? "Explore " : "") + esc(day.city) + '</h2><div class="sub">' + sub.join(" · ") + "</div></div></div>";
    else h += '<div class="day-h"><div class="grow"><h2>' + esc(day.city) + '</h2><div class="sub">' + sub.join(" · ") + dayLevel(day, P) + "</div>" +
      (W.isExample ? '<div class="small muted">Example trip · change anything under <a href="#plan" data-view="setup">Plan</a></div>' : "") + "</div></div>";
    if (day.farthest > 40 && !day.loading && !day.trip) {
      var mins = Math.round(day.farthest / 60 * 60 + 10);
      h += '<p class="scribble">' + (day.fullDay ? "day trip: about " : "far from your lodging today: about ") + esc(W.fmtMin(mins)) + " each way by car. Staying closer to this area would cut the drive.</p>";
    }

    /* the day */
    var pool = W.pool(day.country, day.city), ck = W.cityKey(day.country, day.city);
    if (pool && !pool.fallback) {
      var firstN = day.slots.map(function (x) { return x.item && x.item.n; }).filter(Boolean);
      P.days.forEach(function (d2) { if (d2.stop === day.stop && d2 !== day) (d2.slots || []).forEach(function (x) { if (x.item) firstN.push(x.item.n); }); });
      W.loadBookLinks(day.country, day.city, firstN);
    }
    /* let the photo finder know which places this trip uses */
    P.stops.forEach(function (st) { W.wantPhotos(st.country, st.name, W.pool(st.country, st.name)); });
    var err = W.status["spots|" + ck] && W.status["spots|" + ck] !== "loading" ? W.status["spots|" + ck] : null;
    /* when a day's ideas first arrive, its stops slide in one after another */
    var lk = day.n + "|" + ck, wasWaiting = W.renderTrip.waiting === lk;
    W.renderTrip.waiting = pool ? null : lk;
    if (pool && wasWaiting) W.fxAfter(function () { W.fxStagger(".slots > *", { step: 45 }); });
    if (!pool) {
      h += err ? '<div class="note sk">' + esc(err) + ' <button type="button" class="btn quiet" data-retry="1">Try again</button></div>'
        : W.sampleState === "off" ? '<div class="note sk">Ideas for ' + esc(day.city) + " come from Claude. Open this page in the Claude app and allow it when asked.</div>"
        : '<div class="slots skel-list" aria-busy="true"><p class="loading skel-note">Gathering 40+ things to do and places to eat in ' + esc(day.city) + "…</p>" +
          ["", " food", "", " food"].map(function (f) { return '<div class="slot sk skel' + f + '" aria-hidden="true"><span class="thumb"></span><span class="sl-b"><i></i><i></i><i></i></span></div>'; }).join("") + "</div>";
    } else {
      var num = 0, pts = [], prevPt = home, list = "", T = W.dayTimes(day, P), wasOut = false;
      list += W.todayCard(day, P, T);
      if (day.moveFrom) list += legCard(P, day, T);
      else if (day.tripFirst) list += flightCard(P, day) + jetCard(P);
      list += W.bookedRow ? W.bookedRow(day) : "";
      (T && T.order ? T.order.map(function (sl) { return day.slots.filter(function (y) { return y.slot === sl; })[0]; }) : day.slots).forEach(function (x) {
        var it = x.item, food = W.isFood(x.slot), swap = swapOpen === x.slot, R = T && T.rows[x.slot], label = R && R.label || W.SLOT_NAME[x.slot];
        var tm = R && R.start != null && !R.skip ? '<span class="tm">' + W.clock(R.start) + "</span>" : "";
        /* the day's clock notes, as one quiet line under the stop: warnings first */
        var notes = R ? R.warn.map(function (w) { return '<span class="warn">' + esc(shortNote(w)) + "</span>"; }).join("") + R.info.map(function (w) { return "<span>" + esc(shortNote(w)) + "</span>"; }).join("") : "";
        var bk = it && W.bookingFor ? W.bookingFor(it, day) : null;
        var booked = (bk ? '<span class="booked-tag" title="' + esc(bk.title || "") + '">✓ Booked' + (bk.ref ? " · " + esc(bk.ref) : "") + "</span>" : "") + (it ? W.heartBadge(it) : "");
        var rr = '<button type="button" class="icon-btn" data-reroll="' + x.slot + '" aria-expanded="' + swap + '" aria-label="Swap ' + W.SLOT_NAME[x.slot].toLowerCase() + '" title="Swap">' + ICON_REROLL + "</button>";
        /* the end of a day trip: the drive or train back before dinner */
        if (day.trip && !x.trip && wasOut && prevPt !== home) { var rb = W.leg(prevPt, home); if (rb) list += '<div class="travel-note">Back from ' + esc(day.trip.name) + " to " + esc(home.label) + " · " + W.fmtMin(rb.min) + " " + rb.label + " " + link(W.gmapsDir(prevPt, home, rb.mode), "Directions") + "</div>"; prevPt = home; wasOut = false; }
        if (it && x.trip) wasOut = true;
        if (it) {
          num++; pts.push({ n: it.n, lat: it.lat, lng: it.lng, num: num, i: num, food: food, slot: x.slot });
          var lg = W.leg(prevPt, it), from = prevPt;
          var legTag = lg ? '<span class="leg" title="' + esc(W.fmtMin(lg.min) + " " + lg.label + " · " + W.fmtKm(lg.d) + (from === home ? " from " + home.label : "")) + '"><span class="vh">' + esc(lg.label) + " </span>" + (LEG_IC[lg.mode] || LEG_IC.transit) + esc(W.fmtMin(lg.min)) + "</span>" : "";
          if (it.lat != null) prevPt = it;
          var open = false;
          /* closed: what, when, how long, and the one link you need (tickets or menu). Open: everything else. */
          var main = food ? menuLink(it, day.city) + bookLink(it, day.city, true, day.country) : bookLink(it, day.city, false, day.country);
          if (P.p.kid && it.k === -1) notes = '<span class="warn">' + esc(W.notForLine ? W.notForLine(P.p) : P.p.toddler ? "Not for toddlers" : "Not for kids") + "</span>" + notes;
          var meta = food ? [it.cuisine, it.price] : [it.ticket];
          var metaHtml = meta.filter(Boolean).map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("");
          if (it.st === "closed") notes = '<span class="warn">May have closed</span>' + notes;
          if (it.st === "unfound") notes = '<span class="warn">Couldn\'t find this place</span>' + notes;
          if (it.st === "unverified" && food) notes = '<span class="warn">Not checked yet</span>' + notes;
          if (!food) notes = beachNote(it, P) + notes;
          var rev = it.love || it.gripe ? '<div class="rev">' + (it.love ? '<span><b>Loved for</b> ' + esc(it.love) + "</span>" : "") + (it.gripe ? '<span><b>Watch for</b> ' + esc(it.gripe) + "</span>" : "") + "</div>" : "";
          var more = open ? '<div class="slot-more">' + (metaHtml ? '<div class="meta">' + metaHtml + "</div>" : "") + (food ? "" : beachCheck(it)) + rev + (it.st === "unsure" ? '<p class="small muted">Couldn\'t confirm it\'s still open. Worth a quick check.</p>' : "") + (W.altLinksFor ? W.altLinksFor("activity", { it: it, food: food, day: day }) : "") + '<div class="links">' +
            link(W.reviewsUrl(it.n, day.city), "Reviews") + link(W.photosUrl(it.n, day.city), "Photos") + link(W.gmapsPlace(it.n, day.city), "Map") + (lg ? link(W.gmapsDir(from, it, lg.mode), "Directions") : "") + "</div>" + (W.familyActs ? W.familyActs(it, day, x) : "") + "</div>" : "";
          var ph = W.picture(it, food, day.country, day.city);   /* restaurants show only their own photo (never a nearby one) */
          /* at a glance: what it costs, whether it's booked or due, whether it's indoors */
          var cls = W.classify(it, food), bkG = !food && W.bookEntryFor ? W.bookEntryFor(P, day, it) : null, bkd = W.bookingFor ? W.bookingFor(it, day) : null;
          var tags = "";
          if (!food && it.ticket) tags += '<span class="gt' + (W.isPaid(it) ? "" : " free") + '">' + esc(String(it.ticket).split(/[,;(·]/)[0].trim().slice(0, 18)) + "</span>";
          if (bkd || (bkG && bkG.done)) tags += '<span class="gt ok">Booked</span>';
          else if (bkG && bkG.by) tags += '<span class="gt due' + (bkG.by < new Date() ? " late" : "") + '">Book by ' + esc(bkG.by.toLocaleDateString(undefined, { month: "short", day: "numeric" })) + "</span>";
          else if (bkG) tags += '<span class="gt due">Book ahead</span>';
          if (!food && cls.indoor) tags += '<span class="gt in">Indoors</span>';
          if (!food && it.fame === 2) tags += '<span class="gt must">Must-see</span>';
          else if (!food && it.fame === 0) tags += '<span class="gt gem">Hidden gem</span>';
          if (W.whoTags) tags += W.whoTags(it, food, cls);
          var glance = tags ? '<span class="gtags">' + tags + "</span>" : "";
          if (food) {
            /* meals: one slim row (time, name, menu); everything else is a tap away */
            list += '<article class="slot sk food slim' + (ph ? " haspic" : "") + (R && R.skip ? " skipped" : "") + '" data-slotkey="' + esc(x.key) + '">' + (ph ? '<div class="thumb sm">' + ph + '<span class="num">' + num + "</span></div>" : '<span class="num">' + num + "</span>") +
              '<div class="slot-body"><button type="button" class="slot-toggle" data-open="' + esc(x.key) + '" aria-haspopup="dialog">' +
              '<span class="sl-l">' + tm + '<b class="nm">' + esc(it.n) + "</b></span>" +
              '<span class="when">' + label + (legTag ? " · " + legTag : "") + "</span></button>" +
              (notes ? '<div class="slot-notes">' + notes + "</div>" : "") + "</div>" +
              '<div class="slim-a">' + booked + menuLink(it, day.city) + (W.readOnly ? "" : rr) + "</div></article>";
          } else {
            list += '<article class="slot sk' + (R && R.skip ? " skipped" : "") + '" data-slotkey="' + esc(x.key) + '">' + (ph ? '<div class="thumb">' + ph + '<span class="num">' + num + "</span></div>" : '<span class="num">' + num + "</span>") +
              '<div class="slot-body"><button type="button" class="slot-toggle" data-open="' + esc(x.key) + '" aria-haspopup="dialog">' +
              '<span class="when">' + tm + label + stayChip(it, food, x.slot) + '</span><span class="nm">' + esc(it.n) + '</span><span class="desc">' + esc(it.d) + "</span>" + glance + "</button>" +
              (main || booked ? '<div class="slot-act">' + booked + main + "</div>" : "") + (notes || legTag ? '<div class="slot-notes">' + legTag + notes + "</div>" : "") + "</div>" + (W.readOnly ? "" : '<div class="slot-btns">' + rr + "</div>") + "</article>";
          }
        } else if (R && R.skip && !swap) {
          /* no time for anything here today (a long journey): nothing to show, except a note like "breakfast before you set off" */
          if (R.info.length) list += '<div class="travel-note">' + esc(label) + " · " + esc(R.info.join(" · ")) + "</div>";
        } else if (x.loading) {
          list += '<div class="slot sk skel' + (food ? " food" : "") + '" aria-hidden="true"><span class="thumb"></span><span class="sl-b"><i></i><i></i><i></i></span></div>';
        } else {
          list += '<article class="slot sk free slim' + (food ? " food" : "") + '" data-slotkey="' + esc(x.key) + '"><span class="num" style="background:var(--soft)"></span><div class="slot-body"><span class="sl-l">' + tm + '<span class="nm muted">' + (x.rest ? "Rest, pool or playground" : x.free ? "Left free" : "Free time") + '</span></span><span class="when">' + esc(label) + (x.free && !W.readOnly ? " · swap to add something" : "") + "</span>" +
            "</div>" + (W.readOnly || x.rest ? "" : '<div class="slim-a">' + rr + "</div>") + "</article>";
        }
        if (swap) list += swapPanel(day, x, P);
        if (x.slot === "lunch" && P.p.toddler && T && T.nap) list += '<div class="travel-note nap">' + (T && T.nap ? '<b class="tm">' + W.clock(T.nap.start) + "–" + W.clock(T.nap.end) + "</b> " : "") + (T.nap.away ? "Nap in the stroller or the car: you're out in " + esc(day.trip ? day.trip.name : day.city) + " for the day" : "Nap or rest break back at " + esc(home.label)) + "</div>";
      });
      var back = W.leg(prevPt, home);
      if (back && prevPt !== home) list += '<div class="travel-note">Back to ' + esc(home.label) + " · " + W.fmtMin(back.min) + " " + back.label + (T && T.back ? ", about " + W.clock(T.back) : "") + " " + link(W.gmapsDir(prevPt, home, back.mode), "Directions") + "</div>";
      if (day.tripLast && day.n > 1) list += flightCard(P, day);

      /* today's map, with zoom controls that never move. On a phone the day list hides it (Explore has its own), so it
         isn't built at all there: no sketch, no map index, no map pack lookup */
      var ex = "", stopsLL = pts.filter(function (p) { return p.lat != null; });
      /* a stop with no pin at all: ask where it is (once), so every stop can be on the map */
      if (stopsLL.length < pts.length && W.loadPins && !W.readOnly) W.loadPins(day.country, day.city, pts.filter(function (p) { return p.lat == null; }).map(function (p) { return p.n; }));
      if (xp || window.innerWidth > 920) {
      var gm = home.lat != null && stopsLL.length ? "https://www.google.com/maps/dir/?api=1&origin=" + home.lat + "," + home.lng + "&destination=" + home.lat + "," + home.lng +
        "&waypoints=" + encodeURIComponent(stopsLL.map(function (p) { return p.lat + "," + p.lng; }).join("|")) + "&travelmode=walking" : "";
      var zoomed = (S.mapZoom || 1) !== 1;
      /* the detailed map (street names, buildings, landmarks) for cities that have a map pack */
      var vtSlug = W.vtFor ? W.vtFor(day.country, day.city, home.lat, home.lng) : null;
      /* while the detailed map is (or may be) on its way, keep the simple map out of sight so the two never swap back and forth;
         the simple map shows only where there is no detailed map, or this device can't draw one */
      var vtOn = !!(vtSlug && W.vtActive()), vtWait = !vtOn && (vtSlug ? W.vtState() !== "off" : !!(W.vtPending && W.vtPending()));
      ex = '<aside class="explorer sk"><div class="explorer-h"><h3>Today\'s map</h3>' +
        '<div class="zoom" role="group" aria-label="Map zoom"><button type="button" class="icon-btn" data-zoom="out" aria-label="Zoom out">−</button>' +
        '<button type="button" class="icon-btn" data-zoom="in" aria-label="Zoom in">+</button>' +
        '<button type="button" class="icon-btn fit" data-zoom="fit" aria-label="Fit today\'s stops"' + (zoomed || (vtSlug && W.vtActive()) ? "" : ' aria-disabled="true"') + '><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg></button></div></div>' +
        '<div class="map-wrap' + (vtOn ? " vt-on" : vtWait ? " vt-want" : "") + '">' + (vtSlug ? '<div class="vt-slot"></div>' : "") + explorer(day, home, pts, pool) + "</div>" +
        '<ol class="legend">' + pts.map(function (p) {
          /* a stop with no checked spot is listed, and says so, rather than drawn somewhere it may not be */
          return '<li' + (p.lat == null ? ' class="nomap"' : "") + '><span class="num' + (p.food ? " f" : "") + '">' + p.num + "</span><span>" + esc(p.n) + ' <i>' + ((T && T.rows[p.slot] && T.rows[p.slot].label) || W.SLOT_NAME[p.slot]) + (p.lat == null ? " · not on the map" : "") + "</i></span></li>";
        }).join("") + "</ol>" +
        '<p class="map-note">' + (vtOn ? "© OpenMapTiles © OpenStreetMap contributors" : vtWait ? '<span class="loading">Loading the map…</span>' : explorerState === "map" ? "Map data © OpenStreetMap contributors" : explorerState === "maploading" ? "Loading the street map…" : explorerState === "loading" ? "Sketching the area…" : "No street map for this area yet, so this is a sketch. Ask Claude in chat to build the map for " + esc(day.city) + ".") +
        (gm ? " · " + link(gm, "Open in Google Maps") : "") + "</p></aside>";
      if (vtSlug) vtWant = { slug: vtSlug, key: day.n + "|" + day.city, pts: pts, home: home, animate: true };
      }
      if (!xp) {
        list += dayEnd(day, P, home, geoBusy);
        h += '<div class="dayview mode-list"><div class="slots">' + list + "</div>" + ex + "</div>";
        h += W.dayNav ? W.dayNav(day, P) : "";
        h += W.journalCard(day);
      } else {
        h += ex.replace('<h3>Today\'s map</h3>', "<h3>Day " + day.n + " on the map</h3>");
      }

      /* every idea for this city, folded away until you want it: what's on the trip first (in order), then the rest */
      var dayOf = {}, SLOT_ORDER = ["breakfast", "am", "lunch", "pm", "dinner", "eve"];
      P.days.forEach(function (d) { (d.slots || []).forEach(function (x) { if (x.item) dayOf[W.norm(x.item.n)] = { n: d.n, slot: x.slot, ord: d.n * 10 + SLOT_ORDER.indexOf(x.slot) }; }); });
      var eat = tab === "eat", all = (eat ? pool.food || [] : pool.spots || []).map(function (it) { return { it: it, on: dayOf[W.norm(it.n)] }; });
      /* Explore: filter and sort the ideas */
      var F = /** @type {{ near?: boolean; free?: boolean; indoor?: boolean; kids?: boolean; beach?: boolean }} */ (xp ? (S.exF || {}) : {}), total = all.length, hasBeach = !eat && P.p.kid && all.some(function (r) { return W.beachFit && W.beachFit(r.it) === "safe"; });
      if (xp) {
        var anchors = [home].concat(pts).filter(function (a) { return a && a.lat != null; });
        all.forEach(function (r) { r.km = r.it.lat != null && anchors.length ? Math.min.apply(null, anchors.map(function (a) { return W.km(a, r.it); })) : null; });
        all = all.filter(function (r) {
          var it = r.it;
          return (!F.near || (r.km != null && r.km <= 1.5)) && (eat || !F.free || !W.isPaid(it)) && (eat || !F.indoor || isIndoor(it)) &&
            (!F.kids || !P.p.kid || it.k > 0) && (eat || !F.beach || !hasBeach || W.beachFit(it) === "safe");
        });
        if (S.exSort === "near") all.sort(function (a, b) { return (a.km == null ? 99 : a.km) - (b.km == null ? 99 : b.km); });
      }
      /* places the check could not find, and duplicates, stay out of the list altogether */
      all = all.filter(function (x) { return x.on || !W.gone(x.it); });
      var planned = all.filter(function (x) { return x.on; }).sort(function (a, b) { return a.on.ord - b.on.ord; }), rest = all.filter(function (x) { return !x.on; });
      var free = day.slots.filter(function (x) { return W.isFood(x.slot) === eat; }), folded = !!S.tripFolded;
      var restShown = showAll ? rest : rest.slice(0, Math.max(6, 9 - (folded ? 0 : planned.length)));
      var moreBusy = W.cityBusy(ck);
      function ideaCard(row) {
        var it = row.it, on = row.on, info = [W.stayText(it, eat, it.meal === "breakfast" ? "breakfast" : it.meal === "dinner" ? "dinner" : ""), eat ? it.cuisine : it.ticket, eat ? it.price : ""].filter(Boolean).join(" · ");
        var ph = W.picture(it, eat, day.country, day.city, { credit: true }), onTag = on ? '<span class="on">' + (on.n === day.n ? "Today" : "Day " + on.n) + " · " + W.SLOT_NAME[on.slot] + "</span>" : "";
        var warn = P.p.kid && it.k === -1 ? '<span class="warn">' + (P.p.toddler ? "Not ideal for toddlers" : "Not ideal for kids") + "</span>" : "";
        var bTag = !eat && P.p.kid && W.beachFit && W.beachFit(it) === "safe" ? '<span class="bc good">Calm and shallow</span>' : "";
        return '<div class="idea' + (ph ? " has-photo" : "") + '">' + (ph ? '<div class="pic-wrap">' + ph + onTag + "</div>" : onTag) + "<h4>" + esc(it.n) + "</h4>" + bTag + '<p class="desc">' + esc(it.d) + "</p>" +
          (info ? '<p class="small muted">' + esc(info) + "</p>" : "") +
          '<p class="small idea-meta">' + warn + (eat ? menuLink(it, day.city) : "") + bookLink(it, day.city, eat, day.country) + link(W.photosUrl(it.n, day.city), "Photos") + link(W.gmapsPlace(it.n, day.city), "Map") + "</p>" +
          (on && on.n === day.n || !free.length ? "" : '<div class="use">' + free.map(function (x) { return '<button type="button" data-use="' + x.slot + '" data-name="' + esc(it.n) + '" aria-label="Put ' + esc(it.n) + " in " + W.SLOT_NAME[x.slot].toLowerCase() + '">' + W.SLOT_NAME[x.slot] + "</button>"; }).join("") + "</div>") + "</div>";
      }
      if (xp) h += '<section class="ideas sk"><div class="ideas-t"><h2>Ideas in ' + esc(day.city) + '</h2><span class="small muted">' + (pool.spots || []).length + " things to do · " + (pool.food || []).length + " places to eat</span></div>" +
        '<div class="ideas-h"><div class="row"><div class="seg" role="group" aria-label="Ideas">' +
        '<button type="button" data-tab="do" aria-pressed="' + !eat + '">Things to do (' + (pool.spots || []).length + ")</button>" +
        '<button type="button" data-tab="eat" aria-pressed="' + eat + '">Places to eat (' + (pool.food || []).length + ")</button></div>" +
        (pool.fallback ? "" : moreBusy ? '<span class="loading">Finding more…</span>' : '<button type="button" class="btn ghost" data-more="1">Find more</button>') + "</div></div>" +
        (xp ? exChips(F, eat, P, hasBeach, all.length, total) : "") + '<div class="idea-list">' +
        (planned.length ? '<h3 class="idea-group"><button type="button" class="fold" data-foldtrip="1" aria-expanded="' + !folded + '">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (folded ? "M6 3l5 5-5 5" : "M3 6l5 5 5-5") + '"/></svg>' +
          "On your trip <span>(" + planned.length + ")</span><em>" + (folded ? "show" : "hide") + "</em></button></h3>" + (folded ? "" : planned.map(ideaCard).join("")) : "") +
        (restShown.length ? (planned.length ? '<h3 class="idea-group">More ideas</h3>' : "") + restShown.map(ideaCard).join("") : "") + "</div>" +
        (rest.length > restShown.length || showAll && rest.length > 6 ? '<div><button type="button" class="btn quiet" data-showall="1">' + (showAll ? "Show fewer" : "Show all " + rest.length) + "</button></div>" : "") + "</section>";

      if (xp && pool.transit) {
        var t = pool.transit, rows = [["Transit", t.system], ["Best pass", t.pass], ["From airport", t.airport], ["Tip", t.tip]].filter(function (x) { return x[1]; });
        if (rows.length) h += '<details class="transit sk" data-fold="transit"' + (S.transitOpen ? " open" : "") + "><summary>Getting around " + esc(day.city) + "</summary>" + rows.map(function (x) { return '<div><span class="k">' + x[0] + "</span><span>" + esc(x[1]) + "</span></div>"; }).join("") + "</details>";
      }
    }
    el.innerHTML = h + "</div>";
    /* on a phone in list view the map is hidden: don't run it in the background */
    if (vtWant && (xp || window.innerWidth > 920)) {
      var slotEl = el.querySelector(".vt-slot");
      if (slotEl && W.vtMount(slotEl, vtWant)) { slotEl.parentNode.classList.add("vt-on"); slotEl.parentNode.classList.remove("vt-want"); }
    }
    var pill = el.querySelector('.dpill[aria-current="true"]'), sc = $("dayScroller");
    if (pill && sc) { var pr = pill.getBoundingClientRect(), sr = sc.getBoundingClientRect(); sc.scrollLeft += pr.left - sr.left - sc.clientWidth / 2 + pr.width / 2; }
    /* the day pills fade out at an edge only where there are more to scroll to */
    if (sc) { var edges = function () { sc.classList.toggle("more-l", sc.scrollLeft > 4); sc.classList.toggle("more-r", sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4); }; edges(); sc.addEventListener("scroll", edges, { passive: true }); }
  };

  /* ---------- controller ---------- */
  W.render = function () {
    if (W.readOnly && (view === "setup" || view === "settings")) view = "trip";   /* a shared trip is view only */
    document.documentElement.classList.toggle("ro", !!W.readOnly);
    var P = W.P = W.plan();
    /* travel mode: while the trip is on (or when you pick it), Today replaces Plan */
    var travel = W.travelOn ? W.travelOn(P) : false;
    document.documentElement.classList.toggle("travel", travel);
    if (travel && firstRender && view === "trip" && !W.readOnly) { view = "go"; try { history.replaceState(null, "", HASH.go); } catch (x) {} }
    firstRender = false;
    if ($("viewKids")) $("viewKids").hidden = view !== "kids"; $("viewSetup").hidden = view !== "setup"; $("viewTrip").hidden = view !== "trip"; $("viewBook").hidden = view !== "book"; $("viewRecap").hidden = view !== "recap"; $("viewGo").hidden = view !== "go"; $("viewExplore").hidden = view !== "explore"; $("viewSettings").hidden = view !== "settings";
    $("tabGo").setAttribute("aria-current", view === "go" ? "page" : "false");
    $("tabSetup").setAttribute("aria-current", view === "setup" ? "page" : "false");
    $("tabTrip").setAttribute("aria-current", view === "trip" ? "page" : "false");
    $("tabBook").setAttribute("aria-current", view === "book" ? "page" : "false");
    if (W.renderBar) W.renderBar(P);
    if (W.renderNext) W.renderNext(P);
    if (W.autoTick) W.autoTick(P);
    if (W.offline) W.offline.tick(P);
    if (W.warmTick) W.warmTick(P);
    if (view === "kids" && W.renderKids) W.renderKids(P); else if (view === "setup") W.renderSetup(P); else if (view === "book") W.renderBook(P); else if (view === "recap") W.renderRecap(P); else if (view === "go") W.renderGo(P); else if (view === "explore") W.renderTrip(P, "explore"); else if (view === "settings") W.renderSettings(P); else W.renderTrip(P);
    W.save();
    if (W.fxRunAfter) W.fxRunAfter();
    if (W.afterRender) W.afterRender();
  };
  function slotEl(slot) { var b = document.querySelector('[data-reroll="' + slot + '"]'); return b && b.closest(".slot"); }
  W.onData(function () { if (!document.activeElement || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || view === "setup") W.render(); });

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-view]");
    if (a) {
      e.preventDefault(); var to = /** @type {View} */ (a.dataset.view); if (to === view || (W.readOnly && (to === "setup" || to === "settings"))) return;
      if (to === "settings") prevView = view;
      W.fxFlip("page", VIEWS[to] > VIEWS[view] ? 1 : -1, function () { view = to; try { history.replaceState(null, "", HASH[view]); } catch (x) {} W.render(); window.scrollTo(0, 0); });
      return;
    }
    var b = e.target.closest("button"); if (!b || b.closest("#tripbar")) return;
    var d = b.dataset, P = W.P;
    /* a shared trip: look around, change nothing */
    if (W.readOnly && !(d.day || d.step || d.tab || d.showall || d.foldtrip || d.open || d.zoom || d.ro || d.late || d.heart || d.comment || d.exf || d.exsort)) return;
    if (!W.readOnly) W.isExample = false;
    /* family: hearts and comments (a comment opens claude.ai's composer on this card, so nothing redraws) */
    if (d.comment) { W.familyClick(b, d); return; }
    if (d.heart) { W.familyClick(b, d); W.render(); return; }
    if (view === "setup") { W.setupClick(b, d, P); return; }
    if (view === "book") { W.bookClick(b, d, P); return; }
    if (view === "settings") { W.settingsClick(b, d, P); return; }
    var day = P.days[S.day - 1];
    if (d.day || d.step) {
      var nd = d.day ? +d.day : Math.max(1, Math.min(P.N, S.day + +d.step));
      /* a day picked in All days opens at its start (the list was scrolled; the day starts at the top) */
      if (d.day && b.closest(".all-days")) {
        S.glanceOpen = false;
        W.fxFlip("day", nd >= S.day ? 1 : -1, function () {
          S.day = nd; swapOpen = null; swapAll = false; showAll = false; W.render(); window.scrollTo(0, 0);
          /* a card above the day (one year ago today) can push its start below the fold: then bring the day's heading to the top */
          var hd = document.querySelector("#viewTrip .day-h"), top = hd ? hd.getBoundingClientRect().top : 0;
          if (top > window.innerHeight * 0.4) window.scrollTo(0, Math.max(0, top - 12));
        });
        return;
      }
      if (nd === S.day) return;
      W.fxFlip("day", nd > S.day ? 1 : -1, function () { S.day = nd; swapOpen = null; swapAll = false; showAll = false; W.render(); });
      return;
    }
    else if (d.tab) { if (tab === d.tab) return; tab = d.tab; showAll = false; W.fxAfter(function () { W.fxStagger(".idea-list > *", { y: 8, step: 25 }); }); }
    else if (d.showall) showAll = !showAll;
    else if (d.exf) { var ef = S.exF || (S.exF = {}); ef[d.exf] = !ef[d.exf]; showAll = false; }
    else if (d.exsort) { S.exSort = S.exSort === "near" ? "" : "near"; }
    else if (d.foldtrip) { S.tripFolded = !S.tripFolded; if (!S.tripFolded) W.fxAfter(function () { var g = document.querySelector("[data-foldtrip]"), n = g && g.closest(".idea-group"), out = []; while (n && (n = n.nextElementSibling) && !n.classList.contains("idea-group")) out.push(n); W.fxStagger(out, { step: 30 }); }); }
    else if (d.open) { if (W.openStop) W.openStop(d.open); return; }
    else if (d.reroll || d.swapclose) {
      var sw = document.querySelector(".swap");
      if (sw && (d.swapclose || swapOpen === d.reroll)) { W.fxCollapse(sw, function () { swapOpen = null; swapAll = false; W.render(); }); return; }
      swapOpen = d.reroll; swapAll = false; W.fxAfter(function () { W.fxExpand(".swap"); });
    }
    else if (d.next) { W.reroll(day, d.next, P); var ns = d.next; W.fxAfter(function () { W.fxPulse(slotEl(ns)); W.fxStagger(".swap .opt", { y: 6, step: 20 }); }); }
    else if (d.use) {
      var us = d.use, un = d.name, sw2 = document.querySelector(".swap");
      var apply = function () { W.useIdea(day, us, un, P); swapOpen = null; swapAll = false; W.fxAfter(function () { W.fxPulse(slotEl(us)); }); W.render(); };
      if (sw2 && b.closest(".swap")) { W.fxCollapse(sw2, apply, { dur: 200 }); return; }
      apply(); return;
    }
    else if (d.swapall) { swapAll = !swapAll; if (swapAll) W.fxAfter(function () { W.fxStagger(Array.prototype.slice.call(document.querySelectorAll(".swap .opt"), 5), { y: 6, step: 20 }); }); }
    else if (d.gostay != null) {
      /* lodging lives on the Setup page: open that city's "where to stay" */
      var gs = P.stops[+d.gostay]; if (!gs) return;
      W.fxFlip("page", -1, function () {
        W.openStay[W.cityKey(gs.country, gs.name)] = true; W.scrollToStop = +d.gostay; view = "setup";
        try { history.replaceState(null, "", "#plan"); } catch (x) {}
        W.render();
      });
      return;
    }
    else if (d.zoom && W.vtActive && W.vtActive()) { W.vtZoom(d.zoom); return; }
    else if (d.zoom) { var z = S.mapZoom || 1; S.mapZoom = d.zoom === "fit" ? 1 : Math.max(0.25, Math.min(6, d.zoom === "in" ? z * 1.6 : z / 1.6)); if (Math.abs(S.mapZoom - 1) < 0.05) S.mapZoom = 1; }
    else if (d.legpick != null && d.legkey) { var lp = S.legPick || (S.legPick = {}), lgo = (W.C.legs[d.legkey] || {}).opts || [], pk = lgo[+d.legpick]; if (!pk) return; lp[d.legkey] = W.legSig(pk); W.fxAfter(function () { var e = document.querySelector(".lo.sel .lo-d"); if (e) W.fxExpand(e, { reveal: false }); }); }
    else if (d.late != null) W.lateClick(d);
    else if ((d.offsave || d.offcopy) && W.offline) W.offline.click(d, P);
    else if (d.rescue) { var rd = P.days[(S.day || 1) - 1]; if (rd && W.rescue) { W.rescue(rd, P, d.rescue); W.fxAfter(function () { W.fxStagger(".go-tl li", { step: 30 }); }); } }
    else if (d.unrescue) { var ud = P.days[(S.day || 1) - 1]; if (ud && W.unrescue) W.unrescue(ud); }
    else if (d.jdel != null) W.journalClick(d);
    else if (d.live || d.livepick != null || d.site) W.liveClick(d, P);
    else if (d.rest) { var rs = S.rest || (S.rest = {}); if (rs[d.rest]) delete rs[d.rest]; else rs[d.rest] = 1; W.fxAfter(function () { W.fxStagger(".slots > .slot", { step: 30 }); }); }
    else if (d.more) { var mk = W.cityKey(day.country, day.city); ["spots|", "food|"].forEach(function (p) { if (W.status[p + mk] !== "loading") delete W.status[p + mk]; }); W.loadCity(day.country, day.city, true); }
    else if (d.retry) { var rk = W.cityKey(day.country, day.city); ["spots|", "food|"].forEach(function (p) { delete W.status[p + rk]; delete W.status[p + rk + "|b"]; }); W.loadCity(day.country, day.city); }
    else return;
    W.render();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target.matches("input")) return;
    e.preventDefault();
    if (view === "book") { if (W.bookEnter) W.bookEnter(e.target); return; }
    W.setupEnter(e.target, W.P);
  });
  document.addEventListener("change", function (e) { if (view === "setup" && e.target.matches("input")) W.setupChange(e.target); });
  /* folded sections remember whether you left them open */
  W.saveFold = function (el, open) {
    var f = el && el.dataset && el.dataset.fold; if (!f) return;
    if (f === "transit") S.transitOpen = open; else if (f === "jet") S.jetOpen = open;
    else if (f.indexOf("step-") === 0) { S.stepClosed = S.stepClosed || {}; S.stepClosed[f.slice(5)] = !open; }
    W.save();
  };
  document.addEventListener("toggle", function (e) { if (e.target && !e.target.getAttribute("data-moving")) W.saveFold(e.target, e.target.open); }, true);
  window.addEventListener("hashchange", function () { view = hashView(); W.render(); });
  /* a stop's panel: the photo, when, the full notes, booking, reviews and links */
  W.stopDetails = function (P, day, x) {
    var it = x.item; if (!it) return "";
    var food = W.isFood(x.slot), T = W.dayTimes(day, P), R = T && T.rows[x.slot], label = R && R.label || W.SLOT_NAME[x.slot];
    var ph = W.picture(it, food, day.country, day.city, { credit: true });
    var notes = R ? R.warn.map(function (w) { return '<span class="warn">' + esc(w) + "</span>"; }).join("") + R.info.map(function (w) { return "<span>" + esc(w) + "</span>"; }).join("") : "";
    if (P.p.kid && it.k === -1) notes = '<span class="warn">' + (P.p.toddler ? "Not ideal for toddlers" : "Not ideal for kids") + "</span>" + notes;
    if (it.st === "closed") notes = '<span class="warn">May have closed for good. Check before you go</span>' + notes;
    if (it.st === "unfound") notes = '<span class="warn">Couldn\'t find a place by this name. It may not exist</span>' + notes;
    if (it.st === "unverified" && food) notes = '<span class="warn">Not checked yet. Look it up before you go</span>' + notes;
    if (it.place && W.norm(it.place) !== W.norm(it.n)) notes += "<span>Listed as " + esc(it.place) + "</span>";
    if (it.note) notes += "<span>" + esc(it.note) + "</span>";
    if (!food) notes = beachNote(it, P) + notes;
    var meta = (food ? [it.cuisine, it.price] : [it.ticket]).filter(Boolean).map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("");
    var bk = W.bookingFor ? W.bookingFor(it, day) : null, bkE = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
    var booked = bk ? '<span class="booked-tag" title="' + esc(bk.title || "") + '">✓ Booked' + (bk.ref ? " · " + esc(bk.ref) : "") + "</span>" : "";
    var main = food ? menuLink(it, day.city) + bookLink(it, day.city, true, day.country) : bookLink(it, day.city, false, day.country);
    var rev = it.love || it.gripe ? '<div class="rev">' + (it.love ? '<span><b>Loved for</b> ' + esc(it.love) + "</span>" : "") + (it.gripe ? '<span><b>Watch for</b> ' + esc(it.gripe) + "</span>" : "") + "</div>" : "";
    var when = [R && R.start != null && !R.skip ? W.clock(R.start) : "", label, W.stayText(it, food, x.slot)].filter(Boolean).join(" · ");
    return '<div class="sd">' + (ph ? '<div class="sd-pic">' + ph + "</div>" : "") +
      '<p class="sd-when">' + esc(when) + "</p>" + (it.d ? '<p class="sd-d">' + esc(it.d) + "</p>" : "") +
      (notes ? '<div class="slot-notes sd-notes">' + notes + "</div>" : "") +
      (main || booked ? '<div class="slot-act">' + booked + main + "</div>" : "") +
      (meta ? '<div class="meta">' + meta + "</div>" : "") + (food ? "" : beachCheck(it)) + rev +
      (it.st === "unsure" ? '<p class="small muted">Couldn\'t confirm it\'s still open. Worth a quick check.</p>' : "") +
      (W.altLinksFor ? W.altLinksFor("activity", { it: it, food: food, day: day }) : "") +
      '<div class="links">' + (bkE ? '<button type="button" class="linkish" data-gobook="' + esc(bkE.key) + '">' + (bkE.done ? "Booked · see Prepare" : "On your To book list") + "</button>" : "") +
      link(W.reviewsUrl(it.n, day.city), "Reviews") + link(W.photosUrl(it.n, day.city), "Photos") + link(W.gmapsPlace(it.n, day.city), "Map") + "</div>" +
      (W.familyActs ? W.familyActs(it, day, x) : "") + "</div>";
  };
  W.prevView = function () { return prevView === "settings" ? "trip" : prevView; };
  W.goView = function (to) {
    if (W.closeStop) W.closeStop();   /* a stop's sheet belongs to the screen it was opened on */
    if (to === view) { W.render(); return; }
    if (to === "settings") prevView = view;
    W.fxFlip("page", VIEWS[to] > VIEWS[view] ? 1 : -1, function () { view = to; try { history.replaceState(null, "", HASH[view]); } catch (x) {} W.render(); window.scrollTo(0, 0); });
  };
  W.setView = function (v) { view = v; try { history.replaceState(null, "", HASH[v]); } catch (x) {} };

  W.render();
  W.fxStagger("main:not([hidden]) > *", { step: 70, y: 14 });   /* the first view settles in */
  /* the very first open: ask where you're headed, over the example trip */
  try {
    if (W.isExample && !W.readOnly && !localStorage.getItem("waypoint-welcome") && W.quickStart) { localStorage.setItem("waypoint-welcome", "1"); setTimeout(function () { W.quickStart(true); }, 400); }
  } catch (e) {}
})();
