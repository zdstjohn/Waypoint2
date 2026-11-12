/* Waypoint flow, the part every first screen draws: the "next step" bar, the Book ahead entry of a stop, the buttons
   to the previous and next day, a place's dates, and the doors to what comes with the second script (a stop's sheet,
   the three questions of a new trip). What a tap then DOES (the next step's buttons, undo, swiping between days,
   reordering by drag or by lifting a stop) is screens/flowacts.js, in the second script. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    $ = W.$;
  function fmt(d, o) {
    return d ? d.toLocaleDateString(undefined, o || { month: "short", day: "numeric" }) : "";
  }
  var CHEV =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>';
  function svg(d) {
    return (
      '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      d +
      "</svg>"
    );
  }
  var CHEVL =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>';
  var XI =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

  /* ======================= the next step ======================= */
  W.nextStep = function (P) {
    var S = W.S;
    if (W.readOnly || W.isExample) return null;
    var out = [],
      today = W.now(),
      tn = W.todayN ? W.todayN(P) : null;
    if (tn) {
      var tv = W.travelNudge && W.travelNudge(P);
      return tv && !(S.nextHide || {})[tv.key] ? tv : null;
    } /* during the trip, the travel screen says what's next */
    (W.watchDrops ? W.watchDrops() : []).forEach(function (w) {
      var d = W.watchDrop(w);
      out.push({
        key: "drop|" + w.id,
        k: "Price drop",
        text: w.label + " now " + W.money(d.now, d.cur) + " (was " + W.money(d.was, d.cur) + ")",
        go: { url: w.url, gobook: w.kind === "stay" ? "stay|" + w.key : "flight|" + w.key }
      });
    });
    if (!S.countries.length) {
      if (W.view() !== "setup") out.push({ key: "where", text: "Pick where you're going", sub: "three quick questions", go: { quick: 1 } });
    } else if (!P.stops.length) out.push({ key: "cities", text: "Pick the places to visit", go: { view: "setup", step: "where" } });
    /* only what can't wait: price drops, bookings due within a month, and an empty trip */
    var list = P.stops.length && W.checklist ? W.checklist(P) : [];
    var due = list
      .filter(function (c) {
        return W.leftToBook(c) && c.by;
      })
      .sort(function (a, b) {
        return a.by - b.by;
      });
    var urgent = due.filter(function (c) {
      return c.by.getTime() - today.getTime() < 30 * 864e5;
    })[0];
    if (urgent)
      out.push({
        key: "book|" + urgent.key,
        k: W.bookByText(urgent),
        text: urgent.short || urgent.title,
        go: { gobook: urgent.key }
      });
    var last = W.dateOf && W.dateOf(P.N);
    if (last && last < today && W.journalHas && W.journalHas())
      out.push({ key: "recap", text: "Your trip recap is ready", go: { view: "recap" } });
    var hide = S.nextHide || {};
    return (
      out.filter(function (x) {
        return !hide[x.key];
      })[0] || null
    );
  };
  W.renderNext = function (P) {
    var el = $("nextbar");
    if (!el) return;
    var v = W.view(),
      n = v === "recap" || v === "go" ? null : W.nextStep(P);
    if (!n) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML =
      '<div class="nextbar sk"><button type="button" class="nb-go" data-nextstep="' +
      esc(n.key) +
      '"><span class="nb-k">' +
      esc(n.k || "Next") +
      '</span><span class="nb-t">' +
      esc(n.text) +
      "</span>" +
      (n.sub ? '<span class="nb-s">' + esc(n.sub) + "</span>" : "") +
      CHEV +
      '</button><button type="button" class="nb-x icon-btn" data-nexthide="' +
      esc(n.key) +
      '" aria-label="Hide this suggestion">' +
      XI +
      "</button></div>";
    el.__step = n;
  };
  /* the Book ahead entry for a stop on the trip, if it needs booking */
  W.bookEntryFor = function (P, day, it) {
    if (!W.checklist || !it) return null;
    var cl = W.P === P && W._clCache && W._clCache.P === P ? W._clCache.list : (W._clCache = { P: P, list: W.checklist(P) }).list;
    var k = "item|" + W.cityKey(day.country, day.city) + "|" + W.norm(it.n);
    return (
      cl.filter(function (c) {
        return c.key === k;
      })[0] || null
    );
  };

  /* ======================= quick start ======================= */
  /* the three questions for a new trip come with the second script (screens/quickstart.js): asked for here, opened
     when it has arrived (at once, nearly always) */
  W.quickStart = function (first) {
    W.whenLater(function () {
      W.qsOpen(first);
    });
  };

  /* the sheet comes with the second script: asked for here, opened when it has arrived (at once, nearly always) */
  W.openStop = function (key) {
    W.whenLater(function () {
      W.sheetOpen(key);
    });
  };
  W.closeStop = function () {
    return !!(W.sheetClose && W.sheetClose());
  };
  W.afterRender = function () {
    if (W.liftRedraw) W.liftRedraw();
    if (W.sheetRedraw) W.sheetRedraw();
    if (W.staySheetRedraw) W.staySheetRedraw();
    if (W.taRedraw) W.taRedraw();
  };
  /* (an undo point asked for before the second script is here is taken when it arrives: the state it keeps was
     handed over, so nothing is lost) */
  W.undoPoint = function (before, label, seeDay) {
    var early = W.undoPoint;
    W.whenLater(function () {
      if (W.undoPoint !== early) W.undoPoint(before, label, seeDay);
    });
  };
  /* the buttons under a day: previous and next */
  W.dayNav = function (day, P) {
    var a = P.days[day.n - 2],
      b = P.days[day.n];
    if (!a && !b) return "";
    function side(d, dir) {
      return (
        '<button type="button" class="dn-b ' +
        (dir < 0 ? "pv" : "nx") +
        '" data-step="' +
        dir +
        '" aria-label="' +
        (dir < 0 ? "Previous" : "Next") +
        " day: Day " +
        d.n +
        ", " +
        esc(d.city) +
        '">' +
        (dir < 0 ? CHEVL : "") +
        "<span><small>" +
        (dir < 0 ? "Previous" : "Next") +
        "</small><b>Day " +
        d.n +
        " · " +
        esc(d.city) +
        "</b></span>" +
        (dir > 0 ? CHEV : "") +
        "</button>"
      );
    }
    return '<nav class="daynav" aria-label="Other days">' + (a ? side(a, -1) : "") + (b ? side(b, 1) : "") + "</nav>";
  };

  /* ======================= a place's dates ======================= */
  function rangeOf(P, si) {
    var ds = P.days.filter(function (d) {
        return d.stop === si;
      }),
      a = W.dateOf(ds[0].n),
      b = W.dateOf(ds[ds.length - 1].n);
    if (!a) return "";
    var mo = { month: "short", day: "numeric" };
    return a.getMonth() === b.getMonth() ? fmt(a, mo) + "–" + b.getDate() : fmt(a, mo) + " – " + fmt(b, mo);
  }
  /** "Jun 7–10": the dates of a place you stay (the desktop rail's day list, screens/rail.js) */
  W.stopRange = rangeOf;

  /* the side-by-side map appears above 920px wide: redraw when the window crosses that */
  var wide = window.innerWidth > 920,
    rT = null;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      var w = window.innerWidth > 920;
      if (w !== wide) {
        wide = w;
        if (W.view() === "trip") W.render();
      }
    }, 200);
  });
})();
