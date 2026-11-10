/* Waypoint place search: find any place, not only the ones on the list, and put it on the day. Three sources, merged:
     - the city's own ideas (instant; "On your list", with the day it is already on)
     - Mapbox, through the viewer's own Mapbox connection: real places with exact pins, categories and addresses
     - Claude, for what the map does not know by that name, or a description ("calm beach for toddlers"); marked
       "Suggested by Claude" until the nightly place check confirms it
   A place you add joins the city's list as your own (S.imported, which travels with the trip) and goes into the part
   of the day you pick. The page itself cannot reach the internet: Mapbox comes through the connection, Claude
   through the app, and every answer goes through the same checks as the rest (W.V: a name, a pin near the city). */
(function () {
  "use strict";
  var W = window.W, esc = W.esc, V = W.V;
  /** @type {{ q: string, ck: string, seq: number, local: any[], mb: any[], ai: any[], busyMb: boolean, msgMb: string, pick: string | null, added: string }} */
  var st = { q: "", ck: "", seq: 0, local: [], mb: [], ai: [], busyMb: false, msgMb: "", pick: null, added: "" };
  /** Claude's answers by search, for this visit only (searches are not kept with the trip) @type {Record<string, any[]>} */
  var aiRes = {};
  var FOOD = /\b(restaurant|food|cafe|café|coffee|bakery|ice cream|gelat|bar|pub|pizz|tavern|trattoria|osteria|pastry|deli|snack|seafood|bistro|fast food|wine|brunch|breakfast|dining)\b/i;
  var SLOTS_DO = [["am", "Morning"], ["pm", "Afternoon"], ["eve", "Evening"]], SLOTS_EAT = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]];

  function centerFor(country, city) {
    var h = W.homebase(country, city); if (h && h.lat != null) return { lat: h.lat, lng: h.lng };
    var p = W.pool(country, city); if (p && p.lat != null) return { lat: p.lat, lng: p.lng };
    var c = W.findCity(country, city); return c && c.lat != null ? { lat: c.lat, lng: c.lng } : null;
  }
  function words(q) { return W.norm(q).split(" ").filter(function (w) { return w.length > 1; }); }
  /* one id per result, stable across redraws */
  function rid(src, n) { return src + ":" + W.norm(n); }

  /* the city's own ideas whose name or description has every word of the query */
  function local(q, country, city) {
    var p = W.pool(country, city); if (!p) return [];
    var ws = words(q); if (!ws.length) return [];
    var out = [];
    [[p.spots || [], false], [p.food || [], true]].forEach(function (L) {
      /** @type {any[]} */ (L[0]).forEach(function (it) {
        if (W.gone && W.gone(it)) return;
        var hay = W.norm(it.n + " " + (it.d || "") + " " + (it.cuisine || ""));
        if (ws.every(function (w) { return hay.indexOf(w) > -1; })) out.push({ id: rid("list", it.n), src: "list", n: it.n, d: it.d || "", lat: it.lat, lng: it.lng, gid: it.gid, food: L[1], it: it });
      });
    });
    return out.slice(0, 6);
  }

  /* Mapbox: real places around the city (about 20 km), nearest matches first */
  function mapbox(q, country, city, seq) {
    var c = centerFor(country, city); if (!c || !W.callTool || W.standalone) return;
    st.busyMb = true; st.msgMb = "";
    var input = { q: q.slice(0, 200), proximity: { longitude: c.lng, latitude: c.lat }, language: "en",
      bbox: { minLongitude: c.lng - 0.25, minLatitude: c.lat - 0.2, maxLongitude: c.lng + 0.25, maxLatitude: c.lat + 0.2 } };
    W.callTool("Mapbox", "search_and_geocode_tool", input).then(function (r) {
      if (seq !== st.seq) return;
      var fs = (r && r.payload && /** @type {any} */ (r.payload).features) || [];
      st.mb = fs.map(function (f) {
        var pr = f && f.properties || {}, g = f && f.geometry && f.geometry.coordinates || [];
        if (["country", "region", "postcode", "district"].indexOf(pr.feature_type) > -1) return null;
        var n = V.name(pr.name); if (!n) return null;
        var pin = V.pinNear(g[1], g[0], c, 60); if (!pin) return null;
        var cats = (pr.poi_category || []).filter(function (x) { return typeof x === "string"; });
        var what = cats.filter(function (x) { return !/^(food and drink|outdoors|food)$/i.test(x); })[0] || cats[0] || (pr.feature_type === "poi" ? "" : pr.feature_type);
        var addr = V.str(pr.address || pr.place_formatted || "", 80);
        return { id: rid("map", n), src: "map", n: n, d: [what ? what.charAt(0).toUpperCase() + what.slice(1) : "", addr].filter(Boolean).join(" · "), lat: pin.lat, lng: pin.lng,
          food: FOOD.test(cats.join(" ") + " " + (pr.maki || "")), mid: V.str(pr.mapbox_id, 120) };
      }).filter(Boolean).slice(0, 6);
    }, function (e) {
      if (seq !== st.seq) return;
      var code = e && e.code;
      st.msgMb = !navigator.onLine ? "You're offline: the map search needs a connection." : code === "server_not_connected" || code === "not_granted" ? "Connect Mapbox in Claude to search the map too." : code === "blocked_by_policy" ? "" : "The map search didn't answer this time.";
    }).then(function () { if (seq === st.seq) { st.busyMb = false; W.changed(); } });
  }

  /* Claude: up to six real, named places for the words you typed, checked like every other list */
  function claude(q, country, city) {
    var ck = W.cityKey(country, city), c = centerFor(country, city), key = "find|" + ck + "|" + W.norm(q);
    if (!W.run || W.readOnly || !W.SAMPLE) return;
    W.run(key, "Find places that match \"" + q.replace(/"/g, "'").slice(0, 120) + "\" in or near " + city + ", " + country + ", for this family trip. " + W.who() +
      " Give up to 6 real, specific, named places that exist and are open today, best match first: no generic suggestions (not \"local tavernas\" or \"a beach\"). " +
      "For each: n = its name, d = one short line on what it is and why it fits, food = true for a place to eat or drink, lat and lng = where it is, " +
      "t = 1-3 tags from [" + W.TAGS.join(", ") + "], k = 1 if great for the children, 0 if fine, -1 if not suitable. " +
      "For places to eat also meal (breakfast, lunch, dinner, both or all), cuisine and price (€, €€ or €€€); for things to do also s (am, pm, eve or any), dur (e.g. 1-2h) and ticket (e.g. Free or €12).\n" +
      "Reply with JSON only: {\"places\":[{\"n\":\"\",\"d\":\"\",\"food\":false,\"lat\":0.0,\"lng\":0.0,\"t\":[],\"k\":0,\"s\":\"any\",\"dur\":\"\",\"ticket\":\"\",\"meal\":\"both\",\"cuisine\":\"\",\"price\":\"\"}]}",
      "quick", function (r) {
        var list = (r && r.places || []).map(function (x) {
          if (!x || typeof x !== "object") return null;
          var food = x.food === true, it = food ? V.food(x, c) : V.spot(x, c); if (!it) return null;
          return { id: rid("ai", it.n), src: "ai", n: it.n, d: it.d, lat: it.lat, lng: it.lng, food: food, it: it };
        }).filter(Boolean);
        aiRes[key] = list.slice(0, 6);
      });
  }

  /* run a search: the list at once, the map and Claude together */
  W.placeSearch = function (q, country, city) {
    q = String(q || "").trim(); st.q = q; st.ck = W.cityKey(country, city); st.seq++; st.pick = null; st.added = "";
    st.local = []; st.mb = []; st.msgMb = "";
    if (q.length < 2) return;
    st.local = local(q, country, city);
    mapbox(q, country, city, st.seq);
    claude(q, country, city);
  };

  /* every result once: the list first, then the map, then Claude; the same place from two sources shows once */
  function merged(country, city) {
    var key = "find|" + st.ck + "|" + W.norm(st.q), ai = aiRes[key] || [], seen = {}, out = [];
    function same(a, b) { var x = W.norm(a), y = W.norm(b); return x === y || (x.length > 5 && y.indexOf(x) > -1) || (y.length > 5 && x.indexOf(y) > -1); }
    st.local.concat(st.mb, ai).forEach(function (r) {
      if (out.some(function (o) { return same(o.n, r.n) && (o.lat == null || r.lat == null || W.km(o, r) < 1.5); })) {
        /* a Claude idea the map also knows: the map's pin and the "checked on the map" mark */
        var o = out.filter(function (o) { return same(o.n, r.n); })[0];
        if (o && o.src === "ai" && r.src === "map") { o.lat = r.lat; o.lng = r.lng; o.onMap = true; }
        if (o && o.src === "map" && r.src === "ai" && r.it) { o.it = r.it; o.d = o.d || r.d; }
        return;
      }
      if (seen[r.id]) return; seen[r.id] = 1; out.push(Object.assign({}, r));
    });
    return { list: out, aiBusy: W.status[key] === "loading", aiErr: W.status[key] && W.status[key] !== "loading" ? W.status[key] : "" };
  }

  /* where a result sits relative to today's plan */
  function nearLine(r, day, P) {
    if (r.lat == null) return "";
    var home = W.homebase(day.country, day.city), /** @type {{ d: number, a: any } | null} */ best = null;
    [home].concat((day.slots || []).map(function (x) { return x.item; })).forEach(function (a) {
      if (!a || a.lat == null) return; var d = W.km(a, r); if (d != null && (!best || d < best.d)) best = { d: d, a: a };
    });
    if (!best) return "";
    var lg = W.leg(best.a, r), from = best.a === home ? "where you're staying" : best.a.n;
    return lg ? W.fmtMin(lg.min) + " " + lg.label.toLowerCase() + " from " + from : W.fmtKm(best.d) + " from " + from;
  }

  /** the search box and its results, for one day @param {Day} day @param {Plan} P */
  W.searchBlock = function (day, P) {
    if (window.__WP_OFFLINE) return '<section class="psearch sk" aria-label="Search for a place"><p class="small muted ps-hint">Searching for a new place needs the live app. Every idea below is in this copy.</p></section>';
    var ck = W.cityKey(day.country, day.city);
    if (st.ck !== ck && st.q) { st.q = ""; st.local = []; st.mb = []; st.pick = null; st.added = ""; }
    var h = '<section class="psearch sk" aria-label="Search for a place"><div class="ps-row"><input class="field" id="placeQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search any place in ' + esc(day.city) + '…" aria-label="Search any place in ' + esc(day.city) + '" value="' + esc(st.q) + '">' +
      '<button type="button" class="btn" data-psearch="1">Search</button></div>';
    if (!st.q) return h + '<p class="small muted ps-hint">A restaurant you heard about, a beach, "gelato", "rainy day with toddlers"… then add it to Day ' + day.n + ".</p></section>";
    var M = merged(day.country, day.city), dayOf = {};
    P.days.forEach(function (d) { (d.slots || []).forEach(function (x) { if (x.item) dayOf[W.norm(x.item.n)] = d.n; }); });
    if (st.added) h += '<p class="ps-ok" role="status">' + esc(st.added) + "</p>";
    h += '<ul class="ps-list">' + M.list.map(function (r) {
      var tag = r.src === "list" ? '<span class="ps-src list">On your list' + (dayOf[W.norm(r.n)] ? " · Day " + dayOf[W.norm(r.n)] : "") + "</span>"
        : r.src === "map" || r.onMap ? '<span class="ps-src map">On the map</span>' : '<span class="ps-src ai" title="Suggested by Claude; not checked against the map yet">Suggested by Claude</span>';
      var near = nearLine(r, day, P), gm = W.gmapsPlace(r, day.city);
      var open = st.pick === r.id, slots = r.food ? SLOTS_EAT : SLOTS_DO;
      var picker = !open ? "" : '<div class="ps-slots" role="group" aria-label="Add ' + esc(r.n) + " to Day " + day.n + '">' + slots.map(function (s) {
        var x = (day.slots || []).filter(function (y) { return y.slot === s[0]; })[0], now = x && x.item ? "replaces " + x.item.n : x ? "free" : "";
        return '<button type="button" class="ps-slot" data-padd="' + esc(r.id) + '" data-pslot="' + s[0] + '"><b>' + s[1] + "</b>" + (now ? "<span>" + esc(now) + "</span>" : "") + "</button>";
      }).join("") + '<button type="button" class="linkish" data-ppick="">Cancel</button></div>';
      return '<li class="ps-it' + (open ? " open" : "") + '"><div class="ps-b"><b>' + esc(r.n) + "</b>" + tag + (r.d ? '<span class="ps-d">' + esc(r.d) + "</span>" : "") +
        (near ? '<span class="ps-near">' + esc(near) + "</span>" : "") + '<span class="ps-l">' + W.extLink(gm, "Google Maps ↗") + "</span></div>" +
        (W.readOnly ? "" : '<button type="button" class="btn sm' + (open ? " quiet" : "") + '" data-ppick="' + esc(open ? "" : r.id) + '" aria-expanded="' + open + '">+ Add</button>') + picker + "</li>";
    }).join("") + "</ul>";
    var busy = st.busyMb || M.aiBusy;
    if (busy) h += '<p class="loading ps-busy">' + (st.busyMb && M.aiBusy ? "Searching the map and asking Claude…" : st.busyMb ? "Searching the map…" : "Asking Claude…") + "</p>";
    if (!busy && !M.list.length) h += '<p class="small muted">Nothing found for "' + esc(st.q) + '". Try the place\'s own name, or a kind of place ("bakery", "playground").</p>';
    if (st.msgMb) h += '<p class="small muted">' + esc(st.msgMb) + "</p>";
    /* Google's own results for the same words, in Google Maps (they open there; add one here by searching its name) */
    h += '<p class="ps-google">' + W.extLink("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(st.q + " near " + day.city + ", " + day.country), "Search Google Maps for “" + esc(st.q) + "” near " + esc(day.city) + " ↗") + "</p>";
    if (M.aiErr) h += '<p class="small muted">' + esc(M.aiErr) + "</p>";
    if (W.standalone) return h + '<p class="small muted ps-src-note">This version searches the ideas it has. Searching the map and asking Claude come with the full Waypoint, in Claude.</p></section>';
    return h + '<p class="small muted ps-src-note">Map results © Mapbox · ideas marked "Suggested by Claude" are checked against the map overnight.</p></section>';
  };

  /* add a found place to the city's list (as your own) and put it in the day */
  function addFound(r, day, slot, P) {
    var ck = W.cityKey(day.country, day.city), pool = W.pool(day.country, day.city);
    var have = pool && (pool.spots || []).concat(/** @type {any[]} */ (pool.food || [])).some(function (x) { return W.norm(x.n) === W.norm(r.n); });
    if (!have) {
      var imp = W.S.imported || (W.S.imported = {}), L = imp[ck] || (imp[ck] = []), it = r.it || {};
      var food = W.isFood(slot);
      L.push({ n: r.n, d: r.d || it.d || "", lat: r.lat, lng: r.lng, food: food, slot: slot, src: r.src === "ai" && !r.onMap ? "claude" : "map",
        t: it.t || [], k: it.k || 0, s: it.s, dur: it.dur, ticket: it.ticket, meal: food ? (it.meal && it.meal !== "both" ? it.meal : "all") : undefined, cuisine: it.cuisine, price: it.price });
      if (pool) pool._imp = "";   /* lay it in on the next read */
    }
    W.useIdea(day, slot, r.n, P);
    st.pick = null;
    st.added = r.n + " is on Day " + day.n + ", " + W.SLOT_NAME[slot].toLowerCase() + ".";
  }

  /** clicks inside the search; true when handled @param {DOMStringMap} d @param {Day} day @param {Plan} P */
  W.searchClick = function (d, day, P) {
    if (d.psearch) { var q = /** @type {HTMLInputElement | null} */ (document.getElementById("placeQ")); W.placeSearch(q ? q.value : "", day.country, day.city); return true; }
    if (d.ppick !== undefined) { st.pick = d.ppick || null; st.added = ""; return true; }
    if (d.padd && d.pslot) {
      var M = merged(day.country, day.city), r = M.list.filter(function (x) { return x.id === d.padd; })[0];
      if (r) addFound(r, day, d.pslot, P);
      return true;
    }
    return false;
  };
  /* Enter in the box searches */
  document.addEventListener("keydown", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (e.key !== "Enter" || !t || t.id !== "placeQ") return;
    e.preventDefault();
    var b = document.querySelector('[data-psearch="1"]'); if (b) /** @type {HTMLElement} */ (b).click();
  });
  W.searchState = function () { return { q: st.q, n: st.local.length + st.mb.length, busy: st.busyMb }; };
})();
