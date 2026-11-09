/* Day maps for cities without a street-map pack: a real street map of the day from Mapbox (streets, landmarks,
   the coast), with every stop numbered in the day's order, the place you stay, and the day's loop drawn between them.
   It comes through the viewer's Mapbox connection (the same one place search uses) as one picture per day, kept in
   memory only, and opens the whole day in Google Maps when tapped. Pins taken from Google ("gpin") are never drawn on
   it: Google's places stay on Google's maps. Without the Mapbox connection there is simply no picture. */
(function () {
  "use strict";
  var W = window.W;
  var WD = 640, HT = 400;                          /* the picture, in CSS pixels (16:10) */
  var cache = {}, busy = {}, fail = {}, order = [], off = false, want = {}, last = {}, sched = {}, cur = "";

  /* Google's encoded polyline (precision 5), for the day's loop */
  function enc(coords) {
    var out = "", pa = 0, pb = 0;
    function one(v) { v = v < 0 ? ~(v << 1) : v << 1; var s = ""; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); }
    coords.forEach(function (c) { var a = Math.round(c[0] * 1e5), b = Math.round(c[1] * 1e5); out += one(a - pa) + one(b - pb); pa = a; pb = b; });
    return out;
  }
  function merc(lat) { var s = Math.sin(lat * Math.PI / 180); return Math.log((1 + s) / (1 - s)) / 2; }
  function unmerc(y) { return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI; }
  /* the centre and zoom that fit every pin, leaving room for the pins' heads (Mapbox's world is 512 px wide at zoom 0) */
  W.mbFit = function (pts) {
    var la = pts.map(function (p) { return p.lat; }), ln = pts.map(function (p) { return p.lng; });
    var x0 = Math.min.apply(null, ln), x1 = Math.max.apply(null, ln), y0 = merc(Math.min.apply(null, la)), y1 = merc(Math.max.apply(null, la));
    var c = { latitude: +unmerc((y0 + y1) / 2).toFixed(5), longitude: +((x0 + x1) / 2).toFixed(5) };
    var zx = x1 - x0 > 1e-6 ? Math.log2((WD - 90) * 360 / (512 * (x1 - x0))) : 22;
    var zy = y1 - y0 > 1e-7 ? Math.log2((HT - 110) * 2 * Math.PI / (512 * (y1 - y0))) : 22;
    var z = Math.min(zx, zy, 15.5);
    /* the pins' heads stand above their points: move the centre down a little so the top row is not cut */
    var up = 16 / (512 * Math.pow(2, z)) * 2 * Math.PI;
    c.latitude = +unmerc((y0 + y1) / 2 + up).toFixed(5);
    return { center: c, zoom: +Math.max(2, z).toFixed(2) };
  };
  /* the request for one day: stops (numbered, places to eat in the food colour), the stay, the loop */
  W.mbInput = function (pts, home, hi) {
    var on = pts.filter(function (p) { return p.lat != null && p.lng != null && !p.gpin; }).slice(0, 20);
    var all = on.concat(home && home.lat != null ? [home] : []);
    if (!all.length) return null;
    var f = W.mbFit(all), ov = [];
    var loop = (home && home.lat != null ? [home] : []).concat(on);
    if (home && home.lat != null && on.length) loop.push(home);
    if (loop.length > 1) ov.push({ type: "path", encodedPolyline: enc(loop.map(function (p) { return [p.lat, p.lng]; })), strokeColor: "3F4682", strokeOpacity: 0.55, strokeWidth: 3 });
    if (home && home.lat != null) ov.push({ type: "marker", latitude: +home.lat.toFixed(5), longitude: +home.lng.toFixed(5), label: "lodging", color: "2a2440" });
    on.slice().reverse().forEach(function (p) { ov.push({ type: "marker", latitude: +p.lat.toFixed(5), longitude: +p.lng.toFixed(5), label: String(Math.min(99, p.num || 1)), color: p.food ? "D9663F" : "3F4682" }); });
    return { center: f.center, zoom: f.zoom, size: { width: WD, height: HT }, highDensity: !!hi, style: "mapbox/streets-v12", overlays: ov };
  };
  function fetchMap(key, input) {
    busy[key] = 1;
    W.callTool("Mapbox", "static_map_image_tool", input).then(function (r) {
      var img = ((r && r.content) || []).filter(function (b) { return b && b.type === "image" && b.data; })[0];
      if (!img) throw { code: "no_image" };
      var bin = atob(img.data), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      cache[key] = URL.createObjectURL(new Blob([u8], { type: /^image\//.test(img.mimeType || "") ? img.mimeType : "image/png" }));
      order.push(key);
      if (order.length > 24) { var old = order.shift(); try { URL.revokeObjectURL(cache[old]); } catch (e) {} delete cache[old]; }
    }, function (e) {
      var code = e && e.code;
      /* no Mapbox connection for this viewer (not allowed, not connected, not offered): no maps at all, no retries */
      if (["not_granted", "server_not_connected", "blocked_by_policy", "unavailable", "not_found"].indexOf(code) > -1) off = true;
      else fail[key] = 1;
    }).then(function () { delete busy[key]; W.changed(); });
  }
  /* the map for a day, as HTML: the picture when it has come, a quiet placeholder while it comes, nothing without
     the Mapbox connection. pts: the day's stops ({n, lat, lng, num, food, gpin}); gm: the whole day in Google Maps. */
  W.mbMapBox = function (day, pts, home, gm) {
    if (off || !W.callTool || (W.offline && W.offline.copy)) return "";
    var input = W.mbInput(pts, home, (window.devicePixelRatio || 1) > 1.3);
    if (!input) return "";
    var key = JSON.stringify(input);
    if (fail[key]) return "";
    var url = cache[key], dk = day.n + "|" + day.city;
    /* ask once the day has settled: while a trip is still arriving its pins move, and each move would be a new picture.
       Until the new one comes, the day's last picture stays (no flashing). */
    cur = dk; want[dk] = key;
    if (url) last[dk] = url;
    else if (!busy[key] && !sched[key]) {
      /* and only for the day still on screen (flipping through days asks for none of the ones passed by) */
      sched[key] = 1;
      setTimeout(function () { delete sched[key]; if (cur === dk && want[dk] === key && !cache[key] && !busy[key] && !off) fetchMap(key, input); }, 700);
    }
    url = url || (last[dk] && order.some(function (k) { return cache[k] === last[dk]; }) ? last[dk] : "");
    var shown = pts.filter(function (p) { return p.lat != null && !p.gpin; }).length, miss = pts.length - shown;
    var esc = W.esc, alt = "Map of " + (shown ? shown + " stop" + (shown > 1 ? "s" : "") + " today in " : "") + day.city;
    var pic = url ? '<img src="' + url + '" alt="' + esc(alt) + '" width="' + WD + '" height="' + HT + '" decoding="async">' : '<span class="mb-wait loading">Loading the map…</span>';
    return '<figure class="mbmap">' + (gm && url ? '<a href="' + esc(gm) + '" target="_blank" rel="noopener" aria-label="' + esc(alt + ": open the whole day in Google Maps") + '">' + pic + "</a>" : pic) +
      (miss ? '<figcaption class="small muted">' + miss + " stop" + (miss > 1 ? "s aren't" : " isn't") + " on this map yet; Google Maps finds " + (miss > 1 ? "them" : "it") + " by name</figcaption>" : "") + "</figure>";
  };
  W.mbState = function () { return { off: off, cached: order.length, busy: Object.keys(busy).length }; };
})();
