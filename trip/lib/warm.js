/* Waypoint, warmly: the family by name, the build-up to the trip (milestones worth a cheer, the sky
   over the place you're going), friendly words when things get done, and memories that gather themselves (how each day
   went, a highlight reel to send home, and "one year ago today"). Everything here decorates the plan; none of it changes
   what the planner picks. */
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
  function md(d) {
    return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  }

  /* ======================= the family, by name ======================= */
  W.family = function () {
    var s = S(),
      n = s.names || [];
    return (s.travelers || []).map(function (a, i) {
      return { i: i, age: a === "" || a == null ? null : +a, name: String(n[i] || "").trim() };
    });
  };
  function join(list) {
    return list.length < 2
      ? list[0] || ""
      : list.length === 2
        ? list[0] + " & " + list[1]
        : list.slice(0, -1).join(", ") + " & " + list[list.length - 1];
  }
  W.joinNames = join;
  W.kidNames = function (under) {
    return W.family()
      .filter(function (f) {
        return f.age != null && f.age < (under || 12) && f.name;
      })
      .map(function (f) {
        return f.name;
      });
  };
  W.elderNames = function () {
    return W.family()
      .filter(function (f) {
        return f.age != null && f.age >= 65 && f.name;
      })
      .map(function (f) {
        return f.name;
      });
  };
  /* the person using the app: the first grown-up with a name */
  W.me = function () {
    var f = W.family().filter(function (x) {
      return x.name && (x.age == null || x.age >= 18);
    })[0];
    return f ? f.name : "";
  };
  /* "Zach, Anna, Mila (4) & Leo (2)" for the Plan summary */
  W.familyLine = function () {
    var f = W.family();
    if (
      !f.some(function (x) {
        return x.name;
      })
    )
      return "";
    return join(
      f.map(function (x) {
        return (x.name || "Traveler") + (x.age != null && x.age < 18 ? " (" + x.age + ")" : "");
      })
    );
  };
  /* the little personal notes on a stop: a kid's pick, good for the kids, easy for the grandparents */
  W.kidPicks = function (it) {
    var p = (S().kidPicks || {})[W.norm(it.n)];
    return Array.isArray(p) ? p : [];
  };
  W.whoTags = function (it, food, cls) {
    var out = "",
      picks = W.kidPicks(it);
    if (picks.length) out += '<span class="gt pick">♥ ' + esc(picks[0] === "kids" ? "Kids'" : join(picks) + "'s") + " pick</span>";
    if (food) return out;
    var kids = W.kidNames(12),
      elders = W.elderNames();
    if (it.k === 1 && kids.length && !picks.length)
      out += '<span class="gt fam">Great for ' + esc(kids.length > 2 ? "the kids" : join(kids)) + "</span>";
    if (elders.length && cls && cls.intensity <= 1 && cls.stroller !== false)
      out += '<span class="gt fam">Easy for ' + esc(join(elders)) + "</span>";
    return out;
  };
  W.notForLine = function (p) {
    var t = W.kidNames(5);
    return t.length ? "Not one for " + join(t) : p.toddler ? "Not for toddlers" : "Not for kids";
  };

  /* ======================= the greeting, and the sky over the place you're going ======================= */
  W.greeting = function () {
    var h = W.now().getHours(),
      me = W.me();
    return "Good " + (h < 5 ? "evening" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening") + (me ? ", " + me : "");
  };
  function placeNow(P) {
    if (!P || !P.stops || !P.stops.length) return null;
    var tn = W.todayN && W.todayN(P),
      d = tn ? P.days[tn - 1] : null;
    return d ? { country: d.country, city: d.city } : { country: P.stops[0].country, city: P.stops[0].name };
  }
  /* The time in the banner. On the trip it is the trip's clock (W.now), the same one the greeting and Today go by, so
     the banner never says one time and Today another. Before the trip (and after) the greeting goes by your own
     clock, and the banner adds what time it is where you are going */
  var SKYF = /** @type {Record<string, Intl.DateTimeFormat>} */ ({}); /* one clock per time zone, kept: making one is the slow part */
  W.sky = function (P) {
    var pl = placeNow(P);
    if (!pl) return null;
    var hh = 0,
      mm = 0;
    if (W.todayN && W.todayN(P)) {
      var n = W.now();
      hh = n.getHours();
      mm = n.getMinutes();
    } else {
      var s = P.stops[0],
        at = W.stopAt ? W.stopAt(s) : null,
        tz = W.tripZone(pl.country, at ? at.lng : null, at ? at.lat : null).tz;
      if (!tz) return { phase: "night", city: pl.city, time: "" };
      try {
        (SKYF[tz] = SKYF[tz] || new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))
          .formatToParts(W.instant())
          .forEach(function (x) {
            if (x.type === "hour") hh = +x.value % 24;
            if (x.type === "minute") mm = +x.value;
          });
      } catch (e) {
        return { phase: "night", city: pl.city, time: "" };
      }
    }
    var phase = hh >= 5 && hh < 8 ? "dawn" : hh >= 8 && hh < 17 ? "day" : hh >= 17 && hh < 20 ? "dusk" : "night";
    return { phase: phase, city: pl.city, time: W.clock(hh * 60 + mm), hour: hh };
  };
  var SUN = W.icon("sun", 2.4);
  var MOON = W.icon("moon", 2.4);
  /* the line along the bottom of the banner */
  W.topLine = function (P) {
    if (!P || !P.stops || !P.stops.length) return "";
    var sk = W.sky(P),
      top = document.querySelector(".top");
    if (top) top.setAttribute("data-sky", sk ? sk.phase : "night");
    var bits = ['<span class="tl-hi">' + esc(W.greeting()) + "</span>"];
    if (sk && sk.time)
      bits.push(
        '<span class="tl-sky">' + (sk.phase === "day" || sk.phase === "dawn" ? SUN : MOON) + esc(sk.time + " in " + sk.city) + "</span>"
      );
    return bits.join('<span class="tl-sep" aria-hidden="true">·</span>');
  };

  /* ======================= days until the trip ======================= */
  function daysUntil() {
    var s = S();
    if (!s.start) return null;
    return Math.round((new Date(s.start + "T00:00").getTime() - today().getTime()) / 864e5);
  }
  W.daysUntil = daysUntil;
  /* ======================= milestones worth a cheer ======================= */
  W.milestone = function (P) {
    var s = S();
    if (W.readOnly || W.isExample || !P || !P.stops.length) return null;
    var cel = s.celebrated || {},
      d = daysUntil(),
      tn = W.todayN && W.todayN(P),
      name = W.tripName ? W.tripName() : "the trip",
      first = P.stops[0].name;
    var list = W.checklist ? W.checklist(P) : [],
      pk = W.packing ? W.packing(P) : null,
      ticks = s.pack || {};
    if (tn === 1 && !cel.start)
      return { key: "start", title: "It's here!", text: "Day 1 in " + first + ". Have the best time.", also: ["d1", "d7", "d30", "d100"] };
    if (d != null && tn == null && d <= -P.N && d > -(P.N + 14) && !cel.home)
      return { key: "home", title: "Welcome home", text: "What a trip. Your highlight reel is ready to send to the family.", go: "recap" };
    var T = [1, 7, 30, 100];
    if (d != null && d >= 1)
      for (var i = 0; i < T.length; i++)
        if (d <= T[i] && !cel["d" + T[i]]) {
          /* the real count, so the cheer agrees with the banner ("6 days to go", not "7") */
          var title = d === 1 ? "One more sleep!" : d === 7 ? "One week to go!" : d === 30 ? "One month to go!" : d + " days to go!";
          var txt = d === 1 ? "Tomorrow you're off to " + first + "!" : "The countdown to " + first + " is on.";
          return {
            key: "d" + T[i],
            title: title,
            text: txt,
            also: T.slice(i + 1).map(function (x) {
              return "d" + x;
            })
          };
        }
    if (
      list.length >= 3 &&
      list.every(function (c) {
        return c.done;
      }) &&
      !cel.booked
    )
      return { key: "booked", title: "Everything's booked!", text: "Every stay, ticket and ride for " + name + " is sorted." };
    if (
      pk &&
      pk.pack.length &&
      pk.pack.every(function (x) {
        return ticks[x.key];
      }) &&
      !cel.packed
    )
      return { key: "packed", title: "All packed!", text: "Bags zipped. Nothing left on the list." };
    return null;
  };
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var host = document.createElement("div"),
      cols = ["#f6c46b", "#e0895a", "#7c61b8", "#5aa0d8", "#6fbf8e", "#e86f8a"];
    host.className = "confetti";
    host.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 46; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * 0.5 + "s";
      p.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      p.style.transform = "rotate(" + Math.round(Math.random() * 360) + "deg)";
      if (i % 3 === 0) p.style.borderRadius = "50%";
      host.appendChild(p);
    }
    document.body.appendChild(host);
    setTimeout(function () {
      host.remove();
    }, 3600);
  }
  W.confetti = confetti;
  var cheerT = null;
  /* a friendly note at the top of the screen; with confetti for the big moments */
  W.cheer = function (title, text, opts) {
    opts = opts || {};
    var host = document.getElementById("cheerhost");
    if (!host) {
      host = document.createElement("div");
      host.id = "cheerhost";
      document.body.appendChild(host);
    }
    host.innerHTML =
      '<div class="cheer' +
      (opts.big ? " big" : "") +
      '" role="status"><div><b>' +
      esc(title) +
      "</b>" +
      (text ? "<span>" + esc(text) + "</span>" : "") +
      "</div>" +
      (opts.go ? '<button type="button" class="chip" data-view="' + esc(opts.go) + '">Open it</button>' : "") +
      '<button type="button" class="icon-btn" data-cheerx="1" aria-label="Close">×</button></div>';
    if (opts.big) confetti();
    clearTimeout(cheerT);
    cheerT = setTimeout(
      function () {
        host.innerHTML = "";
      },
      opts.big ? 7000 : 3800
    );
  };
  W.warmTick = function (P) {
    if (W.readOnly) return;
    var m = W.milestone(P);
    if (!m) return;
    var s = S(),
      cel = s.celebrated || (s.celebrated = {});
    cel[m.key] = W.isoDay(W.now());
    (m.also || []).forEach(function (k) {
      cel[k] = cel[k] || "skipped";
    });
    W.save();
    setTimeout(function () {
      W.cheer(m.title, m.text, { big: true, go: m.go });
    }, 500);
  };

  /* ======================= friendly words when things get done ======================= */
  W.tickLabel = function (key) {
    var c = (W.checklist(W.P) || []).filter(function (x) {
      return x.key === key;
    })[0];
    if (!c) return "Updated a booking";
    var what = (c.short || c.title || "").replace(/ · .*$/, "");
    if (c.done) return "Back on your To book list";
    var NICE = ["Nice! ", "Lovely! ", "Done! ", "Great! "];
    return NICE[what.length % NICE.length] + what + (/s$/.test(what) && !/ss$/.test(what) ? " are" : " is") + " sorted.";
  };
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
    var r = W.readiness(P),
      C = 2 * Math.PI * 21,
      off = C * (1 - r.pct / 100);
    var parts = [r.book ? r.book + " to book" : "", r.pack ? r.pack + " to pack" : "", r.todo ? r.todo + " to do" : ""].filter(Boolean);
    var line =
      r.pct >= 100
        ? "Ready to go. Have a wonderful trip!"
        : r.pct >= 75
          ? "Nearly there!"
          : r.pct >= 40
            ? "Coming along nicely."
            : r.pct > 0
              ? "A good start."
              : "Let's get going.";
    return (
      '<div class="ready sk"><svg viewBox="0 0 50 50" class="ring" aria-hidden="true"><circle cx="25" cy="25" r="21" class="trk"/><circle cx="25" cy="25" r="21" class="bar" style="--ring-c:' +
      C.toFixed(1) +
      '" stroke-dasharray="' +
      C.toFixed(1) +
      '" stroke-dashoffset="' +
      off.toFixed(1) +
      '"/></svg>' +
      "<div><b>" +
      r.pct +
      "% ready</b><span>" +
      esc(line) +
      (parts.length ? " " + parts.join(" · ") + "." : "") +
      "</span></div></div>"
    );
  };

  /* ======================= memories ======================= */
  /* a light tap you can feel when you tick something off, rate a day or switch views (phones that can vibrate) */
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target,
        b = t && t.closest ? t.closest("[data-tick],[data-pack],[data-mood],[data-vsw],[data-dsw]") : null;
      if (!b || b.disabled) return;
      try {
        if (navigator.vibrate && window.matchMedia("(pointer:coarse)").matches)
          navigator.vibrate(b.hasAttribute("data-tick") || b.hasAttribute("data-pack") ? 12 : 6);
      } catch (x) {}
    },
    true
  );
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

  /* ======================= taps ======================= */
  document.addEventListener(
    "click",
    function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b) return;
      var d = b.dataset;
      if (d.cheerx) {
        var h = document.getElementById("cheerhost");
        if (h) h.innerHTML = "";
        return;
      }
      if (d.warmseen) {
        e.stopPropagation();
        S().warmSeen = d.warmseen + W.isoDay(W.now());
        W.save();
        W.render();
        return;
      }
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
