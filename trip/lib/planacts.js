/* Waypoint planning, what changes a plan on request (the second script; the plan itself is lib/plan.js): "not for
   us", another suggestion for a stop, an idea put on the day, and the rescues of the rest of today (rain, running
   behind, a tired child, or what Claude worked out from a sentence: lib/replan.js) with their undo. Everything here
   is called from a tap. What it needs from the planner's own workings comes through W.planX. */
(function () {
  "use strict";
  var W = window.W,
    X = W.planX,
    mine = X.mine,
    unmark = X.unmark,
    choose = X.choose,
    score = X.score,
    mark = X.mark,
    dayPool = X.dayPool,
    unNopeName = X.unNopeName,
    slotCtx = X.slotCtx,
    poolCity = X.poolCity,
    key = X.key,
    ctxFor = X.ctxFor,
    byName = X.byName;
  W.sayNo = function (country, city, it, P) {
    var S = W.S;
    if (!it || !it.n) return;
    (S.nope || (S.nope = {}))[W.nopeKey(country, city, it)] = String(it.n).slice(0, 160);
    /* wherever the plan has it in that city, the slot gets a new suggestion */
    var pk = W.placeKey(it);
    ((P || W.P || {}).days || []).forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        var pc = poolCity(d, x);
        if (!x.item || pc[0] !== country || pc[1] !== city || (W.placeKey(x.item) !== pk && W.norm(x.item.n) !== W.norm(it.n))) return;
        delete S.picks[x.key];
        if (S.mine) delete S.mine[x.key];
      });
    });
  };
  W.reroll = function (day, slot, P) {
    var c = slotCtx(day, slot, P);
    if (!c) return;
    var k = c.k,
      pool = c.pool,
      u = c.u,
      ctx = c.ctx,
      cur = W.S.picks[k];
    if (W.S.free) delete W.S.free[k];
    var seen = (W.S.seen[k] = W.S.seen[k] || []);
    if (cur && seen.indexOf(W.norm(cur)) < 0) seen.push(W.norm(cur));
    /* rerolls stay in today's area: when the nearby ideas run out, start their cycle again and fetch more */
    var it = choose(pool, slot, u, seen, ctx, W.party(), true);
    if (!it) {
      W.S.seen[k] = cur ? [W.norm(cur)] : [];
      W.loadCity(c.x.trip && day.trip ? day.trip.country : day.country, c.x.trip && day.trip ? day.trip.name : day.city, true);
      it = choose(pool, slot, u, W.S.seen[k], ctx, W.party(), true);
      if (!it) {
        /* nothing else nearby yet: allow a little farther, but never across the region */
        var wide = {
          home: ctx.home,
          prev: ctx.prev,
          pts: ctx.pts,
          geo: { med: ctx.geo.med, R: ctx.geo.R * 2 },
          allowFull: ctx.allowFull,
          light: ctx.light,
          wd: ctx.wd,
          hol: ctx.hol,
          sun: ctx.sun,
          kd: ctx.kd,
          jet: ctx.jet,
          rest: ctx.rest
        };
        it = choose(pool, slot, u, W.S.seen[k], wide, W.party(), true);
      }
    }
    if (it) {
      W.S.picks[k] = it.n;
      mine()[k] = 1;
    }
  };
  /* put a specific idea into a slot; if it's on another day, the two trade places */
  W.useIdea = function (day, slot, name, P) {
    var k = key(day, slot),
      used = P.stops[day.stop].used || {},
      other = used[W.norm(name)];
    if (other && String(other).charAt(0) === "~") other = null; /* it was on an earlier stop's day: nothing to trade */
    var cur = W.S.picks[k],
      x = (day.slots || []).filter(function (y) {
        return y.slot === slot;
      })[0];
    unNopeName(day, x, name); /* you chose it after all */
    if (other && other !== k) {
      if (cur) {
        W.S.picks[other] = cur;
        mine()[other] = 1;
      } else delete W.S.picks[other];
    }
    W.S.picks[k] = name;
    mine()[k] = 1;
    if (W.S.free) delete W.S.free[k];
  };
  /* ---------- rescue the rest of today ---------- */
  /* One tap when the day goes wrong. Nothing that has started or is booked is touched (unless it is what closed).
     rain: outdoor stops still to come become indoor ones nearby, or free time.  tired: one easy thing close to your
     lodging, an early dinner near it, nothing else.  behind: the plan moves back 45 minutes and whatever no longer
     fits is left out.  closed: the next outing is swapped for something open now. Returns what changed, for the note. */
  W.rescue = function (day, P, mode) {
    X.cur(P);
    var S = W.S,
      nm = W.nowMin(),
      T = W.dayTimes(day, P),
      p = P.p;
    if (!T) return null;
    var rows = T.rows,
      s = P.stops[day.stop],
      home = W.homebase(day.country, day.city),
      used = s.used || (s.used = {});
    /* behind = the minutes this rescue itself added to "running late" (undo takes back those, not a later +15) */
    var undo = { picks: {}, mine: {}, free: {}, late: W.lateFor(day), behind: 0 },
      changed = [],
      freed = 0;
    day.slots.forEach(function (x) {
      undo.picks[x.key] = S.picks[x.key] || null;
      undo.mine[x.key] = mine()[x.key] || 0;
      undo.free[x.key] = (S.free || {})[x.key] || 0;
    });
    S.rescueUndo = S.rescueUndo || {};
    S.rescueUndo[W.restKey(day)] = undo;
    function booked(it) {
      var e = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
      return !!(e && e.done);
    }
    function later(x) {
      var R = rows[x.slot];
      return R && !R.skip && R.start != null && R.start > nm + 5;
    }
    function setFree(x, why) {
      (S.free || (S.free = {}))[x.key] = 1;
      if (x.item) unmark(used, x.item, x.key);
      delete S.picks[x.key];
      x.item = null;
      freed++;
      changed.push({ slot: x.slot, why: why });
    }
    function swap(x, filter, why) {
      var pl = dayPool(day, x, s),
        was = x.item,
        avoid = Object.assign({}, used);
      if (was) avoid[W.norm(was.n)] = 1;
      var cx = ctxFor(day, x, pl.home, pl.geo, false);
      cx.light = true;
      var list = W.isFood(x.slot) ? pl.pool.food || [] : pl.pool.spots || [];
      /** @type {Spot | Food | null} */ var best = null;
      var bs = -1e9;
      for (var i = 0; i < list.length; i++) {
        var it = list[i],
          k = W.norm(it.n);
        if (avoid[k] || !filter(it)) continue;
        if (W.badForDay(it, W.weekday(day.n), x.slot, W.kidDinner(), day.n) || (W.holidayShut && W.holidayShut(it, day))) continue;
        var sc = score(it, i, list.length, x.slot, cx, p, false);
        if (sc == null) sc = score(it, i, list.length, x.slot, cx, p, true);
        if (sc != null && sc > bs) {
          bs = sc;
          best = it;
        }
      }
      if (!best) return false;
      if (was) unmark(used, was, x.key);
      x.item = best;
      mark(used, best, x.key);
      S.picks[x.key] = best.n;
      mine()[x.key] = 1;
      if (S.free) delete S.free[x.key];
      changed.push({ slot: x.slot, from: was ? was.n : "", to: best.n, why: why });
      return true;
    }
    var openNow = function (it) {
      var h = it.hours;
      if (!h) return true;
      var t = nm + 30;
      return !(W.weekday(day.n) != null && h.closed.indexOf(W.weekday(day.n)) > -1) && h.o <= t && h.c > t + 45;
    };
    var near = function (km) {
      return function (it) {
        return it.lat == null || (W.km(home, it) || 0) <= km;
      };
    };
    if (mode === "rain") {
      W.loadIndoor(day.country, day.city);
      day.slots.forEach(function (x) {
        /* an outing slot still empty later today stays free: the planner would otherwise fill it with whatever comes in
           next (the indoor list asked for just above brings outdoor places too), outdoors in the rain */
        if (!x.item && !W.isFood(x.slot) && later(x) && !(S.free || {})[x.key]) {
          (S.free || (S.free = {}))[x.key] = 1;
          return;
        }
        if (!x.item || W.isFood(x.slot) || !later(x) || booked(x.item)) return;
        var c = W.classify(x.item, false);
        if (c.indoor) return;
        if (
          !swap(
            x,
            function (it) {
              return W.classify(it, false).indoor && near(Math.max(3, s.geo ? s.geo.R * 2 : 3))(it);
            },
            "rain"
          )
        )
          setFree(x, "rain");
      });
    } else if (mode === "tired") {
      var kept = false;
      day.slots.forEach(function (x) {
        if (!x.item || !later(x)) return;
        if (W.isFood(x.slot)) {
          if (x.slot === "dinner" && !booked(x.item) && (W.km(home, x.item) || 0) > 1.2)
            swap(
              x,
              function (it) {
                return near(1.2)(it) && openNow(it);
              },
              "tired"
            );
          return;
        }
        if (booked(x.item)) {
          kept = true;
          return;
        }
        var c = W.classify(x.item, false);
        if (!kept && x.slot !== "eve" && c.intensity <= 1 && (W.km(home, x.item) || 0) <= 1.5) {
          kept = true;
          return;
        }
        if (
          !kept &&
          x.slot !== "eve" &&
          swap(
            x,
            function (it) {
              var cc = W.classify(it, false);
              return cc.intensity <= 1 && near(1.5)(it) && openNow(it);
            },
            "tired"
          )
        ) {
          kept = true;
          return;
        }
        setFree(x, "tired");
      });
    } else if (mode === "behind") {
      undo.behind = 45;
      W.lateAdd(day, 45);
      var T2 = /** @type {DayTimes} */ (W.dayTimes(day, P)); /* (the same day as T above, so it has times) */
      (T2.order || []).forEach(function (sl) {
        var x = day.slots.filter(function (y) {
            return y.slot === sl;
          })[0],
          R = T2.rows[sl];
        /* what no longer fits once the rest of the day has moved back (the running-late shift moves times, it doesn't
           mark what is now too late: W.slotCap says) */
        var cap = W.slotCap(sl, P.p);
        if (x && x.item && R && (R.skip || (cap != null && R.start > cap)) && R.start > nm && !booked(x.item)) setFree(x, "behind");
      });
      changed.push({ slot: "", why: "behind" });
    } else if (mode === "closed") {
      var nx = null;
      (T.order || []).some(function (sl) {
        var x = day.slots.filter(function (y) {
            return y.slot === sl;
          })[0],
          R = rows[sl];
        if (x && x.item && !W.isFood(sl) && R && !R.skip && R.end > nm) {
          nx = x;
          return true;
        }
        return false;
      });
      if (
        nx &&
        !swap(
          nx,
          function (it) {
            return openNow(it) && near(Math.max(2.5, s.geo ? s.geo.R * 1.5 : 2.5))(it);
          },
          "closed"
        )
      )
        setFree(nx, "closed");
    }
    S.rescued = S.rescued || {};
    S.rescued[W.restKey(day) + "|" + W.isoDay(W.now())] = { mode: mode, n: changed.length, freed: freed, at: nm };
    return { mode: mode, changed: changed, freed: freed };
  };
  /* The same, from a sentence ("it's raining, the little one is tired, we have three hours"): lib/replan.js asks Claude
     which of the stops still to come to keep, drop or swap, choosing only among this day's own other options, and hands
     the answer here. Every action is checked again: a slot that has started or is booked is left alone, a name that isn't
     on the city's list or is already planned elsewhere is ignored. Same undo as the one-tap rescues. */
  W.rescueApply = function (day, P, acts, say) {
    X.cur(P);
    var S = W.S,
      nm = W.nowMin(),
      T = W.dayTimes(day, P);
    if (!T) return null;
    var rows = T.rows,
      s = P.stops[day.stop],
      used = s.used || (s.used = {});
    var undo = { picks: {}, mine: {}, free: {}, late: W.lateFor(day) },
      changed = [],
      freed = 0;
    day.slots.forEach(function (x) {
      undo.picks[x.key] = S.picks[x.key] || null;
      undo.mine[x.key] = mine()[x.key] || 0;
      undo.free[x.key] = (S.free || {})[x.key] || 0;
    });
    (acts || []).forEach(function (a) {
      var x = day.slots.filter(function (y) {
          return y.slot === a.slot;
        })[0],
        R = x && rows[x.slot];
      if (!x || !R || R.skip || R.start == null || R.start <= nm + 5) return;
      var e = x.item && W.bookEntryFor ? W.bookEntryFor(P, day, x.item) : null;
      if (e && e.done) return;
      if (a["do"] === "free") {
        if (!x.item && (S.free || {})[x.key]) return;
        (S.free || (S.free = {}))[x.key] = 1;
        if (x.item) unmark(used, x.item, x.key);
        delete S.picks[x.key];
        x.item = null;
        freed++;
        changed.push({ slot: x.slot, why: "ask" });
      } else if (a["do"] === "use" && a.name) {
        var pl = dayPool(day, x, s),
          list = W.isFood(x.slot) ? pl.pool.food || [] : pl.pool.spots || [],
          it = byName(list, a.name),
          was = x.item;
        if (!it || (was && W.norm(was.n) === W.norm(it.n))) return;
        var at = used[W.norm(it.n)];
        if (at && at !== x.key) return;
        if (was) unmark(used, was, x.key);
        x.item = it;
        mark(used, it, x.key);
        S.picks[x.key] = it.n;
        mine()[x.key] = 1;
        if (S.free) delete S.free[x.key];
        changed.push({ slot: x.slot, from: was ? was.n : "", to: it.n, why: "ask" });
      }
    });
    if (!changed.length) return { mode: "ask", changed: changed, freed: 0 };
    S.rescueUndo = S.rescueUndo || {};
    S.rescueUndo[W.restKey(day)] = undo;
    S.rescued = S.rescued || {};
    S.rescued[W.restKey(day) + "|" + W.isoDay(W.now())] = {
      mode: "ask",
      n: changed.length,
      freed: freed,
      at: nm,
      say: String(say || "").slice(0, 160)
    };
    return { mode: "ask", changed: changed, freed: freed };
  };
  W.unrescue = function (day) {
    var S = W.S,
      u = S.rescueUndo && S.rescueUndo[W.restKey(day)];
    if (!u) return false;
    Object.keys(u.picks).forEach(function (k) {
      if (u.picks[k]) S.picks[k] = u.picks[k];
      else delete S.picks[k];
      if (u.mine[k]) mine()[k] = 1;
      else delete mine()[k];
      if (S.free) {
        if (u.free[k]) S.free[k] = 1;
        else delete S.free[k];
      }
    });
    var lk = W.restKey(day) + "|" + W.isoDay(W.now());
    if (S.late && (u.behind == null || u.behind)) {
      /* (only what the rescue added goes: "running late" you said after it stays. An undo kept before v176 has no
         count, and puts it back as it was) */
      var back = u.behind == null ? u.late || 0 : Math.max(0, (S.late[lk] || 0) - u.behind);
      if (back) S.late[lk] = back;
      else {
        delete S.late[lk];
        if (S.lateAt) delete S.lateAt[lk];
      }
    }
    delete S.rescueUndo[W.restKey(day)];
    if (S.rescued) delete S.rescued[lk];
    return true;
  };
})();
