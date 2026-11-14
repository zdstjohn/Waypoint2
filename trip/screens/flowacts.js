/* Waypoint flow, what a tap does (the second script; what is drawn is screens/flow.js): the next step's buttons and
   the links between My trip, Book ahead and Plan so nothing is a dead end; undo; swiping between days; reordering a
   day by dragging a stop or by lifting it and tapping where it goes; Escape. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    $ = W.$;
  function go(g) {
    if (!g) return;
    if (g.quick) {
      W.quickStart();
      return;
    }
    if (g.appmode) {
      W.setAppMode(g.appmode);
      return;
    }
    if (g.url && !g.gobook) {
      window.open(g.url, "_blank", "noopener");
      return;
    }
    if (g.gostay != null) return goStay(+g.gostay);
    if (g.gobook) return goBook(g.gobook);
    if (g.view) {
      if (g.step) {
        var sc = W.S.stepClosed || (W.S.stepClosed = {});
        sc[g.step] = false;
      }
      W.setView(g.view);
      W.render();
      window.scrollTo(0, 0);
      if (g.step)
        setTimeout(function () {
          var el = document.querySelector('[data-fold="step-' + g.step + '"]');
          if (el) {
            el.open = true;
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          var f = g.focus && $(g.focus);
          if (f)
            setTimeout(function () {
              try {
                f.focus({ preventScroll: true });
                if (f.showPicker && f.type === "date") f.showPicker();
              } catch (e) {}
            }, 350);
        }, 60);
    }
  }

  /* ======================= links between views ======================= */
  function goStay(si) {
    var P = W.P,
      s = P.stops[si];
    if (!s) return;
    /* where to stay, as a sheet over the screen you are on (it comes with the second script) */
    W.whenLater(function () {
      W.staySheet(si);
    });
  }
  function goBook(key) {
    /* Prepare comes with the second script: show it loading, and finish the jump once it has come */
    if (!W.needLater()) {
      var n = 0;
      W.setView("book");
      W.render();
      (function wait() {
        if (W.laterReady) goBook(key);
        else if (n++ < 60) setTimeout(wait, 100);
      })();
      return;
    }
    if (W.bookReveal) W.bookReveal(key);
    W.setView("book");
    W.render();
    window.scrollTo(0, 0);
    setTimeout(function () {
      var b = document.querySelector('.bk-ahead [data-tick="' + CSS.escape(key) + '"], .bk-done [data-tick="' + CSS.escape(key) + '"]'),
        row = b && b.closest(".chk");
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("flash");
        setTimeout(function () {
          if (row) row.classList.remove("flash");
        }, 1800);
      }
    }, 80);
  }
  function goDay(n, open) {
    if (W.keepDay) W.keepDay(); /* (a link to a day opens that day, even the first time on the Trip tab during the trip) */
    W.S.day = +n;
    W.setView("trip");
    W.render();
    window.scrollTo(0, 0);
    if (open)
      setTimeout(function () {
        var t = document.querySelector('[data-open="' + CSS.escape(open) + '"]');
        if (t) t.scrollIntoView({ block: "center" });
        W.openStop(open);
      }, 80);
  }
  /* ======================= undo ======================= */
  var LABELS = {
    reroll: "",
    next: "Swapped",
    use: "" /* (says what it did itself: screens/trip.js) */,
    tick: "Updated a booking",
    rest: "Changed the rest day",
    routeorder: "Changed the order",
    legpick: "Changed how you travel",
    style: "Changed the trip style",
    cdays: "Changed the days",
    late: "Moved today's plan",
    jdel: "Removed a photo",
    rmbk: "Removed a booking",
    watch: "Watching the price",
    unwatch: "Stopped watching",
    heart: "",
    pick: "Changed the places",
    addcity: "Added a place",
    up: "Changed the order",
    pace: "Changed the pace",
    paceall: "Changed the pace",
    mode: "Changed how places are picked",
    delta: "Changed the days",
    resetdays: "Reset the days",
    nope: "We won't suggest it again",
    unnope: "Brought it back",
    setstay: "Changed where you stay",
    lstay: "Changed where you stay",
    addbk: "Added a booking",
    age: "Changed a traveler"
  };
  var IDS = {
    addAdult: "Added a traveler",
    addChild: "Added a traveler",
    daysMinus: "Changed the days",
    daysPlus: "Changed the days",
    addCountry: "Added a country"
  };
  function labelFor(b) {
    var d = b.dataset;
    if (d.tick && W.tickLabel) return W.tickLabel(d.tick);
    if (IDS[b.id]) return IDS[b.id];
    for (var k in d) {
      if (LABELS[k]) return LABELS[k];
      if (/^rm/.test(k)) return "Removed";
    }
    return "";
  }
  var undo = null,
    undoTimer = null,
    clickSeq = 0;
  /* what Undo puts back: the trip, and "running late" (late, lateAt), which isn't sent to other devices but is
     yours to take back (v181: "+15 min" never offered Undo, as the snapshot left it out) */
  var UNDO_VIEW = ["late", "lateAt"];
  function snap() {
    try {
      var o = Object.assign({}, W.syncable(W.S));
      UNDO_VIEW.forEach(function (k) {
        if (W.S[k] !== undefined) o[k] = W.S[k];
      });
      return JSON.stringify(o);
    } catch (e) {
      return null;
    }
  }
  /** @param {string | null} before @param {string} [label] @param {number} [seeDay] a day to offer "See day" for */
  W.undoPoint = function (before, label, seeDay) {
    if (!before || W.readOnly) return;
    var now = snap();
    if (!now || now === before) return;
    undo = { before: before, label: label || "Changed", trip: W.S.tripId, see: seeDay || 0 };
    showUndo();
  };
  function showUndo() {
    var host = $("undohost");
    if (!host) {
      host = document.createElement("div");
      host.id = "undohost";
      document.body.appendChild(host);
    }
    /* (read out from the live region that is always there: one drawn with its words already in it is often not read) */
    host.innerHTML = undo
      ? '<div class="undo"><span>' +
        esc(undo.label) +
        "</span>" +
        /* (added from Explore: the way to the day it went to) */
        (undo.see ? '<button type="button" class="undo-see" data-undosee="' + undo.see + '">See day</button>' : "") +
        '<button type="button" data-undo="1">Undo</button></div>'
      : "";
    clearTimeout(undoTimer);
    var box = host; /* (found or made above) */
    if (undo) {
      W.say(undo.label + ". Undo is at the bottom of the screen.");
      var gone = function () {
        /* (not while the keyboard is on its Undo: someone who tabbed there gets to press it) */
        if (box.contains(document.activeElement)) {
          undoTimer = setTimeout(gone, 2000);
          return;
        }
        undo = null;
        box.innerHTML = "";
      };
      undoTimer = setTimeout(gone, 7000);
    }
  }
  function doUndo() {
    if (!undo) return;
    var o;
    try {
      o = JSON.parse(undo.before);
    } catch (e) {
      return;
    }
    if (undo.trip !== W.S.tripId) {
      undo = null;
      showUndo();
      return;
    } /* a different trip is open now */
    var S = W.S,
      keepView = W.VIEW_KEYS || [];
    Object.keys(S).forEach(function (k) {
      if (keepView.indexOf(k) < 0) delete S[k];
    });
    Object.keys(o).forEach(function (k) {
      S[k] = o[k];
    });
    UNDO_VIEW.forEach(function (k) {
      if (!(k in o)) delete S[k];
    });
    undo = null;
    showUndo();
    W.save();
    W.changed();
  }

  /* ======================= a stop's sheet (screens/sheet.js), and drag to reorder ======================= */
  function slotsOf(day) {
    return (day && day.slots) || [];
  }
  /* exchange two stops (both stay where you put them) */
  function exchange(ka, kb) {
    var S = W.S,
      a = S.picks[ka],
      b = S.picks[kb],
      m = S.mine || (S.mine = {}),
      f = S.free || (S.free = {});
    if (a) {
      S.picks[kb] = a;
      m[kb] = 1;
      delete f[kb];
    } else {
      delete S.picks[kb];
      f[kb] = 1;
    }
    if (b) {
      S.picks[ka] = b;
      m[ka] = 1;
      delete f[ka];
    } else {
      delete S.picks[ka];
      f[ka] = 1;
    }
  }
  /* reorder a day. With a mouse: drag a stop by its photo onto another one. On a phone: press and hold a photo
     (or pick "Swap with another stop today"), then tap the stop to trade places with. */
  function swapStops(ka, kb) {
    var P = W.P,
      day = P.days[W.S.day - 1],
      a = slotsOf(day).filter(function (y) {
        return y.key === ka;
      })[0],
      b = slotsOf(day).filter(function (y) {
        return y.key === kb;
      })[0];
    if (!a || !b) return;
    var before = snap();
    if (a.item) W.S.picks[a.key] = a.item.n;
    if (b.item) W.S.picks[b.key] = b.item.n;
    exchange(a.key, b.key);
    W.undoPoint(before, "Swapped " + W.SLOT_NAME[a.slot].toLowerCase() + " and " + W.SLOT_NAME[b.slot].toLowerCase());
    W.save();
    W.changed();
  }
  var lift = null;
  function canTake(card) {
    return (
      lift &&
      card &&
      card.dataset.slotkey &&
      card.dataset.slotkey !== lift.key &&
      card.classList.contains("food") === lift.food &&
      !card.classList.contains("skel")
    );
  }
  function paintLift() {
    document.querySelectorAll(".slot.lifted, .slot.droppable").forEach(function (c) {
      c.classList.remove("lifted", "droppable");
    });
    document.documentElement.classList.toggle("lifting", !!lift);
    var host = $("lifthost");
    if (!host) {
      host = document.createElement("div");
      host.id = "lifthost";
      document.body.appendChild(host);
    }
    if (!lift) {
      host.innerHTML = "";
      return;
    }
    var cards = document.querySelectorAll(".slots .slot[data-slotkey]"),
      any = false;
    cards.forEach(function (c) {
      if (c.dataset.slotkey === lift.key) c.classList.add("lifted");
      else if (canTake(c)) {
        c.classList.add("droppable");
        any = true;
      }
    });
    host.innerHTML =
      '<div class="lifthint" role="status"><span>' +
      (any ? "Now tap the " + (lift.food ? "meal" : "stop") + " to swap with" : "Nothing else today to swap with") +
      '</span><button type="button" data-liftoff="1">Cancel</button></div>';
  }
  function startLift(key) {
    var P = W.P,
      day = P.days[W.S.day - 1],
      x = slotsOf(day).filter(function (y) {
        return y.key === key;
      })[0];
    if (!x) return;
    lift = { key: key, food: W.isFood(x.slot), name: x.item ? x.item.n : W.SLOT_NAME[x.slot] };
    paintLift();
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (e) {}
  }
  function endLift() {
    if (!lift) return;
    lift = null;
    paintLift();
  }
  /** (after every draw: a lifted stop keeps its marks) */
  W.liftRedraw = function () {
    if (!lift) return;
    if (W.view() !== "trip") lift = null;
    paintLift();
  };
  /* (for the stop's sheet, which swaps and reorders through these) */
  W.exchangeStops = exchange;
  W.liftStart = startLift;
  W.snapState = snap;

  var drag = null;
  function arm() {
    drag.on = true;
    drag.card.classList.add("dragging");
    var g = drag.card.cloneNode(true),
      r = drag.card.getBoundingClientRect();
    g.className += " ghost";
    g.removeAttribute("data-slotkey");
    g.style.width = r.width + "px";
    g.style.left = r.left + "px";
    g.style.top = "0px";
    document.body.appendChild(g);
    drag.ghost = g;
    drag.dy = drag.y - r.top;
    if (W.desk()) document.documentElement.classList.add("ws-dragging"); /* (the rail shows which days can take it) */
    place(drag.x, drag.y);
  }
  function place(x, y) {
    if (!drag.ghost) return;
    drag.ghost.style.transform = "translate(" + Math.round(x - drag.x) + "px," + Math.round(y - drag.dy) + "px) rotate(-1.2deg)";
    var el = document.elementFromPoint(x, y),
      t = el && el.closest(".slots .slot");
    if (drag.target && drag.target !== t) drag.target.classList.remove("droptarget");
    drag.target =
      t && t !== drag.card && t.dataset.slotkey && t.classList.contains("food") === drag.food && !t.classList.contains("skel") ? t : null;
    if (drag.target) drag.target.classList.add("droptarget");
    /* on the desktop: a day in the rail, in the same place, takes the stop (it trades with that day's same part) */
    var dd = W.desk() && el ? el.closest(".wr-day.can") : null;
    if (dd && Number(dd.dataset.wsday) === W.S.day) dd = null;
    if (drag.day && drag.day !== dd) drag.day.classList.remove("drop");
    drag.day = dd;
    if (dd) dd.classList.add("drop");
  }
  /** @type {{ x: number; y: number; key: string; id: number; t?: ReturnType<typeof setTimeout> } | null} */ var hold = null;
  document.addEventListener("pointerdown", function (e) {
    var h = e.target && e.target.closest && e.target.closest(".slots .slot .thumb, .slots .slot > .num");
    if (!h || !W.canEdit() || W.view() !== "trip" || e.button > 0) return;
    var card = h.closest(".slot");
    if (!card || !card.dataset.slotkey) return;
    if (e.pointerType !== "mouse") {
      /* press and hold: lift it, then tap where it goes */
      clearTimeout(hold ? hold.t : undefined);
      hold = { x: e.clientX, y: e.clientY, key: card.dataset.slotkey, id: e.pointerId };
      hold.t = setTimeout(function () {
        if (hold) {
          var k = hold.key;
          hold = null;
          startLift(k);
          W.suppressClick = Date.now();
        }
      }, 450);
      return;
    }
    drag = {
      card: card,
      key: card.dataset.slotkey,
      food: card.classList.contains("food"),
      x: e.clientX,
      y: e.clientY,
      on: false,
      id: e.pointerId,
      target: null,
      day: null
    };
  });
  function noHold() {
    if (hold) {
      clearTimeout(hold.t);
      hold = null;
    }
  }
  document.addEventListener(
    "pointermove",
    function (e) {
      if (hold && e.pointerId === hold.id && Math.abs(e.clientX - hold.x) + Math.abs(e.clientY - hold.y) > 10) noHold();
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.on) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
        arm();
      }
      e.preventDefault();
      place(e.clientX, e.clientY);
    },
    { passive: false }
  );
  document.addEventListener("contextmenu", function (e) {
    if (hold || lift || drag) e.preventDefault();
  });
  function endDrag(e) {
    if (hold && (!e || e.pointerId === hold.id)) {
      if (e && e.type === "pointercancel") noHold();
      else if (e && e.type === "pointerup") noHold();
    }
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag;
    drag = null;
    if (!d.on) return;
    d.card.classList.remove("dragging");
    document.documentElement.classList.remove("ws-dragging");
    if (d.ghost) d.ghost.remove();
    if (d.day) {
      d.day.classList.remove("drop");
      if (e.type !== "pointercancel") W.moveStop(d.key, +d.day.dataset.wsday);
    } else if (d.target) {
      d.target.classList.remove("droptarget");
      if (e.type !== "pointercancel") swapStops(d.key, d.target.dataset.slotkey);
    }
    W.suppressClick = Date.now();
  }
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  /* ======================= swipe between days ======================= */
  var sw = null;
  document.addEventListener(
    "touchstart",
    function (e) {
      sw = null;
      if (W.view() !== "trip" || e.touches.length !== 1 || drag) return;
      var t = e.target;
      if (
        !t ||
        !t.closest ||
        t.closest(
          ".explorer, .daybar, .idea-list, .swapcards, .opts, input, textarea, select, .live-list, .sheet, .legopts, .vtwrap, .map, canvas, .thumb"
        )
      )
        return;
      sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    function (e) {
      if (!sw) return;
      var s = sw;
      sw = null;
      var t = e.changedTouches[0],
        dx = t.clientX - s.x,
        dy = t.clientY - s.y;
      if (Date.now() - s.t > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
      var btn = document.querySelector('#viewTrip .daybar [data-step="' + (dx < 0 ? 1 : -1) + '"]');
      if (btn && !btn.disabled && btn.click) btn.click();
    },
    { passive: true }
  );

  /* changing day from further down the page: start the new day at its top */
  function toDayTop() {
    var bar = document.querySelector("#viewTrip .daybar");
    if (!bar) return;
    var y = bar.getBoundingClientRect().top + window.scrollY - 8;
    if (window.scrollY > y + 40) window.scrollTo({ top: y, behavior: "smooth" });
  }
  /* ======================= clicks (run before the views' own handlers) ======================= */
  W.onClickLater(function (e) {
    if (W.suppressClick && Date.now() - W.suppressClick < 400) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (lift) {
      var lc = e.target && e.target.closest && e.target.closest(".slots .slot");
      e.preventDefault();
      e.stopPropagation();
      if (lc && canTake(lc)) {
        var from = lift.key;
        lift = null;
        paintLift();
        swapStops(from, lc.dataset.slotkey);
      } else endLift();
      return;
    }
    if (W.closeTripMenu && e.target.closest && !e.target.closest(".trip-menu, .trip-sw")) W.closeTripMenu();
    var b = e.target.closest("button, a");
    if (!b) {
      var card = e.target && e.target.closest && e.target.closest(".slots .slot[data-slotkey]:not(.free):not(.skel)");
      if (card && !e.target.closest(".swap, .slot-notes a")) {
        W.openStop(card.dataset.slotkey);
      }
      return;
    }
    var d = b.dataset || {};
    function stop() {
      e.preventDefault();
      e.stopPropagation();
    }
    if (d.comment) W.closeStop();
    if (d.quick) {
      stop();
      W.quickStart();
      return;
    }
    if (d.undo) {
      stop();
      doUndo();
      return;
    }
    if (d.undosee) {
      stop();
      undo = null;
      showUndo();
      W.S.tview = "days";
      goDay(+d.undosee);
      return;
    }
    if (d.nextstep) {
      stop();
      var el = $("nextbar");
      go(el && el.__step && el.__step.go);
      return;
    }
    if (d.nexthide) {
      stop();
      var nh = W.S.nextHide || (W.S.nextHide = {});
      nh[d.nexthide] = 1;
      W.save();
      W.render();
      return;
    }
    if (d.sheet) {
      stop();
      W.openStop(d.sheet);
      return;
    }
    /* (the sheet's own buttons are its own: screens/sheet.js) */
    if (d.sheetclose || d.sheetback || d.sheetact || d.sheetmove) return;
    if (d.gobook) {
      stop();
      W.closeStop();
      goBook(d.gobook);
      return;
    }
    if (d.goday) {
      stop();
      goDay(d.goday, d.goopen);
      return;
    }
    if (d.gostay != null) {
      stop();
      goStay(+d.gostay);
      return;
    }
    if ((d.step || d.day) && W.view() === "trip") toDayTop();
    /* everything else: remember the state, so a change can be undone */
    if (b.tagName === "BUTTON" && W.canEdit()) {
      var lab = labelFor(b);
      if (!lab) return;
      var before = snap(),
        seq = ++clickSeq,
        done = false;
      [0, 520].forEach(function (t) {
        setTimeout(function () {
          if (!done && seq === clickSeq && snap() !== before) {
            done = true;
            W.undoPoint(before, lab);
          }
        }, t);
      });
    }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (lift) endLift();
    else if (W.closeStop()) return;
    else if (W.qsClose && W.qsClose()) return;
    else if (W.closeTripMenu && W.closeTripMenu()) return;
    else {
      /* a stop's swap open on the Day view, with the keyboard in it: Escape closes it, and the keyboard is back on its Swap */
      var tog = /** @type {HTMLElement | null} */ (document.querySelector('#viewTrip:not([hidden]) [data-reroll][aria-expanded="true"]')),
        a = /** @type {HTMLElement | null} */ (document.activeElement);
      if (tog && a && (a === tog || a.closest(".swap") || a.closest(".acts-w"))) {
        /* (on a phone Swap is in its card's "more" menu: the keyboard goes back to that button) */
        var w = /** @type {HTMLElement | null} */ (tog.closest(".acts-w")),
          more = w && /** @type {HTMLElement | null} */ (w.querySelector(".more-btn")),
          key = w && w.dataset.k;
        if (more && getComputedStyle(more).display !== "none") {
          tog.click();
          W.fxAfter(function () {
            var m = /** @type {HTMLElement | null} */ (
              document.querySelector('#viewTrip .acts-w[data-k="' + CSS.escape(key || "") + '"] .more-btn')
            );
            if (m) m.focus({ preventScroll: true });
          });
          return;
        }
        tog.focus({ preventScroll: true });
        tog.click();
      }
    }
  });
})();
