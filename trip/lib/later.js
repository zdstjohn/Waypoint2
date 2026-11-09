/* Waypoint's second script (app2.js, with its styles in app2.css): the parts no first screen needs (Plan, drawing the street map, the packing list, the Prepare screen, the booking
   autopilot, place search in Explore, the kids' corner, the journal and recap, family hearts and comments, trip settings)
   load once the first screen is up, so the phone has
   less to read before it can draw anything. A view that needs one of them before it has arrived asks for it at once
   (W.needLater) and draws when it comes. The offline copy carries both scripts inline (window.__WP_LATER). */
(function () {
  "use strict";
  var W = window.W;
  W.laterReady = !!window.__WP_LATER;
  /* the second script brings its screens' styles (app2.css): the screens count as ready when both have come, so none
     is drawn unstyled. A stylesheet that fails (or takes over 6 s) never holds the screens back. */
  var cssDone = !!window.__WP_LATER, jsDone = false, cssAsked = false;
  function ready() { if (cssDone && jsDone && !W.laterReady) { W.laterReady = true; W.laterLoading = false; W.changed(); } }
  W.loadLater = function () {
    if (W.laterReady || W.laterLoading) return;
    W.laterLoading = true;
    if (!cssAsked && !cssDone) {
      cssAsked = true;
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "app2.css";
      l.onload = l.onerror = function () { cssDone = true; ready(); };
      setTimeout(function () { if (!cssDone) { cssDone = true; ready(); } }, 6000);
      document.head.appendChild(l);
    }
    var s = document.createElement("script"); s.src = "app2.js"; s.charset = "utf-8"; s.async = true;
    s.onload = function () { jsDone = true; ready(); };
    s.onerror = function () { W.laterLoading = false; setTimeout(W.loadLater, 4000); };
    document.head.appendChild(s);
  };
  /* for a view that can't wait: true when ready; otherwise asks for it and the view shows a moment's "Loading…" */
  W.needLater = function () { if (!W.laterReady) W.loadLater(); return W.laterReady; };
  /* after the first screen has painted (watched for, not guessed), on the next idle moment; a page that never paints
     (opened in a background tab) still gets it after a few seconds */
  if (!W.laterReady) {
    var go = function () { W.loadLater(); };
    var idle = function () { if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 200); };
    var watching = false;
    try {
      if (window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).indexOf("paint") > -1) {
        new PerformanceObserver(function (list, obs) {
          if (list.getEntries().some(function (e) { return e.name === "first-contentful-paint"; })) { obs.disconnect(); idle(); }
        }).observe({ type: "paint", buffered: true });
        watching = true;
      }
    } catch (e) {}
    if (!watching) idle();
    setTimeout(go, 4000);
  }
})();
