/* Waypoint Today mode: during the trip, My trip opens on today, says what's now and what's next,
   when to leave, and shifts the rest of the day when you're running late. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc;
  /* the clock (a test can pin it with localStorage "waypoint-now") */
  W.now = function () {
    var o = null; try { o = localStorage.getItem("waypoint-now"); } catch (e) {}
    var d = o ? new Date(o) : new Date(); return isNaN(d.getTime()) ? new Date() : d;
  };
  function nowMin() { var d = W.now(); return d.getHours() * 60 + d.getMinutes(); }
  W.nowMin = nowMin;
  W.todayN = function (P) { if (!W.S.start) return null; var n = W.dayOfDate(W.isoDay(W.now())); return n >= 1 && n <= (P ? P.N : 999) ? n : null; };
  function isToday(day) { return W.S.start && W.dayOfDate(W.isoDay(W.now())) === day.n; }
  W.isToday = isToday;
  function lateKey(day) { return W.restKey(day) + "|" + W.isoDay(W.now()); }
  W.lateFor = function (day) { return isToday(day) ? (W.S.late || {})[lateKey(day)] || 0 : 0; };

  /* running late: everything that hasn't started yet moves back */
  W.lateShift = function (day, out) {
    var late = W.lateFor(day); if (!late) return;
    var nm = nowMin();
    Object.keys(out.rows).forEach(function (k) { var r = out.rows[k]; if (r.start != null && r.start >= nm - 5) { r.start += late; if (r.end != null) r.end += late; } });
    if (out.nap && out.nap.start >= nm - 5) { out.nap.start += late; out.nap.end += late; }
    if (out.back) out.back += late;
    out.late = late;
  };

  /* the card at the top of today */
  W.todayCard = function (day, P, T) {
    if (!isToday(day) || !T) return "";
    var nm = nowMin(), rows = (T.order || []).map(function (sl) { var x = day.slots.filter(function (y) { return y.slot === sl; })[0]; return { x: x, R: T.rows[sl] }; })
      .filter(function (o) { return o.x && o.x.item && o.R && !o.R.skip && o.R.start != null; });
    /** @type {typeof rows[0] | null} */ var cur = null, next = cur;
    rows.forEach(function (o) { if (o.R.start <= nm && nm < o.R.end) cur = o; else if (!next && o.R.start > nm) next = o; });
    var home = W.homebase(day.country, day.city), late = W.lateFor(day);
    var napNow = T.nap && T.nap.start <= nm && nm < T.nap.end;
    var lines = [];
    if (napNow) lines.push('<p class="now-l"><span class="k">Now</span> Nap or rest back at ' + esc(home.label) + ' <span class="muted">until ' + W.clock(T.nap.end) + "</span></p>");
    else if (cur) lines.push('<p class="now-l"><span class="k">Now</span> ' + esc(cur.x.item.n) + ' <span class="muted">until about ' + W.clock(cur.R.end) + "</span></p>");
    var acts = "";
    if (next) {
      var from = cur ? cur.x.item : null;
      if (!from) { rows.forEach(function (o) { if (o.R.end <= nm && o.x.item.lat != null) from = o.x.item; }); }
      if (!from || napNow) from = home;
      var lg = W.leg(from, next.x.item), leave = next.R.start - (lg ? lg.min : 10);
      var mins = leave - nm;
      lines.push('<p class="now-l"><span class="k">Next</span> ' + esc(next.x.item.n) + ' <span class="muted">at ' + W.clock(next.R.start) + "</span></p>");
      lines.push('<p class="leave' + (mins <= 10 ? " soon" : "") + '">' + (mins <= 0 ? "Time to go" : mins <= 90 ? "Leave in " + W.fmtMin(Math.max(5, Math.round(mins / 5) * 5)) : "Leave by " + W.clock(leave)) +
        (lg ? ' <span class="muted">· ' + esc(W.fmtMin(lg.min) + " " + lg.label) + "</span>" : "") + "</p>");
      acts += '<a class="lo-book" href="' + esc(W.gmapsDir(from, next.x.item, lg ? lg.mode : "walk")) + '" target="_blank" rel="noopener">Directions <span aria-hidden="true">↗</span></a>';
    } else if (!cur && !napNow) {
      var tomorrow = P.days[day.n];
      lines.push('<p class="now-l">' + (rows.length && nm >= rows[rows.length - 1].R.end ? "That's today done." : "Nothing else planned today.") + (tomorrow ? ' <span class="muted">Tomorrow: ' + esc(tomorrow.city) + "</span>" : "") + "</p>");
      if (tomorrow) acts += '<button type="button" class="btn quiet sm" data-day="' + tomorrow.n + '">See tomorrow</button>';
    }
    if (next || cur) acts += '<button type="button" class="btn quiet sm" data-late="15">Running late</button>' + (late ? '<button type="button" class="linkish" data-late="0">Back on time</button>' : "");
    return '<section class="today sk" aria-live="polite"><div class="today-h"><b>Today</b><span class="muted">' + W.clock(nm) + (late ? " · plan moved " + W.fmtMin(late) + " later" : "") + "</span></div>" + lines.join("") +
      (acts ? '<div class="lo-act">' + acts + "</div>" : "") + "</section>";
  };
  W.lateClick = function (d) {
    if (d.late == null || !W.P) return false;
    var day = W.P.days[(W.S.day || 1) - 1]; if (!day) return true;
    var L = W.S.late || (W.S.late = {}), k = lateKey(day);
    if (+d.late === 0) delete L[k]; else L[k] = Math.min(240, (L[k] || 0) + (+d.late));
    /* forget older days */
    Object.keys(L).forEach(function (x) { if (x.slice(-10) !== W.isoDay(W.now())) delete L[x]; });
    return true;
  };

  /* during the trip, open on today the first time each visit, and keep the card fresh */
  W.jumpToToday = function (P) {
    if (!W.S.start) return;
    var key = (W.S.tripId || "") + "|" + W.S.start; if (W.jumpToToday.done === key) return;
    var n = W.todayN(P);
    if (n) { W.S.day = n; W.jumpToToday.done = key; }
  };
  setInterval(function () {
    if (document.visibilityState !== "visible" || !W.P || !W.view || (W.view() !== "trip" && W.view() !== "go")) return;
    var day = W.P.days[(W.S.day || 1) - 1];
    if (day && isToday(day) && !W.typingHeld()) W.render();
  }, 60000);
})();
