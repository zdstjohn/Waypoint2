/* Where ideas are kept on this device (the audit's R1).
   Until v131 every city's ideas, for every trip ever planned, sat in one browser storage entry (about 5 MB at most),
   written whole whenever data arrived; once full, saving stopped and the app could not recover by itself. Now:
     - IndexedDB "waypoint-ideas" keeps every city and country, one record each, written only when that one changed;
     - the storage entry keeps what the trip on screen uses, so the app still starts without waiting for anything;
     - a city or country that is not in memory is looked for in IndexedDB before Claude is asked again (W.kept);
     - if the entry is refused all the same, it is written again with only this trip's places (W.cacheSlim(true)).
   Where there is no IndexedDB (some private windows, the offline copy) everything stays in the entry, as before. */
(function () {
  "use strict";
  var W = window.W, KINDS = ["city", "country"], db = /** @type {any} */ (null), ok = false;
  var sig = /** @type {Record<string, string>} */ ({}), looked = /** @type {Record<string, number>} */ ({}), keptV = -1, owed = false;
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return s.length + ":" + (h >>> 0).toString(36); }
  var opened = new Promise(function (res) {
    try {
      if (!window.indexedDB || window.__WP_OFFLINE) { res(false); return; }
      var r = indexedDB.open("waypoint-ideas", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("v"); r.result.createObjectStore("sig"); };
      r.onsuccess = function () {
        db = r.result;
        /* what is already kept, by fingerprint: only a place that changed is written again */
        try {
          var tx = db.transaction("sig"), st = tx.objectStore("sig"), keys = st.getAllKeys(), vals = st.getAll();
          tx.oncomplete = function () { (keys.result || []).forEach(function (k, i) { sig[k] = vals.result[i]; }); ok = true; res(true); };
          tx.onerror = tx.onabort = function () { res(false); };
        } catch (e) { res(false); }
      };
      r.onerror = r.onblocked = function () { res(false); };
    } catch (e) { res(false); }
  });

  /* the places the trip on screen uses */
  function inTrip() {
    var S = W.S, city = /** @type {Record<string, number>} */ ({}), country = /** @type {Record<string, number>} */ ({});
    (S.countries || []).forEach(function (c) { country[c.name] = 1; (c.picked || []).forEach(function (n) { city[c.name + "|" + n] = 1; }); });
    (W.P && W.P.stops || []).forEach(function (s) { country[s.country] = 1; city[s.country + "|" + s.name] = 1; });
    Object.keys(S.cityDays || {}).concat(Object.keys(S.stays || {})).forEach(function (k) { city[k] = 1; });
    return { city: city, country: country };
  }
  /* The part of the cache the storage entry holds. A place the trip does not use is left out only once everything in
     memory is safely in IndexedDB as it now stands (keptV); until then, and where there is no IndexedDB, all of it
     stays. force: the entry was refused (full), so the other trips' places are left out regardless; they are still in
     memory, and are asked for (or fetched from your account) when their trip is next opened. */
  W.cacheSlim = function (force) {
    if (!force && (!ok || keptV !== W.dataV)) { owed = ok; return W.C; }
    var use = inTrip(), out = Object.assign({}, W.C), C = /** @type {any} */ (W.C);
    KINDS.forEach(function (kind) {
      var o = /** @type {any} */ ({}); Object.keys(C[kind]).forEach(function (key) { if (use[kind][key]) o[key] = C[kind][key]; });
      /** @type {any} */ (out)[kind] = o;
    });
    owed = false;
    return out;
  };

  /* write what changed since it was last kept: one transaction, each place its own record */
  var writing = false, again = false, t = /** @type {any} */ (null);
  function keep() {
    t = null;
    if (!ok || W.readOnly) return;
    if (writing) { again = true; return; }
    var v0 = W.dataV, todo = /** @type {any[]} */ ([]), C = /** @type {any} */ (W.C);
    KINDS.forEach(function (kind) {
      Object.keys(C[kind]).forEach(function (key) {
        var v = C[kind][key]; if (!v || v.fallback) return;
        var js = JSON.stringify(v), h = hash(js), id = kind + "|" + key;
        if (sig[id] !== h) todo.push([id, js, h]);
      });
    });
    if (!todo.length) { done(true); return; }
    writing = true;
    try {
      var tx = db.transaction(["v", "sig"], "readwrite"), a = tx.objectStore("v"), b = tx.objectStore("sig");
      todo.forEach(function (x) { a.put(x[1], x[0]); b.put(x[2], x[0]); });
      tx.oncomplete = function () { todo.forEach(function (x) { sig[x[0]] = x[2]; }); writing = false; done(true); };
      tx.onerror = tx.onabort = function () { writing = false; done(false); };
    } catch (e) { writing = false; done(false); }
    function done(good) {
      if (good) keptV = v0;
      if (again) { again = false; keep(); return; }
      /* everything is kept: the entry can now leave out what this trip does not use */
      if (good && owed && keptV === W.dataV && W.cacheDirty) { W.cacheDirty(); W.save(); }
    }
  }
  function soon() { if (ok && !t && keptV !== W.dataV) t = setTimeout(keep, 1500); }   /* (only when data has arrived since everything was kept) */
  if (W.onData) W.onData(soon);
  opened.then(function (yes) { if (yes) t = setTimeout(keep, 2500); });

  /* Is this place kept on the device? Looked for once per visit. true: it is being looked for, so wait: `again` is
     called if it is not there (then ask as usual); if it is, it is put in memory and the page redraws. */
  W.kept = function (kind, key, again) {
    var id = kind + "|" + key, C = /** @type {any} */ (W.C);
    if (looked[id] === 2 || C[kind][key]) return false;
    if (looked[id] === 1) return true;
    if (db === null && window.__WP_OFFLINE) return false;
    looked[id] = 1;
    opened.then(function (yes) {
      if (!yes) return null;
      return new Promise(function (res) {
        try { var r = db.transaction("v").objectStore("v").get(id); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; } catch (e) { res(null); }
      });
    }).then(function (js) {
      looked[id] = 2;
      var v = null; try { v = typeof js === "string" ? JSON.parse(js) : null; } catch (e) {}
      if (v && typeof v === "object" && !C[kind][key]) { C[kind][key] = v; if (W.arrived) W.arrived(); } else again();
    });
    return true;
  };
  W.ideaStore = { ready: opened, keep: keep, isOn: function () { return ok; }, keptAll: function () { return ok && keptV === W.dataV && !writing; } };
})();
