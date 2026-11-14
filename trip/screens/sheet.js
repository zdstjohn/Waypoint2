/* Waypoint, a stop's sheet: one stop of the day, sliding up over the screen you are on. What you do with a stop comes
   first, right under its name: Directions (the main button), its tickets or menu, Swap, and "⋯" for the rest (move it
   to another day, reorder today, leave that part of the day free, "Not for us", which asks once). Then everything
   about the place: photo, times, notes, reviews and links (W.stopDetails, screens/trip.js).
   Part of the second script: W.openStop (screens/flow.js) asks for it and opens it when it has come. It opens from
   the Day view and from Today alike; what needs the day's own cards (Swap, Reorder) goes to the Day view first.
   Escape, the ×, a tap beside it and Back (lib/back.js) close it, and the keyboard returns to what opened it. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    $ = W.$;
  var IC = {
    dir: W.icon("dir", 2.2),
    ticket: W.icon("ticket", 2.2),
    swap: W.icon("swap", 2.2),
    move: W.icon("move", 2.2),
    order: W.icon("order", 2.2),
    free: W.icon("free", 2.2),
    no: W.icon("no", 2.2)
  };
  var XI =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  /** @type {{key: string, slot: string, mode: string, ask?: string} | null} */
  var sheet = null,
    drawn = "",
    /** @type {HTMLElement | null} */ opener = null;

  function today() {
    return W.P.days[W.S.day - 1];
  }
  /** the stop the sheet is for, on the day on show */
  function entry(day) {
    var k = sheet && sheet.key;
    return ((day && day.slots) || []).filter(function (y) {
      return y.key === k;
    })[0];
  }
  /* where the way to a stop starts: on the day itself, where you are (no starting point: the maps app uses the
     phone's); on any other day, the stop before it, or your stay. Never a stay that isn't picked yet: that is only
     the middle of the town */
  function dirUrl(day, x) {
    if (W.isToday(day)) return W.gmapsDir(null, x.item, "walk");
    var T = W.dayTimes(day, W.P),
      order =
        (T && T.order) ||
        day.slots.map(function (y) {
          return y.slot;
        }),
      /** @type {any} */ prev = W.homebase(day.country, day.city);
    for (var i = 0; i < order.length && order[i] !== x.slot; i++) {
      var y = day.slots.filter(function (z) {
        return z.slot === order[i];
      })[0];
      if (y && y.item && y.item.lat != null) prev = y.item;
    }
    return W.gmapsDir(prev && prev.none ? null : prev, x.item, "walk");
  }
  function row(act, icon, title, sub, danger) {
    return (
      '<button type="button" class="sh-out-r' +
      (danger ? " danger" : "") +
      '" data-sheetact="' +
      act +
      '"><span class="ic">' +
      icon +
      "</span><span><b>" +
      title +
      "</b>" +
      (sub ? '<span class="small muted">' + sub + "</span>" : "") +
      "</span></button>"
    );
  }
  /* at the end of the sheet, under the facts: the rarer changes, each saying what it does (no "⋯" to open first);
     "Not for us" asks once before it acts */
  function moreBlock(it, x, day, nm) {
    var city = x.trip && day.trip ? day.trip.name : day.city;
    if (sheet && sheet.ask === "nope")
      return (
        '<div class="sh-out ask" role="alert"><p><b>Not for us?</b> ' +
        esc(it.n) +
        " comes off your plan and won't be suggested in " +
        esc(city) +
        ' again. You can bring it back from Explore.</p><div class="sh-out-b"><button type="button" class="btn danger" data-sheetact="nopeyes">Yes, not for us</button>' +
        '<button type="button" class="btn quiet" data-sheetact="nopeno">Keep it</button></div></div>'
      );
    return (
      '<div class="sh-menu">' +
      row("move", IC.move, "Move to another day", "Swap it with the same part of another day in " + esc(day.city)) +
      row("reorder", IC.order, "Reorder today", "Trade places with another stop of the day") +
      row("remove", IC.free, "Leave the " + esc(nm.toLowerCase()) + " free", "Nothing planned then. You can undo it.") +
      row("nope", IC.no, "Not for us", "Take it off and never suggest it in " + esc(city) + " again", true) +
      "</div>"
    );
  }
  function html() {
    if (!sheet) return "";
    var P = W.P,
      day = today(),
      x = entry(day);
    if (!x || !x.item) return "";
    var it = x.item,
      food = W.isFood(x.slot),
      nm = W.SLOT_NAME[x.slot],
      can = W.canEdit();
    var h =
      '<div class="sheet-back" data-sheetclose="1"></div><div class="sheet" role="dialog" aria-modal="' +
      (W.desk() ? "false" : "true") +
      '" tabindex="-1" aria-label="' +
      esc(it.n) +
      '"><div class="grab" aria-hidden="true"></div>' +
      /* (the sheet's title is its heading: a screen reader's list of headings starts there) */
      '<div class="sh-top"><div><b role="heading" aria-level="2">' +
      esc(it.n) +
      '</b><span class="small muted">Day ' +
      day.n +
      " · " +
      esc(day.city) +
      "</span></div>" +
      '<button type="button" class="icon-btn" data-sheetclose="1" aria-label="Close">' +
      XI +
      "</button></div>";
    if (sheet.mode === "move") {
      var cands = P.days.filter(function (d) {
        return (
          d.stop === day.stop &&
          d.n !== day.n &&
          d.slots &&
          d.slots.some(function (y) {
            return y.slot === x.slot && !y.rest;
          })
        );
      });
      h +=
        '<p class="small muted">Swap it with the ' +
        esc(nm.toLowerCase()) +
        " on another day in " +
        esc(day.city) +
        ".</p>" +
        (cands.length
          ? '<div class="sh-list">' +
            cands
              .map(function (d) {
                var y = d.slots.filter(function (z) {
                    return z.slot === x.slot;
                  })[0],
                  dt = W.dateOf(d.n);
                return (
                  '<button type="button" class="sh-row" data-sheetmove="' +
                  d.n +
                  '"><b>Day ' +
                  d.n +
                  "</b><span>" +
                  esc(dt ? W.fmtDate(dt, "wmd") : "") +
                  "</span>" +
                  '<span class="muted">' +
                  (y && y.item ? "now: " + esc(y.item.n) : "free") +
                  "</span></button>"
                );
              })
              .join("") +
            "</div>"
          : '<p class="small">There are no other days in ' + esc(day.city) + " to move it to.</p>") +
        '<button type="button" class="linkish" data-sheetback="1">' +
        W.arrow() +
        "Back</button>";
    } else {
      /* what you do with it, then everything about it */
      var tix = W.stopLink ? W.stopLink(it, food, day, P) : null;
      h +=
        '<div class="sh-main"><a class="btn sh-dir" href="' +
        esc(dirUrl(day, x)) +
        '" target="_blank" rel="noopener">' +
        IC.dir +
        "Directions</a>" +
        (tix ? '<a class="btn quiet" href="' + esc(tix.url) + '" target="_blank" rel="noopener">' + IC.ticket + esc(tix.t) + "</a>" : "") +
        (can ? '<button type="button" class="btn quiet" data-sheetact="swap">' + IC.swap + "Swap</button>" : "") +
        "</div>" +
        (W.stopDetails ? W.stopDetails(P, day, x, { noMain: !!tix }) : "") +
        (can ? '<div class="sh-change"><p class="sh-h">Change this stop</p>' + moreBlock(it, x, day, nm) + "</div>" : "");
    }
    return h + "</div>";
  }
  function draw() {
    var host = $("sheethost");
    if (!host) {
      host = document.createElement("div");
      host.id = "sheethost";
      document.body.appendChild(host);
    }
    var h = html();
    if (!h) {
      var was = !!sheet || !!drawn;
      sheet = null;
      drawn = "";
      host.innerHTML = "";
      if (!(W.qsIsOpen && W.qsIsOpen())) document.documentElement.classList.remove("modal-open");
      W.backShut("stop");
      /* the keyboard goes back to what opened it */
      if (was && opener && document.contains(opener)) opener.focus({ preventScroll: true });
      opener = null;
      return;
    }
    /* (nothing changed: nothing is rebuilt, so where you were reading, and the keyboard's place, stay put) */
    if (h === drawn) return;
    var first = !drawn,
      sc = /** @type {HTMLElement | null} */ (host.querySelector(".sheet")),
      y = sc ? sc.scrollTop : 0;
    drawn = h;
    host.innerHTML = h;
    document.documentElement.classList.add("modal-open");
    W.backOpen("stop", W.sheetClose);
    var now = /** @type {HTMLElement | null} */ (host.querySelector(".sheet"));
    if (now && first) now.focus({ preventScroll: true });
    else if (now) now.scrollTop = y;
  }
  W.sheetOpen = function (key) {
    var x = ((today() || {}).slots || []).filter(function (y) {
      return y.key === key;
    })[0];
    if (!x || !x.item) return;
    if (!sheet) opener = /** @type {HTMLElement | null} */ (document.activeElement);
    if (W.closeTripMenu) W.closeTripMenu(); /* (one thing on top at a time: the trip menu stayed open behind it) */
    sheet = { key: key, slot: x.slot, mode: "acts" };
    drawn = "";
    draw();
    if (W.deskSheet) W.deskSheet();
  };
  /** the stop whose sheet is open ("" when none): the desktop workspace marks its card and its pin */
  W.sheetKey = function () {
    return sheet ? sheet.key : "";
  };
  /** close it: true when it was open */
  W.sheetClose = function () {
    if (!sheet) return false;
    sheet = null;
    draw();
    if (W.deskSheet) W.deskSheet();
    return true;
  };
  /** the day was drawn again: the sheet follows what changed (a photo that arrived, a booking found) */
  W.sheetRedraw = function () {
    if (sheet && sheet.mode !== "move") draw();
  };
  /* Swap and Reorder work on the day's own cards: from Today (or anywhere else) the Day view comes up first */
  function onDay(then) {
    if (W.view() !== "trip" || W.S.tview !== "days") {
      W.keepDay(); /* (the day the sheet was opened on, which on Today can be another day you were looking at) */
      W.S.tview = "days";
      W.setView("trip");
      W.render();
    }
    then();
  }
  function act(a) {
    var P = W.P,
      day = today(),
      x = entry(day),
      S = W.S;
    if (!sheet || !x) return W.sheetClose();
    if (a === "swap") {
      W.sheetClose();
      onDay(function () {
        var r = /** @type {HTMLElement | null} */ (document.querySelector('#viewTrip [data-reroll="' + x.slot + '"]'));
        if (r) r.click();
      });
      return;
    }
    if (a === "move") {
      sheet.mode = "move";
      return draw();
    }
    if (a === "reorder") {
      var lk = sheet.key;
      W.sheetClose();
      onDay(function () {
        W.liftStart(lk);
        var c = document.querySelector('#viewTrip .slot[data-slotkey="' + CSS.escape(lk) + '"]');
        if (c && c.scrollIntoView) c.scrollIntoView({ block: "center" });
      });
      return;
    }
    if (a === "nope") {
      sheet.ask = "nope";
      draw();
      var q = document.querySelector("#sheethost .sh-out.ask");
      if (q && q.scrollIntoView) q.scrollIntoView({ block: "nearest" });
      return;
    }
    if (a === "nopeno") {
      delete sheet.ask;
      return draw();
    }
    if (a === "nopeyes") {
      /* never this place again in this city: the slot gets a new suggestion */
      var b4 = W.snapState(),
        pc = x.trip && day.trip ? [day.trip.country, day.trip.name] : [day.country, day.city];
      W.sayNo(pc[0], pc[1], x.item, P);
      W.sheetClose();
      W.undoPoint(b4, "We won't suggest it again");
      W.save();
      W.changed();
      return;
    }
    if (a === "remove") {
      var before = W.snapState();
      (S.free || (S.free = {}))[x.key] = 1;
      delete S.picks[x.key];
      if (S.mine) delete S.mine[x.key];
      W.sheetClose();
      W.undoPoint(before, "Left it free");
      W.save();
      W.changed();
    }
  }
  /** a stop to the same part of another day in the same place: the two trade places (this sheet, and on the desktop
      a card dropped on a day in the rail or its "a day earlier / later"). True when it moved.
      @param {string} key @param {number} n */
  W.moveStop = function (key, n) {
    var P = W.P,
      has = function (d) {
        return (d.slots || []).filter(function (z) {
          return z.key === key;
        })[0];
      },
      from = P.days.filter(has)[0],
      to = P.days[+n - 1];
    if (!from || !to || to === from || to.stop !== from.stop || !W.canEdit()) return false;
    var x = has(from),
      y = (to.slots || []).filter(function (z) {
        return z.slot === x.slot;
      })[0];
    if (!x || !y) return false;
    var before = W.snapState();
    /* make sure both names are stored, then swap */
    if (x.item) W.S.picks[x.key] = x.item.n;
    if (y.item) W.S.picks[y.key] = y.item.n;
    W.exchangeStops(x.key, y.key);
    W.undoPoint(before, "Moved to Day " + to.n);
    W.save();
    W.changed();
    return true;
  };
  /* to the same part of another day in this town: the two trade places */
  function move(n) {
    var P = W.P,
      day = today(),
      x = entry(day),
      d = P.days[+n - 1];
    if (!x || !d) return;
    var key = x.key;
    W.sheetClose();
    W.moveStop(key, d.n); /* (one way to move a stop to another day: screens/flow.js) */
  }
  /* its own buttons, before the views' handlers; a tap beside the sheet closes it */
  document.addEventListener(
    "click",
    function (e) {
      if (!sheet) return;
      var t = /** @type {HTMLElement | null} */ (e.target),
        b =
          t && t.closest
            ? /** @type {HTMLElement | null} */ (t.closest("[data-sheetclose],[data-sheetback],[data-sheetact],[data-sheetmove]"))
            : null;
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      var d = b.dataset;
      if (d.sheetclose) W.sheetClose();
      else if (d.sheetback) {
        sheet.mode = "acts";
        draw();
      } else if (d.sheetact) act(d.sheetact);
      else if (d.sheetmove) move(d.sheetmove);
    },
    true
  );
})();
