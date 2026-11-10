/* Waypoint detailed map, part 1 (first script): which cities have a map pack, and the map's state. The first screen
   needs only this (whether to hold a place for the map); drawing it (lib/vtmap.js: packs, the MapLibre engine, the
   look, pins) comes with the second script, and the held place shows "Loading the street map…" until then.
   Map data © OpenMapTiles © OpenStreetMap contributors (ODbL), tiles via OpenFreeMap. */
(function () {
  "use strict";
  var W = window.W;
  var S = { idx: null, idxState: "idle", engine: "idle", packs: {}, glyphs: null, map: null, el: null, sig: "", slug: "", markers: [], pinMarkers: [], pinPts: null, groupSig: "", ready: false, pend: null };
  W.vt = S;

  /* ---------- which cities have a pack: the database list (asset packs) over the bundled list (file packs) ---------- */
  var FILES = null, DBMAPS = null, dbState = "idle";
  function merge() {
    if (FILES === null || (dbState !== "ready" && dbState !== "off")) return;
    var out = {}; Object.keys(FILES).forEach(function (k) { out[k] = FILES[k]; });
    Object.keys(DBMAPS || {}).forEach(function (k) { out[k] = DBMAPS[k]; });
    S.idx = out; S.idxState = "ready"; W.changed();
  }
  function loadIndex() {
    if (S.idxState !== "idle") return;
    S.idxState = "loading";
    fetch("vt/index.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { FILES = j || {}; merge(); }, function () { FILES = {}; merge(); });
    try {
      if (window.claude && window.claude.use) {
        dbState = "loading";
        var t = setTimeout(function () { if (dbState === "loading") { dbState = "off"; merge(); } }, 8000);
        window.claude.use("db").then(function (db) {
          if (!db) { clearTimeout(t); dbState = "off"; merge(); return; }
          db.collection("maps").onSnapshot(function (snap) {
            clearTimeout(t); DBMAPS = {};
            snap.docs.forEach(function (d) { var x = d.data() || {}; if (x.parts && x.parts.length && x.b) DBMAPS[d.id] = { b: x.b, places: x.places || x.b, city: x.city, country: x.country, parts: x.parts.slice(), size: x.size || 0 }; });
            /* a pack that moved to the asset store replaces the file one, so the file can go */
            dbState = "ready"; merge();
          }, function () { clearTimeout(t); dbState = "off"; merge(); });
        }, function () { clearTimeout(t); dbState = "off"; merge(); });
      } else dbState = "off";
    } catch (e) { dbState = "off"; }
    if (dbState === "off") merge();
  }
  /* a pack's size in bytes (0 when not known), for "about how much will this download" */
  W.vtSize = function (slug) { var e = S.idx && S.idx[slug]; return e && e.size || 0; };
  W.vtFor = function (country, city, lat, lng) {
    if (S.engine === "off") return null;
    loadIndex();
    if (S.idxState !== "ready") return null;
    var slug = W.slug(country + " " + city);
    if (S.idx[slug]) return slug;
    if (lat == null) return null;
    var hit = null;
    /* another city's pack serves this one only when it is framed on a town (older packs framed a whole region, with
       street detail only around their own town, until the nightly helper rebuilds them) */
    Object.keys(S.idx).forEach(function (k) { var b = S.idx[k].places; if (!hit && b && b[2] - b[0] <= 0.3 && b[3] - b[1] <= 0.25 && lat >= b[1] && lat <= b[3] && lng >= b[0] && lng <= b[2]) hit = k; });
    return hit;
  };

  W.vtState = function () { return S.engine; };
  W.vtActive = function () { return !!(S.map && S.ready && S.el && document.body.contains(S.el)); };
  /* still finding out whether this city has a detailed map (the list of map packs is on its way) */
  W.vtPending = function () { return S.engine !== "off" && S.idxState !== "ready"; };
  loadIndex();   /* ask for the list straight away, so the first screen already knows */
})();
