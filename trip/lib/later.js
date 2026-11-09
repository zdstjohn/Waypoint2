/* Waypoint's second script (app2.js): the parts no first screen needs (the packing list, the kids' corner, the
   journal and recap, family hearts and comments, trip settings) load once the first screen is up, so the phone has
   less to read before it can draw anything. A view that needs one of them before it has arrived asks for it at once
   (W.needLater) and draws when it comes. The offline copy carries both scripts inline (window.__WP_LATER). */
(function () {
  "use strict";
  var W = window.W;
  W.laterReady = !!window.__WP_LATER;
  W.loadLater = function () {
    if (W.laterReady || W.laterLoading) return;
    W.laterLoading = true;
    var s = document.createElement("script"); s.src = "app2.js"; s.charset = "utf-8"; s.async = true;
    s.onload = function () { W.laterReady = true; W.laterLoading = false; W.changed(); };
    s.onerror = function () { W.laterLoading = false; setTimeout(W.loadLater, 4000); };
    document.head.appendChild(s);
  };
  /* for a view that can't wait: true when ready; otherwise asks for it and the view shows a moment's "Loading…" */
  W.needLater = function () { if (!W.laterReady) W.loadLater(); return W.laterReady; };
  if (!W.laterReady) {
    var go = function () { W.loadLater(); };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 600);
  }
})();
