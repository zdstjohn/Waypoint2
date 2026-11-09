/* Waypoint offline: the trip keeps working when the signal goes. The plan and the city lists already live on the phone
   (local storage); this keeps the rest there too — the photo index, the photos themselves, the street-map packs — and
   says so in Travel mode. Saving happens by itself as the trip nears and once a day while it's on, or on a tap.
   An "offline copy" is one file (the app, this trip, and the photos of every place in its cities) that opens with no network at
   all, for the days the live page can't be reached. */
(function () {
  "use strict";
  var W = window.W;
  /** @type {OfflineState} */
  var O = W.offline = /** @type {OfflineState} */ (/** @type {any} */ ({ state: "idle", n: 0, total: 0, at: 0, maps: [], err: "", off: !navigator.onLine, copy: !!window.__WP_OFFLINE, trip: null, copyState: "", copyErr: "", why: "" }));
  var DBN = "waypoint-offline", dbp = null, urls = {}, loadedBlobs = false, saveTimer = null, SAVE_KEY = "waypoint-offline-v1";
  var rec = null; try { rec = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) {}
  if (rec) { O.at = rec.at || 0; O.n = rec.n || 0; O.maps = rec.maps || []; O.trip = rec.trip; O.cities = rec.cities || {}; }

  /* ---------- the store: photos as blobs, the photo index as one record ---------- */
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, no) {
      try {
        var r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = function () { var d = r.result; d.createObjectStore("blobs", { keyPath: "url" }); d.createObjectStore("kv", { keyPath: "k" }); };
        r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); };
      } catch (e) { no(e); }
    });
    dbp.then(null, function () { dbp = null; });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) { return new Promise(function (ok, no) { try { var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = function () { ok(out && "result" in out ? out.result : out); }; t.onerror = function () { no(t.error); }; } catch (e) { no(e); } }); });
  }
  function getAll(store) { return tx(store, "readonly", function (s) { return s.getAll(); }).then(null, function () { return []; }); }
  function put(store, v) { return tx(store, "readwrite", function (s) { s.put(v); }).then(null, function () {}); }
  function has(url) { return tx("blobs", "readonly", function (s) { return s.getKey(url); }).then(function (k) { return !!k; }, function () { return false; }); }

  /* ---------- what the trip shows: its photos, its maps ---------- */
  /* every photo the trip can show, most needed first: the plan's stops and your journal, then every other idea in the
     trip's cities (Explore, the swap choices, a stop's panel), city by city */
  function photoUrls(P) {
    var out = [], seen = {}, cities = {};
    function add(u) { if (u && !seen[u]) { seen[u] = 1; out.push(u); } }
    (P.days || []).forEach(function (d) {
      (d.slots || []).forEach(function (x) { if (x.item) { var ph = W.photoFor(x.item, W.isFood(x.slot), d.country, d.city); if (ph && ph.url) add(ph.url); } });
      var j = (W.S.journal || {})[W.restKey ? W.restKey(d) : d.n]; (j && j.photos || []).forEach(function (p) { if (p && p.id) add("/_blob/" + encodeURIComponent(p.id)); });
      cities[d.country + "|" + d.city] = [d.country, d.city];
      if (d.trip) cities[d.trip.country + "|" + d.trip.name] = [d.trip.country, d.trip.name];
    });
    Object.keys(cities).forEach(function (k) {
      var c = cities[k], pl = W.pool(c[0], c[1]); if (!pl) return;
      var one = function (/** @type {any} */ it, /** @type {boolean} */ food) { if (W.gone && W.gone(it)) return; var ph = W.photoFor(it, food, c[0], c[1]); if (ph && ph.url) add(ph.url); };
      (pl.spots || []).forEach(function (it) { one(it, false); }); (pl.food || []).forEach(function (it) { one(it, true); });
    });
    return out;
  }
  O.photoUrls = photoUrls;
  /* the trip city by city: its stops, the photo each one shows (if any), its street map */
  function cityRows(P) {
    var rows = [], by = {};
    (P.stops || []).forEach(function (s) {
      var k = s.country + "|" + s.name; if (by[k]) return;
      var hb = W.homebase(s.country, s.name), c = W.stopAt ? W.stopAt(s) : null, lat = hb && hb.lat != null ? hb.lat : c && c.lat, lng = hb && hb.lng != null ? hb.lng : c && c.lng;
      by[k] = { key: k, country: s.country, city: s.name, items: {}, map: W.vtFor && lat != null ? W.vtFor(s.country, s.name, lat, lng) : null };
      rows.push(by[k]);
    });
    (P.days || []).forEach(function (d) {
      var r = by[d.country + "|" + d.city]; if (!r) return;
      (d.slots || []).forEach(function (x) {
        if (!x.item || x.item.n in r.items) return;
        var food = W.isFood(x.slot), ph = W.photoFor(x.item, food, d.country, d.city);
        if (ph && food && ph.near) ph = null;   /* a place to eat shows only its own photo */
        r.items[x.item.n] = ph && ph.url ? ph.url : "";
      });
    });
    rows.forEach(function (r) { var v = Object.keys(r.items).map(function (n) { return r.items[n]; }); r.stops = v.length; r.urls = v.filter(Boolean); });
    return rows;
  }
  W.tripPhotoCoverage = function (P) {
    var rows = cityRows(P), n = 0, w = 0; rows.forEach(function (r) { n += r.stops; w += r.urls.length; });
    return { stops: n, withPhoto: w, pct: n ? Math.round(w * 100 / n) : 0, rows: rows };
  };
  function mapSlugs(P) {
    var out = [];
    (P.stops || []).forEach(function (s) {
      var hb = W.homebase(s.country, s.name), c = W.stopAt ? W.stopAt(s) : null, lat = hb && hb.lat != null ? hb.lat : c && c.lat, lng = hb && hb.lng != null ? hb.lng : c && c.lng;
      var slug = W.vtFor && lat != null ? W.vtFor(s.country, s.name, lat, lng) : null;
      if (slug && out.indexOf(slug) < 0) out.push(slug);
      (s.trips || []).forEach(function (t) { var sl = W.vtFor && t.c && t.c.lat != null ? W.vtFor(t.country, t.name, t.c.lat, t.c.lng) : null; if (sl && out.indexOf(sl) < 0) out.push(sl); });
    });
    return out;
  }

  /* ---------- saving ---------- */
  O.save = function (P, why) {
    if (P && W.plan) P = W.plan();   /* the plan as the data stands now, not as last drawn (answers may have arrived since) */
    if (O.state === "saving" || !P || !P.stops.length || O.off || W.readOnly || O.copy) return Promise.resolve();
    O.state = "saving"; O.err = ""; O.why = why || "";
    var list = photoUrls(P), todo = [], n = 0, saved = {};
    O.total = list.length; O.n = 0;
    W.changed();
    /* the photo index for this trip's cities, so photos resolve before (or without) the database */
    var snap = W.photosSnapshot ? W.photosSnapshot() : null;
    var p0 = snap ? put("kv", { k: "photos", v: snap, at: Date.now() }) : Promise.resolve();
    return p0.then(function () {
      return Promise.all(list.map(function (u) { return has(u).then(function (h) { if (h) { n++; O.n = n; saved[u] = 1; } else todo.push(u); }); }));
    }).then(function () {
      /* a few at a time; a photo that can't be fetched is skipped, not fatal */
      var i = 0, lanes = [];
      function next() {
        if (i >= todo.length) return Promise.resolve();
        var u = todo[i++];
        return fetch(u).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then(function (b) { return put("blobs", { url: u, blob: b, at: Date.now() }); }).then(function () { n++; O.n = n; saved[u] = 1; if (n % 8 === 0) W.changed(); }, function () {}).then(next);
      }
      for (var k = 0; k < 4; k++) lanes.push(next());
      return Promise.all(lanes);
    }).then(function () {
      /* street maps: the pack worker keeps them in its own cache; here they are only asked for */
      var slugs = mapSlugs(P);
      return Promise.all(slugs.map(function (sl) { return W.vtWarm ? W.vtWarm(sl).then(function () { return sl; }, function () { return null; }) : Promise.resolve(null); })).then(function (done) { return done.filter(Boolean); });
    }).then(function (maps) {
      O.maps = maps; O.at = Date.now(); O.n = n; O.trip = W.S.tripId || ""; O.state = "done";
      /* city by city: how many of its photos and whether its street map are on the phone now */
      var cs = O.cities = /** @type {Record<string, { photos: number; of: number; map: boolean }>} */ ({}); cityRows(P).forEach(function (r) { cs[r.key] = { photos: r.urls.filter(function (u) { return saved[u]; }).length, of: r.urls.length, map: !!r.map && maps.indexOf(r.map) > -1 }; });
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: O.at, n: n, maps: maps, trip: O.trip, sig: sig(P), cities: O.cities })); } catch (e) {}
      W.changed();
    }, function (e) { O.state = "error"; O.err = String(e && e.message || e); W.changed(); });
  };
  function sig(P) { return P.N + "|" + P.stops.map(function (s) { return s.name + s.days; }).join(",") + "|" + (W.S.start || ""); }
  /* by itself: once the trip is within a week (or on), when nothing is saved yet for this plan or the save is a day old */
  O.tick = function (P) {
    if (O.off || O.copy || W.readOnly || W.isExample || !P || !P.stops.length || !W.S.start || O.state === "saving") return;
    var start = new Date(W.S.start + "T12:00"), days = (start.getTime() - W.now().getTime()) / 864e5;
    if (days > 7 || days < -(P.N + 1)) return;
    var r = null; try { r = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) {}
    var stale = !r || r.trip !== (W.S.tripId || "") || r.sig !== sig(P) || Date.now() - (r.at || 0) > 864e5;
    if (!stale || saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; O.save(P, "auto"); }, 4000);
  };

  /* ---------- using what's saved ---------- */
  /* when offline, saved photos come from the phone: the same picture, from a blob */
  function loadBlobs() {
    if (loadedBlobs) return Promise.resolve();
    loadedBlobs = true;
    return getAll("blobs").then(function (rows) {
      rows.forEach(function (r) { try { if (!urls[r.url]) urls[r.url] = URL.createObjectURL(r.blob); } catch (e) {} });
      W.changed();
    });
  }
  O.src = function (u) {
    if (!u) return u;
    if (O.copy && window.__WP_OFFLINE.blobs && window.__WP_OFFLINE.blobs[u]) return window.__WP_OFFLINE.blobs[u];
    if (O.off && urls[u]) return urls[u];
    return u;
  };
  function goOffline() { O.off = true; loadBlobs(); document.documentElement.classList.add("offline"); W.changed(); }
  function goOnline() { O.off = false; document.documentElement.classList.remove("offline"); W.changed(); if (W.pump) W.pump(); }
  window.addEventListener("offline", goOffline); window.addEventListener("online", goOnline);
  if (O.off) { document.documentElement.classList.add("offline"); loadBlobs(); }
  /* the photo index saved last time fills in before the database answers (and instead of it, offline) */
  if (!O.copy) tx("kv", "readonly", function (s) { return s.get("photos"); }).then(function (r) { if (r && r.v && W.photosSeed) W.photosSeed(r.v); }, function () {});
  else if (window.__WP_OFFLINE.photos && W.photosSeed) W.photosSeed(window.__WP_OFFLINE.photos);

  /* ---------- the block in Travel mode ---------- */
  O.block = function (P) {
    if (W.readOnly) return "";
    if (O.copy) {
      var at = window.__WP_OFFLINE.at ? new Date(window.__WP_OFFLINE.at) : null;
      return '<section class="go-off sk copy"><span class="go-k">Offline copy</span><p>Saved ' + (at ? W.esc(at.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " " + W.clock(at.getHours() * 60 + at.getMinutes())) : "") + ". Everything here works without a connection; open the live app when you're back online to pick up changes.</p></section>";
    }
    var h = '<section class="go-off sk' + (O.off ? " is-off" : "") + '">';
    if (O.off) {
      var have = ["your plan"].concat(O.n ? [O.n + " photo" + (O.n === 1 ? "" : "s")] : []).concat(O.maps.length ? ["the street map" + (O.maps.length === 1 ? "" : "s")] : []);
      var list = have.length > 1 ? have.slice(0, -1).join(", ") + " and " + have[have.length - 1] : have[0];
      h += '<span class="go-k">You\'re offline</span><p>' + (O.at ? list.charAt(0).toUpperCase() + list.slice(1) + (have.length > 1 ? " are" : " is") + " on this phone. Prices and new ideas wait for a signal." : "Your plan and the city lists are on this phone. Photos and maps weren't saved yet; they'll come back with the signal.") + "</p>";
    }
    else if (O.state === "saving") h += '<span class="go-k">Saving for offline…</span><p><span class="loading">' + O.n + " of " + O.total + " photos</span></p>";
    else if (O.state === "error") h += '<span class="go-k">Offline</span><p>Couldn\'t finish saving (' + W.esc(O.err) + ').</p><div class="gr-b"><button type="button" class="chip" data-offsave="1">Try again</button></div>';
    else if (O.at && O.trip === (W.S.tripId || "")) {
      var d = new Date(O.at);
      h += '<span class="go-k">Ready for offline</span><p>' + O.n + " photo" + (O.n === 1 ? "" : "s") + (O.maps.length ? " and " + O.maps.length + " street map" + (O.maps.length === 1 ? "" : "s") : "") + " on this phone · saved " + W.esc(d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })) + " " + W.clock(d.getHours() * 60 + d.getMinutes()) +
        '</p><div class="gr-b"><button type="button" class="chip" data-offsave="1">Save again</button><button type="button" class="chip" data-offcopy="1"' + (O.copyState === "making" ? " disabled" : "") + ">" + (O.copyState === "making" ? "Making the file…" : "Save an offline copy") + "</button></div>";
    } else h += '<span class="go-k">Offline</span><p>Save this trip\'s photos and maps on the phone, for ferries, museums and no-signal days. It happens by itself the week before you leave.</p><div class="gr-b"><button type="button" class="chip" data-offsave="1">Save now</button><button type="button" class="chip" data-offcopy="1"' + (O.copyState === "making" ? " disabled" : "") + ">" + (O.copyState === "making" ? "Making the file…" : "Save an offline copy") + "</button></div>";
    if (O.copyState === "error") h += '<p class="small muted">' + W.esc(O.copyErr || "Couldn't make the file.") + "</p>";
    if (O.copyState === "done") h += '<p class="small muted">Offline copy saved. Open it from your phone\'s files; it works with no connection.</p>';
    return h + "</section>";
  };
  /* Prepare, Take along: download the whole trip (each city's street map and photos) before you leave, with what is on
     the phone city by city, how many stops have a photo, and about how big it is (best on Wi-Fi) */
  O.tripBlock = function (P) {
    if (O.copy || W.readOnly || !P || !P.stops.length) return "";
    var cov = W.tripPhotoCoverage(P), mine = O.at && O.trip === (W.S.tripId || "") ? (O.cities || {}) : {};
    var mb = 0; cov.rows.forEach(function (r) { if (r.map && !(mine[r.key] && mine[r.key].map)) mb += (W.vtSize ? W.vtSize(r.map) : 0) || 4e6; mb += (r.urls.length - (mine[r.key] ? mine[r.key].photos : 0)) * 160e3; });
    var conn = /** @type {any} */ (navigator).connection, cell = conn && (conn.type === "cellular" || conn.saveData);
    var rows = cov.rows.map(function (r) {
      var m = mine[r.key], mapTxt = !r.map ? "no street map yet" : m && m.map ? "street map saved" : "street map";
      var phTxt = r.stops ? "photos for " + r.urls.length + " of " + r.stops + " stops" + (m && m.photos < r.urls.length ? " (" + m.photos + " saved)" : "") : "no stops yet";
      var done = m && (!r.map || m.map) && m.photos >= r.urls.length;
      return '<li class="dl-row' + (done ? " done" : "") + '"><b>' + W.esc(r.city) + '</b><span class="small muted">' + W.esc(mapTxt + " · " + phTxt) + "</span></li>";
    }).join("");
    var all = cov.rows.every(function (r) { var m = mine[r.key]; return m && (!r.map || m.map) && m.photos >= r.urls.length; });
    var btn = O.state === "saving" ? '<span class="loading">Saving… ' + O.n + " of " + O.total + " photos</span>"
      : O.off ? '<span class="small muted">Connect to download.</span>'
      : '<button type="button" class="btn' + (all ? " quiet" : "") + '" data-offsave="1">' + (all ? "Download again" : "Download the trip") + "</button>" +
        (mb > 0 && !all ? '<span class="small muted">About ' + Math.max(1, Math.round(mb / 1e6)) + " MB" + (cell ? ": you're on mobile data, Wi-Fi is better" : ", best on Wi-Fi") + "</span>" : "");
    return '<div class="dl-trip"><span class="k">Before you leave</span><p class="small">' + (all ? "Everything for this trip is on this phone." : "Save each city's street map and the trip's photos on this phone, for ferries, museums and no-signal days.") +
      " Photos for " + cov.pct + "% of stops (" + cov.withPhoto + " of " + cov.stops + ").</p><ul class=\"dl-list\">" + rows + '</ul><div class="row">' + btn + "</div></div>";
  };
  /* the offline-copy button for the Prepare screen's Take along segment */
  O.takeBlock = function (P) {
    if (O.copy) return "";
    return '<div class="take-off"><span class="k">Offline copy</span><div class="row"><button type="button" class="btn quiet" data-offcopy="1"' + (O.copyState === "making" ? " disabled" : "") + ">" + (O.copyState === "making" ? "Making the file…" : "Save an offline copy") + "</button>" +
      '<span class="small muted">' + (O.copyState === "making" && O.copyOf ? "Adding photos: " + (O.copyN || 0) + " of " + O.copyOf : O.copyState === "done" ? "Saved. Open it from your phone's files; it works with no connection." : O.copyState === "error" ? W.esc(O.copyErr || "Couldn't make the file.") : "One file with the app, this trip and the photos of every place in it (street maps need a connection).") + "</span></div></div>";
  };
  O.click = function (d, P) {
    if (d.offsave) { O.save(P, "tap"); return true; }
    if (d.offcopy) { O.exportCopy(P); return true; }
    return false;
  };

  /* ---------- the offline copy: one HTML file with the app, this trip and its cities' photos inside ---------- */
  function text(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing " + u); return r.text(); }); }
  function dataUri(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing " + u); return r.blob(); }).then(function (b) {
      return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { no(fr.error); }; fr.readAsDataURL(b); });
    });
  }
  O.exportCopy = function (P) {
    if (P && W.plan) P = W.plan();
    if (O.copyState === "making" || !P || !P.stops.length) return Promise.resolve();
    O.copyState = "making"; O.copyErr = ""; W.changed();
    var seed = { at: Date.now(), S: null, C: null, photos: W.photosSnapshot ? W.photosSnapshot() : null, blobs: {} };
    return Promise.all([text("index.html"), text("app.min.css"), text("app.js"), text("app2.js"), text("app2.css")]).then(function (r) {
      var html = r[0], css = r[1] + "\n" + r[4], js = r[2], js2 = r[3];   /* both stylesheets in one */
      /* fonts become data URIs inside the stylesheet */
      var fonts = []; css.replace(/url\((fonts\/[^)]+)\)/g, function (m, u) { if (fonts.indexOf(u) < 0) fonts.push(u); return m; });
      return Promise.all(fonts.map(dataUri)).then(function (ds) {
        fonts.forEach(function (u, i) { css = css.split("url(" + u + ")").join("url(" + ds[i] + ")"); });
        /* the photos the trip shows */
        /* a few at a time, in order of need, up to 60 MB of photos (a phone opens a file that size; past it, the rest of
           the ideas show without a picture, as they would anyway with no signal) */
        var list = photoUrls(P), i = 0, bytes = 0, MAX = 60e6;
        O.copyN = 0; O.copyOf = list.length;
        function worker() {
          if (i >= list.length || bytes > MAX) return Promise.resolve();
          var u = list[i++];
          return dataUri(u).then(function (d) { if (bytes + d.length <= MAX) { seed.blobs[u] = d; bytes += d.length; } }, function () {})
            .then(function () { O.copyN++; if (O.copyN % 10 === 0) W.changed(); return worker(); });
        }
        return Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      }).then(function () {
        seed.S = JSON.parse(JSON.stringify(W.S)); seed.C = JSON.parse(JSON.stringify(W.C));
        /* (replacement text goes in as a function: code and JSON are full of "$" sequences String.replace would expand) */
        var styleTag = "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
        var safe = function (code) { return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--"); };
        /* both scripts inline (the second one too: a file opened from the phone can't fetch it), in order */
        var scriptTags = "<script>window.__WP_LATER=1;window.__WP_OFFLINE=" + safe(JSON.stringify(seed)) + "</script>\n<script>" + safe(js) + "</script>\n<script>" + safe(js2) + "</script>";
        var page = html
          .replace(/<link rel="preload"[^>]*>\s*/g, "")
          .replace(/<link rel="stylesheet" href="app.min.css"[^>]*>/, function () { return styleTag; })
          .replace(/<script src="app.js"[^>]*><\/script>/, function () { return scriptTags; });
        if (page.indexOf(scriptTags) < 0 || page.indexOf(styleTag) < 0) throw new Error("the page's script or style tag was not found");
        /* the live page is wrapped in a document by its host; the file needs its own (and its charset, or the browser guesses) */
        page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + "</body></html>";
        var name = (W.tripName ? W.tripName() : "Trip").replace(/[^\w\- ]+/g, "").trim() || "Trip";
        var blob = new Blob([page], { type: "text/html" }), file = name + " (offline copy).html";
        return (window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null)).then(function (dl) {
          if (!dl) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); a.remove(); return; }
          return dl.save({ filename: file, data: blob });
        });
      });
    }).then(function () { O.copyState = "done"; W.changed(); }, function (e) {
      O.copyState = e && e.code === "declined" ? "idle" : "error"; O.copyErr = e && e.code === "unavailable" ? "Downloads aren't available in this view." : "Couldn't make the file: " + String(e && e.message || e); W.changed();
    });
  };
})();
