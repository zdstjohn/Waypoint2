/* Waypoint street maps: real OpenStreetMap data shipped inside the app as maps/<city>.json and drawn beneath the day's pins.
   Each map has a regional overview (coast, main roads, towns) and a city detail layer (every street, water, parks, beaches,
   rail, ferries, neighbourhood names). Map data © OpenStreetMap contributors (ODbL), via OpenFreeMap. */
(function () {
  "use strict";
  var W = window.W;
  var index = null, indexState = "idle", maps = {}, mapState = {};
  var LAYERS = ["urban", "park", "sand", "water", "river", "canal", "ferry", "minor", "path", "rail", "major", "land"];

  /* an offline copy carries the index and its cities' maps inside the file */
  var SEED = window.__WP_OFFLINE || null;
  if (SEED && SEED.mapIndex) { index = SEED.mapIndex; indexState = "ready"; Object.keys(SEED.maps || {}).forEach(function (k) { try { maps[k] = prep(SEED.maps[k]); mapState[k] = "ready"; } catch (e) {} }); }
  function loadIndex() {
    if (indexState !== "idle") return;
    indexState = "loading";
    fetch("maps/index.json").then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { index = j || {}; indexState = "ready"; W.changed(); }, function () { index = {}; indexState = "ready"; });
  }
  /* decode one delta-encoded line: [lat0, lng0, dlat, dlng, ...] in 1e-5 degrees */
  function decode(arr, q) {
    var out = new Float64Array(arr.length), la = 0, ln = 0, mnA = 1e9, mxA = -1e9, mnN = 1e9, mxN = -1e9;
    for (var i = 0; i < arr.length; i += 2) {
      la += arr[i]; ln += arr[i + 1];
      var a = la / q, n = ln / q; out[i] = a; out[i + 1] = n;
      if (a < mnA) mnA = a; if (a > mxA) mxA = a; if (n < mnN) mnN = n; if (n > mxN) mxN = n;
    }
    return { p: out, b: [mnA, mnN, mxA, mxN] };
  }
  /* compact maps: each line is short text (5 bits per letter, zig-zag signed), and starts where the previous line ended */
  var DEC = new Int8Array(128);
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("").forEach(function (c, i) { DEC[c.charCodeAt(0)] = i; });
  function decodeText(str, q, st) {
    var vals = [], z = 0, mul = 1;
    for (var i = 0; i < str.length; i++) {
      var c = DEC[str.charCodeAt(i)];
      z += (c & 31) * mul;
      if (c & 32) { mul *= 32; continue; }
      vals.push(z % 2 ? -(z + 1) / 2 : z / 2); z = 0; mul = 1;
    }
    var out = new Float64Array(vals.length), la = st.la, ln = st.ln, mnA = 1e9, mxA = -1e9, mnN = 1e9, mxN = -1e9;
    for (var k = 0; k + 1 < vals.length; k += 2) {
      la += vals[k]; ln += vals[k + 1];
      var a = la / q, n = ln / q; out[k] = a; out[k + 1] = n;
      if (a < mnA) mnA = a; if (a > mxA) mxA = a; if (n < mnN) mnN = n; if (n > mxN) mxN = n;
    }
    st.la = la; st.ln = ln;
    return { p: out, b: [mnA, mnN, mxA, mxN] };
  }
  function prepLayer(j, q, packed) {
    var L = { bbox: j.bbox, sea: !!j.sea };
    LAYERS.forEach(function (k) {
      if (packed) { var st = { la: 0, ln: 0 }; L[k] = (j[k] || []).map(function (a) { return decodeText(a, q, st); }); }
      else L[k] = (j[k] || []).map(function (a) { return decode(a, q); });
    });
    L.labels = (j.labels || []).map(function (l) { return { n: l.n, t: l.t, lat: l.p[0] / q, lng: l.p[1] / q }; });
    return L;
  }
  function prep(j) {
    var q = j.q || 1e5;
    var pk = j.pk === 2;
    if (j.v === 2) return { name: j.name, ov: j.overview ? prepLayer(j.overview, q, pk) : null, det: j.detail ? prepLayer(j.detail, q, pk) : null };
    return { name: j.name, ov: null, det: prepLayer(j, q, pk) };   /* first format: one layer */
  }
  /* which built map covers this place: the city's own map first, then any map whose city detail contains the point,
     then any whose regional overview does (so a lodging in Trastevere or a stop in Pompeii still finds its map) */
  function inBox(b, lat, lng) { return b && lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3]; }
  function area(b) { return (b[2] - b[0]) * (b[3] - b[1]); }
  var pickCache = {};
  function pick(country, city, lat, lng) {
    var slug = W.slug(country + " " + city), pk = slug + "|" + (lat == null ? "" : lat.toFixed(3) + "," + lng.toFixed(3));
    if (pk in pickCache) return pickCache[pk];
    var best = null;
    if (index[slug] && (lat == null || inBox(index[slug].bbox, lat, lng))) best = slug;
    if (!best && lat != null) {
      var det = [], ov = [];
      Object.keys(index).forEach(function (k) {
        var e = index[k];
        if (inBox(e.detail, lat, lng)) det.push(k); else if (inBox(e.bbox, lat, lng)) ov.push(k);
      });
      function centreDist(k) { var b = index[k].detail || index[k].bbox; return Math.pow((b[0] + b[2]) / 2 - lat, 2) + Math.pow(((b[1] + b[3]) / 2 - lng) * Math.cos(lat * Math.PI / 180), 2); }
      if (det.length) best = det.sort(function (a, b) { return area(index[a].detail) - area(index[b].detail); })[0];
      else if (ov.length) best = ov.sort(function (a, b) { return centreDist(a) - centreDist(b); })[0];
    }
    pickCache[pk] = best;
    return best;
  }
  /* the street map for a place, or null while it loads / if none covers it yet */
  W.cityMap = function (country, city, lat, lng) {
    loadIndex();
    if (indexState !== "ready") return null;
    var slug = pick(country, city, lat, lng);
    if (!slug) return null;
    if (maps[slug]) return maps[slug];
    if (!mapState[slug]) {
      mapState[slug] = "loading";
      fetch("maps/" + slug + ".json").then(function (r) { if (!r.ok) throw new Error("missing"); return r.json(); })
        .then(function (j) { maps[slug] = prep(j); mapState[slug] = "ready"; W.changed(); }, function () { mapState[slug] = "failed"; });
    }
    return null;
  };
  /* for the offline copy: which sketch map covers a place, and the index itself (after it has loaded) */
  W.sketchFor = function (country, city, lat, lng) { loadIndex(); return indexState === "ready" ? pick(country, city, lat, lng) : null; };
  W.sketchIndex = function () { return indexState === "ready" ? index : null; };
  W.sketchReady = function () { loadIndex(); return new Promise(/** @param {(v?: unknown) => void} ok */ function (ok) { (function wait(n) { if (indexState === "ready" || n > 50) ok(); else setTimeout(function () { wait(n + 1); }, 100); })(0); }); };
  W.cityMapState = function (country, city, lat, lng) {
    if (indexState !== "ready") return "loading";
    var slug = pick(country, city, lat, lng);
    return !slug ? "none" : mapState[slug] === "ready" ? "ready" : mapState[slug] === "failed" ? "none" : "loading";
  };

  /* draw it: one path per layer, only the features that reach the visible frame */
  var cache = {}, clipN = 0;
  W.drawMap = function (M, V) {
    /* V: { lat0, lng0, c, sc, cx, cy, Wd, Hd } (same projection as the pins) */
    var key = M.name + "|" + V.lat0.toFixed(5) + "|" + V.lng0.toFixed(5) + "|" + V.sc.toFixed(4) + "|" + V.Wd + "x" + V.Hd;
    if (cache[key]) return cache[key];
    var kx = V.c * 111.32 * V.sc, ky = 110.57 * V.sc, pad = 30;
    var minLng = V.lng0 + (0 - pad - V.cx) / kx, maxLng = V.lng0 + (V.Wd + pad - V.cx) / kx;
    var maxLat = V.lat0 + (V.cy + pad) / ky, minLat = V.lat0 - (V.Hd + pad - V.cy) / ky;
    function X(lng) { return V.cx + (lng - V.lng0) * kx; }
    function Y(lat) { return V.cy - (lat - V.lat0) * ky; }
    function visible(b) { return !(b[2] < minLat || b[0] > maxLat || b[3] < minLng || b[1] > maxLng); }
    function path(list, close, minPx) {
      var d = [];
      list.forEach(function (f) {
        if (!visible(f.b)) return;
        if (minPx && Math.max((f.b[3] - f.b[1]) * kx, (f.b[2] - f.b[0]) * ky) < minPx) return;
        var p = f.p, s = "", lx = 1e9, ly = 1e9;
        for (var i = 0; i < p.length; i += 2) {
          var x = X(p[i + 1]), y = Y(p[i]);
          if (i && Math.abs(x - lx) < 0.7 && Math.abs(y - ly) < 0.7 && i < p.length - 2) continue;
          s += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); lx = x; ly = y;
        }
        d.push(s + (close ? "Z" : ""));
      });
      return d.join("");
    }
    function el(d, attrs) { return d ? '<path d="' + d + '" ' + attrs + "/>" : ""; }
    /* street detail scales with zoom: smaller streets appear as they become readable */
    var ppk = V.sc;
    var majorW = Math.min(6, Math.max(1.4, ppk / 20)), minorW = Math.min(3, Math.max(0.5, ppk / 45)), pathW = Math.min(1.6, Math.max(0.4, ppk / 90));
    function layer(L, isDetail) {
      var o = "";
      if (L.sea) o += el(path(L.land, true, 1.5), 'fill="var(--map)"');
      o += el(path(L.urban, true, 4), 'fill="var(--urban)"');
      o += el(path(L.park, true, 3), 'fill="var(--park)"');
      o += el(path(L.sand, true, 3), 'fill="var(--sandsoft)"');
      o += el(path(L.water, true, 1.5), 'fill="var(--water)"');
      o += el(path(L.river, false), 'fill="none" stroke="var(--water)" stroke-width="' + (isDetail ? Math.max(2, majorW * 1.4) : 2.2).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"');
      o += el(path(L.canal, false), 'fill="none" stroke="var(--water)" stroke-width="' + Math.max(1.4, minorW * 1.6).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"');
      o += el(path(L.ferry, false), 'fill="none" stroke="var(--water-edge)" stroke-width="1.3" stroke-dasharray="4 4"');
      if (isDetail && ppk > 60) o += el(path(L.path, false), 'fill="none" stroke="var(--road-minor)" stroke-width="' + pathW.toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"');
      if (isDetail && ppk > 22) o += el(path(L.minor, false), 'fill="none" stroke="var(--road-minor)" stroke-width="' + minorW.toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"');
      o += el(path(L.rail, false), 'fill="none" stroke="var(--rail)" stroke-width="1.3" stroke-dasharray="5 3"');
      var maj = path(L.major, false);
      if (maj) o += el(maj, 'fill="none" stroke="var(--road-edge)" stroke-width="' + (majorW + 1.6).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"') +
        el(maj, 'fill="none" stroke="var(--road)" stroke-width="' + majorW.toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"');
      return o;
    }
    var out = '<rect x="0" y="0" width="' + V.Wd + '" height="' + V.Hd + '" fill="var(--map)"/>', labels = [];
    if (M.ov) out += layer(M.ov, false);
    var det = M.det, inDet = null;
    if (det && det.bbox && visible([det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3]])) {
      /* the city detail replaces the overview inside its own area */
      var bx0 = X(det.bbox[1]), bx1 = X(det.bbox[3]), by0 = Y(det.bbox[2]), by1 = Y(det.bbox[0]), id = "dclip" + (++clipN);
      out += '<clipPath id="' + id + '"><rect x="' + bx0.toFixed(1) + '" y="' + by0.toFixed(1) + '" width="' + (bx1 - bx0).toFixed(1) + '" height="' + (by1 - by0).toFixed(1) + '"/></clipPath>' +
        '<g clip-path="url(#' + id + ')"><rect x="' + bx0.toFixed(1) + '" y="' + by0.toFixed(1) + '" width="' + (bx1 - bx0).toFixed(1) + '" height="' + (by1 - by0).toFixed(1) + '" fill="' + (det.sea ? "var(--water)" : "var(--map)") + '"/>' + layer(det, true) + "</g>";
      inDet = det.bbox;
    }
    function inView(l) { return l.lat > minLat && l.lat < maxLat && l.lng > minLng && l.lng < maxLng; }
    if (det) det.labels.forEach(function (l) { if (inView(l) && (ppk > 25 || l.t === "city" || l.t === "town")) labels.push(l); });
    if (M.ov) M.ov.labels.forEach(function (l) {
      if (!inView(l)) return;
      if (inDet && l.lat > inDet[0] && l.lat < inDet[2] && l.lng > inDet[1] && l.lng < inDet[3]) return;
      labels.push(l);
    });
    var res = { svg: out, labels: labels };
    var keys = Object.keys(cache); if (keys.length > 24) delete cache[keys[0]];
    cache[key] = res;
    return res;
  };
})();
