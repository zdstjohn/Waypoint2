/* Waypoint detailed map, part 2 (second script): the MapLibre engine drawing real vector map data (streets and their
   names, buildings, landmarks, stations, parks, water) from map packs for the trip's cities. Packs live in the app's
   asset store (built nightly, listed in the database under maps/<city>, in parts the store accepts); a few older ones
   ship as files. Which city has one is lib/vtindex.js (first script); the state they share is W.vt.
   If anything is missing or blocked on this device, the app keeps its simpler built-in map.
   Map data © OpenMapTiles © OpenStreetMap contributors (ODbL), tiles via OpenFreeMap. */
(function () {
  "use strict";
  var W = window.W, ML = null;
  var S = W.vt;
  /* ---------- packs: one file per city with all its tiles (gzipped), read once ---------- */
  function gunzip(u8) {
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  /* an asset pack: JSON parts holding the pack's bytes in base64, joined in order (the main-thread way, used when the
     page may not start its own worker) */
  function readParts(urls) {
    return Promise.all(urls.map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing part " + u); return r.json(); }); })).then(function (parts) {
      var bufs = parts.map(function (p) { var bin = atob(p.b64 || ""), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; });
      var n = bufs.reduce(function (a, b) { return a + b.length; }, 0), all = new Uint8Array(n), o = 0;
      bufs.forEach(function (b) { all.set(b, o); o += b.length; });
      return parsePack(all);
    });
  }
  W.vtReadParts = readParts;   /* (for the tests) */
  W.vtLoadTest = function (k, v, src) { return load(k, v, src); }; W.vtWorkerUsed = function () { return !!pw; };
  function parsePack(u8) {
      /* packs travel inside a WebAssembly file's custom section (a file type the app host serves untouched): unwrap it */
      if (u8[0] === 0 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d) {
        var i = 9, leb = function () { var v = 0, sh = 0, c; do { c = u8[i++]; v += (c & 0x7f) * Math.pow(2, sh); sh += 7; } while (c & 0x80); return v; };
        leb(); var nl = leb(); i += nl; u8 = u8.subarray(i);
      }
      var magic = new TextDecoder().decode(u8.subarray(0, 6));
      if (magic !== "WPVT1\n") throw new Error("bad pack");
      var n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(6), hdr = JSON.parse(new TextDecoder().decode(u8.subarray(10, 10 + n)));
      return { hdr: hdr, body: u8.subarray(10 + n) };
  }
  function readPack(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("missing " + url); return r.arrayBuffer(); }).then(function (buf) {
      return parsePack(new Uint8Array(buf));
    });
  }

  /* The pack worker (vt/packworker.js) downloads and decodes packs off the main thread and keeps them in IndexedDB, so a
     city's map costs one download ever and never freezes the screen. If the page may not start it, packs are read here. */
  var pw = null, pwP = null, pwJobs = {}, pwId = 0;
  function packWorker() {
    if (pwP) return pwP;
    var abs = function (u) { return new URL(u, location.href).href; };
    function start(url) {
      return new Promise(function (ok) {
        var w, t = setTimeout(function () { fail(); }, 3000);
        function fail() { clearTimeout(t); try { w && w.terminate(); } catch (e) {} ok(null); }
        try { w = new Worker(url); } catch (e) { return fail(); }
        w.onerror = fail;
        w.onmessage = function (ev) { if (ev.data && ev.data.pong) { clearTimeout(t); w.onmessage = onMsg; w.onerror = function () {}; ok(w); } };
        w.postMessage({ ping: 1 });
      });
    }
    pwP = (window.Worker && window.indexedDB ? start(abs("vt/packworker.js")) : Promise.resolve(null)).then(function (w) {
      if (w) return w;
      return fetch("vt/packworker.js").then(function (r) { return r.text(); }).then(function (code) { return start(URL.createObjectURL(new Blob([code], { type: "text/javascript" }))); }, function () { return null; });
    }).then(function (w) { pw = w; return w; });
    return pwP;
  }
  function onMsg(ev) {
    var m = ev.data || {}, job = pwJobs[m.id]; if (!job) return;
    delete pwJobs[m.id];
    if (m.error) job.no(new Error(m.error)); else job.ok({ hdr: m.hdr, body: new Uint8Array(m.body), cached: !!m.cached });
  }
  /* a pack by key: {urls} for asset parts or {url} for one file; `ver` says when a cached copy is stale */
  function load(key, ver, src) {
    return packWorker().then(function (w) {
      if (!w) return src.urls ? readParts(src.urls) : readPack(src.url);
      return new Promise(function (ok, no) {
        var id = ++pwId; pwJobs[id] = { ok: ok, no: no };
        var abs = function (u) { return new URL(u, location.href).href; };   /* the worker resolves paths against its own file */
        w.postMessage({ id: id, key: key, ver: ver, urls: src.urls && src.urls.map(abs), url: src.url && abs(src.url) });
      });
    });
  }
  function pack(slug) {
    if (S.packs[slug]) return S.packs[slug];
    var e = S.idx && S.idx[slug];
    var p = e && e.parts ? load("pack|" + slug, e.parts.join(","), { urls: e.parts }) : load("pack|" + slug, "file", { url: "vt/" + slug + ".wasm" });
    return (S.packs[slug] = p.then(null, function (err) { delete S.packs[slug]; throw err; }));
  }
  /* glyphs: the letters nearly every map needs come in one small file; extended Latin, Greek and Cyrillic in another,
     fetched only when a label needs them */
  var GLYPH_V = "2";
  function glyphs(rangeStart) {
    var ext = rangeStart >= 256 && rangeStart < 8192, k = ext ? "glyphsExt" : "glyphs";
    return S[k] || (S[k] = load("glyphs|" + (ext ? "ext" : "core"), GLYPH_V, { url: ext ? "vt/glyphs-ext.wasm" : "vt/glyphs.wasm" }).then(null, function (err) { delete S[k]; throw err; }));
  }
  /* for offline saving: fetch a city's pack and the everyday glyphs now, so the worker's cache has them */
  W.vtWarm = function (slug) { return Promise.all([pack(slug), glyphs(0)]).then(function () { return true; }); };
  /* "nothing here" (a tile or a letter range the pack doesn't hold) is a NEW empty buffer every time: the engine hands
     each answer over to its worker, which empties the buffer on this side, so one shared buffer worked once and then made
     every later "nothing here" fail ("ArrayBuffer is already detached"), and a tile whose names needed such a letter
     range failed with it: the blank boxes on the map. */
  function none() { return new ArrayBuffer(0); }
  function piece(p, key) {
    var e = p.hdr.t[key];
    return e ? gunzip(p.body.subarray(e[0], e[0] + e[1])) : Promise.resolve(none());
  }

  /* ---------- the engine: loaded on first use, with a worker this page is allowed to start ---------- */
  function canWebGL() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }
  function tryWorker(url) {
    return new Promise(function (ok) {
      var w, t = setTimeout(function () { done(false); }, 2500);
      function done(v) { clearTimeout(t); try { w && w.terminate(); } catch (e) {} ok(v); }
      try { w = new Worker(url); } catch (e) { return done(false); }
      w.onmessage = function () { done(true); }; w.onerror = function () { done(false); };
    });
  }
  function engine() {
    if (S.engineP) return S.engineP;
    S.engine = "loading";
    S.engineP = (function () {
      if (!canWebGL() || !window.DecompressionStream || !window.Worker) return Promise.reject(new Error("no webgl"));
      var abs = function (u) { return new URL(u, location.href).href; };
      /* the worker: the app's own file if allowed, else the same code started from memory */
      return tryWorker(abs("vt/ping.js")).then(function (own) {
        if (own) return abs("vt/maplibre-gl-csp-worker.js");
        return tryWorker(URL.createObjectURL(new Blob(['postMessage("ok")'], { type: "text/javascript" }))).then(function (blobOk) {
          if (!blobOk) throw new Error("workers blocked");
          return fetch("vt/maplibre-gl-csp-worker.js").then(function (r) { return r.text(); })
            .then(function (code) { return URL.createObjectURL(new Blob([code], { type: "text/javascript" })); });
        });
      }).then(function (workerUrl) {
        return W.loadScript("vt/maplibre-gl-csp.js").then(function () {
          ML = window.maplibregl; if (!ML) throw new Error("engine missing");
          ML.setWorkerUrl(workerUrl);
          ML.addProtocol("wpvt", function (params) {
            var m = /^wpvt:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
            if (!m) return Promise.resolve({ data: none() });
            var key = m[2] + "/" + m[3] + "/" + m[4];
            /* a tile that fails to come out of its pack is tried twice more before the map is told */
            function once() { return pack(m[1]).then(function (p) { return piece(p, key); }); }
            function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
            return once().then(null, function () { return wait(150).then(once); }).then(null, function () { return wait(600).then(once); })
              .then(function (d) { return { data: d }; }, function (e) { mapErr("tile " + key + ": " + (e && e.message || e)); throw e; });
          });
          ML.addProtocol("wpgl", function (params) {
            var m = /^wpgl:\/\/([^/]+)\/([0-9]+-[0-9]+)/.exec(params.url), stack = m ? decodeURIComponent(m[1]).split(",")[0] : "";
            if (!m) return Promise.resolve({ data: none() });
            return glyphs(parseInt(m[2], 10)).then(function (g) { return piece(g, stack + "/" + m[2]).then(function (d) { return d.byteLength ? d : piece(g, "Noto Sans Regular/" + m[2]); }); }).then(function (d) { return { data: d }; });
          });
        });
      });
    })().then(function () { S.engine = "ready"; W.changed(); }, function (e) { S.engine = "off"; S.why = String(e && e.message || e); W.changed(); });
    return S.engineP;
  }

  /* ---------- the look: warm paper land, clear white streets, readable names (and a dark version) ---------- */
  function palette() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (document.documentElement.getAttribute("data-theme") !== "light" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    return dark ? {
      dark: true, land: "#23242B", water: "#2E4A63", waterLine: "#33536E", park: "#2C3D2E", wood: "#2A3A2B", grass: "#2E3D2F", sand: "#3A3629",
      residential: "#282930", commercial: "#2D2A2E", industrial: "#2A2A2E", cemetery: "#2A352C", hospital: "#3A2C2F", school: "#332F29",
      building: "#33343C", buildingLine: "#3E3F48", roadCase: "#1B1C21", road: "#4A4B55", major: "#6B5F45", majorCase: "#22232A",
      motorway: "#8A6B3A", motorwayCase: "#22232A", rail: "#5C5A60", path: "#5A5A62", ferry: "#4B7CA3", boundary: "#6B6470",
      label: "#E9E4DC", halo: "#1D1E24", place: "#C7BFB3", waterLabel: "#9FC7E6", parkLabel: "#A9CF95", poi: "#E2A27A", poiDot: "#C77D55", station: "#8EA2E8"
    } : {
      dark: false, land: "#F4EFE5", water: "#A3CDE7", waterLine: "#93C2E0", park: "#CFE6BA", wood: "#C3DEAC", grass: "#D8EBC5", sand: "#F2E4BF",
      residential: "#EFE8DC", commercial: "#F3E6D9", industrial: "#EAE5E2", cemetery: "#D8E6D0", hospital: "#F7E0DE", school: "#F2E8D4",
      building: "#E4DBCD", buildingLine: "#D3C7B5", roadCase: "#DCCFBA", road: "#FFFFFF", major: "#FFF0C4", majorCase: "#E4C788",
      motorway: "#F7CF85", motorwayCase: "#D6A54F", rail: "#B3A796", path: "#C8B89E", ferry: "#6FA7CF", boundary: "#A898B0",
      label: "#3F3934", halo: "#FFFFFF", place: "#665A4D", waterLabel: "#3C6E96", parkLabel: "#4B7A3A", poi: "#8C4F2E", poiDot: "#C9683F", station: "#3F4682"
    };
  }
  var F_REG = ["Noto Sans Regular"], F_BOLD = ["Noto Sans Bold"], F_IT = ["Noto Sans Italic"];
  function z(stops) { var e = ["interpolate", ["exponential", 1.45], ["zoom"]]; stops.forEach(function (s) { e.push(s[0], s[1]); }); return e; }
  function cls(list) { return ["match", ["get", "class"], list, true, false]; }

  function layersFor(src, C, lo) {
    var L = [], mz = lo ? {} : { minzoom: 13 };
    function add(o) { o.source = src; if (lo && o.labels) o.maxzoom = 13; if (!lo && (o.minzoom || 0) < 13) o.minzoom = 13; delete o.labels; L.push(o); }
    var p = src + "-";
    add({ id: p + "landcover", type: "fill", "source-layer": "landcover", paint: { "fill-color": ["match", ["get", "class"], "wood", C.wood, "forest", C.wood, "grass", C.grass, "sand", C.sand, "wetland", C.grass, "farmland", C.land, C.grass], "fill-opacity": ["match", ["get", "class"], "farmland", 0, "ice", 0.6, 0.85] } });
    add({ id: p + "landuse", type: "fill", "source-layer": "landuse", minzoom: 10, paint: { "fill-color": ["match", ["get", "class"], "residential", C.residential, "suburb", C.residential, "neighbourhood", C.residential, "commercial", C.commercial, "retail", C.commercial, "industrial", C.industrial, "cemetery", C.cemetery, "hospital", C.hospital, "school", C.school, "university", C.school, "college", C.school, "stadium", C.park, "pitch", C.park, "playground", C.park, C.residential], "fill-opacity": 0.9 } });
    add({ id: p + "park", type: "fill", "source-layer": "park", paint: { "fill-color": C.park, "fill-outline-color": C.dark ? "#3B5340" : "#B5D59C" } });
    add({ id: p + "water", type: "fill", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "fill-color": C.water } });
    add({ id: p + "waterway", type: "line", "source-layer": "waterway", paint: { "line-color": C.waterLine, "line-width": z([[10, 0.6], [14, 1.6], [18, 6]]) } });
    if (!lo) add({ id: p + "building", type: "fill", "source-layer": "building", minzoom: 14, paint: { "fill-color": C.building, "fill-outline-color": C.buildingLine, "fill-opacity": z([[14, 0.55], [16, 1]]) } });
    /* streets: soft casing under a clean fill, sized by importance */
    var MOTOR = ["motorway", "trunk"], MAJOR = ["primary"], MID = ["secondary", "tertiary"], MINOR = ["minor", "service", "track", "raceway"];
    var notTunnel = ["!=", ["get", "brunnel"], "tunnel"];
    function road(id, list, color, casing, w, extra) {
      var f = ["all", ["==", ["geometry-type"], "LineString"], cls(list)].concat(extra || []);
      add({ id: p + id + "-case", type: "line", "source-layer": "transportation", filter: f, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": casing, "line-width": z(w.map(function (s) { return [s[0], s[1] * 1.0 + 1.6]; })) } });
      add({ id: p + id, type: "line", "source-layer": "transportation", filter: f, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": z(w) } });
    }
    add({ id: p + "path", type: "line", "source-layer": "transportation", minzoom: 14, filter: ["all", cls(["path"]), notTunnel], paint: { "line-color": C.path, "line-width": z([[14, 0.8], [17, 1.8], [19, 3.5]]), "line-dasharray": [2, 1.4] } });
    add({ id: p + "pedestrian", type: "line", "source-layer": "transportation", minzoom: 14, filter: ["all", cls(["pedestrian"]), notTunnel], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.road, "line-width": z([[14, 1.4], [17, 5], [19, 12]]) } });
    road("minor", MINOR, C.road, C.roadCase, [[12, 0.4], [14, 2.2], [16, 6], [18, 18]], [notTunnel]);
    road("mid", MID, C.road, C.roadCase, [[9, 0.5], [12, 1.4], [14, 3.6], [16, 8], [18, 22]], [notTunnel]);
    road("major", MAJOR, C.major, C.majorCase, [[7, 0.6], [10, 1.4], [13, 3.4], [15, 7], [18, 24]], [notTunnel]);
    road("motor", MOTOR, C.motorway, C.motorwayCase, [[5, 0.6], [9, 1.6], [13, 4], [15, 8], [18, 26]], [notTunnel]);
    add({ id: p + "rail", type: "line", "source-layer": "transportation", filter: ["all", cls(["rail", "transit"]), notTunnel], paint: { "line-color": C.rail, "line-width": z([[10, 0.6], [14, 1.4], [18, 3]]), "line-dasharray": [3, 2] } });
    add({ id: p + "ferry", type: "line", "source-layer": "transportation", filter: cls(["ferry"]), paint: { "line-color": C.ferry, "line-width": 1.2, "line-dasharray": [3, 3] } });
    if (lo) add({ id: p + "boundary", type: "line", "source-layer": "boundary", filter: ["==", ["get", "admin_level"], 2], paint: { "line-color": C.boundary, "line-width": 1.2, "line-dasharray": [3, 2] } });
    /* names */
    var name = ["coalesce", ["get", "name"], ""];
    var halo = { "text-halo-color": C.halo, "text-halo-width": 1.6, "text-halo-blur": 0.4 };
    ["Point", "LineString"].forEach(function (g) {
      add({ labels: 1, id: p + "water-name-" + g, type: "symbol", "source-layer": "water_name", filter: ["==", ["geometry-type"], g], layout: { "text-field": name, "text-font": F_IT, "text-size": z([[10, 11], [16, 14]]), "symbol-placement": g === "Point" ? "point" : "line", "text-letter-spacing": 0.08, "text-max-width": 8 }, paint: Object.assign({ "text-color": C.waterLabel }, halo) });
    });
    add({ labels: 1, id: p + "waterway-name", type: "symbol", "source-layer": "waterway", minzoom: 12, filter: ["all", ["==", ["geometry-type"], "LineString"], ["has", "name"]], layout: { "text-field": name, "text-font": F_IT, "text-size": 11.5, "symbol-placement": "line", "text-letter-spacing": 0.06 }, paint: Object.assign({ "text-color": C.waterLabel }, halo) });
    add({ labels: 1, id: p + "road-name", type: "symbol", "source-layer": "transportation_name", minzoom: lo ? 11 : 13,
      filter: lo ? cls(["motorway", "trunk", "primary", "secondary"]) : ["all"],
      layout: { "text-field": name, "text-font": F_REG, "text-size": z([[13, 10.5], [16, 12.5], [18, 14]]), "symbol-placement": "line", "symbol-spacing": 260, "text-rotation-alignment": "map", "text-pitch-alignment": "viewport", "text-letter-spacing": 0.02, "text-max-angle": 35 },
      paint: Object.assign({ "text-color": C.label }, halo) });
    add({ labels: 1, id: p + "park-name", type: "symbol", "source-layer": "park", minzoom: lo ? 12 : 14, layout: { "text-field": name, "text-font": F_IT, "text-size": 11.5, "text-max-width": 7 }, paint: Object.assign({ "text-color": C.parkLabel }, halo) });
    if (!lo) {
      var station = cls(["railway", "bus", "ferry_terminal", "aerialway"]);
      /* notable landmarks only, with names short enough to read at a glance */
      var notable = ["all", ["<=", ["coalesce", ["get", "rank"], 99], 22], ["!", cls(["library", "information", "town_hall"])], ["<=", ["length", ["coalesce", ["get", "name"], ""]], 32]];
      add({ id: p + "poi-dot", type: "circle", "source-layer": "poi", minzoom: 14, filter: ["any", station, notable],
        paint: { "circle-radius": ["case", station, 4.2, 3.2], "circle-color": ["case", station, C.station, C.poiDot], "circle-stroke-color": C.halo, "circle-stroke-width": 1.4 } });
      add({ id: p + "poi-name", type: "symbol", "source-layer": "poi", minzoom: 14, filter: ["any", station, notable],
        layout: { "text-field": name, "text-font": F_REG, "text-size": z([[14, 10.5], [17, 12.5]]), "text-anchor": "left", "text-offset": [0.7, 0], "text-max-width": 9, "text-optional": true, "symbol-sort-key": ["coalesce", ["get", "rank"], 99] },
        paint: Object.assign({ "text-color": ["case", station, C.station, C.poi] }, halo) });
    }
    add({ labels: 1, id: p + "place-small", type: "symbol", "source-layer": "place", filter: cls(["suburb", "quarter", "neighbourhood", "hamlet"]), minzoom: lo ? 11 : 13,
      layout: { "text-field": ["upcase", name], "text-font": F_BOLD, "text-size": z([[11, 9.5], [15, 11.5]]), "text-letter-spacing": 0.12, "text-max-width": 8 }, paint: Object.assign({ "text-color": C.place, "text-opacity": 0.8 }, halo) });
    add({ labels: 1, id: p + "place-town", type: "symbol", "source-layer": "place", filter: cls(["city", "town", "village"]),
      layout: { "text-field": name, "text-font": F_BOLD, "text-size": ["interpolate", ["linear"], ["zoom"], 8, ["match", ["get", "class"], "city", 13, "town", 11, 10], 13, ["match", ["get", "class"], "city", 17, "town", 15, 13]], "text-max-width": 8 },
      paint: Object.assign({ "text-color": C.label }, halo) });
    return L;
  }

  function tileBox(z, x, y) {
    var n = Math.pow(2, z), lng0 = x / n * 360 - 180, lng1 = (x + 1) / n * 360 - 180;
    function lat(t) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) * 180 / Math.PI; }
    return [[lng0, lat(y)], [lng1, lat(y)], [lng1, lat(y + 1)], [lng0, lat(y + 1)], [lng0, lat(y)]];
  }
  /* The cover (land colour, under the detailed map) hides the coarse map where a detailed tile is on screen, so streets
     never double up. It covers only the detailed tiles that have actually loaded: one that failed (or hasn't come yet)
     leaves the coarse map showing there, never an empty box. (It used to cover every tile the pack lists, so a single
     detailed tile that failed on a phone left a blank square until a zoom loaded others.) */
  var NONE = { type: "FeatureCollection", features: [] };
  function mask(keys, zl) {
    return { type: "FeatureCollection", features: keys.filter(function (k) { return +k.split("/")[0] === zl; }).map(function (k) {
      var q = k.split("/").map(Number); return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [tileBox(q[0], q[1], q[2])] } };
    }) };
  }
  W.vtMask = mask;   /* (for the tests) */
  function coverSoon() {
    if (S.coverT) return;
    S.coverT = requestAnimationFrame(function () {
      S.coverT = 0; if (!S.map) return;
      var keys = Object.keys(S.got || {});
      [13, 14].forEach(function (zl) { var src = S.map.getSource("mask" + zl); if (src && src.setData) src.setData(mask(keys, zl)); });
    });
  }
  /* map trouble goes to the app's error log (once per kind of message), so the evening error report says what failed */
  var mapSeen = {};
  function mapErr(msg) {
    var kind = String(msg).replace(/\d+\/\d+\/\d+/g, "z/x/y").slice(0, 160);
    if (mapSeen[kind]) return; mapSeen[kind] = 1;
    if (window.console) console.warn("[waypoint map]", msg);
    if (W.logError) W.logError("map: " + String(msg).slice(0, 200), "vtmap");
  }
  function style(slug, hdr) {
    var C = palette(), url = "wpvt://" + slug + "/{z}/{x}/{y}";
    var lo = layersFor("lo", C, true), hi = layersFor("hi", C, false);
    function shapes(L) { return L.filter(function (l) { return l.type !== "symbol"; }); }
    function names(L) { return L.filter(function (l) { return l.type === "symbol"; }); }
    /* order: coarse map, a cover where detailed tiles exist (so streets never double up), detailed map, the day's route, then all names on top */
    /** @type {any[]} */ var layers = /** @type {any[]} */ ([{ id: "bg", type: "background", paint: { "background-color": C.land } }])
      .concat(shapes(lo))
      .concat([{ id: "mask13", type: "fill", source: "mask13", minzoom: 13, maxzoom: 14, paint: { "fill-color": C.land, "fill-antialias": false } },
               { id: "mask14", type: "fill", source: "mask14", minzoom: 14, paint: { "fill-color": C.land, "fill-antialias": false } }])
      .concat(shapes(hi))
      .concat([{ id: "route-case", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.halo, "line-width": 6, "line-opacity": 0.85 } },
               { id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.dark ? "#AEB6FF" : "#3F4682", "line-width": 3, "line-dasharray": [1.2, 1.6] } }])
      .concat(names(lo)).concat(names(hi));
    var b = hdr.b;
    return {
      version: 8, glyphs: "wpgl://{fontstack}/{range}",
      sources: {
        lo: { type: "vector", tiles: [url], minzoom: hdr.zmin || 8, maxzoom: 12, bounds: b },
        hi: { type: "vector", tiles: [url], minzoom: 13, maxzoom: 14, bounds: b },
        mask13: { type: "geojson", data: NONE }, mask14: { type: "geojson", data: NONE },
        route: { type: "geojson", data: { type: "FeatureCollection", features: [] } }
      },
      layers: layers
    };
  }

  /* ---------- pins ---------- */
  /** one marker: the lodging, or one or more stops that sit on the same spot at this zoom ("1·2·4") @param {any} g */
  function pinEl(g) {
    /** @type {HTMLElement} */ var el = document.createElement("div");
    if (g.home) {
      el.className = "vt-pin home";
      el.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5V13h-3.5V9.5h-4V13H2.5z" fill="currentColor"/></svg><i>A</i>';
      el.setAttribute("aria-label", "A. Where you're staying");
      return el;
    }
    /* lettered as Google Maps letters the day's route: A is where you're staying, B the first stop (W.stopTag) */
    var ps = g.items, many = ps.length > 1, nums = ps.map(function (p) { return W.stopTag(p.num); }).join("·");
    /* one stop: the pin opens it in Google Maps (reviews, photos, hours, directions) */
    if (!many && S.city) { var a = document.createElement("a"); a.href = W.gmapsPlace(ps[0], S.city); a.target = "_blank"; a.rel = "noopener"; el = a; }
    el.className = "vt-pin" + (many ? " many" : ps[0].food ? " food" : "");
    el.innerHTML = "<b>" + nums + "</b><span>" + W.esc(ps[0].n) + (many ? " +" + (ps.length - 1) : "") + "</span>";
    el.setAttribute("aria-label", ps.map(function (p) { return W.stopTag(p.num) + ". " + p.n; }).join(", "));
    el.title = ps.map(function (p) { return W.stopTag(p.num) + ". " + p.n; }).join("\n");
    return el;
  }
  /* Stops closer together on screen than a pin is wide share one marker at their common spot, numbers in a row, so
     none hides another (a café inside the market, dinner at the sunset spot). Regrouped whenever the zoom changes. */
  /** stops grouped by where they fall on screen: any two closer than minPx share a group, placed at their average
      @param {any[]} pts @param {(p: any) => {x: number, y: number}} project @param {number} [minPx] */
  W.pinGroups = function (pts, project, minPx) {
    var groups = [], m = minPx || 24;
    pts.forEach(function (p) {
      var at = project(p);
      var g = groups.filter(function (g) { return Math.hypot(g.x - at.x, g.y - at.y) < m; })[0];
      if (g) { g.items.push(p); g.x = (g.x * (g.items.length - 1) + at.x) / g.items.length; g.y = (g.y * (g.items.length - 1) + at.y) / g.items.length; }
      else groups.push({ x: at.x, y: at.y, items: [p] });
    });
    return groups;
  };
  function groupPins() {
    if (!S.map || !S.pinPts) return;
    var groups = W.pinGroups(S.pinPts, function (p) { return S.map.project([p.lng, p.lat]); });
    var sig = groups.map(function (g) { return g.items.map(function (p) { return p.num; }).join("."); }).join("|");
    if (sig === S.groupSig) return;
    S.groupSig = sig;
    S.pinMarkers.forEach(function (m) { m.remove(); }); S.pinMarkers = [];
    groups.forEach(function (g) {
      var ll = S.map.unproject([g.x, g.y]);
      S.pinMarkers.push(new ML.Marker({ element: pinEl(g), anchor: "left", offset: [-13, 0] }).setLngLat(ll).addTo(S.map));
    });
  }
  function setPins(pts, home) {
    S.markers.forEach(function (m) { m.remove(); }); S.markers = [];
    (S.pinMarkers || []).forEach(function (m) { m.remove(); }); S.pinMarkers = []; S.groupSig = "";
    var all = pts.filter(function (p) { return p.lat != null && !p.gpin; });     /* Google's pins stay on Google's maps */
    if (home && home.lat != null) S.markers.push(new ML.Marker({ element: pinEl({ home: 1 }) }).setLngLat([home.lng, home.lat]).addTo(S.map));
    S.pinPts = all; groupPins();
    var line = (home && home.lat != null ? [[home.lng, home.lat]] : []).concat(all.map(function (p) { return [p.lng, p.lat]; }));
    if (home && home.lat != null && all.length) line.push([home.lng, home.lat]);
    var src = S.map.getSource("route");
    if (src) src.setData({ type: "FeatureCollection", features: line.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } }] : [] });
  }
  /* how far out the map goes: the town the pack is made for (its "places" frame) with a margin, stretched to take in
     the day's own stops, and no further. Zooming out stops there (MapLibre keeps the view inside these bounds), so the
     map never shows the sea and the next island where it has nothing to draw. */
  function area(places, c) {
    var w = places[0], s = places[1], e = places[2], n = places[3];
    c.forEach(function (q) { w = Math.min(w, q[0]); e = Math.max(e, q[0]); s = Math.min(s, q[1]); n = Math.max(n, q[1]); });
    var mx = Math.max((e - w) * 0.3, 0.035), my = Math.max((n - s) * 0.3, 0.025);
    return [[w - mx, s - my], [e + mx, n + my]];
  }
  W.vtArea = area;   /* (for the tests) */
  function fit(pts, home, animate) {
    var c = pts.filter(function (p) { return p.lat != null && !p.gpin; }).map(function (p) { return [p.lng, p.lat]; });
    if (home && home.lat != null) c.push([home.lng, home.lat]);
    if (!c.length) return;
    if (S.places) { try { S.map.setMaxBounds(area(S.places, c)); } catch (e) {} }
    var b = new ML.LngLatBounds(c[0], c[0]); c.forEach(function (q) { b.extend(q); });
    var w = S.el.clientWidth || 340;
    S.map.fitBounds(b, { padding: { top: 36, bottom: 30, left: 26, right: Math.min(110, w * 0.3) }, maxZoom: 16.2, duration: animate ? 600 : 0 });
    if (!animate) groupPins();
  }

  /* ---------- show the map in a slot; returns true once the detailed map is on screen ---------- */
  W.vtMount = function (slot, o) {
    if (!slot || S.engine === "off") return false;
    if (S.engine !== "ready") { engine(); return false; }
    if (!S.el) {
      S.el = document.createElement("div"); S.el.className = "vt-map";
      /* the map's place can change size after it is drawn (fonts, photos, the side panel): fit the map to it */
      if (window.ResizeObserver) new ResizeObserver(function () { if (S.map && S.ready) { S.map.resize(); S.map.triggerRepaint(); } }).observe(S.el);
    }
    /* every redraw of the screen moves the one map into the new screen; a WebGL picture that moves is blank (black) until
       it draws again, and the map only draws when something changes, so ask it to */
    var movedIn = S.el.parentNode !== slot;
    if (movedIn) slot.appendChild(S.el);
    var themeKey = palette().dark ? "d" : "l";
    var make = (!S.map && !S.creating) || S.slug !== o.slug || S.theme !== themeKey;
    if (make) {
      S.creating = true;
      if (S.map) { try { S.map.remove(); } catch (e) {} S.map = null; }
      S.ready = false; S.slug = o.slug; S.theme = themeKey; S.sig = "";
      /* only the latest request makes a map: switching city (or theme) twice while a pack is on its way used to let two
         answers each make one in the same place, the first never removed */
      var turn = S.turn = (S.turn || 0) + 1;
      pack(o.slug).then(function (p) {
        if (turn !== S.turn) return;
        S.creating = false;
        if (S.slug !== o.slug) return;
        if (S.map) { try { S.map.remove(); } catch (e) {} S.map = null; }
        try {
          S.places = p.hdr.places;
          S.map = new ML.Map({ container: S.el, style: style(o.slug, p.hdr), bounds: [[p.hdr.places[0], p.hdr.places[1]], [p.hdr.places[2], p.hdr.places[3]]], maxBounds: area(p.hdr.places, []),
            attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, cooperativeGestures: touchFirst(),
            maxZoom: 18, minZoom: 8, fadeDuration: 180, localIdeographFontFamily: "sans-serif" });
          S.map.touchZoomRotate.disableRotation();
          /* once you move the map yourself, it stops re-fitting to the day's stops until the day changes */
          ["dragstart", "zoomstart"].forEach(function (ev) { S.map.on(ev, function (e) { if (e && e.originalEvent) S.moved = true; }); });
          S.map.on("zoomend", groupPins);
          S.map.on("load", function () { S.ready = true; S.sig = ""; if (S.pend) W.vtMount(S.pend.slot, S.pend.o); W.changed(); });
          S.got = {}; S.retries = 0; var hdrT = p.hdr.t;
          var tkey = function (t) { var c = t && t.tileID && t.tileID.canonical; return c ? c.z + "/" + c.x + "/" + c.y : ""; };
          S.map.on("sourcedata", function (e) {
            if (!e || e.sourceId !== "hi" || !e.tile) return;
            var k = tkey(e.tile); if (!k || !hdrT[k]) return;
            if (e.tile.state === "loaded" || e.tile.state === "reloading") { if (!S.got[k]) { S.got[k] = 1; coverSoon(); } }
          });
          S.map.on("error", function (e) {
            var msg = String(e && e.error && e.error.message || e);
            if (e && e.sourceId === "hi" && e.tile) {
              var k = tkey(e.tile); if (k && S.got[k]) { delete S.got[k]; coverSoon(); }
              /* ask for the detailed tiles again a moment later (a few times at most) */
              if (S.retries < 3 && !S.retryT) S.retryT = setTimeout(function () {
                S.retryT = 0; S.retries++;
                try { var sc = S.map && S.map.style && S.map.style.sourceCaches && S.map.style.sourceCaches.hi; if (sc && sc.reload) sc.reload(); } catch (x) {}
              }, 1500);
            }
            mapErr(msg);
            if (!S.ready && /webgl|context/i.test(msg)) { S.engine = "off"; W.changed(); }
          });
        } catch (e) { S.engine = "off"; S.why = String(e && e.message || e); W.changed(); }
      }, function () { if (turn !== S.turn) return; S.creating = false; S.engine = "off"; W.changed(); });
    }
    S.pend = { slot: slot, o: o }; S.city = o.city || "";
    if (!S.map || !S.ready) return false;
    var size = S.el.clientWidth + "x" + S.el.clientHeight, resized = size !== S.size; S.size = size;
    if (resized) S.map.resize();
    if (resized || movedIn) S.map.triggerRepaint();
    var sig = o.key + "|" + o.pts.map(function (p) { return p.n + p.lat + "," + p.lng; }).join(";") + "|" + (o.home && o.home.lat) + "," + (o.home && o.home.lng);
    if (sig !== S.sig) { var first = !S.sig; S.sig = sig; S.moved = false; setPins(o.pts, o.home); fit(o.pts, o.home, !first && o.animate); }
    else if (resized && !S.moved && S.el.clientHeight) fit(o.pts, o.home, false);   /* the map changed size (list/map switch): frame the stops again */
    return true;
  };
  /* on a phone the page scrolls past the map with one finger and the map moves with two; with a mouse or trackpad the
     wheel zooms and dragging moves it (a laptop with a touch screen still counts as a mouse first) */
  function touchFirst() { try { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; } }
  /* coming back to the page (another app, a locked phone) can leave a WebGL picture blank too */
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && S.map && S.ready) { S.map.resize(); S.map.triggerRepaint(); } });
  W.vtZoom = function (how) {
    if (!S.map || !S.ready) return false;
    if (how === "in") S.map.zoomIn({ duration: 250 }); else if (how === "out") S.map.zoomOut({ duration: 250 });
    else if (S.pend) { S.moved = false; fit(S.pend.o.pts, S.pend.o.home, true); }
    return true;
  };
})();
