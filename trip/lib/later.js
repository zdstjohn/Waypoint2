/* Waypoint's second script (app2.js, with its styles in app2.css): the parts no first screen needs (Plan, drawing the street map, the packing list, the Prepare screen, the booking
   autopilot, place search in Explore, the kids' corner, the journal and recap, family hearts and comments, trip settings)
   load once the first screen is up, so the phone has
   less to read before it can draw anything. A view that needs one of them before it has arrived asks for it at once
   (W.needLater) and draws when it comes. The offline copy carries both scripts inline (window.__WP_LATER). */
(function () {
  "use strict";
  var W = window.W;
  /* in an offline copy the second script is inline, right after the first: it counts as ready once it has run (its last
     line says so and draws again). Until v118 it counted as ready at once, and a copy reopened on Prepare called a
     screen that wasn't there yet and stopped the page's start-up. */
  W.laterReady = false;
  /* the second script brings its screens' styles (app2.css): the screens count as ready when both have come, so none
     is drawn unstyled. A stylesheet that fails (or takes over 6 s) never holds the screens back. */
  var cssDone = !!window.__WP_LATER,
    jsDone = false,
    cssAsked = false;
  /* ---------- the desktop workspace (v153): its stylesheet, and whether it is on ----------
     On a window 1024px wide or more the app is a workspace of panes (lib/desk.js, screens/rail.js, lib/deskmap.js).
     Its stylesheet, app.desk.css, is the whole of app.css with every width rule following the pane the app is drawn
     in, not the window (build/bundle.js deskCss); once it is in, the two phone stylesheets are switched off, so only
     one set of rules is ever in force. It is fetched only by a wide window (a phone never asks for it), and the page
     is held back until it and the second script are here, so the old layout never flashes first. A copy that cannot
     get it (the offline file, a failed request) keeps the layout it had. */
  var html = document.documentElement,
    mq = typeof window.matchMedia === "function" && !window.__WP_LATER ? window.matchMedia("(min-width:1024px)") : null,
    deskCss = "idle";
  /** the workspace is on: a wide window, its stylesheet in force, its code here */
  W.desk = function () {
    return deskCss === "ready" && !!mq && mq.matches && W.laterReady && !!W.deskOn;
  };
  /** the width the app's screens are drawn in: the window's, or on the workspace the pane's (inside its padding, which
      is what the stylesheet's container rules measure too) */
  W.paneW = function () {
    var w = W.desk() ? /** @type {HTMLElement | null} */ (document.querySelector(".wrap")) : null;
    if (!w || !w.clientWidth) return window.innerWidth;
    var cs = getComputedStyle(w);
    return w.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  };
  function unhold() {
    html.classList.remove("ws-wait");
  }
  function deskSheet() {
    if (deskCss !== "idle" || !mq || !mq.matches) return false;
    deskCss = "loading";
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "app.desk.css";
    l.onload = function () {
      deskCss = "ready";
      /* (the same rules and more, in the same order: the phone sheets step aside) */
      document.querySelectorAll('link[rel="stylesheet"]').forEach(function (x) {
        var h = x.getAttribute("href") || "";
        if (x !== l && /^app(\.min|2)\.css/.test(h)) /** @type {HTMLLinkElement} */ (x).disabled = true;
      });
      cssDone = true;
      ready();
      if (W.laterReady) {
        unhold();
        W.changed();
      }
    };
    l.onerror = function () {
      deskCss = "off";
      unhold();
      if (!cssDone) phoneSheet();
    };
    document.head.appendChild(l);
    return true;
  }
  function phoneSheet() {
    if (cssAsked) return;
    cssAsked = true;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "app2.css";
    if (deskCss === "ready") l.disabled = true;
    l.onload = l.onerror = function () {
      cssDone = true;
      ready();
    };
    setTimeout(function () {
      if (!cssDone) {
        cssDone = true;
        ready();
      }
    }, 6000);
    document.head.appendChild(l);
  }
  /** @type {(() => void)[]} */ var waiting = [];
  function done() {
    if (W.laterReady) return;
    W.laterReady = true;
    W.laterLoading = false;
    unhold();
    var q = waiting;
    waiting = [];
    q.forEach(function (f) {
      try {
        f();
      } catch (e) {
        if (W.caught) W.caught(e, "after the second script");
      }
    });
    W.changed();
  }
  function ready() {
    if (cssDone && jsDone) done();
  }
  /* (an offline copy's inline second script says so itself, in its last line) */
  W.laterDone = done;
  /** run this once the second script is here: at once when it is, otherwise it is asked for and this waits for it */
  W.whenLater = function (fn) {
    if (W.laterReady) return fn();
    waiting.push(fn);
    W.loadLater();
  };
  W.loadLater = function () {
    if (W.laterReady || W.laterLoading || window.__WP_LATER) return;
    W.laterLoading = true;
    /* a wide window gets the workspace's stylesheet in place of app2.css (it holds those rules too) */
    if (!cssDone && deskCss === "idle" && !deskSheet()) phoneSheet();
    else if (!cssDone && deskCss === "off") phoneSheet();
    setTimeout(function () {
      if (!cssDone) {
        cssDone = true;
        unhold();
        ready();
      }
    }, 6000);
    var s = document.createElement("script");
    s.src = "app2.js";
    s.charset = "utf-8";
    s.async = true;
    s.onload = function () {
      jsDone = true;
      ready();
    };
    s.onerror = function () {
      W.laterLoading = false;
      setTimeout(W.loadLater, 4000);
    };
    document.head.appendChild(s);
  };
  /* for a view that can't wait: true when ready; otherwise asks for it and the view shows a moment's "Loading…" */
  W.needLater = function () {
    if (!W.laterReady) W.loadLater();
    return W.laterReady;
  };
  /* after the first screen has painted (watched for, not guessed), on the next idle moment; a page that never paints
     (opened in a background tab) still gets it after a few seconds */
  if (!W.laterReady && !window.__WP_LATER) {
    var go = function () {
      W.loadLater();
    };
    var idle = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1500 });
      else setTimeout(go, 200);
    };
    var watching = false;
    try {
      if (window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).indexOf("paint") > -1) {
        new PerformanceObserver(function (list, obs) {
          if (
            list.getEntries().some(function (e) {
              return e.name === "first-contentful-paint";
            })
          ) {
            obs.disconnect();
            idle();
          }
        }).observe({ type: "paint", buffered: true });
        watching = true;
      }
    } catch (e) {}
    if (!watching) idle();
    setTimeout(go, 4000);
  }
  /* a wide window: ask for the workspace at once and hold the page until it is here (3 s at most); a window made wide
     later (a tablet turned, a browser window stretched) gets it then */
  if (mq) {
    if (mq.matches) {
      html.classList.add("ws-wait");
      setTimeout(unhold, 3000);
      W.loadLater();
    }
    var widened = function () {
      if (mq && mq.matches && deskCss === "idle") deskSheet();
      W.changed();
    };
    if (mq.addEventListener) mq.addEventListener("change", widened);
    else if (mq.addListener) mq.addListener(widened);
  }
})();
