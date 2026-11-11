/* Waypoint, today on the Trip tab: during the trip the Day view opens on today, with one line for what's on now and
   the way to the Today screen (screens/travel.js); and the clock the whole day goes by, with "running late" moving
   the rest of the day. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  /* minutes into the day, by the trip's clock (W.now, lib/times.js) */
  function nowMin() {
    var d = W.now();
    return d.getHours() * 60 + d.getMinutes();
  }
  W.nowMin = nowMin;
  W.todayN = function (P) {
    if (!W.S.start) return null;
    var n = W.dayOfDate(W.isoDay(W.now()));
    return n >= 1 && n <= (P ? P.N : 999) ? n : null;
  };
  function isToday(day) {
    return W.S.start && W.dayOfDate(W.isoDay(W.now())) === day.n;
  }
  W.isToday = isToday;
  function lateKey(day) {
    return W.restKey(day) + "|" + W.isoDay(W.now());
  }
  W.lateFor = function (day) {
    return isToday(day) ? (W.S.late || {})[lateKey(day)] || 0 : 0;
  };

  /** Running late: what had not started when you said so moves `min` minutes later (0: back on time). The moment is
      kept with it, so a stop stays moved once the clock passes its old time (it used to slip back then, stop by stop). */
  W.lateAdd = function (day, min) {
    var L = W.S.late || (W.S.late = {}),
      A = W.S.lateAt || (W.S.lateAt = {}),
      k = lateKey(day),
      today = W.isoDay(W.now());
    if (!min) {
      delete L[k];
      delete A[k];
    } else {
      /* each time you say so is kept with its minutes: a second "+15" moves only what has not started by then */
      var room = Math.min(240, (L[k] || 0) + min) - (L[k] || 0);
      if (!L[k] || !Array.isArray(A[k])) A[k] = [];
      if (room > 0) A[k].push([nowMin(), room]);
      L[k] = (L[k] || 0) + room;
    }
    /* forget older days */
    [L, A].forEach(function (M) {
      Object.keys(M).forEach(function (x) {
        if (x.slice(-10) !== today) delete M[x];
      });
    });
  };
  /* running late: everything that hadn't started yet when you said so moves back */
  W.lateShift = function (day, out) {
    var late = W.lateFor(day);
    if (!late) return;
    var kept = (W.S.lateAt || {})[lateKey(day)],
      /** @type {number[][]} */ steps = Array.isArray(kept) && kept.length ? kept : [[nowMin(), late]],
      sum = steps.reduce(function (a, s) {
        return a + s[1];
      }, 0);
    /* (the total was changed elsewhere, by a rescue undone: one move, from when the first was made) */
    if (sum !== late) steps = [[steps[0][0], late]];
    /* how far something that began at `t` has moved: each step moves what had not started when it was made */
    var moved = function (t) {
      var s = t;
      steps.forEach(function (st) {
        if (s >= st[0] - 5) s += st[1];
      });
      return s - t;
    };
    Object.keys(out.rows).forEach(function (k) {
      var r = out.rows[k],
        m = r.start != null ? moved(r.start) : 0;
      if (m) {
        r.start += m;
        if (r.end != null) r.end += m;
      }
    });
    if (out.nap) {
      var nmv = moved(out.nap.start);
      out.nap.start += nmv;
      out.nap.end += nmv;
    }
    if (out.back) out.back += late;
    out.late = late;
  };

  /* Today's day on the Trip tab: one line saying what is on now (or next), and the way to the Today screen, where the
     day is lived (when to leave, directions, running late). The plan itself starts right under it. */
  W.todayRow = function (day, P, T) {
    if (!isToday(day) || !T) return "";
    var nm = nowMin(),
      rows = (T.order || [])
        .map(function (sl) {
          var x = day.slots.filter(function (y) {
            return y.slot === sl;
          })[0];
          return { x: x, R: T.rows[sl] };
        })
        .filter(function (o) {
          return o.x && o.x.item && o.R && !o.R.skip && o.R.start != null;
        });
    /** @type {typeof rows[0] | null} */ var cur = null,
      next = cur;
    rows.forEach(function (o) {
      if (o.R.start <= nm && nm < o.R.end) cur = o;
      else if (!next && o.R.start > nm) next = o;
    });
    var late = W.lateFor(day),
      zone = W.tripTimeNote(day.city),
      napNow = T.nap && T.nap.start <= nm && nm < T.nap.end;
    var k = napNow || cur ? "Now" : next ? "Next" : "",
      what = napNow
        ? "Nap or rest"
        : cur
          ? cur.x.item.n
          : next
            ? next.x.item.n
            : rows.length && nm >= rows[rows.length - 1].R.end
              ? "That's today done"
              : "Nothing else planned today",
      when = napNow ? "until " + W.clock(T.nap.end) : cur ? "until " + W.clock(cur.R.end) : next ? "at " + W.clock(next.R.start) : "";
    var tail = [when, zone, late ? "running " + W.fmtMin(late) + " late" : ""].filter(Boolean).join(" · ");
    return (
      '<button type="button" class="today-row" data-view="go"><span class="tr-t">' +
      (k ? '<b class="tr-k">' + k + "</b> " : "") +
      '<span class="tr-n">' +
      esc(what) +
      "</span>" +
      (tail ? ' <span class="muted">' + esc(tail) + "</span>" : "") +
      '</span><span class="tr-go">Today<span aria-hidden="true"> ›</span></span></button>'
    );
  };
  W.lateClick = function (d) {
    if (d.late == null || !W.P) return false;
    var day = W.P.days[(W.S.day || 1) - 1];
    if (!day) return true;
    W.lateAdd(day, +d.late);
    return true;
  };

  /** a link led to one particular day: the Trip tab opens on that day, not on today (it opens on today only when
      you arrive there by yourself, the first time each visit) */
  W.keepDay = function () {
    if (W.S.start) W.jumpToToday.done = (W.S.tripId || "") + "|" + W.S.start;
  };
  /* during the trip, open on today the first time each visit, and keep the card fresh */
  W.jumpToToday = function (P) {
    if (!W.S.start) return;
    var key = (W.S.tripId || "") + "|" + W.S.start;
    if (W.jumpToToday.done === key) return;
    var n = W.todayN(P);
    if (n) {
      W.S.day = n;
      W.jumpToToday.done = key;
    }
  };
  setInterval(function () {
    if (document.visibilityState !== "visible" || !W.P || !W.view || (W.view() !== "trip" && W.view() !== "go")) return;
    var day = W.P.days[(W.S.day || 1) - 1];
    if (day && isToday(day) && !W.typingHeld()) W.render();
  }, 60000);
})();
