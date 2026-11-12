/* Waypoint: "Check my plan" (second script).
   One button at the end of Plan (and in the trip menu): Claude reads the whole trip as it is planned here (every day's stops
   with their times, how far apart they are, what is indoors, what closes when, naps, tickets, travel days) and lists
   the real problems, each with a way to fix it and a way to open that day. It only reads: nothing in the plan changes.
   The answer is kept on this phone with a fingerprint of the plan, so the card can say when the plan has moved on. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var KINDS = {
    walk: "A lot on foot",
    closed: "May be closed",
    nap: "Nap",
    book: "Book ahead",
    pace: "Pace",
    meal: "Meals",
    travel: "Travel day",
    other: "Worth a look"
  };
  var WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var mem = null,
    memId = "";
  function sk() {
    return "waypoint-review|" + (W.S.tripId || "t");
  }
  function saved() {
    if (memId === sk()) return mem;
    memId = sk();
    mem = null;
    try {
      var v = JSON.parse(localStorage.getItem(sk()) || "null");
      if (v && Array.isArray(v.issues)) mem = v;
    } catch (e) {}
    return mem;
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  /** the plan as Claude is shown it @param {Plan} P */
  W.reviewFacts = function (P) {
    var kd = W.kidDinner();
    return P.days.map(function (day) {
      var T = day.slots && day.slots.length ? W.dayTimes(day, P) : null,
        E = T && W.dayEnergy ? W.dayEnergy(day, P, T) : null,
        dt = W.dateOf(day.n),
        home = W.homebase(day.country, day.city);
      /** @type {Record<string, any>} */ var o = { day: day.n, city: day.city };
      if (dt) {
        o.date = W.isoDay(dt);
        o.weekday = WD[dt.getDay()];
      }
      if (day.moveFrom)
        o.travel = day.moveFrom + " to " + day.city + (T && T.travel ? " " + W.clock(T.travel.start) + "-" + W.clock(T.travel.end) : "");
      if (day.trip) o.day_trip_to = day.trip.name;
      if (day.rest) o.rest_day = true;
      if (day.jet) o.jet_lag = true;
      if (T && T.nap) o.nap = W.clock(T.nap.start) + "-" + W.clock(T.nap.end) + (T.nap.away ? " (on the go)" : " (at the lodging)");
      if (E) {
        o.km_on_foot = E.walk;
        o.load = E.label;
      }
      var hol = W.dayHolidays ? W.dayHolidays(day) : [];
      if (hol && hol.length)
        o.public_holiday = hol
          .map(function (/** @type {any} */ h) {
            return h.name || h.n || String(h);
          })
          .join(", ");
      o.stops = !T
        ? []
        : (T.order || [])
            .map(function (sl) {
              var x = day.slots.filter(function (y) {
                  return y.slot === sl;
                })[0],
                R = T.rows[sl],
                it = x && x.item;
              if (!it || !R || R.skip || R.start == null) return null;
              var food = W.isFood(sl);
              /** @type {Record<string, any>} */ var s = { slot: sl, from: W.clock(R.start), to: W.clock(R.end), name: it.n };
              if (!food) {
                var c = W.classify(it, false);
                s.indoor = !!c.indoor;
                s.effort = c.intensity;
                if (c.kind) s.kind = c.kind;
              }
              if (it.lat != null && home && home.lat != null) s.km_from_lodging = Math.round((W.km(home, it) || 0) * 10) / 10;
              if (it.hours && it.hours.o != null) {
                s.open = W.clock(it.hours.o) + "-" + W.clock(it.hours.c);
                if (it.hours.closed && it.hours.closed.length)
                  s.closed_on = it.hours.closed
                    .map(function (/** @type {number} */ d) {
                      return WD[d];
                    })
                    .join(", ");
              }
              if (W.badForDay(it, W.weekday(day.n), sl, kd) || (W.holidayShut && W.holidayShut(it, day))) s.looks_closed_then = true;
              var e = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
              if (it.ticket) s.needs_ticket = true;
              if (it.lead) s.book_days_ahead = it.lead;
              if (e && e.done) s.booked = true;
              return s;
            })
            .filter(Boolean);
      return o;
    });
  };
  /** @param {Plan} P */
  W.reviewSig = function (P) {
    return hash(JSON.stringify(W.reviewFacts(P)) + "|" + W.ages().join(","));
  };
  /** @param {Plan} P @param {Record<string, any>[]} facts */
  function prompt(P, facts) {
    var ages = W.ages(),
      kids = ages.filter(function (a) {
        return a < 18;
      }),
      old = ages.filter(function (a) {
        return a >= 65;
      }).length;
    return (
      "Check this family trip plan for real problems before they travel. You are a careful friend who has done this trip with small children.\n" +
      "Travelers: " +
      ages.filter(function (a) {
        return a >= 18;
      }).length +
      " adults" +
      (old ? " (" + old + " aged 65 or over)" : "") +
      (kids.length ? ", children aged " + kids.join(", ") : ", no children") +
      ". Today is " +
      W.isoDay(W.now()) +
      ".\n" +
      "The plan, day by day. effort runs 0 (sit down) to 3 (strenuous); km_on_foot is the day's walking between stops; looks_closed_then means the plan's own data says the place is shut at that time.\n" +
      "DATA:" +
      JSON.stringify(facts) +
      "\n" +
      'Look for: too much walking or too many big stops for the youngest or oldest traveler; a place that is closed on its day (from the data, or a closing day you are sure of, such as a museum\'s weekly closing day; say "check" when it comes from your own knowledge); ' +
      "dinner or an outing running into a small child's nap or bedtime; tickets that sell out and are not marked booked, most urgent first; a heavy day straight after a travel day or jet lag; a day with no real meal stop; outdoor stops stacked in the hottest hours.\n" +
      "Only real problems this family would thank you for; none is a fine answer. At most 8, most important first. Name the place. Give one concrete fix each, in the plan's own terms (swap two stops, move it to another day, book it now, drop one stop).\n" +
      'Answer with JSON only: {"ok": "one sentence on what is already good about this plan", "issues": [{"day": 3, "slot": "pm", "kind": "walk", "text": "the problem in one sentence", "fix": "what to do in one sentence"}]} ' +
      'where kind is one of walk, closed, nap, book, pace, meal, travel, other and slot is one of breakfast, am, lunch, pm, dinner, eve or "".'
    );
  }
  function clean(res, P) {
    var issues = (res && Array.isArray(res.issues) ? res.issues : [])
      .filter(function (i) {
        return i && typeof i.text === "string" && i.text.trim() && +i.day >= 1 && +i.day <= P.N;
      })
      .slice(0, 8)
      .map(function (i) {
        return {
          day: Math.round(+i.day),
          slot: W.SLOT_NAME[i.slot] ? i.slot : "",
          kind: KINDS[i.kind] ? i.kind : "other",
          text: String(i.text).trim().slice(0, 260),
          fix: typeof i.fix === "string" ? i.fix.trim().slice(0, 220) : ""
        };
      });
    return { ok: res && typeof res.ok === "string" ? res.ok.trim().slice(0, 200) : "", issues: issues };
  }
  /** ask (again) @param {Plan} P */
  W.reviewStart = function (P) {
    if (!P || !P.days || !P.days.length || W.readOnly || window.__WP_OFFLINE || W.sampleState !== "on") return false;
    var facts = W.reviewFacts(P),
      sig = hash(JSON.stringify(facts) + "|" + W.ages().join(",")),
      k = "review|" + (W.S.tripId || "t");
    if (W.status[k] && W.status[k] !== "loading") delete W.status[k];
    W.run(k, prompt(P, facts), "complex", function (res) {
      var c = clean(res, W.P || P);
      mem = { sig: sig, at: Date.now(), ok: c.ok, issues: c.issues };
      memId = sk();
      try {
        localStorage.setItem(sk(), JSON.stringify(mem));
      } catch (e) {
        if (W.storeFailed) W.storeFailed(e);
      }
      W.changed();
    });
    return true;
  };
  var ICON = W.icon("plancheck", 2.1);
  /** the card in All days @param {Plan} P */
  W.reviewBlock = function (P) {
    if (!P || !P.days || !P.days.length) return "";
    var v = saved(),
      s = W.status["review|" + (W.S.tripId || "t")],
      busy = s === "loading",
      can = !W.readOnly && !window.__WP_OFFLINE && W.sampleState === "on";
    if (!v && !can) return "";
    if (busy)
      return (
        '<section class="pcheck sk" aria-label="Check my plan"><p class="loading" role="status">Claude is reading your ' +
        P.N +
        " days…</p></section>"
      );
    if (!v)
      return (
        '<button type="button" class="glance-link pcheck-go" data-review="1">' +
        ICON +
        '<span><b>Check my plan</b><span class="small muted">Claude reads the whole trip and flags real problems: too much walking, closed days, naps, tickets to book</span></span></button>' +
        (s ? '<p class="small pcheck-err" role="status">' + esc(s) + "</p>" : "")
      );
    var stale = v.sig !== W.reviewSig(P),
      when = new Date(v.at),
      same = W.isoDay(when) === W.isoDay(new Date());
    var at =
      (same ? "today" : when.toLocaleDateString(undefined, { month: "short", day: "numeric" })) +
      " at " +
      when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    var h =
      '<section class="pcheck sk" aria-label="Check my plan"><div class="pcheck-h"><h3>' +
      ICON +
      'Claude\'s check of your plan</h3><span class="small muted">' +
      esc(at) +
      "</span></div>";
    if (stale) h += '<p class="pcheck-stale" role="status">The plan has changed since this check.</p>';
    if (v.ok) h += '<p class="pcheck-ok">' + esc(v.ok) + "</p>";
    if (!v.issues.length) h += '<p class="pcheck-none">Nothing stands out. The plan reads well as it is.</p>';
    else
      h +=
        '<ol class="pcheck-l">' +
        v.issues
          .map(function (/** @type {any} */ i) {
            var d = P.days[i.day - 1];
            return (
              '<li class="pcheck-i pc-' /* (pc-: k- is the kids' corner's prefix, and .k-book is its storybook page) */ +
              esc(i.kind) +
              '"><span class="pcheck-k">' +
              esc(KINDS[i.kind] || KINDS.other) +
              '</span><span class="pcheck-w">' +
              esc("Day " + i.day + (d ? " · " + d.city : "") + (i.slot ? " · " + W.SLOT_NAME[i.slot] : "")) +
              "</span>" +
              '<p class="pcheck-t">' +
              esc(i.text) +
              "</p>" +
              (i.fix ? '<p class="pcheck-f"><b>Try:</b> ' + esc(i.fix) + "</p>" : "") +
              (d ? '<button type="button" class="linkish" data-goday="' + i.day + '">Open Day ' + i.day + " →</button>" : "") +
              "</li>"
            );
          })
          .join("") +
        "</ol>";
    h +=
      '<p class="small muted pcheck-n">Claude read the plan as it is written here. It can be wrong, and opening hours change: check before you rely on one. Nothing in your plan was changed.</p>';
    if (can)
      h +=
        '<div class="pcheck-b"><button type="button" class="btn quiet sm" data-review="1">Check again</button>' +
        (s ? '<span class="small pcheck-err" role="status">' + esc(s) + "</span>" : "") +
        "</div>";
    return h + "</section>";
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement} */ (e.target),
      b = t && t.closest ? t.closest("[data-review]") : null;
    if (!b || !W.P) return;
    W.reviewStart(W.P);
    W.render();
  });
})();
