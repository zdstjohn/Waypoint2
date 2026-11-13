/* Waypoint core: the trip's state and caches, small helpers, and the queue through which every question goes to Claude.
   What is asked lives beside it: lib/towns.js (destinations), lib/ideas.js (things to do and places to eat),
   lib/stays.js (how long, and where to stay) and lib/asks.js (the smaller questions). */
(function () {
  "use strict";
  var W = (window.W = window.W || /** @type {Waypoint} */ ({})); /* validate.js may have set up W.V first */
  /* the page is wrapped by its host, so the language is set here (screen readers pick the voice from it) */
  if (!document.documentElement.lang) document.documentElement.lang = "en";
  var STYLES = window.STYLES;
  W.STYLE_NAME = {};
  STYLES.forEach(function (s) {
    W.STYLE_NAME[s[0]] = s[1];
  });
  W.$ = function (id) {
    return document.getElementById(id);
  };
  /** A choice kept on this phone only (Simple view, light or dark): saved under its key, or forgotten when empty.
   *  @param {string} key @param {string} v */
  function remember(key, v) {
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch (e) {
      /* (storage is blocked, a private window: the choice lasts for this visit) */
    }
  }
  /* Simple view (this phone only, so it holds in a shared trip too): no photos, no street map, fewer words. The switch
     is in the trip menu and Settings; html.simple hides the extra lines (app.css), W.picture draws no photo and the
     Trip screen no map */
  var SIMPLE = (function () {
    try {
      return localStorage.getItem("waypoint-simple") === "1";
    } catch (e) {
      return false;
    }
  })();
  document.documentElement.classList.toggle("simple", SIMPLE);
  W.simple = function () {
    return SIMPLE;
  };
  W.setSimple = function (on) {
    SIMPLE = !!on;
    document.documentElement.classList.toggle("simple", SIMPLE);
    remember("waypoint-simple", SIMPLE ? "1" : "");
    if (W.render) W.render();
  };
  /* Light or dark (this phone only, like Simple view): "" follows the phone (or the page around the app, which can set
     data-theme on the root itself); "light" or "dark" is the person's own choice and wins over both. The styles read
     data-theme (app.css), and so do the map's colours (lib/vtmap.js palette) and Explore's map picture. */
  var root = document.documentElement,
    THEME = (function () {
      try {
        var v = localStorage.getItem("waypoint-theme");
        return v === "light" || v === "dark" ? v : "";
      } catch (e) {
        return "";
      }
    })(),
    hostTheme = root.getAttribute("data-theme");
  function applyTheme() {
    var v = THEME || hostTheme;
    if (v) root.setAttribute("data-theme", v);
    else root.removeAttribute("data-theme");
    /* the phone's status bar in the installable app: its two tags give the light and the dark colour by the phone's
       setting; a choice of its own puts its colour in both (the first time, each tag's own colour is kept in data-c) */
    var tags = document.querySelectorAll('meta[name="theme-color"][media]'),
      own = /** @type {Record<string, string>} */ ({});
    tags.forEach(function (m) {
      if (!m.hasAttribute("data-c")) m.setAttribute("data-c", m.getAttribute("content") || "");
      own[/dark/.test(m.getAttribute("media") || "") ? "dark" : "light"] = m.getAttribute("data-c") || "";
    });
    tags.forEach(function (m) {
      m.setAttribute("content", (THEME && own[THEME]) || m.getAttribute("data-c") || "");
    });
  }
  applyTheme();
  /* the page around the app may change its own theme later: remember it, and keep the person's choice on top */
  if (window.MutationObserver)
    new MutationObserver(function () {
      var now = root.getAttribute("data-theme");
      if (THEME && now === THEME) return; /* (our own) */
      hostTheme = now;
      if (THEME) applyTheme();
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  W.theme = function () {
    return THEME;
  };
  W.setTheme = function (v) {
    THEME = v === "light" || v === "dark" ? v : "";
    remember("waypoint-theme", THEME);
    applyTheme();
    /* (a switch drawn outside the screen, the trip menu's, shows the choice at once) */
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-theme-set") || "") === THEME));
    });
    if (W.render) W.render();
  };
  /* the three-way choice, the same wherever it shows (bare: just the choice, under a card's own title) */
  W.themeSwitch = function (bare) {
    var opt = function (/** @type {string} */ v, /** @type {string} */ t) {
      return '<button type="button" data-theme-set="' + v + '" aria-pressed="' + (THEME === v) + '">' + t + "</button>";
    };
    var seg =
      '<div class="seg" role="group" aria-label="Light or dark">' +
      opt("", "Auto") +
      opt("light", "Light") +
      opt("dark", "Dark") +
      "</div>";
    return bare
      ? '<div class="theme-sw bare">' + seg + "</div>"
      : '<div class="theme-sw"><span class="sw-t"><b>Light or dark</b><span class="small muted">Auto follows your phone. This phone only.</span></span>' +
          seg +
          "</div>";
  };
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-theme-set]");
    if (!b) return;
    e.preventDefault();
    W.setTheme(b.getAttribute("data-theme-set") || "");
  });
  /* the switch, the same wherever it shows */
  W.simpleSwitch = function () {
    return (
      '<button type="button" class="simple-sw" role="switch" aria-checked="' +
      SIMPLE +
      '" data-simple="1"><span class="sw-t"><b>Simple view</b>' +
      '<span class="small muted">Just the plan: no photos, no maps, fewer words. This phone only.</span></span><span class="tg" aria-hidden="true"><i></i></span></button>'
    );
  };
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-simple]");
    if (!b) return;
    e.preventDefault();
    W.setSimple(!SIMPLE);
  });
  W.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  /** text at most `n` letters long, cut at a word with "…" ("On the Colosseum…", never "On the Colosseum t")
      @param {string} s @param {number} n */
  W.clip = function (s, n) {
    var t = String(s == null ? "" : s).trim();
    if (t.length <= n) return t;
    var cut = t.slice(0, n - 1),
      sp = cut.lastIndexOf(" ");
    return (sp > n * 0.4 ? cut.slice(0, sp) : cut).replace(/[\s,;:·–-]+$/, "") + "…";
  };
  /* called for every name on every redraw; the last few thousand answers are kept */
  var normCache = Object.create(null),
    normN = 0;
  W.norm = function (s0) {
    var s = String(s0 || "");
    var h = normCache[s];
    if (h !== undefined) return h;
    if (normN > 4000) {
      normCache = Object.create(null);
      normN = 0;
    }
    normN++;
    return (normCache[s] = s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim());
  };
  /* a link that opens in a new tab */
  W.extLink = function (url, txt, cls) {
    return "<a" + (cls ? ' class="' + cls + '"' : "") + ' href="' + W.esc(url) + '" target="_blank" rel="noopener">' + txt + "</a>";
  };
  /* "just now", "5 min ago", "3 h ago", "2 d ago", then the date */
  W.ago = function (t) {
    if (!t) return "";
    var m = Math.round((Date.now() - t) / 6e4);
    return m < 2
      ? "just now"
      : m < 60
        ? m + " min ago"
        : m < 1440
          ? Math.round(m / 60) + " h ago"
          : m < 10080
            ? Math.round(m / 1440) + " d ago"
            : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  /** a script from elsewhere; with integrity (its sha384), the browser runs it only if it is exactly that file
      @param {string} src @param {string} [integrity] */
  W.loadScript = function (src, integrity) {
    return new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = src;
      s.charset = "utf-8";
      if (integrity) {
        s.integrity = integrity;
        s.crossOrigin = "anonymous";
      }
      s.onload = ok;
      s.onerror = bad;
      document.head.appendChild(s);
    });
  };

  /* ---------- state (the trip) ---------- */
  var DEFAULT = {
    v: 2,
    styles: ["culture", "food", "relax"],
    countries: [{ name: "Italy", mode: "manual", picked: ["Rome", "Florence", "Venice"] }],
    days: 10,
    start: "",
    depart: "Los Angeles (LAX)",
    travelers: [38, 36, 6, 3],
    stays: {},
    picks: {},
    seen: {},
    day: 1,
    cityDays: {}
  };
  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  }
  /* an offline copy (one file with the trip inside) starts from the trip it carries; after that, edits made in the file stay */
  var SEED = window.__WP_OFFLINE || null,
    seeded = load("waypoint-offline-seeded");
  if (SEED && SEED.S && seeded !== SEED.at) {
    try {
      localStorage.setItem("waypoint-v2", JSON.stringify(SEED.S));
      localStorage.setItem("waypoint-cache-v2", JSON.stringify(SEED.C || {}));
      localStorage.setItem("waypoint-offline-seeded", JSON.stringify(SEED.at));
    } catch (e) {}
  }
  var s = load("waypoint-v2");
  /* a copy shows the trip inside it, whatever the phone's storage does (a downloaded file is often given none, and then
     the copy used to open on the example trip) */
  if (SEED && SEED.S && !(s && s.v === 2)) s = JSON.parse(JSON.stringify(SEED.S));
  W.S = s && s.v === 2 ? s : JSON.parse(JSON.stringify(DEFAULT));
  /* the example trip, until you change it: marked in the state, so it is still the example after a reload (signing in
     reloads the page; it used to count as a trip of yours then, and went up to your account) */
  if (!s) W.S.example = 1;
  W.isExample = !s || !!W.S.example;
  /* the example's own plan (where, when, who, for how long): once any of it changes, it is your trip (W.save) */
  function planSig(/** @type {any} */ st) {
    return JSON.stringify([st.countries, st.days, st.start, st.depart, st.travelers, st.styles, st.stays, st.cityDays]);
  }
  var exampleSig = W.S.example ? planSig(W.S) : "";
  if (!W.S.cityDays) W.S.cityDays = {}; /* days you set for each place */
  var c = load("waypoint-cache-v2") || (SEED && SEED.C) || {};
  W.C = /** @type {Cache} */ ({
    country: c.country || {},
    city: c.city || {},
    geo: c.geo || {},
    area: c.area || {},
    range: c.range || {},
    legs: c.legs || {},
    cost: c.cost || {},
    tz: c.tz || {},
    events: c.events || {},
    fare: c.fare || {}
  });
  var lastS = null,
    lastV = -1;
  /* a write this device refused (its storage for the app is full): say so in the banner and the error log, once. Before
     giving up, the saved ideas are cut down to this trip's (writeCache); the trip itself is never cleared. */
  W.caught = function () {}; /* (lib/errlog.js replaces this: an error the app carries on from still goes to the log) */
  W.storeFailed = function (e) {
    if (W.localFull) return;
    W.localFull = true;
    if (W.logError) W.logError("storage: this device refused a save (" + ((e && e.name) || "error") + ")", "save");
    if (W.renderBar && W.P)
      try {
        W.renderBar(W.P);
      } catch (x) {
        W.caught(x, "trip bar");
      }
  };
  /* The ideas as this device's storage entry holds them: what the trip on screen uses, the rest being in IndexedDB
     (lib/ideastore.js; all of it where there is none). Refused because the entry is full, it is written again with only
     this trip's places: the others stay in memory, and are asked for again when their trip is next opened. */
  var lastC = ""; /* (what was last written: a change to the trip that brought no new ideas writes nothing) */
  function writeCache(force) {
    if (!force) {
      try {
        var cj = JSON.stringify(W.cacheSlim ? W.cacheSlim(false) : W.C);
        /* (and only skipped while the entry is still the one written: signing in or out puts entries away) */
        if (cj !== lastC || (localStorage.getItem("waypoint-cache-v2") || "").length !== cj.length) {
          localStorage.setItem("waypoint-cache-v2", cj);
          lastC = cj;
        }
        return;
      } catch (e) {
        if (!W.cacheSlim) throw e;
      }
    }
    if (!W.cacheSlim) throw new Error("full");
    lastC = JSON.stringify(W.cacheSlim(true));
    localStorage.setItem("waypoint-cache-v2", lastC);
    if (W.logError && !W.cacheCut) {
      W.cacheCut = true;
      W.logError("storage: this device's saved ideas were cut down to the trip on screen (its storage was full)", "save");
    }
  }
  /** the saved ideas are written again at the next save (lib/ideastore.js, once everything is in IndexedDB) */
  W.cacheDirty = function () {
    lastV = -1;
  };
  W.save = function () {
    if (/** @type {any} */ (window).__WP_AWAY) return; /* (signing out: your trips were put away, the page reloads; lib/cloud.js) */
    /* someone else's shared trip: look, don't keep (planning together sends your changes to its owner instead) */
    if (W.readOnly) {
      if (W.readOnly.edit && W.coPush) W.coPush();
      return;
    }
    if (W.S.example && planSig(W.S) !== exampleSig) {
      delete W.S.example;
      W.isExample = false;
    }
    var wrote = false,
      failed = false,
      js = JSON.stringify(W.S);
    try {
      if (js !== lastS) {
        localStorage.setItem("waypoint-v2", js);
        lastS = js;
        wrote = true;
      }
    } catch (e) {
      /* no room for the trip itself: make room by cutting the saved ideas down to this trip's, and try once more */
      try {
        writeCache(true);
        lastV = W.dataV;
        localStorage.setItem("waypoint-v2", js);
        lastS = js;
        wrote = true;
      } catch (e2) {
        failed = true;
        W.storeFailed(e2);
      }
    }
    /* the ideas are big (lists for every place); they are written only when data has arrived since the last save */
    try {
      if (W.dataV !== lastV) {
        writeCache(false);
        lastV = W.dataV;
        wrote = true;
      }
    } catch (e) {
      failed = true;
      W.storeFailed(e);
    }
    if (wrote && !failed) W.localFull = false; /* there is room again */
    if (W.afterSave) W.afterSave();
  };

  /* ---------- geo helpers ---------- */
  W.km = function (a, b) {
    if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
    var R = 6371,
      r = Math.PI / 180,
      dLa = (b.lat - a.lat) * r,
      dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  /* time between two points inside a city, worked out from the distance alone (the planner uses this one, so the same
     places always give the same plan) */
  W.legEst = function (a, b) {
    var d = W.km(a, b);
    if (d == null) return null;
    if (d < 1.3) return { d: d, mode: "walking", min: Math.max(3, Math.round(((d * 1.3) / 4.8) * 60)), label: "walk" };
    if (d < 30) return { d: d, mode: "transit", min: Math.round(8 + ((d * 1.3) / 18) * 60), label: "transit" };
    return { d: d, mode: "driving", min: Math.round((d / 60) * 60 + 10), label: "drive or train" };
  };
  /* the same, with Google's own time where it has been asked (lib/gmaps.js, through the viewer's Google Maps
     connection). Real times travel with the trip as S.rl: "from>to" (pins to 4 decimals, base 36) -> [minutes, km x 10,
     0 walk | 1 transit | 2 drive | 3 drive where transit was asked, the day it was asked]; 0 minutes = Google has no
     route, so the estimate stands. A pair with no real time yet is handed to W.legAsk, but only while a day is being
     drawn for the viewer (W.legWant: the planner trying out places, and the other days' summaries, ask for nothing)
     and not when quiet is set (lists of ideas and search results show what is known). */
  var RL_MODE = ["walking", "transit", "driving", "driving"],
    RL_LABEL = ["walk", "transit", "drive", "drive or taxi"];
  function rl36(n) {
    return Math.round(n * 1e4).toString(36);
  }
  W.rlKey = function (a, b) {
    return rl36(a.lat) + "," + rl36(a.lng) + ">" + rl36(b.lat) + "," + rl36(b.lng);
  };
  W.legReal = 0; /* how many real times the screens have shown (W.legNote compares two readings) */
  W.legWant = 0; /* above 0 while a day is being drawn for the viewer (Today, the Trip screen's day): only then is a missing time asked for */
  W.leg = function (a, b, quiet) {
    if (!a || !b) return null;
    var e = W.legEst(a, b);
    if (!e) return e;
    var k = W.rlKey(a, b),
      v = (W.S.rl && W.S.rl[k]) || (W.rlOwn && W.rlOwn[k]);
    if (v && v[0] > 0) {
      W.legReal++;
      return { d: e.d, mode: RL_MODE[v[2]] || e.mode, min: v[0], label: RL_LABEL[v[2]] || e.label, real: true, km: v[1] / 10 };
    }
    if (!v && !quiet && W.legWant > 0 && W.legAsk) W.legAsk(k, a, b, e);
    return e;
  };
  /* under a list that showed Google's times since the reading n0: whose they are, and Google's own caution about its
     walking routes (its routes tool asks every app to show it) */
  W.legNote = function (n0) {
    return W.legReal > n0
      ? '<p class="small muted gm-note">Times between stops are from Google Maps. Its walking routes are in beta: a pavement or footpath may be missing.</p>'
      : "";
  };
  W.fmtMin = function (m) {
    return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
  };
  /** for a time counted on past midnight (minutes from the day's own midnight): "" the same day, " next day", or
      " two days later" @param {number} m */
  W.dayAfter = function (m) {
    return m >= 2880 ? " two days later" : m >= 1440 ? " next day" : "";
  };
  W.fmtKm = function (d) {
    return d < 1 ? Math.round((d * 1000) / 50) * 50 + " m" : (d < 10 ? d.toFixed(1) : Math.round(d)) + " km";
  };
  W.flightHrs = function (d) {
    return Math.max(1, Math.round((d / 780 + 0.7) * 2) / 2);
  };
  W.betweenCities = function (d) {
    if (d == null) return "";
    if (d < 160) return "~" + Math.max(1, Math.round(d / 70)) + "h by car or train";
    if (d < 480) return "~" + Math.round(d / 110 + 0.5) + "h by train or car";
    if (d < 1500) return "short flight or ferry";
    return "~" + W.flightHrs(d) + "h flight";
  };
  /** directions in Google Maps from a to b; with no a (no stay picked yet), from wherever you are */
  W.gmapsDir = function (a, b, mode) {
    var o = W.dirPoint(a),
      d = W.dirPoint(b) || b.n || b.label || "";
    mode = MODES[mode || ""] || mode;
    return (
      "https://www.google.com/maps/dir/?api=1" +
      (o ? "&origin=" + encodeURIComponent(o) : "") +
      "&destination=" +
      encodeURIComponent(d) +
      "&travelmode=" +
      (mode || "transit")
    );
  };
  /** A place as Google Maps directions take it: its pin; a stay you named whose place isn't known yet (pending) by
      its name and town, never the middle of the town under the hotel's name; a stay not picked (none) is nothing,
      so the directions start from where the phone is. @param {any} p @returns {string} */
  W.dirPoint = function (p) {
    if (!p || p.none) return "";
    if (p.pending || p.lat == null) {
      var nm = p.label || p.n || "";
      return nm && p.city && nm.indexOf(p.city) < 0 ? nm + ", " + p.city : nm;
    }
    return p.lat + "," + p.lng;
  };
  /* (the app's own names for ways of getting about, as Google Maps spells them) */
  var MODES = /** @type {Record<string, string>} */ ({
    walk: "walking",
    walking: "walking",
    drive: "driving",
    car: "driving",
    bike: "bicycling"
  });
  /** the whole day in Google Maps: from where you stay, every stop in order (its pin, or else its name and town), and
      back. Driving when any stop is more than a walk away (Google Maps takes no stops on a transit route). */
  W.dayRouteUrl = function (day, stops, home) {
    function at(p) {
      return p.lat != null ? p.lat + "," + p.lng : (p.n || p.label) + ", " + day.city;
    }
    var nine = stops.slice(0, 9),
      /* no stay picked yet: the route runs from the first stop to the last (the middle of the town is nobody's address) */
      open = !!(home && home.none) && nine.length > 0,
      mid = open ? nine.slice(1, -1) : nine,
      ids = mid.map(function (p) {
        return p.gid || "";
      });
    var o = open
        ? at(nine[0])
        : home && home.lat != null && !home.pending
          ? home.lat + "," + home.lng
          : (home && home.label ? home.label : day.city) + ", " + day.city,
      end = open ? at(nine[nine.length - 1]) : o;
    var prev = home,
      far = false;
    stops.forEach(function (p) {
      var d = prev && W.km(prev, p);
      if (d != null && d > 1.3) far = true;
      if (p.lat != null) prev = p;
    });
    return (
      "https://www.google.com/maps/dir/?api=1&origin=" +
      encodeURIComponent(o) +
      "&destination=" +
      encodeURIComponent(end) +
      (mid.length ? "&waypoints=" + encodeURIComponent(mid.map(at).join("|")) : "") +
      /* Google's own IDs for the stops it knows, so each stop opens as the real listing (one per waypoint, blanks for the rest) */
      (ids.some(Boolean) ? "&waypoint_place_ids=" + encodeURIComponent(ids.join("|")) : "") +
      "&travelmode=" +
      (far ? "driving" : "walking")
    );
  };
  /* a place on Google Maps: by its place ID when the nightly check has found it (the exact listing), else by name and town.
     Takes a place ({n, gid}) or a name. */
  W.gmapsPlace = function (name, city, gid) {
    if (name && typeof name === "object") {
      gid = gid || name.gid;
      name = name.n || name.label || "";
    }
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(name + ", " + city) +
      (gid ? "&query_place_id=" + encodeURIComponent(gid) : "")
    );
  };

  W.airport = function () {
    var v = (W.S.depart || "").trim().toLowerCase();
    if (!v) return null;
    var m = (window.AIRPORTS || []).filter(function (a) {
      var label = (a[0] + " (" + a[1] + ")").toLowerCase();
      return label === v || a[1].toLowerCase() === v || a[0].toLowerCase() === v || label.indexOf(v) === 0;
    })[0];
    if (m) return { name: m[0], code: m[1], lat: m[2], lng: m[3] };
    return {
      name: W.S.depart.trim(),
      code:
        W.S.depart
          .trim()
          .replace(/[^A-Za-z]/g, "")
          .slice(0, 3)
          .toUpperCase() || "—"
    };
  };
  W.ages = function () {
    return W.S.travelers
      .filter(function (a) {
        return a !== "" && !isNaN(a);
      })
      .map(Number);
  };
  W.party = function () {
    var a = W.ages(),
      minA = a.length ? Math.min.apply(null, a) : 30;
    /* senior: grandparents along (65 and over): shorter days on foot, no steep or strenuous outings, fewer hotel moves */
    return {
      toddler: minA < 5,
      kid: minA < 12,
      senior: a.some(function (x) {
        return x >= 65;
      }),
      adults: a.filter(function (x) {
        return x >= 18;
      }).length,
      kids: a.filter(function (x) {
        return x < 18;
      })
    };
  };

  /* ---------- Claude ---------- */
  W.SAMPLE = null;
  W.sampleState = "waiting"; /* waiting | on | off */
  W.status = {}; /* key -> "loading" | error message */
  var queue = [],
    running = 0,
    listeners = [];
  W.onData = function (fn) {
    listeners.push(fn);
  };
  W.dataV = 0; /* goes up whenever cached data arrives or the state is reported changed; the planner reuses its last plan until it does */
  /* (asked counts the redraws asked for, shown the ones a full redraw has already answered: everything listening was
     told after them, so the batched redraw still to come for them has nothing left to show; see flush) */
  var asked = 0,
    shown = 0;
  function tell() {
    if (!W.typingHeld || !W.typingHeld()) shown = asked; /* (a box being typed in holds the screen's redraw back) */
    listeners.forEach(function (fn) {
      fn();
    });
  }
  function changed() {
    W.dataV++;
    W.save();
    tell();
  }
  W.changed = changed;
  /** W.changed in steps, for a change that comes on its own (the second script arriving, lib/later.js): the planner is
      told at once (dataV), the plan is made in the next task and the screen drawn from it in the one after. On a slow
      phone those are three shorter stretches the page can't answer a tap in, not one long one; a tap in between gets
      the new plan, and a full redraw meanwhile (the tap's) leaves nothing more to draw */
  W.changedApart = function () {
    W.dataV++;
    var was = ++asked;
    setTimeout(function () {
      if (shown >= was) return; /* (drawn meanwhile) */
      if (W.P && W.planFresh && !W.planFresh() && !(W.typingHeld && W.typingHeld())) W.plan();
      setTimeout(function () {
        if (shown >= was) return;
        W.save();
        tell();
      }, 0);
    }, 0);
  };
  /* answers arriving: the planner is told at once (dataV), but the screen is redrawn once for the whole burst, after the
     frame already on its way has painted. A tap that opens a screen asking for five lists paints its screen first and
     fills in once, instead of redrawing (and replanning) five times before the first frame. A burst is everything that
     arrives with less than QUIET ms between one answer and the next, drawn at most MAXWAIT ms after its first answer
     (a follow-up question asked by that redraw waits no longer than that):
     answers read back from this device or the account come dozens at a time, and were each a re-plan and a redraw.
     On a slow phone a re-plan and a redraw together are one long stretch the page can't answer a tap in, so when the
     burst needs a new plan, it is made first and the screen drawn from it in the next task (a tap in between gets
     the new plan too). A burst a full redraw has answered meanwhile (W.changed) draws nothing more. */
  var flushPending = false,
    firstAt = 0,
    lastAt = 0,
    QUIET = 100,
    MAXWAIT = 300;
  function flush() {
    flushPending = false;
    if (shown === asked) {
      W.save();
      return;
    }
    if (W.planFresh && W.P && !W.planFresh() && !(W.typingHeld && W.typingHeld())) {
      var was = asked;
      W.plan();
      setTimeout(function () {
        if (shown >= was) return; /* (drawn meanwhile) */
        W.save();
        tell();
      }, 0);
      return;
    }
    W.save();
    tell();
  }
  function redraw() {
    asked++;
    lastAt = Date.now();
    if (flushPending) return;
    flushPending = true;
    firstAt = lastAt;
    settle();
  }
  function settle() {
    var now = Date.now(),
      ms = Math.min(lastAt + QUIET - now, firstAt + MAXWAIT - now);
    if (ms > 0) {
      setTimeout(settle, ms);
      return;
    }
    var later = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(flush, { timeout: 300 });
      else setTimeout(flush, 50);
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(later);
    else later();
  }
  /** the screen drawn again for something that changes how it looks but not the plan (a photo, the street map
      coming or going): no re-plan, and drawn once with whatever else arrives with it */
  W.redraw = redraw;
  function arrived() {
    W.dataV++;
    redraw();
  }
  W.arrived = arrived; /* (for the files that ask Claude: lib/asks.js) */

  try {
    if (window.claude && window.claude.use) {
      /* (Claude's answer to whether it can be asked comes on its own, as the first screen is drawn or just after: the
         plan it calls for, which asks for what is missing, and the screen drawn from it follow in tasks of their own) */
      window.claude.use("sample").then(
        function (smp) {
          W.SAMPLE = smp;
          W.sampleState = smp ? "on" : "off";
          W.changedApart();
        },
        function () {
          W.sampleState = "off";
          W.changedApart();
        }
      );
    } else W.sampleState = "off";
  } catch (e) {
    W.sampleState = "off";
  }
  setTimeout(function () {
    if (W.sampleState === "waiting") {
      W.sampleState = "off";
      changed();
    }
  }, 12000);

  /** the options a request is made with: the model tier, and (W.EFFORT, by the request's kind) how much Claude thinks
      first @param {string} key @param {string} [tier] */
  W.askOpts = function (key, tier) {
    var o = /** @type {any} */ ({ modelTier: tier || "default" }),
      e = W.EFFORT && W.EFFORT[String(key).split("|")[0]];
    if (e) o.effort = e;
    return o;
  };
  /* how much Claude thinks before writing, by kind of request ("spots", "food", "country"): empty = the platform's own
     setting. Filled only after measuring (lib/speedtest.js) */
  W.EFFORT = {};
  /* The questions themselves, word for word, and what is done with each answer are not in the first script: they are
     only needed once Claude is asked (the "ask" piece: lib/ideasask.js, lib/staysask.js, lib/asksask.js fill W.ASKS;
     W.ASK_X is what those files use from the loaders'). A loader names its question ({ ask, a }: the entry and what
     it had at hand); the request is marked as loading at once, as ever, and is sent when the piece is in (it is asked
     for there and then, and comes by itself after the first screen). */
  /** @type {Record<string, { q: (...a: any[]) => string, ok: (...a: any[]) => (r: any) => void, stream?: (...a: any[]) => any }>} */
  W.ASKS = {};
  /** @type {Record<string, any>} */
  W.ASK_X = {};
  /** @type {{ key: string, go: () => void, words: () => boolean }[]} */
  var unworded = [];
  /** the "ask" piece is in: the questions that waited for their words go to the queue, in the order they were asked */
  W.asksIn = function () {
    var h = unworded;
    unworded = [];
    h.forEach(function (q) {
      if (q.words()) queue.push(q);
      else unworded.push(q);
    });
    pump();
  };
  /** @param {string} key @param {string | { ask: string, a: any[], lib?: { place: string[], kind: string } }} prompt the question, or the name of one in
      W.ASKS with what its words and its answer need @param {string} tier @param {(r: any) => void} [onOk0]
      @param {{ list: string, take: (items: any[], head: any) => void, min?: number }} [stream] a list in the answer
      whose items are handed over as they are written (take), min at a time, before the whole answer comes (onOk) */
  function run(key, prompt, tier, onOk0, stream) {
    /* one request per key: a failed one waits for an explicit "Try again" instead of retrying on every redraw */
    if (W.status[key] || !W.SAMPLE || W.readOnly) return;
    W.status[key] = "loading";
    var named = typeof prompt === "string" ? null : prompt,
      text = typeof prompt === "string" ? prompt : "",
      onOk = onOk0 || function () {},
      /* a question the city library may already hold the answer to (lib/citylib.js): its place and kind */
      lib = named && named.lib,
      libQ = /** @type {any} */ (null);
    /* a named question's words, its answer's handler and its stream, once the piece that holds them is in */
    var words = function () {
      if (!named) return true;
      var def = W.ASKS[named.ask];
      if (!def) return false;
      text = def.q.apply(null, named.a);
      onOk = def.ok.apply(null, named.a);
      stream = def.stream ? def.stream.apply(null, named.a) : undefined;
      named = null;
      if (lib && W.libFor) libQ = W.libFor(lib, text);
      return true;
    };
    var entry = {
      key: key,
      words: words,
      go: function () {
        running++;
        if (libQ && W.libGet) {
          var q = libQ;
          libQ = null;
          W.libGet(q, function (r) {
            if (!r) return ask(q);
            /* answered from the library: the same handler and checks as Claude's answer, at once */
            delete W.status[key];
            try {
              onOk(r);
            } catch (e) {
              /* an answer kept in a shape this version can't take: Claude is asked instead */
              W.caught(e, "library answer for " + String(key).split("|")[0]);
              W.status[key] = "loading";
              return ask(null);
            }
            if (W.libNote) W.libNote(q);
            running--;
            arrived();
            pump();
          });
          return;
        }
        ask(null);
      }
    };
    /** ask Claude (lib: the library question whose answer is then kept for everyone) @param {any} libAsk */
    function ask(libAsk) {
      var opts = W.askOpts(key, tier);
      var st = /** @type {{ list: string, take: (items: any[], head: any) => void, min?: number }} */ (stream);
      if (st) {
        var at = 0,
          held = /** @type {any[]} */ ([]),
          last = 0,
          head = null;
        opts.onText = function (u) {
          try {
            var got = W.partialList((u && u.text) || "", st.list, at);
            at = got.next;
            if (got.head) head = got.head;
            held = held.concat(got.items);
            var now = Date.now();
            if (held.length >= (st.min || 3) || (held.length && last && now - last > 2500)) {
              var batch = held;
              held = [];
              last = now;
              st.take(batch, head || {});
              arrived();
            }
          } catch (e) {
            W.caught(e, "ideas as they are written");
          }
        };
      }
      W.SAMPLE.json(text, opts)
        .then(
          function (res) {
            delete W.status[key];
            /* an answer in a shape nobody expected must not jam the queue: the request ends either way (the
                 step after this frees its place), the fault is logged, and the screen offers to try again */
            try {
              onOk(res);
              if (libAsk && W.libSave) W.libSave(libAsk, res);
            } catch (e) {
              W.caught(e, "answer for " + String(key).split("|")[0]);
              W.status[key] = "Couldn't load this. Try again.";
            }
          },
          function (err) {
            var code = err && err.code;
            if (code === "not_granted") {
              W.sampleState = "off";
              delete W.status[key];
            } else W.status[key] = code === "rate_limited" ? "Busy right now. Try again in a minute." : "Couldn't load this. Try again.";
          }
        )
        .then(function () {
          running--;
          arrived();
          pump();
        });
    }
    if (words()) queue.push(entry);
    else {
      unworded.push(entry);
      if (W.loadPiece) W.loadPiece("ask");
    }
    soon();
    pump();
  }
  /* the "loading" marks: shown once the current frame has painted (a status is not data, the plan stands) */
  function soon() {
    redraw();
  }
  /* nothing is asked of Claude while offline (or in an offline copy); the queue waits for the signal to come back */
  /* what goes first: the city on screen before the others, its main lists (sights, places to eat, breakfast) before the
     second lists and the extras (hidden gems, rainy-day ideas, links, events, costs). Anything you asked for yourself
     (a search, a replan, the plan check, an address) and the small plan-shaping answers go straight to the front. */
  var MAIN = { spots: 1, food: 1 },
    SOON = { pins: 1, fame: 1, lodge: 1, eatfit: 1, eatmore: 1 },
    LATE = { gems: 1, indoor: 1, links: 1, events: 1, cost: 1 };
  function onScreen() {
    var P = W.P,
      out = {};
    if (!P || !P.days || !P.days.length) return out;
    var add = function (d) {
      if (d && d.city) out[W.cityKey(d.country, d.city)] = 1;
    };
    add(P.days[Math.max(0, Math.min(P.days.length, +W.S.day || 1) - 1)]);
    if (W.isToday)
      P.days.forEach(function (d) {
        if (W.isToday(d)) add(d);
      });
    if (!Object.keys(out).length) add(P.days[0]);
    return out;
  }
  /* what is asked for ahead (a city Plan offers, lib/ideas.js W.warmCity): last, until someone needs it */
  var low = /** @type {Record<string, 1>} */ ({});
  /** @param {string[]} keys */
  W.loadLow = function (keys) {
    keys.forEach(function (k) {
      if (!W.status[k]) low[k] = 1;
    });
  };
  /** @param {string[]} keys */
  W.loadNow = function (keys) {
    var moved = false;
    keys.forEach(function (k) {
      if (low[k]) moved = !!delete low[k];
    });
    if (moved) pump();
  };
  function prio(key, here) {
    if (low[key]) return 9;
    var p = String(key).split("|"),
      kind = p[0];
    if (!MAIN[kind] && !SOON[kind] && !LATE[kind]) return 0;
    var mine = !!here[p[1] + "|" + p[2]],
      second = p[3] === "b";
    if (MAIN[kind]) return mine ? (second ? 2 : 1) : second ? 5 : 4;
    if (SOON[kind]) return mine ? 3 : 6;
    return mine ? 5 : 7;
  }
  W.loadPrio = function (key) {
    return prio(key, onScreen());
  };
  /* how many at once: three inside Claude; six in the installable app, whose own server has room for more */
  function maxRunning() {
    return W.cloud ? 6 : 3;
  }
  function pump() {
    if (W.holdLoads || !navigator.onLine || window.__WP_OFFLINE) return;
    var here = null;
    while (running < maxRunning() && queue.length) {
      here = here || onScreen();
      var best = 0,
        bp = prio(queue[0].key, here);
      for (var i = 1; i < queue.length && bp > 0; i++) {
        var q = prio(queue[i].key, here);
        if (q < bp) {
          bp = q;
          best = i;
        }
      }
      /* what is only asked ahead leaves one place free, for whatever someone asks for next */
      if (bp === 9 && running >= maxRunning() - 1) break;
      queue.splice(best, 1)[0].go();
    }
  }
  W.pump = pump;
  /* after waiting for saved ideas from your account: forget the requests made meanwhile, and ask again only for what's still missing */
  W.releaseLoads = function () {
    if (!W.holdLoads) return;
    W.holdLoads = false;
    if (!running) {
      /* (the lists are asked for again from the plan; something you asked for yourself, a plan check or a briefing say,
         is not: it stays in line and goes now) */
      var yours = function (/** @type {{ key: string }} */ q) {
        var kind = String(q.key).split("|")[0];
        return !MAIN[kind] && !SOON[kind] && !LATE[kind];
      };
      /* (the same for a question still waiting for its words) */
      unworded = unworded.filter(yours);
      var mine = queue.filter(yours).concat(unworded);
      queue.length = 0;
      Object.keys(W.status).forEach(function (k) {
        if (
          W.status[k] === "loading" &&
          !mine.some(function (q) {
            return q.key === k;
          })
        )
          delete W.status[k];
      });
      mine.forEach(function (q) {
        if (unworded.indexOf(q) < 0) queue.push(q);
      });
    }
    /* (planned and drawn with the saved ideas that came, or with whatever else arrives meanwhile: the asks for
       what is still missing go out from that plan) */
    arrived();
    pump();
  };
  W.run = run;
})();
