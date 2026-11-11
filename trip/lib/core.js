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
    try {
      if (SIMPLE) localStorage.setItem("waypoint-simple", "1");
      else localStorage.removeItem("waypoint-simple");
    } catch (e) {}
    if (W.render) W.render();
  };
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
      return JSON.parse(localStorage.getItem(key));
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
  W.isExample = !s;
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
    events: c.events || {}
  });
  var lastS = null,
    lastV = -1;
  /* a write this device refused (its storage for the app is full): say so in the banner and the error log, once. Before
     giving up, the saved ideas are cut down to this trip's (writeCache); the trip itself is never cleared. */
  W.storeFailed = function (e) {
    if (W.localFull) return;
    W.localFull = true;
    if (W.logError) W.logError("storage: this device refused a save (" + ((e && e.name) || "error") + ")", "save");
    if (W.renderBar && W.P)
      try {
        W.renderBar(W.P);
      } catch (x) {}
  };
  /* The ideas as this device's storage entry holds them: what the trip on screen uses, the rest being in IndexedDB
     (lib/ideastore.js; all of it where there is none). Refused because the entry is full, it is written again with only
     this trip's places: the others stay in memory, and are asked for again when their trip is next opened. */
  function writeCache(force) {
    if (!force) {
      try {
        localStorage.setItem("waypoint-cache-v2", JSON.stringify(W.cacheSlim ? W.cacheSlim(false) : W.C));
        return;
      } catch (e) {
        if (!W.cacheSlim) throw e;
      }
    }
    if (!W.cacheSlim) throw new Error("full");
    localStorage.setItem("waypoint-cache-v2", JSON.stringify(W.cacheSlim(true)));
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
    /* someone else's shared trip: look, don't keep (planning together sends your changes to its owner instead) */
    if (W.readOnly) {
      if (W.readOnly.edit && W.coPush) W.coPush();
      return;
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
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var R = 6371,
      r = Math.PI / 180,
      dLa = (b.lat - a.lat) * r,
      dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  /* time between two points inside a city */
  W.leg = function (a, b) {
    var d = W.km(a, b);
    if (d == null) return null;
    if (d < 1.3) return { d: d, mode: "walking", min: Math.max(3, Math.round(((d * 1.3) / 4.8) * 60)), label: "walk" };
    if (d < 30) return { d: d, mode: "transit", min: Math.round(8 + ((d * 1.3) / 18) * 60), label: "transit" };
    return { d: d, mode: "driving", min: Math.round((d / 60) * 60 + 10), label: "drive or train" };
  };
  W.fmtMin = function (m) {
    return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
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
  W.gmapsDir = function (a, b, mode) {
    var o = a.lat != null ? a.lat + "," + a.lng : a.label;
    var d = b.lat != null ? b.lat + "," + b.lng : b.n;
    return (
      "https://www.google.com/maps/dir/?api=1&origin=" +
      encodeURIComponent(o) +
      "&destination=" +
      encodeURIComponent(d) +
      "&travelmode=" +
      (mode || "transit")
    );
  };
  /** the whole day in Google Maps: from where you stay, every stop in order (its pin, or else its name and town), and
      back. Driving when any stop is more than a walk away (Google Maps takes no stops on a transit route). */
  W.dayRouteUrl = function (day, stops, home) {
    function at(p) {
      return p.lat != null ? p.lat + "," + p.lng : (p.n || p.label) + ", " + day.city;
    }
    var nine = stops.slice(0, 9),
      ids = nine.map(function (p) {
        return p.gid || "";
      });
    var o = home && home.lat != null ? home.lat + "," + home.lng : (home && home.label ? home.label : day.city) + ", " + day.city;
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
      encodeURIComponent(o) +
      (stops.length ? "&waypoints=" + encodeURIComponent(nine.map(at).join("|")) : "") +
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
    var m = window.AIRPORTS.filter(function (a) {
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
  function changed() {
    W.dataV++;
    W.save();
    listeners.forEach(function (fn) {
      fn();
    });
  }
  W.changed = changed;
  /* answers arriving: the planner is told at once (dataV), but the screen is redrawn once for the whole burst, after the
     frame already on its way has painted. A tap that opens a screen asking for five lists paints its screen first and
     fills in once, instead of redrawing (and replanning) five times before the first frame. */
  var flushPending = false;
  function flush() {
    flushPending = false;
    W.save();
    listeners.forEach(function (fn) {
      fn();
    });
  }
  function redraw() {
    if (flushPending) return;
    flushPending = true;
    var later = function () {
      if (window.requestIdleCallback) requestIdleCallback(flush, { timeout: 300 });
      else setTimeout(flush, 50);
    };
    if (window.requestAnimationFrame) requestAnimationFrame(later);
    else later();
  }
  function arrived() {
    W.dataV++;
    redraw();
  }
  W.arrived = arrived; /* (for the files that ask Claude: lib/asks.js) */

  try {
    if (window.claude && window.claude.use) {
      window.claude.use("sample").then(
        function (smp) {
          W.SAMPLE = smp;
          W.sampleState = smp ? "on" : "off";
          changed();
        },
        function () {
          W.sampleState = "off";
          changed();
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

  /* The items of a list in an answer that is still being written: text = the answer so far, key = the list's name in
     the JSON ("spots"), from = where the last call stopped. Gives the items completed since then, where to go on from,
     and (head) the plain fields written before the list, such as the city's pin. A half-written item waits for its end. */
  W.partialList = function (text, key, from) {
    var start = from || 0,
      head = /** @type {any} */ (null);
    if (!start) {
      var m = new RegExp('"' + key + '"\\s*:\\s*\\[').exec(text);
      if (!m) return { items: [], next: 0, head: null };
      start = m.index + m[0].length;
      head = {};
      var pre = text.slice(0, m.index),
        la = /"lat"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(pre),
        lo = /"lng"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(pre),
        d = /"d"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(pre);
      if (la && lo) {
        head.lat = +la[1];
        head.lng = +lo[1];
      }
      if (d) {
        try {
          head.d = JSON.parse(d[1]);
        } catch (e) {}
      }
    }
    var items = [],
      depth = 0,
      inStr = false,
      esc = false,
      obj = -1,
      next = start;
    for (var i = start; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") {
        if (depth === 0) obj = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && obj >= 0) {
          try {
            items.push(JSON.parse(text.slice(obj, i + 1)));
          } catch (e) {}
          next = i + 1;
          obj = -1;
        }
      } else if (ch === "]" && depth === 0) {
        next = i;
        break;
      } /* the list is complete */
    }
    return { items: items, next: next, head: head };
  };
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
  /** @param {string} key @param {string} prompt @param {string} tier @param {(r: any) => void} onOk
      @param {{ list: string, take: (items: any[], head: any) => void, min?: number }} [stream] a list in the answer
      whose items are handed over as they are written (take), min at a time, before the whole answer comes (onOk) */
  function run(key, prompt, tier, onOk, stream) {
    /* one request per key: a failed one waits for an explicit "Try again" instead of retrying on every redraw */
    if (W.status[key] || !W.SAMPLE || W.readOnly) return;
    W.status[key] = "loading";
    queue.push({
      key: key,
      go: function () {
        running++;
        var opts = W.askOpts(key, tier);
        if (stream) {
          var at = 0,
            held = /** @type {any[]} */ ([]),
            last = 0,
            head = null;
          opts.onText = function (u) {
            try {
              var got = W.partialList((u && u.text) || "", stream.list, at);
              at = got.next;
              if (got.head) head = got.head;
              held = held.concat(got.items);
              var now = Date.now();
              if (held.length >= (stream.min || 3) || (held.length && last && now - last > 2500)) {
                var batch = held;
                held = [];
                last = now;
                stream.take(batch, head || {});
                arrived();
              }
            } catch (e) {}
          };
        }
        W.SAMPLE.json(prompt, opts)
          .then(
            function (res) {
              delete W.status[key];
              onOk(res);
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
    });
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
  function prio(key, here) {
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
      queue.splice(best, 1)[0].go();
    }
  }
  W.pump = pump;
  /* after waiting for saved ideas from your account: forget the requests made meanwhile, and ask again only for what's still missing */
  W.releaseLoads = function () {
    if (!W.holdLoads) return;
    W.holdLoads = false;
    if (!running) {
      queue.length = 0;
      Object.keys(W.status).forEach(function (k) {
        if (W.status[k] === "loading") delete W.status[k];
      });
    }
    changed();
    pump();
  };
  W.run = run;
})();
