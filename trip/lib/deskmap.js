/* Waypoint's desktop workspace, part 3: the map pane, and the tie between the map and the list (second script).
   While you look at days (the itinerary, Explore, Today) the street map stays beside them: the day's stops as
   lettered pins that stay on their spots at every zoom (no lines between them: the list gives each hop's real way and
   time), and on Explore the ideas as small pins. A card and its pin light each other up under the pointer, a hop in
   the list lights the two pins it joins; a click on a pin opens the stop beside the plan. A city with no street map shows the day's route as a list instead, with the way
   to Google Maps (never a sketch). The map itself is lib/vtmap.js's one map, moved into this pane; the screens say
   what is on the day (W.deskPts: screens/trip.js, screens/travel.js; W.deskIdeas), this file only shows it. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var hiKeys = /** @type {string[]} */ ([]),
    hiLeg = "",
    /** a hop in the list -> the two pins it joins (where you were, where it goes; "home" for where you stay) */
    ends = /** @type {Record<string, string[]>} */ ({}),
    hiIdea = "",
    lastSel = "";
  function canvas() {
    return W.wsEl("wsCanvas");
  }
  function esq(v) {
    return String(v).replace(/["\\]/g, "\\$&");
  }
  /* a day's stops in order when no screen has said: the plan's own order */
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
      fresh = D && D.n === n && D.country === day.country && D.city === day.city && !!D.go === (v === "go");
    if (!fresh || !D) {
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
      /* (every stop of the day, for the list shown where there is no street map: on a day out the map has only the
         stops out there) */
      all: (D.all || D.pts).filter(function (p) {
        return !(p.food ? hide.food : hide.sight);
      }),
      /* (a day out far away: the map of where you go or none, never the home town's: W.vtForDay) */
      slug: D.slug || (W.vtForDay ? W.vtForDay(day, D.home, D.pts).slug : null)
    };
  }
  /** each hop's two ends, by the key of the stop it goes to @param {any[]} pts @param {any} home */
  function endsOf(pts, home) {
    var out = /** @type {Record<string, string[]>} */ ({}),
      prev = home && home.lat != null ? "home" : "";
    pts.forEach(function (p) {
      if (p.lat == null || p.gpin || !p.key) return;
      if (prev) out[p.key] = [prev, p.key];
      prev = p.key;
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
      when = dt ? W.fmtDate(dt, "wmd") : "";
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
      var gm = w.all.length && W.dayRouteUrl ? W.dayRouteUrl(w.day, w.all, w.D.home || W.homebase(w.day.country, w.day.city)) : "";
      wrap.hidden = true;
      empty.hidden = false;
      c.classList.add("nomap"); /* (no map: no zoom buttons, no map credit) */
      W.draw(
        empty,
        "<div><h3>" +
          (finding ? "Looking for the street map…" : "No street map for " + esc(w.D.place || w.day.city) + " yet") +
          "</h3>" +
          (finding
            ? ""
            : '<p class="small muted">Waypoint has street maps for the places most people go, and adds more each night. Here is the day in order.</p>') +
          (w.all.length
            ? "<ol>" +
              w.all
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
        animate: false /* (a new day is shown at once: pins never glide across the map) */,
        city: w.day.city
      });
    wrap.classList.toggle("vt-on", !!ok);
    wrap.classList.toggle("vt-want", !ok);
    if (!ok) return;
    W.vt.onPins = paint;
    ends = endsOf(w.pts, w.D.home);
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

  /* ---------- lit and open: the same classes on a card and its pin, a hop and its two pins ---------- */
  function paint() {
    var c = canvas(),
      sel = W.sheetKey ? W.sheetKey() : "";
    if (!c) return;
    c.querySelectorAll(".vt-pin[data-keys]").forEach(function (el) {
      var ks = W.pinKeys(el);
      el.classList.toggle(
        "hi",
        ks.some(function (k) {
          return hiKeys.indexOf(k) > -1;
        })
      );
      el.classList.toggle("sel", !!sel && ks.indexOf(sel) > -1);
    });
    c.querySelectorAll(".vt-pin.vt-idea").forEach(function (el) {
      el.classList.toggle("hi", !!hiIdea && el.getAttribute("data-idea") === hiIdea);
    });
    /* a way between two stops lights its two pins on the map, not the stops in the list (only what is under the pointer glows there) */
    document.querySelectorAll(".wrap .slot[data-slotkey]").forEach(function (el) {
      var k = el.getAttribute("data-slotkey") || "";
      el.classList.toggle("ws-hi", !hiLeg && hiKeys.indexOf(k) > -1);
      el.classList.toggle("ws-sel", !!sel && k === sel);
    });
    document.querySelectorAll(".wrap .ws-leg[data-wsleg]").forEach(function (el) {
      el.classList.toggle("ws-hi", !!hiLeg && el.getAttribute("data-wsleg") === hiLeg);
    });
    document.querySelectorAll(".wrap .idea[data-wsidea]").forEach(function (el) {
      el.classList.toggle("ws-hi", !!hiIdea && el.getAttribute("data-wsidea") === hiIdea);
    });
  }
  function set(keys, leg, idea) {
    if (keys.join("\n") === hiKeys.join("\n") && leg === hiLeg && idea === hiIdea) return;
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
      return { keys: W.pinKeys(pin), leg: "", idea: "" };
    }
    var leg = t.closest(".wrap .ws-leg[data-wsleg]");
    if (leg) {
      var id = leg.getAttribute("data-wsleg") || "";
      return { keys: ends[id] || [], leg: id, idea: "" };
    }
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
      else if (ev === "mouseover" && (hiKeys.length || hiIdea || hiLeg)) set([], "", "");
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
      var k = W.pinKeys(pin)[0];
      if (!k) return;
      var c = document.querySelector('.wrap .slot[data-slotkey="' + esq(k) + '"]');
      if (c) c.scrollIntoView({ block: "nearest", behavior: W.smooth ? W.smooth() : "auto" });
      W.openStop(k);
    },
    true
  );
})();
