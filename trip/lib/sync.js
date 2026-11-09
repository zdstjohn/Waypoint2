/* Waypoint saved trips: several trips, kept in your own private space so they follow you to every device,
   and view-only copies you can share with family by a short code. */
(function () {
  "use strict";
  var W = window.W, $ = W.$, esc = W.esc, S = W.S;
  /* how you're looking at a trip on this device; never synced */
  var VIEW_KEYS = ["day", "transitOpen", "stepClosed", "tripFolded", "mapZoom", "jetOpen", "late", "glanceOpen", "nextHide", "appMode", "appModeAt", "tview", "exF", "exSort", "prepTab"];
  /* yours only: never in a shared copy */
  var PRIVATE = ["bookings", "booked", "exported", "mailSeen", "mine", "seen", "lodgeSeen", "share", "tripId"];
  function lget(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rid(n, abc) { abc = abc || "abcdefghijkmnpqrstuvwxyz23456789"; var s = ""; for (var i = 0; i < n; i++) s += abc.charAt(Math.floor(Math.random() * abc.length)); return s; }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return s.length + ":" + (h >>> 0).toString(36); }
  function syncable(st) { var o = clone(st); VIEW_KEYS.forEach(function (k) { delete o[k]; }); return o; }
  W.syncable = syncable; W.VIEW_KEYS = VIEW_KEYS;

  var dev = lget("waypoint-dev") || rid(10); lset("waypoint-dev", dev);
  var idx = lget("waypoint-trips-v1") || {};   /* id -> {name, updated, state (for trips other than the open one)} */
  if (!S.tripId) S.tripId = "t" + rid(11);
  function meta() { return idx[S.tripId] || (idx[S.tripId] = { name: W.tripName(), updated: W.isExample ? 0 : Date.now() }); }
  function saveIdx() { lset("waypoint-trips-v1", idx); }

  W.tripName = function () {
    if (S.tripName) return S.tripName;
    var c = (S.countries || []).map(function (x) { return x.name; });
    return c.length ? c.slice(0, 3).join(" & ") + " trip" : "New trip";
  };
  meta(); saveIdx();

  /* put another trip's state in place (the page's modules all hold this same object) */
  function replaceState(ns) {
    var keep = {}; VIEW_KEYS.forEach(function (k) { if (k in S) keep[k] = S[k]; });
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.assign(S, clone(ns));
    Object.keys(keep).forEach(function (k) { if (!(k in S)) S[k] = keep[k]; });
    if (W.replan) W.replan();   /* a different trip (and possibly a different cache): plan it afresh */
    S.v = 2; S.algo = 2;
    ["stays", "picks", "seen", "cityDays"].forEach(function (k) { if (!S[k] || typeof S[k] !== "object") S[k] = {}; });
    if (!Array.isArray(S.countries)) S.countries = [];
    if (!Array.isArray(S.travelers)) S.travelers = [];
    if (!Array.isArray(S.styles)) S.styles = [];
  }
  function cityKeys() {
    var out = {};
    (W.P && W.P.stops || []).forEach(function (s) { out[W.cityKey(s.country, s.name)] = 1; });
    (S.countries || []).forEach(function (c) { (c.mode === "manual" ? c.picked || [] : []).forEach(function (n) { out[W.cityKey(c.name, n)] = 1; }); });
    return Object.keys(out);
  }
  function slugOf(ck) { return W.slug(ck.replace("|", " ")); }

  /* two copies of a city's ideas: keep everything from both (your picks refer to names in either) */
  function mergePool(a, b) {
    if (!a) return clone(b); if (!b) return a;
    var out = Object.assign({}, b, a);
    ["spots", "food", "lodging", "stay"].forEach(function (k) {
      if (!Array.isArray(a[k]) && !Array.isArray(b[k])) return;
      var by = {}, list = [];
      (a[k] || []).forEach(function (x) { var n = W.norm(x.n); by[n] = x; list.push(x); });
      (b[k] || []).forEach(function (x) {
        var n = W.norm(x.n), mine = by[n];
        if (!mine) { var c = clone(x); by[n] = c; list.push(c); return; }
        Object.keys(x).forEach(function (f) { if (mine[f] === undefined || mine[f] === null || mine[f] === "") mine[f] = clone(x[f]); });
      });
      out[k] = list;
    });
    return out;
  }

  /* ---------- the database ---------- */
  var db = null, uid = null, col = null, pcol = null, canWrite = true;
  var st = "local";   /* local | connecting | synced | saving | error | full */
  var remote = {}, firstSnap = false, lastSig = null;
  function baseline() { lastSig = hash(JSON.stringify(syncable(S))); appliedAt = Date.now(); }
  /* only changes you make get sent: the planner filling in picks on its own is redone on every device anyway,
     and sending those would overwrite what you just changed somewhere else */
  var touched = 0;
  ["click", "change", "input"].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.isTrusted !== false) touched = Date.now(); }, true); });
  /* a new device waits a moment for your saved ideas before asking Claude for new ones */
  function release() { W.releaseLoads(); }
  var appliedAt = 0;   /* when another device's version last replaced this one */
  var psig = lget("waypoint-poolsync-v1") || {}, shareSig = lget("waypoint-sharesync-v1") || {};
  var q = [], busy = false;
  function enqueue(path, fn) {
    var j = q.filter(function (x) { return x.path === path; })[0];
    if (j) j.fn = fn; else q.push({ path: path, fn: fn });
    pumpQ();
  }
  function pumpQ() {
    if (busy || !q.length) { if (!busy && st === "saving") { st = "synced"; bar(); } return; }
    busy = true; var j = q.shift(); if (st !== "error" && st !== "full") { st = "saving"; bar(); }
    Promise.resolve().then(j.fn).then(function () { if (st === "saving" || st === "error") st = "synced"; }, function (e) {
      var c = e && e.code;
      if (c === "quota_exceeded") st = "full";
      else if (c === "resource_exhausted" || c === "unavailable") { st = "error"; setTimeout(function () { enqueue(j.path, j.fn); }, 15000 + Math.random() * 5000); }
      else st = "error";
    }).then(function () { busy = false; bar(); pumpQ(); });
  }
  function tripBody(id) {
    var isCur = id === S.tripId, m = idx[id] || {}, state = isCur ? syncable(S) : m.state;
    if (!state) return null;
    /* the country lists behind suggested cities, so another device suggests the same places */
    var cc = {};
    (state.countries || []).forEach(function (c) { if (c.mode !== "manual" && W.C.country[c.name]) cc[c.name] = W.C.country[c.name]; });
    return clone({ name: isCur ? W.tripName() : m.name || "Trip", updated: m.updated || Date.now(), dev: dev, state: state, cc: cc, legs: isCur ? tripLegs() : {} });
  }
  function pushTrip(id) {
    if (!col || !canWrite) return;
    enqueue("trip/" + id, function () { var b = tripBody(id); if (!b) return; if (JSON.stringify(b).length > 250000) delete b.cc; return col.doc(id).set(b); });
  }
  function pushPools() {
    if (!pcol || !canWrite) return;
    cityKeys().forEach(function (ck) {
      var pool = W.C.city[ck]; if (!pool || pool.fallback) return;
      var s = JSON.stringify(pool), sg = hash(s), sl = slugOf(ck);
      if (psig[sl] === sg || s.length > 240000) return;
      enqueue("pool/" + sl, function () {
        var cur = W.C.city[ck]; if (!cur) return;
        var body = { k: ck, updated: Date.now(), pool: JSON.parse(JSON.stringify(cur)) }, now = hash(JSON.stringify(cur));
        return pcol.doc(sl).set(body).then(function () { psig[sl] = now; lset("waypoint-poolsync-v1", psig); });
      });
    });
  }
  /* fetch ideas for this trip's cities that this device doesn't have (or has fewer of) */
  var fetched = {};
  function pullPools() {
    if (!pcol) return;
    cityKeys().forEach(function (ck) {
      var sl = slugOf(ck); if (fetched[sl]) return; fetched[sl] = 1;
      pcol.doc(sl).get().then(function (snap) {
        if (!snap.exists) return;
        var r = (snap.data() || {}).pool; if (!r) return;
        var loc = W.C.city[ck], merged = mergePool(loc && !loc.fallback ? loc : null, r);
        W.C.city[ck] = merged;
        if (hash(JSON.stringify(merged)) === hash(JSON.stringify(r))) { psig[sl] = hash(JSON.stringify(merged)); lset("waypoint-poolsync-v1", psig); }
        W.changed();
      }, function () { fetched[sl] = 0; });
    });
  }
  /* the travel options between this trip's places (so your chosen way matches on every device) */
  function tripLegs() {
    var out = {}, st = W.P && W.P.stops || [];
    st.forEach(function (s, i) { if (!i) return; var k = W.legKey(st[i - 1], s); if (W.C.legs[k]) out[k] = W.C.legs[k]; });
    return out;
  }
  function takeLegs(legs) { if (legs) Object.keys(legs).forEach(function (k) { var c = W.C.legs[k]; if (!c || (c.v || 0) < (legs[k].v || 0)) W.C.legs[k] = clone(legs[k]); }); }
  function applyRemote(id, b) {
    if (b.cc) Object.keys(b.cc).forEach(function (n) { if (!W.C.country[n]) W.C.country[n] = clone(b.cc[n]); });
    takeLegs(b.legs);
    if (W.readOnly && ro && id === ro.S.tripId) {   /* your own trip changed elsewhere while you look at a shared one */
      ro.S = clone(b.state); ro.S.tripId = id; idx[id] = { name: b.name, updated: b.updated }; saveIdx(); return;
    }
    if (id === S.tripId && !W.readOnly) {
      replaceState(b.state); S.tripId = id;
      idx[id] = { name: b.name, updated: b.updated }; saveIdx();
      baseline(); fetched = {};
      W.isExample = false; W.changed(); pullPools();
    } else { idx[id] = { name: b.name, updated: b.updated, state: clone(b.state) }; saveIdx(); }
  }
  function onTrips(snap) {
    snap.docs.forEach(function (d) {
      var b = d.data(); if (!b || !b.state) return;
      remote[d.id] = { name: b.name, updated: b.updated || 0 };
      var loc = idx[d.id];
      /* newer than this device's copy: another device changed it (our own writes carry our own time, so they never look newer) */
      if (!loc || (b.updated || 0) > (loc.updated || 0)) applyRemote(d.id, b);
    });
    snap.docChanges().forEach(function (c) {
      if (c.type !== "removed") return;
      delete remote[c.doc.id];
      if (c.doc.id !== S.tripId && idx[c.doc.id] && !c.doc.metadata.hasPendingWrites) { delete idx[c.doc.id]; saveIdx(); }
    });
    if (!firstSnap && !snap.metadata.fromCache) {
      firstSnap = true; setTimeout(release, 2500);
      /* a new device still showing the example: open your most recent trip */
      var ids = Object.keys(remote).sort(function (a, b) { return remote[b].updated - remote[a].updated; });
      if (W.isExample && ids.length && ids[0] !== S.tripId) {
        var exId = S.tripId; openTrip(ids[0], true);
        if (!idx[exId] || !idx[exId].updated) { delete idx[exId]; saveIdx(); }
      }
      /* trips saved on this device before syncing existed */
      Object.keys(idx).forEach(function (id) {
        if (!idx[id].updated && id === S.tripId && W.isExample) return;   /* the untouched example stays on this device */
        if (!remote[id] || (idx[id].updated || 0) > remote[id].updated) pushTrip(id);
      });
      pullPools();
    }
    if (st === "connecting") st = "synced";
    bar(); if (menuOpen) W.render();
  }

  try {
    if (window.claude && window.claude.use) {
      st = "connecting";
      Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
        db = r[0]; var user = r[1];
        if (!db || !user) { st = "local"; release(); bar(); return; }
        return Promise.all([user.id(), user.can("data.write").catch(function () { return null; })]).then(function (u) {
          uid = u[0]; if (u[1] === false) canWrite = false;
          if (!uid) { st = "local"; release(); bar(); return; }
          col = db.doc("data/users/" + uid + "/trips").collection("t");
          pcol = db.doc("data/users/" + uid + "/pools").collection("p");
          var timer = setTimeout(function () { if (!firstSnap) { st = "error"; release(); bar(); } }, 10000);
          setTimeout(release, 6000);
          col.onSnapshot(function (snap) { if (!snap.metadata.fromCache) clearTimeout(timer); onTrips(snap); }, function () { st = "error"; bar(); });
        });
      }).catch(function () { st = "local"; release(); bar(); });
    }
  } catch (e) { st = "local"; }
  if (st === "connecting") W.holdLoads = true;

  /* every save: note real changes, then write them a moment later (one write per pause) */
  var tickT = null;
  W.afterSave = function () {
    if (W.readOnly) return;
    clearTimeout(tickT); tickT = setTimeout(tick, 1500);
  };
  function tick() {
    if (W.readOnly) return;
    var sig = hash(JSON.stringify(syncable(S)));
    if (lastSig == null) lastSig = sig;
    else if (sig !== lastSig) {
      lastSig = sig;
      if (Date.now() - touched < 120000 && touched > appliedAt) {
        var m = meta(); m.updated = Date.now(); m.name = W.tripName(); saveIdx();
        if (firstSnap) pushTrip(S.tripId);
        pushShare();
      }
    }
    if (firstSnap) { pushPools(); pushSharePools(); pullPools(); }
  }

  /* ---------- trips ---------- */
  function keepCurrent() { var cur = meta(); cur.state = syncable(S); cur.name = W.tripName(); }
  function openTrip(id, quiet, dropCur) {
    var t = idx[id]; if (!t || !t.state || id === S.tripId) return;
    if (!dropCur) keepCurrent();
    replaceState(t.state); S.tripId = id; S.day = 1; delete t.state;
    baseline(); fetched = {}; W.isExample = false; saveIdx();
    if (!quiet) menuOpen = false;
    W.save(); W.changed(); pullPools();
  }
  function newTrip(dropCur) {
    if (!dropCur) keepCurrent();
    var id = "t" + rid(11);
    replaceState({ v: 2, algo: 2, styles: (S.styles || []).slice(), countries: [], days: 7, start: "", depart: S.depart || "", travelers: (S.travelers || []).slice(),
      stays: {}, picks: {}, seen: {}, cityDays: {}, tripId: id, tripName: "" });
    S.day = 1; idx[id] = { name: "New trip", updated: Date.now() }; saveIdx();
    baseline(); W.isExample = false; menuOpen = false;
    if (firstSnap) pushTrip(id);
    W.setView("setup"); W.save(); W.changed();
  }
  W.newTripBlank = function () { newTrip(); };
  /* a whole new trip from an imported plan */
  W.newTripFrom = function (state) {
    keepCurrent();
    var id = "t" + rid(11);
    replaceState(Object.assign({}, state, { tripId: id }));
    S.day = 1; idx[id] = { name: S.tripName || "Imported trip", updated: Date.now() }; saveIdx();
    baseline(); W.isExample = false; menuOpen = false;
    if (firstSnap) pushTrip(id);   /* saved to your account straight away */
    W.setView("setup"); W.save(); W.changed();
    W.fxAfter(function () { window.scrollTo(0, 0); });
  };
  function deleteTrip(id) {
    var t = idx[id] || {}, code = id === S.tripId ? S.share : t.state && t.state.share;
    delete idx[id]; saveIdx();
    if (col) enqueue("trip/" + id, function () { return col.doc(id).delete(); });
    if (code && db) enqueue("share/" + code, function () { return db.doc("shared/" + code).delete(); });
    if (id === S.tripId) {
      var rest = Object.keys(idx).filter(function (k) { return idx[k].state; }).sort(function (a, b) { return (idx[b].updated || 0) - (idx[a].updated || 0); });
      if (rest.length) openTrip(rest[0], false, true);
      else newTrip(true);
    }
  }

  /* ---------- view-only sharing ---------- */
  function sharedState() {
    var P = W.P, o = syncable(S); PRIVATE.forEach(function (k) { delete o[k]; });
    /* freeze the route: the viewer sees exactly these places and days, with no country lists needed */
    var groups = [];
    (P && P.stops || []).forEach(function (s) {
      var g = groups[groups.length - 1];
      if (!g || g.name !== s.country) groups.push(g = { name: s.country, mode: "manual", picked: [] });
      g.picked.push(s.name);
    });
    o.countries = groups; o.cityDays = {};
    (P && P.stops || []).forEach(function (s) { o.cityDays[W.cityKey(s.country, s.name)] = s.days; });
    return o;
  }
  function pushShare() {
    var code = S.share; if (!code || !db || !canWrite) return;
    var body = { name: W.tripName(), owner: uid, legs: tripLegs(), state: sharedState(), cities: (W.P && W.P.stops || []).map(function (s) { return slugOf(W.cityKey(s.country, s.name)); }) };
    var sg = hash(JSON.stringify(body)); if (shareSig[code] === sg) return;
    body.updated = Date.now();
    enqueue("share/" + code, function () { return db.doc("shared/" + code).set(clone(body)).then(function () { shareSig[code] = sg; lset("waypoint-sharesync-v1", shareSig); }); });
  }
  function pushSharePools() {
    var code = S.share; if (!code || !db || !canWrite) return;
    cityKeys().forEach(function (ck) {
      var pool = W.C.city[ck]; if (!pool || pool.fallback) return;
      var s = JSON.stringify(pool), sg = hash(s), k = code + "/" + slugOf(ck);
      if (shareSig[k] === sg || s.length > 240000) return;
      enqueue("sharepool/" + k, function () {
        return db.doc("shared/" + code + "/pools/" + slugOf(ck)).set({ k: ck, pool: JSON.parse(s) }).then(function () { shareSig[k] = sg; lset("waypoint-sharesync-v1", shareSig); });
      });
    });
  }
  function startShare() {
    if (!db) return;
    S.share = rid(6, "abcdefghjkmnpqrstuvwxyz23456789"); shareMsg = "";
    W.save(); pushShare(); pushSharePools();
  }
  function stopShare() {
    var code = S.share; if (!code) return;
    delete S.share;
    if (db) enqueue("share/" + code, function () { return db.doc("shared/" + code).delete(); });
    W.save();
  }

  /* opening someone's shared trip */
  var ro = null, roUnsub = null, shareMsg = "", opening = false;
  var seenShares = lget("waypoint-shared-seen-v1") || [];
  function rememberShare(code, name) {
    seenShares = seenShares.filter(function (x) { return x.code !== code; });
    seenShares.unshift({ code: code, name: name }); seenShares = seenShares.slice(0, 8); lset("waypoint-shared-seen-v1", seenShares);
  }
  function loadSharedPools(code, cities, force) {
    (cities || []).forEach(function (sl) {
      db.doc("shared/" + code + "/pools/" + sl).get().then(function (snap) {
        if (!snap.exists || !W.readOnly || W.readOnly.code !== code) return;
        var b = snap.data() || {}; if (b.k && b.pool) { W.C.city[b.k] = clone(b.pool); W.changed(); }
      }, function () {});
    });
  }
  function openShared(code) {
    code = String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!db) { shareMsg = "Shared trips need this page open in the Claude app."; bar(); return; }
    if (code.length < 6) { shareMsg = "Codes are 6 letters and numbers."; bar(); return; }
    opening = true; shareMsg = ""; bar();
    db.doc("shared/" + code).get().then(function (snap) {
      opening = false;
      if (!snap.exists) { shareMsg = "No shared trip with that code. It may have been stopped."; bar(); return; }
      var b = snap.data() || {};
      if (!W.readOnly) ro = { S: clone(S), city: W.C.city, example: W.isExample };
      W.readOnly = { code: code, name: b.name || "Shared trip" };
      W.C.city = Object.assign({}, ro.city);
      replaceState(b.state || {}); S.day = 1; W.isExample = false; menuOpen = false; takeLegs(b.legs);
      rememberShare(code, b.name);
      loadSharedPools(code, b.cities);
      var lastUp = b.updated || 0;
      if (roUnsub) roUnsub();
      roUnsub = db.doc("shared/" + code).onSnapshot(function (s2) {
        if (!W.readOnly || W.readOnly.code !== code) return;
        if (!s2.exists) { W.readOnly.gone = true; bar(); return; }
        var b2 = s2.data() || {};
        if ((b2.updated || 0) > lastUp) { lastUp = b2.updated; W.readOnly.name = b2.name || W.readOnly.name; var day = S.day; replaceState(b2.state || {}); S.day = day; takeLegs(b2.legs); loadSharedPools(code, b2.cities); W.changed(); }
      }, function () {});
      W.setView("trip"); W.changed();
    }, function () { opening = false; shareMsg = "Couldn't open that trip just now. Try again."; bar(); });
  }
  function closeShared() {
    if (!W.readOnly) return;
    if (roUnsub) { roUnsub(); roUnsub = null; }
    W.readOnly = null;
    if (ro) { W.C.city = ro.city; replaceState(ro.S); W.isExample = ro.example; ro = null; }
    baseline(); W.changed();
  }

  /* ---------- the trip bar ---------- */
  var menuOpen = false, renaming = false, delAsk = null;
  /* the trips menu drops down over the page: a tap anywhere else closes it */
  W.closeTripMenu = function () { if (!menuOpen) return false; menuOpen = false; renaming = false; delAsk = null; W.renderBar(W.P); return true; };
  var ST = { local: "Saved on this device", connecting: "Connecting…", synced: "Saved to your account", saving: "Saving…", error: "Can't reach your account right now; saved on this device", full: "Your account's storage for this app is full" };
  var ago = W.ago;
  function bar() { if (W.P) W.renderBar(W.P); }
  W.renderBar = function () {
    var el = $("tripbar"); if (!el) return;
    W.keepInputs(el, function () { drawBar(el); });
  };
  /* how far off the trip is (or where in it you are), for the header: "5 months to go", "Day 4 of 20" */
  W.countdown = function (P) {
    if (!P || !P.stops || !P.stops.length) return null;
    var N = P.N;
    if (!S.start || !W.dayOfDate) return { big: String(N), small: N === 1 ? "day" : "days", line: N + " days" };
    var n = W.dayOfDate(W.isoDay(W.now()));
    if (n >= 1 && n <= N) return { big: "Day " + n, small: "of " + N, line: "Day " + n + " of " + N };
    if (n > N) return { big: "Back", small: "home", line: "Back home" };
    var d = 1 - n;
    if (d === 1) return { big: "1", small: "day to go", line: "Tomorrow" };
    if (d <= 14) return { big: String(d), small: "days to go", line: d + " days to go" };
    if (d <= 60) { var w = Math.round(d / 7); return { big: String(w), small: "weeks to go", line: w + " weeks to go" }; }
    var m = Math.round(d / 30.4); return { big: String(m), small: (m === 1 ? "month" : "months") + " to go", line: m + (m === 1 ? " month" : " months") + " to go" };
  };
  function countHtml(cd) { return cd ? '<span class="ts-c"><b>' + esc(cd.big) + "</b><span>" + esc(cd.small) + "</span></span>" : ""; }
  function drawBar(el) {
    var cd = W.countdown(W.P), tl = $("topline");
    if (tl) tl.innerHTML = W.topLine ? W.topLine(W.P) : "";
    if (W.readOnly) {
      el.innerHTML = '<div class="tripbar ro-bar"><div class="trip-sw ro-sw"><span class="ts-n"><b>' + esc(W.readOnly.name) + "</b></span>" + countHtml(cd) + "</div>" +
        '<span class="ro-note">' + (W.readOnly.gone ? "No longer shared · the last version" : "Shared trip · view only") + "</span>" +
        '<button type="button" class="ro-back" data-sync="close">Back to my trips</button></div>';
      return;
    }
    var ids = Object.keys(idx).sort(function (a, b) { return (idx[b].updated || 0) - (idx[a].updated || 0); });
    var h = '<div class="tripbar"><button type="button" class="trip-sw" data-sync="menu" aria-expanded="' + menuOpen + '" aria-label="Your trips: ' + esc(W.tripName() + (cd ? ". " + cd.line : "")) + '">' +
      '<span class="ts-n"><b>' + esc(W.tripName()) + "</b>" + '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>' + "</span>" + countHtml(cd) + "</button>" +
      (st === "error" || st === "full" ? '<span class="sync-st small bad" role="status" title="' + esc(ST[st]) + '"><span class="st-l" aria-hidden="true">' + (st === "full" ? "Storage full" : "Not synced") + '</span><span class="vh">' + esc(ST[st]) + "</span></span>" : "") + "</div>";
    if (menuOpen) {
      h += '<div class="trip-menu sk"><h3>Your trips</h3><ul class="trips">' + ids.map(function (id) {
        var cur = id === S.tripId, t = idx[id], nm = cur ? W.tripName() : t.name || "Trip";
        var days = cur ? S.days : t.state && t.state.days;
        return '<li><button type="button" data-sync="open" data-id="' + esc(id) + '"' + (cur ? ' aria-current="true"' : "") + "><b>" + esc(nm) + '</b><span class="small muted">' + esc([days ? days + " days" : "", cur ? "open now" : ago(t.updated)].filter(Boolean).join(" · ")) + "</span></button>" +
          (delAsk === id ? '<button type="button" class="btn sm warnbtn" data-sync="delyes" data-id="' + esc(id) + '">Delete it</button><button type="button" class="linkish" data-sync="delno">Keep</button>'
            : '<button type="button" class="icon-btn" data-sync="del" data-id="' + esc(id) + '" aria-label="Delete ' + esc(nm) + '" title="Delete">×</button>') + "</li>";
      }).join("") + "</ul>" +
        '<div class="row"><button type="button" class="btn quiet" data-sync="new">+ New trip</button>' +
        (renaming ? '<input class="field" id="tripNameIn" value="' + esc(W.tripName()) + '" aria-label="Trip name" maxlength="60"><button type="button" class="btn quiet" data-sync="savename">Save</button>'
          : '<button type="button" class="linkish" data-sync="rename">Rename this trip</button>') + "</div>" +
        (W.P && W.P.stops && W.P.stops.length ? '<button type="button" class="tm-set" data-sync="kids"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"/></svg>' +
          '<span><b>For the kids</b><span class="small muted">Their day in big photos, a passport and treasure hunts</span></span></button>' : "") +
        (W.P && W.P.stops && W.P.stops.length ? '<button type="button" class="tm-set" data-sync="story"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5C8.2 4.2 5.7 3.8 3 4.2v11.3c2.7-.4 5.2 0 7 1.3 1.8-1.3 4.3-1.7 7-1.3V4.2c-2.7-.4-5.2 0-7 1.3zM10 5.5v11.3"/></svg>' +
          '<span><b>Storybook</b><span class="small muted">The whole trip, a page a day, with photos</span></span></button>' : "") +
        '<button type="button" class="tm-set" data-sync="settings"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>' +
        '<span><b>Import a plan</b><span class="small muted">' + "From Wanderlog, a document or an email</span></span></button>" +
        '<div class="tm-sharebox"><h3>Share with family</h3>' + (W.shareBlock ? W.shareBlock() : "") + "</div>";
      h += '<div class="share"><h3>Open a shared trip</h3><div class="row"><input class="field code" id="openCode" placeholder="Code" maxlength="8" aria-label="Share code to open" autocapitalize="off" autocomplete="off" spellcheck="false"><button type="button" class="btn quiet" data-sync="openshare">' + (opening ? "Opening…" : "Open") + "</button></div>" +
        (shareMsg ? '<p class="warn">' + esc(shareMsg) + "</p>" : "") +
        (seenShares.length ? '<ul class="trips">' + seenShares.map(function (x) { return '<li><button type="button" data-sync="openshare" data-code="' + esc(x.code) + '"><b>' + esc(x.name || x.code) + '</b><span class="small muted">' + esc(x.code) + "</span></button></li>"; }).join("") + "</ul>" : "") + "</div></div>";
    }
    el.innerHTML = h;
  }
  /* Trip settings: sharing this trip, view-only, with family */
  W.shareBlock = function () {
    if (W.readOnly) return "";
    if (!db || !uid) return '<p class="small muted">Sharing works when this page is open in the Claude app.</p>';
    if (!canWrite) return '<p class="small muted">You can view shared trips here, but your access to this page doesn\'t allow sharing.</p>';
    if (S.share) return '<p class="small">They can view this trip (not change it) with the code</p><div class="row"><input class="field code" id="shareCode" readonly value="' + esc(S.share) + '" aria-label="Share code"><button type="button" class="btn quiet" data-sync="copy">Copy</button><button type="button" class="linkish" data-sync="unshare">Stop sharing</button></div>' +
      '<p class="small muted">Send them this page from the Share menu at the top. They tap the trip name ▸ Open a shared trip and enter the code. Your bookings and checklist stay private.</p>';
    return '<p class="small muted">Family see your plan, live, and can\'t change it. Bookings stay private.</p><button type="button" class="btn quiet" data-sync="share">Share view-only</button>';
  };
  /* redraw a part of the page without losing what's typed in its boxes */
  W.keepInputs = function (el, draw) {
    var vals = {}, act = document.activeElement, aid = act && el.contains(act) && act.id, sel = null;
    Array.prototype.forEach.call(el.querySelectorAll("input[id],select[id]"), function (i) { if (i.type !== "date" || i.value) vals[i.id] = i.value; });
    try { if (aid && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch (e) {}
    draw();
    Object.keys(vals).forEach(function (id) { var i = document.getElementById(id); if (i && el.contains(i) && !i.readOnly) i.value = vals[id]; });
    if (aid) { var n = document.getElementById(aid); if (n) { n.focus(); try { if (sel) n.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  };

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-sync]"); if (!b) return;
    var a = b.dataset.sync, id = b.dataset.id;
    e.preventDefault();
    if (a === "menu") { menuOpen = !menuOpen; renaming = false; delAsk = null; if (menuOpen) W.fxAfter(function () { W.fxExpand(".trip-menu", { reveal: false }); }); W.render(); return; }
    if (a === "close") { closeShared(); return; }
    if (a === "settings") { menuOpen = false; renaming = false; delAsk = null; if (W.goView) W.goView("settings"); return; }
    if (a === "kids") { menuOpen = false; renaming = false; delAsk = null; if (W.goView) W.goView("kids"); return; }
    if (a === "story") { menuOpen = false; renaming = false; delAsk = null; S.tview = "story"; S.glanceOpen = false; W.save(); if (W.goView) W.goView("trip"); window.scrollTo(0, 0); return; }
    if (a === "open") { if (id !== S.tripId) W.fxFlip("page", 1, function () { openTrip(id); }); else { menuOpen = false; W.render(); } return; }
    if (a === "new") { if (W.quickStart) { menuOpen = false; W.renderBar(W.P); W.quickStart(); return; } W.fxFlip("page", -1, function () { newTrip(); }); return; }
    if (a === "rename") { renaming = true; W.render(); var inp = $("tripNameIn"); if (inp) { inp.focus(); inp.select(); } return; }
    if (a === "savename") { var v = ($("tripNameIn") || {}).value; S.tripName = String(v || "").trim().slice(0, 60); renaming = false; W.save(); W.render(); return; }
    if (a === "del") { delAsk = id; W.render(); return; }
    if (a === "delno") { delAsk = null; W.render(); return; }
    if (a === "delyes") { delAsk = null; deleteTrip(id); W.render(); return; }
    if (a === "share") { startShare(); W.render(); return; }
    if (a === "unshare") { stopShare(); W.render(); return; }
    if (a === "copy") {
      var ci = $("shareCode"); if (!ci) return;
      var done = function () { b.textContent = "Copied"; setTimeout(function () { if (b.isConnected) b.textContent = "Copy"; }, 1600); };
      try { navigator.clipboard.writeText(ci.value).then(done, function () { ci.select(); }); } catch (x) { ci.select(); }
      return;
    }
    if (a === "openshare") { openShared(b.dataset.code || ($("openCode") || {}).value); return; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target || !e.target.closest || !e.target.closest("#tripbar")) return;
    e.preventDefault(); e.stopPropagation();
    if (e.target.id === "tripNameIn") { var s = document.querySelector('[data-sync="savename"]'); if (s) s.click(); }
    if (e.target.id === "openCode") { var o = document.querySelector('[data-sync="openshare"]'); if (o) o.click(); }
  }, true);
})();
