/* Waypoint: the night-before briefing for a new town (v166, the owner's pick "The night-before briefing for a new city").
   On Today, when tomorrow is a travel day, "Briefing for <town>" asks Claude once for what a parent wants to know the
   evening before: from the station (or port, or airport) to the stay with children and bags (how, how long, about what
   it costs), an easy first dinner near the stay that is open that evening and fine with children, what is closed
   tomorrow (from the plan's own places and the day's public holidays, and closing days Claude is sure of), and a few
   local ways worth knowing (dinner hours, tipping, greetings, quiet hours). The answer is kept on this phone with the
   day and the stay it was for, so it opens at once offline and says when the plan has moved on. Part of the second
   script. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  /** @param {Day} day */
  function sk(day) {
    return "waypoint-brief|" + (W.S.tripId || "t") + "|" + day.n;
  }
  /** what the briefing is for: the town, the date, how you get there, the stay; a change makes it out of date @param {Day} day */
  function facts(day) {
    var P = W.P,
      T = W.dayTimes(day, P),
      home = W.homebase(day.country, day.city),
      dt = W.dateOf(day.n),
      leg = T && T.travel ? T.travel.leg : null,
      tk = T && T.travel ? T.travel.ticket : null,
      rows = T ? T.rows : null /* (kept, so the check inside the map below still knows it is there) */,
      stops = !T
        ? []
        : (T.order || [])
            .map(function (sl) {
              var x = day.slots.filter(function (y) {
                  return y.slot === sl;
                })[0],
                R = rows && rows[sl];
              return x && x.item && R && !R.skip && R.start != null ? W.clock(R.start) + " " + x.item.n : null;
            })
            .filter(Boolean);
    var hol = W.dayHolidays ? W.dayHolidays(day) : [];
    return {
      town: day.city,
      country: day.country,
      from: day.moveFrom || "",
      date: dt ? W.isoDay(dt) : "",
      weekday: dt ? WD[dt.getDay()] : "",
      how: tk ? tk.kind + (tk.title ? " (" + tk.title + ")" : "") : leg ? leg.mode || "" : "",
      arrive: T && T.travel ? W.clock(T.travel.end) : "",
      stay: home && !home.none ? home.label : "",
      plan: stops,
      holiday: (hol || [])
        .map(function (/** @type {any} */ h) {
          return h.name || h.n || String(h);
        })
        .join(", ")
    };
  }
  function prompt(f) {
    var needs = W.eatText ? W.eatText() : "";
    return (
      "A family arrives tomorrow in " +
      f.town +
      ", " +
      f.country +
      (f.from ? ", coming from " + f.from : "") +
      (f.how ? " by " + f.how : "") +
      (f.arrive ? ", arriving about " + f.arrive : "") +
      ". Tomorrow is " +
      (f.weekday ? f.weekday + " " : "") +
      f.date +
      (f.holiday ? " (public holiday: " + f.holiday + ")" : "") +
      ". " +
      (f.stay ? "They stay at " + f.stay + ". " : "They have not picked a place to stay yet. ") +
      (W.who ? W.who() : "") +
      (needs ? " What they eat: " + needs + "." : "") +
      (f.plan.length ? "\nTomorrow's plan: " + f.plan.join("; ") + "." : "") +
      "\nWrite the briefing a parent wants the evening before. arrive: how to get from where they arrive (name the station, port " +
      "or airport) to the stay with small children and bags: the easiest way, how long, about what it costs; one short line each " +
      "(if no stay is picked, to the centre). dinner: 2 or 3 easy places for a first dinner near the stay, open tomorrow evening, " +
      "good with children, real places you are sure of, each with what it is and how far. closed: what in tomorrow's plan or " +
      "nearby will be shut or short of hours tomorrow (its weekday closing, the holiday), only what you are sure of; an empty " +
      "list is fine. customs: 3 or 4 short local ways worth knowing (when people eat, tipping, greetings, quiet hours, what " +
      "to wear in churches), the ones that matter with children first.\n" +
      'Reply with JSON only: {"arrive":{"from":"","how":"","time":"","cost":""},"dinner":[{"n":"","d":"","far":""}],' +
      '"closed":[{"what":"","why":""}],"customs":[""]}'
    );
  }
  function str(v, n) {
    return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
  }
  /** the answer, made safe @param {any} r */
  W.briefClean = function (r) {
    var o = r && typeof r === "object" ? r : {},
      a = o.arrive && typeof o.arrive === "object" ? o.arrive : {};
    var arr = (Array.isArray(o.dinner) ? o.dinner : [])
      .map(function (/** @type {any} */ d) {
        d = d && typeof d === "object" ? d : {};
        return { n: str(d.n, 80), d: str(d.d, 140), far: str(d.far, 40) };
      })
      .filter(function (/** @type {any} */ d) {
        return d.n;
      })
      .slice(0, 3);
    var shut = (Array.isArray(o.closed) ? o.closed : [])
      .map(function (/** @type {any} */ c) {
        c = c && typeof c === "object" ? c : {};
        return { what: str(c.what, 80), why: str(c.why, 120) };
      })
      .filter(function (/** @type {any} */ c) {
        return c.what;
      })
      .slice(0, 5);
    var cu = (Array.isArray(o.customs) ? o.customs : [])
      .map(function (/** @type {any} */ c) {
        return str(c, 160);
      })
      .filter(Boolean)
      .slice(0, 4);
    return {
      arrive: { from: str(a.from, 80), how: str(a.how, 200), time: str(a.time, 30), cost: str(a.cost, 30) },
      dinner: arr,
      closed: shut,
      customs: cu
    };
  };
  function saved(day) {
    try {
      var v = JSON.parse(localStorage.getItem(sk(day)) || "null");
      return v && v.res ? v : null;
    } catch (e) {
      return null;
    }
  }
  /** ask (again) @param {Day} day */
  W.briefStart = function (day) {
    if (!day || W.readOnly || window.__WP_OFFLINE || W.sampleState !== "on") return;
    var f = facts(day),
      k = "brief|" + (W.S.tripId || "t") + "|" + day.n,
      sig = JSON.stringify([f.town, f.date, f.stay, f.how, f.arrive]);
    if (W.status[k] && W.status[k] !== "loading") delete W.status[k];
    var key = sk(day); /* (the trip asked about: another may be open when the answer comes) */
    W.run(k, prompt(f), "default", function (res) {
      var v = { sig: sig, at: Date.now(), res: W.briefClean(res) };
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch (e) {
        if (W.storeFailed) W.storeFailed(e);
      }
      mem[key] = v;
      W.changed();
    });
  };
  /** @type {Record<string, any>} */ var mem = {};
  /** the briefing in Today's "Tomorrow" @param {Day} day tomorrow, a travel day */
  W.briefBlock = function (day) {
    if (!day || !day.moveFrom) return "";
    var v = mem[sk(day)] || (mem[sk(day)] = saved(day)),
      k = "brief|" + (W.S.tripId || "t") + "|" + day.n,
      s = W.status[k],
      can = !W.readOnly && !window.__WP_OFFLINE && W.sampleState === "on";
    if (s === "loading")
      return '<div class="brief" aria-live="polite"><p class="loading">Getting tomorrow\'s briefing for ' + esc(day.city) + "…</p></div>";
    if (!v)
      return can || s
        ? '<div class="brief">' +
            (can
              ? '<button type="button" class="btn quiet sm brief-go" data-brief="' +
                day.n +
                '">' +
                W.icon("tip", 2.1) +
                "Briefing for " +
                esc(day.city) +
                "</button>"
              : "") +
            (s ? '<p class="small brief-err" role="status">' + esc(s) + "</p>" : "") +
            '<p class="small muted">Getting from the station to your stay with the kids and bags, a first dinner nearby, what\'s closed, local ways.</p></div>'
        : "";
    var f = facts(day),
      stale = v.sig !== JSON.stringify([f.town, f.date, f.stay, f.how, f.arrive]),
      r = v.res,
      a = r.arrive;
    var sec = function (/** @type {string} */ t, /** @type {string} */ body) {
      return body ? '<div class="brief-s"><h4>' + t + "</h4>" + body + "</div>" : "";
    };
    return (
      '<div class="brief" aria-live="polite"><h3 class="brief-h">' +
      W.icon("tip", 2.1) +
      "Arriving in " +
      esc(day.city) +
      "</h3>" +
      (stale ? '<p class="brief-stale">Your plan for ' + esc(day.city) + " has changed since this briefing.</p>" : "") +
      sec(
        a.from ? "From " + esc(a.from) : "Getting to your stay",
        a.how
          ? "<p>" +
              esc(a.how) +
              (a.time || a.cost ? ' <span class="muted">' + esc([a.time, a.cost].filter(Boolean).join(" · ")) + "</span>" : "") +
              "</p>"
          : ""
      ) +
      sec(
        "An easy first dinner",
        r.dinner.length
          ? "<ul>" +
              r.dinner
                .map(function (/** @type {any} */ d) {
                  /* the name and how far on one line, what it is under them */
                  return (
                    "<li><span><b>" +
                    esc(d.n) +
                    "</b>" +
                    (d.far ? ' <span class="muted">· ' + esc(d.far) + "</span>" : "") +
                    "</span>" +
                    (d.d ? '<span class="brief-d">' + esc(d.d) + "</span>" : "") +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
          : ""
      ) +
      sec(
        "Closed tomorrow",
        r.closed.length
          ? "<ul>" +
              r.closed
                .map(function (/** @type {any} */ c) {
                  return "<li><b>" + esc(c.what) + "</b>" + (c.why ? '<span class="brief-d">' + esc(c.why) + "</span>" : "") + "</li>";
                })
                .join("") +
              "</ul>"
          : "<p>Nothing on tomorrow's plan that Claude knows to be closed.</p>"
      ) +
      sec(
        "Good to know",
        r.customs.length
          ? '<ul class="brief-dots">' +
              r.customs
                .map(function (/** @type {string} */ c) {
                  return "<li>" + esc(c) + "</li>";
                })
                .join("") +
              "</ul>"
          : ""
      ) +
      '<p class="small muted">From Claude: check times, prices and opening hours on the day.</p>' +
      (can
        ? '<button type="button" class="btn quiet sm" data-brief="' +
          day.n +
          '">' +
          (stale ? "Update the briefing" : "Ask again") +
          "</button>"
        : "") +
      "</div>"
    );
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("[data-brief]") : null);
    if (!t || !W.P) return;
    var d = W.P.days[+(t.getAttribute("data-brief") || 0) - 1];
    if (!d) return;
    W.briefStart(d);
    W.render();
  });
})();
