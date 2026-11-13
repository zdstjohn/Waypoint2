/* Waypoint, warmly, part 2 (second script): how ready you are for the trip (the ring on Prepare), and the memories
   that gather themselves: the trip in numbers, a highlight reel to send home, the recap (the whole trip on one page)
   and "one year ago today" on the day. Split from lib/warm.js, which keeps what the first screen needs (the banner,
   names, milestones). No journal since v176 (the owner's call): no photos, notes or moods to add. */
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
      pk = W.packing ? W.packing(P) : /** @type {{ pack: PackItem[]; todo: PackItem[] }} */ ({ pack: [], todo: [] }),
      t = S().pack || {};
    /* (what the trip's clock has passed, never marked booked, is no longer counted either way) */
    list = list.filter(function (c) {
      return !c.past;
    });
    var tb = list.filter(W.leftToBook).length,
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
  /* the trip in numbers, for the recap and for sending home */
  W.tripStats = function (P) {
    var st = { days: P.N, places: 0, stops: 0, beaches: 0, museums: 0, km: 0, gelato: 0 };
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
          lg = prev && W.leg ? W.leg(prev, x.item) : null;
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
  /* ---------- the recap: the whole trip on one page ("Welcome home" and a year on lead here) ---------- */
  /** @param {Day} day */
  function started(day) {
    var d = W.dateOf(day.n);
    return !d || d <= W.now();
  }
  /** @param {Plan} P */
  W.renderRecap = function (P) {
    var el = W.$("viewRecap");
    if (!el) return;
    var d1 = W.dateOf(1),
      dn = W.dateOf(P.N),
      fmt = function (/** @type {Date | null} */ d, /** @type {Intl.DateTimeFormatOptions} */ o) {
        return d ? d.toLocaleDateString(undefined, o) : "";
      };
    var h =
      '<div class="recap"><button type="button" class="linkish back" data-view="trip">' +
      W.arrow() +
      "Back to the trip</button>" +
      '<header class="rc-hero sk"><h2>' +
      esc(W.tripName ? W.tripName() : "Our trip") +
      "</h2>" +
      '<p class="muted">' +
      esc(
        [
          d1
            ? fmt(d1, { month: "long", day: "numeric" }) + " – " + fmt(dn, { month: "long", day: "numeric", year: "numeric" })
            : P.N + " days",
          P.stops
            .map(function (s) {
              return s.name;
            })
            .join(" → ")
        ]
          .filter(Boolean)
          .join(" · ")
      ) +
      "</p></header>" +
      W.highlights(P);
    var any = false;
    P.days.forEach(function (day) {
      if (!started(day)) return;
      var seen = (day.slots || [])
        .filter(function (x) {
          return x.item && !W.isFood(x.slot);
        })
        .map(function (x) {
          return x.item ? x.item.n : "";
        });
      any = true;
      h +=
        '<article class="rc-day sk"><div class="rc-h"><b>Day ' +
        day.n +
        " · " +
        esc(day.city) +
        '</b><span class="muted">' +
        esc(fmt(W.dateOf(day.n), { weekday: "long", month: "short", day: "numeric" })) +
        "</span></div>" +
        (seen.length ? '<p class="small muted">' + esc(seen.join(" · ")) + "</p>" : "") +
        "</article>";
    });
    if (!any)
      h +=
        '<div class="empty sk">Once the trip starts, each day and the places you went gather here, to look back on and to show family.</div>';
    else if (!W.readOnly)
      h +=
        '<p class="small muted rc-share">' +
        (W.S.share
          ? "Family with your share code see this recap too."
          : "To show family, share the trip view-only from the trip menu (tap the trip name); the recap comes with it.") +
        "</p>";
    el.innerHTML = h + "</div>";
  };
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
      first = (day.slots || []).filter(function (x) {
        return x.item && !W.isFood(x.slot);
      })[0],
      img = first ? W.picture(first.item, false, day.country, day.city) : "";
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
      '<div class="pc-a"><button type="button" class="chip" data-view="recap">Look back at the trip ›</button><button type="button" class="linkish" data-warmseen="ann">Thanks</button></div></div></section>'
    );
  };

  document.addEventListener(
    "click",
    function (e) {
      var b = e.target && e.target.closest && e.target.closest("button");
      if (!b) return;
      var d = b.dataset;
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
