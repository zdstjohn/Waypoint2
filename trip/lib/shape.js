/* Waypoint trip shape: the trip as a whole. Where you sleep and for how many nights, which places are better as a day
   trip from a base than as another hotel, how many moves the group can take, how to get between bases, and which days
   stay easy (the first ones after a long flight, travel days). Tuned for who is going: small children and grandparents
   mean fewer moves, longer stays and shorter days. The day planner (plan.js) builds on what this decides. */
(function () {
  "use strict";
  var W = window.W;

  /* the comfortable minimum nights in one place, and how far a day trip may go (one way) */
  W.minNights = function (p) { return p.toddler ? 3 : (p.kid || p.senior) ? 2 : 1; };
  W.dayTripMax = function (p) { return p.toddler ? 80 : p.senior ? 95 : 110; };
  /* how often the group can pack up: at most one hotel move per this many days */
  W.moveEvery = function (p) { return p.toddler ? 3.5 : (p.kid || p.senior) ? 2.5 : 2; };

  /* journey time between two stops: the way Claude found if known, otherwise a rough guess from the distance */
  W.legMinutes = function (a, b) {
    var L = W.C.legs || {}, lg = L[W.legKey(a, b)] || L[W.legKey(b, a)];
    var o = lg && lg.opts && lg.opts[0], m = o && W.parseDur(o.dur);
    return m || W.guessLeg(W.km(W.stopAt(a), W.stopAt(b)));
  };
  W.foldKey = function (country, city) { return W.cityKey(country, city); };

  /* fold one stop into a base: the base keeps the nights, the folded place becomes one of its day trips */
  function fold(st, i, j, why) {
    var s = st[i], b = st[j];
    b.days += s.days; b.trips = (b.trips || []).concat([{ country: s.country, name: s.name, c: s.c, why: why, min: W.legMinutes(b, s) }]);
    (s.trips || []).forEach(function (t) { b.trips.push(t); });
    st.splice(i, 1);
  }
  /* a base this place could be a day trip from: a neighbour (in trip order) within reach, the nearer one first */
  function baseFor(st, i, p, needDays) {
    var best = -1, bm = Infinity;
    [i - 1, i + 1].forEach(function (j) {
      var b = st[j]; if (!b || b.country !== st[i].country) return;
      var m = W.legMinutes(b, st[i]);
      if (m <= W.dayTripMax(p) && b.days >= (needDays || 1) && m < bm) { bm = m; best = j; }
    });
    return best;
  }
  /* a base can hold this many day trips: never on its first or last day, not two in a row */
  function tripRoom(b, p) { return Math.max(0, Math.floor((b.days - 1) / 2)); }
  /* a small town next to a big one (Toledo by Madrid, Sintra by Lisbon): a day trip, not another hotel */
  W.smallNextToBig = function (st, i, p) {
    var s = st[i], w = (s.c && s.c.w) || 2; if (w > 2) return -1;
    var best = -1, bm = Infinity;
    [i - 1, i + 1].forEach(function (j) {
      var b = st[j]; if (!b || b.country !== s.country || ((b.c && b.c.w) || 2) < 3) return;
      var m = W.legMinutes(b, s); if (m <= W.dayTripMax(p) * 0.8 && m < bm) { bm = m; best = j; }
    });
    return best;
  };

  /* Reshape the stops after the days are shared out. Only stops the planner suggested are folded on its own; places
     you chose yourself are left as they are and the route check offers the change instead. Returns the stops. */
  W.shapeTrip = function (st, N, p) {
    if (!st || st.length < 2) return st;
    var minN = W.minNights(p), guard = 0, changed = true;
    function free(s) { return !s.set && !s.manual; }
    while (changed && guard++ < 12) {
      changed = false;
      /* 1. a small town beside a big one is a day trip; too few nights somewhere: a day trip from a neighbour, else a night from the longest stay */
      for (var i = 0; i < st.length; i++) {
        var s = st[i]; if (!free(s)) continue;
        var jb = W.smallNextToBig(st, i, p);
        if (jb > -1 && (st[jb].trips || []).length < tripRoom(st[jb], p) + 1) { fold(st, i, jb, "small"); changed = true; break; }
        if (s.days >= minN) continue;
        var j = baseFor(st, i, p, 2);
        if (j > -1 && (st[j].trips || []).length < tripRoom(st[j], p) + 1) { fold(st, i, j, "nights"); changed = true; break; }
        var big = -1; st.forEach(function (o, k) { if (k !== i && o.days > minN && (big < 0 || o.days > st[big].days)) big = k; });
        if (big > -1 && !st[big].set) { st[big].days--; s.days++; changed = true; break; }
      }
      if (changed) continue;
      /* 2. too many moves for this group: the shortest suggested stay joins a neighbour */
      var moves = st.length - 1;
      if (moves > Math.ceil(N / W.moveEvery(p)) - 1) {
        var cand = -1;
        st.forEach(function (o, k) { if (free(o) && baseFor(st, k, p, 2) > -1 && (cand < 0 || o.days < st[cand].days)) cand = k; });
        if (cand > -1) { var j2 = baseFor(st, cand, p, 2); if ((st[j2].trips || []).length < tripRoom(st[j2], p) + 1) { fold(st, cand, j2, "moves"); changed = true; } }
      }
    }
    /* 3. the folds you asked for yourself */
    var F = W.S.fold || {};
    Object.keys(F).forEach(function (k) {
      var i = st.findIndex(function (o) { return W.foldKey(o.country, o.name) === k; }); if (i < 0) return;
      var j = st.findIndex(function (o) { return o.country === st[i].country && W.norm(o.name) === W.norm(F[k]); }); if (j < 0 || j === i) return;
      fold(st, i, j, "you");
    });
    return st;
  };

  /* which of a base's days are its day trips: not the first (arrival) or last (packing) day, not a jet-lag or rest day,
     spread out, and never two in a row. Returns the days that got one; trips that found no day are left unplanned. */
  W.placeTrips = function (stop, cdays) {
    var trips = stop.trips || []; if (!trips.length) return [];
    var ok = cdays.filter(function (d, i) { return i > 0 && i < cdays.length - 1 && !d.jet && !d.rest && !d.tripLast && !d.moveFrom; });
    if (!ok.length && cdays.length > 1) ok = cdays.filter(function (d, i) { return i > 0 && !d.jet && !d.rest; });
    var out = [], lastN = -9;
    /* spread: for k trips over n candidate days, take every n/k-th */
    var step = Math.max(1, Math.floor(ok.length / trips.length));
    for (var k = 0, i = Math.floor(step / 2); k < trips.length && i < ok.length; i += step) {
      var d = ok[i]; if (d.n - lastN < 2) { i++; if (i >= ok.length) break; d = ok[i]; }
      d.trip = trips[k]; lastN = d.n; out.push(d); k++;
    }
    trips.forEach(function (t) { t.planned = out.some(function (d) { return d.trip === t; }); });
    return out;
  };

  /* the way to go between two bases for this group, when you haven't picked one: the first option Claude gave unless a
     direct train or ferry under 4½ hours beats a flight (airports with small children cost a morning), or the only
     ferry is an overnight one */
  W.pickLeg = function (opts, p) {
    if (!opts || !opts.length) return 0;
    var mins = opts.map(function (o) { return W.parseDur(o.dur) || 9e9; });
    var best = 0;
    if (/flight|plane|fly/.test(opts[0].mode) && (p.toddler || p.senior)) {
      for (var i = 1; i < opts.length; i++) if (/train|rail|ferry|boat/.test(opts[i].mode) && mins[i] <= 270) { best = i; break; }
    }
    if (p.kid && /night|overnight/.test((opts[best].note || "") + " " + (opts[best].freq || "")) && opts.length > 1) best = best === 0 ? 1 : 0;
    return best;
  };

  /* the trip's shape, as the route check and the day list show it */
  W.shapeNotes = function (P) {
    var out = [], p = P.p, st = P.stops, minN = W.minNights(p);
    st.forEach(function (s) {
      (s.trips || []).forEach(function (t) {
        out.push({ kind: "trip", base: s, trip: t, planned: t.planned !== false, t: t.name + " is a day trip from " + s.name + (t.min ? " (about " + W.fmtMin(Math.round(t.min / 15) * 15) + " each way)" : "") + (t.why === "you" ? "." : t.why === "small" ? ": a small town beside a big one, so one hotel move fewer." : ", so one hotel move fewer.") });
      });
    });
    return out;
  };

  /* ---------- the order of the places: the shortest way round (the planner uses it for suggested places; Plan's check of the
     trip's shape, lib/route.js, offers it for yours) ---------- */
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
  W.bestOrder = bestOrder; W.routeDist = dist;
})();
