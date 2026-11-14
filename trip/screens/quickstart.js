/* Waypoint, quick start: the three questions for a new trip (where, when, who), as a sheet over the page. It opens
   on the very first visit over the example trip, and from "New trip". Part of the second script: W.quickStart
   (screens/flow.js) asks for it and opens it when it has come. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    $ = W.$;
  var XI =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  /** @type {any} */
  var qs = { open: false, adults: 2, kids: [], msg: "" };
  W.qsOpen = function (first) {
    var S = W.S,
      ages = W.ages().filter(function (a) {
        return a >= 0;
      }); /* (W.ages leaves out an age not filled in: Number("") would be a baby) */
    var grown = ages.filter(function (a) {
      return a >= 18;
    });
    qs = {
      open: true,
      first: !!first,
      adults: Math.max(1, grown.length || 2),
      grown: grown,
      kids: ages.filter(function (a) {
        return a < 18;
      }),
      msg: ""
    };
    drawQS();
    setTimeout(function () {
      var f = $("qsWhere");
      if (f) f.focus();
    }, 60);
  };
  function drawQS() {
    var host = $("qshost");
    if (!host) {
      host = document.createElement("div");
      host.id = "qshost";
      document.body.appendChild(host);
    }
    if (!qs.open) {
      host.innerHTML = "";
      document.documentElement.classList.remove("modal-open");
      W.backShut("qs");
      return;
    }
    var keep = {};
    ["qsWhere", "qsCities", "qsStart", "qsDays", "qsFrom"].forEach(function (id) {
      var e = $(id);
      if (e) keep[id] = e.value;
    });
    var start = keep.qsStart != null ? keep.qsStart : "",
      days = keep.qsDays != null ? keep.qsDays : "10",
      from = keep.qsFrom != null ? keep.qsFrom : W.S.depart || "";
    host.innerHTML =
      '<div class="sheet-back" data-qs="close"></div><div class="qs sheet" role="dialog" aria-modal="true" aria-labelledby="qsT">' +
      '<div class="sh-top"><h2 id="qsT">' +
      (qs.first ? "Where are you headed?" : "Plan a new trip") +
      '</h2><button type="button" class="icon-btn" data-qs="close" aria-label="Close">' +
      XI +
      "</button></div>" +
      '<p class="small muted">' +
      (qs.first
        ? "Waypoint plans family trips around naps, little legs and grandparents\' pace. Three quick questions and you\'ll have a day-by-day plan; everything can be changed afterwards."
        : "Three quick questions. You can fine-tune everything afterwards.") +
      "</p>" +
      '<label class="fld"><span>Where to?</span><input class="field" id="qsWhere" data-ta="country" autocomplete="off" placeholder="A country, e.g. Greece" value="' +
      esc(keep.qsWhere || "") +
      '"></label>' +
      (W.standalone && !W.cloud
        ? '<p class="small muted sa-note">This version plans trips to ' + esc(W.builtInCountries()) + ".</p>"
        : "") +
      '<label class="fld"><span>Places <em>(optional)</em></span><input class="field" id="qsCities" placeholder="Leave empty and we\'ll pick, or e.g. Chania, Naxos Town" value="' +
      esc(keep.qsCities || "") +
      '"></label>' +
      '<div class="fld"><span>When?</span><div class="qs-when"><input class="field" id="qsStart" type="date" value="' +
      esc(start) +
      '" aria-label="Start date"><span class="muted">for</span>' +
      '<input class="field" id="qsDays" type="number" min="2" max="60" value="' +
      esc(days) +
      '" aria-label="Number of days"><span class="muted">days</span></div></div>' +
      '<div class="fld"><span>Who\'s going?</span><div class="qs-who"><div class="stepper"><button type="button" data-qs="a-" aria-label="One adult fewer"' +
      (qs.adults <= 1 ? " disabled" : "") +
      ">−</button><b>" +
      qs.adults +
      '</b><button type="button" data-qs="a+" aria-label="One more adult">+</button></div><span class="muted">adult' +
      (qs.adults > 1 ? "s" : "") +
      "</span></div>" +
      '<div class="qs-kids">' +
      qs.kids
        .map(function (a, i) {
          return (
            '<span class="kid"><input class="field" type="number" min="0" max="17" value="' +
            esc(a) +
            '" data-qskid="' +
            i +
            '" aria-label="Age of child ' +
            (i + 1) +
            '"><span class="muted">yrs</span><button type="button" class="icon-btn" data-qs="k-' +
            i +
            '" aria-label="Remove child ' +
            (i + 1) +
            '">' +
            XI +
            "</button></span>"
          );
        })
        .join("") +
      '<button type="button" class="btn quiet sm" data-qs="k+">+ Add a child</button></div></div>' +
      '<label class="fld"><span>Flying from</span><input class="field" id="qsFrom" data-ta="airport" autocomplete="off" placeholder="Your home city or airport" value="' +
      esc(from) +
      '"></label>' +
      (qs.msg ? '<p class="warn" role="alert">' + esc(qs.msg) + "</p>" : "") +
      '<div class="qs-go"><button type="button" class="btn" data-qs="go">Plan my trip</button><button type="button" class="linkish" data-qs="' +
      (qs.first ? "close" : "slow") +
      '">' +
      (qs.first ? "Look around the example trip first" : "Set it up step by step instead") +
      "</button>" +
      /* the installable version, signed out: the way back to signing in (also in Settings) */
      (W.standalone && !W.cloud && /** @type {any} */ (window).__WP_CLOUD
        ? '<p class="small muted qs-acct">Invited to Waypoint? <button type="button" class="linkish" data-acct="in">Sign in</button></p>'
        : "") +
      "</div></div>";
    document.documentElement.classList.add("modal-open");
    W.backOpen("qs", W.qsClose);
  }
  function qsKids() {
    document.querySelectorAll("[data-qskid]").forEach(function (e) {
      var v = Math.round(Number(e.value));
      qs.kids[Number(e.dataset.qskid)] = isFinite(v) ? Math.max(0, Math.min(17, v)) : 6;
    });
  }
  function qsGo() {
    qsKids();
    var c = W.countryName ? W.countryName(($("qsWhere") || {}).value || "") : (($("qsWhere") || {}).value || "").trim();
    if (!c) {
      qs.msg = "Pick a country from the list.";
      drawQS();
      return;
    }
    var typed = (($("qsCities") || {}).value || "")
      .split(/[,;]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    /* an island is not a place to stay: say which towns it has, and wait for one */
    var isle = typed
      .map(function (x) {
        return W.isleChoice(c, x);
      })
      .filter(function (x) {
        return x && x.towns.length;
      })[0];
    if (isle) {
      var tn = isle.towns.slice(0, 3).map(function (t) {
        return t.name;
      });
      qs.msg =
        isle.isle +
        (isle.group ? " covers more than one place." : " is a whole island.") +
        " Name a town there instead, such as " +
        (tn.length > 1 ? tn.slice(0, -1).join(", ") + " or " + tn[tn.length - 1] : tn[0]) +
        ".";
      drawQS();
      var qc = $("qsCities");
      if (qc) qc.focus();
      return;
    }
    var cities = typed.map(function (x) {
      var k = W.findCity(c, x);
      return k
        ? k.name
        : x.replace(/\b\w/g, function (m) {
            return m.toUpperCase();
          });
    });
    var days = Math.max(2, Math.min(60, Math.round(Number(($("qsDays") || {}).value)) || 10)),
      start = ($("qsStart") || {}).value || "",
      from = (($("qsFrom") || {}).value || "").trim();
    var trav = [];
    for (var i = 0; i < qs.adults; i++) trav.push((qs.grown || [])[i] || 35);
    trav = trav.concat(qs.kids);
    var S = W.S;
    qs.open = false;
    drawQS();
    W.newTripFrom({
      v: 2,
      algo: 2,
      styles: (S.styles || []).slice(),
      focus: S.focus,
      countries: [{ name: c, mode: cities.length ? "manual" : "suggest", picked: cities, rank: 2 }],
      days: days,
      start: start,
      depart: from,
      travelers: trav,
      stays: {},
      picks: {},
      seen: {},
      mine: {},
      cityDays: {},
      tripName: ""
    });
    W.loadCountry(c);
    W.setView("trip");
    W.render();
    window.scrollTo(0, 0);
  }
  function qsClick(b) {
    var a = b.dataset.qs;
    if (a === "close") {
      qs.open = false;
      drawQS();
      return;
    }
    if (a === "slow") {
      qs.open = false;
      drawQS();
      if (W.newTripBlank) W.newTripBlank();
      W.render();
      return;
    }
    if (a === "go") return qsGo();
    qsKids();
    if (a === "a+") qs.adults = Math.min(12, qs.adults + 1);
    else if (a === "a-") qs.adults = Math.max(1, qs.adults - 1);
    else if (a === "k+") {
      qs.kids.push(5);
      drawQS();
      var ks = document.querySelectorAll("[data-qskid]");
      if (ks.length) ks[ks.length - 1].focus();
      return;
    } else if (a.indexOf("k-") === 0) qs.kids.splice(+a.slice(2), 1);
    drawQS();
  }
  W.qsIsOpen = function () {
    return !!qs.open;
  };
  /** close it (Escape, Back): true when it was open */
  W.qsClose = function () {
    if (!qs.open) return false;
    qs.open = false;
    drawQS();
    return true;
  };
  /* its buttons (before the views' own handlers) and the children's ages as they are typed */
  document.addEventListener(
    "click",
    function (e) {
      var t = /** @type {HTMLElement | null} */ (e.target),
        b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("button[data-qs]")) : null;
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      qsClick(b);
    },
    true
  );
  document.addEventListener("input", function (e) {
    var t = /** @type {HTMLElement | null} */ (e.target);
    if (t && t.dataset && t.dataset.qskid != null) qsKids();
  });
  /* ---------- the tour (v191): three screens for someone opening a shared trip for the first time ---------- */
  var TOUR = [
    {
      k: "Trip",
      h: "See the plan, day by day",
      t: "Each day lists its stops in order, with times and the walk or drive between them. Tap any stop for its photo, opening hours, tickets and directions.",
      i: "trip"
    },
    {
      k: "Today",
      h: "On the day, open Today",
      t: "Today shows what is next, how long it takes to get there, and ideas for food or things to do close to where you are. A phone's location is only used when you ask for it.",
      i: "sun"
    },
    {
      k: "Phone",
      h: "Keep it on your phone",
      t: "Add Waypoint to your home screen and it opens like an app, and the days you have opened still work with no signal.",
      i: "dir"
    }
  ];
  var tour = { open: false, n: 0 };
  function drawTour() {
    var host = $("tourhost");
    if (!host) {
      host = document.createElement("div");
      host.id = "tourhost";
      document.body.appendChild(host);
    }
    if (!tour.open) {
      host.innerHTML = "";
      document.documentElement.classList.remove("modal-open");
      W.backShut("tour");
      return;
    }
    var s = TOUR[tour.n],
      last = tour.n === TOUR.length - 1;
    host.innerHTML =
      '<div class="sheet-back" data-tour="close"></div><div class="qs tour sheet" role="dialog" aria-modal="true" aria-labelledby="tourT">' +
      '<div class="sh-top"><span class="small muted">' +
      (tour.n + 1) +
      " of " +
      TOUR.length +
      '</span><button type="button" class="icon-btn" data-tour="close" aria-label="Close the tour">' +
      XI +
      "</button></div>" +
      '<div class="tour-pic" aria-hidden="true">' +
      W.icon(s.i, 2.2) +
      '</div><h2 id="tourT">' +
      esc(s.h) +
      '</h2><p class="tour-t">' +
      esc(s.t) +
      '</p><div class="tour-dots" aria-hidden="true">' +
      TOUR.map(function (x, i) {
        return '<i class="' + (i === tour.n ? "on" : "") + '"></i>';
      }).join("") +
      '</div><div class="qs-go"><button type="button" class="btn" data-tour="' +
      (last ? "close" : "next") +
      '">' +
      (last ? "Got it" : "Next") +
      "</button>" +
      (last ? "" : '<button type="button" class="linkish" data-tour="close">Skip</button>') +
      "</div></div>";
    document.documentElement.classList.add("modal-open");
    W.backOpen("tour", W.tourClose);
  }
  W.tourOpen = function () {
    tour = { open: true, n: 0 };
    drawTour();
  };
  W.tourClose = function () {
    if (!tour.open) return false;
    tour.open = false;
    try {
      localStorage.setItem("waypoint-tour-seen", "1");
    } catch (e) {
      /* no storage: the tour may show again on a later visit, which is harmless */
    }
    drawTour();
    return true;
  };
  /** opens once on this phone, the first time a shared trip is opened (never over the new-trip sheet) */
  W.tourMaybe = function () {
    try {
      if (localStorage.getItem("waypoint-tour-seen") || qs.open || tour.open) return;
    } catch (e) {
      return;
    }
    W.tourOpen();
  };
  document.addEventListener(
    "click",
    function (e) {
      var t = /** @type {HTMLElement | null} */ (e.target),
        b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-tour]")) : null;
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (b.dataset.tour === "next") {
        tour.n = Math.min(TOUR.length - 1, tour.n + 1);
        drawTour();
      } else W.tourClose();
    },
    true
  );
})();
