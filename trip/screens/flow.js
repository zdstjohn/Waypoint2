/* Waypoint flow: the "next step" bar, quick start for a new trip, undo, swiping between days, the stop actions sheet
   (swap, move to another day, directions, book, remove) with drag to reorder, the all-days overview, and links
   between My trip, Book ahead and Plan so nothing is a dead end. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc, $ = W.$;
  function fmt(d, o) { return d ? d.toLocaleDateString(undefined, o || { month: "short", day: "numeric" }) : ""; }
  var CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>';
  function svg(d) { return '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; }
  var IC = {
    swap: svg('<path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6"/><path d="M16.5 3.5v3.5H13"/>'),
    move: svg('<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2.5v3M13 2.5v3M8 12.5h5M11 10.5l2 2-2 2"/>'),
    dir: svg('<path d="M10 2.5l7.5 7.5-7.5 7.5L2.5 10z"/><path d="M8 12v-2.2c0-.7.5-1.3 1.3-1.3H12M11 7l1.5 1.5L11 10"/>'),
    book: svg('<path d="M3 6.5a1.5 1.5 0 0 0 0 3v4A1.5 1.5 0 0 0 4.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 1 0-3v0A1.5 1.5 0 0 0 15.5 5h-11A1.5 1.5 0 0 0 3 6.5z"/><path d="M12 5v10" stroke-dasharray="1.5 2"/>'),
    list: svg('<path d="M7 5.5h10M7 10h10M7 14.5h10"/><path d="M3 5.5h.01M3 10h.01M3 14.5h.01" stroke-width="2.6"/>'),
    order: svg('<path d="M6 3.5v13M3 6.5l3-3 3 3M14 16.5v-13M11 13.5l3 3 3-3"/>'),
    free: svg('<circle cx="10" cy="10" r="7"/><path d="M6.5 13.5l7-7"/>'),
    no: svg('<path d="M13.5 11.5V3.5M13.5 11.5l-3 5.2a1.6 1.6 0 0 1-2-1.5v-2.7H4.6a1.7 1.7 0 0 1-1.7-1.9l.9-5.6a1.8 1.8 0 0 1 1.8-1.5h7.9"/><path d="M13.5 3.5h3v8h-3"/>')
  };
  var CHEVL = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>';
  var XI = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

  /* ======================= the next step ======================= */
  W.nextStep = function (P) {
    var S = W.S; if (W.readOnly || W.isExample) return null;
    var out = [], today = new Date(), tn = W.todayN ? W.todayN(P) : null;
    if (tn) { var tv = W.travelNudge && W.travelNudge(P); return tv && !(S.nextHide || {})[tv.key] ? tv : null; }   /* during the trip, the travel screen says what's next */
    (W.watchDrops ? W.watchDrops() : []).forEach(function (w) {
      var d = W.watchDrop(w); out.push({ key: "drop|" + w.id, k: "Price drop", text: w.label + " now " + W.money(d.now, d.cur) + " (was " + W.money(d.was, d.cur) + ")", go: { url: w.url, gobook: w.kind === "stay" ? "stay|" + w.key : "flight|" + w.key } });
    });
    if (!S.countries.length) { if (W.view() !== "setup") out.push({ key: "where", text: "Pick where you're going", sub: "three quick questions", go: { quick: 1 } }); }
    else if (!P.stops.length) out.push({ key: "cities", text: "Pick the places to visit", go: { view: "setup", step: "where" } });
    /* only what can't wait: price drops, bookings due within a month, and an empty trip */
    var list = P.stops.length && W.checklist ? W.checklist(P) : [];
    var due = list.filter(function (c) { return !c.done && c.by; }).sort(function (a, b) { return a.by - b.by; });
    var urgent = due.filter(function (c) { return c.by.getTime() - today.getTime() < 30 * 864e5; })[0];
    if (urgent) out.push({ key: "book|" + urgent.key, k: urgent.by < today ? "Book now" : "Book by " + fmt(urgent.by), text: urgent.short || urgent.title, go: { gobook: urgent.key } });
    var last = W.dateOf && W.dateOf(P.N);
    if (last && last < today && W.journalHas && W.journalHas()) out.push({ key: "recap", text: "Your trip recap is ready", go: { view: "recap" } });
    var hide = S.nextHide || {};
    return out.filter(function (x) { return !hide[x.key]; })[0] || null;
  };
  W.renderNext = function (P) {
    var el = $("nextbar"); if (!el) return;
    var v = W.view(), n = v === "recap" || v === "go" ? null : W.nextStep(P);
    if (!n) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="nextbar sk"><button type="button" class="nb-go" data-nextstep="' + esc(n.key) + '"><span class="nb-k">' + esc(n.k || "Next") + '</span><span class="nb-t">' + esc(n.text) + "</span>" +
      (n.sub ? '<span class="nb-s">' + esc(n.sub) + "</span>" : "") + CHEV + '</button><button type="button" class="nb-x icon-btn" data-nexthide="' + esc(n.key) + '" aria-label="Hide this suggestion">' + XI + "</button></div>";
    el.__step = n;
  };
  function go(g) {
    if (!g) return;
    if (g.quick) { W.quickStart(); return; }
    if (g.appmode) { W.setAppMode(g.appmode); return; }
    if (g.url && !g.gobook) { window.open(g.url, "_blank", "noopener"); return; }
    if (g.gostay != null) return goStay(+g.gostay);
    if (g.gobook) return goBook(g.gobook);
    if (g.view) {
      if (g.step) { var sc = W.S.stepClosed || (W.S.stepClosed = {}); sc[g.step] = false; }
      W.setView(g.view); W.render(); window.scrollTo(0, 0);
      if (g.step) setTimeout(function () {
        var el = document.querySelector('[data-fold="step-' + g.step + '"]'); if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); }
        var f = g.focus && $(g.focus); if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); if (f.showPicker && f.type === "date") f.showPicker(); } catch (e) {} }, 350);
      }, 60);
    }
  }

  /* ======================= links between views ======================= */
  function goStay(si) {
    var P = W.P, s = P.stops[si]; if (!s) return;
    W.openStay[W.cityKey(s.country, s.name)] = true; W.scrollToStop = si;
    W.setView("setup"); W.render();
  }
  function goBook(key) {
    /* Prepare comes with the second script: show it loading, and finish the jump once it has come */
    if (!W.needLater()) { var n = 0; W.setView("book"); W.render(); (function wait() { if (W.laterReady) goBook(key); else if (n++ < 60) setTimeout(wait, 100); })(); return; }
    if (W.bookReveal) W.bookReveal(key);
    W.setView("book"); W.render(); window.scrollTo(0, 0);
    setTimeout(function () {
      var b = document.querySelector('.bk-ahead [data-tick="' + CSS.escape(key) + '"], .bk-done [data-tick="' + CSS.escape(key) + '"]'), row = b && b.closest(".chk");
      if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); row.classList.add("flash"); setTimeout(function () { row.classList.remove("flash"); }, 1800); }
    }, 80);
  }
  function goDay(n, open) {
    W.S.day = +n;
    W.setView("trip"); W.render(); window.scrollTo(0, 0);
    if (open) setTimeout(function () { var t = document.querySelector('[data-open="' + CSS.escape(open) + '"]'); if (t) t.scrollIntoView({ block: "center" }); openSheet(open); }, 80);
  }
  /* the Book ahead entry for a stop on the trip, if it needs booking */
  W.bookEntryFor = function (P, day, it) {
    if (!W.checklist || !it) return null;
    var cl = W.P === P && W._clCache && W._clCache.P === P ? W._clCache.list : (W._clCache = { P: P, list: W.checklist(P) }).list;
    var k = "item|" + W.cityKey(day.country, day.city) + "|" + W.norm(it.n);
    return cl.filter(function (c) { return c.key === k; })[0] || null;
  };

  /* ======================= quick start ======================= */
  var qs = { open: false, adults: 2, kids: [], msg: "" };
  W.quickStart = function (first) {
    var S = W.S, ages = (S.travelers || []).map(Number).filter(function (a) { return a >= 0; });
    var grown = ages.filter(function (a) { return a >= 18; });
    qs = { open: true, first: !!first, adults: Math.max(1, grown.length || 2), grown: grown, kids: ages.filter(function (a) { return a < 18; }), msg: "" };
    drawQS();
    setTimeout(function () { var f = $("qsWhere"); if (f) f.focus(); }, 60);
  };
  function drawQS() {
    var host = $("qshost"); if (!host) { host = document.createElement("div"); host.id = "qshost"; document.body.appendChild(host); }
    if (!qs.open) { host.innerHTML = ""; document.documentElement.classList.remove("modal-open"); return; }
    var keep = {}; ["qsWhere", "qsCities", "qsStart", "qsDays", "qsFrom"].forEach(function (id) { var e = $(id); if (e) keep[id] = e.value; });
    var start = keep.qsStart != null ? keep.qsStart : "", days = keep.qsDays != null ? keep.qsDays : "10", from = keep.qsFrom != null ? keep.qsFrom : W.S.depart || "";
    host.innerHTML = '<div class="sheet-back" data-qs="close"></div><div class="qs sheet" role="dialog" aria-modal="true" aria-labelledby="qsT">' +
      '<div class="sh-top"><h2 id="qsT">' + (qs.first ? "Where are you headed?" : "Plan a new trip") + '</h2><button type="button" class="icon-btn" data-qs="close" aria-label="Close">' + XI + "</button></div>" +
      '<p class="small muted">' + (qs.first ? "Waypoint plans family trips around naps, little legs and grandparents\' pace. Three quick questions and you\'ll have a day-by-day plan; everything can be changed afterwards." : "Three quick questions. You can fine-tune everything afterwards.") + "</p>" +
      '<label class="fld"><span>Where to?</span><input class="field" id="qsWhere" list="countryList" placeholder="A country, e.g. Greece" value="' + esc(keep.qsWhere || "") + '"></label>' +
      '<label class="fld"><span>Places <em>(optional)</em></span><input class="field" id="qsCities" placeholder="Leave empty and we\'ll pick, or e.g. Crete, Naxos" value="' + esc(keep.qsCities || "") + '"></label>' +
      '<div class="fld"><span>When?</span><div class="qs-when"><input class="field" id="qsStart" type="date" value="' + esc(start) + '" aria-label="Start date"><span class="muted">for</span>' +
      '<input class="field" id="qsDays" type="number" min="2" max="60" value="' + esc(days) + '" aria-label="Number of days"><span class="muted">days</span></div></div>' +
      '<div class="fld"><span>Who\'s going?</span><div class="qs-who"><div class="stepper"><button type="button" data-qs="a-" aria-label="One adult fewer"' + (qs.adults <= 1 ? " disabled" : "") + '>−</button><b>' + qs.adults + '</b><button type="button" data-qs="a+" aria-label="One more adult">+</button></div><span class="muted">adult' + (qs.adults > 1 ? "s" : "") + "</span></div>" +
      '<div class="qs-kids">' + qs.kids.map(function (a, i) {
        return '<span class="kid"><input class="field" type="number" min="0" max="17" value="' + esc(a) + '" data-qskid="' + i + '" aria-label="Age of child ' + (i + 1) + '"><span class="muted">yrs</span><button type="button" class="icon-btn" data-qs="k-' + i + '" aria-label="Remove child ' + (i + 1) + '">' + XI + "</button></span>";
      }).join("") + '<button type="button" class="btn quiet sm" data-qs="k+">+ Add a child</button></div></div>' +
      '<label class="fld"><span>Flying from</span><input class="field" id="qsFrom" list="airportList" placeholder="Your home city or airport" value="' + esc(from) + '"></label>' +
      (qs.msg ? '<p class="warn">' + esc(qs.msg) + "</p>" : "") +
      '<div class="qs-go"><button type="button" class="btn" data-qs="go">Plan my trip</button><button type="button" class="linkish" data-qs="' + (qs.first ? "close" : "slow") + '">' + (qs.first ? "Look around the example trip first" : "Set it up step by step instead") + "</button></div></div>";
    document.documentElement.classList.add("modal-open");
  }
  function qsKids() { document.querySelectorAll("[data-qskid]").forEach(function (e) { var v = Math.round(+e.value); qs.kids[+e.dataset.qskid] = isFinite(v) ? Math.max(0, Math.min(17, v)) : 6; }); }
  function qsGo() {
    qsKids();
    var c = W.countryName ? W.countryName(($("qsWhere") || {}).value || "") : (($("qsWhere") || {}).value || "").trim();
    if (!c) { qs.msg = "Pick a country from the list."; drawQS(); return; }
    var cities = (($("qsCities") || {}).value || "").split(/[,;]+/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
      var k = W.findCity(c, x); return k ? k.name : x.replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    });
    var days = Math.max(2, Math.min(60, Math.round(+($("qsDays") || {}).value) || 10)), start = ($("qsStart") || {}).value || "", from = (($("qsFrom") || {}).value || "").trim();
    var trav = []; for (var i = 0; i < qs.adults; i++) trav.push((qs.grown || [])[i] || 35); trav = trav.concat(qs.kids);
    var S = W.S;
    qs.open = false; drawQS();
    W.newTripFrom({ v: 2, algo: 2, styles: (S.styles || []).slice(), focus: S.focus, countries: [{ name: c, mode: cities.length ? "manual" : "suggest", picked: cities }], days: days, start: start,
      depart: from, travelers: trav, stays: {}, picks: {}, seen: {}, mine: {}, cityDays: {}, tripName: "" });
    W.loadCountry(c);
    W.setView("trip"); W.render(); window.scrollTo(0, 0);
  }
  function qsClick(b) {
    var a = b.dataset.qs;
    if (a === "close") { qs.open = false; drawQS(); return; }
    if (a === "slow") { qs.open = false; drawQS(); if (W.newTripBlank) W.newTripBlank(); W.render(); return; }
    if (a === "go") return qsGo();
    qsKids();
    if (a === "a+") qs.adults = Math.min(12, qs.adults + 1);
    else if (a === "a-") qs.adults = Math.max(1, qs.adults - 1);
    else if (a === "k+") { qs.kids.push(5); drawQS(); var ks = document.querySelectorAll("[data-qskid]"); if (ks.length) ks[ks.length - 1].focus(); return; }
    else if (a.indexOf("k-") === 0) qs.kids.splice(+a.slice(2), 1);
    drawQS();
  }

  /* ======================= undo ======================= */
  var LABELS = { reroll: "", next: "Swapped", use: "Changed a stop", tick: "Updated a booking", rest: "Changed the rest day", routeorder: "Changed the order", livepick: "Changed where you stay",
    legpick: "Changed how you travel", sheetmove: "Moved a stop", sheetremove: "Removed a stop", style: "Changed the trip style", cdays: "Changed the days", late: "Moved today's plan",
    jdel: "Removed a photo", rmbk: "Removed a booking", watch: "Watching the price", unwatch: "Stopped watching", heart: "",
    pick: "Changed the places", addcity: "Added a place", up: "Changed the order", pace: "Changed the pace", paceall: "Changed the pace", mode: "Changed how places are picked",
    delta: "Changed the days", resetdays: "Reset the days", nope: "We won't suggest it again", unnope: "Brought it back", setstay: "Changed where you stay", lstay: "Changed where you stay", addbk: "Added a booking", age: "Changed a traveler" };
  var IDS = { addAdult: "Added a traveler", addChild: "Added a traveler", daysMinus: "Changed the days", daysPlus: "Changed the days", addCountry: "Added a country" };
  function labelFor(b) {
    var d = b.dataset;
    if (d.tick && W.tickLabel) return W.tickLabel(d.tick);
    if (IDS[b.id]) return IDS[b.id];
    for (var k in d) {
      if (LABELS[k]) return LABELS[k];
      if (/^rm/.test(k)) return "Removed";
    }
    return "";
  }
  var undo = null, undoTimer = null, clickSeq = 0;
  function snap() { try { return JSON.stringify(W.syncable(W.S)); } catch (e) { return null; } }
  W.undoPoint = function (before, label) {
    if (!before || W.readOnly) return;
    var now = snap(); if (!now || now === before) return;
    undo = { before: before, label: label || "Changed", trip: W.S.tripId }; showUndo();
  };
  function showUndo() {
    var host = $("undohost"); if (!host) { host = document.createElement("div"); host.id = "undohost"; document.body.appendChild(host); }
    host.innerHTML = undo ? '<div class="undo" role="status"><span>' + esc(undo.label) + '</span><button type="button" data-undo="1">Undo</button></div>' : "";
    clearTimeout(undoTimer);
    if (undo) undoTimer = setTimeout(function () { undo = null; host.innerHTML = ""; }, 7000);
  }
  function doUndo() {
    if (!undo) return;
    var o; try { o = JSON.parse(undo.before); } catch (e) { return; }
    if (undo.trip !== W.S.tripId) { undo = null; showUndo(); return; }   /* a different trip is open now */
    var S = W.S, keepView = W.VIEW_KEYS || [];
    Object.keys(S).forEach(function (k) { if (keepView.indexOf(k) < 0) delete S[k]; });
    Object.keys(o).forEach(function (k) { S[k] = o[k]; });
    undo = null; showUndo();
    W.save(); W.changed();
  }

  /* ======================= stop actions sheet, and drag to reorder ======================= */
  var sheet = null;
  function slotsOf(day) { return day && day.slots || []; }
  function prevPoint(day, slot) {
    var P = W.P, T = W.dayTimes(day, P), order = T && T.order || slotsOf(day).map(function (x) { return x.slot; }), prev = W.homebase(day.country, day.city);
    for (var i = 0; i < order.length && order[i] !== slot; i++) { var x = slotsOf(day).filter(function (y) { return y.slot === order[i]; })[0]; if (x && x.item && x.item.lat != null) prev = x.item; }
    return prev;
  }
  W.openStop = function (key) { openSheet(key); };
  W.closeStop = function () { if (sheet) { sheet = null; drawSheet(); } };
  function openSheet(key) {
    var P = W.P, day = P.days[W.S.day - 1], x = slotsOf(day).filter(function (y) { return y.key === key; })[0];
    if (!x || !x.item) return;
    sheet = { key: key, slot: x.slot, mode: "acts" }; drawSheet();
  }
  /* taking a stop off the plan: at the foot of its panel, well apart from its links (menu, photos, Google Maps) so a
     thumb can't hit it by mistake, each saying what it does; "Not for us" asks once before it acts */
  function outBlock(it, x, day, nm) {
    var city = x.trip && day.trip ? day.trip.name : day.city, slot = nm.toLowerCase();
    if (sheet.ask === "nope") return '<div class="sh-out ask" role="alert"><p><b>Not for us?</b> ' + esc(it.n) + " comes off your plan and won't be suggested in " +
      esc(city) + ' again. You can bring it back from Explore.</p><div class="sh-out-b"><button type="button" class="btn danger" data-sheetact="nopeyes">Yes, not for us</button>' +
      '<button type="button" class="btn quiet" data-sheetact="nopeno">Keep it</button></div></div>';
    return '<div class="sh-out"><p class="sh-out-h">Don\'t want this one?</p>' +
      '<button type="button" class="sh-out-r" data-sheetact="remove"><span class="ic">' + IC.free + "</span><span><b>Leave the " + esc(slot) + ' free</b><span class="small muted">Nothing planned then. You can undo it.</span></span></button>' +
      '<button type="button" class="sh-out-r danger" data-sheetact="nope"><span class="ic">' + IC.no + '</span><span><b>Not for us</b><span class="small muted">Take it off and never suggest it in ' + esc(city) + " again</span></span></button></div>";
  }
  function drawSheet() {
    var host = $("sheethost"); if (!host) { host = document.createElement("div"); host.id = "sheethost"; document.body.appendChild(host); }
    if (!sheet) { host.innerHTML = ""; if (!qs.open) document.documentElement.classList.remove("modal-open"); return; }
    var P = W.P, day = P.days[W.S.day - 1], x = slotsOf(day).filter(function (y) { return y.key === sheet.key; })[0];
    if (!x || !x.item) { sheet = null; return drawSheet(); }
    var it = x.item, food = W.isFood(x.slot), nm = W.SLOT_NAME[x.slot];
    var h = '<div class="sheet-back" data-sheetclose="1"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(it.n) + '"><div class="grab" aria-hidden="true"></div>' +
      '<div class="sh-top"><div><b>' + esc(it.n) + '</b><span class="small muted">Day ' + day.n + " · " + esc(day.city) + "</span></div>" +
      '<button type="button" class="icon-btn" data-sheetclose="1" aria-label="Close">' + XI + "</button></div>";
    if (sheet.mode === "move") {
      var cands = P.days.filter(function (d) { return d.stop === day.stop && d.n !== day.n && d.slots && d.slots.some(function (y) { return y.slot === x.slot && !y.rest; }); });
      h += '<p class="small muted">Swap it with the ' + esc(nm.toLowerCase()) + " on another day in " + esc(day.city) + ".</p>" +
        (cands.length ? '<div class="sh-list">' + cands.map(function (d) {
          var y = d.slots.filter(function (z) { return z.slot === x.slot; })[0];
          return '<button type="button" class="sh-row" data-sheetmove="' + d.n + '"><b>Day ' + d.n + "</b><span>" + esc(fmt(W.dateOf(d.n), { weekday: "short", month: "short", day: "numeric" })) + "</span>" +
            '<span class="muted">' + (y && y.item ? "now: " + esc(y.item.n) : "free") + "</span></button>";
        }).join("") + "</div>" : '<p class="small">There are no other days in ' + esc(day.city) + " to move it to.</p>") +
        '<button type="button" class="linkish" data-sheetback="1">← Back</button>';
    } else {
      var dir = W.gmapsDir(prevPoint(day, x.slot), it, "walk");
      /* everything about the stop, then what you can do with it */
      h += (W.stopDetails ? W.stopDetails(P, day, x) : "") + '<div class="sh-acts">' +
        '<a class="sh-act" href="' + esc(dir) + '" target="_blank" rel="noopener"><span class="ic">' + IC.dir + "</span>Directions</a>" +
        (!W.canEdit() ? "" : '<button type="button" class="sh-act" data-sheetact="swap"><span class="ic">' + IC.swap + "</span>Swap</button>" +
        '<button type="button" class="sh-act" data-sheetact="move"><span class="ic">' + IC.move + "</span>Move to another day</button>" +
        '<button type="button" class="sh-act" data-sheetact="reorder"><span class="ic">' + IC.order + "</span>Reorder today</button>") +
        "</div>" + (!W.canEdit() ? "" : '<p class="small muted sh-tip">Tip: press and hold a photo to swap two stops.</p>' + outBlock(it, x, day, nm));
    }
    host.innerHTML = h + "</div>";
    document.documentElement.classList.add("modal-open");
  }
  /* swapping and reordering happen in the day's list: from the storybook, go there first */
  function dayList(then) {
    if (W.S.tview !== "story" || W.view() !== "trip") return then();
    W.S.tview = "days"; W.render(); setTimeout(then, 60);
  }
  function sheetAct(a) {
    var P = W.P, day = P.days[W.S.day - 1], x = slotsOf(day).filter(function (y) { return y.key === sheet.key; })[0], S = W.S;
    if (!x) { sheet = null; return drawSheet(); }
    if (a === "swap") { sheet = null; drawSheet(); dayList(function () { var r = document.querySelector('[data-reroll="' + x.slot + '"]'); if (r) r.click(); }); return; }
    if (a === "move") { sheet.mode = "move"; return drawSheet(); }
    if (a === "reorder") { var lk = sheet.key; sheet = null; drawSheet(); dayList(function () { startLift(lk); }); return; }
    if (a === "nope") { sheet.ask = "nope"; drawSheet(); var q = document.querySelector("#sheethost .sh-out.ask"); if (q && q.scrollIntoView) q.scrollIntoView({ block: "nearest" }); return; }
    if (a === "nopeno") { delete sheet.ask; return drawSheet(); }
    if (a === "nopeyes") {
      /* never this place again in this city: the slot gets a new suggestion */
      var b4 = snap(), pc = x.trip && day.trip ? [day.trip.country, day.trip.name] : [day.country, day.city];
      W.sayNo(pc[0], pc[1], x.item, P);
      sheet = null; drawSheet(); W.undoPoint(b4, "We won't suggest it again"); W.save(); W.changed(); return;
    }
    if (a === "remove") {
      var before = snap();
      (S.free || (S.free = {}))[x.key] = 1; delete S.picks[x.key]; if (S.mine) delete S.mine[x.key];
      sheet = null; drawSheet(); W.undoPoint(before, "Left it free"); W.save(); W.changed(); return;
    }
  }
  /* exchange two stops (both stay where you put them) */
  function exchange(ka, kb) {
    var S = W.S, a = S.picks[ka], b = S.picks[kb], m = S.mine || (S.mine = {}), f = S.free || (S.free = {});
    if (a) { S.picks[kb] = a; m[kb] = 1; delete f[kb]; } else { delete S.picks[kb]; f[kb] = 1; }
    if (b) { S.picks[ka] = b; m[ka] = 1; delete f[ka]; } else { delete S.picks[ka]; f[ka] = 1; }
  }
  function sheetMove(n) {
    var P = W.P, day = P.days[W.S.day - 1], x = slotsOf(day).filter(function (y) { return y.key === sheet.key; })[0], d = P.days[+n - 1];
    var y = d && slotsOf(d).filter(function (z) { return z.slot === x.slot; })[0]; if (!x || !y) return;
    var before = snap();
    /* make sure both names are stored, then swap */
    if (x.item) W.S.picks[x.key] = x.item.n; if (y.item) W.S.picks[y.key] = y.item.n;
    exchange(x.key, y.key);
    sheet = null; drawSheet(); W.undoPoint(before, "Moved to Day " + d.n); W.save(); W.changed();
  }
  /* reorder a day. With a mouse: drag a stop by its photo onto another one. On a phone: press and hold a photo
     (or pick "Swap with another stop today"), then tap the stop to trade places with. */
  function swapStops(ka, kb) {
    var P = W.P, day = P.days[W.S.day - 1], a = slotsOf(day).filter(function (y) { return y.key === ka; })[0], b = slotsOf(day).filter(function (y) { return y.key === kb; })[0];
    if (!a || !b) return;
    var before = snap();
    if (a.item) W.S.picks[a.key] = a.item.n; if (b.item) W.S.picks[b.key] = b.item.n;
    exchange(a.key, b.key); W.undoPoint(before, "Swapped " + W.SLOT_NAME[a.slot].toLowerCase() + " and " + W.SLOT_NAME[b.slot].toLowerCase()); W.save(); W.changed();
  }
  var lift = null;
  function canTake(card) { return lift && card && card.dataset.slotkey && card.dataset.slotkey !== lift.key && card.classList.contains("food") === lift.food && !card.classList.contains("skel"); }
  function paintLift() {
    document.querySelectorAll(".slot.lifted, .slot.droppable").forEach(function (c) { c.classList.remove("lifted", "droppable"); });
    document.documentElement.classList.toggle("lifting", !!lift);
    var host = $("lifthost"); if (!host) { host = document.createElement("div"); host.id = "lifthost"; document.body.appendChild(host); }
    if (!lift) { host.innerHTML = ""; return; }
    var cards = document.querySelectorAll(".slots .slot[data-slotkey]"), any = false;
    cards.forEach(function (c) { if (c.dataset.slotkey === lift.key) c.classList.add("lifted"); else if (canTake(c)) { c.classList.add("droppable"); any = true; } });
    host.innerHTML = '<div class="lifthint" role="status"><span>' + (any ? "Now tap the " + (lift.food ? "meal" : "stop") + " to swap with" : "Nothing else today to swap with") + '</span><button type="button" data-liftoff="1">Cancel</button></div>';
  }
  function startLift(key) {
    var P = W.P, day = P.days[W.S.day - 1], x = slotsOf(day).filter(function (y) { return y.key === key; })[0]; if (!x) return;
    lift = { key: key, food: W.isFood(x.slot), name: x.item ? x.item.n : W.SLOT_NAME[x.slot] };
    paintLift();
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  }
  function endLift() { if (!lift) return; lift = null; paintLift(); }
  W.afterRender = function () { if (lift) { if (W.view() !== "trip") lift = null; paintLift(); } if (sheet && sheet.mode !== "move") drawSheet(); };

  var drag = null;
  function arm() {
    drag.on = true; drag.card.classList.add("dragging");
    var g = drag.card.cloneNode(true), r = drag.card.getBoundingClientRect();
    g.className += " ghost"; g.removeAttribute("data-slotkey"); g.style.width = r.width + "px"; g.style.left = r.left + "px"; g.style.top = "0px"; document.body.appendChild(g); drag.ghost = g; drag.dy = drag.y - r.top;
    place(drag.x, drag.y);
  }
  function place(x, y) {
    if (!drag.ghost) return;
    drag.ghost.style.transform = "translate(" + Math.round(x - drag.x) + "px," + Math.round(y - drag.dy) + "px) rotate(-1.2deg)";
    var el = document.elementFromPoint(x, y), t = el && el.closest(".slots .slot");
    if (drag.target && drag.target !== t) drag.target.classList.remove("droptarget");
    drag.target = t && t !== drag.card && t.dataset.slotkey && t.classList.contains("food") === drag.food && !t.classList.contains("skel") ? t : null;
    if (drag.target) drag.target.classList.add("droptarget");
  }
  /** @type {{ x: number; y: number; key: string; id: number; t?: ReturnType<typeof setTimeout> } | null} */ var hold = null;
  document.addEventListener("pointerdown", function (e) {
    var h = e.target.closest && e.target.closest(".slots .slot .thumb, .slots .slot > .num");
    if (!h || !W.canEdit() || W.view() !== "trip" || e.button > 0) return;
    var card = h.closest(".slot"); if (!card || !card.dataset.slotkey) return;
    if (e.pointerType !== "mouse") {
      /* press and hold: lift it, then tap where it goes */
      clearTimeout(hold && hold.t);
      hold = { x: e.clientX, y: e.clientY, key: card.dataset.slotkey, id: e.pointerId };
      hold.t = setTimeout(function () { if (hold) { var k = hold.key; hold = null; startLift(k); W.suppressClick = Date.now(); } }, 450);
      return;
    }
    drag = { card: card, key: card.dataset.slotkey, food: card.classList.contains("food"), x: e.clientX, y: e.clientY, on: false, id: e.pointerId, target: null };
  });
  function noHold() { if (hold) { clearTimeout(hold.t); hold = null; } }
  document.addEventListener("pointermove", function (e) {
    if (hold && e.pointerId === hold.id && Math.abs(e.clientX - hold.x) + Math.abs(e.clientY - hold.y) > 10) noHold();
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) { if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return; arm(); }
    e.preventDefault(); place(e.clientX, e.clientY);
  }, { passive: false });
  document.addEventListener("contextmenu", function (e) { if (hold || lift || drag) e.preventDefault(); });
  function endDrag(e) {
    if (hold && (!e || e.pointerId === hold.id)) { if (e && e.type === "pointercancel") noHold(); else if (e && e.type === "pointerup") noHold(); }
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    if (!d.on) return;
    d.card.classList.remove("dragging"); if (d.ghost) d.ghost.remove();
    if (d.target) { d.target.classList.remove("droptarget"); if (e.type !== "pointercancel") swapStops(d.key, d.target.dataset.slotkey); }
    W.suppressClick = Date.now();
  }
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  /* ======================= swipe between days ======================= */
  var sw = null;
  document.addEventListener("touchstart", function (e) {
    sw = null;
    if (W.view() !== "trip" || e.touches.length !== 1 || drag) return;
    var t = e.target;
    if (t.closest(".explorer, .daybar, .idea-list, .swapcards, .opts, input, textarea, select, .live-list, .jgrid, .glance, .sheet, .legopts, .vtwrap, .map, canvas, .thumb, .story")) return;
    sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!sw) return; var s = sw; sw = null;
    var t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Date.now() - s.t > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    var btn = document.querySelector('#viewTrip .daybar [data-step="' + (dx < 0 ? 1 : -1) + '"]'); if (btn && !btn.disabled) btn.click();
  }, { passive: true });

  /* changing day from further down the page: start the new day at its top */
  function toDayTop() {
    var bar = document.querySelector("#viewTrip .daybar"); if (!bar) return;
    var y = bar.getBoundingClientRect().top + window.scrollY - 8;
    if (window.scrollY > y + 40) window.scrollTo({ top: y, behavior: "smooth" });
  }
  /* the buttons under a day: previous and next */
  W.dayNav = function (day, P) {
    var a = P.days[day.n - 2], b = P.days[day.n];
    if (!a && !b) return "";
    function side(d, dir) {
      return '<button type="button" class="dn-b ' + (dir < 0 ? "pv" : "nx") + '" data-step="' + dir + '" aria-label="' + (dir < 0 ? "Previous" : "Next") + " day: Day " + d.n + ", " + esc(d.city) + '">' +
        (dir < 0 ? CHEVL : "") + '<span><small>' + (dir < 0 ? "Previous" : "Next") + "</small><b>Day " + d.n + " · " + esc(d.city) + "</b></span>" + (dir > 0 ? CHEV : "") + "</button>";
    }
    return '<nav class="daynav" aria-label="Other days">' + (a ? side(a, -1) : "") + (b ? side(b, 1) : "") + "</nav>";
  };

  /* ======================= all days at a glance ======================= */
  function rangeOf(P, si) {
    var ds = P.days.filter(function (d) { return d.stop === si; }), a = W.dateOf(ds[0].n), b = W.dateOf(ds[ds.length - 1].n);
    if (!a) return "";
    var mo = { month: "short", day: "numeric" };
    return a.getMonth() === b.getMonth() ? fmt(a, mo) + "–" + b.getDate() : fmt(a, mo) + " – " + fmt(b, mo);
  }
  /* the stays in order: one segment per place, as wide as its share of the nights */
  W.stayBar = function (P, tn) {
    var cur = tn ? P.days[tn - 1].stop : -1;
    return '<nav class="staybar" aria-label="Your stays, in order">' + P.stops.map(function (s, si) {
      var r = rangeOf(P, si), n = s.days;
      return '<button type="button" class="sb-seg' + (si === 0 ? " on" : "") + (si === cur ? " now" : "") + '" data-staygo="' + si + '" style="flex-grow:' + n + '"' + (si === 0 ? ' aria-current="true"' : "") +
        ' aria-label="' + esc(s.name + ", " + n + " night" + (n === 1 ? "" : "s") + (r ? ", " + r : "")) + '" title="' + esc(s.name + (r ? " · " + r : "")) + '"><b>' + esc(s.name) + "</b><span>" + esc(r || n + " night" + (n === 1 ? "" : "s")) + "</span></button>";
    }).join("") + "</nav>";
  };
  /* which stay is under the bar while you scroll; tapping a stay scrolls to it */
  var trackOn = false, trackRaf = 0;
  function trackNow() {
    trackRaf = 0;
    var bar = document.querySelector("#viewTrip:not([hidden]) .staybar"); if (!bar) return;
    var secs = document.querySelectorAll("#viewTrip .g-sec"); if (!secs.length) return;
    var line = bar.getBoundingClientRect().bottom + 14, at = 0;
    secs.forEach(function (sec, i) { if (sec.getBoundingClientRect().top <= line) at = i; });
    bar.classList.toggle("stuck", bar.getBoundingClientRect().top <= 0.5 && window.scrollY > 0);
    var si = +secs[at].dataset.stop, segs = bar.querySelectorAll(".sb-seg");
    segs.forEach(function (b) { var on = +b.dataset.staygo === si; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    var on = bar.querySelector(".sb-seg.on");
    if (on && (on.offsetLeft < bar.scrollLeft || on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth)) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
  }
  /* room after the last stay, so every stay can scroll up under the bar (a tap lands on it; the highlight follows) */
  function stayRoom() {
    var wrap = document.querySelector("#viewTrip .all-days"), bar = document.querySelector("#viewTrip .staybar"), secs = document.querySelectorAll("#viewTrip .g-sec");
    if (!wrap || !bar || !secs.length) return;
    var tabs = document.querySelector(".tabs"), tb = tabs && getComputedStyle(tabs).position === "fixed" ? tabs.getBoundingClientRect().height : 0;
    var last = secs[secs.length - 1].getBoundingClientRect().height;
    wrap.style.paddingBottom = Math.max(0, Math.round(window.innerHeight - bar.getBoundingClientRect().height - last - tb - 24)) + "px";
  }
  W.stayTrack = function () {
    if (!trackOn) {
      trackOn = true;
      window.addEventListener("scroll", function () { if (!trackRaf) trackRaf = requestAnimationFrame(trackNow); }, { passive: true });
      window.addEventListener("resize", function () { stayRoom(); if (!trackRaf) trackRaf = requestAnimationFrame(trackNow); }, { passive: true });
    }
    stayRoom(); requestAnimationFrame(trackNow);
  };
  function stayGo(si) {
    var sec = document.querySelector('#viewTrip .g-sec[data-stop="' + si + '"]'), bar = document.querySelector("#viewTrip .staybar"); if (!sec || !bar) return;
    var y = sec.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().height - 10;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, y), behavior: calm ? "auto" : "smooth" });
  }
  W.glance = function (P) {
    if (!W.S.glanceOpen) return "";
    var story = '<button type="button" class="story-link" data-story="1"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5C8.2 4.2 5.7 3.8 3 4.2v11.3c2.7-.4 5.2 0 7 1.3 1.8-1.3 4.3-1.7 7-1.3V4.2c-2.7-.4-5.2 0-7 1.3zM10 5.5v11.3"/></svg>' +
      "<span><b>See it as a storybook</b><span class=\"small muted\">The whole trip, a page a day, with photos</span></span></button>";
    var tn = W.todayN(P);
    function row(d) {
      var T = d.slots && d.slots.length ? W.dayTimes(d, P) : null, E = T && W.dayEnergy ? W.dayEnergy(d, P, T) : null;
      var hl = "";
      if (d.moveFrom) { var L = W.legFor(P, d.stop); hl = d.moveFrom + " → " + d.city + (L && L.best ? " by " + W.modeName(L.best.mode).toLowerCase() : ""); }
      else if (d.trip) hl = "Day trip to " + d.trip.name;
      else (d.slots || []).some(function (x) { if (x.item && !W.isFood(x.slot)) { hl = x.item.n; return true; } return false; });
      if (d.rest) hl = "Rest day" + (hl ? " · " + hl : "");
      var bars = E ? '<span class="energy lv' + E.level + '" title="' + esc(E.label) + ' day"><span class="bars">' + [1, 2, 3, 4].map(function (i) { return "<i" + (i <= E.level ? ' class="on"' : "") + "></i>"; }).join("") + "</span></span>" : "";
      var dt = fmt(W.dateOf(d.n), { weekday: "short", month: "short", day: "numeric" });
      return '<button type="button" role="listitem" class="g-day' + (d.n === W.S.day ? " on" : "") + (d.n === tn ? " today" : "") + '" data-day="' + d.n + '"' + (d.n === W.S.day ? ' aria-current="true"' : "") + ">" +
        '<span class="g-top"><b>Day ' + d.n + "</b>" + (dt ? " · " + esc(dt) : "") + (d.n === tn ? ' <span class="g-now">Today</span>' : "") + "</span>" + bars +
        '<span class="g-main">' + (hl ? esc(hl) : '<span class="muted">' + esc(d.city) + "</span>") + "</span></button>";
    }
    /* one card per place you stay, in order, its days inside */
    /* "Check my plan" comes with the second script */
    var rev = W.reviewBlock ? W.reviewBlock(P) : (W.needLater(), "");
    return story + rev + P.stops.map(function (s, si) {
      var ds = P.days.filter(function (d) { return d.stop === si; }), r = rangeOf(P, si), n = s.days;
      var trips = (s.trips || []).filter(function (t) { return t.planned !== false; }).map(function (t) { return t.name; });
      return '<section class="g-sec" data-stop="' + si + '"><h3 class="g-stop"><span class="g-sn">' + esc(s.name) + '</span><span class="g-sm">' + esc([r, n + " night" + (n === 1 ? "" : "s"), trips.length ? "day trip" + (trips.length > 1 ? "s" : "") + " to " + trips.join(", ") : ""].filter(Boolean).join(" · ")) + "</span></h3>" +
        '<div class="glance sk" role="list">' + ds.map(row).join("") + "</div></section>";
    }).join("") + '<p class="g-end">' + esc("End of the trip" + (P.ap && P.days.length && W.dateOf(P.N) ? " · home from " + P.stops[P.stops.length - 1].name + " " + fmt(W.dateOf(P.N), { month: "short", day: "numeric" }) : "")) + "</p>";
  };

  /* ======================= clicks (run before the views' own handlers) ======================= */
  document.addEventListener("click", function (e) {
    if (W.suppressClick && Date.now() - W.suppressClick < 400) { e.preventDefault(); e.stopPropagation(); return; }
    if (lift) {
      var lc = e.target.closest && e.target.closest(".slots .slot");
      e.preventDefault(); e.stopPropagation();
      if (lc && canTake(lc)) { var from = lift.key; lift = null; paintLift(); swapStops(from, lc.dataset.slotkey); } else endLift();
      return;
    }
    if (W.closeTripMenu && e.target.closest && !e.target.closest(".trip-menu, .trip-sw")) W.closeTripMenu();
    var b = e.target.closest("button, a");
    if (!b) {
      var card = e.target.closest && e.target.closest(".slots .slot[data-slotkey]:not(.free):not(.skel)");
      if (card && !e.target.closest(".swap, .slot-notes a")) { openSheet(card.dataset.slotkey); }
      return;
    }
    var d = b.dataset || {};
    function stop() { e.preventDefault(); e.stopPropagation(); }
    if (d.comment && sheet) { sheet = null; drawSheet(); }
    if (d.qs) { stop(); qsClick(b); return; }
    if (d.quick) { stop(); W.quickStart(); return; }
    if (d.undo) { stop(); doUndo(); return; }
    if (d.nextstep) { stop(); var el = $("nextbar"); go(el && el.__step && el.__step.go); return; }
    if (d.nexthide) { stop(); var nh = W.S.nextHide || (W.S.nextHide = {}); nh[d.nexthide] = 1; W.save(); W.render(); return; }
    if (d.sheet) { stop(); openSheet(d.sheet); return; }
    if (d.sheetclose) { stop(); sheet = null; drawSheet(); return; }
    if (d.sheetback) { stop(); sheet.mode = "acts"; drawSheet(); return; }
    if (d.sheetact) { stop(); sheetAct(d.sheetact); return; }
    if (d.sheetmove) { stop(); sheetMove(d.sheetmove); return; }
    if (d.staygo != null) { stop(); stayGo(+d.staygo); return; }
    if (d.glance) { stop(); W.S.glanceOpen = !W.S.glanceOpen; if (W.S.glanceOpen && W.fxAfter) W.fxAfter(function () { if (W.fxExpand) W.fxExpand(".glance"); }); W.render(); return; }
    if (d.gobook) { stop(); if (sheet) { sheet = null; drawSheet(); } goBook(d.gobook); return; }
    if (d.goday) { stop(); goDay(d.goday, d.goopen); return; }
    if (d.gostay != null && W.view() !== "trip") { stop(); goStay(+d.gostay); return; }
    if (d.day && W.S.glanceOpen && b.closest(".glance")) { W.S.glanceOpen = false; }
    if ((d.step || d.day) && W.view() === "trip") toDayTop();
    /* everything else: remember the state, so a change can be undone */
    if (b.tagName === "BUTTON" && W.canEdit()) {
      var lab = labelFor(b); if (!lab) return;
      var before = snap(), seq = ++clickSeq, done = false;
      [0, 520].forEach(function (t) { setTimeout(function () { if (!done && seq === clickSeq && snap() !== before) { done = true; W.undoPoint(before, lab); } }, t); });
    }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (lift) endLift(); else if (sheet) { sheet = null; drawSheet(); } else if (qs.open) { qs.open = false; drawQS(); } else if (W.closeTripMenu) W.closeTripMenu();
  });
  /* the side-by-side map appears above 920px wide: redraw when the window crosses that */
  var wide = window.innerWidth > 920, rT = null;
  window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(function () { var w = window.innerWidth > 920; if (w !== wide) { wide = w; if (W.view() === "trip") W.render(); } else if (W.storyFit) W.storyFit(); }, 200); });
  document.addEventListener("input", function (e) { if (e.target && e.target.dataset && e.target.dataset.qskid != null) qsKids(); });
})();
