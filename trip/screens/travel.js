/* Waypoint Travel mode and storybook.
   Travel mode swaps Setup for Today: one calm screen with now, next, when to leave, naps, tickets and running late.
   It turns on by itself while the trip is on, and the switch in the header changes it any time.
   The storybook shows the trip as one photo page per day, with the city painted like the Waypoint letters. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc, $ = W.$;
  var nowMin = W.nowMin;
  function fmt(d, o) { return d ? d.toLocaleDateString(undefined, o || { weekday: "short", month: "short", day: "numeric" }) : ""; }
  function svg(d, vb) { return '<svg viewBox="' + (vb || "0 0 20 20") + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; }
  var IC = {
    dir: svg('<path d="M10 2.5l7.5 7.5-7.5 7.5L2.5 10z"/><path d="M8 12v-2.2c0-.7.5-1.3 1.3-1.3H12M11 7l1.5 1.5L11 10"/>'),
    ticket: svg('<path d="M3 6.5a1.5 1.5 0 0 0 0 3v4A1.5 1.5 0 0 0 4.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 1 0-3A1.5 1.5 0 0 0 15.5 5h-11A1.5 1.5 0 0 0 3 6.5z"/>'),
    more: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12.8" cy="8" r="1.5"/></svg>',
    bed: svg('<path d="M2.5 15.5v-9M2.5 12.5h15v3M17.5 12.5v-2a2.5 2.5 0 0 0-2.5-2.5H9v4.5"/><circle cx="5.8" cy="9.8" r="1.6"/>'),
    moon: svg('<path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z"/>'),
    check: svg('<path d="M4.5 10.5l3.5 3.5 7.5-8"/>'),
    train: svg('<rect x="5" y="2.5" width="10" height="12" rx="2.5"/><path d="M5 10h10M7.5 17.5l1.5-3M12.5 17.5l-1.5-3"/><circle cx="7.8" cy="12.3" r=".5" fill="currentColor"/><circle cx="12.2" cy="12.3" r=".5" fill="currentColor"/>'),
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
  /* the switch in the trip bar */
  W.modeSeg = function (P) {
    if (!P || !P.stops || !P.stops.length) return "";
    var t = W.travelOn(P);
    return '<button type="button" class="tm-sw" role="switch" aria-checked="' + t + '" data-appmode="' + (t ? "plan" : "travel") + '" title="Travel mode: one screen for now, next and when to leave">' +
      '<span class="tm-k" aria-hidden="true"><i></i></span><span class="l">Travel mode</span><span class="s" aria-hidden="true">Travel</span></button>';
  };

  /* what the rescue did, in a line */
  function rescueLine(r) {
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
  W.renderGo = function (P) {
    var el = $("viewGo"); if (!el) return;
    if (!P.stops.length) { el.innerHTML = '<div class="empty sk">Plan a trip first, then this screen walks you through each day.</div>'; return; }
    var S = W.S, tn = W.todayN(P), n = goN || tn || S.day || 1;
    n = Math.max(1, Math.min(P.N, n)); S.day = n;
    var day = P.days[n - 1], live = tn === n, nm = live ? nowMin() : null, T = day.slots && day.slots.length ? W.dayTimes(day, P) : null;
    var home = W.homebase(day.country, day.city), list = entries(day, T), h = "";

    /* the top: which day, and moving between days */
    var a = P.days[n - 2], b = P.days[n];
    if (W.kidNames && P.p.kid) h += '<button type="button" class="kids-chip" data-view="kids"><span aria-hidden="true">★</span> ' + esc(W.kidNames(13).length ? "For " + W.joinNames(W.kidNames(13)) : "For the kids") + ": their day, passport and treasure hunt ›</button>";
    h += '<div class="go-top"><button type="button" class="icon-btn" data-goprev="' + (a ? a.n : "") + '"' + (a ? "" : " disabled") + ' aria-label="Previous day">' + IC.chevL + "</button>" +
      '<div class="gt-m"><span class="gt-k' + (live ? " live" : "") + '">' + (live ? "Today" : tn ? (n > tn ? "Coming up" : "Earlier") : "Preview") + "</span><b>Day " + n + " · " + esc(day.city) + "</b>" +
      '<span class="muted">' + esc([fmt(W.dateOf(n), { weekday: "long", month: "short", day: "numeric" }), live ? W.clock(nm) : ""].filter(Boolean).join(" · ")) + "</span></div>" +
      '<button type="button" class="icon-btn" data-goprev="' + (b ? b.n : "") + '"' + (b ? "" : " disabled") + ' aria-label="Next day">' + IC.chevR + "</button></div>";
    if (tn && !live) h += '<button type="button" class="linkish go-back" data-gotoday="1">← Back to today</button>';
    if (W.holidayLine) h += W.holidayLine(day);
    if (!tn && !goN) h += '<p class="small muted go-pre">' + (W.S.start ? "Your trip hasn't started yet. This is how each day will look while you're there." : "Add your travel dates and this screen follows the clock while you travel.") + "</p>";

    if (!T) {
      h += '<div class="empty sk"><div class="loading" style="justify-content:center">Gathering ideas for ' + esc(day.city) + "…</div></div>";
      el.innerHTML = '<div class="go">' + h + "</div>"; return;
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
        '<span class="small muted">Nothing that has started or is booked changes. One tap, undo any time.</span></div>';
    }

    /* the whole day */
    h += '<section class="go-day sk"><h3>' + (live ? "Today" : "The day") + '</h3><ol class="go-tl">' + list.map(function (e) {
      var st = !live ? "" : e.end <= nm && e.k !== "back" ? " done" : e === cur ? " now" : e === nxt ? " next" : "";
      if (e.k === "stop") {
        var it = e.x.item, bk = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
        return '<li class="tl-stop' + st + (e.food ? " food" : "") + '"><span class="t">' + W.clock(e.start) + '</span><span class="dot" aria-hidden="true"></span>' +
          '<button type="button" class="tl-b" data-sheet="' + esc(e.x.key) + '" aria-haspopup="dialog"><b>' + esc(it.n) + '</b><span class="muted">' + esc(slotName(e)) +
          (bk ? (bk.done ? ' · <span class="ok">booked</span>' : ' · <span class="warn-t">not booked</span>') : "") + "</span></button></li>";
      }
      if (e.k === "nap") return '<li class="tl-nap' + st + '"><span class="t">' + W.clock(e.start) + '</span><span class="dot" aria-hidden="true"></span><div class="tl-b"><b>' + (e.away ? "Nap in the stroller or the car" : "Nap or rest") + '</b><span class="muted">' + (e.away ? "out for the day" : "at " + esc(home.label)) + " · until " + W.clock(e.end) + "</span></div></li>";
      if (e.k === "rest") return '<li class="tl-nap' + st + '"><span class="t">' + W.clock(e.start) + '</span><span class="dot" aria-hidden="true"></span><div class="tl-b"><b>Rest time</b><span class="muted">pool or playground near ' + esc(home.label) + "</span></div></li>";
      if (e.k === "travel") return '<li class="tl-trav' + st + '"><span class="t">' + W.clock(e.start) + '</span><span class="dot" aria-hidden="true"></span><div class="tl-b"><b>' + esc(day.moveFrom + " → " + day.city) + '</b><span class="muted">' + esc(travelLine(e.leg, e)) + "</span></div></li>";
      return '<li class="tl-back' + st + '"><span class="t">' + W.clock(e.start) + '</span><span class="dot" aria-hidden="true"></span><div class="tl-b"><b>Back at ' + esc(home.label) + "</b></div></li>";
    }).join("") + "</ol></section>";

    /* today's tickets and bookings */
    var cl = W.checklist ? W.checklist(P).filter(function (c) { return c.day === n && c.key.indexOf("stay|") !== 0 && c.key.indexOf("flight|") !== 0; }) : [];
    if (cl.length) h += '<section class="go-tix sk"><h3>Tickets ' + (live ? "today" : "for this day") + "</h3>" + cl.map(function (c) {
      return '<div class="gt-row"><span class="gt-i' + (c.done ? " ok" : "") + '">' + (c.done ? IC.check : IC.ticket) + '</span><div><b>' + esc(c.short || c.title) + '</b><span class="small muted">' + esc(c.done ? (c.why || "Booked") : "Not booked yet") + "</span></div>" +
        (c.url && !c.done ? '<a class="chip-a pri" href="' + esc(c.url) + '" target="_blank" rel="noopener">Book ↗</a>' : '<button type="button" class="chip-a" data-gobook="' + esc(c.key) + '">Details</button>') + "</div>";
    }).join("") + "</section>";

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
    el.innerHTML = '<div class="go">' + h + "</div>";
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

  /* ======================= storybook ======================= */
  /* painted scenes inside the letters, like the Waypoint wordmark */
  var SCENES = {
    sea: '<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F98D6"/><stop offset=".5" stop-color="#86C0E8"/></linearGradient><rect width="400" height="200" fill="url(#a)"/><circle cx="300" cy="62" r="26" fill="#FBE3A4"/>' +
      '<path d="M0 112 Q50 102 100 112 T200 112 T300 112 T400 112 V200 H0Z" fill="#2E7FB8"/><path d="M0 132 Q50 122 100 132 T200 132 T300 132 T400 132 V200 H0Z" fill="#3E9CC9"/><path d="M0 154 Q50 146 100 154 T200 154 T300 154 T400 154 V200 H0Z" fill="#62C1D6"/><path d="M0 176 Q100 166 200 174 T400 172 V200 H0Z" fill="#F2DDB0"/>' +
      '<g stroke="#F4FBFF" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"><path d="M30 124 q10 -5 20 0"/><path d="M160 144 q10 -5 20 0"/><path d="M280 122 q10 -5 20 0"/><path d="M340 160 q10 -5 20 0"/></g>',
    meadow: '<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A9FDA"/><stop offset="1" stop-color="#93CBEC"/></linearGradient><rect width="400" height="200" fill="url(#a)"/>' +
      '<g fill="#EFE3C8"><ellipse cx="80" cy="50" rx="34" ry="14"/><ellipse cx="110" cy="40" rx="26" ry="16"/><ellipse cx="290" cy="58" rx="30" ry="12"/></g><path d="M0 120 Q100 96 200 116 T400 108 V200 H0Z" fill="#8DC25E"/><path d="M0 150 Q120 132 240 148 T400 142 V200 H0Z" fill="#74AB4A"/>' +
      '<g><circle cx="40" cy="160" r="6" fill="#EE8FB5"/><circle cx="90" cy="176" r="6" fill="#FFF8EC"/><circle cx="150" cy="158" r="5" fill="#7FA2E6"/><circle cx="210" cy="180" r="6" fill="#F2C94C"/><circle cx="270" cy="162" r="6" fill="#EE8FB5"/><circle cx="330" cy="178" r="6" fill="#FFF8EC"/><circle cx="370" cy="156" r="5" fill="#7FA2E6"/></g>',
    sunset: '<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4BE62"/><stop offset=".55" stop-color="#EC8457"/><stop offset="1" stop-color="#C65E3E"/></linearGradient><rect width="400" height="200" fill="url(#a)"/>' +
      '<circle cx="200" cy="96" r="34" fill="#FBE3A4"/><g fill="#F7A27C" opacity=".85"><ellipse cx="90" cy="54" rx="44" ry="8"/><ellipse cx="310" cy="70" rx="40" ry="7"/></g><path d="M0 150 L70 118 L140 140 L230 110 L310 136 L400 116 V200 H0Z" fill="#8A4B3A"/><path d="M0 176 Q200 158 400 172 V200 H0Z" fill="#6B3A2E"/>',
    night: '<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363C78"/><stop offset="1" stop-color="#5A65A3"/></linearGradient><rect width="400" height="200" fill="url(#a)"/>' +
      '<g fill="#F3E7C4"><circle cx="40" cy="40" r="2.5"/><circle cx="150" cy="30" r="2"/><circle cx="250" cy="52" r="2.5"/><circle cx="350" cy="28" r="2"/><circle cx="90" cy="80" r="1.8"/></g><circle cx="300" cy="70" r="24" fill="#F6EAC6"/><circle cx="310" cy="62" r="21" fill="#3D4482"/>' +
      '<path d="M0 150 L60 112 L110 134 L180 96 L250 130 L320 104 L400 136 V200 H0Z" fill="#2B305C"/><path d="M0 178 Q200 164 400 174 V200 H0Z" fill="#3A3F61"/>',
    crystal: '<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6A4FA6"/><stop offset="1" stop-color="#3A2A68"/></linearGradient><rect width="400" height="200" fill="url(#a)"/>' +
      '<path d="M0 0 L120 0 L60 110Z" fill="#7C61B8"/><path d="M260 0 L400 0 L400 90 L330 120Z" fill="#8466C2"/><path d="M130 40 L200 10 L230 100 L160 130Z" fill="#9B80D6"/><path d="M300 90 L320 120 L300 150 L280 120Z" fill="#F4EEFF"/>' +
      '<path d="M40 200 L80 120 L110 200Z" fill="#B796EE"/><path d="M120 200 L170 104 L200 200Z" fill="#CDB4F6"/><path d="M220 200 L260 140 L280 200Z" fill="#A47EE4"/><path d="M300 200 L350 130 L380 200Z" fill="#C2A6F2"/>'
  };
  /* like the wordmark, the letters are painted with a few scenes, each scene filling whole letters */
  var TRIO = { sea: ["sea", "sunset", "meadow"], meadow: ["meadow", "sea", "sunset"], sunset: ["sunset", "meadow", "crystal"], night: ["crystal", "sunset", "sea"], crystal: ["sea", "crystal", "sunset"] };
  /* each scene as an image, painted with a little brush texture */
  var SCENE_URI = {};
  Object.keys(SCENES).forEach(function (k) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"><defs><filter id="p"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter></defs><g filter="url(#p)">' + SCENES[k] + "</g></svg>";
    SCENE_URI[k] = "data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  });
  /* ---- the storybook's city names, drawn as one SVG each ----
     Sized by the drawing itself (its viewBox), so a name always fits its page: phones that enlarge text
     (Android's font size setting), a lettering font that arrives late, or a long name can't push it off the edge. */
  var mctx = null;
  function fontIn() { try { return !!(document.fonts && document.fonts.check('400 100px "Dela Gothic One"')); } catch (e) { return false; } }
  /* a text's width in em in the lettering font; before the font has arrived, a close estimate */
  function emW(t) {
    if (fontIn()) {
      try { if (!mctx) mctx = document.createElement("canvas").getContext("2d"); mctx.font = '400 100px "Dela Gothic One"'; return mctx.measureText(t).width / 100; } catch (e) {}
    }
    return Array.from(t).reduce(function (a, ch) { return a + (/\s/.test(ch) ? 0.3 : /[iIjl.,'’!]/.test(ch) ? 0.36 : /[mwMW]/.test(ch) ? 0.98 : /[A-Z]/.test(ch) ? 0.8 : 0.67); }, 0);
  }
  /* long names go onto two or three lines, split between words so the longest line is as short as it can be */
  var ONE_LINE = 7.8;
  function lineSplit(name) {
    /* break between words, or after a hyphen (Mont-Saint-Michel) */
    var w = [];
    name.trim().split(/\s+/).forEach(function (x) { x.split(/(?<=-)(?=.)/).forEach(function (p) { w.push(p); }); });
    function join(a) { return a.reduce(function (s2, t, i) { return s2 + (i && !/-$/.test(a[i - 1]) ? " " : "") + t; }, ""); }
    if (w.length < 2 || emW(join(w)) <= ONE_LINE) return [join(w)];
    /** @type {{ m: number; [k: string]: any } | null} */ var best = null;
    function consider(ls) {
      ls = ls.map(join); var ws = ls.map(emW), m = Math.max.apply(null, ws), lo = Math.min.apply(null, ws);
      if (!best || m < best.m - 0.05 || (m < best.m + 0.05 && lo > best.lo)) best = { ls: ls, m: m, lo: lo };   /* ties: the more even split */
    }
    for (var i = 1; i < w.length; i++) consider([w.slice(0, i), w.slice(i)]);
    if (best.m > ONE_LINE && w.length > 2) {
      var two = best; best = null;
      for (var a = 1; a < w.length - 1; a++) for (var b = a + 1; b < w.length; b++) consider([w.slice(0, a), w.slice(a, b), w.slice(b)]);
      if (!best || best.m > two.m - 1.2) best = two;   /* a third line only when it helps a lot */
    }
    return best.ls;
  }
  var titleN = 0;
  function titleSvg(name, key) {
    var trio = TRIO[key] || TRIO.sunset, L = lineSplit(name), letters = name.replace(/\s+/g, "").length, n = 0, uid = "pt" + (++titleN);
    var widths = L.map(function (l) { return emW(l) * 100; }), VW = Math.ceil(Math.max.apply(null, widths)) + 4, H = 116 + (L.length - 1) * 104;
    var defs = "", body = "";
    L.forEach(function (line, li) {
      var runs = [], cur = null;
      Array.from(line).forEach(function (ch) {
        if (/\s/.test(ch)) { if (cur) cur.t += ch; return; }
        var g = Math.min(2, Math.floor(n++ * 3 / Math.max(1, letters)));
        if (!cur || cur.g !== g) runs.push(cur = { g: g, t: "" });
        cur.t += ch;
      });
      var base = 88 + li * 104, x = 2, k = widths[li] / Math.max(1, runs.reduce(function (a, r) { return a + emW(r.t) * 100; }, 0));
      body += '<text x="2" y="' + base + '" textLength="' + widths[li].toFixed(1) + '" lengthAdjust="spacingAndGlyphs">' + runs.map(function (r, ri) {
        var id = uid + "-" + li + "-" + ri, rw = Math.max(20, emW(r.t) * 100 * k);
        defs += '<pattern id="' + id + '" patternUnits="userSpaceOnUse" x="' + x.toFixed(1) + '" y="' + (base - 90) + '" width="' + rw.toFixed(1) + '" height="120">' +
          '<image href="' + SCENE_URI[trio[r.g]] + '" width="' + rw.toFixed(1) + '" height="120" preserveAspectRatio="xMidYMid slice"/></pattern>';
        x += rw;
        return '<tspan fill="url(#' + id + ')">' + esc(r.t) + "</tspan>";
      }).join("") + "</text>";
    });
    return '<svg class="pt" viewBox="0 0 ' + VW + " " + H + '" style="--vw:' + VW + '" aria-hidden="true" focusable="false"><defs>' + defs + "</defs>" + body + "</svg>";
  }
  var NATURE = /\b(park|garden|gardens|hike|trail|gorge|lake|mountain|valley|forest|zoo|farm|botanic|nature|waterfall|cave)\b/i, SEA = /\b(beach|bay|cove|boat|island|lagoon|sea|marina|harbou?r)\b/i;
  function sceneFor(day) {
    var names = (day.slots || []).filter(function (x) { return x.item && !W.isFood(x.slot); }).map(function (x) { return x.item; });
    if (names.some(function (it) { return (W.isBeach && W.isBeach(it)) || SEA.test(it.n); })) return "sea";
    if (names.some(function (it) { return NATURE.test(it.n); })) return "meadow";
    var h = 0, s = day.city; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return ["sunset", "night", "crystal"][h % 3];
  }
  W.tripTop = function (P) {
    var S = W.S, story = S.tview === "story", route = P.stops.map(function (s) { return s.name; });
    return '<div class="ttop"><button type="button" class="btn quiet sm" data-story="0">' + IC.chevL + "Back to the day</button>" +
      '<div><b>Storybook</b><span class="small muted">' + esc(P.N + " days · " + (route.length > 3 ? route.slice(0, 2).join(" → ") + " → … → " + route[route.length - 1] : route.join(" → "))) + "</span></div></div>";
  };
  W.storyHtml = function (P) {
    var S = W.S, J = S.journal || {}, tn = W.todayN(P);
    return '<div class="story-wrap"><div class="story" id="story" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Trip storybook">' + P.days.map(function (day) {
      var T = day.slots && day.slots.length ? W.dayTimes(day, P) : null, list = entries(day, T), je = J[W.restKey(day)] || {}, jp = je.photos || [];
      var acts = list.filter(function (e) { return e.k === "stop" && !e.food; });
      /* the day's photo: one of your own once you're there, otherwise the main thing you'll see */
      var hero = "", heroKey = "";
      if (jp.length) hero = '<img class="pic" src="' + esc(W.offline.src("/_blob/" + encodeURIComponent(jp[0].id))) + '" alt="Your photo from day ' + day.n + '" loading="lazy">';
      else [
        function (e) { return !e.food && W.photoFor(e.x.item, false, day.country, day.city); },   /* a sight's photo */
        function () { return true; }   /* or a restaurant's own picture (no photo at all: no picture at the top) */
      ].some(function (ok) {
        return list.some(function (e) {
          var p = e.k === "stop" && ok(e) && W.picture(e.x.item, e.food, day.country, day.city, { credit: true });
          if (p) { hero = p; heroKey = e.x.key; }
          return !!p;
        });
      });
      var sum = acts.slice(0, 3).map(function (e) { return e.x.item.n; });
      var E = T && W.dayEnergy ? W.dayEnergy(day, P, T) : null;
      return '<article class="sp" data-n="' + day.n + '" role="group" aria-roledescription="page" aria-label="Day ' + day.n + ", " + esc(day.city) + '">' +
        (hero ? '<div class="sp-hero">' + hero + (heroKey ? '<button type="button" class="sp-hero-b" data-goday="' + day.n + '" data-goopen="' + esc(heroKey) + '" aria-label="About this stop"></button>' : "") + "</div>" : "") +
        '<header class="sp-h"><span class="sp-k">' + esc(["Day " + day.n + (day.n === tn ? " · Today" : ""), fmt(W.dateOf(day.n), { weekday: "long", month: "long", day: "numeric" })].filter(Boolean).join(" · ")) + "</span>" +
        '<h2 class="painted" data-t="' + esc(day.city) + '" data-k="' + sceneFor(day) + '" data-f="' + (fontIn() ? 1 : 0) + '" aria-label="' + esc(day.city) + '">' + titleSvg(day.city, sceneFor(day)) + "</h2>" +
        (day.moveFrom ? '<p class="sp-sum">On the move from ' + esc(day.moveFrom) + "</p>" : sum.length ? '<p class="sp-sum">' + esc(sum.join(", ")) + "</p>" : "") +
        (E ? '<span class="energy lv' + E.level + '"><span class="bars" aria-hidden="true">' + [1, 2, 3, 4].map(function (i) { return "<i" + (i <= E.level ? ' class="on"' : "") + "></i>"; }).join("") + "</span>" + esc(E.label) + " day</span>" : "") + "</header>" +
        (T ? '<ol class="sp-stops">' + list.filter(function (e) { return e.k !== "back"; }).map(function (e) {
          if (e.k === "stop") {
            var it = e.x.item, ph = W.picture(it, e.food, day.country, day.city), open = '<li><button type="button" class="sp-row' + (ph ? "" : " bare") + '" data-goday="' + day.n + '" data-goopen="' + esc(e.x.key) + '"><span class="t">' + W.clock(e.start) + "</span>";
            /* no picture (most places to eat): one line that starts where the pictures start, like the rest breaks */
            if (!ph) return open + '<span><span class="ml">' + esc(slotName(e)) + "</span><b>" + esc(it.n) + "</b></span></button></li>";
            return open + '<span class="thumb">' + ph + "</span><span><b>" + esc(it.n) + '</b><span class="small muted">' + esc(slotName(e)) + "</span></span></button></li>";
          }
          var t = e.k === "nap" ? "Nap or rest" : e.k === "rest" ? "Rest time" : day.moveFrom + " → " + day.city;
          return '<li class="sp-quiet"><span class="t">' + W.clock(e.start) + "</span><span>" + esc(t) + "</span></li>";
        }).join("") + "</ol>" : '<p class="loading">Gathering ideas for ' + esc(day.city) + "…</p>") +
        (jp.length > 1 || (je.note || "").trim() ? '<div class="sp-j">' + (jp.length > 1 ? '<div class="jgrid rc">' + jp.slice(1, 7).map(function (p) { return '<img src="' + esc(W.offline.src("/_blob/" + encodeURIComponent(p.id))) + '" alt="Photo from day ' + day.n + '" loading="lazy">'; }).join("") + "</div>" : "") +
          ((je.note || "").trim() ? '<blockquote class="jnote">' + esc(je.note.trim()) + "</blockquote>" : "") + "</div>" : "") +
        '<footer class="sp-f"><button type="button" class="icon-btn" data-spg="-1" aria-label="Previous day"' + (day.n === 1 ? " disabled" : "") + ">" + IC.chevL + '</button><span class="small muted">' + day.n + " / " + P.N + '</span><button type="button" class="icon-btn" data-spg="1" aria-label="Next day"' + (day.n === P.N ? " disabled" : "") + ">" + IC.chevR + "</button></footer></article>";
    }).join("") + "</div></div>";
  };
  /* keep the storybook on the day you're looking at, and its height on that page */
  var sT = null;
  function pageW(sc) { var p = sc.querySelector(".sp"); return p ? p.getBoundingClientRect().width + parseFloat(getComputedStyle(sc).columnGap || "16") : sc.clientWidth; }
  function fit(sc) {
    var w = pageW(sc), i = Math.round(sc.scrollLeft / w), per = window.innerWidth > 920 ? 2 : 1, ps = sc.querySelectorAll(".sp"), hgt = 0;
    for (var j = i; j < Math.min(ps.length, i + per); j++) hgt = Math.max(hgt, ps[j].offsetHeight);
    if (hgt) sc.style.height = hgt + "px";
    return i;
  }
  /* names drawn before the lettering font arrived are redrawn with its real widths once it has */
  W.storyFit = function () {
    if (!fontIn()) return;
    document.querySelectorAll('.story .painted[data-f="0"]').forEach(function (h) { h.innerHTML = titleSvg(h.dataset.t, h.dataset.k); h.dataset.f = "1"; });
  };
  /* the lettering font can arrive after the page draws (phones show a narrower stand-in first): fit again when it does */
  var fontHooked = false;
  function refit() { var sc = $("story"); if (sc) { W.storyFit(); fit(sc); } }
  W.storyMount = function () {
    var sc = $("story"); if (!sc) return;
    W.storyFit();
    if (document.fonts) {
      if (!fontHooked) { fontHooked = true; try { document.fonts.addEventListener("loadingdone", refit); } catch (e) {} }
      try { document.fonts.load('400 48px "Dela Gothic One"').then(refit, function () {}); } catch (e) {}
      if (document.fonts.ready) document.fonts.ready.then(refit);
    }
    var w = pageW(sc); sc.scrollLeft = (W.S.day - 1) * w; fit(sc);
    sc.addEventListener("scroll", function () {
      clearTimeout(sT); sT = setTimeout(function () { var i = fit(sc); if (W.S.day !== i + 1) { W.S.day = i + 1; W.save(); } }, 120);
    }, { passive: true });
    sc.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); page(e.key === "ArrowRight" ? 1 : -1); } });
    /* photos arriving change a page's height */
    sc.querySelectorAll("img").forEach(function (im) { if (!im.complete) im.addEventListener("load", function () { fit(sc); }, { once: true }); });
  };
  function page(dir) {
    var sc = $("story"); if (!sc) return;
    sc.scrollBy({ left: dir * pageW(sc), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  /* Travel mode on opens the Today screen; off goes back to My trip */
  W.setAppMode = function (m) {
    setMode(m); goN = null;
    var to = m === "travel" ? "go" : W.view() === "go" ? "trip" : W.view();
    if (to !== W.view()) W.fxFlip("page", to === "go" ? -1 : 1, function () { W.setView(to); W.render(); window.scrollTo(0, 0); });
    else W.render();
  };
  /* ======================= clicks (before the views' own handlers) ======================= */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    function stop() { e.preventDefault(); e.stopPropagation(); }
    if (d.appmode) { stop(); W.setAppMode(d.appmode); return; }
    if (d.goprev != null && d.goprev !== "") { stop(); var n = +d.goprev; goN = n === W.todayN(W.P) ? null : n; W.fxFlip("day", n > W.S.day ? 1 : -1, function () { W.render(); window.scrollTo(0, 0); }); return; }
    if (d.gotoday) { stop(); goN = null; W.render(); window.scrollTo(0, 0); return; }
    if (d.tview) { stop(); if (W.S.tview === d.tview) return; W.S.tview = /** @type {TripState["tview"]} */ (d.tview); W.save(); W.render(); return; }
    if (d.vsw) {
      stop(); var to = d.vsw, S = W.S, wasStory = S.tview === "story", toStory = to === "story";
      S.glanceOpen = to === "all"; S.tview = toStory ? "story" : to === "map" ? "map" : "days"; W.save();
      if (wasStory !== toStory) W.fxFlip("page", toStory ? 1 : -1, function () { W.render(); window.scrollTo(0, 0); }); else W.render();
      return;
    }
    if (d.story != null) { stop(); var on = d.story === "1"; W.S.glanceOpen = false; if ((W.S.tview === "story") === on) return; W.S.tview = on ? "story" : "days"; W.fxFlip("page", on ? 1 : -1, function () { W.render(); }); return; }
    if (d.spg) { stop(); page(+d.spg); return; }
    /* a stop on a storybook page opens its panel right there: closing it leaves you in the storybook */
    if (d.goday && b.closest(".story")) { stop(); e.stopImmediatePropagation(); if (W.S.day !== +d.goday) { W.S.day = +d.goday; W.save(); } if (d.goopen) W.openStop(d.goopen); return; }
  }, true);

  /* the "next step" during the trip when Travel mode is off: suggest turning it on */
  W.travelNudge = function (P) {
    var tn = W.todayN(P);
    return tn && W.modeOf(P) === "plan" ? { key: "travel|" + W.isoDay(W.now()), k: "Day " + tn, text: "You're on your trip: turn on Travel mode", sub: "one screen for now, next and when to leave", go: { appmode: "travel" } } : null;
  };
})();
