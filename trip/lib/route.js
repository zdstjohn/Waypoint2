/* Waypoint trip shape check: a sensible order of places, enough nights in each for this group, day trips instead of
   extra hotel moves, the best way between bases, travel days spread out, easy days after the flight, no long run of
   heavy days, and the open-jaw flight tip. Each thing to look at comes with a one-tap fix. Shown as the last step of Plan. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc;
  function at(s) { return W.stopAt(s); }
  function dist(order) { var t = 0; for (var i = 1; i < order.length; i++) t += W.km(at(order[i - 1]), at(order[i])) || 0; return t; }
  function permute(a, cb) {
    /* Heap's algorithm: every order of a (up to 7 places, 5040 orders) */
    var c = a.map(function () { return 0; }), x = a.slice(), i = 0; cb(x.slice());
    while (i < x.length) {
      if (c[i] < i) { var j = i % 2 ? c[i] : 0, t = x[j]; x[j] = x[i]; x[i] = t; cb(x.slice()); c[i]++; i = 0; }
      else { c[i] = 0; i++; }
    }
  }
  /* the shortest route that starts where you start */
  function bestOrder(stops) {
    if (stops.length < 3) return stops.slice();
    var first = stops[0], rest = stops.slice(1), best = null, bd = Infinity;
    if (rest.length <= 7) {
      permute(rest, function (p) { var o = [first].concat(p), d = dist(o); if (d < bd - 0.01) { bd = d; best = o; } });
      return best;
    }
    var out = [first], left = rest.slice();
    while (left.length) { var cur = out[out.length - 1]; left.sort(function (a, b) { return (W.km(at(cur), at(a)) || 0) - (W.km(at(cur), at(b)) || 0); }); out.push(left.shift()); }
    return out;
  }
  W.bestOrder = bestOrder;
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  /* everything worth a second look; each item: {ok, t (text), act: {label, data}} */
  W.routeCheck = function (P) {
    /** @type {any[] & { warn?: number }} */ var out = []; var st = P.stops, warn = 0, p = P.p; if (!st.length) return out;
    var minN = W.minNights ? W.minNights(p) : 1, ro = W.readOnly;
    /* moving too often for this group */
    var per = P.N / st.length, every = W.moveEvery ? W.moveEvery(p) : 2.2;
    if (st.length >= 3 && per < every) { warn++; out.push({ t: plural(st.length, "place") + " in " + P.N + " days means packing up about every " + (Math.round(per * 10) / 10) + " days" + (p.toddler ? ", a lot with small children" : p.senior ? ", a lot for the grandparents" : "") + ". Making one a day trip, or dropping it, gives everyone more breathing room." }); }
    /* a small town you chose beside a big one: a day trip rather than another hotel */
    st.forEach(function (s, i) {
      var jb = W.smallNextToBig ? W.smallNextToBig(st, i, p) : -1; if (jb < 0) return;
      warn++;
      out.push({ t: s.name + " is a short hop from " + st[jb].name + " (about " + W.fmtMin(Math.round(W.legMinutes(st[jb], s) / 15) * 15) + "). Seeing it as a day trip saves packing up" + (p.toddler ? " the cots and the car seats" : "") + " for " + plural(s.days, "night") + ".",
        act: ro ? null : { label: "Make " + s.name + " a day trip from " + st[jb].name, data: 'data-fold="' + esc(W.foldKey(s.country, s.name)) + '" data-foldto="' + esc(st[jb].name) + '" data-foldc="' + esc(s.country) + '"' } });
    });
    /* too few nights somewhere: a day trip from a neighbour, or a night from the longest stay */
    st.forEach(function (s, i) {
      if (s.days >= minN || st.length < 2 || (W.smallNextToBig && W.smallNextToBig(st, i, p) > -1)) return;
      var near = -1, nm = Infinity;
      [i - 1, i + 1].forEach(function (j) { var b = st[j]; if (!b || b.country !== s.country) return; var m = W.legMinutes(b, s); if (m <= W.dayTripMax(p) && m < nm) { nm = m; near = j; } });
      var longest = -1; st.forEach(function (o, k) { if (k !== i && o.days > minN && (longest < 0 || o.days > st[longest].days)) longest = k; });
      warn++;
      var who = p.toddler ? "with toddlers " : p.senior ? "with grandparents along " : "";
      if (near > -1) out.push({ t: "Only " + plural(s.days, "night") + " in " + s.name + ": " + who + plural(minN, "night") + " per place is the comfortable minimum. " + st[near].name + " is about " + W.fmtMin(Math.round(nm / 15) * 15) + " away, so " + s.name + " works as a day trip from there instead of another hotel.",
        act: ro ? null : { label: "Make " + s.name + " a day trip from " + st[near].name, data: 'data-fold="' + esc(W.foldKey(s.country, s.name)) + '" data-foldto="' + esc(st[near].name) + '" data-foldc="' + esc(s.country) + '"' } });
      else out.push({ t: "Only " + plural(s.days, "night") + " in " + s.name + ": " + who + plural(minN, "night") + " per place is the comfortable minimum.",
        act: ro || longest < 0 ? null : { label: "Add a night in " + s.name + " (one fewer in " + st[longest].name + ")", data: 'data-nights="' + esc(s.country) + '" data-nplus="' + esc(s.name) + '" data-nminus="' + esc(st[longest].name) + '"' } });
    });
    /* day trips the plan already has */
    (W.shapeNotes ? W.shapeNotes(P) : []).forEach(function (n) {
      if (!n.planned) { warn++; out.push({ t: "No day left in " + n.base.name + " for the trip to " + n.trip.name + ": its days are the arrival, packing or jet-lag days.", act: ro ? null : { label: "Stay in " + n.trip.name + " instead", data: 'data-unfold="' + esc(W.foldKey(n.trip.country, n.trip.name)) + '" data-foldc="' + esc(n.trip.country) + '"' } }); }
      else out.push({ ok: true, t: n.t, act: ro || n.trip.why !== "you" ? null : { label: "Stay there instead", data: 'data-unfold="' + esc(W.foldKey(n.trip.country, n.trip.name)) + '" data-foldc="' + esc(n.trip.country) + '"' } });
    });
    /* travel days bunched together */
    var mv = P.days.filter(function (d) { return d.moveFrom; }).map(function (d) { return d.n; });
    for (var i = 1; i < mv.length; i++) if (mv[i] - mv[i - 1] <= 2) { warn++; out.push({ t: "Travel days close together: Day " + mv[i - 1] + " and Day " + mv[i] + ". A longer stay in between makes the trip calmer." }); }
    /* a shorter order, country by country (the first place stays first) */
    var groups = [];
    st.forEach(function (s) { var g = groups[groups.length - 1]; if (!g || g.country !== s.country) groups.push(g = { country: s.country, stops: [] }); g.stops.push(s); });
    groups.forEach(function (g) {
      if (g.stops.length < 3) return;
      var cur = dist(g.stops), b = bestOrder(g.stops), bd = dist(b);
      if (cur - bd > 60 && bd < cur * 0.85) {
        warn++;
        var ci = W.S.countries.findIndex(function (c) { return c.name === g.country; });
        out.push({ t: "A shorter order" + (groups.length > 1 ? " in " + g.country : "") + " saves about " + Math.round((cur - bd) / 10) * 10 + " km of travel: " + b.map(function (s) { return s.name; }).join(" → ") + ".",
          act: ci > -1 && !W.readOnly ? { label: "Use this order", data: 'data-routeorder="' + ci + '" data-order="' + esc(JSON.stringify(b.map(function (s) { return s.name; }))) + '"' } : null });
      }
    });
    /* long journeys: a flight when one is on offer, otherwise a stop on the way */
    st.forEach(function (s, si) {
      if (!si) return;
      var L = W.legFor(P, si);
      if (!L || L.min < 300) return;
      warn++;
      var fl = -1; (L.opts || []).forEach(function (o, k) { var m = W.parseDur(o.dur); if (fl < 0 && k !== L.pick && /flight|plane|fly/.test(o.mode) && m && m + 150 < L.min) fl = k; });
      if (fl > -1) out.push({ t: "Long travel day: " + L.a.name + " → " + L.b.name + " is about " + W.fmtMin(Math.round(L.min / 30) * 30) + " by " + W.modeName(L.best.mode).toLowerCase() + ". The flight (" + (L.opts[fl].dur || "shorter") + ") saves most of the day" + (P.p.kid ? ", even with the airport" : "") + ".",
        act: ro ? null : { label: "Fly instead", data: 'data-legpick="' + fl + '" data-legkey="' + esc(L.key) + '"' } });
      else out.push({ t: "Long travel day: " + L.a.name + " → " + L.b.name + " is about " + W.fmtMin(Math.round(L.min / 30) * 30) + (P.p.kid ? ". With kids, a stop on the way or a flight is easier." : ". A stop on the way or a flight would help.") });
    });
    /* night ferries and airports with small children */
    st.forEach(function (s, si) {
      if (!si) return; var L = W.legFor(P, si), o = L && L.best; if (!o) return;
      if (P.p.kid && /night|overnight/.test((o.note || "") + " " + (o.freq || ""))) { warn++; out.push({ t: L.a.name + " → " + L.b.name + " is an overnight crossing: book a cabin, or take a daytime sailing." }); }
    });
    /* heavy days back to back */
    var lv = P.days.map(function (d) { var E = d.slots && d.slots.length ? W.dayEnergy(d, P, W.dayTimes(d, P)) : null; return E ? E.level : 0; });
    for (var k = 1; k < lv.length; k++) {
      var d2 = P.days[k];
      if (lv[k] >= 4 && lv[k - 1] >= 4 || (k > 1 && lv[k] >= 3 && lv[k - 1] >= 3 && lv[k - 2] >= 3 && lv[k] + lv[k - 1] + lv[k - 2] >= 10)) {
        warn++;
        var canRest = !d2.tripFirst && !d2.moveFrom && !d2.tripLast && !d2.rest;
        out.push({ t: (lv[k - 2] >= 3 && k > 1 && lv[k] < 4 ? "Days " + (k - 1) + " to " + (k + 1) + " are all full" : "Day " + k + " and Day " + (k + 1) + " are both heavy") + ". A rest day would help little legs.",
          act: canRest && !W.readOnly ? { label: "Make Day " + (k + 1) + " a rest day", data: 'data-rest="' + esc(W.restKey(d2)) + '"' } : null });
        k++;
      }
    }
    /* the day after a long journey */
    P.days.forEach(function (d, j) {
      var prev = P.days[j - 1]; if (!prev || !prev.moveFrom || d.moveFrom || d.tripLast || d.rest) return;
      var L = W.legFor(P, prev.stop); if (!L || L.min < 300 || lv[j] < 3) return;
      warn++; out.push({ t: "Day " + d.n + " follows a long travel day and is full.", act: W.readOnly ? null : { label: "Make it a rest day", data: 'data-rest="' + esc(W.restKey(d)) + '"' } });
    });
    /* the first days after a long flight */
    var J = W.jetlag(P);
    if (J.days) out.push({ ok: true, t: "Jet lag: " + (J.days === 1 ? "Day 1 is" : "Days 1–" + J.days + " are") + " kept easy: nothing booked first thing, no day trips, an early dinner." });
    if (p.senior) out.push({ ok: true, t: "Grandparents along: days are kept shorter on foot, with no steep or strenuous outings." });
    if (!warn) out.unshift({ ok: true, t: "The trip's shape looks good: no backtracking, enough nights in each place, travel days spread out." });
    /* flying in and out of different cities */
    if (P.ap && st.length >= 2 && (W.km(at(st[0]), at(st[st.length - 1])) || 0) > 150) {
      var a = st[0], z = st[st.length - 1], ap = P.ap.code || P.ap.name, d1 = W.dateOf(1), dn = W.dateOf(P.N);
      out.push({ ok: true, tip: true, t: "Fly into " + a.name + " and home from " + z.name + " on one multi-city ticket, so you never travel back to the start.",
        link: "https://www.google.com/travel/flights?q=" + encodeURIComponent("Multi-city flights " + ap + " to " + a.name + (d1 ? " on " + W.isoDay(d1) : "") + " and " + z.name + " to " + ap + (dn ? " on " + W.isoDay(dn) : "")) });
    }
    out.warn = warn;
    return out;
  };

  var ICON_OK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  var ICON_WARN = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3.5v5.5M8 12v.5"/></svg>';
  var ICON_TIP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l12-5-4 10-2-4z"/></svg>';
  W.routeBody = function (P) {
    var R = W.routeCheck(P);
    if (!R.length) return { sum: "", body: "" };
    var body = '<ul class="rcheck">' + R.map(function (r) {
      return '<li class="' + (r.tip ? "tip" : r.ok ? "ok" : "warn") + '"><span class="ri">' + (r.tip ? ICON_TIP : r.ok ? ICON_OK : ICON_WARN) + "</span><div><p>" + esc(r.t) + "</p>" +
        (r.act ? '<button type="button" class="btn quiet sm" ' + r.act.data + ">" + esc(r.act.label) + "</button>" : "") +
        (r.link ? '<a class="linkish" href="' + esc(r.link) + '" target="_blank" rel="noopener">Search multi-city flights ↗</a>' : "") + "</div></li>";
    }).join("") + "</ul>";
    return { sum: R.warn ? plural(R.warn, "thing") + " to look at" : "Looks good", body: body, warn: R.warn };
  };
  /* the one-tap fixes: a shorter order, a place as a day trip (or a stay again), a night moved, a flight instead */
  function manualFor(country, P) {
    var c = W.S.countries.filter(function (x) { return x.name === country; })[0]; if (!c) return null;
    if (c.mode !== "manual") { c.mode = "manual"; c.picked = P.stops.filter(function (s) { return s.country === country; }).map(function (s) { return s.name; }); P.stops.forEach(function (s) { (s.trips || []).forEach(function (t) { if (t.country === country && c.picked.indexOf(t.name) < 0) c.picked.push(t.name); }); }); }
    return c;
  }
  W.routeClick = function (d, P) {
    if (d.routeorder != null) {
      var c = W.S.countries[+d.routeorder], order; try { order = JSON.parse(d.order); } catch (e) { return true; }
      if (!c || !order) return true;
      c.mode = "manual"; c.picked = order.slice();
      W.fxAfter(function () { W.fxStagger(".stop", { step: 40 }); });
      return true;
    }
    if (d.fold && d.foldto) { manualFor(d.foldc, P); (W.S.fold || (W.S.fold = {}))[d.fold] = d.foldto; W.resetPicks(); return true; }
    if (d.unfold) { manualFor(d.foldc, P); if (W.S.fold) delete W.S.fold[d.unfold]; W.resetPicks(); return true; }
    if (d.nights && d.nplus) {
      var cc = manualFor(d.nights, P), cd = W.S.cityDays || (W.S.cityDays = {});
      P.stops.forEach(function (s) { if (s.country === d.nights) cd[W.cityKey(s.country, s.name)] = s.days; });
      cd[W.cityKey(d.nights, d.nplus)] = (cd[W.cityKey(d.nights, d.nplus)] || 1) + 1;
      if (d.nminus) cd[W.cityKey(d.nights, d.nminus)] = Math.max(1, (cd[W.cityKey(d.nights, d.nminus)] || 2) - 1);
      W.resetPicks(); return !!cc;
    }
    if (d.legpick != null && d.legkey) { var lp = W.S.legPick || (W.S.legPick = {}), lgo = ((W.C.legs || {})[d.legkey] || {}).opts || [], pk = lgo[+d.legpick]; if (pk) lp[d.legkey] = W.legSig(pk); return true; }
    return false;
  };
})();
