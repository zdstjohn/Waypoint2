/* Waypoint core: state, caches, helpers, and Claude-powered data loading. */
(function () {
  "use strict";
  var W = window.W = window.W || /** @type {Waypoint} */ ({});   /* validate.js may have set up W.V first */
  /* the page is wrapped by its host, so the language is set here (screen readers pick the voice from it) */
  if (!document.documentElement.lang) document.documentElement.lang = "en";
  var STYLES = window.STYLES;
  W.STYLE_NAME = {}; STYLES.forEach(function (s) { W.STYLE_NAME[s[0]] = s[1]; });
  W.$ = function (id) { return document.getElementById(id); };
  /* Simple view (this phone only, so it holds in a shared trip too): no photos, no street map, fewer words. The switch
     is in the trip menu and Settings; html.simple hides the extra lines (app.css), W.picture draws no photo and the
     Trip screen no map */
  var SIMPLE = (function () { try { return localStorage.getItem("waypoint-simple") === "1"; } catch (e) { return false; } })();
  document.documentElement.classList.toggle("simple", SIMPLE);
  W.simple = function () { return SIMPLE; };
  W.setSimple = function (on) {
    SIMPLE = !!on; document.documentElement.classList.toggle("simple", SIMPLE);
    try { if (SIMPLE) localStorage.setItem("waypoint-simple", "1"); else localStorage.removeItem("waypoint-simple"); } catch (e) {}
    if (W.render) W.render();
  };
  /* the switch, the same wherever it shows */
  W.simpleSwitch = function () {
    return '<button type="button" class="simple-sw" role="switch" aria-checked="' + SIMPLE + '" data-simple="1"><span class="sw-t"><b>Simple view</b>' +
      '<span class="small muted">Just the plan: no photos, no maps, fewer words. This phone only.</span></span><span class="tg" aria-hidden="true"><i></i></span></button>';
  };
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-simple]"); if (!b) return;
    e.preventDefault(); W.setSimple(!SIMPLE);
  });
  W.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /* called for every name on every redraw; the last few thousand answers are kept */
  var normCache = Object.create(null), normN = 0;
  W.norm = function (s0) {
    var s = String(s0 || ""); var h = normCache[s]; if (h !== undefined) return h;
    if (normN > 4000) { normCache = Object.create(null); normN = 0; }
    normN++; return (normCache[s] = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim());
  };
  /* a link that opens in a new tab */
  W.extLink = function (url, txt, cls) { return "<a" + (cls ? ' class="' + cls + '"' : "") + ' href="' + W.esc(url) + '" target="_blank" rel="noopener">' + txt + "</a>"; };
  /* "just now", "5 min ago", "3 h ago", "2 d ago", then the date */
  W.ago = function (t) {
    if (!t) return "";
    var m = Math.round((Date.now() - t) / 6e4);
    return m < 2 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : m < 10080 ? Math.round(m / 1440) + " d ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  W.loadScript = function (src) {
    return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.charset = "utf-8"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  };

  /* ---------- state (the trip) ---------- */
  var DEFAULT = {
    v: 2, styles: ["culture", "food", "relax"],
    countries: [{ name: "Italy", mode: "manual", picked: ["Rome", "Florence", "Venice"] }],
    days: 10, start: "", depart: "Los Angeles (LAX)", travelers: [38, 36, 6, 3],
    stays: {}, picks: {}, seen: {}, day: 1, cityDays: {}
  };
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  /* an offline copy (one file with the trip inside) starts from the trip it carries; after that, edits made in the file stay */
  var SEED = window.__WP_OFFLINE || null, seeded = load("waypoint-offline-seeded");
  if (SEED && SEED.S && seeded !== SEED.at) {
    try { localStorage.setItem("waypoint-v2", JSON.stringify(SEED.S)); localStorage.setItem("waypoint-cache-v2", JSON.stringify(SEED.C || {})); localStorage.setItem("waypoint-offline-seeded", JSON.stringify(SEED.at)); } catch (e) {}
  }
  var s = load("waypoint-v2");
  /* a copy shows the trip inside it, whatever the phone's storage does (a downloaded file is often given none, and then
     the copy used to open on the example trip) */
  if (SEED && SEED.S && !(s && s.v === 2)) s = JSON.parse(JSON.stringify(SEED.S));
  W.S = s && s.v === 2 ? s : JSON.parse(JSON.stringify(DEFAULT));
  W.isExample = !s;
  if (!W.S.cityDays) W.S.cityDays = {};   /* days you set for each place */
  var c = load("waypoint-cache-v2") || (SEED && SEED.C) || {};
  W.C = /** @type {Cache} */ ({ country: c.country || {}, city: c.city || {}, geo: c.geo || {}, area: c.area || {}, range: c.range || {}, legs: c.legs || {}, cost: c.cost || {}, tz: c.tz || {}, events: c.events || {} });
  var lastS = null, lastV = -1;
  /* a write this device refused (its storage for the app is full): say so in the banner and the error log, once; nothing
     is cleared to make room (the idea lists would only be asked for again) */
  W.storeFailed = function (e) {
    if (W.localFull) return;
    W.localFull = true;
    if (W.logError) W.logError("storage: this device refused a save (" + (e && e.name || "error") + ")", "save");
    if (W.renderBar && W.P) try { W.renderBar(W.P); } catch (x) {}
  };
  W.save = function () {
    /* someone else's shared trip: look, don't keep (planning together sends your changes to its owner instead) */
    if (W.readOnly) { if (W.readOnly.edit && W.coPush) W.coPush(); return; }
    var wrote = false, failed = false;
    try { var js = JSON.stringify(W.S); if (js !== lastS) { localStorage.setItem("waypoint-v2", js); lastS = js; wrote = true; } } catch (e) { failed = true; W.storeFailed(e); }
    /* the cache is big (city lists for every place); it is written only when data has arrived since the last save */
    try { if (W.dataV !== lastV) { localStorage.setItem("waypoint-cache-v2", JSON.stringify(W.C)); lastV = W.dataV; wrote = true; } } catch (e) { failed = true; W.storeFailed(e); }
    if (wrote && !failed) W.localFull = false;   /* there is room again */
    if (W.afterSave) W.afterSave();
  };

  /* ---------- geo helpers ---------- */
  W.km = function (a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  /* time between two points inside a city */
  W.leg = function (a, b) {
    var d = W.km(a, b);
    if (d == null) return null;
    if (d < 1.3) return { d: d, mode: "walking", min: Math.max(3, Math.round(d * 1.3 / 4.8 * 60)), label: "walk" };
    if (d < 30) return { d: d, mode: "transit", min: Math.round(8 + d * 1.3 / 18 * 60), label: "transit" };
    return { d: d, mode: "driving", min: Math.round(d / 60 * 60 + 10), label: "drive or train" };
  };
  W.fmtMin = function (m) { return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : ""); };
  W.fmtKm = function (d) { return d < 1 ? Math.round(d * 1000 / 50) * 50 + " m" : (d < 10 ? d.toFixed(1) : Math.round(d)) + " km"; };
  W.flightHrs = function (d) { return Math.max(1, Math.round((d / 780 + 0.7) * 2) / 2); };
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
    return "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(o) + "&destination=" + encodeURIComponent(d) + "&travelmode=" + (mode || "transit");
  };
  /** the whole day in Google Maps: from where you stay, every stop in order (its pin, or else its name and town), and
      back. Driving when any stop is more than a walk away (Google Maps takes no stops on a transit route). */
  W.dayRouteUrl = function (day, stops, home) {
    function at(p) { return p.lat != null ? p.lat + "," + p.lng : (p.n || p.label) + ", " + day.city; }
    var nine = stops.slice(0, 9), ids = nine.map(function (p) { return p.gid || ""; });
    var o = home && home.lat != null ? home.lat + "," + home.lng : (home && home.label ? home.label : day.city) + ", " + day.city;
    var prev = home, far = false;
    stops.forEach(function (p) { var d = prev && W.km(prev, p); if (d != null && d > 1.3) far = true; if (p.lat != null) prev = p; });
    return "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(o) + "&destination=" + encodeURIComponent(o) +
      (stops.length ? "&waypoints=" + encodeURIComponent(nine.map(at).join("|")) : "") +
      /* Google's own IDs for the stops it knows, so each stop opens as the real listing (one per waypoint, blanks for the rest) */
      (ids.some(Boolean) ? "&waypoint_place_ids=" + encodeURIComponent(ids.join("|")) : "") + "&travelmode=" + (far ? "driving" : "walking");
  };
  /* a place on Google Maps: by its place ID when the nightly check has found it (the exact listing), else by name and town.
     Takes a place ({n, gid}) or a name. */
  W.gmapsPlace = function (name, city, gid) {
    if (name && typeof name === "object") { gid = gid || name.gid; name = name.n || name.label || ""; }
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(name + ", " + city) + (gid ? "&query_place_id=" + encodeURIComponent(gid) : "");
  };

  W.airport = function () {
    var v = (W.S.depart || "").trim().toLowerCase(); if (!v) return null;
    var m = window.AIRPORTS.filter(function (a) {
      var label = (a[0] + " (" + a[1] + ")").toLowerCase();
      return label === v || a[1].toLowerCase() === v || a[0].toLowerCase() === v || label.indexOf(v) === 0;
    })[0];
    if (m) return { name: m[0], code: m[1], lat: m[2], lng: m[3] };
    return { name: W.S.depart.trim(), code: W.S.depart.trim().replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "—" };
  };
  W.ages = function () { return W.S.travelers.filter(function (a) { return a !== "" && !isNaN(a); }).map(Number); };
  W.party = function () {
    var a = W.ages(), minA = a.length ? Math.min.apply(null, a) : 30;
    /* senior: grandparents along (65 and over): shorter days on foot, no steep or strenuous outings, fewer hotel moves */
    return { toddler: minA < 5, kid: minA < 12, senior: a.some(function (x) { return x >= 65; }), adults: a.filter(function (x) { return x >= 18; }).length, kids: a.filter(function (x) { return x < 18; }) };
  };

  /* ---------- destination data ---------- */
  /* A destination is a town, never a whole island: you stay somewhere on Crete, not "in Crete". window.TI (data/data2.js)
     lists the well-known islands with their towns. Wherever an island would be offered (the built-in list, Claude's
     list, a name you type), its towns are offered instead. A trip made before this, with an island as a stop, keeps
     working: W.findCity still knows the island (marked whole), and Plan offers its towns in its place. */
  var isleIdx = null;
  /* an island is matched by one of its listed names; "Santorini Island" and "the island of Santorini" also find
     Santorini (but "Vancouver" never finds Vancouver Island: only what is typed loses the word, not the list) */
  function isleFind(by, name) {
    var k = W.norm(name);
    return by[k] || by[k.replace(/^(the )?(isle|island) of /, "").replace(/ (island|islands|isle)$/, "")] || null;
  }
  function isles(country) {
    if (!isleIdx) {
      isleIdx = Object.create(null);
      var TI = /** @type {any} */ (window).TI || {};
      Object.keys(TI).forEach(function (cn) {
        var by = Object.create(null), rows = TI[cn].map(function (/** @type {string[]} */ row) {
          var group = row[0].charAt(0) === "*", names = row[0].replace(/^\*/, "").split(",");
          var is = { name: names[0], group: group, towns: row[1].split(";").map(function (t) { var m = t.split("@"), q = m[1].split(","); return { name: m[0], lat: +q[0], lng: +q[1] }; }) };
          names.forEach(function (n) { by[W.norm(n)] = is; });
          return is;
        });
        isleIdx[cn] = { rows: rows, by: by };
      });
    }
    return isleIdx[country] || null;
  }
  /** the island a name stands for (null for a town, or a name that is no island we know)
      @param {string} country @param {string} name @returns {{ name: string, group: boolean, towns: { name: string, lat: number, lng: number }[] } | null} */
  W.isleOf = function (country, name) {
    var x = isles(country), is = x && isleFind(x.by, name) || null;
    /* "Victoria" is a town on Mahé before it is anything else */
    if (is && is.towns.some(function (t) { return W.norm(t.name) === W.norm(name); })) return null;
    return is;
  };
  /* an island's towns as destinations. They take after the island's own entry where there is one (its tags, its
     suggested days, the ideas built into the app); the usual base comes first and counts as the best known */
  function isleTowns(is, base) {
    base = base || {};
    return is.towns.map(function (t, i) {
      var c = /** @type {BuiltCity} */ ({ name: t.name, region: is.name, isl: is.name, lat: t.lat, lng: t.lng, w: i ? Math.max(1, (base.w || 2) - 1) : base.w || 2,
        t: base.t || [], d: i || !base.d ? (is.group ? "In " : "On ") + is.name + "." : base.d });
      if (i) c.pop = Math.max(1, (base.pop || 3) - Math.min(i, 2)); else if (base.pop) c.pop = base.pop;
      if (base.spots) c.spots = base.spots;
      return c;
    });
  }
  /* one index per country, rebuilt when either list it was made from is replaced (the built-in one, or Claude's, which
     arrives later or comes back from a saved trip). list = what is offered; map = every name that can be looked up,
     which also has the islands themselves (whole) and every town of the islands we know */
  var ccCache = Object.create(null);
  function cityIndex(country) {
    var built = (window.TD[country] || {}).cities || null, ai = (W.C.country[country] || {}).cities || null, e = ccCache[country];
    if (e && e.built === built && e.ai === ai) return e;
    e = ccCache[country] = { built: built, ai: ai, list: [], map: Object.create(null) };
    var list = e.list, map = e.map, x = isles(country);
    var put = function (c) { var k = W.norm(c.name); if (map[k]) return; map[k] = c; list.push(c); };
    (built || []).concat(ai || []).forEach(function (c) {
      var is = x ? W.isleOf(country, c.name) : null;
      if (!is) { put(c); return; }
      var k = W.norm(c.name); if (map[k]) return;
      map[k] = Object.assign({}, c, { whole: 1, isl: is.name });
      isleTowns(is, c).forEach(function (t) { var tk = W.norm(t.name), had = map[tk]; if (!had) put(t); else if (!had.isl && !had.whole) had.isl = is.name; });
    });
    /* an entry Claude placed on an island we know: say so (the planner keeps to one base on a small island) */
    if (x) x.rows.forEach(function (is) {
      var first = is.towns[0];
      is.towns.forEach(function (t) { var had = map[W.norm(t.name)]; if (had && !had.isl && !had.whole) had.isl = is.name; });
      /* names that are not offered but can still be looked up: the island itself, and its towns */
      Object.keys(x.by).forEach(function (k) { if (x.by[k] === is && !map[k]) map[k] = /** @type {BuiltCity} */ ({ name: is.name, lat: first.lat, lng: first.lng, whole: 1, isl: is.name }); });
      isleTowns(is, null).forEach(function (t) { var tk = W.norm(t.name); if (!map[tk]) map[tk] = t; });
    });
    return e;
  }
  W.countryCities = function (name) { return cityIndex(name).list; };
  W.countryBlurb = function (name) { return (window.TD[name] || {}).blurb || (W.C.country[name] || {}).blurb || ""; };
  /* looked up for every stop on every redraw */
  W.findCity = function (country, name) {
    var e = cityIndex(country);
    return e.map[W.norm(name)] || isleFind(e.map, name) || null;
  };
  /** the towns to choose between when a name is an island (the ones we know first, then any others the country list
      places on it), or null when the name is a town @param {string} country @param {string} name @returns {{ isle: string, group: boolean, towns: BuiltCity[] } | null} */
  W.isleChoice = function (country, name) {
    var is = W.isleOf(country, name), e = cityIndex(country), k = W.norm(name), out = [], seen = {};
    var add = function (c) { var nk = W.norm(c.name); if (c && !c.whole && !seen[nk]) { seen[nk] = 1; out.push(c); } };
    if (is) is.towns.forEach(function (t) { add(e.map[W.norm(t.name)]); });
    /* towns the country list places on this island (also how an island we don't list ourselves is recognised) */
    var on = Object.create(null); on[is ? W.norm(is.name) : k] = 1;
    var listed = e.list.filter(function (c) { return c.isl && isleFind(on, c.isl); });
    if (!is && !listed.length) {
      on[k.replace(/^(the )?(isle|island) of /, "").replace(/ (island|islands|isle)$/, "")] = 1;
      listed = e.list.filter(function (c) { return c.isl && isleFind(on, c.isl); });
    }
    if (!is && (!listed.length || e.map[k] && !e.map[k].whole)) return null;
    listed.slice().sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }).forEach(add);
    return { isle: is ? is.name : listed[0].isl || name, group: !!(is && is.group), towns: out.slice(0, 8) };
  };
  W.cityKey = function (country, city) { return country + "|" + city; };
  /** a stop that is a whole island becomes one of its towns: it takes the island's place in your list, with the days
      and the lodging you had set (the ideas are the town's own) @param {string} country @param {string} from @param {string} to */
  W.isleSwap = function (country, from, to) {
    var S = W.S, c = S.countries.filter(function (x) { return x.name === country; })[0]; if (!c || !to || from === to) return;
    var j = c.picked.indexOf(from), a = W.cityKey(country, from), b = W.cityKey(country, to);
    if (j > -1) { if (c.picked.indexOf(to) < 0) c.picked[j] = to; else c.picked.splice(j, 1); }
    [S.cityDays, S.stays].forEach(function (m) { if (m && m[a] != null) { if (m[b] == null) m[b] = m[a]; delete m[a]; } });
  };
  W.openStay = {};   /* which cities have their lodging panel open on Plan (screens/setup.js, second script) */
  /* idea pool for a city: Claude's list, or the built-in fallback when Claude isn't available */
  W.pool = function (country, city) {
    var c = W.C.city[W.cityKey(country, city)];
    if (c && c.spots && c.spots.length) { if (W.withImported) W.withImported(country, city, c); if (W.withNightFood) W.withNightFood(country, city, c); if (W.applyPlaces) W.applyPlaces(country, city, c); return c; }
    if (W.sampleState === "off") {
      var b = W.findCity(country, city);
      if (b && b.spots) return { d: b.d, lat: b.lat, lng: b.lng, spots: b.spots, food: [], fallback: true };
    }
    return null;
  };

  /* ---------- Claude ---------- */
  W.SAMPLE = null; W.sampleState = "waiting"; /* waiting | on | off */
  W.status = {}; /* key -> "loading" | error message */
  var queue = [], running = 0, listeners = [];
  W.onData = function (fn) { listeners.push(fn); };
  W.dataV = 0;   /* goes up whenever cached data arrives or the state is reported changed; the planner reuses its last plan until it does */
  function changed() { W.dataV++; W.save(); listeners.forEach(function (fn) { fn(); }); }
  W.changed = changed;
  /* answers arriving: the planner is told at once (dataV), but the screen is redrawn once for the whole burst, after the
     frame already on its way has painted. A tap that opens a screen asking for five lists paints its screen first and
     fills in once, instead of redrawing (and replanning) five times before the first frame. */
  var flushPending = false;
  function flush() { flushPending = false; W.save(); listeners.forEach(function (fn) { fn(); }); }
  function redraw() {
    if (flushPending) return; flushPending = true;
    var later = function () { if (window.requestIdleCallback) requestIdleCallback(flush, { timeout: 300 }); else setTimeout(flush, 50); };
    if (window.requestAnimationFrame) requestAnimationFrame(later); else later();
  }
  function arrived() { W.dataV++; redraw(); }

  try {
    if (window.claude && window.claude.use) {
      window.claude.use("sample").then(function (smp) {
        W.SAMPLE = smp; W.sampleState = smp ? "on" : "off"; changed();
      }, function () { W.sampleState = "off"; changed(); });
    } else W.sampleState = "off";
  } catch (e) { W.sampleState = "off"; }
  setTimeout(function () { if (W.sampleState === "waiting") { W.sampleState = "off"; changed(); } }, 12000);

  function run(key, prompt, tier, onOk) {
    /* one request per key: a failed one waits for an explicit "Try again" instead of retrying on every redraw */
    if (W.status[key] || !W.SAMPLE || W.readOnly) return;
    W.status[key] = "loading";
    queue.push({ key: key, go: function () {
      running++;
      W.SAMPLE.json(prompt, { modelTier: tier || "default" }).then(function (res) {
        delete W.status[key]; onOk(res);
      }, function (err) {
        var code = err && err.code;
        if (code === "not_granted") { W.sampleState = "off"; delete W.status[key]; }
        else W.status[key] = code === "rate_limited" ? "Busy right now. Try again in a minute." : "Couldn't load this. Try again.";
      }).then(function () { running--; arrived(); pump(); });
    } });
    soon(); pump();
  }
  /* the "loading" marks: shown once the current frame has painted (a status is not data, the plan stands) */
  function soon() { redraw(); }
  /* nothing is asked of Claude while offline (or in an offline copy); the queue waits for the signal to come back */
  /* what goes first: the city on screen before the others, its main lists (sights, places to eat, breakfast) before the
     second lists and the extras (hidden gems, rainy-day ideas, links, events, costs). Anything you asked for yourself
     (a search, a replan, the plan check, an address) and the small plan-shaping answers go straight to the front. */
  var MAIN = { spots: 1, food: 1, bfast: 1 }, SOON = { pins: 1, fame: 1, lodge: 1, eatfit: 1, eatmore: 1, style: 1 },
    LATE = { gems: 1, indoor: 1, links: 1, events: 1, cost: 1 };
  function onScreen() {
    var P = W.P, out = {}; if (!P || !P.days || !P.days.length) return out;
    var add = function (d) { if (d && d.city) out[W.cityKey(d.country, d.city)] = 1; };
    add(P.days[Math.max(0, Math.min(P.days.length, +W.S.day || 1) - 1)]);
    if (W.isToday) P.days.forEach(function (d) { if (W.isToday(d)) add(d); });
    if (!Object.keys(out).length) add(P.days[0]);
    return out;
  }
  function prio(key, here) {
    var p = String(key).split("|"), kind = p[0];
    if (!MAIN[kind] && !SOON[kind] && !LATE[kind]) return 0;
    var mine = !!here[p[1] + "|" + p[2]], second = p[3] === "b";
    if (MAIN[kind]) return mine ? (second ? 2 : 1) : (second ? 5 : 4);
    if (SOON[kind]) return mine ? 3 : 6;
    return mine ? 5 : 7;
  }
  W.loadPrio = function (key) { return prio(key, onScreen()); };
  /* how many at once: three inside Claude; six in the installable app, whose own server has room for more */
  function maxRunning() { return W.cloud ? 6 : 3; }
  function pump() {
    if (W.holdLoads || !navigator.onLine || window.__WP_OFFLINE) return;
    var here = null;
    while (running < maxRunning() && queue.length) {
      here = here || onScreen();
      var best = 0, bp = prio(queue[0].key, here);
      for (var i = 1; i < queue.length && bp > 0; i++) { var q = prio(queue[i].key, here); if (q < bp) { bp = q; best = i; } }
      queue.splice(best, 1)[0].go();
    }
  }
  W.pump = pump;
  /* after waiting for saved ideas from your account: forget the requests made meanwhile, and ask again only for what's still missing */
  W.releaseLoads = function () {
    if (!W.holdLoads) return;
    W.holdLoads = false;
    if (!running) { queue.length = 0; Object.keys(W.status).forEach(function (k) { if (W.status[k] === "loading") delete W.status[k]; }); }
    changed(); pump();
  };
  W.run = run;

  var TAGS = W.TAGS = STYLES.map(function (s) { return s[0]; });
  /* every answer goes through W.V (validate.js): names, pins near the city, tags, ratings, links */
  var V = W.V, num = V.num;
  /** an empty city, before its lists arrive @returns {Pool} */
  function newPool() { return { spots: [], food: [], lat: null, lng: null }; }
  /* the city a list is for: its pin checks every pin in the answer */
  function centerOf(ck) { var c = W.C.city[ck], p = ck.split("|"), b = W.findCity(p[0], p[1]); return c && c.lat != null ? c : b && b.lat != null ? b : null; }
  function who() {
    return "Travelers' interests: " + (W.S.styles.map(function (s) { return W.STYLE_NAME[s]; }).join(", ") || "anything") +
      ". Travelers' ages: " + (W.ages().join(", ") || "adults") + ".";
  }
  W.who = who;

  /* what kind of sights the trip is after, over and above its interests: the famous must-sees (the default), hidden gems
     where locals go, or the best of both */
  W.FOCUS = { icons: "Must-sees", both: "Best of both", gems: "Hidden gems" };
  W.focus = function () { return W.FOCUS[W.S.focus] ? W.S.focus : "icons"; };
  /* how a list request leans, in words */
  function focusAsk() {
    var f = W.focus();
    return f === "gems" ? " These travelers want to see the place like a local: favor hidden gems, neighborhood favorites and lesser-known places that delight, over the famous crowd-pullers."
      : f === "both" ? " These travelers want the famous highlights plus some lesser-known gems that delight: mix both."
      : " These travelers want the must-sees: favor the famous, essential places a first-time visitor should not miss.";
  }
  W.focusAsk = focusAsk;
  /* every suggestion is rated: how essential it is and how well visitors review it */
  var FAMERULE = " fame = 2 for the essential must-sees most visitors come for (a city's top handful), 1 for popular, well-known places, 0 for hidden gems and local favorites most visitors miss. rating = its typical visitor review score out of 5 on Google or Tripadvisor, one decimal (0 if you do not know). Only suggest places that are consistently well reviewed (about 4.3 or more); never a tourist trap.";
  /* booking links: only the place's own site. Never a search page, a reseller, or a look-alike "tickets" site that adds fees */
  var RESELLERS = /(^|\.)(google|bing|duckduckgo|yahoo|getyourguide|viator|tiqets|klook|headout|musement|civitatis|tripadvisor|expedia|booking|hotels|isango|ceetiz|tourradar|golden-?tours|city-?sightseeing|veltra|kkday|trip|agoda|groupon|tickets?(?:\.com|\.net|\.org)|stubhub|viagogo|seatgeek|vivid ?seats|ticketnetwork|ticketsales|tickettoride)\./i;
  W.bookUrl = function (u0) {
    var u = String(u0 || "").trim();
    if (!/^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u)) return "";
    var host = "";
    try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { return ""; }
    var parts = host.split("."), reg = parts.slice(-2).join(".");
    if (/^(co|com|org|gov|ac|net)\.[a-z]{2}$/.test(reg) && parts.length > 2) reg = parts.slice(-3).join(".");
    if (RESELLERS.test("." + reg + ".")) return "";          /* judged on the site itself, so booking.museum.it style official subdomains pass */
    /* third-party sites that mimic official ones: colosseumtickets.com, rome-skip-the-line.com, sagradafamiliatours.net … */
    if (/(tickets?|tours?|skip-?the-?line|fast-?track|guided)/i.test(reg.split(".")[0])) return "";
    return u.replace(/^http:/i, "https:");
  };
  /* a place the planner must never use: closed for good, or one the check could not find at all (a made-up name), or a duplicate */
  W.gone = function (it) { return !!it && (it.st === "closed" || it.st === "unfound" || it.st === "dup"); };
  W.isPaid = function (it) { return !!it.ticket && !/^\s*free/i.test(it.ticket); };
  W.needsBooking = function (it) { return /book|reserv|advance|timed|pre-?book|sell out|slot/i.test(it.ticket || "") || it.reserve === true; };

  /* recommended time to spend somewhere: "2-3 hours", "90 min", "1h30", "half day" -> "2–3 h", "1½ h", "Half day" */
  var U = "(hours?|hrs?|h|minutes?|mins?|m)";
  function unit(u) { return u && u.charAt(0) === "m" ? 1 : 60; }
  function hrs(m) { var h = Math.round(m / 30) / 2; return h % 1 ? (Math.floor(h) || "") + "½" : String(h); }
  function mins(m) { return Math.max(5, Math.round(m / 5) * 5); }
  function fmtDur(lo, hi) {
    if (!(lo > 0)) return "";
    if (hi != null && !(hi > lo)) hi = null;
    if (lo >= 420) return "Full day";
    if (hi == null) return lo < 60 ? mins(lo) + " min" : hrs(lo) + " h";
    if (hi <= 60) return mins(lo) + "–" + mins(hi) + " min";
    if (lo < 60) return mins(lo) + " min–" + hrs(hi) + " h";
    return hrs(lo) === hrs(hi) ? hrs(lo) + " h" : hrs(lo) + "–" + hrs(hi) + " h";
  }
  W.durText = function (raw) {
    var s = String(raw || "").toLowerCase().trim(); if (!s) return "";
    if (/full|all[ -]?day|whole day|entire day/.test(s)) return "Full day";
    if (/half[ -]?day|half a day/.test(s)) return "Half day";
    s = s.replace(/½/g, ".5").replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(\d+)\s*h(?:ours?|rs?)?\s*(\d{1,2})\s*(?:m(?:in(?:ute)?s?)?)?(?![\d.])/g, function (a, h, m) { return (+h + m / 60) + "h"; });
    var m = s.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + U + "?\\s*(?:-|–|—|to)\\s*(\\d+(?:\\.\\d+)?)\\s*" + U + "?"));
    if (m) return fmtDur(+m[1] * unit(m[2] || m[4]), +m[3] * unit(m[4] || m[2]));
    m = s.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + U + "?"));
    if (m) return fmtDur(+m[1] * (m[2] ? unit(m[2]) : +m[1] > 12 ? 1 : 60), null);
    return "";
  };
  /* time to plan for a stop: the place's own estimate, else a typical length for the meal */
  var MEAL_DUR = { breakfast: "30–45 min", lunch: "1–1½ h", dinner: "1½–2 h" };
  W.stayText = function (it, food, slot) {
    var t = W.durText(it.dur);
    if (food && /day$/.test(t)) t = "";   /* a meal is never a half day */
    if (!t && food) t = MEAL_DUR[slot] || MEAL_DUR[it.meal] || MEAL_DUR.lunch;
    if (!t && it.s === "any") t = "Full day";
    return t;
  };
  var MENURULE = "menu = the place's own website page that shows its menu (or its homepage if the menu is there), only if you are confident of the exact address; otherwise an empty string.";
  var BOOKRULE = "book = for any place that charges admission or needs booking: the page on the place's OWN official website (or its official government/foundation ticket office) where visitors buy tickets. Never a reseller, tour operator or look-alike ticket site (no GetYourGuide, Viator, Tiqets, Klook, Headout, Musement, 'colosseumtickets.com' style sites). If you are not confident of the exact official address, an empty string.";
  var TAGRULE = " Tags (t) only from: " + TAGS.join(",") + ". k: 1 = great for small kids, 0 = fine, -1 = better for older kids and adults.";

  /* every destination in a country: cities, towns and areas (the Amalfi Coast, the Algarve). An island is never an entry; its towns are, each naming the island
     (isl). A list cached before islands were handled this way (no v) is asked again once; the old one stays in use
     until the new one comes, and for good if it doesn't */
  W.COUNTRY_V = 2;
  W.loadCountry = function (name) {
    var key = "country|" + name, had = W.C.country[name];
    if ((had && had.v >= W.COUNTRY_V) || W.status[key]) return;
    run(key, "List the cities, towns and areas that travelers visit in " + name +
      ". Be thorough: 80 to 120 places covering every region, from major cities to small towns. Only real places.\n" +
      "An island or a group of islands is never an entry. For an island, list its towns instead " +
      "(not \"Crete\" but Heraklion, Chania, Rethymno; for a small island its main town or port by its usual name, like \"Hydra Town\" or \"Naxos Town\"), each with the island's name in isl. " +
      "isl is \"\" for a place on the mainland or on the country's main island.\n" +
      "Reply with JSON only: {\"blurb\":\"one sentence about traveling in " + name + "\",\"cities\":[{\"name\":\"\",\"region\":\"\",\"isl\":\"\",\"lat\":0,\"lng\":0,\"w\":2,\"pop\":3,\"t\":[\"tag\"],\"d\":\"what it is known for, max 12 words\"}]}\n" +
      "w = suggested days (1-4). pop = how popular with visitors, 1-5." + TAGRULE.split(" k:")[0],
      "quick", function (r) {
        var list = W.townsOnly(V.list(r && r.cities, V.city));
        /* keep even an empty answer so the page never asks again in a loop */
        W.C.country[name] = { blurb: String(r && r.blurb || "") || (had && had.blurb) || "", cities: had && had.cities.length ? W.islesInto(had.cities, list) : list, v: W.COUNTRY_V };
      });
  };
  /** an answer that still names an island as a place (its name is its own isl) loses it when the island's towns are
      there too; alone, it is that island's one town and stays @param {BuiltCity[]} list */
  W.townsOnly = function (list) {
    return list.filter(function (c) {
      if (!c.isl || W.norm(c.isl) !== W.norm(c.name)) return true;
      return !list.some(function (o) { return o !== c && o.isl && W.norm(o.isl) === W.norm(c.isl); });
    });
  };
  /** A list from before, brought up to date with a new answer without the places you already see shifting: every
      town it had stays as it was (so a suggested trip keeps its stops), each island it named gives way to that
      island's towns, and a town now known to be on an island says so. Nothing else is added.
      @param {BuiltCity[]} old @param {BuiltCity[]} fresh */
  W.islesInto = function (old, fresh) {
    var isl = Object.create(null), by = Object.create(null), seen = Object.create(null), out = [];
    fresh.forEach(function (c) { by[W.norm(c.name)] = c; if (c.isl && W.norm(c.isl) !== W.norm(c.name)) isl[W.norm(c.isl)] = 1; });
    old.forEach(function (c) {
      var k = W.norm(c.name), f = by[k]; if (isl[k] || seen[k]) return;
      seen[k] = 1; out.push(f && f.isl && !c.isl ? Object.assign({}, c, { isl: f.isl }) : c);
    });
    fresh.forEach(function (c) { var k = W.norm(c.name); if (c.isl && !seen[k]) { seen[k] = 1; out.push(c); } });
    return out;
  };

  /* 25+ things to do, plus places to eat, transit and where to stay, for one city */
  var tries = {};
  /* enough ideas for a city: past this, "Find more" stops asking (the lists stay as they are) */
  W.IDEA_CAP = { spots: 60, food: 40 };
  /* how many of each a city starts with: 15, and more when this trip stays there longer (about four for each day of
     the stay: a morning, an afternoon and three meals, with a few to choose between), up to 30. It goes by the days this
     trip spends in the place, never by how long a visit is recommended. When you make a stay longer, the difference is
     fetched (W.growIdeas). The rest comes only on "Find more" */
  W.FIRST_IDEAS = 15;
  /** @param {number} [stayDays] the days this trip spends in the place */
  W.firstIdeas = function (stayDays) { return Math.max(W.FIRST_IDEAS, Math.min(30, 4 * (Math.round(+stayDays) || 0) + 3)); };
  /* the days this trip spends in a place, as the plan stands (0 for a day trip or a place not in the trip) */
  W.stayDays = function (country, city) {
    var n = 0; ((W.P && W.P.stops) || []).forEach(function (s) { if (s.country === country && s.name === city) n += s.days || 0; });
    return n;
  };
  function setAside(pool, list) { return (pool && pool.rest && pool.rest[list]) || []; }
  W.ideasFull = function (pool) {
    return !!pool && !setAside(pool, "spots").length && !setAside(pool, "food").length && (pool.spots || []).length >= W.IDEA_CAP.spots && (pool.food || []).length >= W.IDEA_CAP.food;
  };
  W.loadCity = function (country, city, more, stayDays, nMore) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!more && cur && cur.spots && cur.spots.length) return;
    /* never ask about the same city over and over if answers keep coming back empty */
    /* count real attempts only: a redraw while this city's lists are on their way isn't another try */
    if (!more && W.cityBusy(ck)) return;
    var tk = ck + (more ? "|more" : ""); tries[tk] = (tries[tk] || 0) + 1;
    if (!more && tries[tk] > 3) return;
    var ex = cur && cur.spots ? cur.spots.concat(setAside(cur, "spots")).map(function (x) { return x.n; }) : [];
    var exF = cur && cur.food ? cur.food.concat(setAside(cur, "food")).map(function (x) { return x.n; }) : [];
    var where = city + ", " + country, st = W.S.stays[ck];
    /* when you've set your lodging, extra ideas come from around it */
    var nearStay = more && st && st.label ? " Focus on places within an easy trip of " + st.label + "." : "";
    var lean = W.S.styles.length ? " Lean toward the travelers' interests (" + W.S.styles.map(function (x) { return W.STYLE_NAME[x]; }).join(", ") + "): at least half should suit them, alongside the must-see sights." : "";
    var EVE = " If it is a large region or island, give options in each main area so a day can stay in one area. Do not include trains, transfers or transport as activities. ";
    var CITY = "\"d\":\"what " + city + " is known for, one sentence\",\"lat\":0,\"lng\":0,";
    var TRANSIT = "\"transit\":{\"system\":\"how public transit works and what a ticket costs, one sentence\",\"pass\":\"best pass or card for visitors\",\"airport\":\"how to get from the main airport or station to the center\",\"tip\":\"one practical tip\"},\"stay\":[{\"n\":\"neighborhood\",\"d\":\"why stay here, short\",\"lat\":0,\"lng\":0}],";
    function foodAsk(what, extra) {
      return what + " " + who() + W.eatAsk() + (exF.length ? " Do not repeat: " + exF.join("; ") + "." : "") +
        "\nReply with JSON only: {" + (extra || "") + "\"food\":[" + foodEx() + "]}\n" + foodRules() + (extra ? " Give 4 stay neighborhoods." : "");
    }
    if (more) {
      /* a few more at a time, up to the city's cap: the last ideas of a long list are the likeliest to be made up, and
         every one of them waits for a nightly check and a photo */
      var have = W.pool(country, city), nS = have ? (have.spots || []).length : 0, nF = have ? (have.food || []).length : 0;
      var askS = Math.min(nMore || 10, W.IDEA_CAP.spots - nS - setAside(cur, "spots").length), askF = Math.min(nMore || 8, W.IDEA_CAP.food - nF - setAside(cur, "food").length);
      /* "Find more" (you asked): ten more things to do and eight more places to eat go on show. A city that holds more
         than it shows (ideas set aside by W.fitIdeas) brings those out at once; Claude is asked only for what is still missing */
      if (nMore == null && cur && !cur.fallback) {
        var stay = W.stayDays(country, city), sh = cur.showN || (cur.showN = {});
        sh.spots = Math.max(W.ideaLimit(cur, "spots", stay), nS) + 10; sh.food = Math.max(W.ideaLimit(cur, "food", stay), nF) + 8;
        if (W.fitIdeas(country, city, stay, true)) changed();
        askS = Math.min(sh.spots, W.IDEA_CAP.spots) - cur.spots.length; askF = Math.min(sh.food, W.IDEA_CAP.food) - (cur.food || []).length;
      }
      if (askS > 0)
        run("spots|" + ck, "List " + askS + " MORE things to do in and around " + where + ". Mix famous sights, local favorites, parks, markets, neighborhoods, experiences and a day trip." + lean + focusAsk() +
          " Include at least " + Math.max(1, Math.min(3, Math.round(askS / 4))) + " evening options (sunset spots, evening strolls, shows, night markets)." + EVE + nearStay + " " + who() +
          (ex.length ? " Do not repeat any of these: " + ex.join("; ") + "." : "") + "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules(),
          "default", function (r) { addSpots(ck, r, "more"); });
      if (askF > 0)
        run("food|" + ck, foodAsk("List " + askF + " MORE places to eat in " + where + ": breakfast cafés and bakeries, local classics, casual spots and markets, spread across the city or region." + focusAsk() + nearStay), "default", function (r) { addFood(ck, r, "more"); });
      return;
    }
    /* the first lists: 15 things to do and 15 places to eat (more for a long stay: W.firstIdeas), one question each. More only when someone asks for them
       ("Find more"): long lists take minutes to write, and their last ideas are the likeliest to be made up */
    var focusSpots = W.focus() === "gems" ? " Lean toward places locals love and most visitors miss, each still well reviewed, alongside the few unmissable sights."
      : W.focus() === "icons" ? " Lean toward the most popular, best-reviewed places."
      : " Mostly the headline places most visitors come for, plus a few well-loved local favorites.";
    var nFirst = W.firstIdeas(stayDays != null ? stayDays : W.stayDays(country, city));
    run("spots|" + ck, "List the " + nFirst + " best things to do in and around " + where + ", most important first." + focusSpots + lean +
      " Include at least 3 evening options (sunset spots, evening strolls, shows), at least 2 indoor options for a rainy or too-hot afternoon, and a day trip if there is a classic one." + EVE + who() +
      "\nReply with JSON only: {" + CITY + "\"spots\":[" + SPOT_EX + "]}\n" + spotRules(),
      "default", function (r) { addSpots(ck, r, "head"); asked(ck, nFirst); });
    run("food|" + ck, foodAsk("List " + nFirst + " places to eat in " + where + ": the best-loved local classics, casual and family-friendly spots, a couple of special dinners, and at least " + Math.max(4, Math.round(nFirst / 4)) + " breakfast cafés or bakeries, spread across the city or region." + (W.focus() === "gems" ? " Favor the places locals go." : ""), TRANSIT),
      "default", function (r) {
        var c0 = W.C.city[ck] || newPool();
        var tr = r && V.transit(r.transit); if (tr && !c0.transit) c0.transit = tr;
        if (r && Array.isArray(r.stay) && !c0.stay) c0.stay = V.list(r.stay, function (x) { return V.stayArea(x, centerOf(ck)); });
        W.C.city[ck] = c0; addFood(ck, r, "head"); asked(ck, nFirst);
      });
  };
  /* how many of each this city has been asked for (kept with its ideas): a longer stay later asks only for the difference */
  function asked(ck, n) { var c = W.C.city[ck]; if (c) c.askedN = Math.max(c.askedN || 0, n); }
  /* the stay got longer (you changed the days): the ideas grow with it, by the difference, once */
  W.growIdeas = function (country, city, stayDays) {
    var ck = W.cityKey(country, city), c = W.C.city[ck]; if (!c || !c.spots || !c.spots.length || W.readOnly || W.cityBusy(ck)) return;
    var had = Math.max(c.askedN || W.FIRST_IDEAS, Math.min(c.spots.length, (c.food || []).length)), want = W.firstIdeas(stayDays);
    if (want <= had) return;
    c.askedN = want;
    ["spots|", "food|"].forEach(function (p) { if (W.status[p + ck] !== "loading") delete W.status[p + ck]; });
    W.loadCity(country, city, true, stayDays, want - had);
  };
  /* ---------- no more ideas on show than the stay calls for ----------
     A city shows 15 things to do and 15 places to eat (more for a longer stay: W.firstIdeas), plus what you asked for
     ("Find more", a search, hidden gems: pool.showN). A city that holds more than that (lists from before the limit,
     places from another of your devices, the nightly restaurants) keeps the extra set aside in pool.rest: not shown,
     not planned with, and brought out first, at once, when you ask for more or stay longer. Never set aside: a place
     on one of this trip's days, and a place you added yourself. Among the places to eat, breakfast keeps its share,
     and among the things to do, the evening. Run after every planning (lib/plan.js), so it also tidies what arrives
     later; returns whether anything moved. Also never set aside: the replacement for a place that has closed */
  W.ideaLimit = function (c, list, stayDays) { return Math.max(W.firstIdeas(stayDays), (c && c.showN && c.showN[list]) || 0); };
  var fitTold = false, fitRuns = {};
  W.fitIdeas = function (country, city, stayDays, quiet) {
    var c = /** @type {any} */ (W.C.city[W.cityKey(country, city)]);   /* (both lists are handled the same way) */
    if (!c || c.fallback || W.readOnly || !c.spots || !c.spots.length) return false;
    var kept = {}, picks = W.S.picks || {}; Object.keys(picks).forEach(function (k) { if (picks[k]) kept[W.norm(picks[k])] = 1; });
    /* (rp: the replacement the nightly check gave for a place that has closed. lib/places.js adds it whenever it is not
       on the list, so setting it aside would have the two take turns for ever) */
    var isKept = function (x) { return !!(x.imp || x.rp || kept[W.norm(x.n)]); };
    var moved = false, rest = c.rest && typeof c.rest === "object" ? c.rest : { spots: [], food: [] };
    /** @type {Array<"spots" | "food">} */ (["spots", "food"]).forEach(function (L) {
      var n = W.ideaLimit(c, L, stayDays), list = c[L] || [], r = Array.isArray(rest[L]) ? rest[L] : [], on = {};
      list.forEach(function (x) { on[W.norm(x.n)] = 1; });
      var r2 = r.filter(function (x) { return x && x.n && !on[W.norm(x.n)]; }); if (r2.length !== r.length) { r = r2; moved = true; }
      if (list.length > n) {
        /* a kind every day needs keeps its share: breakfast among the places to eat, the evening among the things to do */
        var need = L === "food" ? function (x) { return x.meal === "breakfast" || x.meal === "all"; } : function (x) { return x.s === "eve"; };
        var quota = L === "food" ? Math.max(4, Math.round(n / 4)) : 3, room = n, take = [];
        list.forEach(function (x, i) { if (isKept(x)) { take[i] = 1; room--; if (need(x)) quota--; } });
        list.forEach(function (x, i) { if (!take[i] && room > 0 && quota > 0 && need(x)) { take[i] = 1; room--; quota--; } });
        list.forEach(function (x, i) { if (!take[i] && room > 0) { take[i] = 1; room--; } });
        var out = list.filter(function (x, i) { return !take[i]; });
        if (out.length) { c[L] = list.filter(function (x, i) { return take[i]; }); r = out.concat(r); moved = true; }
      } else if (list.length < n && r.length) {
        var up = r.slice(0, n - list.length); c[L] = list.concat(up); r = r.slice(up.length); moved = true;
      }
      rest[L] = r;
    });
    if (moved || c.rest) c.rest = rest;
    /* the lists changed under a plan that was being made: save them and draw again, once, when it is done. A city's
       lists settle in a pass or two; if something keeps putting back what this sets aside, stop redrawing for it
       (at most six times a minute for one city) rather than redraw without end */
    if (moved && !quiet) {
      var ck = W.cityKey(country, city), now = Date.now(), run = fitRuns[ck] || (fitRuns[ck] = { at: now, n: 0 });
      if (now - run.at > 60000) { run.at = now; run.n = 0; }
      run.n++;
      if (run.n <= 6 && !fitTold) { fitTold = true; setTimeout(function () { fitTold = false; changed(); }, 0); }
    }
    return moved;
  };
  /* a place one of your trips has on a day, found among the ideas set aside: back on show */
  W.fromRest = function (pool, name, food) {
    var L = food ? "food" : "spots", r = setAside(pool, L), k = W.norm(name);
    for (var i = 0; i < r.length; i++) if (W.norm(r[i].n) === k) { var it = r.splice(i, 1)[0]; (pool[L] || (pool[L] = [])).push(it); return it; }
    return null;
  };
  /* is anything still coming in for this city's first lists? */
  W.cityBusy = function (ck) { return ["spots|", "food|"].some(function (p) { return W.status[p + ck] === "loading"; }); };

  var FOOD_EX = "{\"n\":\"name\",\"d\":\"what it is known for or what to order, one short sentence\",\"fame\":1,\"rating\":4.5,\"cuisine\":\"\",\"price\":\"€€\",\"meal\":\"both\",\"dur\":\"1h\",\"fav\":false,\"k\":0,\"reserve\":false,\"book\":\"\",\"menu\":\"\",\"pic\":\"taverna\",\"lat\":0,\"lng\":0}";
  function foodRules() {
    return "pic = the picture that fits best, one of: " + W.FOOD_PICS.join(", ") + ". " + MENURULE + " reserve = true if booking a table ahead is recommended; then book = its official website or reservation page if you are confident of the address, else an empty string. meal = breakfast, lunch, dinner, both (lunch and dinner) or all (all three). dur = the recommended time to allow for a meal there, e.g. '30m' for a bakery, '1-1.5h' for a sit-down lunch, '2h' for a long dinner. fav = true for places food lovers seek out (a famous classic, a top market, a destination restaurant). Use real places and accurate coordinates." + TAGRULE.split(" Tags")[0] + " k: 1 = very family friendly, 0 = fine, -1 = adults-oriented." + FAMERULE.replace("must-sees most visitors come for (a city's top handful)", "famous institutions visitors seek out").replace("hidden gems and local favorites most visitors miss", "neighborhood places locals love");
  }
  /* add places to eat; front = the best-loved half, which stays at the top of the list whichever half arrives first */
  function foodEx() { return W.eatSig() ? FOOD_EX.replace(/\}$/, ",\"fit\":\"good\",\"fitw\":\"\"}") : FOOD_EX; }
  function addFood(ck, r, kind) {
    var c0 = W.C.city[ck] || newPool(), ctr = centerOf(ck);
    var add = V.list(r && r.food, function (x) { return V.food(x, ctr); });
    W.eatMark(add);
    c0.food = merge(c0.food || [], add, kind); W.C.city[ck] = c0;
  }
  /* A city's list is in a fixed order, whichever answer comes in first: the planner gives a list's first places a boost,
     so an order that followed the answers' arrival would plan the same data differently from one time to the next. Each
     batch has its kind's rank (RANK) and goes after everything of its rank or lower that came in this session (what was
     kept from before stays first); the headline half also takes the place of a repeat already listed. */
  var RANK = { head: 0, b: 1, more: 2, style: 3, gems: 4, indoor: 5, eatmore: 3, bfast: 4 };
  var rankOf = typeof WeakMap === "function" ? new WeakMap() : null;
  function merge(list, add, kind) {
    var r = RANK[kind] || 0, rk = function (x) { var v = rankOf && rankOf.get(x); return v == null ? -1 : v; };
    if (rankOf) add.forEach(function (x) { rankOf.set(x, r); });
    if (kind === "head") { var mine = {}; add.forEach(function (x) { mine[W.norm(x.n)] = 1; }); list = list.filter(function (x) { return !mine[W.norm(x.n)]; }); }
    else { var have = {}; list.forEach(function (x) { have[W.norm(x.n)] = 1; }); add = add.filter(function (x) { return !have[W.norm(x.n)]; }); }
    var at = list.length; for (var i = 0; i < list.length; i++) if (rk(list[i]) > r) { at = i; break; }
    return list.slice(0, at).concat(add, list.slice(at));
  }

  /* the shape of one thing to do, shared by every request for them */
  var SPOT_EX = "{\"n\":\"name\",\"d\":\"what it is or what it is known for, one short sentence\",\"t\":[\"tag\"],\"fame\":1,\"rating\":4.6,\"k\":0,\"s\":\"am\",\"dur\":\"2h\",\"ticket\":\"Free\",\"book\":\"\",\"pic\":\"oldtown\",\"place\":\"the real place\",\"lat\":0,\"lng\":0}";
  function spotRules() {
    return "place = the exact name of the real place, as on its sign or on a map (for an outing such as a stroll, a tasting or a cruise, the real place where it happens, e.g. 'Piazza Duomo' or 'Marina Grande'); never an invented or descriptive name. n may be descriptive, place may not. pic = the picture that fits best, one of: " + W.SPOT_PICS.join(", ") + ". s = best time: am, pm, eve, or any (a full-day outing). dur = the recommended time to spend there for these travelers (allow for children's ages), e.g. '45m', '1-2h', 'half day' or 'full day'. ticket = 'Free', or price and whether to book ahead, e.g. '€18, book ahead'. " + BOOKRULE + " Use accurate coordinates." + TAGRULE + FAMERULE;
  }
  /* extras you asked for by name (hidden gems, rainy-day ideas, ideas for your style) come on top of what is on show */
  function bumpShown(ck, c0, list, added) {
    if (added <= 0) return;
    var p = ck.split("|"), sh = c0.showN || (c0.showN = {});
    sh[list] = Math.min(c0[list].length, W.ideaLimit(c0, list, W.stayDays(p[0], p[1]))) + added;
  }
  function addSpots(ck, r, kind) {
    var c0 = W.C.city[ck] || newPool();
    if (r && r.d && !c0.d) c0.d = V.str(r.d, 240);
    /* the city's own pin: only when it agrees with the built-in one (when there is one) */
    var cp = r && V.pinNear(r.lat, r.lng, centerOf(ck), 120); if (cp && c0.lat == null) { c0.lat = cp.lat; c0.lng = cp.lng; }
    var ctr = centerOf(ck), add = V.list(r && r.spots, function (x) { return V.spot(x, ctr); });
    /* the headline half always leads the list (the planner gives the first few a boost), whichever half arrives first */
    var before = (c0.spots || []).length;
    c0.spots = merge(c0.spots || [], add, kind); W.C.city[ck] = c0;
    if (kind !== "head" && kind !== "more") bumpShown(ck, c0, "spots", c0.spots.length - before);
    return c0;
  }

  /* ideas aimed at your trip style, for a city whose list is thin on them (asked once per city and style) */
  W.loadStyleIdeas = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!cur || !cur.spots || !cur.spots.length || W.cityBusy(ck)) return;
    var asked = cur.styleAsked || {};
    var want = W.S.styles.filter(function (st) { return !asked[st] && cur.spots.filter(function (x) { return (x.t || []).indexOf(st) > -1; }).length < 8; });
    if (!want.length) return;
    var names = want.map(function (st) { return W.STYLE_NAME[st]; });
    run("style|" + ck + "|" + want.join(","), "List " + Math.min(24, 8 * want.length + 4) + " things to do in and around " + city + ", " + country + " for travelers who especially want: " + names.join(", ") +
      ". Give several for each of these, spread across the area so every day has some close by." + focusAsk() + " If the area has few, include the best nearby options and day trips; never invent places. Do not include trains, transfers or transport as activities. " + who() +
      " Do not repeat any of these: " + cur.spots.map(function (x) { return x.n; }).join("; ") + "." +
      "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules() + " Tag each one with every interest it fits.",
      "default", function (r) {
        var c0 = addSpots(ck, r, "style");
        c0.styleAsked = c0.styleAsked || {}; want.forEach(function (st) { c0.styleAsked[st] = 1; });
        W.freshPicks(country, city);   /* replan this city's days with the new ideas (slots you chose stay) */
      });
  };

  /* hidden gems, for a trip after them, when a city's list has few (asked once per city) */
  W.loadGems = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (W.focus() === "icons" || !cur || !cur.spots || !cur.spots.length || cur.gemsAsked || W.cityBusy(ck)) return;
    if (cur.spots.filter(function (x) { return x.fame === 0; }).length >= 8) return;
    cur.gemsAsked = 1;
    run("gems|" + ck, "List 14 hidden gems in and around " + city + ", " + country + ": places locals love and most visitors miss, each still consistently well reviewed. Small museums, quiet viewpoints and coves, neighborhood squares and markets, local workshops and experiences, a lesser-known village or two nearby. Real places only. " + who() +
      " Do not repeat any of these: " + cur.spots.map(function (x) { return x.n; }).join("; ") + "." +
      "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules() + " Set fame to 0 for each.",
      "default", function (r) {
        (r && Array.isArray(r.spots) ? r.spots : []).forEach(function (x) { if (x && typeof x === "object" && x.fame == null) x.fame = 0; });
        addSpots(ck, r, "gems"); W.freshPicks(country, city);
      });
  };
  /* lists asked before every place was rated: how essential each one is and how well it is reviewed (once per city) */
  W.loadFame = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!cur || cur.fameAsked || W.cityBusy(ck)) return;
    var todo = /** @type {(Spot | Food)[]} */ (cur.spots || []).concat(cur.food || []).filter(function (x) { return x && x.n && x.fame === undefined; });
    if (todo.length < 4) return;
    cur.fameAsked = 1;
    run("fame|" + ck, "Rate how essential each of these places in and around " + city + ", " + country + " is for a visitor, and how well visitors review it.\n" +
      todo.slice(0, 90).map(function (x) { return x.n; }).join("\n") +
      "\nReply with JSON only: {\"r\":[[\"name exactly as given\",2,4.6]]}\nThe second value is fame: 2 = an essential must-see most visitors come for (or a famous food institution), 1 = popular and well known, 0 = a hidden gem or local favorite most visitors miss. The third is its typical review score out of 5 on Google or Tripadvisor, one decimal, 0 if you do not know.",
      "quick", function (r) {
        var by = {}; (r && r.r || []).forEach(function (x) { if (Array.isArray(x) && x[0]) by[W.norm(x[0])] = x; });
        todo.forEach(function (it) { var x = by[W.norm(it.n)]; if (!x) return; var f = V.fame(x[1]); if (f !== undefined) it.fame = f; var g = V.rating(x[2]); if (g !== undefined) it.rating = g; });
      });
  };

  /* rainy-day backups: indoor places for when the day has to change (asked once per city) */
  W.loadIndoor = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!cur || !cur.spots || cur.indoorAsked || W.cityBusy(ck)) return;
    cur.indoorAsked = 1;
    run("indoor|" + ck, "List 10 indoor things to do in " + city + ", " + country + " for a rainy or too-hot afternoon: aquariums, science and children's museums, covered markets, indoor play centres, swimming pools, planetariums, cinemas, big bookshops with a cafe, covered arcades. Real places only, each one open to walk-in visitors most days; never invent places. " + who() +
      " Do not repeat any of these: " + cur.spots.map(function (x) { return x.n; }).join("; ") + "." +
      "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules() + " Set s to \"pm\" or \"any\". Tag each with the interests it fits and add \"indoor\" to t.",
      "default", function (r) { addSpots(ck, r, "indoor"); });
  };

  /* ---------- how long to stay: enough to see the sights vs a relaxed pace, for this group ---------- */
  function rangeSig() { var p = W.party(); return p.toddler ? "t" : p.kids.length ? "k" : "a"; }
  W.stayRange = function (country, city) { var r = W.C.range[W.cityKey(country, city)]; return r && r.sig === rangeSig() && r.s ? r : null; };
  W.loadStayRanges = function (stops) {
    var sig = rangeSig(), need = stops.filter(function (x) { var r = W.C.range[W.cityKey(x.country, x.name)]; return !r || r.sig !== sig; });
    if (!need.length) return;
    var names = need.map(function (x) { return x.name + ", " + x.country; });
    run("range|" + sig + "|" + names.join(";"), "How many days should this group spend in each of these places? " + who() +
      " sights = full days to see the main sights and highlights at a steady pace. relaxed = full days for a slow, relaxing visit with downtime, long meals and nothing rushed. Don't count travel days. Places: " + names.join("; ") +
      "\nReply with JSON only: {\"stays\":[{\"n\":\"place, country exactly as given\",\"sights\":3,\"relaxed\":5}]}",
      "quick", function (r) {
        var map = {}; (r && r.stays || []).forEach(function (x) { if (x && x.n) { map[W.norm(x.n)] = x; map[W.norm(String(x.n).split(",")[0])] = map[W.norm(String(x.n).split(",")[0])] || x; } });
        need.forEach(function (x) {
          var rg = V.range(map[W.norm(x.name + ", " + x.country)] || map[W.norm(x.name)]);
          /* asked either way, so a place Claude skipped isn't asked about again and again */
          W.C.range[W.cityKey(x.country, x.name)] = rg ? { s: rg.s, r: rg.r, sig: sig } : { sig: sig };
        });
      });
  };

  /* ---------- where to stay: a budget, a mid-range and a splurge pick per city ---------- */
  W.TIERS = ["budget", "mid", "luxury"];
  W.TIER_NAME = { budget: "Budget", mid: "Mid-range", luxury: "Splurge" };
  var TIER_DESC = { budget: "budget (simple hotels, guesthouses, hostels with private family rooms, or good-value apartments)",
    mid: "mid-range (comfortable 3–4 star hotels or well-run apartments)", luxury: "luxury (the best 5-star or boutique hotels)" };
  function lodgeSig() { var p = W.party(); return p.adults + "a" + p.kids.length + "k"; }
  W.lodgeSig = lodgeSig;
  function groupText() {
    var p = W.party(), n = W.ages().length || 2;
    return "The group is " + n + " people: " + (p.adults || n) + " adult" + ((p.adults || n) === 1 ? "" : "s") +
      (p.kids.length ? " and " + p.kids.length + " child" + (p.kids.length === 1 ? "" : "ren") + " (ages " + p.kids.join(", ") + "). Every pick must suit a family: family rooms, connecting rooms or an apartment that sleeps " + n + "." : ". Rooms that fit the whole group.");
  }
  W.loadLodging = function (country, city, tier) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck], sig = lodgeSig();
    var have = cur && cur.lodgeFor === sig ? cur.lodging || [] : [];
    var near = W.S.stays[ck] && W.S.stays[ck].label && !have.some(function (x) { return x.n === W.S.stays[ck].label; }) ? " Prefer the area around " + W.S.stays[ck].label + " if it suits." : "";
    run("lodge|" + ck + "|" + sig + (tier ? "|" + tier + "|" + have.length : ""),
      (tier ? "Suggest 4 MORE " + TIER_DESC[tier] + " places to stay" : "Suggest places to stay") + " in " + city + ", " + country + ". " + groupText() +
      (tier ? "" : " Give 4 in each price tier: " + W.TIERS.map(function (t) { return TIER_DESC[t]; }).join("; ") + ".") +
      " Real, currently operating places with good reviews, in safe, convenient areas for visitors (central, or close to the main sights and good transit)." + near +
      (have.length ? " Do not repeat: " + have.map(function (x) { return x.n; }).join("; ") + "." : "") +
      "\nReply with JSON only: {\"lodging\":[{\"n\":\"name\",\"tier\":\"" + (tier || "budget") + "\",\"type\":\"hotel\",\"area\":\"neighborhood\",\"d\":\"why it's a good pick for this group, one short sentence\",\"price\":\"€90–120\",\"site\":\"\",\"lat\":0,\"lng\":0}]}\n" +
      "tier = budget, mid or luxury. type = hotel, apartment, guesthouse, hostel, resort or villa. price = the typical price per night for a room or unit that fits the group, in local currency. site = the place's own official website if you are confident of the exact address, else an empty string (never Booking.com, Expedia or another booking site). Use accurate coordinates.",
      "default", function (r) {
        var c0 = W.C.city[ck] || newPool();
        if (c0.lodgeFor !== sig) { c0.lodging = []; c0.lodgeFor = sig; }
        var seen = {}; c0.lodging.forEach(function (x) { seen[W.norm(x.n)] = 1; });
        V.list(r && r.lodging, function (x) { return V.lodging(x, centerOf(ck), W.TIERS, tier); }).forEach(function (x) { if (!seen[W.norm(x.n)]) { seen[W.norm(x.n)] = 1; c0.lodging.push(x); } });
        if (!tier) c0.lodgeAsked = 1;
        W.C.city[ck] = c0;
      });
  };
  /* the pick shown for a tier, and a reroll that cycles through that tier's options (fetching more before they run out) */
  W.lodgeList = function (country, city, tier) {
    var cur = W.C.city[W.cityKey(country, city)];
    return cur && cur.lodgeFor === lodgeSig() ? (cur.lodging || []).filter(function (x) { return x.tier === tier; }) : [];
  };
  W.lodgeShown = function (country, city, tier) {
    var k = W.cityKey(country, city) + "|" + tier, list = W.lodgeList(country, city, tier), S = W.S;
    S.lodge = S.lodge || {}; S.lodgeSeen = S.lodgeSeen || {};
    var nm = S.lodge[k], it = nm && list.filter(function (x) { return x.n === nm; })[0];
    if (it) return it;
    var seen = S.lodgeSeen[k] || [];
    return list.filter(function (x) { return seen.indexOf(W.norm(x.n)) < 0; })[0] || list[0] || null;
  };
  W.lodgeReroll = function (country, city, tier) {
    var k = W.cityKey(country, city) + "|" + tier, list = W.lodgeList(country, city, tier), S = W.S;
    var cur = W.lodgeShown(country, city, tier), seen = S.lodgeSeen[k] = S.lodgeSeen[k] || [];
    if (cur && seen.indexOf(W.norm(cur.n)) < 0) seen.push(W.norm(cur.n));
    var left = list.filter(function (x) { return seen.indexOf(W.norm(x.n)) < 0; });
    if (left.length < 2) W.loadLodging(country, city, tier);
    if (left.length) S.lodge[k] = left[0].n;
    else { S.lodgeSeen[k] = cur ? [W.norm(cur.n)] : []; var again = list.filter(function (x) { return !cur || x.n !== cur.n; })[0]; if (again) S.lodge[k] = again.n; }
  };
  /* every booking site's price for one place, side by side (Google Hotels), so you can see where it's cheapest */
  W.priceUrl = function (it, city) { return "https://www.google.com/travel/hotels?q=" + encodeURIComponent(it.n + " " + city); };

  /* Stops on the trip with no pin at all (a list saved before its pin was checked and then cleared, or a place added
     without one): Claude is asked once, for those names only, where each one is. A place the check took off the map
     on purpose (far out at sea) is not asked again; every answer must fall near the city like any other pin. */
  W.loadPins = function (country, city, names) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck]; if (!cur || !names || !names.length) return;
    var want = {}; names.forEach(function (n) { want[W.norm(n)] = 1; });
    var need = /** @type {(Spot | Food)[]} */ ([]).concat(cur.spots || [], cur.food || []).filter(function (x) {
      if (!x || !want[W.norm(x.n)] || x.lat != null || x.pinAsked) return false;
      var r = W.placeInfo ? W.placeInfo(x, country, city) : null;
      return !(r && (r.nopin || r.st === "closed" || r.st === "unfound" || r.st === "dup"));
    }).slice(0, 20);
    if (!need.length) return;
    var center = centerOf(ck);
    run("pins|" + ck + "|" + need.map(function (x) { return W.norm(x.n); }).join(";"), "Where exactly is each of these places in or near " + city + ", " + country + "? " +
      "Give the latitude and longitude of the place itself (its entrance, or the middle of a beach, square or market). If a name covers an area or a choice of places, give its most typical spot. " +
      "Use null for any you cannot place with confidence.\n" + need.map(function (x) { return x.n; }).join("; ") +
      "\nReply with JSON only: {\"pins\":[{\"n\":\"the name exactly as given\",\"lat\":0.0,\"lng\":0.0}]}", "quick", function (r) {
        var map = {}; (r && r.pins || []).forEach(function (q) { if (q && q.n) map[W.norm(q.n)] = q; });
        need.forEach(function (x) {
          var q = map[W.norm(x.n)] || {}, p = V.pinNear(q.lat, q.lng, center, 120);
          x.pinAsked = 1;
          if (p) { x.lat = p.lat; x.lng = p.lng; x.g = [p.lat, p.lng]; }
        });
      });
  };

  /* official booking and menu links, and recommended visit times, for ideas saved before those existed.
     first = names to fill first (today's stops) */
  W.loadBookLinks = function (country, city, first) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck]; if (!cur) return;
    var spots = cur.spots || [], food = cur.food || [], isF = {};
    food.forEach(function (x) { isF[W.norm(x.n)] = 1; });
    function wantLink(x) { return isF[W.norm(x.n)] ? x.menu === undefined || (W.needsBooking(x) && x.book === undefined) : (W.isPaid(x) || W.needsBooking(x)) && x.bookV !== 2; }
    function wantDur(x) { return !x.dur && !x.durAsked; }
    var foodTrip = W.S.styles.indexOf("food") > -1;
    function wantFav(x) { return foodTrip && isF[W.norm(x.n)] && x.fav === undefined; }
    var pri = {}; (first || []).forEach(function (n, i) { pri[W.norm(n)] = i + 1; });
    /* opening hours and how far ahead to book: only for places on the trip */
    /* with children where locals dine late, every dinner place's hours, so the plan can pick ones that open early */
    var kidLate = W.party().kid && W.lateDinner && W.lateDinner(country);
    function wantHours(x) { return x.hours === undefined && (pri[W.norm(x.n)] || (kidLate && isF[W.norm(x.n)] && x.meal !== "breakfast" && x.meal !== "lunch")); }
    function wantLead(x) { return pri[W.norm(x.n)] && x.lead === undefined && (W.isPaid(x) || W.needsBooking(x) || x.reserve); }
    /* place check: still open? and the gist of its reviews (places on the trip only) */
    function wantRev(x) { return pri[W.norm(x.n)] && x.st === undefined; }
    /* beach check: every beach when little kids come along (so the plan can favour calm ones), else just the trip's */
    var kids = W.party().kid;
    function wantBeach(x) { return !isF[W.norm(x.n)] && x.bch === undefined && W.isBeach(x) && (kids || pri[W.norm(x.n)]); }
    var need = /** @type {(Spot | Food)[]} */ (spots).concat(food).filter(function (x) { return wantLink(x) || wantDur(x) || wantFav(x) || wantHours(x) || wantLead(x) || wantRev(x) || wantBeach(x); })
      .sort(function (a, b) { return (pri[W.norm(a.n)] || 999) - (pri[W.norm(b.n)] || 999); }).slice(0, 30);
    if (!need.length) return;
    var see = need.filter(function (x) { return !isF[W.norm(x.n)]; }), eat = need.filter(function (x) { return isF[W.norm(x.n)]; });
    var askHours = need.some(wantHours), askLead = need.some(wantLead), askRev = need.some(wantRev), askBeach = need.some(wantBeach);
    run("links|" + ck + "|" + need.length + "|" + W.norm(need[0].n), "For each of these places in " + city + ", " + country + ": " +
      "dur = the recommended time to spend there for these travelers, e.g. '45m', '1-2h', 'half day' (for places to eat, the time to allow for a meal). " + who() + " " +
      "book = the page on the place's OWN official website (or its official ticket office) where visitors buy tickets or book a table. Never a reseller, tour operator, search page or look-alike ticket site (no GetYourGuide, Viator, Tiqets, Klook, Headout, 'xyztickets.com'). " +
      "menu = for places to eat, the page on the place's own website that shows its menu (or its homepage). Use an empty string for any link you are not confident of." +
      (foodTrip ? " fav = for places to eat, true if food lovers seek it out (a famous classic, a top market, a destination restaurant)." : "") +
      (askHours ? " hours = typical opening hours as {\"open\":\"09:00\",\"close\":\"19:00\",\"closed\":[1]}: closed lists the weekdays it is shut (0 = Sunday, 1 = Monday ... 6 = Saturday); for places to eat, the hours the kitchen serves; use \"00:00\" and \"24:00\" for places that are always open such as parks, beaches or viewpoints." : "") +
      (askLead ? " lead = how many days ahead to book to be safe in high season (0 if there is no need to book)." : "") +
      (askRev ? " st = \"open\" if you are confident it still operates, \"closed\" if it has closed for good or no longer exists, \"unsure\" otherwise. love = what reviewers praise most (at most 8 words). gripe = the most common complaint in reviews (at most 8 words; empty if none stands out)." : "") +
      (askBeach ? " beach = for beaches only, what parents of young children need to know, as {\"calm\":\"calm\" or \"some waves\" or \"often rough\" (in summer), \"shallow\":true if the water stays shallow for a good way out, \"shade\":\"umbrellas\" or \"trees\" or \"little\" or \"none\", \"lifeguard\":true if there is usually a lifeguard in summer, \"sand\":\"sand\" or \"pebbles\" or \"mixed\" or \"rocks\", \"walk\":minutes on foot from the nearest parking or bus stop, \"facilities\":true if there are toilets or a café, \"note\":at most 10 words for parents}; leave it out for places that are not beaches." : "") +
      (see.length ? "\nThings to do: " + see.map(function (x) { return x.n; }).join("; ") : "") +
      (eat.length ? "\nPlaces to eat: " + eat.map(function (x) { return x.n; }).join("; ") : "") +
      "\nReply with JSON only: {\"links\":[{\"n\":\"the name exactly as given\",\"dur\":\"1-2h\",\"book\":\"https://...\",\"menu\":\"https://...\"" + (foodTrip ? ",\"fav\":false" : "") + (askHours ? ",\"hours\":{\"open\":\"09:00\",\"close\":\"19:00\",\"closed\":[]}" : "") + (askLead ? ",\"lead\":14" : "") + (askRev ? ",\"st\":\"open\",\"love\":\"\",\"gripe\":\"\"" : "") + (askBeach ? ",\"beach\":{\"calm\":\"calm\",\"shallow\":true,\"shade\":\"umbrellas\",\"lifeguard\":true,\"sand\":\"sand\",\"walk\":5,\"facilities\":true,\"note\":\"\"}" : "") + "}]}",
      "default", function (r) {
        var map = {}; (r && r.links || []).forEach(function (l) { if (l && l.n) map[W.norm(l.n)] = l; });
        need.forEach(function (x) {
          var l = map[W.norm(x.n)] || {}, f = isF[W.norm(x.n)];
          if (wantLink(x)) {
            if (!f) { x.book = W.bookUrl(l.book || l.url); x.bookV = 2; }   /* "" = asked, no confident official link */
            else {
              if (x.menu === undefined) x.menu = W.bookUrl(l.menu);
              if (x.book === undefined) x.book = W.bookUrl(l.book);
            }
          }
          if (wantDur(x)) { if (W.durText(l.dur)) x.dur = V.str(l.dur, 24); x.durAsked = 1; }
          if (wantFav(x)) x.fav = l.fav === true;
          if (wantRev(x)) { x.st = V.status(l.st); x.love = V.str(l.love, 80); x.gripe = V.str(l.gripe, 80); }
          if (wantBeach(x)) x.bch = V.beach(l.beach);
          if (wantHours(x)) x.hours = V.hours(l.hours);
          if (wantLead(x)) x.lead = V.lead(l.lead);
        });
      });
  };

  /* ---------- beach check ---------- */
  W.isBeach = function (x) { return !!x && W.picKind && W.picKind(x, false) === "beach" && !/\b(bar|club|restaurant|taverna|cafe|café|hotel|resort)\b/i.test(x.n); };
  W.normBeach = V.beach;
  /* how good a beach is for little ones: "safe", "care" or "" (unknown or in between) */
  W.beachFit = function (x) {
    var b = x && x.bch; if (!b || !b.calm) return "";
    var p = W.party();
    if (b.calm === "often rough" || (p.toddler && b.shallow === false) || b.sand === "rocks" && p.toddler) return "care";
    if (b.calm === "calm" && b.shallow !== false) return "safe";
    return "";
  };

  /* opening hours as minutes since midnight: {o, c, closed:[weekdays]}, or null when unknown */
  W.normHours = V.hours;

  /* getting between two stops: train, bus, ferry, flight or car, with official operator sites */
  W.legKey = function (a, b) { return a.country + "|" + a.name + ">" + b.country + "|" + b.name; };
  /* comparison and resale sites for trains, buses and ferries: the operator's own site sells the same ticket without the extra fee */
  var LEG_RESELL = /(^|\.)(ferryhopper|directferries|direct-ferries|aferry|openseas|ferryscanner|ferriesingreece|greekferries|ferries-?online|rome2rio|omio|goeuro|trainline|raileurope|busbud|wanderu|bookaway|12go|kiwi|skyscanner|kayak|expedia|getbybus|virail|checkmybus)\./i;
  function legUrl(u) {
    u = W.bookUrl(u); if (!u) return "";
    var host = ""; try { host = new URL(u).hostname.toLowerCase(); } catch (e) { return ""; }
    return LEG_RESELL.test("." + host + ".") ? "" : u;
  }
  var LEGV = 2;   /* v2: always asks about ferries */
  W.legBusy = function (a, b) { return W.status["leg|" + W.legKey(a, b) + "|v" + LEGV] === "loading"; };
  W.loadLeg = function (a, b) {
    var k = W.legKey(a, b); W.C.legs = W.C.legs || {};
    if (W.C.legs[k] && W.C.legs[k].v === LEGV) return;
    run("leg|" + k + "|v" + LEGV, "How should this group travel from " + a.name + ", " + a.country + " to " + b.name + ", " + b.country + "? " + who() +
      " Give the 2 to 5 sensible options (train, bus, ferry, flight or car), best first for this group. If a ferry or boat runs on this route or on part of it (between islands, along a coast or a lake, across a strait or a bay), always include it even when something else is faster: one option per ferry company that runs it, with the ports it sails between." +
      " For each: mode, from and to (stations, ports or airports), dur (just the journey, e.g. '1h 35m'), price (typical one-way price per adult in local currency, e.g. '€25–45'), freq (how often, e.g. 'every 30 min'; for a ferry also the months it sails if it is seasonal, e.g. '3 a day, Apr–Oct'), op (the company, e.g. 'Trenitalia / Italo', 'Blue Star Ferries')," +
      " url (the company's OWN official website where tickets are sold, never a reseller or comparison site such as Ferryhopper, Direct Ferries, Openseas, Trainline, Omio, Rome2rio, Kayak or Expedia; empty if you are not sure of the exact address), book (true if it should be booked ahead), note (one short tip for families, e.g. which ferries have cabins or decks for kids)." +
      "\nReply with JSON only: {\"opts\":[{\"mode\":\"ferry\",\"from\":\"\",\"to\":\"\",\"dur\":\"\",\"price\":\"\",\"freq\":\"\",\"op\":\"\",\"url\":\"\",\"book\":false,\"note\":\"\"}]}",
      "quick", function (r) {
        W.C.legs[k] = { v: LEGV, opts: (r && r.opts || []).filter(function (o) { return o && o.mode; }).slice(0, 5).map(function (o) {
          return { mode: String(o.mode).toLowerCase(), from: String(o.from || ""), to: String(o.to || ""), dur: String(o.dur || ""), price: String(o.price || ""), freq: String(o.freq || ""),
            op: String(o.op || ""), url: legUrl(o.url), book: o.book === true, note: String(o.note || "") };
        }) };
      });
  };

  /* real journey times from Rome2Rio (your connector), asked for on a tap: up to six ways to go, with how long each takes
     door to door and who runs it. It never books anything; the app keeps the times next to Claude's options. */
  W.checkRoutes = function (a, b) {
    var k = W.legKey(a, b), lg = W.C.legs && W.C.legs[k], sk = "r2r|" + k;
    if (!lg || W.status[sk] === "loading" || !W.callTool) return;
    W.status[sk] = "loading"; W.r2rMsg = ""; changed();
    W.callTool("Rome2Rio", "get-routes", { origin: a.name + ", " + a.country, destination: b.name + ", " + b.country }).then(function (res) {
      var p = res && (res.payload || res.structuredContent) || res || {};
      if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { p = {}; } }
      var list = (Array.isArray(p.available_routes) ? p.available_routes : []).map(function (r) {
        return { name: String(r && r.name || "").slice(0, 60), min: Math.round(+(r && r.duration)) || 0, carriers: (Array.isArray(r && r.carriers) ? r.carriers : []).slice(0, 3).map(function (c) { return String(c).slice(0, 40); }) };
      }).filter(function (r) { return r.name && r.min > 0 && r.min < 72 * 60; }).slice(0, 6);
      lg.r2r = { at: Date.now(), routes: list };
      delete W.status[sk]; arrived();
    }, function (e) { W.status[sk] = "error"; W.r2rMsg = W.mcpMsg ? W.mcpMsg(e, "Rome2Rio") : "Rome2Rio didn't answer. Try again in a minute."; changed(); });
  };

  /* food needs: check the places already listed once for these needs, and add a few that fit them well */
  W.loadEatFit = function (country, city) {
    var sig = W.eatSig(); if (!sig || W.readOnly) return;
    var ck = W.cityKey(country, city), cur = W.C.city[ck]; if (!cur || cur.fallback || !(cur.food || []).length || W.cityBusy(ck)) return;
    var todo = cur.food.filter(function (x) { return !x.eat || x.eat.sig !== sig; }).slice(0, 60);
    if (todo.length) run("eatfit|" + ck + "|" + sig + "|" + todo.length, "Places to eat in " + city + ", " + country + ". " + who() + " The group's food needs: " + W.eatText() + "." +
      " For each place, how well can it feed this group? fit = good (plenty they can eat), ok (some options; tell the staff) or poor (hard to eat there: say why); fitw = one short line on what they can have or what to ask." +
      " Judge from the kind of place and its menu as far as you know it; for allergies, never promise a place is safe." +
      "\nPlaces: " + todo.map(function (x) { return x.n + (x.cuisine ? " (" + x.cuisine + ")" : ""); }).join("; ") +
      "\nReply with JSON only: {\"fit\":[{\"n\":\"the name exactly as given\",\"fit\":\"good\",\"fitw\":\"\"}]}",
      "quick", function (r) {
        var by = {}; (r && Array.isArray(r.fit) ? r.fit : []).forEach(function (x) { if (x && typeof x.n === "string" && /^(good|ok|poor)$/.test(x.fit)) by[W.norm(x.n)] = { f: x.fit, w: String(x.fitw || "").trim().slice(0, 120), sig: sig }; });
        var c0 = W.C.city[ck]; (c0 && c0.food || []).forEach(function (x) { var f = by[W.norm(x.n)]; if (f) x.eat = f; });
        /* a place the answer left out counts as checked (not known either way), so it isn't asked about again */
        todo.forEach(function (x) { if (!x.eat || x.eat.sig !== sig) x.eat = { f: "", w: "", sig: sig }; });
      });
    /* no extra list of places that suit the food needs: the first list and every "Find more" are asked with them (foodAsk) */
  };

  /* regional holidays and festivals in a city for the days you're there (lib/holidays.js lays them on the days). The
     national holidays are worked out in the app and named in the question, so Claude adds only what they miss; for a
     country the app doesn't know, its national ones too. Asked once per city and dates; anything uncertain is left out. */
  var EVV = 1;
  W.loadEvents = function (country, city, from, to) {
    if (!from || !to || W.readOnly) return;
    var ck = W.cityKey(country, city), have = W.C.events[ck];
    if (have && have.v === EVV && have.from <= from && have.to >= to) return;
    var nat = W.holidaysBetween ? W.holidaysBetween(country, from, to) : [], known = W.holidaysKnown && W.holidaysKnown(country), yr = from.slice(0, 4);
    run("events|" + ck + "|" + from + "|" + to, "Public holidays, festivals and big events in or near " + city + ", " + country + " between " + from + " and " + to + " (" + yr + "), for a family visiting then. " + who() +
      (known ? " The national public holidays are already known" + (nat.length ? " (" + nat.map(function (h) { return h.iso + " " + h.n; }).join("; ") + ")" : " (none fall in these dates)") + ": do not repeat them. Include regional, island or city public holidays (a patron saint's day, a region's day) that fall in these dates."
        : " Include the national public holidays that fall in these dates, and any regional or city ones.") +
      " Also festivals, fairs, processions, parades, big sporting or music events a visiting family would notice (crowds, closed streets, higher prices) or might enjoy, with their real dates in " + yr + "." +
      " Only what you are confident happens on these dates in " + yr + "; leave out anything uncertain. Up to 10." +
      " For each: n = the name in English (the local name in brackets when it helps), from and to = YYYY-MM-DD (the same for one day), kind = holiday (a public holiday: shops and offices close), festival or event," +
      " closes = true when most shops and many sights close that day, crowds = true when streets or sights get very busy, note = one short practical line for a family (what to expect, what's worth seeing, what to book)." +
      "\nReply with JSON only: {\"events\":[{\"n\":\"\",\"from\":\"\",\"to\":\"\",\"kind\":\"festival\",\"closes\":false,\"crowds\":false,\"note\":\"\"}]}",
      "quick", function (r) {
        var lo = W.isoDay(new Date(new Date(from + "T12:00").getTime() - 30 * 864e5)), hi = W.isoDay(new Date(new Date(to + "T12:00").getTime() + 30 * 864e5)), D = /^\d{4}-\d{2}-\d{2}$/;
        var items = (r && Array.isArray(r.events) ? r.events : []).filter(function (e) { return e && typeof e.n === "string" && e.n.trim() && D.test(e.from) && D.test(e.to || e.from); }).map(function (e) {
          var f = e.from, t = e.to || e.from; if (t < f) { var x = f; f = t; t = x; }
          return { n: e.n.trim().slice(0, 90), from: f, to: t, kind: /^(holiday|festival|event)$/.test(e.kind) ? e.kind : "event", closes: e.closes === true, crowds: e.crowds === true, note: String(e.note || "").trim().slice(0, 160) };
        }).filter(function (e) { return e.to >= from && e.from <= to && e.from >= lo && e.to <= hi; }).slice(0, 10);
        W.C.events[ck] = { v: EVV, from: from, to: to, items: items };
      });
  };

  /* typical costs for the budget: meals, getting around and a mid-range room for this group, plus each paid sight's entry for the whole group */
  W.loadCosts = function (country, city) {
    var ck = W.cityKey(country, city), pool = W.C.city[ck]; if (!pool || pool.fallback) return;
    var ages = W.ages().join(","), have = W.C.cost[ck];
    if (have && have.ages !== ages) have = null;
    var paid = (pool.spots || []).filter(W.isPaid).map(function (x) { return x.n; });
    var missing = paid.filter(function (n) { return !have || !(W.norm(n) in have.tickets); }).slice(0, 40);
    if (have && !missing.length) return;
    run("cost|" + ck + "|" + ages + "|" + missing.length, "Typical travel costs in " + city + ", " + country + " for this group. " + who() +
      " Use the local currency (cur = its ISO 4217 code) and plain numbers. breakfast, lunch, dinner = the total for the whole group for one typical meal at mid-priced places. transit = the total per day for the group getting around by public transport and the odd taxi. lodge = a typical price per night for a mid-range room or apartment that fits the group. tickets = for each place below, the total entry cost for the whole group, applying children's prices and free entry for small children (0 if free)." +
      (missing.length ? "\nPlaces: " + missing.join("; ") : "") +
      "\nReply with JSON only: {\"cur\":\"EUR\",\"breakfast\":0,\"lunch\":0,\"dinner\":0,\"transit\":0,\"lodge\":0,\"tickets\":[{\"n\":\"the name exactly as given\",\"total\":0}]}",
      "quick", function (r) {
        r = r || {};
        var c = W.C.cost[ck] && W.C.cost[ck].ages === ages ? W.C.cost[ck] : { ages: ages, tickets: {} };
        if (!c.cur) { c.cur = V.currency(r.cur, "EUR"); ["breakfast", "lunch", "dinner", "transit", "lodge"].forEach(function (k) { c[k] = V.money(r[k]); }); }
        var got = {}; (Array.isArray(r.tickets) ? r.tickets : []).forEach(function (t) { if (t && t.n) got[W.norm(t.n)] = V.money(t.total); });
        missing.forEach(function (nm) { var k = W.norm(nm); c.tickets[k] = k in got ? got[k] : null; });
        W.C.cost[ck] = c;
      });
  };
  /* the time zone of a country, for calendar events (a short list is built in; anything else asks Claude once) */
  W.loadTz = function (country) {
    if (W.C.tz[country]) return;
    run("tz|" + country, "What is the IANA time zone name for most visitors to " + country + "? Reply with JSON only: {\"tz\":\"Europe/Rome\"}", "quick", function (r) {
      var z = V.tz(r && r.tz); if (z) W.C.tz[country] = z;
    });
  };

  /* breakfast places, for cities whose ideas were saved before the app planned breakfast */
  W.loadBreakfast = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck]; if (!cur) return;
    var exF = (cur.food || []).map(function (x) { return x.n; });
    run("bfast|" + ck, "List 12 places for breakfast in " + city + ", " + country + ": cafés, bakeries, pastry shops and brunch spots, spread across the city or region so there is always one close by. " + who() +
      (exF.length ? " Do not repeat: " + exF.join("; ") + "." : "") +
      "\nReply with JSON only: {\"food\":[{\"n\":\"name\",\"d\":\"what it is known for or what to order, one short sentence\",\"cuisine\":\"\",\"price\":\"€\",\"meal\":\"breakfast\",\"dur\":\"45m\",\"k\":0,\"menu\":\"\",\"pic\":\"cafe\",\"lat\":0,\"lng\":0}]}\n" +
      "meal = breakfast, or all if it also serves lunch and dinner. dur = the recommended time to allow there, e.g. '30m' or '1h'. " + MENURULE + " pic = cafe or bakery. Use real places and accurate coordinates. k: 1 = very family friendly, 0 = fine, -1 = adults-oriented.",
      "default", function (r) {
        var c0 = W.C.city[ck] || newPool(), add = V.list(r && r.food, function (x) { var f = V.food(x, centerOf(ck), { meal: "breakfast", pic: "cafe" }); if (f && f.meal !== "all") f.meal = "breakfast"; return f; });
        var once = {}; add = add.filter(function (x) { var k = W.norm(x.n); if (once[k]) return false; once[k] = 1; return true; });
        c0.food = merge(c0.food || [], add, "bfast"); W.C.city[ck] = c0;
      });
  };

  /* find coordinates for a hotel or address */
  W.geocode = function (country, city, text, done) {
    var gk = W.cityKey(country, city) + "|" + W.norm(text);
    if (W.C.geo[gk]) return done(W.C.geo[gk]);
    var m = text.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
    if (m) return done({ lat: +m[1], lng: +m[3] });
    run("geo|" + gk, "Give the coordinates of this lodging or address: \"" + text + "\" in " + city + ", " + country +
      ". If it is a hotel name, use that hotel. If unsure, use the neighborhood's center.\nReply with JSON only: {\"lat\":0,\"lng\":0,\"label\":\"short name\",\"area\":\"neighborhood\"}",
      "quick", function (r) {
        var q = r && V.pinNear(r.lat, r.lng, centerOf(W.cityKey(country, city)), 120);
        if (q) { W.C.geo[gk] = { lat: q.lat, lng: q.lng, area: V.str(r.area, 60) }; done(W.C.geo[gk]); }
      });
  };
})();
