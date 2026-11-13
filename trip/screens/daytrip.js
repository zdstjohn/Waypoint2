/* Waypoint, a day trip day. "Make it a day trip" at the end of a full day in a place opens this sheet: the places
   within an easy day out of it (from the country's list: towns, and the parks, coasts and lakes the planner keeps
   out of stays), each with what it is and about how long it takes, and a box for anywhere else. Picking one makes
   that day a day trip (S.dayTrip["<country>|<city>|<day in the city>"] = {country, name, lat, lng, min}): the
   planner's own picks for the day are dropped and the day is planned again, the morning, lunch and afternoon from
   the place's ideas, the evening back near the stay (lib/plan.js, the same as the day trips it plans itself). Undo
   puts the day back; so does "Undo day trip" under it. Part of the second script. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  /** @type {number | null} */ var openN = null;
  var drawn = "",
    /** @type {HTMLElement | null} */ opener = null,
    /** @type {any[]} */ shown = [];

  function dayOf(n) {
    return W.P && W.P.days[n - 1];
  }
  /* the places within an easy day out: not on the trip already, not the town itself, within the group's day-trip
     range (a little over, for a famous one), the best known first */
  function candidates(day) {
    var P = W.P,
      base = W.P.stops[day.stop] ? W.stopAt(W.P.stops[day.stop]) : null,
      max = W.dayTripMax(P.p),
      onTrip = /** @type {Record<string, number>} */ ({});
    P.stops.forEach(function (s) {
      onTrip[W.norm(s.name)] = 1;
    });
    if (!base || base.lat == null) return [];
    return W.countryCities(day.country)
      .filter(function (c) {
        return c && c.lat != null && !c.whole && !onTrip[W.norm(c.name)];
      })
      .map(function (c) {
        var min = Math.round(W.guessLeg(W.km(base, c)));
        return { c: c, min: min, score: (c.pop || 3) * 2 + (W.dayTrip(c) ? 2 : 0) - min / 30 };
      })
      .filter(function (x) {
        return x.min >= 15 && x.min <= max * ((x.c.pop || 3) >= 5 ? 1.3 : 1);
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 8);
  }
  function aboutTime(min) {
    return "about " + W.fmtMin(Math.max(15, Math.round(min / 15) * 15)) + " each way"; /* (as the day's header says it) */
  }
  function html() {
    var day = openN != null ? dayOf(openN) : null;
    if (!day) return "";
    shown = candidates(day);
    var rows = shown
      .map(function (x, i) {
        return (
          '<button type="button" class="sh-out-r" data-dtpick="' +
          i +
          '"><span class="ic">' +
          W.icon("trip", 2.2) +
          "</span><span><b>" +
          esc(x.c.name) +
          '</b><span class="small muted">' +
          esc([x.c.d || "", aboutTime(x.min)].filter(Boolean).join(" · ")) +
          "</span></span></button>"
        );
      })
      .join("");
    return (
      '<div class="sheet-back" data-dtclose="1"></div><div class="sheet dt-sheet" role="dialog" aria-modal="' +
      (W.desk() ? "false" : "true") +
      '" tabindex="-1" aria-label="A day trip from ' +
      esc(day.city) +
      '"><div class="grab" aria-hidden="true"></div><div class="sh-top"><div><b>A day trip from ' +
      esc(day.city) +
      '</b><span class="small muted">Day ' +
      day.n +
      " · planned again for the place you pick</span></div>" +
      '<button type="button" class="icon-btn" data-dtclose="1" aria-label="Close">' +
      W.icon("close", 2) +
      "</button></div>" +
      (rows
        ? '<div class="sh-out">' + rows + "</div>"
        : '<p class="small muted">No place in ' +
          esc(day.country) +
          "'s list is an easy day out from " +
          esc(day.city) +
          ". Name one below.</p>") +
      '<label class="fld" for="dtIn"><span>Somewhere else</span></label><div class="row"><input class="field" id="dtIn" data-ta="city" data-tac="' +
      esc(day.country) +
      '" data-tago="dtGo" autocomplete="off" maxlength="60" placeholder="A town or a park near ' +
      esc(day.city) +
      '"><button type="button" class="btn" id="dtGo" data-dtgo="1">Go</button></div>' +
      '<p class="small muted">Lunch is planned there; dinner and the evening stay near your ' +
      esc(day.city) +
      " stay. Undo puts Day " +
      day.n +
      " back.</p></div>"
    );
  }
  function draw() {
    var host = document.getElementById("dthost");
    if (!host) {
      host = document.createElement("div");
      host.id = "dthost";
      document.body.appendChild(host);
    }
    var h = html();
    if (!h) {
      openN = null;
      drawn = "";
      host.innerHTML = "";
      if (!document.querySelector("#sheethost .sheet, #stayhost .sheet, #qshost .sheet"))
        document.documentElement.classList.remove("modal-open");
      W.backShut("daytrip");
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      opener = null;
      return;
    }
    if (h === drawn) return;
    var first = !drawn,
      box = host; /* (found or made above) */
    drawn = h;
    W.keepInputs(box, function () {
      box.innerHTML = h;
      var s = /** @type {HTMLElement | null} */ (box.querySelector(".sheet"));
      if (s && first) s.focus({ preventScroll: true });
    });
    document.documentElement.classList.add("modal-open");
    W.backOpen("daytrip", close);
  }
  function close() {
    if (openN == null) return false;
    openN = null;
    draw();
    return true;
  }
  /** open the choice for day n */
  W.dayTripOpen = function (n) {
    if (W.closeTripMenu) W.closeTripMenu();
    opener = /** @type {HTMLElement | null} */ (document.activeElement);
    openN = n;
    drawn = "";
    draw();
  };
  /* the day becomes a day trip to this place: the planner's picks for it go, yours stay */
  function choose(place) {
    var day = dayOf(/** @type {number} */ (openN)),
      S = W.S;
    var name = String((place && place.name) || "")
      .trim()
      .slice(0, 60);
    if (!day || !name) return;
    var before = W.snapState ? W.snapState() : null,
      rk = W.restKey(day),
      known = place.lat != null ? place : W.findCity(day.country, name),
      base = W.P.stops[day.stop] ? W.stopAt(W.P.stops[day.stop]) : null;
    (S.dayTrip || (S.dayTrip = {}))[rk] = {
      country: day.country,
      name: (known && known.name) || name,
      lat: known && known.lat != null ? known.lat : null,
      lng: known && known.lng != null ? known.lng : null,
      min: known && known.lat != null && base ? Math.round(W.guessLeg(W.km(base, known))) : null
    };
    if (S.rest) delete S.rest[rk]; /* (a day trip is not a rest day) */
    var mine = S.mine || {};
    day.slots.forEach(function (x) {
      if (!mine[x.key]) delete S.picks[x.key];
    });
    if (W.realChange) W.realChange();
    close();
    if (W.undoPoint) W.undoPoint(before, "Day " + day.n + " is a day trip to " + S.dayTrip[rk].name);
    W.changed();
    W.render();
  }
  document.addEventListener(
    "click",
    function (e) {
      if (openN == null) return;
      var t = /** @type {HTMLElement | null} */ (e.target);
      if (!t || !t.closest || !t.closest("#dthost")) return;
      var b = /** @type {HTMLElement | null} */ (t.closest("[data-dtclose],[data-dtpick],[data-dtgo]"));
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (b.dataset.dtclose) close();
      else if (b.dataset.dtpick != null) {
        var x = shown[+b.dataset.dtpick];
        if (x) choose(x.c);
      } else if (b.dataset.dtgo) {
        var inp = /** @type {HTMLInputElement | null} */ (document.getElementById("dtIn"));
        if (inp && inp.value.trim()) choose({ name: inp.value });
      }
    },
    true
  );
  document.addEventListener("keydown", function (e) {
    if (openN == null) return;
    if (e.key === "Escape") close();
    else if (e.key === "Enter" && e.target && /** @type {HTMLElement} */ (e.target).id === "dtIn") {
      var v = /** @type {HTMLInputElement} */ (e.target).value.trim();
      if (v) {
        e.preventDefault();
        choose({ name: v });
      }
    }
  });
})();
