/* Waypoint's desktop workspace, part 1: its state and its shell (second script).
   On a window 1024px wide or more (W.desk(), lib/later.js) the app is three panes: a rail (screens/rail.js), the
   screen you are on, and the street map (lib/deskmap.js). This file owns what is true of the workspace itself and
   nothing about the trip: which panes are open and how wide the middle one is (per device, localStorage
   "waypoint-ws": never synced, like the other "how you look at it" choices), the elements the panes live in, the
   handle between the plan and the map, and the middle pane's scroll bar. The trip's state stays where it was (W.S),
   so making the window narrow or wide again changes nothing but the layout: the same day, the same open stop, the
   same words half typed.
   The middle pane scrolls with the window (the rail and the map are fixed), so everything that already scrolls the
   page (opening a day at "now", back to the top, an anchor) works unchanged. */
(function () {
  "use strict";
  var W = window.W,
    html = document.documentElement,
    KEY = "waypoint-ws";
  /** rail: open (1), folded (0) or by the window's width (null); map and list: shown or not; center: the middle
      pane's width in px (0 = the stylesheet's); hide: kinds of stop not shown ({food: 1, sight: 1}) */
  var prefs = { rail: /** @type {number | null} */ (null), map: 1, list: 1, center: 0, hide: /** @type {Record<string, number>} */ ({}) };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved === "object") {
      if (saved.rail === 0 || saved.rail === 1) prefs.rail = saved.rail;
      if (saved.map === 0) prefs.map = 0;
      if (saved.list === 0) prefs.list = 0;
      if (typeof saved.center === "number" && saved.center >= 0 && saved.center < 4000) prefs.center = Math.round(saved.center);
      if (saved.hide && typeof saved.hide === "object")
        ["food", "sight"].forEach(function (k) {
          if (saved.hide[k]) prefs.hide[k] = 1;
        });
    }
  } catch (e) {
    /* (no storage here, or not ours to read: the workspace starts from its defaults) */
  }
  function keep() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) {
      /* (a private window keeps nothing: the choice holds until the page is closed) */
    }
  }
  W.deskOn = true;
  W.wsPrefs = prefs;
  /** change one of the workspace's choices, remember it, draw again */
  W.wsSet = function (k, v) {
    /** @type {any} */ (prefs)[k] = v;
    keep();
    W.render();
  };
  W.wsHide = function (kind) {
    if (prefs.hide[kind]) delete prefs.hide[kind];
    else prefs.hide[kind] = 1;
    keep();
    W.render();
  };

  /* ---------- the shell: made once, the first time the workspace is on ---------- */
  /** @type {HTMLElement | null} */ var rail = null,
    /** @type {HTMLElement | null} */ canvas = null,
    /** @type {HTMLElement | null} */ split = null,
    /** @type {HTMLElement | null} */ bar = null,
    adopted = false;
  function make(tag, id, cls, inner) {
    var e = document.createElement(tag);
    e.id = id;
    if (cls) e.className = cls;
    if (inner) e.innerHTML = inner;
    document.body.appendChild(e);
    return e;
  }
  function build() {
    if (rail) return;
    rail = make(
      "aside",
      "wsRail",
      "ws-rail",
      '<div class="wr-top"><div class="wr-top-r"><span id="wrBrand"></span><button type="button" class="wr-ib" data-ws="rail" aria-label="Fold the sidebar" title="Fold the sidebar">' +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.8" y="2.5" width="12.4" height="11" rx="2.2"/><path d="M6 2.5v11"/></svg>' +
        '</button></div><div id="wrGreet"></div></div><div class="wr-trip" id="wrTrip"></div><nav class="wr-nav" id="wrNav" aria-label="Views"></nav>' +
        '<div class="wr-scroll" id="wrScroll"></div><div class="wr-tools" id="wrTools"></div><div class="wr-foot" id="wrFoot"></div>'
    );
    rail.setAttribute("aria-label", "Trip sidebar");
    /* (before the page in the document, so the keyboard reaches the views and the days first, as it reaches the tabs
       first on a phone) */
    var wrap0 = document.querySelector(".wrap");
    if (wrap0 && wrap0.parentNode) wrap0.parentNode.insertBefore(rail, wrap0);
    canvas = make(
      "section",
      "wsCanvas",
      "ws-canvas",
      '<div class="map-wrap vt-want" id="wsMapWrap"><div class="vt-slot"></div></div><div class="wc-empty" id="wcEmpty" hidden></div>' +
        '<div class="wc-bar"><div class="wc-title" id="wcTitle"></div><div class="wc-tools" role="group" aria-label="Map">' +
        '<button type="button" class="icon-btn" data-ws="zoom:out" aria-label="Zoom out">−</button><button type="button" class="icon-btn" data-ws="zoom:in" aria-label="Zoom in">+</button>' +
        '<button type="button" class="icon-btn" data-ws="zoom:fit" aria-label="Fit the day\'s stops" title="Fit the day\'s stops"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg></button>' +
        '<button type="button" class="icon-btn" data-ws="list" id="wcList" aria-pressed="false" aria-label="Map only" title="Map only: hide the plan"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 3h12v10H2zM6 3v10"/></svg></button>' +
        '<button type="button" class="icon-btn" data-ws="map" aria-label="Hide the map" title="Hide the map: the plan takes the room"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>' +
        '</div></div><p class="wc-note">© OpenMapTiles © OpenStreetMap contributors</p>'
    );
    canvas.setAttribute("aria-label", "Map of the day");
    split = make("div", "wsSplit", "", "");
    split.setAttribute("role", "separator");
    split.setAttribute("aria-orientation", "vertical");
    split.setAttribute("aria-label", "Resize the plan and the map (arrow keys; double-click to reset)");
    split.tabIndex = 0;
    bar = make("div", "wsBar", "", "<i></i>");
    bar.setAttribute("aria-hidden", "true");
    wireSplit();
  }
  W.wsEl = function (id) {
    return /** @type {HTMLElement | null} */ (document.getElementById(id));
  };
  /* the brand, the greeting with the trip's clock, the trip switcher and the next step live in the page's header on a
     phone and in the rail here: the same elements, moved (what draws into them finds them by id either way) */
  function adopt(on) {
    var top = document.querySelector(".top"),
      wrap = document.querySelector(".wrap"),
      brand = document.querySelector(".brand"),
      tb = document.getElementById("tripbar"),
      tl = document.getElementById("topline"),
      nb = document.getElementById("nextbar");
    if (!top || !wrap) return;
    adopted = on;
    if (on) {
      var a = W.wsEl("wrBrand"),
        b = W.wsEl("wrTrip"),
        c = W.wsEl("wrFoot");
      var g = W.wsEl("wrGreet");
      if (brand && a) a.appendChild(brand);
      if (tl && g) g.appendChild(tl);
      if (tb && b) b.appendChild(tb);
      if (nb && c) c.appendChild(nb);
    } else {
      if (brand) top.insertBefore(brand, top.firstChild);
      if (tl) top.insertBefore(tl, top.querySelector(".tabs"));
      if (tb) top.insertBefore(tb, tl);
      if (nb) wrap.insertBefore(nb, document.getElementById("viewSetup"));
    }
  }

  /* ---------- the layout for this screen: which panes, how wide ---------- */
  function railMin() {
    return prefs.rail == null ? window.innerWidth < 1280 : !prefs.rail;
  }
  function centerMax() {
    return Math.max(380, window.innerWidth - (railMin() ? 64 : window.innerWidth >= 1440 ? 280 : 264) - 300);
  }
  /** before a screen is drawn: put the panes where this screen wants them (so the screen is drawn at its real width) */
  W.deskLayout = function (P) {
    var on = W.desk();
    html.classList.toggle("ws", on);
    if (!on) {
      if (adopted) adopt(false);
      return false;
    }
    build();
    if (!adopted) adopt(true);
    /* the map stays beside a day (the itinerary, Explore, Today); All days, like Plan and Prepare, takes the width */
    var v = W.view(),
      days = (v === "trip" && !(W.S.glanceOpen && W.S.tview !== "map")) || v === "go" || v === "explore",
      split2 = days && !!prefs.map && !(W.simple && W.simple()) && !!(P && P.stops && P.stops.length);
    html.classList.toggle("ws-wide", !split2);
    html.classList.toggle("ws-rail-min", railMin());
    html.classList.toggle("ws-nolist", split2 && !prefs.list);
    html.classList.toggle("ws-f-food", !!prefs.hide.food);
    html.classList.toggle("ws-f-sight", !!prefs.hide.sight);
    if (prefs.center && split2) html.style.setProperty("--ws-center", Math.max(360, Math.min(centerMax(), prefs.center)) + "px");
    else html.style.removeProperty("--ws-center");
    var lb = W.wsEl("wcList");
    if (lb) lb.setAttribute("aria-pressed", String(!prefs.list));
    /* (the handle says how wide the plan is, for a screen reader moving it with the arrow keys) */
    var wr = document.querySelector(".wrap");
    if (split && wr) {
      split.setAttribute("aria-valuemin", "360");
      split.setAttribute("aria-valuemax", String(centerMax()));
      split.setAttribute("aria-valuenow", String(Math.round(wr.getBoundingClientRect().width)));
    }
    return true;
  };
  /** after it is drawn: the rail, the map, the scroll bar */
  W.deskAfter = function (P) {
    if (!W.desk()) return;
    if (W.railRender) W.railRender(P);
    if (W.deskMap) W.deskMap(P);
    barSoon();
  };
  /** a stop's inspector opened or closed (screens/sheet.js): its card and pin are marked, and found on the map */
  W.deskSheet = function () {
    if (W.desk() && W.deskMap && W.P) W.deskMap(W.P);
  };
  /** the map pane is showing (the screens leave their own small maps out then) */
  W.deskSplit = function () {
    return W.desk() && !html.classList.contains("ws-wide");
  };

  /* ---------- what a card carries on the desktop (asked for by screens/trip.js as it draws the day) ---------- */
  function qa(attrs, label, svg, off) {
    return (
      '<button type="button" ' +
      attrs +
      ' aria-label="' +
      label +
      '" title="' +
      label +
      '"' +
      (off ? " disabled" : "") +
      '><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      svg +
      "</svg></button>"
    );
  }
  /** a card's quick actions, shown on hover or focus: drag it (onto another stop, or a day in the rail), open it, a
      day earlier or later in the same place, find it on the map @param {SlotEntry} x @param {any} it @param {Day} day @param {Plan} P */
  W.deskQuick = function (x, it, day, P) {
    var esc = W.esc,
      k = esc(x.key),
      ed = W.canEdit(),
      near = function (n) {
        return P.days.filter(function (d) {
          return d.stop === day.stop && d.n === n;
        })[0];
      },
      prev = near(day.n - 1),
      next = near(day.n + 1);
    return (
      '<div class="ws-qa" role="group" aria-label="Quick actions for ' +
      esc(it.n) +
      '">' +
      (ed
        ? qa(
            'class="ws-grip" data-wsgrip="' + k + '"',
            "Drag onto another stop to trade places, or onto a day in the sidebar",
            '<circle cx="5.500" cy="4" r=".9"/><circle cx="10.500" cy="4" r=".9"/><circle cx="5.500" cy="8" r=".9"/><circle cx="10.500" cy="8" r=".9"/><circle cx="5.500" cy="12" r=".9"/><circle cx="10.500" cy="12" r=".9"/>'
          )
        : "") +
      qa(
        'data-open="' + k + '"',
        "Open the details",
        '<path d="M3 11.500 10.800 3.700l1.500 1.500L4.500 13H3z"/><path d="M9.500 5l1.500 1.500"/>'
      ) +
      (ed
        ? qa(
            'data-wsmove="' + (prev ? prev.n : "") + '" data-wskey="' + k + '"',
            prev ? "Move to Day " + prev.n : "No earlier day in " + esc(day.city),
            '<path d="M9.500 3.500 5 8l4.500 4.500"/>',
            !prev
          ) +
          qa(
            'data-wsmove="' + (next ? next.n : "") + '" data-wskey="' + k + '"',
            next ? "Move to Day " + next.n : "No later day in " + esc(day.city),
            '<path d="M6.500 3.500 11 8l-4.500 4.500"/>',
            !next
          )
        : "") +
      (it.lat != null
        ? qa(
            'data-wspin="' + k + '"',
            "Show on the map",
            '<path d="M8 14s4.200-3.900 4.200-7.300a4.200 4.200 0 0 0-8.400 0C3.800 10.100 8 14 8 14z"/><circle cx="8" cy="6.700" r="1.400"/>'
          )
        : "") +
      "</div>"
    );
  };
  /** the line over a day: how many stops, how long between them, when it starts and ends, what its tickets come to,
      how many are booked @param {{ stops: number, move: number, first: number | null, last: number | null, booked: number }} sm @param {Day} [day] */
  W.deskSum = function (sm, day) {
    var esc = W.esc;
    if (!sm || !sm.stops) return "";
    /* what the day's tickets come to for the group, where the budget knows (the same figures as Prepare's Budget) */
    var c = day ? W.C.cost[W.cityKey(day.country, day.city)] : null,
      cost = 0,
      priced = 0;
    if (c && c.tickets && day)
      (day.slots || []).forEach(function (x) {
        var it = x.item,
          v = it && !W.isFood(x.slot) ? c.tickets[W.norm(it.n)] : null;
        if (v != null && v > 0) {
          cost += v;
          priced++;
        }
      });
    return (
      '<div class="ws-sum" aria-label="The day in numbers"><span><b>' +
      sm.stops +
      "</b> stop" +
      (sm.stops === 1 ? "" : "s") +
      "</span>" +
      (sm.move ? "<span><b>" + esc(W.fmtMin(sm.move)) + "</b> getting around</span>" : "") +
      (sm.first != null && sm.last != null
        ? "<span><b>" + esc(W.clock(sm.first)) + "</b> to <b>" + esc(W.clock(sm.last)) + "</b></span>"
        : "") +
      (priced ? "<span>tickets <b>≈ " + esc(W.money(cost, c.cur)) + "</b></span>" : "") +
      (sm.booked ? "<span><b>" + sm.booked + "</b> booked</span>" : "") +
      "</div>"
    );
  };

  /* ---------- the handle between the plan and the map ---------- */
  function setCenter(px, done) {
    prefs.center = Math.round(Math.max(360, Math.min(centerMax(), px)));
    html.style.setProperty("--ws-center", prefs.center + "px");
    barSoon();
    if (done) {
      keep();
      W.render(); /* (the screen may lay itself out differently at its new width) */
    }
  }
  function wireSplit() {
    if (!split) return;
    var s = split,
      /** @type {{ x: number, w: number, id: number } | null} */ drag = null;
    s.addEventListener("pointerdown", function (e) {
      var wrap = document.querySelector(".wrap");
      if (!wrap || e.button > 0) return;
      e.preventDefault();
      drag = { x: e.clientX, w: wrap.getBoundingClientRect().width, id: e.pointerId };
      try {
        s.setPointerCapture(e.pointerId);
      } catch (x) {
        /* (a pointer that cannot be captured still drags while it stays over the handle) */
      }
      html.classList.add("ws-resizing");
      s.classList.add("on");
    });
    s.addEventListener("pointermove", function (e) {
      if (drag && e.pointerId === drag.id) setCenter(drag.w + e.clientX - drag.x, false);
    });
    var end = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var w = drag.w + e.clientX - drag.x;
      drag = null;
      html.classList.remove("ws-resizing");
      s.classList.remove("on");
      setCenter(w, true);
    };
    s.addEventListener("pointerup", end);
    s.addEventListener("pointercancel", end);
    s.addEventListener("dblclick", function () {
      prefs.center = 0;
      keep();
      W.render();
    });
    s.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      var wrap = document.querySelector(".wrap");
      if (!wrap) return;
      e.preventDefault();
      setCenter(wrap.getBoundingClientRect().width + (e.key === "ArrowLeft" ? -24 : 24), true);
    });
  }

  /* ---------- the middle pane's scroll bar (the window's own is hidden beside the map) ---------- */
  var barT = 0,
    barQ = false;
  function drawBar() {
    barQ = false;
    if (!bar || !W.desk()) return;
    var i = /** @type {HTMLElement} */ (bar.firstChild),
      H = document.documentElement.scrollHeight,
      vh = window.innerHeight,
      track = bar.clientHeight;
    if (!track || H <= vh + 4) {
      bar.classList.remove("on");
      return;
    }
    var h = Math.max(28, (track * vh) / H),
      y = ((track - h) * window.scrollY) / (H - vh);
    i.style.height = Math.round(h) + "px";
    i.style.transform = "translateY(" + Math.round(y) + "px)";
  }
  function barSoon() {
    if (barQ) return;
    barQ = true;
    requestAnimationFrame(drawBar);
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!bar || !W.desk()) return;
      bar.classList.add("on");
      clearTimeout(barT);
      barT = setTimeout(function () {
        if (bar) bar.classList.remove("on");
      }, 900);
      barSoon();
    },
    { passive: true }
  );
  /* the window changed size: the rail folds below 1280px (unless you chose), the plan's width keeps room for the map */
  var sizeT = 0,
    sizeW = window.innerWidth;
  window.addEventListener("resize", function () {
    if (!W.desk()) return;
    barSoon();
    if (window.innerWidth === sizeW) return;
    sizeW = window.innerWidth;
    clearTimeout(sizeT);
    sizeT = setTimeout(function () {
      if (W.desk()) W.render();
    }, 120);
  });

  /* ---------- the workspace's own buttons (data-ws="what[:which]") ---------- */
  function toDays(tv, glance) {
    W.S.tview = tv;
    W.S.glanceOpen = !!glance;
    if (W.view() === "trip") {
      W.save();
      W.render();
      window.scrollTo(0, 0);
    } else W.goView("trip");
  }
  /** go to a day: on Today it changes the day shown there, anywhere else it opens that day's plan */
  W.wsDay = function (n) {
    var P = W.P;
    if (!P || !P.days[n - 1]) return;
    if (W.view() === "go" && W.goToDay) {
      W.goToDay(n);
      W.render();
      window.scrollTo(0, 0);
      return;
    }
    W.S.day = n;
    if (W.view() === "explore" || (W.view() === "trip" && W.S.tview === "map")) {
      W.save();
      W.render();
      window.scrollTo(0, 0);
    } else toDays("days", false);
  };
  W.wsDo = function (what, which) {
    if (what === "rail") W.wsSet("rail", railMin() ? 1 : 0);
    else if (what === "map") W.wsSet("map", prefs.map ? 0 : 1);
    else if (what === "list") W.wsSet("list", prefs.list ? 0 : 1);
    else if (what === "zoom") {
      if (W.vtZoom) W.vtZoom(which);
    } else if (what === "view") {
      if (which === "days") toDays("days", false);
      else if (which === "all") toDays("days", true);
      else if (which === "explore") toDays("map", false);
      else if (which === "setup" || which === "go" || which === "book") W.goView(which);
    } else if (what === "day") W.wsDay(+which);
    else if (what === "prep") {
      W.S.prepTab = which;
      if (W.view() !== "book") W.goView("book");
      else W.render();
      /* (on the wide Prepare every part is on the page: go to this one) */
      setTimeout(function () {
        var e = document.querySelector('#viewBook [data-wssec="' + which + '"]');
        if (e) e.scrollIntoView({ block: "start", behavior: W.smooth ? W.smooth() : "auto" });
      }, 60);
    } else if (what === "f") W.wsHide(which);
    else if (what === "pal") {
      if (W.palOpen) W.palOpen();
    } else if (what === "csv") {
      if (W.csvExport) W.csvExport(W.P);
    } else if (what === "kids") W.goView("kids");
    else if (what === "settings") W.goView("settings");
    else return false;
    return true;
  };
  document.addEventListener(
    "click",
    function (e) {
      var t = /** @type {HTMLElement | null} */ (e.target),
        mv = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-wsmove]")) : null;
      /* a card's "a day earlier / a day later": the stop trades places with that day's same part */
      if (mv && W.desk()) {
        e.preventDefault();
        e.stopPropagation();
        if (mv.dataset.wsmove && W.moveStop) W.moveStop(mv.dataset.wskey || "", +mv.dataset.wsmove);
        return;
      }
      var b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-ws]")) : null;
      if (!b || !W.desk()) return;
      var p = String(b.dataset.ws).split(":");
      if (W.wsDo(p[0], p.slice(1).join(":"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
