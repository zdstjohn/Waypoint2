/* Waypoint core: state, caches, helpers, and Claude-powered data loading. */
(function () {
  "use strict";
  var W = window.W = window.W || /** @type {Waypoint} */ ({});   /* validate.js may have set up W.V first */
  /* the page is wrapped by its host, so the language is set here (screen readers pick the voice from it) */
  if (!document.documentElement.lang) document.documentElement.lang = "en";
  var STYLES = window.STYLES;
  W.STYLE_NAME = {}; STYLES.forEach(function (s) { W.STYLE_NAME[s[0]] = s[1]; });
  W.$ = function (id) { return document.getElementById(id); };
  W.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  W.norm = function (s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); };
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
  W.S = s && s.v === 2 ? s : JSON.parse(JSON.stringify(DEFAULT));
  W.isExample = !s;
  if (!W.S.cityDays) W.S.cityDays = {};   /* days you set for each place */
  var c = load("waypoint-cache-v2") || {};
  W.C = /** @type {Cache} */ ({ country: c.country || {}, city: c.city || {}, geo: c.geo || {}, area: c.area || {}, range: c.range || {}, legs: c.legs || {}, cost: c.cost || {}, tz: c.tz || {} });
  var lastS = null, lastV = -1;
  W.save = function () {
    if (W.readOnly) return;   /* someone else's shared trip: look, don't keep */
    try { var js = JSON.stringify(W.S); if (js !== lastS) { localStorage.setItem("waypoint-v2", js); lastS = js; } } catch (e) {}
    /* the cache is big (city lists for every place); it is written only when data has arrived since the last save */
    try { if (W.dataV !== lastV) { localStorage.setItem("waypoint-cache-v2", JSON.stringify(W.C)); lastV = W.dataV; } } catch (e) {}
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
  W.gmapsPlace = function (name, city) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(name + ", " + city); };

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
  W.countryCities = function (name) {
    var built = (window.TD[name] || {}).cities || [], ai = (W.C.country[name] || {}).cities || [];
    var out = [], seen = {};
    built.concat(ai).forEach(function (c) { var k = W.norm(c.name); if (!seen[k]) { seen[k] = 1; out.push(c); } });
    return out;
  };
  W.countryBlurb = function (name) { return (window.TD[name] || {}).blurb || (W.C.country[name] || {}).blurb || ""; };
  W.findCity = function (country, name) {
    var k = W.norm(name);
    return W.countryCities(country).filter(function (c) { return W.norm(c.name) === k; })[0] || null;
  };
  W.cityKey = function (country, city) { return country + "|" + city; };
  /* idea pool for a city: Claude's list, or the built-in fallback when Claude isn't available */
  W.pool = function (country, city) {
    var c = W.C.city[W.cityKey(country, city)];
    if (c && c.spots && c.spots.length) { if (W.withImported) W.withImported(country, city, c); if (W.applyPlaces) W.applyPlaces(country, city, c); return c; }
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
    queue.push(function () {
      running++;
      W.SAMPLE.json(prompt, { modelTier: tier || "default" }).then(function (res) {
        delete W.status[key]; onOk(res);
      }, function (err) {
        var code = err && err.code;
        if (code === "not_granted") { W.sampleState = "off"; delete W.status[key]; }
        else W.status[key] = code === "rate_limited" ? "Busy right now. Try again in a minute." : "Couldn't load this. Try again.";
      }).then(function () { running--; changed(); pump(); });
    });
    soon(); pump();
  }
  /* redraw once after a burst of new requests, instead of once per request (which re-entered the planner mid-loop) */
  var soonPending = false;
  function soon() { if (soonPending) return; soonPending = true; Promise.resolve().then(function () { soonPending = false; changed(); }); }
  /* nothing is asked of Claude while offline (or in an offline copy); the queue waits for the signal to come back */
  function pump() { if (W.holdLoads || !navigator.onLine || window.__WP_OFFLINE) return; while (running < 3 && queue.length) queue.shift()(); }
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

  /* every destination in a country */
  W.loadCountry = function (name) {
    var key = "country|" + name;
    if (W.C.country[name] || W.status[key]) return;
    run(key, "List the cities, towns, islands and areas that travelers visit in " + name +
      ". Be thorough: 80 to 120 places covering every region, from major cities to small towns and islands. Only real places.\n" +
      "Reply with JSON only: {\"blurb\":\"one sentence about traveling in " + name + "\",\"cities\":[{\"name\":\"\",\"region\":\"\",\"lat\":0,\"lng\":0,\"w\":2,\"pop\":3,\"t\":[\"tag\"],\"d\":\"what it is known for, max 12 words\"}]}\n" +
      "w = suggested days (1-4). pop = how popular with visitors, 1-5." + TAGRULE.split(" k:")[0],
      "quick", function (r) {
        var list = V.list(r && r.cities, V.city);
        /* keep even an empty answer so the page never asks again in a loop */
        W.C.country[name] = { blurb: String(r && r.blurb || ""), cities: list };
      });
  };

  /* 25+ things to do, plus places to eat, transit and where to stay, for one city */
  var tries = {};
  W.loadCity = function (country, city, more) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!more && cur && cur.spots && cur.spots.length) return;
    /* never ask about the same city over and over if answers keep coming back empty */
    /* count real attempts only: a redraw while this city's lists are on their way isn't another try */
    if (!more && W.cityBusy(ck)) return;
    var tk = ck + (more ? "|more" : ""); tries[tk] = (tries[tk] || 0) + 1;
    if (!more && tries[tk] > 3) return;
    var ex = cur && cur.spots ? cur.spots.map(function (x) { return x.n; }) : [];
    var exF = cur && cur.food ? cur.food.map(function (x) { return x.n; }) : [];
    var where = city + ", " + country, st = W.S.stays[ck];
    /* when you've set your lodging, extra ideas come from around it */
    var nearStay = more && st && st.label ? " Focus on places within an easy trip of " + st.label + "." : "";
    var lean = W.S.styles.length ? " Lean toward the travelers' interests (" + W.S.styles.map(function (x) { return W.STYLE_NAME[x]; }).join(", ") + "): at least half should suit them, alongside the must-see sights." : "";
    var EVE = " If it is a large region or island, give options in each main area so a day can stay in one area. Do not include trains, transfers or transport as activities. ";
    var CITY = "\"d\":\"what " + city + " is known for, one sentence\",\"lat\":0,\"lng\":0,";
    var TRANSIT = "\"transit\":{\"system\":\"how public transit works and what a ticket costs, one sentence\",\"pass\":\"best pass or card for visitors\",\"airport\":\"how to get from the main airport or station to the center\",\"tip\":\"one practical tip\"},\"stay\":[{\"n\":\"neighborhood\",\"d\":\"why stay here, short\",\"lat\":0,\"lng\":0}],";
    function foodAsk(what, extra) {
      return what + " " + who() + (exF.length ? " Do not repeat: " + exF.join("; ") + "." : "") +
        "\nReply with JSON only: {" + (extra || "") + "\"food\":[" + FOOD_EX + "]}\n" + foodRules() + (extra ? " Give 4 stay neighborhoods." : "");
    }
    if (more) {
      run("spots|" + ck, "List 20 MORE things to do in and around " + where + ". Mix famous sights, local favorites, parks, markets, neighborhoods, experiences and a few day trips." + lean + focusAsk() +
        " Include at least 5 evening options (sunset spots, evening strolls, shows, night markets)." + EVE + nearStay + " " + who() +
        (ex.length ? " Do not repeat any of these: " + ex.join("; ") + "." : "") + "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules(),
        "default", function (r) { addSpots(ck, r); });
      run("food|" + ck, foodAsk("List 18 MORE places to eat in " + where + ": breakfast cafés and bakeries, local classics, casual spots and markets, spread across the city or region." + focusAsk() + nearStay), "default", function (r) { addFood(ck, r); });
      return;
    }
    /* the first lists come in two halves asked at the same time, so the first days can be planned as soon as either arrives */
    run("spots|" + ck, "List the 14 best-known sights and must-do experiences in and around " + where + ": the headline places most visitors come for, most important first." +
      " Include at least 3 evening options (sunset spots, evening strolls, shows)." + EVE + who() +
      "\nReply with JSON only: {" + CITY + "\"spots\":[" + SPOT_EX + "]}\n" + spotRules(),
      "default", function (r) { addSpots(ck, r, true); });
    var bAsk = W.focus() === "gems" ? "List 14 hidden gems and local favorites in and around " + where + " that locals love and most visitors miss, each still well reviewed: small museums, quiet viewpoints, neighborhood squares and markets, local experiences and a couple of day trips."
      : W.focus() === "icons" ? "List 14 more of the most popular, best-reviewed things to do in and around " + where + " beyond the very top sights: well-loved parks, markets, neighborhoods, experiences and a couple of classic day trips."
      : "List 14 things to do in and around " + where + " beyond the famous headline sights: well-loved local favorites and a few lesser-known gems that delight, parks, markets, neighborhoods, experiences and a couple of day trips.";
    run("spots|" + ck + "|b", bAsk + lean +
      " Include at least 4 evening options (evening strolls, shows, night markets)." + EVE + who() +
      "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules(),
      "default", function (r) { addSpots(ck, r); });
    run("food|" + ck, foodAsk("List 12 places to eat in " + where + ": the best-loved local classics and a couple of special dinners, plus at least 3 breakfast cafés or bakeries, spread across the city or region.", TRANSIT),
      "default", function (r) {
        var c0 = W.C.city[ck] || newPool();
        var tr = r && V.transit(r.transit); if (tr && !c0.transit) c0.transit = tr;
        if (r && Array.isArray(r.stay) && !c0.stay) c0.stay = V.list(r.stay, function (x) { return V.stayArea(x, centerOf(ck)); });
        W.C.city[ck] = c0; addFood(ck, r, true);
      });
    run("food|" + ck + "|b", foodAsk("List 12 places to eat in " + where + " that are not the most famous ones: casual neighborhood spots, markets, street food and family-friendly places, plus at least 3 breakfast cafés or bakeries, spread across the city or region." + (W.focus() === "gems" ? " Favor the places locals go." : "")),
      "default", function (r) { addFood(ck, r); });
  };
  /* is anything still coming in for this city's first lists? */
  W.cityBusy = function (ck) { return ["spots|", "spots|", "food|", "food|"].some(function (p, i) { return W.status[p + ck + (i % 2 ? "|b" : "")] === "loading"; }); };

  var FOOD_EX = "{\"n\":\"name\",\"d\":\"what it is known for or what to order, one short sentence\",\"fame\":1,\"rating\":4.5,\"cuisine\":\"\",\"price\":\"€€\",\"meal\":\"both\",\"dur\":\"1h\",\"fav\":false,\"k\":0,\"reserve\":false,\"book\":\"\",\"menu\":\"\",\"pic\":\"taverna\",\"lat\":0,\"lng\":0}";
  function foodRules() {
    return "pic = the picture that fits best, one of: " + W.FOOD_PICS.join(", ") + ". " + MENURULE + " reserve = true if booking a table ahead is recommended; then book = its official website or reservation page if you are confident of the address, else an empty string. meal = breakfast, lunch, dinner, both (lunch and dinner) or all (all three). dur = the recommended time to allow for a meal there, e.g. '30m' for a bakery, '1-1.5h' for a sit-down lunch, '2h' for a long dinner. fav = true for places food lovers seek out (a famous classic, a top market, a destination restaurant). Use real places and accurate coordinates." + TAGRULE.split(" Tags")[0] + " k: 1 = very family friendly, 0 = fine, -1 = adults-oriented." + FAMERULE.replace("must-sees most visitors come for (a city's top handful)", "famous institutions visitors seek out").replace("hidden gems and local favorites most visitors miss", "neighborhood places locals love");
  }
  /* add places to eat; front = the best-loved half, which stays at the top of the list whichever half arrives first */
  function addFood(ck, r, front) {
    var c0 = W.C.city[ck] || newPool(), ctr = centerOf(ck);
    var add = V.list(r && r.food, function (x) { return V.food(x, ctr); });
    c0.food = merge(c0.food || [], add, front); W.C.city[ck] = c0;
  }
  function merge(list, add, front) {
    if (front) { var mine = {}; add.forEach(function (x) { mine[W.norm(x.n)] = 1; }); return add.concat(list.filter(function (x) { return !mine[W.norm(x.n)]; })); }
    var have = {}; list.forEach(function (x) { have[W.norm(x.n)] = 1; });
    return list.concat(add.filter(function (x) { return !have[W.norm(x.n)]; }));
  }

  /* the shape of one thing to do, shared by every request for them */
  var SPOT_EX = "{\"n\":\"name\",\"d\":\"what it is or what it is known for, one short sentence\",\"t\":[\"tag\"],\"fame\":1,\"rating\":4.6,\"k\":0,\"s\":\"am\",\"dur\":\"2h\",\"ticket\":\"Free\",\"book\":\"\",\"pic\":\"oldtown\",\"place\":\"the real place\",\"lat\":0,\"lng\":0}";
  function spotRules() {
    return "place = the exact name of the real place, as on its sign or on a map (for an outing such as a stroll, a tasting or a cruise, the real place where it happens, e.g. 'Piazza Duomo' or 'Marina Grande'); never an invented or descriptive name. n may be descriptive, place may not. pic = the picture that fits best, one of: " + W.SPOT_PICS.join(", ") + ". s = best time: am, pm, eve, or any (a full-day outing). dur = the recommended time to spend there for these travelers (allow for children's ages), e.g. '45m', '1-2h', 'half day' or 'full day'. ticket = 'Free', or price and whether to book ahead, e.g. '€18, book ahead'. " + BOOKRULE + " Use accurate coordinates." + TAGRULE + FAMERULE;
  }
  function addSpots(ck, r, front) {
    var c0 = W.C.city[ck] || newPool();
    if (r && r.d && !c0.d) c0.d = V.str(r.d, 240);
    /* the city's own pin: only when it agrees with the built-in one (when there is one) */
    var cp = r && V.pinNear(r.lat, r.lng, centerOf(ck), 120); if (cp && c0.lat == null) { c0.lat = cp.lat; c0.lng = cp.lng; }
    var ctr = centerOf(ck), add = V.list(r && r.spots, function (x) { return V.spot(x, ctr); });
    /* the headline half always leads the list (the planner gives the first few a boost), whichever half arrives first */
    c0.spots = merge(c0.spots || [], add, front); W.C.city[ck] = c0; return c0;
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
        var c0 = addSpots(ck, r);
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
        addSpots(ck, r); W.freshPicks(country, city);
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
      "default", function (r) { addSpots(ck, r); });
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
        var c0 = W.C.city[ck] || newPool(), have = {};
        c0.food.forEach(function (x) { have[W.norm(x.n)] = 1; });
        V.list(r && r.food, function (x) { var f = V.food(x, centerOf(ck), { meal: "breakfast", pic: "cafe" }); if (f && f.meal !== "all") f.meal = "breakfast"; return f; })
          .forEach(function (x) { if (!have[W.norm(x.n)]) { have[W.norm(x.n)] = 1; c0.food.push(x); } });
        W.C.city[ck] = c0;
      });
  };

  /* a sketch of the area around where you're staying: shorelines, rivers and named places to get your bearings */
  W.areaKey = function (country, city, center, radius) { return W.cityKey(country, city) + "|" + center.lat.toFixed(2) + "," + center.lng.toFixed(2) + "|" + radius; };
  W.loadArea = function (country, city, center, radius) {
    var key = W.areaKey(country, city, center, radius);
    if (W.C.area[key]) return W.C.area[key];
    run("area|" + key, "I am drawing a simple sketch map. The area is the square reaching about " + radius + " km in every direction from latitude " + center.lat.toFixed(4) + ", longitude " + center.lng.toFixed(4) +
      " (near " + (center.label || city) + " in " + city + ", " + country + ").\nReply with JSON only: {\"places\":[{\"n\":\"name\",\"type\":\"district\",\"lat\":0,\"lng\":0}],\"water\":[{\"kind\":\"sea\",\"n\":\"name\",\"side\":\"S\",\"pts\":[[0,0],[0,0]]}]}\n" +
      "places: 10 to 16 real places inside the area that help a visitor get their bearings, spread across it. type is one of district, town, village, landmark, park, beach. " +
      "water: for a sea, bay, lagoon or big lake whose shore crosses the area, give the shoreline as 12 to 30 [lat,lng] points in order from one edge of the area to the other, and side = the compass direction (N, S, E, W, NE, NW, SE, SW) the water lies from that shore. " +
      "For a lake that sits fully inside the area, give its outline as a closed ring with side \"in\". For rivers and canals give the course as 6 to 20 points with kind river or canal. If there is no water in the area, give an empty list. Only include what is really there. Use coordinates with 4 decimals.",
      "default", function (r) {
        var places = V.list(r && r.places, function (p) { var n = p && V.name(p.n), q = n && V.pinNear(p.lat, p.lng, center, radius * 3 + 5); return q ? { n: n, type: V.str(p.type, 20) || "district", lat: q.lat, lng: q.lng } : null; });
        var water = (r && r.water || []).filter(function (w) { return w && Array.isArray(w.pts) && w.pts.length > 1; }).map(function (w) {
          return { kind: String(w.kind || "sea"), n: String(w.n || ""), side: String(w.side || "in").toUpperCase(), pts: w.pts.map(function (p) { return Array.isArray(p) ? [num(p[0]), num(p[1])] : [num(p.lat), num(p.lng)]; }).filter(function (p) { return p[0] != null && p[1] != null; }) };
        });
        W.C.area[key] = { places: places, water: water };
      });
    return null;
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
