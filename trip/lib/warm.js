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
    return d ? W.fmtDate(d, "md") : "";
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
  /* The line along the bottom of the banner. Everywhere: the greeting and the time. On a phone, on the Trip tab's Day
     view, it is the day instead (the city, the date, how full a day, and the whole route in Google Maps), so the day's
     title is not a block of its own under the banner and the plan starts higher up. Both are written; the stylesheet
     shows one (.top[data-day], narrow screens). The text of the day is hidden from a screen reader, which reads the
     day's own heading in the page; the route link is not */
  var DIR = W.icon("dir", 2.2),
    routeUrl = ""; /* the day's route, kept: the banner is drawn again more often than the day is (the cloud's status) */
  W.topLine = function (P) {
    if (!P || !P.stops || !P.stops.length) return "";
    var sk = W.sky(P),
      top = document.querySelector(".top"),
      day = W.bannerDay ? W.bannerDay(P) : null;
    if (top) {
      top.setAttribute("data-sky", sk ? sk.phase : "night");
      if (day) top.setAttribute("data-day", "1");
      else top.removeAttribute("data-day");
    }
    var bits = ['<span class="tl-hi">' + esc(W.greeting()) + "</span>"];
    if (sk && sk.time)
      bits.push(
        '<span class="tl-sky">' + (sk.phase === "day" || sk.phase === "dawn" ? SUN : MOON) + esc(sk.time + " in " + sk.city) + "</span>"
      );
    return (
      bits.join('<span class="tl-sep" aria-hidden="true">·</span>') +
      (day
        ? /* the town on its own line and the date and how full the day is on the next, always (v202, the owner: the
             banner was a different height from day to day, as a short "Rest day" fitted beside the town and a longer
             label did not): two lines, each kept to one line */
          '<span class="tl-day"><span class="tl-dt" aria-hidden="true"><b>' +
          esc(day.city) +
          '</b><span class="tl-meta">' +
          (day.date ? "<span>" + esc(day.date) + "</span>" : "") +
          (day.level ? "<span>" + day.level + "</span>" : "") +
          (day.date || day.level ? "" : "<span>&nbsp;</span>") +
          '</span></span><a class="tl-go"' +
          (routeUrl ? ' href="' + esc(routeUrl) + '"' : " hidden") +
          ' target="_blank" rel="noopener" aria-label="Open the whole route in Google Maps">' +
          DIR +
          "</a></span>"
        : "")
    );
  };
  /* the Day view knows the day's route once its stops are placed (screens/trip.js): it hands the link over */
  W.bannerRoute = function (url) {
    routeUrl = url || "";
    var a = /** @type {HTMLAnchorElement | null} */ (document.querySelector("#topline .tl-go"));
    if (!a) return;
    a.hidden = !routeUrl;
    if (routeUrl) a.href = routeUrl;
    else a.removeAttribute("href");
  };
  /* When the banner has scrolled away (a phone, the Day view): one slim row stays, with the logo, the city and where
     in the trip you are, and the day strip stays under it (the stylesheet pins that). A tap goes back to the top */
  var pinWatch = false;
  W.pinBar = function (P) {
    var el = document.getElementById("pin"),
      top = document.querySelector(".top");
    if (!el || !top) return;
    var day = W.bannerDay ? W.bannerDay(P) : null,
      cd = day && W.countdown ? W.countdown(P) : null;
    if (!day) {
      el.hidden = true;
      el.removeAttribute("data-on");
      return;
    }
    var where = cd && /^Day /.test(cd.line) ? cd.line : day.date;
    el.setAttribute("data-on", "1");
    el.setAttribute("aria-label", day.city + (where ? ", " + where : "") + ". Back to the top");
    var html =
      '<svg class="pin-logo" viewBox="0 0 676 140" aria-hidden="true"><use href="#wpMark"/></svg><b>' +
      esc(day.city) +
      "</b>" +
      (where ? "<span>" + esc(where) + "</span>" : "");
    if (el.innerHTML !== html) el.innerHTML = html;
    if (!pinWatch) {
      pinWatch = true;
      pinMeasure();
      window.addEventListener("scroll", pinSoon, { passive: true });
      window.addEventListener("resize", function () {
        pinMeasure();
        pinSoon();
      });
      el.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: smooth() });
      });
    }
    /* (looked at in the next frame, before it is painted: here, halfway through a redraw, asking where the banner is
       would make the browser lay out the page as it was, only for the rest of the redraw to change it again) */
    pinSoon();
  };
  /* The slim bar comes the moment the banner's bottom reaches the line the day strip sticks to (52 px below the
     top: the slim card and the gap above it, app.css .pin; plus the status bar's inset where the page is drawn under
     it), so the banner never slides on under nothing */
  var pinTop = 52,
    pinTick = 0;
  function pinMeasure() {
    var p = document.createElement("div");
    p.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)";
    document.body.appendChild(p);
    pinTop = 52 + p.offsetHeight;
    p.remove();
  }
  function pinCheck() {
    pinTick = 0;
    var el = document.getElementById("pin"),
      top = document.querySelector(".top");
    if (!el || !top) return;
    /* only on Trip, where the day strip sticks under it: Today, Plan and Prepare scroll on without it (the owner's call) */
    var show = el.hasAttribute("data-on") && (!W.view || W.view() === "trip") && top.getBoundingClientRect().bottom <= pinTop + 0.5;
    if (el.hidden === show) {
      el.hidden = !show;
      /* (the photo behind it is placed once it can be measured: lib/photos.js) */
      if (show && W.pinPhotoFit) W.pinPhotoFit();
    }
  }
  function pinSoon() {
    if (!pinTick) pinTick = requestAnimationFrame(pinCheck);
  }

  /* ======================= back to the top ======================= */
  /* A round ↑ in the bottom corner, with a gradient ring so it stands out from the cards. It comes when you turn
     back: far down a long screen, as soon as you scroll up; gone again when you carry on down (it sits where each
     row keeps its button, and would cover them), near the top, and while a sheet is open. Above the tab bar on a
     phone. */
  var upBtn = null,
    upTick = 0,
    upY = 0,
    upTurn = false;
  function smooth() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }
  W.smooth = smooth;
  function upCheck() {
    upTick = 0;
    var y = window.scrollY;
    /* (a few pixels either way are a thumb resting, not a turn) */
    if (y < upY - 6) upTurn = true;
    else if (y > upY + 6) upTurn = false;
    if (Math.abs(y - upY) > 6) upY = y;
    var on = upTurn && y > Math.max(600, window.innerHeight * 0.8) && !document.documentElement.classList.contains("modal-open");
    if (!upBtn) {
      if (!on) return;
      upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.id = "totop";
      upBtn.setAttribute("aria-label", "Back to the top");
      upBtn.title = "Back to the top";
      upBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
      upBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: smooth() });
        /* the keyboard goes to the top too (the button itself is about to hide) */
        var m = /** @type {HTMLElement | null} */ (document.querySelector("main:not([hidden])"));
        if (m) {
          if (!m.hasAttribute("tabindex")) m.setAttribute("tabindex", "-1");
          m.focus({ preventScroll: true });
        }
      });
      document.body.appendChild(upBtn);
      void upBtn.offsetWidth; /* (drawn once hidden, so it slides in) */
    }
    if (upBtn.classList.contains("on") === on) return;
    upBtn.classList.toggle("on", on);
    upBtn.tabIndex = on ? 0 : -1;
    upBtn.setAttribute("aria-hidden", on ? "false" : "true");
  }
  W.upCheck = upCheck; /* (for the tests) */
  window.addEventListener(
    "scroll",
    function () {
      if (!upTick) upTick = requestAnimationFrame(upCheck);
    },
    { passive: true }
  );
  window.addEventListener("resize", function () {
    if (!upTick) upTick = requestAnimationFrame(upCheck);
  });

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
    var box = host; /* (found or made above) */
    cheerT = setTimeout(
      function () {
        box.innerHTML = "";
      },
      opts.big ? 7000 : 3800
    );
  };
  W.warmTick = function (P) {
    if (W.readOnly) return;
    var reached = W.milestone(P);
    if (!reached) return;
    var m = reached,
      s = S(),
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
  /* (how ready you are, and the trip's memories: lib/memories.js, with the second script) */

  /* ======================= a light tap you can feel ======================= */
  /* a light tap you can feel when you tick something off, rate a day or switch views (phones that can vibrate) */
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target,
        b = t && t.closest ? t.closest("[data-tick],[data-pack],[data-vsw],[data-dsw]") : null;
      if (!b || b.disabled) return;
      try {
        if (navigator.vibrate && window.matchMedia("(pointer:coarse)").matches)
          navigator.vibrate(b.hasAttribute("data-tick") || b.hasAttribute("data-pack") ? 12 : 6);
      } catch (x) {}
    },
    true
  );
  /* ======================= taps ======================= */
  document.addEventListener(
    "click",
    function (e) {
      var b = e.target && e.target.closest && e.target.closest("button");
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
    },
    true
  );
})();
