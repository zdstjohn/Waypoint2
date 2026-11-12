/* Waypoint's desktop workspace, part 3: the map pane, and the tie between the map and the list (second script).
   While you look at days (the itinerary, Explore, Today) the street map stays beside them: the day's stops as
   lettered pins, the hops between them as thin dashed links (straight ones: the app has no street-by-street path, so
   they show the order, and the list gives each hop's real way and time), and on Explore the ideas as small pins.
   A card and its pin light each other up under the pointer, a hop in the list and its link likewise; a click on a
   pin opens the stop beside the plan. A city with no street map shows the day's route as a list instead, with the way
   to Google Maps (never a sketch). The map itself is lib/vtmap.js's one map, moved into this pane; the screens say
   what is on the day (W.deskPts: screens/trip.js, screens/travel.js; W.deskIdeas), this file only shows it. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var hiKeys = /** @type {string[]} */ ([]),
    hiLeg = "",
    hiIdea = "",
    lastSel = "";
  function canvas() {
    return W.wsEl("wsCanvas");
  }
  function esq(v) {
    return String(v).replace(/["\\]/g, "\\$&");
  }
  /* a day's stops in order when no screen has said (All days): the plan's own order */
  function ptsOf(day) {
    var n = 0,
      out = /** @type {any[]} */ ([]);
    (day.slots || []).forEach(function (x) {
      var it = x.item;
      if (!it) return;
      n++;
      out.push({
        n: it.n,
        lat: it.lat,
        lng: it.lng,
        gid: it.gid,
        gpin: it.gpin,
        num: n,
        i: n,
        food: W.isFood(x.slot),
        slot: x.slot,
        key: x.key,
        it: it
      });
    });
    return out;
  }
  /** what the pane shows now: the day, its stops (less what the rail's "Show" hides), where you stay */
  function wanted(P) {
    var v = W.view(),
      n = v === "go" && W.goDayN ? W.goDayN(P) : W.S.day,
      day = P.days[n - 1];
    if (!day) return null;
    var D = W.deskPts,
      fresh =
        D && D.n === n && D.country === day.country && D.city === day.city && !!D.go === (v === "go") && !(v === "trip" && W.S.glanceOpen);
    if (!fresh) {
      var home = W.homebase(day.country, day.city);
      D = { n: n, country: day.country, city: day.city, pts: ptsOf(day), home: home.none ? null : home, slug: null, xp: false };
    }
    var hide = W.wsPrefs.hide;
    return {
      day: day,
      D: D,
      pts: D.pts.filter(function (p) {
        return !(p.food ? hide.food : hide.sight);
      }),
      slug: D.slug || (W.vtFor ? W.vtFor(day.country, day.city, D.home && D.home.lat, D.home && D.home.lng) : null)
    };
  }
  function legsOf(pts, home) {
    var out = [],
      prev = home && home.lat != null ? [home.lng, home.lat] : null;
    pts.forEach(function (p) {
      if (p.lat == null || p.gpin) return;
      var here = [p.lng, p.lat];
      if (prev && (prev[0] !== here[0] || prev[1] !== here[1])) out.push({ id: p.key || "", a: prev, b: here });
      prev = here;
    });
    return out;
  }
  /** after a screen is drawn: the map pane for it */
  W.deskMap = function (P) {
    var c = canvas();
    if (!c || !W.deskSplit()) return;
    var w = wanted(P),
      wrap = W.wsEl("wsMapWrap"),
      empty = W.wsEl("wcEmpty"),
      title = W.wsEl("wcTitle");
    if (!w || !wrap || !empty || !title) return;
    var stops = w.pts.length,
      dt = W.dateOf(w.day.n),
      when = dt ? dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
    W.draw(
      title,
      "<b>Day " +
        w.day.n +
        " · " +
        esc(w.day.trip ? w.day.trip.name : w.day.city) +
        "</b><span>" +
        esc([when, stops + (stops === 1 ? " stop" : " stops")].filter(Boolean).join(" · ")) +
        "</span>",
      "ws-title"
    );
    var engine = W.vtState ? W.vtState() : "off",
      can = !!w.slug && engine !== "off" && !!W.vtMount;
    if (!can) {
      /* no street map for this place (or this device can't draw one): the day's route as a list, and Google Maps */
      var finding = !w.slug && W.vt && W.vt.idxState !== "ready";
      var gm = w.pts.length && W.dayRouteUrl ? W.dayRouteUrl(w.day, w.pts, w.D.home || W.homebase(w.day.country, w.day.city)) : "";
      wrap.hidden = true;
      empty.hidden = false;
      c.classList.add("nomap"); /* (no map: no zoom buttons, no map credit) */
      W.draw(
        empty,
        "<div><h3>" +
          (finding ? "Looking for the street map…" : "No street map for " + esc(w.day.city) + " yet") +
          "</h3>" +
          (finding
            ? ""
            : '<p class="small muted">Waypoint has street maps for the places most people go, and adds more each night. Here is the day in order.</p>') +
          (w.pts.length
            ? "<ol>" +
              w.pts
                .map(function (p) {
                  return '<li class="' + (p.food ? "food" : "") + '"><b>' + esc(W.stopTag(p.num)) + "</b>" + esc(p.n) + "</li>";
                })
                .join("") +
              "</ol>"
            : "") +
          (gm ? '<p><a class="btn" href="' + esc(gm) + '" target="_blank" rel="noopener">Open the day in Google Maps</a></p>' : "") +
          "</div>",
        "ws-empty"
      );
      lastSel = W.sheetKey ? W.sheetKey() : "";
      paint(); /* (the open stop's card is marked with or without a map) */
      return;
    }
    empty.hidden = true;
    wrap.hidden = false;
    c.classList.remove("nomap");
    var slot = wrap.querySelector(".vt-slot"),
      ok = W.vtMount(slot, {
        slug: w.slug,
        key: "ws|" + w.day.n + "|" + w.day.city + "|" + (w.D.xp ? "x" : "d"),
        pts: w.pts,
        home: w.D.home,
        animate: true,
        city: w.day.city
      });
    wrap.classList.toggle("vt-on", !!ok);
    wrap.classList.toggle("vt-want", !ok);
    if (!ok) return;
    W.vt.onPins = paint;
    W.vtLegs(legsOf(w.pts, w.D.home), function (id) {
      if (id !== hiLeg) {
        hiLeg = id;
        paint();
      }
    });
    W.vtIdeas(w.D.xp ? W.deskIdeas || [] : []);
    /* the stop open beside the plan: marked, and brought out from under the inspector */
    var sel = W.sheetKey ? W.sheetKey() : "";
    if (sel && sel !== lastSel) {
      var p = w.pts.filter(function (q) {
        return q.key === sel;
      })[0];
      if (p && p.lat != null) W.vtSee(p.lng, p.lat, W.view() && document.querySelector("#sheethost .sheet") ? 432 : 0);
    }
    lastSel = sel;
    paint();
  };

  /* ---------- lit and open: the same classes on a card, its pin and its hop ---------- */
  function paint() {
    var c = canvas(),
      sel = W.sheetKey ? W.sheetKey() : "";
    if (!c) return;
    c.querySelectorAll(".vt-pin[data-keys]").forEach(function (el) {
      var ks = (el.getAttribute("data-keys") || "").split(" ");
      el.classList.toggle(
        "hi",
        ks.some(function (k) {
          return !!k && (hiKeys.indexOf(k) > -1 || k === hiLeg);
        })
      );
      el.classList.toggle("sel", !!sel && ks.indexOf(sel) > -1);
    });
    c.querySelectorAll(".vt-pin.vt-idea").forEach(function (el) {
      el.classList.toggle("hi", !!hiIdea && el.getAttribute("data-idea") === hiIdea);
    });
    document.querySelectorAll(".wrap .slot[data-slotkey]").forEach(function (el) {
      var k = el.getAttribute("data-slotkey") || "";
      el.classList.toggle("ws-hi", hiKeys.indexOf(k) > -1);
      el.classList.toggle("ws-sel", !!sel && k === sel);
    });
    document.querySelectorAll(".wrap .ws-leg[data-wsleg]").forEach(function (el) {
      el.classList.toggle("ws-hi", !!hiLeg && el.getAttribute("data-wsleg") === hiLeg);
    });
    document.querySelectorAll(".wrap .idea[data-wsidea]").forEach(function (el) {
      el.classList.toggle("ws-hi", !!hiIdea && el.getAttribute("data-wsidea") === hiIdea);
    });
    if (W.vtLegHi) W.vtLegHi(hiLeg);
  }
  W.deskPaint = paint;
  function set(keys, leg, idea) {
    if (keys.join(" ") === hiKeys.join(" ") && leg === hiLeg && idea === hiIdea) return;
    hiKeys = keys;
    hiLeg = leg;
    hiIdea = idea;
    paint();
  }
  /* what is under the pointer (or has the keyboard's focus): a card, a hop, an idea, a pin */
  function under(t) {
    if (!t || !t.closest || !W.deskSplit || !W.deskSplit()) return null;
    var pin = t.closest("#wsCanvas .vt-pin");
    if (pin) {
      if (pin.classList.contains("vt-idea")) return { keys: [], leg: "", idea: pin.getAttribute("data-idea") || "" };
      return { keys: (pin.getAttribute("data-keys") || "").split(" ").filter(Boolean), leg: "", idea: "" };
    }
    var leg = t.closest(".wrap .ws-leg[data-wsleg]");
    if (leg) return { keys: [], leg: leg.getAttribute("data-wsleg") || "", idea: "" };
    var card = t.closest(".wrap .slot[data-slotkey]");
    if (card) return { keys: [card.getAttribute("data-slotkey") || ""], leg: "", idea: "" };
    var idea = t.closest(".wrap .idea[data-wsidea]");
    if (idea) return { keys: [], leg: "", idea: idea.getAttribute("data-wsidea") || "" };
    return null;
  }
  ["mouseover", "focusin"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (!W.desk()) return;
      var u = under(/** @type {HTMLElement} */ (e.target));
      if (u) set(u.keys, u.leg, u.idea);
      else if (ev === "mouseover" && (hiKeys.length || hiIdea || (hiLeg && !(/** @type {HTMLElement} */ (e.target).closest("#wsCanvas")))))
        set([], "", "");
    });
  });
  document.addEventListener("mouseleave", function () {
    if (W.desk()) set([], "", "");
  });
  /* a pin: the stop opens beside the plan (not Google Maps in a new tab); an idea's pin finds its card */
  document.addEventListener(
    "click",
    function (e) {
      if (!W.desk()) return;
      var t = /** @type {HTMLElement | null} */ (e.target),
        pin = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("#wsCanvas .vt-pin")) : null;
      if (!pin || pin.classList.contains("home")) return;
      e.preventDefault();
      e.stopPropagation();
      if (pin.classList.contains("vt-idea")) {
        var card = document.querySelector('.wrap .idea[data-wsidea="' + esq(pin.getAttribute("data-idea") || "") + '"]');
        if (card) card.scrollIntoView({ block: "center", behavior: W.smooth ? W.smooth() : "auto" });
        return;
      }
      var k = (pin.getAttribute("data-keys") || "").split(" ").filter(Boolean)[0];
      if (!k) return;
      var c = document.querySelector('.wrap .slot[data-slotkey="' + esq(k) + '"]');
      if (c) c.scrollIntoView({ block: "nearest", behavior: W.smooth ? W.smooth() : "auto" });
      W.openStop(k);
    },
    true
  );
  /* a card's "Show on the map" */
  document.addEventListener(
    "click",
    function (e) {
      var t = /** @type {HTMLElement | null} */ (e.target),
        b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-wspin]")) : null;
      if (!b || !W.desk()) return;
      e.preventDefault();
      e.stopPropagation();
      var k = b.dataset.wspin || "",
        D = W.deskPts,
        p =
          D &&
          D.pts.filter(function (q) {
            return q.key === k;
          })[0];
      if (!W.wsPrefs.map) W.wsSet("map", 1);
      if (p && p.lat != null && W.vtSee) {
        W.vtSee(p.lng, p.lat, document.querySelector("#sheethost .sheet") ? 432 : 0);
        set([k], "", "");
      }
    },
    true
  );
})();
