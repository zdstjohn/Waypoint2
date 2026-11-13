/* Waypoint, near you (on Today): the ideas closest to where you are right now, things to do or food, each with the
   walk there and one tap for directions, and Add when a free part of today suits it. Where you are: your phone's
   location when you ask for it (the installed app; asked once, used on this phone only, never saved or sent), or else
   where the plan has you now (the stop you are at, or your stay). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  /** @type {{lat: number, lng: number, at: number, acc: number} | null} */
  var here = null;
  var state = { tab: "", busy: false, msg: "", more: false };
  var FAR = 2.5; /* km: what counts as near on foot; farther only when too little is that close */

  /* the phone's location: only outside Claude (the page Claude shows has no access to it) */
  function canLocate() {
    return !!(navigator.geolocation && (W.standalone || !(window.claude && window.claude.use)));
  }
  function locate() {
    if (!canLocate() || state.busy) return;
    state.busy = true;
    state.msg = "";
    W.changed();
    navigator.geolocation.getCurrentPosition(
      function (p) {
        state.busy = false;
        here = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy || 0, at: Date.now() };
        W.changed();
      },
      function (e) {
        state.busy = false;
        state.msg =
          e && e.code === 1
            ? "Location is turned off for this app. Showing ideas near where your plan has you."
            : "Couldn't find where you are just now. Showing ideas near where your plan has you.";
        W.changed();
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }
  /* a meal time now: food first */
  function mealNow(nm) {
    return (nm >= 450 && nm < 600) || (nm >= 690 && nm < 840) || (nm >= 1050 && nm < 1260);
  }
  function openNow(it, nm) {
    var h = it.hours;
    if (!h) return null;
    var wd = W.now().getDay();
    if (h.closed && h.closed.indexOf(wd) > -1) return false;
    if (h.o === 0 && h.c >= 1440) return true;
    return nm >= h.o && nm < h.c;
  }
  /* a free part of today, still ahead, that suits this kind of idea: its slot */
  function freeSlot(day, P, food, nm) {
    var T = W.dayTimes(day, P);
    if (!T) return null;
    var ok = food ? ["lunch", "dinner", "breakfast"] : ["am", "pm", "eve"],
      rows = T.rows;
    var x = (day.slots || []).filter(function (y) {
      var R = rows[y.slot];
      return !y.item && !y.rest && !y.loading && ok.indexOf(y.slot) > -1 && R && !R.skip && R.start != null && R.start >= nm - 15;
    })[0];
    return x ? { slot: x.slot, label: ((T.rows[x.slot] && T.rows[x.slot].label) || W.SLOT_NAME[x.slot]).toLowerCase() } : null;
  }
  /* the ideas near a point: closest first, open now where the hours are known, never one said no to or already planned
     today, not one marked unsuitable for the children */
  W.nearIdeas = function (day, P, at, food, nm) {
    var pools = [W.pool(day.country, day.city)];
    if (day.trip) pools.push(W.pool(day.trip.country || day.country, day.trip.name));
    var planned = {};
    (day.slots || []).forEach(function (y) {
      if (y.item) planned[W.norm(y.item.n)] = 1;
    });
    var seen = {},
      out = /** @type {{it: any, km: number, open: boolean | null, city: string, country: string}[]} */ ([]);
    pools.forEach(function (pl, pi) {
      var country = pi ? (day.trip && day.trip.country) || day.country : day.country,
        city = pi && day.trip ? day.trip.name : day.city;
      ((pl && (food ? pl.food : pl.spots)) || []).forEach(function (it) {
        var n = W.norm(it.n);
        if (!it || it.lat == null || seen[n] || planned[n] || W.gone(it) || W.isNope(country, city, it)) return;
        if (P.p.kid && it.k === -1) return;
        var o = openNow(it, nm);
        if (o === false) return;
        var km = W.km(at, it);
        if (km == null) return;
        seen[n] = 1;
        out.push({ it: it, km: km, open: o, city: city, country: country });
      });
    });
    out.sort(function (a, b) {
      return a.km - b.km;
    });
    var close = out.filter(function (x) {
      return x.km <= FAR;
    });
    return close.length >= 3
      ? close
      : out.filter(function (x) {
          return x.km <= FAR * 2.5;
        });
  };

  /** the card. ctx: where the plan has you now (from: a place with a pin, and its name), whether the day is under way */
  W.nearCard = function (day, P, ctx) {
    if (W.readOnly || !day) return "";
    var nm = ctx.nm,
      food = state.tab ? state.tab === "food" : mealNow(nm),
      useHere = !!here && Date.now() - here.at < 20 * 60000,
      at = useHere ? here : ctx.from && ctx.from.lat != null ? ctx.from : null;
    var where = useHere
      ? "Near you" + (here && here.acc > 300 ? " (roughly)" : "")
      : ctx.from && ctx.from.lat != null
        ? "Near " + (ctx.from.n || (ctx.from.none ? "the middle of " + day.city : ctx.from.label || day.city))
        : "";
    var list = at ? W.nearIdeas(day, P, at, food, nm) : [],
      n = state.more ? 8 : 4,
      slot = W.canEdit() ? freeSlot(day, P, food, nm) : null;
    var tab = function (k, label) {
      return (
        '<button type="button" class="chip" data-neartab="' +
        k +
        '" aria-pressed="' +
        ((k === "food") === food) +
        '">' +
        label +
        "</button>"
      );
    };
    var rows = list
      .slice(0, n)
      .map(function (x) {
        var it = x.it,
          lg = W.legEst(at, it),
          kind = food ? [it.cuisine, it.price].filter(Boolean).join(" · ") : W.stayText ? W.stayText(it, false, "pm") : "";
        return (
          '<li class="nr"><div class="nr-a"><b>' +
          esc(it.n) +
          '</b><span class="small muted">' +
          esc([W.fmtKm(x.km), lg ? W.fmtMin(lg.min) + " " + lg.label : "", x.open ? "open now" : "", kind].filter(Boolean).join(" · ")) +
          "</span></div>" +
          '<div class="nr-b">' +
          (slot
            ? '<button type="button" class="btn quiet sm" data-nearadd="' +
              slot.slot +
              '" data-name="' +
              esc(it.n) +
              '" aria-label="Add ' +
              esc(it.n) +
              " for " +
              esc(slot.label) +
              '">Add</button>'
            : "") +
          '<a class="btn quiet sm nr-go" href="' +
          esc(W.gmapsDir(useHere || (ctx.from && ctx.from.none) ? null : at, it, lg ? lg.mode : "walking")) +
          '" target="_blank" rel="noopener" aria-label="Directions to ' +
          esc(it.n) +
          '">' +
          W.icon("dir", 2.2) +
          "Directions</a></div></li>"
        );
      })
      .join("");
    return (
      '<section class="go-near sk" aria-labelledby="nearH"><div class="gn-h"><h3 id="nearH">' +
      esc(where || "Ideas nearby") +
      "</h3>" +
      (canLocate()
        ? '<button type="button" class="chip gn-loc" data-nearme="1"' +
          (state.busy ? " disabled" : "") +
          ">" +
          W.icon("pin", 2.1) +
          (state.busy ? "Finding you…" : useHere ? "Update" : "Use my location") +
          "</button>"
        : "") +
      "</div>" +
      '<div class="gn-tabs" role="group" aria-label="Show">' +
      tab("do", "Things to do") +
      tab("food", "Food") +
      "</div>" +
      (state.msg ? '<p class="small muted" role="status">' + esc(state.msg) + "</p>" : "") +
      (!canLocate() && !useHere
        ? '<p class="small muted gn-note">Near where your plan has you now. In the installed app, this can use your phone\'s location.</p>'
        : useHere
          ? '<p class="small muted gn-note">Your location is used on this phone only, and not kept.</p>'
          : "") +
      (rows
        ? '<ul class="near-l">' + rows + "</ul>"
        : '<p class="small muted">' +
          (at
            ? "Nothing " + (food ? "to eat" : "to do") + " on your list close by. Explore has every idea for " + esc(day.city) + "."
            : "") +
          "</p>") +
      (slot && rows ? '<p class="small muted gn-note">Add puts it in your free ' + esc(slot.label) + " today.</p>" : "") +
      (list.length > n ? '<button type="button" class="linkish" data-nearmore="1">Show more nearby</button>' : "") +
      "</section>"
    );
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement | null} */ (e.target),
      b =
        t && t.closest
          ? /** @type {HTMLElement | null} */ (t.closest("[data-nearme],[data-neartab],[data-nearadd],[data-nearmore]"))
          : null;
    if (!b) return;
    var d = b.dataset;
    if (d.nearme) return locate();
    if (d.neartab) {
      state.tab = d.neartab;
      state.more = false;
    } else if (d.nearmore) state.more = true;
    else if (d.nearadd && d.name && W.P) {
      var P = W.P,
        day = P.days[(W.S.day || 1) - 1],
        before = JSON.stringify(W.syncable(W.S));
      if (!day) return;
      W.useIdea(day, d.nearadd, d.name, P);
      W.save();
      if (W.undoPoint) W.undoPoint(before, "Added " + d.name);
    }
    W.changed();
  });
})();
