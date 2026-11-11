/* Waypoint booking autopilot. The book-by list is kept in the app's database (data/users/<you>/bookby/t/<trip>, private
   to you) so a nightly helper can read your own inbox for confirmations and put the deadlines on your Google Calendar.
   The helper never books or buys anything: it only reads mail and writes reminders. What it finds comes back here
   (data/users/<you>/autopilot/t/<trip>) and ticks the list, with the confirmation it found. (A document's path has an
   even number of parts, so each list is one document in a "t" collection under a per-person document.) */
(function () {
  "use strict";
  var W = window.W,
    S = W.S;
  var db = null,
    uid = null,
    canWrite = true,
    auto = { found: {}, cal: {}, checked: "" },
    autoTrip = null,
    unsub = null;

  try {
    if (window.claude && window.claude.use) {
      Promise.all([window.claude.use("db"), window.claude.use("user")]).then(
        function (r) {
          db = r[0];
          var user = r[1];
          if (!db || !user) return;
          return Promise.all([
            user.id(),
            user.can("data.write").catch(function () {
              return null;
            })
          ]).then(function (u) {
            uid = u[0];
            if (u[1] === false) canWrite = false;
            W.changed();
          });
        },
        function () {}
      );
    }
  } catch (e) {}

  /* what the helper found for a row, if anything */
  W.autoFound = function (key) {
    return (auto.found || {})[key] || null;
  };
  W.autopilot = function () {
    return auto;
  };

  /* the list the helper works from: one row per thing to book, with its deadline */
  var lastSig = null,
    timer = null;
  W.pushBookBy = function (P) {
    if (W.readOnly || W.isExample || !db || !uid || !canWrite || !S.start || !P || !P.stops.length) return;
    var list = W.checklist(P);
    var items = list.map(function (c) {
      return {
        key: c.key,
        title: c.title || "",
        short: c.short || c.title || "",
        kind: c.kind || "",
        group: c.group || "",
        day: c.day || 0,
        date: c.date ? W.isoDay(c.date) : "",
        by: c.by ? W.isoDay(c.by) : "",
        url: c.url || "",
        city: c.city || (c.day && P.days[c.day - 1] ? P.days[c.day - 1].city : ""),
        country: c.day && P.days[c.day - 1] ? P.days[c.day - 1].country : "",
        hint: c.sub || c.why || "",
        done: !!c.done,
        lead: c.lead || 0
      };
    });
    var body = {
      trip: S.tripId,
      name: W.tripName(),
      start: S.start,
      days: P.N,
      places: P.stops.map(function (s) {
        return s.name + ", " + s.country;
      }),
      tz: W.tzFor(P.stops[0].country) || "",
      home: W.homeTz() || "",
      items: items
    };
    var sig = JSON.stringify(body);
    if (sig === lastSig) return;
    lastSig = sig;
    clearTimeout(timer);
    timer = setTimeout(function () {
      body.updated = Date.now();
      try {
        db.doc("data/users/" + uid + "/bookby")
          .collection("t")
          .doc(S.tripId)
          .set(body)
          .then(null, function () {
            lastSig = null;
          });
      } catch (e) {
        lastSig = null;
        if (W.logError) W.logError(String((e && e.message) || e), "autopilot.js:bookby", e && e.stack);
      }
    }, 2500);
  };

  /* what the helper wrote for this trip (it changes when it runs; re-read when you switch trips) */
  function watch() {
    if (!db || !uid || W.readOnly) return;
    if (autoTrip === S.tripId) return;
    if (unsub) {
      unsub();
      unsub = null;
    }
    autoTrip = S.tripId;
    auto = { found: {}, cal: {}, checked: "" };
    try {
      unsub = db
        .doc("data/users/" + uid + "/autopilot")
        .collection("t")
        .doc(S.tripId)
        .onSnapshot(
          function (snap) {
            var x = snap && snap.exists ? snap.data() || {} : {};
            auto = {
              found: x.found && typeof x.found === "object" ? x.found : {},
              cal: x.cal && typeof x.cal === "object" ? x.cal : {},
              checked: String(x.checked || ""),
              note: String(x.note || "")
            };
            W.changed();
          },
          function () {}
        );
    } catch (e) {
      if (W.logError) W.logError(String((e && e.message) || e), "autopilot.js:watch", e && e.stack);
    }
  }
  W.autoTick = function (P) {
    watch();
    W.pushBookBy(P);
  };

  /* the line under "Book ahead": when the helper last looked, what it found, where the reminders are */
  W.autoLine = function (list) {
    if (W.readOnly) return "";
    var n = list.filter(function (c) {
        return c.autopilot;
      }).length,
      cal = Object.keys(auto.cal || {}).length;
    if (!auto.checked)
      return '<p class="small muted auto-line">Every morning the autopilot reads your inbox for confirmations and puts the next deadlines on your Google Calendar. It never books or pays for anything.</p>';
    var when = new Date(auto.checked),
      ago = isNaN(when.getTime())
        ? ""
        : when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
          " " +
          W.clock(when.getHours() * 60 + when.getMinutes());
    return (
      '<p class="small muted auto-line">Autopilot checked your inbox ' +
      W.esc(ago) +
      (n ? " · " + n + " booking" + (n === 1 ? "" : "s") + " found" : " · nothing new") +
      (cal ? " · " + cal + " reminder" + (cal === 1 ? "" : "s") + " on your calendar" : "") +
      (auto.note ? " · " + W.esc(auto.note) : "") +
      "</p>"
    );
  };

  /* the weeks between today and departure, with every deadline on it */
  W.bookTimeline = function (list, today, start) {
    if (!start) return "";
    var t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      dep = new Date(start + "T12:00"),
      span = dep.getTime() - t0.getTime();
    if (!(span > 0)) return "";
    var days = Math.round(span / 864e5),
      W0 = 100;
    function x(d) {
      return Math.max(0, Math.min(W0, ((d.getTime() - t0.getTime()) / span) * W0));
    }
    var dots = list
      .filter(function (c) {
        return c.by && !c.done;
      })
      .map(function (c) {
        var late = c.by < t0,
          px = late ? 0 : x(c.by);
        return (
          '<button type="button" class="tl-dot g-' +
          W.esc(c.group) +
          (late ? " late" : "") +
          '" style="left:' +
          px.toFixed(1) +
          '%" data-gobook="' +
          W.esc(c.key) +
          '" title="' +
          W.esc((c.short || c.title) + " · by " + c.by.toLocaleDateString(undefined, { month: "short", day: "numeric" })) +
          '"><span class="vh">' +
          W.esc((c.short || c.title) + ", by " + c.by.toLocaleDateString(undefined, { month: "short", day: "numeric" })) +
          "</span></button>"
        );
      })
      .join("");
    var ticks = "";
    if (days <= 120) {
      for (var w = 7; w < days; w += 7) ticks += '<i style="left:' + x(new Date(+t0 + w * 864e5)).toFixed(1) + '%"></i>';
    } else {
      var m = new Date(t0.getFullYear(), t0.getMonth() + 1, 1);
      while (m < dep) {
        ticks += '<i style="left:' + x(m).toFixed(1) + '%"></i>';
        m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      }
    }
    var left = list.filter(function (c) {
      return c.by && !c.done;
    }).length;
    return (
      '<div class="bk-tl" aria-label="Deadlines between today and departure"><div class="tl-bar">' +
      ticks +
      dots +
      '</div><div class="tl-ends"><span>Today</span><span>' +
      (left ? left + " to book · " : "") +
      (days === 1
        ? "leaving tomorrow"
        : "leaving in " + (days < 21 ? days + " days" : days < 90 ? Math.round(days / 7) + " weeks" : Math.round(days / 30) + " months")) +
      "</span></div></div>"
    );
  };
})();
