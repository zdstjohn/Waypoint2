/* Waypoint Travel mode.
   Travel mode swaps Setup for Today: one calm screen with now, next, when to leave, naps, tickets and running late.
   It turns on by itself while the trip is on, and the switch in the header changes it any time. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc, $ = W.$;
  var nowMin = W.nowMin;
  function fmt(d, o) { return d ? d.toLocaleDateString(undefined, o || { weekday: "short", month: "short", day: "numeric" }) : ""; }
  function svg(d, vb) { return '<svg viewBox="' + (vb || "0 0 20 20") + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; }
  var IC = {
    dir: W.icon("dir", 2.2),
    ticket: W.icon("ticket", 2.2),
    more: W.icon("more", 2),
    bed: W.icon("bed", 2.2),
    moon: W.icon("moon", 2.2),
    check: svg('<path d="M4.5 10.5l3.5 3.5 7.5-8"/>'),
    train: W.icon("train", 2.2),
    chevL: svg('<path d="M12.5 4l-6 6 6 6"/>'),
    chevR: svg('<path d="M7.5 4l6 6-6 6"/>')
  };

  /* ======================= which mode ======================= */
  /* a mode you pick lasts for that day; otherwise the trip's dates decide */
  W.modeOf = function (P) {
    var S = W.S, today = W.isoDay(W.now());
    if (S.appMode && S.appModeAt === today) return S.appMode;
    return P && P.stops && P.stops.length && W.todayN(P) ? "travel" : "plan";
  };
  W.travelOn = function (P) { return !!(P && P.stops && P.stops.length) && W.modeOf(P) === "travel"; };
  function setMode(m) { W.S.appMode = m; W.S.appModeAt = W.isoDay(W.now()); }
  /* what the rescue did, in a line */
  function rescueLine(r) {
    if (r.mode === "ask") {
      var sw = Math.max(0, (r.n || 0) - (r.freed || 0)), did = []; if (sw) did.push(sw + " stop" + (sw === 1 ? "" : "s") + " swapped"); if (r.freed) did.push(r.freed + " left free");
      return "Replanned: " + did.join(", ") + "." + (r.say ? " " + r.say : "");
    }
    var what = r.mode === "rain" ? "Plan B for the rain" : r.mode === "tired" ? "Taking it easy" : r.mode === "behind" ? "No rush" : "Swapped what was closed";
    var n = Math.max(0, (r.n || 0) - (r.mode === "behind" ? 1 : 0)) - (r.freed || 0);
    var parts = []; if (n > 0) parts.push(n + " stop" + (n === 1 ? "" : "s") + " swapped"); if (r.freed) parts.push(r.freed + " left free");
    if (r.mode === "behind") parts.unshift("plan moved 45 min later");
    return what + (parts.length ? ": " + parts.join(", ") : ": nothing needed changing") + "." + (r.mode === "rain" && parts.length ? " Dry and cosy." : r.mode === "tired" && parts.length ? " Gentle afternoon ahead." : "");
  }
  /* ======================= the day, in order ======================= */
  function entries(day, T) {
    /** @type {{ k: string; start: number; end: number; x?: SlotEntry; R?: TimeRow; leg?: Leg | null; away?: boolean; food?: boolean; i?: number; tk?: Ticket | null; dep?: number; arr?: number }[]} */
    var out = []; if (!T) return out;
    if (T.travel) out.push({ k: "travel", start: T.travel.start, end: T.travel.end, leg: T.travel.leg, tk: T.travel.ticket || null, dep: T.travel.dep, arr: T.travel.arr });
    (T.order || []).forEach(function (sl) {
      var x = day.slots.filter(function (y) { return y.slot === sl; })[0], R = T.rows[sl];
      if (!x || !R || R.skip || R.start == null) return;
      if (x.item) out.push({ k: "stop", x: x, R: R, start: R.start, end: R.end, food: W.isFood(sl) });
      else if (x.rest) out.push({ k: "rest", x: x, start: R.start, end: R.end });
      if (sl === "lunch" && T.nap) out.push({ k: "nap", start: T.nap.start, end: T.nap.end, away: !!T.nap.away });
    });
    if (T.nap && !out.some(function (e) { return e.k === "nap"; })) out.push({ k: "nap", start: T.nap.start, end: T.nap.end, away: !!T.nap.away });
    if (T.back) out.push({ k: "back", start: T.back, end: T.back });
    return out.map(function (e, i) { e.i = i; return e; }).sort(function (a, b) { return a.start - b.start || a.i - b.i; });
  }
  function lastPlace(list, nm, home) {
    var from = null;
    list.forEach(function (e) { if (e.k === "stop" && e.end <= nm && e.x.item.lat != null) from = e.x.item; if (e.k === "nap" && !e.away && e.end <= nm) from = null; });
    return from || home;
  }
  function slotName(e) { return e.k === "stop" ? (e.R.label || W.SLOT_NAME[e.x.slot]) : ""; }

  /* ======================= travel mode: one screen ======================= */
  var goN = null;   /* a day you're previewing; null = today */
  var goMapOpen = false;   /* the map on Today, when it is folded behind its button */
  /* open Today on a given day (the journal button on Trip) */
  W.goToDay = function (n) { var tn = W.todayN(W.P); goN = n === tn ? null : n; W.S.day = n; };
  /* ---------- the rows of a route list ----------
     One definition for Today's route (below) and for the route beside the day on a big screen (screens/trip.js):
     where you're staying, the way from one stop to the next with its directions, and a stop. */
  /** @param {{ label: string }} home */
  W.routeHome = function (home) {
    return '<li class="rc-home">' + W.homeMark() + '<span class="rc-b"><b>' + esc(home.label) + '</b><span class="small muted">where you\'re staying</span></span></li>';
  };
  /** the way from a to b: how, how long, and directions (by name when either has no pin)
      @param {any} a @param {any} b @param {string} city @param {boolean} [last] the way back @param {string} [note] */
  W.routeLeg = function (a, b, city, last, note) {
    var lg = W.leg(a, b), to = b.lat != null ? b : { n: (b.n || b.label) + ", " + city, lat: null, lng: null };
    var dir = W.extLink(W.gmapsDir(a.lat != null ? a : { label: (a.label || a.n) + ", " + city, lat: null }, to, lg ? lg.mode : "walking"), "Directions");
    return '<li class="rc-leg' + (last ? " last" : "") + '">' + (lg ? W.legIcon(lg.mode) + "<span>" + esc(W.fmtMin(lg.min) + " " + lg.label + (note || "")) + "</span>" : "<span>Find it on the map</span>") + dir + "</li>";
  };
  /** a stop: its marker (what it is, and its letter), its name and when; with a key it opens the stop's sheet; one
      with no pin links to Google Maps by name
      @param {{ it?: any, n: string, lat?: number | null, food?: boolean, slot: string, num: number }} p @param {string} city
      @param {string} when HTML @param {string} [cls] @param {string} [key] */
  W.routeStop = function (p, city, when, cls, key) {
    var body = "<b>" + esc(p.n) + '</b><span class="small muted">' + when + "</span>";
    return '<li class="rc-stop' + (cls || "") + '">' + W.stopMark(p.it || {}, !!p.food, p.slot, p.num) +
      (key ? '<button type="button" class="rc-b" data-sheet="' + esc(key) + '" aria-haspopup="dialog">' + body + "</button>" : '<span class="rc-b">' + body + "</span>") +
      (p.lat == null ? W.extLink(W.gmapsPlace(p.it || p, city), "find on Google Maps", "rc-find small") : "") + "</li>";
  };

  W.renderGo = function (P) {
    var el = $("viewGo"); if (!el) return;
    if (!P.stops.length) { W.draw(el, '<div class="empty sk">Plan a trip first, then this screen walks you through each day.</div>'); return; }
    var S = W.S, tn = W.todayN(P), n = goN || tn || S.day || 1;
    n = Math.max(1, Math.min(P.N, n)); S.day = n;
    var day = P.days[n - 1], live = tn === n, nm = live ? nowMin() : null, T = day.slots && day.slots.length ? W.dayTimes(day, P) : null;
    var home = W.homebase(day.country, day.city), list = entries(day, T), h = "";

    /* the top: which day, and moving between days */
    var a = P.days[n - 2], b = P.days[n];
    if (W.kidNames && P.p.kid) h += '<button type="button" class="kids-chip" data-view="kids"><span class="kc-i" aria-hidden="true">' + W.icon("star", 2.1) + "</span> " + esc(W.kidNames(13).length ? "For " + W.joinNames(W.kidNames(13)) : "For the kids") + ": their day, passport and treasure hunt ›</button>";
    h += '<div class="go-top"><button type="button" class="icon-btn" data-goprev="' + (a ? a.n : "") + '"' + (a ? "" : " disabled") + ' aria-label="Previous day">' + IC.chevL + "</button>" +
      '<div class="gt-m"><span class="gt-k' + (live ? " live" : "") + '">' + (live ? "Today" : tn ? (n > tn ? "Coming up" : "Earlier") : "Preview") + "</span><b>Day " + n + " · " + esc(day.city) + "</b>" +
      '<span class="muted">' + esc([fmt(W.dateOf(n), { weekday: "long", month: "short", day: "numeric" }), live ? W.clock(nm) : ""].filter(Boolean).join(" · ")) + "</span></div>" +
      '<button type="button" class="icon-btn" data-goprev="' + (b ? b.n : "") + '"' + (b ? "" : " disabled") + ' aria-label="Next day">' + IC.chevR + "</button></div>";
    if (tn && !live) h += '<button type="button" class="linkish go-back" data-gotoday="1">' + W.arrow() + "Back to today</button>";
    if (W.holidayLine) h += W.holidayLine(day);
    if (!tn && !goN) h += '<p class="small muted go-pre">' + (W.S.start ? "Your trip hasn't started yet. This is how each day will look while you're there." : "Add your travel dates and this screen follows the clock while you travel.") + "</p>";

    if (!T) {
      h += '<div class="empty sk"><div class="loading" style="justify-content:center">Gathering ideas for ' + esc(day.city) + "…</div></div>";
      W.draw(el, '<div class="go">' + h + "</div>"); return;
    }

    /* today's map: the street map with the day's stops on it, where the city has one (never in Simple view). It is
       folded away behind the Map button in the route's header and opens in place, above the stops; open or closed is
       remembered while the app is open */
    var mapPts = /** @type {any[]} */ ([]); list.forEach(function (e) { if (e.k === "stop") { var it0 = e.x.item; mapPts.push({ n: it0.n, lat: it0.lat, lng: it0.lng, gid: it0.gid, gpin: it0.gpin, num: mapPts.length + 1, i: mapPts.length + 1, food: !!e.food, slot: e.x.slot }); } });
    var vtSlug = W.vtFor && mapPts.length && !(W.simple && W.simple()) && W.vtState() !== "off" ? W.vtFor(day.country, day.city, home.lat, home.lng) : null, mapIn = "", vtWant = null;
    var mapBtn = vtSlug ? '<button type="button" class="chip go-mapbtn" data-gomap="1" aria-expanded="' + goMapOpen + '">' + W.icon("map", 2.1) + (goMapOpen ? "Hide map" : "Map") + "</button>" : "";
    if (vtSlug && goMapOpen) {
      var vtOn = !!W.vtActive();
      mapIn = '<div class="go-map"><div class="zoom" role="group" aria-label="Map zoom"><button type="button" class="icon-btn" data-zoom="out" aria-label="Zoom out">−</button><button type="button" class="icon-btn" data-zoom="in" aria-label="Zoom in">+</button>' +
        '<button type="button" class="icon-btn fit" data-zoom="fit" aria-label="Fit today\'s stops"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg></button></div>' +
        '<div class="map-wrap' + (vtOn ? " vt-on" : " vt-want") + '"><div class="vt-slot"></div>' + (vtOn ? "" : '<p class="loading map-wait">Loading the street map…</p>') + "</div>" +
        '<p class="map-note">© OpenMapTiles © OpenStreetMap contributors</p></div>';
      vtWant = { slug: vtSlug, key: day.n + "|" + day.city, pts: mapPts, home: home, animate: true, city: day.city };
    }

    /* now, and what's next */
    var stops = list.filter(function (e) { return e.k === "stop"; });
    /** @type {typeof list[0] | null} */ var cur = null, nxt = cur, then = cur;
    if (live) {
      list.forEach(function (e) { if (e.k !== "back" && e.start <= nm && nm < e.end) cur = e; });
      /* what's next can be the nap: heading back for it matters as much as any stop */
      list.forEach(function (e) { if (!nxt && (e.k === "stop" || (e.k === "nap" && !(cur && cur.k === "nap"))) && e.start > nm && e !== cur) nxt = e; });
    } else { nxt = stops[0]; }
    var hero = cur || nxt, second = cur ? nxt : nxt ? list.filter(function (e) { return e.k === "stop" && e.start > nxt.start; })[0] : null;
    var from = live ? (cur && cur.k === "stop" && cur.x.item.lat != null ? cur.x.item : cur && cur.k === "nap" && !cur.away ? home : lastPlace(list, nm, home)) : home;
    if (hero) h += heroCard(hero, cur === hero, day, P, from, live, nm, home);
    else if (live) {
      var bk = list.filter(function (e) { return e.k === "back"; })[0];
      h += '<section class="go-hero sk done"><div class="gh-b"><span class="gh-k">That\'s today done</span><h2>Back to ' + esc(home.label) + "</h2>" +
        (bk ? '<p class="muted">About ' + W.clock(bk.start) + "</p>" : "") +
        '<div class="gh-act"><a class="btn" href="' + esc(W.gmapsDir(lastPlace(list, nm, home), { n: home.label, lat: home.lat, lng: home.lng }, "transit")) + '" target="_blank" rel="noopener">' + IC.dir + "Directions back</a></div></div></section>";
    }
    if (second) h += nextCard(second, day, P, hero && hero.k === "stop" ? hero.x.item : home, live);

    /* running late, and rescuing the rest of the day */
    var late = W.lateFor(day), rk = W.restKey(day) + "|" + W.isoDay(W.now()), resc = (S.rescued || {})[rk];
    if (live && (cur || nxt) && !W.readOnly) {
      h += '<div class="go-late"><span>Running late?</span><button type="button" class="chip" data-late="15">+15 min</button><button type="button" class="chip" data-late="30">+30 min</button>' +
        (late ? '<button type="button" class="linkish" data-late="0">Back on time</button><span class="small muted">plan moved ' + W.fmtMin(late) + " later</span>" : "") + "</div>";
      if (resc) h += '<div class="go-rescue sk done"><span class="gr-k">' + esc(rescueLine(resc)) + '</span><button type="button" class="linkish" data-unrescue="1">Undo</button></div>';
      else h += '<div class="go-rescue sk"><span class="gr-k">Day going sideways? Rescue the rest of it:</span><div class="gr-b">' +
        '<button type="button" class="chip" data-rescue="rain">Rain · go indoors</button><button type="button" class="chip" data-rescue="tired">Everyone\'s done · keep it easy</button>' +
        '<button type="button" class="chip" data-rescue="behind">Way behind · trim</button><button type="button" class="chip" data-rescue="closed">It\'s closed · swap</button></div>' +
        '<span class="small muted">Nothing that has started or is booked changes. One tap, undo any time.</span>' + (W.replanBlock ? W.replanBlock(day) : "") + "</div>";
    }

    /* the whole day, as a route: from where you're staying to each stop in turn and back, with the way between each
       (walk, transit, drive) and its directions, the nap and the travel in their places, and the whole route in
       Google Maps. What has passed is dimmed, and now and next are marked, as the clock moves */
    var prev = /** @type {any} */ (home), num = 0, pts = /** @type {any[]} */ ([]), rows = "";
    var legRow = function (a, b2, last, note) { return W.routeLeg(a, b2, day.city, last, note); };
    var homePt = { n: home.label, label: home.label, lat: home.lat, lng: home.lng };
    list.forEach(function (e) {
      var st = !live ? "" : e.end <= nm && e.k !== "back" ? " done" : e === cur ? " now" : e === nxt ? " next" : "";
      var tm = '<span class="t">' + W.clock(e.start) + "</span>";
      if (e.k === "stop") {
        var it = e.x.item, bk = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
        num++; pts.push({ n: it.n, lat: it.lat, lng: it.lng, gid: it.gid, gpin: it.gpin, num: num, food: !!e.food, slot: e.x.slot });
        rows += legRow(prev, it, false);
        rows += W.routeStop({ it: it, n: it.n, lat: it.lat, food: !!e.food, slot: e.x.slot, num: num }, day.city,
          tm + " · " + esc(slotName(e)) + (bk ? (bk.done ? ' · <span class="ok">booked</span>' : ' · <span class="warn-t">not booked</span>') : ""), st, e.x.key);
        if (it.lat != null) prev = it;
      } else if (e.k === "nap" || e.k === "rest") {
        /* the nap or the rest is back where you're staying (unless it's in the stroller, out for the day) */
        if (!e.away && prev !== home) { rows += legRow(prev, homePt, false); prev = home; }
        rows += '<li class="rc-stop rc-nap' + st + '"><span class="rc-hi" aria-hidden="true">' + W.icon("nap", 2.2) + '</span><span class="rc-b"><b>' + (e.k === "rest" ? "Rest time" : e.away ? "Nap in the stroller or the car" : "Nap or rest") + '</b><span class="small muted">' +
          tm + " · " + (e.k === "rest" ? "pool or playground near " + esc(home.label) : e.away ? "out for the day" : "at " + esc(home.label)) + (e.k === "nap" ? " · until " + W.clock(e.end) : "") + "</span></span></li>";
      } else if (e.k === "travel") {
        rows += '<li class="rc-stop rc-trav' + st + '"><span class="rc-hi" aria-hidden="true">' + W.icon("swap", 2.2) + '</span><span class="rc-b"><b>' + esc(day.moveFrom + " → " + day.city) + '</b><span class="small muted">' + tm + " · " + esc(travelLine(e.leg, e)) + "</span></span></li>";
      } else if (prev !== home) rows += legRow(prev, homePt, true, " · back about " + W.clock(e.start));
    });
    if (prev !== home && !list.some(function (e) { return e.k === "back"; })) rows += legRow(prev, homePt, true);
    var gm = pts.length ? W.dayRouteUrl(day, pts, home) : "";
    h += '<section class="go-day go-route sk"><div class="go-rh"><h3>' + "Today's route" + "</h3>" + mapBtn + "</div>" + mapIn +
      (pts.length || rows ? '<ol class="rc-list go-rt">' + W.routeHome(home) + rows + "</ol>"
        : '<p class="small muted">Nothing planned for this day yet.</p>') +
      (gm ? '<a class="btn rc-gm" href="' + esc(gm) + '" target="_blank" rel="noopener">Open the whole route in Google Maps ↗</a>' : "") + "</section>";

    /* today's tickets and bookings */
    var cl = W.checklist ? W.checklist(P).filter(function (c) { return c.day === n && c.key.indexOf("stay|") !== 0 && c.key.indexOf("flight|") !== 0; }) : [];
    if (cl.length) h += '<section class="go-tix sk"><h3>Tickets ' + (live ? "today" : "for this day") + "</h3>" + cl.map(function (c) {
      return '<div class="gt-row"><span class="gt-i' + (c.done ? " ok" : "") + '">' + (c.done ? IC.check : IC.ticket) + '</span><div><b>' + esc(c.short || c.title) + '</b><span class="small muted">' + esc(c.done ? (c.why || "Booked") : "Not booked yet") + "</span></div>" +
        (c.url && !c.done ? '<a class="chip-a pri" href="' + esc(c.url) + '" target="_blank" rel="noopener">Book ↗</a>' : '<button type="button" class="chip-a" data-gobook="' + esc(c.key) + '">Details</button>') + "</div>";
    }).join("") + "</section>";

    /* what to take out today (comes with the second script) */
    if (W.dayBagCard) h += W.dayBagCard(day, P, live);

    /* tonight and tomorrow */
    var tom = P.days[n], stay = S.stays[W.cityKey(day.country, day.city)];
    if (W.offline && W.offline.off) h = W.offline.block(P) + h;   /* offline: say so first */
    h += '<section class="go-eve sk"><div class="ge-row"><span class="gt-i">' + IC.bed + '</span><div><span class="small muted">Tonight</span><b>' + esc(home.label) + "</b></div>" +
      '<div class="g-acts">' + (home.set || home.lat != null ? '<a class="chip-a" href="' + esc(W.gmapsDir(live ? lastPlace(list, nm, home) : home, { n: home.label, lat: home.lat, lng: home.lng }, "transit")) + '" target="_blank" rel="noopener">Directions</a>' : "") +
      (!(stay && stay.label) && !W.readOnly ? '<button type="button" class="chip-a pri" data-gostay="' + day.stop + '">Pick a place</button>' : "") + "</div></div>";
    if (tom) {
      var tT = tom.slots && tom.slots.length ? W.dayTimes(tom, P) : null, tl = entries(tom, tT), first = tl.filter(function (e) { return e.k === "stop" && !e.food; })[0];
      h += '<div class="ge-row"><span class="gt-i">' + (tom.moveFrom ? IC.train : IC.moon) + '</span><div><span class="small muted">Tomorrow · Day ' + tom.n + "</span><b>" +
        esc(tom.moveFrom ? tom.moveFrom + " → " + tom.city : tom.city) + '</b><span class="small muted">' +
        esc(tom.moveFrom ? travelLine(tT && tT.travel ? tT.travel.leg : null, tT && tT.travel ? { tk: tT.travel.ticket, arr: tT.travel.arr } : null) + (tT && tT.travel ? (tT.travel.ticket ? " · leave by " : " · leave about ") + W.clock(tT.travel.start) : "") : first ? W.clock(first.start) + " " + first.x.item.n : "") + "</span></div>" +
        '<button type="button" class="chip-a" data-goprev="' + tom.n + '">See it</button></div>';
    }
    h += "</section>";

    /* a photo and a line for the journal */
    if (W.journalCard) h += W.journalCard(day);
    if (W.offline && !W.offline.off) h += W.offline.block(P);
    h += '<p class="small muted go-foot">' + (tn ? 'While the trip is on, the app opens here. <button type="button" class="linkish" data-appmode="plan">Open on Trip instead</button>' : "") + "</p>";
    W.draw(el, '<div class="go">' + h + "</div>", "go|" + W.S.tripId + "|" + day.n);
    /* the map itself comes with the second script: until then its place is held, saying it is loading */
    if (vtWant) {
      var slotEl = el.querySelector(".vt-slot");
      if (!W.vtMount) W.needLater();
      else if (slotEl && W.vtMount(slotEl, vtWant)) { slotEl.parentNode.classList.add("vt-on"); slotEl.parentNode.classList.remove("vt-want"); }
    }
    if (W.awakeTick) W.awakeTick(live);
  };
  /* the journey in a line: your ticket when one is booked with a time, else the way you chose */
  function travelLine(L, e) {
    var tk = e && e.tk;
    if (tk) return [W.modeName(tk.kind), W.clock(tk.dep) + (e.arr != null ? "–" + W.clock(e.arr % 1440) : ""), tk.title].filter(Boolean).join(" · ");
    var o = L && L.best;
    return o ? [W.modeName(o.mode), L.r2r ? W.fmtMin(L.r2r.min) : o.dur, o.op].filter(Boolean).join(" · ") : "Travel to the next stop";
  }
  function heroCard(e, isNow, day, P, from, live, nm, home) {
    if (e.k === "nap" && e.away) {
      return '<section class="go-hero sk nap"><div class="gh-b"><span class="gh-k' + (isNow ? " now" : "") + '">' + (isNow ? "Nap time · until " + W.clock(e.end) : "Next · " + W.clock(e.start) + " nap") + "</span>" +
        "<h2>Nap in the stroller or the car</h2>" + '<p class="muted">You\'re out for the day' + (day.trip ? " in " + esc(day.trip.name) : "") + ": a quiet walk or a shady bench does it. The afternoon starts about " + W.clock(e.end) + ".</p></div></section>";
    }
    if (e.k === "nap" || e.k === "rest") {
      var hl = W.leg(from, { n: home.label, lat: home.lat, lng: home.lng }), hm = e.start - (hl ? hl.min : 15) - (live ? nm : 0);
      return '<section class="go-hero sk nap"><div class="gh-b"><span class="gh-k' + (isNow ? " now" : "") + '">' + (isNow ? (e.k === "nap" ? "Nap time" : "Rest time") + " · until " + W.clock(e.end) : "Next · " + W.clock(e.start) + (e.k === "nap" ? " nap" : " rest")) + "</span>" +
        "<h2>" + (e.k === "nap" ? (isNow ? "Rest back at " : "Head back to ") : "Take it easy near ") + esc(home.label) + "</h2>" +
        (!isNow && live ? '<p class="leave' + (hm <= 10 ? " soon" : "") + '">' + (hm <= 0 ? "Time to head back" : hm <= 90 ? "Leave in " + W.fmtMin(Math.max(5, Math.round(hm / 5) * 5)) : "Leave by " + W.clock(e.start - (hl ? hl.min : 15))) + (hl ? ' <span class="muted">· ' + esc(W.fmtMin(hl.min) + " " + hl.label) + "</span>" : "") + "</p>" : "") +
        (isNow && e.k === "nap" ? '<p class="muted">Nap until ' + W.clock(e.end) + ", then the afternoon starts.</p>" : "") +
        '<div class="gh-act"><a class="btn" href="' + esc(W.gmapsDir(from, { n: home.label, lat: home.lat, lng: home.lng }, "transit")) + '" target="_blank" rel="noopener">' + IC.dir + "Directions</a></div></div></section>";
    }
    if (e.k === "travel") {
      return '<section class="go-hero sk"><div class="gh-b"><span class="gh-k now">' + (isNow ? "On the way" : "Travel day") + "</span><h2>" + esc(day.moveFrom + " → " + day.city) + "</h2>" +
        '<p class="muted">' + esc(travelLine(e.leg, e)) + "</p>" +
        (!isNow && live && e.tk ? '<p class="leave' + (e.start - nm <= 10 ? " soon" : "") + '">' + (e.start - nm <= 0 ? "Time to go" : e.start - nm <= 90 ? "Leave in " + W.fmtMin(Math.max(5, Math.round((e.start - nm) / 5) * 5)) : "Leave by " + W.clock(e.start)) + ' <span class="muted">· ' + esc(W.modeName(e.tk.kind).toLowerCase() + " at " + W.clock(e.tk.dep)) + "</span></p>" : "") +
        '<div class="gh-act"><button type="button" class="btn quiet" data-gobook="' + esc("leg|" + W.legKey(e.leg.a, e.leg.b)) + '">Tickets and times</button></div></div></section>';
    }
    var it = e.x.item, food = e.food, ph = W.picture(it, food, day.country, day.city, { credit: true });
    var lg = W.leg(from, it), leave = e.start - (lg ? lg.min : 10), mins = live ? leave - nm : null;
    var k = isNow ? "Now · until " + W.clock(e.end) : live ? "Next · " + W.clock(e.start) + " " + slotName(e) : "First up · " + W.clock(e.start) + " " + slotName(e);
    var off = W.officialUrl ? W.officialUrl(it, food, day.country, day.city) : null, bk = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
    var tix = food ? (it.book ? { url: it.book, t: "Book a table" } : it.menu ? { url: it.menu, t: "Menu" } : null) : off ? { url: off.url, t: bk && bk.done ? "Your tickets" : "Tickets" } : null;
    var sub = [isNow ? "" : W.stayText(it, food, e.x.slot), bk ? (bk.done ? "Booked" : "Not booked yet") : ""].filter(Boolean).join(" · ");
    return '<section class="go-hero sk' + (isNow ? " is-now" : "") + '">' + (ph ? '<div class="gh-pic">' + ph + "</div>" : "") + '<div class="gh-b"><span class="gh-k' + (isNow ? " now" : "") + '">' + esc(k) + "</span>" +
      "<h2>" + esc(it.n) + "</h2>" + (it.d ? '<p class="gh-d">' + esc(it.d) + "</p>" : "") + (sub ? '<p class="small muted">' + esc(sub) + "</p>" : "") +
      (!isNow && live ? '<p class="leave' + (mins <= 10 ? " soon" : "") + '">' + (mins <= 0 ? "Time to go" : mins <= 90 ? "Leave in " + W.fmtMin(Math.max(5, Math.round(mins / 5) * 5)) : "Leave by " + W.clock(leave)) + (lg ? ' <span class="muted">· ' + esc(W.fmtMin(lg.min) + " " + lg.label) + "</span>" : "") + "</p>" : "") +
      '<div class="gh-act"><a class="btn" href="' + esc(W.gmapsDir(from, it, lg ? lg.mode : "walk")) + '" target="_blank" rel="noopener">' + IC.dir + "Directions</a>" +
      (tix ? '<a class="btn quiet" href="' + esc(tix.url) + '" target="_blank" rel="noopener">' + IC.ticket + esc(tix.t) + "</a>" : "") +
      (W.readOnly ? "" : '<button type="button" class="icon-btn gh-more" data-sheet="' + esc(e.x.key) + '" aria-label="More for ' + esc(it.n) + '">' + IC.more + "</button>") + "</div></div></section>";
  }
  function nextCard(e, day, P, from, live) {
    if (e.k !== "stop") return "";
    var it = e.x.item, ph = W.picture(it, e.food, day.country, day.city), lg = W.leg(from, it);
    return '<div class="go-next sk">' + (ph ? '<span class="thumb">' + ph + "</span>" : "") + '<div class="gn-b"><span class="gh-k">' + (live ? "After that" : "Then") + " · " + W.clock(e.start) + " " + esc(slotName(e)) + "</span><b>" + esc(it.n) + "</b>" +
      (lg ? '<span class="small muted">' + esc(W.fmtMin(lg.min) + " " + lg.label) + "</span>" : "") + "</div>" +
      '<a class="icon-btn" href="' + esc(W.gmapsDir(from, it, lg ? lg.mode : "walk")) + '" target="_blank" rel="noopener" aria-label="Directions to ' + esc(it.n) + '">' + IC.dir + "</a></div>";
  }

  /* ======================= clicks (before the views' own handlers) ======================= */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    function stop() { e.preventDefault(); e.stopPropagation(); }
    if (d.appmode) { stop(); W.setAppMode(d.appmode); return; }
    if (d.goprev != null && d.goprev !== "") { stop(); var n = +d.goprev; goN = n === W.todayN(W.P) ? null : n; W.fxFlip("day", n > W.S.day ? 1 : -1, function () { W.render(); window.scrollTo(0, 0); }); return; }
    if (d.gotoday) { stop(); goN = null; W.render(); window.scrollTo(0, 0); return; }
    if (d.gomap) { stop(); goMapOpen = !goMapOpen; W.render(); return; }
    if (d.zoom && b.closest("#viewGo")) { stop(); if (W.vtActive && W.vtActive()) W.vtZoom(d.zoom); return; }
    if (d.tview) { stop(); if (W.S.tview === d.tview) return; W.S.tview = /** @type {TripState["tview"]} */ (d.tview); W.save(); W.render(); return; }
    /* two tabs, Day and Explore; inside Day, one day or all days (the tab remembers which, coming back from Explore) */
    if (d.vsw) {
      stop(); var to = d.vsw, S = W.S;
      if (to === "map") { if (S.tview !== "map") S.allPref = !!S.glanceOpen; S.glanceOpen = false; S.tview = "map"; }
      else if (to === "day") { if (S.tview !== "map") return; S.tview = "days"; S.glanceOpen = !!S.allPref; }
      else { S.tview = "days"; S.glanceOpen = to === "all"; }
      W.save(); W.render();
      return;
    }
  }, true);

  /* the "next step" during the trip when Travel mode is off: suggest turning it on */
  W.travelNudge = function (P) {
    var tn = W.todayN(P);
    return tn && W.modeOf(P) === "plan" ? { key: "travel|" + W.isoDay(W.now()), k: "Day " + tn, text: "You're on your trip: turn on Travel mode", sub: "one screen for now, next and when to leave", go: { appmode: "travel" } } : null;
  };
  /* Travel mode on opens the Today screen; off goes back to My trip */
  W.setAppMode = function (m) {
    setMode(m); goN = null;
    var to = m === "travel" ? "go" : W.view() === "go" ? "trip" : W.view();
    if (to !== W.view()) W.fxFlip("page", to === "go" ? -1 : 1, function () { W.setView(to); W.render(); window.scrollTo(0, 0); });
    else W.render();
  };
})();
