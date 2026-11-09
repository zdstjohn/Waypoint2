/* Waypoint times: a clock for each day (when each stop starts and ends, the nap, the journey on travel days),
   opening-hours checks, local meal times, dates and time zones. */
(function () {
  "use strict";
  var W = window.W;
  function hm(h, m) { return h * 60 + (m || 0); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* when locals sit down for lunch and dinner; kitchens rarely open much earlier */
  var MEALS = {
    Spain: [hm(14), hm(21)], Portugal: [hm(13), hm(20)], Italy: [hm(13), hm(20)], Greece: [hm(14), hm(21)], Cyprus: [hm(13), hm(20, 30)],
    France: [hm(12, 30), hm(19, 30)], Croatia: [hm(13), hm(20)], Malta: [hm(12, 30), hm(20)], Montenegro: [hm(13), hm(20)], Turkey: [hm(12, 30), hm(20)],
    Argentina: [hm(13, 30), hm(21, 30)], Uruguay: [hm(13), hm(21)], Chile: [hm(13, 30), hm(21)], Mexico: [hm(14, 30), hm(20, 30)], Peru: [hm(13), hm(20)],
    Colombia: [hm(12, 30), hm(19, 30)], Brazil: [hm(12, 30), hm(20)], Lebanon: [hm(13, 30), hm(20, 30)], Jordan: [hm(14), hm(20, 30)]
  };
  function meals(country) { return MEALS[country] || [hm(12, 30), hm(19)]; }
  W.mealsFor = meals;
  W.lateDinner = function (country) { return meals(country)[1] >= hm(20); };
  /* children eat early */
  W.kidDinner = function () { return W.party().kid ? hm(18, 30) : null; };

  /* ---------- dates ---------- */
  W.dateOf = function (n) {
    if (!W.S.start) return null;
    var d = new Date(W.S.start + "T12:00:00"); if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + n - 1); return d;
  };
  W.weekday = function (n) { var d = W.dateOf(n); return d ? d.getDay() : null; };
  W.isoDay = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  W.dayOfDate = function (iso) {
    /* which trip day a date (YYYY-MM-DD...) falls on, or null */
    if (!W.S.start || !iso) return null;
    var a = new Date(W.S.start + "T12:00:00"), b = new Date(String(iso).slice(0, 10) + "T12:00:00");
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((b.getTime() - a.getTime()) / 864e5) + 1;
  };
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  /* 9:30 AM or 09:30, as the device writes times */
  W.clock = function (m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    try { return new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
    catch (e) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  };
  W.iso = function (d, m) { return W.isoDay(d) + "T" + pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60) + ":00"; };

  /* ---------- time zones (for calendar events) ---------- */
  var TZ = {
    Italy: "Europe/Rome", Greece: "Europe/Athens", Spain: "Europe/Madrid", Portugal: "Europe/Lisbon", France: "Europe/Paris", Germany: "Europe/Berlin",
    "United Kingdom": "Europe/London", England: "Europe/London", Scotland: "Europe/London", Ireland: "Europe/Dublin", Netherlands: "Europe/Amsterdam",
    Belgium: "Europe/Brussels", Switzerland: "Europe/Zurich", Austria: "Europe/Vienna", Croatia: "Europe/Zagreb", Czechia: "Europe/Prague",
    "Czech Republic": "Europe/Prague", Hungary: "Europe/Budapest", Poland: "Europe/Warsaw", Denmark: "Europe/Copenhagen", Sweden: "Europe/Stockholm",
    Norway: "Europe/Oslo", Finland: "Europe/Helsinki", Iceland: "Atlantic/Reykjavik", Turkey: "Europe/Istanbul", Cyprus: "Asia/Nicosia",
    Malta: "Europe/Malta", Slovenia: "Europe/Ljubljana", Montenegro: "Europe/Podgorica", Albania: "Europe/Tirane", Japan: "Asia/Tokyo",
    "South Korea": "Asia/Seoul", Thailand: "Asia/Bangkok", Vietnam: "Asia/Ho_Chi_Minh", Singapore: "Asia/Singapore", Morocco: "Africa/Casablanca",
    Egypt: "Africa/Cairo", "South Africa": "Africa/Johannesburg", Afghanistan: "Asia/Kabul", India: "Asia/Kolkata", China: "Asia/Shanghai",
    Peru: "America/Lima", Colombia: "America/Bogota", Argentina: "America/Argentina/Buenos_Aires", Chile: "America/Santiago",
    "Costa Rica": "America/Costa_Rica", "New Zealand": "Pacific/Auckland", Israel: "Asia/Jerusalem", Jordan: "Asia/Amman",
    "United Arab Emirates": "Asia/Dubai", Lebanon: "Asia/Beirut", Uruguay: "America/Montevideo"
  };
  W.tzFor = function (country) { var z = TZ[country] || W.C.tz[country]; if (!z && W.loadTz) W.loadTz(country); return z || null; };

  /* ---------- jet lag ---------- */
  /* minutes a time zone is ahead of UTC on a date */
  function offsetMin(tz, date) {
    try {
      var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
      return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000);
    } catch (e) { return null; }
  }
  W.homeTz = function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } };
  /* how many hours the first stop is ahead of home, and how many easy days that calls for */
  W.jetlag = function (P) {
    var s = P.stops && P.stops[0]; if (!s) return { days: 0 };
    var dest = W.tzFor(s.country), home = W.homeTz(), when = W.dateOf(1) || new Date(), gap = null;
    if (dest && home) { var a = offsetMin(dest, when), b = offsetMin(home, when); if (a != null && b != null) gap = Math.round((a - b) / 30) / 2; }
    if (gap == null && P.ap) { var km = W.km(P.ap, W.stopAt(s)); gap = km > 7000 ? 8 : km > 4000 ? 5 : 0; }
    var g = Math.abs(gap || 0);
    return { gap: gap || 0, days: g >= 7 ? 2 : g >= 4 ? 1 : 0, east: (gap || 0) > 0, dest: dest, home: home };
  };

  /* ---------- how tiring a day is ---------- */
  W.dayEnergy = function (day, P, T) {
    if (!T || !day.slots) return null;
    /* an hour at a calm place costs 1; a strenuous one (a gorge, a hike) costs 2; walking between stops and the journey in
       count too; a hot afternoon outdoors, and small children at anything but a beach or a park, make it all heavier */
    var home = W.homebase(day.country, day.city), prev = /** @type {LatLng} */ (home), walk = 0, act = 0, effort = 0, big = 0, mo = (W.dateOf(day.n) || new Date()).getMonth();
    var hot = mo >= 5 && mo <= 8 && /Greece|Italy|Spain|Portugal|Turkey|Croatia|Afghanistan|Egypt|Morocco/.test(day.country);
    (T.order || []).forEach(function (sl) {
      var x = day.slots.filter(function (y) { return y.slot === sl; })[0], R = T.rows[sl], it = x && x.item;
      if (!it || !R || R.skip) return;
      var lg = W.leg(prev, it); if (lg && lg.mode === "walk") walk += lg.d || 0;
      if (!W.isFood(sl)) {
        var c = W.classify ? W.classify(it, false) : { intensity: 1, indoor: false, kind: "" }, mins = R.end - R.start, w = 0.7 + c.intensity * 0.3;
        if (hot && !c.indoor && sl === "pm" && c.kind !== "beach" && c.kind !== "waterpark" && c.kind !== "lake") w += 0.3;
        if (P.p.toddler && c.intensity >= 2) w += 0.2;
        act += mins; effort += mins / 60 * w; walk += 0.8;
        if (c.intensity >= 3 || mins >= 240) big++;
      }
      if (it.lat != null) prev = it;
    });
    var bk = W.leg(prev, home); if (bk && bk.mode === "walk") walk += bk.d || 0;
    var travel = T.travel ? T.travel.end - T.travel.start : 0;
    /* grandparents along: every kilometre on foot counts for more */
    var score = effort + walk * (P.p.senior ? 0.8 : 0.5) + travel / 60 * 1.2 + (day.fullDay ? 1 : 0) + (big > 1 ? 1.5 : 0);
    var level = score < 3.5 ? 1 : score < 6 ? 2 : score < 8.5 ? 3 : 4;
    return { walk: Math.round(walk * 10) / 10, act: act, travel: travel, score: score, level: level, big: big, label: ["", "Easy", "Moderate", "Full", "Heavy"][level] };
  };
  W.restKey = function (d) { return d.country + "|" + d.city + "|" + d.dayInCity; };
  W.isRest = function (d) { return !!(W.S.rest || {})[W.restKey(d)]; };

  /* ---------- durations ---------- */
  /* "1½–2 h", "45 min–1 h", "Full day" (from W.stayText) -> minutes to plan */
  function textMin(t) {
    t = String(t || "");
    if (/^full day/i.test(t)) return 420;
    if (/^half day/i.test(t)) return 210;
    var parts = t.replace(/½/g, ".5").split(/[–-]/), unitLast = /min/.test(parts[parts.length - 1]) ? 1 : 60, vals = [];
    parts.forEach(function (p) {
      var v = parseFloat(p.replace(/^\s*\./, "0.")); if (!isFinite(v)) return;
      vals.push(v * (/min/.test(p) ? 1 : /h/.test(p) ? 60 : unitLast));
    });
    if (!vals.length) return null;
    return vals.length > 1 ? (vals[0] + vals[vals.length - 1]) / 2 : vals[0];
  }
  /* how long to plan for a stop: what the data says, else what that kind of place takes; shorter with small children
     (a museum with a toddler is an hour, a beach is longer) */
  W.planMin = function (it, food, slot) {
    var c = W.classify ? W.classify(it, food) : null, p = W.party();
    var m = textMin(W.stayText(it, food, slot)) || (c ? c.min : food ? 60 : 90);
    if (!food && c && p.toddler && !it.dur) m = c.indoor ? Math.min(m, 75) : c.kind === "beach" || c.kind === "park" || c.kind === "themepark" || c.kind === "waterpark" ? m : Math.min(m, 120);
    return slot === "breakfast" ? Math.min(m, 60) : slot === "lunch" ? Math.min(m, 105) : m;
  };
  W.parseDur = function (raw) { return textMin(W.durText(raw)); };

  /* rough journey time between two places when no timetable is known yet */
  function guessLeg(d) {
    if (d == null) return 150;
    if (d < 160) return Math.max(40, Math.round(d / 70 * 60));
    if (d < 480) return Math.round((d / 110 + 0.5) * 60);
    return Math.round(W.flightHrs(d) * 60 + 150);   /* a flight, with getting to and through the airport */
  }
  W.guessLeg = guessLeg;
  function at(s) { return s.c && s.c.lat != null ? s.c : W.homebase(s.country, s.name); }
  W.stopAt = at;
  /* the journey into a stop on its first day: the best option Claude found, or a rough guess */
  W.legSig = function (o) { return W.norm(o.mode + " " + (o.op || "") + " " + (o.from || "")); };
  W.legFor = function (P, si) {
    if (!si) return null;
    var a = P.stops[si - 1], b = P.stops[si], key = W.legKey(a, b), lg = W.C.legs[key];
    /* the way you chose to go (Claude's best unless you picked another) */
    var pick = (W.S.legPick || {})[key], opts = lg && lg.opts || [];
    var i = opts.findIndex(function (o) { return W.legSig(o) === pick; });
    if (i < 0) i = W.pickLeg ? W.pickLeg(opts, P.p || W.party()) : 0;   /* no choice made: the best way for this group */
    var o = opts[i], km = W.km(at(a), at(b));
    var mins = o && W.parseDur(o.dur);
    /* Rome2Rio's measured journey for the same way of going beats the estimate */
    var rr = o && lg && lg.r2r ? W.r2rFor(lg.r2r.routes, o.mode) : null;
    if (rr) mins = rr.min;
    return { a: a, b: b, key: key, opts: lg ? lg.opts : null, best: o || null, pick: i, min: mins || guessLeg(km), km: km, guessed: !mins, r2r: rr || null };
  };
  /* which Rome2Rio route is this way of going ("Fly to Seville Airport" is a flight; "Train, ferry" is mainly a train) */
  function r2rMode(name) {
    var n = String(name || "").toLowerCase().split(",")[0];
    return /\bfly\b|flight|plane|airport/.test(n) ? "flight" : /ferry|boat|hydrofoil|catamaran/.test(n) ? "ferry" : /train|rail|metro|tram/.test(n) ? "train" : /bus|coach|shuttle/.test(n) ? "bus" : /drive|car|taxi/.test(n) ? "car" : "";
  }
  W.r2rMode = r2rMode;
  W.r2rFor = function (routes, mode) {
    var m = String(mode || "").toLowerCase(), want = /flight|plane|fly/.test(m) ? "flight" : /ferry|boat/.test(m) ? "ferry" : /train|rail/.test(m) ? "train" : /bus|coach/.test(m) ? "bus" : /car|drive/.test(m) ? "car" : "";
    return want ? (routes || []).filter(function (r) { return r2rMode(r.name) === want; })[0] || null : null;
  };

  function up15(m) { return Math.ceil(m / 15) * 15; }
  var DFLT = { breakfast: 40, am: 150, lunch: 70, pm: 150, dinner: 80, eve: 60 };

  /* the day on a clock. Returns { rows: {slot: {start, end, warn:[], info:[]}}, nap, travel, back } or null */
  W.dayTimes = function (day, P) {
    if (!day || !day.slots || !day.slots.length) return null;
    var p = P.p, home = W.homebase(day.country, day.city), M = meals(day.country), wd = W.weekday(day.n);
    var kd = W.kidDinner(), out = { rows: {}, wd: wd, notes: [] }, hol = W.dayHolidays ? W.dayHolidays(day) : [];
    out.hol = hol;
    var t = p.kid ? hm(8) : hm(8, 30), prev = home;
    /* travel days: the journey comes first; you drop your bags at the new place and set off from there */
    /* (with a booked ticket that has a time: you leave in time for it, a flight's check-in included, and the day picks up
       from its arrival; a late departure leaves the morning free in the town you're leaving) */
    if (day.moveFrom && day.stop > 0) {
      var L = W.legFor(P, day.stop), s0 = hm(9, 30), tk = W.legTicket ? W.legTicket(P, day.stop) : null;
      if (tk) {
        var lead = { flight: 150, ferry: 75, train: 45, bus: 40 }[tk.kind] || 45, after = { flight: 60, ferry: 40, train: 30, bus: 30 }[tk.kind] || 40;
        var arr = tk.arr != null ? tk.arr : tk.dep + L.min;
        out.travel = { start: Math.max(hm(5), tk.dep - lead), end: up15(arr + after), leg: L, ticket: tk, dep: tk.dep, arr: arr };
        if (out.travel.start - hm(9) >= 90) out.before = { start: hm(9), end: out.travel.start - 15, city: day.moveFrom };
      } else out.travel = { start: s0, end: up15(s0 + L.min + 40), leg: L };
      t = out.travel.end + 20;
    }
    function minStart(slot) {
      if (slot === "breakfast") return p.kid ? hm(8) : hm(8, 30);
      if (slot === "lunch") return p.kid ? Math.max(hm(12), M[0] - 60) : M[0];
      if (slot === "dinner") return day.jet ? Math.min(kd || M[1], hm(18, 30)) : kd || M[1];
      return 0;
    }
    /* arriving around lunchtime: lunch first, then the first thing to see */
    var order = day.slots.slice();
    if (out.travel && t >= Math.min(minStart("lunch") - 30, hm(11, 30))) {   /* landing late morning or later: eat first */
      var li = order.findIndex(function (x) { return x.slot === "lunch"; }), ai = order.findIndex(function (x) { return x.slot === "am"; });
      if (li > ai && ai > -1) { var L2 = order.splice(li, 1)[0]; order.splice(ai, 0, L2); out.moved = true; }
    }
    out.order = order.map(function (x) { return x.slot; });
    var EVE_CAP = p.toddler ? hm(20) : p.kid ? hm(20, 45) : hm(22, 30);
    order.forEach(function (x) {
      doRow(x);
      /* toddlers: after lunch, a nap or rest back at your lodging (whatever lunch was) */
      if (x.slot === "lunch" && p.toddler && !(out.rows.lunch && out.rows.lunch.skip)) {
        if (day.trip) {
          /* out for the day: a nap in the stroller or the car, not back at the hotel */
          var na = up15(t + 10); if (na <= hm(16)) { out.nap = { start: na, end: na + 60, away: true }; t = out.nap.end; }
        } else {
          var bk = W.leg(prev, home), ns = up15(t + (bk ? bk.min : 15));
          if (ns <= hm(16)) { out.nap = { start: ns, end: ns + 90 }; t = out.nap.end; prev = home; }   /* too late for a nap: an early night instead */
        }
      }
    });
    var lastFree = null;   /* free time is elastic: it ends when the next thing needs to start, never pushes it back */
    function doRow(x) {
      var it = x.item, food = W.isFood(x.slot), row = { warn: [], info: [] };
      out.rows[x.slot] = row;
      if (out.travel && x.slot === "am") row.label = "After you arrive";
      if (x.slot === "breakfast" && out.travel && out.travel.end > hm(10, 30)) {
        row.skip = true; row.start = out.before ? (p.kid ? hm(8) : hm(8, 30)) : out.travel.start - 50; row.end = out.before ? row.start + 40 : out.travel.start - 15;
        row.info.push("Travel morning: have breakfast before you set off");
        return;
      }
      /* the latest a slot can still start; a long journey that lands after it leaves that meal or outing out */
      var capF = { am: hm(16), lunch: hm(15), pm: hm(17, 30), dinner: p.kid ? hm(20, 30) : hm(21, 45), eve: EVE_CAP }[x.slot];
      /* a ticket that leaves after lunchtime: lunch is in the town you're leaving, before you set off */
      if (x.slot === "lunch" && out.travel && out.travel.dep != null && out.travel.start >= hm(12, 45)) {
        row.skip = true; row.start = Math.max(hm(12), out.travel.start - 75); row.end = out.travel.start - 15; row.info.push("Lunch in " + day.moveFrom + " before you set off");
        return;
      }
      /* arriving after about two: lunch is on the way (a sit-down lunch at three is not lunch) */
      if (x.slot === "lunch" && out.travel && out.travel.end >= hm(14)) {
        row.skip = true; row.start = out.travel.start + 180; row.info.push("Travel day: lunch on the way");
        return;
      }
      /* landing late in the evening: eat on the way or after you land, nothing is planned */
      if (x.slot === "dinner" && out.travel && out.travel.end + 30 > capF) {
        row.skip = true; row.start = Math.min(out.travel.end, hm(21)); row.info.push("Travel day: dinner on the way or after you land");
        return;
      }
      if (!it) {
        row.free = true; row.start = up15(Math.max(t, minStart(x.slot)));
        if (capF && row.start > capF) { row.skip = true; return; }   /* no free evening at 10 pm */
        /* free time ends in time for the next meal (a free afternoon never pushes the children's dinner back) */
        var nextMeal = x.slot === "am" ? minStart("lunch") : x.slot === "pm" ? minStart("dinner") : null;
        row.end = nextMeal && nextMeal - 15 > row.start ? Math.min(row.start + DFLT[x.slot], nextMeal - 15) : row.start + DFLT[x.slot]; t = row.end; lastFree = row; return;
      }
      var lg = W.leg(prev, it), way = lg ? lg.min : 10, start = up15(Math.max(t + way, minStart(x.slot))), h = it.hours;
      /* after free time, the next thing starts when it should (at least 45 minutes of free time first); the free row shrinks to fit */
      if (lastFree) { start = up15(Math.max(Math.min(t, lastFree.start + 45) + way, minStart(x.slot))); lastFree.end = Math.max(lastFree.start + 30, start - way); lastFree = null; }
      var dur = W.planMin(it, food, x.slot);
      /* a long journey or a nap can leave no room: say so rather than send you out at midnight */
      var cap = capF;
      if (x.slot === "eve" && p.kid) dur = Math.min(dur, 75);   /* a short evening out with children */
      if (cap && start > cap) {
        row.skip = true; row.late = true; row.start = start;
        row.info.push(out.travel ? "No time for this today with the journey: swap it or save it for another day" : "No time left for this today: swap it or save it for another day");
        return;
      }
      if (h) {
        if (wd != null && h.closed.indexOf(wd) > -1) row.warn.push("Closed on " + WEEKDAYS[wd] + "s");
        else if (hol.length && W.holidayShut && W.holidayShut(it, day, hol)) row.warn.push("Closed for " + hol[0].n);
        if (h.o > start && h.o < 1440) {
          if (h.o - start <= 120) { start = up15(h.o); row.info.push("Opens " + W.clock(h.o)); }
          else row.warn.push("Not open until " + W.clock(h.o));
        }
      }
      /* a day trip fills the morning and carries on after lunch */
      /* (a place that says how long it takes, under four hours, is not a day out, whatever its slot says) */
      var ownMin = textMin(W.stayText(it, false, x.slot)), dayOut = it.s === "any" && !(ownMin && ownMin < 240);
      if (dayOut && x.slot === "am") { dur = Math.max(150, minStart("lunch") - start); row.info.push("Day trip: carries on after lunch"); }
      /* the next meal sets when to leave: with children, dinner doesn't wait for a long afternoon */
      /* (a half hour's slack on an ordinary day; on a jet-lag day dinner is early and nothing pushes it) */
      var meal = x.slot === "am" ? minStart("lunch") : x.slot === "pm" ? minStart("dinner") : null, slack = day.jet && x.slot === "pm" ? 0 : 30;
      if (meal && !dayOut) {
        /* the way to the meal itself: the next slot's place when it is known, else a quarter hour */
        /* (measured from where you'll set off for it: this place, or the last one with a pin if this one has none) */
        var nx = order.filter(function (y) { return y.slot === (x.slot === "am" ? "lunch" : "dinner"); })[0], nl = nx && nx.item ? W.leg(it.lat != null ? it : prev, nx.item) : null, way = nl ? Math.max(5, nl.min) : 15;
        /* (with children an afternoon can be as short as half an hour: a late arrival's quick look beats a late dinner) */
        if (start + dur > meal - way + slack && meal - way - start >= (day.jet || (p.kid && x.slot === "pm") ? 30 : 45)) {
          dur = meal - way - start; row.info.push("Leave by " + W.clock(start + dur) + " for " + (x.slot === "am" ? "lunch" : "dinner"));
        }
      }
      if (h && h.c < 1440 * 2 && !(h.o === 0 && h.c >= 1440)) {
        if (h.c <= start + 20) row.warn.push("Closes " + W.clock(h.c) + ", before you'd get there");
        else if (h.c < start + dur - 15) row.warn.push("Closes " + W.clock(h.c) + ": about " + W.fmtMin(Math.round((h.c - start) / 15) * 15) + " there");
      }
      if (x.slot === "dinner" && kd) {
        if (h && h.o > kd + 30) row.warn.push("Kitchen opens " + W.clock(h.o) + ": late for kids");
        else if (W.lateDinner(day.country)) row.info.push("Locals eat around " + W.clock(M[1]) + ". Going at opening means a calmer, kid-friendly table");
      }
      /* the group's food needs: what this place offers them, and allergies to mention */
      if (food && W.eatNeeds) {
        var en = W.eatNeeds(), ef = W.eatFit(it), ew = W.eatWhy(it);
        if (ef === "poor") row.warn.push("Hard for your food needs" + (ew ? ": " + ew : ""));
        else if (ew) row.info.push(ew);
        if (en && en.al.length) row.info.push("Tell the staff: " + en.al.map(function (k) { var a = W.EAT_AL.filter(function (y) { return y[0] === k; })[0]; return a ? a[1].replace(/ \(.*\)$/, "").toLowerCase() : k; }).join(", ") + " allergy");
      }
      if (!food && W.needsBooking(it)) row.info.push("Timed entry: book the " + W.clock(start) + " slot" + (p.toddler && x.slot === "pm" ? ", after the nap" : ""));
      row.start = start; row.end = start + Math.round(dur);
      t = row.end;
      if (it.lat != null) prev = it;
    }
    var back = W.leg(prev, home);
    out.back = Math.round((t + (back ? back.min : 0)) / 5) * 5;
    if (W.lateShift) W.lateShift(day, out);   /* running late today: the rest of the day moves back */
    return out;
  };

  /* is a place shut on this trip day, or a dinner that opens too late for children? (the planner avoids these) */
  W.badForDay = function (it, wd, slot, kd) {
    if (W.gone(it)) return true;   /* closed for good, or no such place */
    var h = it && it.hours; if (!h) return false;
    if (wd != null && h.closed.indexOf(wd) > -1) return true;
    if (W.shutBy(h, slot)) return true;
    return slot === "dinner" && kd != null && h.o > kd + 30 && h.o < 1440;
  };
  /* not open in that part of the day: shut by then, or not open until much later (a dinner-only place for breakfast) */
  var WIN = { breakfast: [hm(10, 30), hm(9)], am: [hm(12, 30), hm(11)], lunch: [hm(14, 30), hm(13)], pm: [hm(17), hm(15, 30)], dinner: [hm(21, 30), hm(20)], eve: [hm(22), hm(20, 30)] };
  W.shutBy = function (h, slot) {
    var w = WIN[slot]; if (!h || !w || (h.o === 0 && h.c >= 1440)) return false;
    return h.o > w[0] || h.c <= w[1];
  };
})();
