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

  /* running late: everything that hasn't started yet moves back */
  W.lateShift = function (day, out) {
    var late = W.lateFor(day);
    if (!late) return;
    var nm = nowMin();
    Object.keys(out.rows).forEach(function (k) {
      var r = out.rows[k];
      if (r.start != null && r.start >= nm - 5) {
        r.start += late;
        if (r.end != null) r.end += late;
      }
    });
    if (out.nap && out.nap.start >= nm - 5) {
      out.nap.start += late;
      out.nap.end += late;
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
    var L = W.S.late || (W.S.late = {}),
      k = lateKey(day);
    if (+d.late === 0) delete L[k];
    else L[k] = Math.min(240, (L[k] || 0) + +d.late);
    /* forget older days */
    Object.keys(L).forEach(function (x) {
      if (x.slice(-10) !== W.isoDay(W.now())) delete L[x];
    });
    return true;
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
