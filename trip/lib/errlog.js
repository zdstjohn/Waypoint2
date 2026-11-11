/* Waypoint error log: what goes wrong on a real phone, kept privately in the viewer's own corner of the app's
   database (data/users/<you>/errlog/d/<day>), so it can be read back and fixed. One document a day, at most 40 distinct
   errors in it (a repeat only counts up), written at most every 15 seconds. Nothing personal goes in: the message,
   where in the app it happened, which screen, the app's build, the browser and the screen width. Never in the
   offline copy or a shared trip's read-only view. */
(function () {
  "use strict";
  var W = window.W;
  var BUILD = "__BUILD__";              /* the build time, filled in by build/bundle.js */
  var db = null, uid = null, buf = [], timer = null, busy = false, seen = {};
  function short(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function browser() {
    var u = navigator.userAgent || "", os = /Android ([\d.]+)/.exec(u), ios = /OS (\d+)_\d+.*like Mac OS X/.exec(u), ch = /Chrome\/(\d+)/.exec(u), sf = /Version\/(\d+).*Safari/.exec(u), ff = /Firefox\/(\d+)/.exec(u);
    return [os ? "Android " + os[1] : ios ? "iOS " + ios[1] : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "",
      ch ? "Chrome " + ch[1] : sf ? "Safari " + sf[1] : ff ? "Firefox " + ff[1] : ""].filter(Boolean).join(" · ");
  }
  /* the first lines of the stack, with the page's address taken out (only the file and position matter) */
  function frames(st) { return short(String(st || "").split("\n").slice(0, 4).map(function (l) { return l.trim().replace(/https?:\/\/[^\s)]*\/([^/\s)]+)/g, "$1"); }).join(" | "), 400); }
  W.logError = function (msg, where, stack) {
    if (window.__WP_OFFLINE || W.readOnly) return;
    var m = short(msg, 300), key = m + "|" + where;
    if (seen[key]) { seen[key].n++; schedule(); return; }
    if (Object.keys(seen).length >= 40) return;
    var e = { t: Date.now(), msg: m, at: short(where, 120), stack: frames(stack), view: W.currentView ? W.currentView() : "", tv: (W.S && W.S.tview) || "", build: BUILD, ua: browser(), w: window.innerWidth || 0, on: navigator.onLine !== false, n: 1 };
    seen[key] = e; buf.push(e); schedule();
  };
  function schedule() { if (!timer) timer = setTimeout(flush, 15000); }
  function day() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function flush() {
    timer = null;
    if (!db || !uid || busy) { if (buf.length || Object.keys(seen).length) schedule(); return; }
    busy = true;
    var ref;
    try { ref = db.doc("data/users/" + uid + "/errlog").collection("d").doc(day()); }
    catch (e) { busy = false; return; }   /* never let the log itself become the error */
    ref.get().then(function (snap) {
      var cur = snap && snap.exists ? snap.data() || {} : {}, items = Array.isArray(cur.items) ? cur.items.slice() : [];
      Object.keys(seen).forEach(function (k) {
        var e = seen[k], i = -1;
        items.forEach(function (x, j) { if (x && x.msg === e.msg && x.at === e.at) i = j; });
        if (i > -1) { items[i].n = (items[i].n || 1) + (e.n - (e.sent || 0)); items[i].last = Date.now(); }
        else if (items.length < 40) { var c = {}; Object.keys(e).forEach(function (f) { if (f !== "sent") c[f] = e[f]; }); items.push(c); }
        e.sent = e.n;
      });
      buf = [];
      return ref.set({ items: items, updated: Date.now() });
    }).then(function () { busy = false; }, function () { busy = false; });
  }
  W.flushErrors = flush;
  window.addEventListener("error", function (ev) {
    if (!ev || (!ev.message && !ev.error)) return;   /* a picture or script that failed to load is not an app error */
    W.logError(ev.message || (ev.error && ev.error.message), (ev.filename || "").replace(/^.*\//, "") + ":" + (ev.lineno || 0) + ":" + (ev.colno || 0), ev.error && ev.error.stack);
  });
  window.addEventListener("unhandledrejection", function (ev) {
    var r = ev && ev.reason; if (!r) return;
    /* a connection the viewer didn't allow, or one that isn't there, is not an app error */
    if (r.code && /^(not_granted|server_not_connected|blocked_by_policy|rate_limited|unavailable)$/.test(r.code)) return;
    W.logError("Unhandled: " + (r.message || r.code || String(r)), "promise", r.stack);
  });
  try {
    if (window.claude && window.claude.use && !window.__WP_OFFLINE) {
      Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
        db = r[0]; var user = r[1]; if (!db || !user) return;
        return user.id().then(function (id) { uid = id; if (buf.length) schedule(); });
      }, function () {});
    }
  } catch (e) {}
  /* leaving the page: write what's waiting now rather than in 15 seconds */
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && buf.length) { clearTimeout(timer); flush(); } });
})();
