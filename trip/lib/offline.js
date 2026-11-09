/* Waypoint offline: the trip keeps working when the signal goes. The plan and the city lists already live on the phone
   (local storage); this keeps the rest there too — the photo index, the photos themselves, the street-map packs — and
   says so in Travel mode. Saving happens by itself as the trip nears and once a day while it's on, or on a tap.
   An "offline copy" is one file (the app, this trip, its photos and sketch maps inside) that opens with no network at
   all, for the days the live page can't be reached. */
(function () {
  "use strict";
  var W = window.W;
  /** @type {OfflineState} */
  var O = W.offline = /** @type {OfflineState} */ (/** @type {any} */ ({ state: "idle", n: 0, total: 0, at: 0, maps: [], err: "", off: !navigator.onLine, copy: !!window.__WP_OFFLINE, trip: null, copyState: "", copyErr: "", why: "" }));
  var DBN = "waypoint-offline", dbp = null, urls = {}, loadedBlobs = false, saveTimer = null, SAVE_KEY = "waypoint-offline-v1";
  var rec = null; try { rec = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) {}
  if (rec) { O.at = rec.at || 0; O.n = rec.n || 0; O.maps = rec.maps || []; O.trip = rec.trip; }

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
  function photoUrls(P) {
    var out = {}, seen = {};
    function add(u) { if (u && !seen[u]) { seen[u] = 1; out[u] = 1; } }
    (P.days || []).forEach(function (d) {
      (d.slots || []).forEach(function (x) { if (x.item) { var ph = W.photoFor(x.item, W.isFood(x.slot), d.country, d.city); if (ph && ph.url) add(ph.url); } });
      var j = (W.S.journal || {})[W.restKey ? W.restKey(d) : d.n]; (j && j.photos || []).forEach(function (p) { if (p && p.id) add("/_blob/" + encodeURIComponent(p.id)); });
    });
    return Object.keys(out);
  }
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
    if (O.state === "saving" || !P || !P.stops.length || O.off || W.readOnly || O.copy) return Promise.resolve();
    O.state = "saving"; O.err = ""; O.why = why || "";
    var list = photoUrls(P), todo = [], n = 0;
    O.total = list.length; O.n = 0;
    W.changed();
    /* the photo index for this trip's cities, so photos resolve before (or without) the database */
    var snap = W.photosSnapshot ? W.photosSnapshot() : null;
    var p0 = snap ? put("kv", { k: "photos", v: snap, at: Date.now() }) : Promise.resolve();
    return p0.then(function () {
      return Promise.all(list.map(function (u) { return has(u).then(function (h) { if (h) { n++; O.n = n; } else todo.push(u); }); }));
    }).then(function () {
      /* a few at a time; a photo that can't be fetched is skipped, not fatal */
      var i = 0, lanes = [];
      function next() {
        if (i >= todo.length) return Promise.resolve();
        var u = todo[i++];
        return fetch(u).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then(function (b) { return put("blobs", { url: u, blob: b, at: Date.now() }); }).then(function () { n++; O.n = n; if (n % 8 === 0) W.changed(); }, function () {}).then(next);
      }
      for (var k = 0; k < 4; k++) lanes.push(next());
      return Promise.all(lanes);
    }).then(function () {
      /* street maps: the pack worker keeps them in its own cache; here they are only asked for */
      var slugs = mapSlugs(P);
      return Promise.all(slugs.map(function (sl) { return W.vtWarm ? W.vtWarm(sl).then(function () { return sl; }, function () { return null; }) : Promise.resolve(null); })).then(function (done) { return done.filter(Boolean); });
    }).then(function (maps) {
      O.maps = maps; O.at = Date.now(); O.n = n; O.trip = W.S.tripId || ""; O.state = "done";
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: O.at, n: n, maps: maps, trip: O.trip, sig: sig(P) })); } catch (e) {}
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
    if (O.off) h += '<span class="go-k">You\'re offline</span><p>' + (O.at ? "Your plan" + (O.n ? (O.maps.length ? ", " : " and ") + O.n + " photo" + (O.n === 1 ? "" : "s") : "") + (O.maps.length ? " and the street maps" : "") + " are on this phone. Prices and new ideas wait for a signal." : "Your plan and the city lists are on this phone. Photos and maps weren't saved yet; they'll come back with the signal.") + "</p>";
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
  /* the offline-copy button for the Prepare screen's Take along segment */
  O.takeBlock = function (P) {
    if (O.copy) return "";
    return '<div class="take-off"><span class="k">Offline copy</span><div class="row"><button type="button" class="btn quiet" data-offcopy="1"' + (O.copyState === "making" ? " disabled" : "") + ">" + (O.copyState === "making" ? "Making the file…" : "Save an offline copy") + "</button>" +
      '<span class="small muted">' + (O.copyState === "done" ? "Saved. Open it from your phone's files; it works with no connection." : O.copyState === "error" ? W.esc(O.copyErr || "Couldn't make the file.") : "One file with the app, this trip, its photos and sketch maps inside.") + "</span></div></div>";
  };
  O.click = function (d, P) {
    if (d.offsave) { O.save(P, "tap"); return true; }
    if (d.offcopy) { O.exportCopy(P); return true; }
    return false;
  };

  /* ---------- the offline copy: one HTML file with the app, this trip, its photos and sketch maps inside ---------- */
  function text(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing " + u); return r.text(); }); }
  function dataUri(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing " + u); return r.blob(); }).then(function (b) {
      return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { no(fr.error); }; fr.readAsDataURL(b); });
    });
  }
  O.exportCopy = function (P) {
    if (O.copyState === "making" || !P || !P.stops.length) return Promise.resolve();
    O.copyState = "making"; O.copyErr = ""; W.changed();
    var seed = { at: Date.now(), S: null, C: null, photos: W.photosSnapshot ? W.photosSnapshot() : null, blobs: {}, maps: {} };
    return Promise.all([text("index.html"), text("app.min.css"), text("app.js")]).then(function (r) {
      var html = r[0], css = r[1], js = r[2];
      /* fonts become data URIs inside the stylesheet */
      var fonts = []; css.replace(/url\((fonts\/[^)]+)\)/g, function (m, u) { if (fonts.indexOf(u) < 0) fonts.push(u); return m; });
      return Promise.all(fonts.map(dataUri)).then(function (ds) {
        fonts.forEach(function (u, i) { css = css.split("url(" + u + ")").join("url(" + ds[i] + ")"); });
        /* the photos the trip shows */
        var list = photoUrls(P);
        return Promise.all(list.map(function (u) { return dataUri(u).then(function (d) { seed.blobs[u] = d; }, function () {}); }));
      }).then(function () {
        /* sketch maps for the trip's cities (the detailed packs need a worker, which a file can't start) */
        var slugs = [];
        (P.stops || []).forEach(function (s) { var hb = W.homebase(s.country, s.name), c = W.stopAt ? W.stopAt(s) : null, lat = hb && hb.lat != null ? hb.lat : c && c.lat, lng = hb && hb.lng != null ? hb.lng : c && c.lng; var sl = W.sketchFor && lat != null ? W.sketchFor(s.country, s.name, lat, lng) : null; if (sl && slugs.indexOf(sl) < 0) slugs.push(sl); });
        return Promise.all(slugs.map(function (sl) { return fetch("maps/" + sl + ".json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) seed.maps[sl] = j; }, function () {}); })).then(function () { return W.sketchIndex ? W.sketchIndex() : null; }).then(function (idx) { if (idx) seed.mapIndex = idx; });
      }).then(function () {
        seed.S = JSON.parse(JSON.stringify(W.S)); seed.C = JSON.parse(JSON.stringify(W.C));
        /* (replacement text goes in as a function: code and JSON are full of "$" sequences String.replace would expand) */
        var styleTag = "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
        var scriptTags = "<script>window.__WP_OFFLINE=" + JSON.stringify(seed).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--") + "</script>\n<script>" + js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--") + "</script>";
        var page = html
          .replace(/<link rel="preload"[^>]*>\s*/g, "")
          .replace('<link rel="stylesheet" href="app.min.css">', function () { return styleTag; })
          .replace('<script src="app.js" charset="utf-8"></script>', function () { return scriptTags; });
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
