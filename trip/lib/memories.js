/* Waypoint, warmly, part 2 (second script): how ready you are for the trip (the ring on Prepare), and the memories
   that gather themselves: each day's mood, the trip in numbers, a highlight reel to send home, and "one year ago today"
   on the day. Split from lib/warm.js, which keeps what the first screen needs (the banner, names, milestones). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  function S() {
    return W.S;
  }
  function today() {
    var n = W.now();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  var join = W.joinNames;

  /* how ready you are: booked, packed and done, out of everything on the lists */
  W.readiness = function (P) {
    var list = W.checklist(P) || [],
      pk = W.packing ? W.packing(P) : { pack: [], todo: [] },
      t = S().pack || {};
    var tb = list.filter(function (c) {
        return !c.done;
      }).length,
      tp = pk.pack.filter(function (x) {
        return !t[x.key];
      }).length,
      tt = pk.todo.filter(function (x) {
        return !t[x.key];
      }).length;
    var total = list.length + pk.pack.length + pk.todo.length,
      left = tb + tp + tt;
    return { pct: total ? Math.round(((total - left) / total) * 100) : 0, book: tb, pack: tp, todo: tt };
  };
  W.readyRing = function (P) {
    if (W.readOnly || !P || !P.stops.length) return "";
    var r = W.readiness(P);
    var parts = [r.book ? r.book + " to book" : "", r.pack ? r.pack + " to pack" : "", r.todo ? r.todo + " to do" : ""].filter(Boolean);
    /* one line and a thin bar: the list under the tabs is what you came for (it was a card with a ring, a quarter of
       a phone's screen) */
    return (
      '<div class="ready"><div class="rd-t"><b>' +
      r.pct +
      "% ready</b><span>" +
      esc(r.pct >= 100 ? "Ready to go. Have a wonderful trip!" : parts.join(" · ")) +
      '</span></div><div class="rd-bar" aria-hidden="true"><i style="width:' +
      Math.max(2, Math.min(100, r.pct)) +
      '%"></i></div></div>'
    );
  };

  /* ======================= memories ======================= */
  /* drawn faces in the app's line style (emoji looked different on every phone) */
  function face(mouth) {
    return (
      '<svg class="mface" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9 9.6v.6M15 9.6v.6"/><path d="' +
      mouth +
      '"/></svg>'
    );
  }
  var FACE = {
    3: face("M7.6 13.4c1 2.4 2.6 3.6 4.4 3.6s3.4-1.2 4.4-3.6Z"),
    2: face("M8.6 14.6c.9 1.1 2 1.7 3.4 1.7s2.5-.6 3.4-1.7"),
    1: face("M8.6 16.4c.9-1.2 2-1.8 3.4-1.8s2.5.6 3.4 1.8")
  };
  W.moodFace = function (m) {
    return FACE[m] || "";
  };
  var MOODS = [
    [3, FACE[3], "Great"],
    [2, FACE[2], "Good"],
    [1, FACE[1], "Tough"]
  ];
  W.moodRow = function (k, mood) {
    if (W.readOnly)
      return mood
        ? '<p class="mood-ro">' +
            MOODS.filter(function (m) {
              return m[0] === mood;
            }).map(function (m) {
              return m[1] + " " + m[2] + " day";
            })[0] +
            "</p>"
        : "";
    return (
      '<div class="mood" role="radiogroup" aria-label="How was today?"><span>How was today?</span>' +
      MOODS.map(function (m) {
        return (
          '<button type="button" role="radio" aria-checked="' +
          (mood === m[0]) +
          '" data-mood="' +
          m[0] +
          '" data-mk="' +
          esc(k) +
          '"><span aria-hidden="true">' +
          m[1] +
          "</span>" +
          m[2] +
          "</button>"
        );
      }).join("") +
      "</div>"
    );
  };
  /* the trip in numbers, for the recap and for sending home */
  W.tripStats = function (P) {
    var s = S(),
      J = s.journal || {},
      st = { days: P.N, places: 0, stops: 0, beaches: 0, museums: 0, km: 0, photos: 0, great: 0, gelato: 0 };
    var places = {};
    P.stops.forEach(function (x) {
      places[x.name] = 1;
      (x.trips || []).forEach(function (t) {
        if (t.planned !== false) places[t.name] = 1;
      });
    });
    st.places = Object.keys(places).length;
    P.days.forEach(function (day) {
      var home = W.homebase(day.country, day.city),
        prev = home;
      (day.slots || []).forEach(function (x) {
        if (!x.item) return;
        var food = W.isFood(x.slot),
          c = W.classify(x.item, food),
          lg = W.leg && prev ? W.leg(prev, x.item) : null;
        if (lg && lg.mode === "walking" && lg.d) st.km += lg.d;
        if (x.item.lat != null) prev = x.item;
        if (food) {
          if (/gelat|ice cream|helad|glace/i.test(x.item.n + " " + (x.item.cuisine || ""))) st.gelato++;
          return;
        }
        st.stops++;
        if (/beach|lido/.test(c.kind || "")) st.beaches++;
        if (/museum|gallery/.test(c.kind || "")) st.museums++;
      });
      var e = J[W.restKey(day)] || {};
      st.photos += (e.photos || []).length;
      if (e.mood === 3) st.great++;
    });
    st.km = Math.round(st.km);
    return st;
  };
  W.highlights = function (P) {
    var st = W.tripStats(P),
      name = W.tripName ? W.tripName() : "Our trip",
      fam = W.family()
        .filter(function (f) {
          return f.name;
        })
        .map(function (f) {
          return f.name;
        });
    var tiles = [
      [st.days, st.days === 1 ? "day" : "days"],
      [st.places, st.places === 1 ? "place" : "places"],
      [st.stops, "outings"],
      [st.km, "km on foot"]
    ];
    if (st.beaches) tiles.push([st.beaches, st.beaches === 1 ? "beach" : "beaches"]);
    if (st.museums) tiles.push([st.museums, st.museums === 1 ? "museum" : "museums"]);
    if (st.photos) tiles.push([st.photos, st.photos === 1 ? "photo" : "photos"]);
    if (st.great) tiles.push([st.great, st.great === 1 ? "great day" : "great days"]);
    if (st.gelato) tiles.push([st.gelato, st.gelato === 1 ? "ice cream stop" : "ice cream stops"]);
    var text =
      name +
      (fam.length ? " with " + join(fam) : "") +
      ": " +
      tiles
        .map(function (t) {
          return t[0] + " " + t[1];
        })
        .join(", ") +
      ". " +
      P.stops
        .map(function (x) {
          return x.name;
        })
        .join(" → ") +
      ".";
    return (
      '<section class="reel sk"><div class="reel-h"><h3>The highlight reel</h3>' +
      (W.readOnly ? "" : '<button type="button" class="btn sm" data-sendhome="1">Send to the family</button>') +
      "</div>" +
      '<div class="reel-t">' +
      tiles
        .map(function (t, i) {
          return '<div class="rt c' + (i % 6) + '"><b>' + t[0] + "</b><span>" + esc(t[1]) + "</span></div>";
        })
        .join("") +
      "</div>" +
      '<p class="small muted reel-msg" data-sendtext="' +
      esc(text) +
      '">' +
      (sendMsg ? esc(sendMsg) : "") +
      "</p></section>"
    );
  };
  var sendMsg = "";
  function sendHome(text) {
    var done = function (m) {
      sendMsg = m;
      W.render();
      setTimeout(function () {
        sendMsg = "";
      }, 5000);
    };
    if (navigator.share) {
      navigator.share({ title: W.tripName ? W.tripName() : "Our trip", text: text }).then(
        function () {
          done("Sent!");
        },
        function (e) {
          if (e && e.name === "AbortError") return;
          copy();
        }
      );
      return;
    }
    copy();
    function copy() {
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(
          function () {
            done("Copied. Paste it into a message to the family.");
          },
          function () {
            done(text);
          }
        );
      else done(text);
    }
  }
  /* one year ago today (or two, or three) */
  W.anniversary = function (P) {
    var s = S();
    if (W.readOnly || !s.start || !P || !P.stops.length) return "";
    var t = today(),
      hit = null;
    for (var n = 1; n <= P.N && !hit; n++) {
      var d = W.dateOf(n);
      if (!d) break;
      var yrs = t.getFullYear() - d.getFullYear();
      if (yrs >= 1 && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()) hit = { n: n, yrs: yrs };
    }
    if (!hit || s.warmSeen === "ann" + W.isoDay(W.now())) return "";
    var day = P.days[hit.n - 1],
      e = (s.journal || {})[W.restKey(day)] || {},
      ph = (e.photos || [])[0];
    var img = ph
      ? '<img src="' +
        esc(W.offline ? W.offline.src("/_blob/" + encodeURIComponent(ph.id)) : "/_blob/" + encodeURIComponent(ph.id)) +
        '" alt="Your photo from that day" loading="lazy">'
      : "";
    if (!img) {
      var first = (day.slots || []).filter(function (x) {
        return x.item && !W.isFood(x.slot);
      })[0];
      if (first) img = W.picture(first.item, false, day.country, day.city);
    }
    return (
      '<section class="postcard ann sk' +
      (img ? " haspic" : "") +
      '">' +
      (img ? '<div class="pc-pic">' + img + "</div>" : "") +
      '<div class="pc-b"><span class="pc-k">' +
      (hit.yrs === 1 ? "One year" : hit.yrs + " years") +
      " ago today</span>" +
      "<h3>You were in " +
      esc(day.city) +
      "</h3>" +
      (e.note ? "<p>“" + esc(e.note) + "”</p>" : "") +
      '<div class="pc-a"><button type="button" class="chip" data-view="recap">Look back at the trip ›</button><button type="button" class="linkish" data-warmseen="ann">Thanks</button></div></div></section>'
    );
  };

  document.addEventListener(
    "click",
    function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b) return;
      var d = b.dataset;
      if (d.mood && d.mk && !W.readOnly) {
        e.stopPropagation();
        var J = S().journal || (S().journal = {}),
          en = J[d.mk] || (J[d.mk] = {}),
          v = +d.mood;
        en.mood = en.mood === v ? 0 : v;
        W.save();
        W.render();
        if (en.mood === 3) W.cheer("Wonderful!", "A great day, saved to your trip memories.");
        else if (en.mood === 1) W.cheer("Tomorrow's a new day", "Want an easier one? Tap Make it a rest day on tomorrow.");
        return;
      }
      if (d.sendhome) {
        e.stopPropagation();
        var m = document.querySelector(".reel-msg");
        sendHome(m ? m.getAttribute("data-sendtext") : "");
        return;
      }
    },
    true
  );
})();
