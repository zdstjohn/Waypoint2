/* Waypoint's second script (app2.js, with its styles in app2.css): the parts no first screen needs (Plan, drawing the street map, the packing list, the Prepare screen, the booking
   autopilot, place search in Explore, the kids' corner, the recap, family hearts and comments, trip settings)
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
    if (!w || !w.clientWidth) return heldW >= 0 ? heldW : window.innerWidth;
    var cs = getComputedStyle(w);
    return w.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  };
  /** a redraw starting: the window's width read now, before the redraw changes anything on the page, and used for the
      rest of it. Reading it halfway through makes the browser lay out the page there and then (the width never depends
      on what is on the page: only the window, or the workspace's pane, which is measured as before) */
  var heldW = -1;
  W.holdPaneW = function () {
    if (heldW >= 0) return;
    heldW = window.innerWidth;
    Promise.resolve().then(function () {
      heldW = -1;
    });
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
  /* ---------- taps that land before the second script ----------
     Most of what a tap DOES comes with the second script (screens/flowacts.js, screens/tripacts.js): it registers its
     click handlers through W.onClickLater. A tap that landed before it arrived is kept and handed to those handlers
     once it is here, in the order a click reaches them (the capturing ones first, and none after one that stopped
     it): nothing is lost, it only answers a moment later. */
  /** @type {Event[]} */ var early = [];
  /** @type {{ fn: (e: any) => void, cap: boolean }[]} */ var late = [];
  document.addEventListener(
    "click",
    function (e) {
      if (!W.laterReady && early.length < 8) early.push(e);
    },
    true
  );
  W.onClickLater = function (fn, capture) {
    document.addEventListener("click", fn, !!capture);
    late.push({ fn: fn, cap: !!capture });
  };
  function replay() {
    var taps = early;
    early = [];
    taps.forEach(function (e) {
      late
        .filter(function (h) {
          return h.cap;
        })
        .concat(
          late.filter(function (h) {
            return !h.cap;
          })
        )
        .some(function (h) {
          try {
            h.fn(e);
          } catch (err) {
            if (W.caught) W.caught(err, "a tap from before the second script");
          }
          return e.cancelBubble;
        });
    });
  }
  /* ---------- pieces: parts of the app in files of their own (v181) ----------
     What only some windows or some moments need rides in neither script: it is a file of its own, app.<name>.js
     (build/bundle.js PIECES), fetched when it is needed. A piece's file hands its code to W.piece.
       "desk"  the desktop workspace's code: fetched by a window 1024px wide or more, alongside app.desk.css; a phone
               never downloads it. Its code is run once the second script has run, whichever of the two files
               arrives first: it may count on the second script, and the two can be on their way together.
       "ask"   the questions to Claude, word for word, and what is done with each answer (lib/core.js W.run): fetched
               the moment a question is first asked, and otherwise by itself once the first screen is up, with the
               second script. It needs only the first script (FREE), so it runs as soon as it arrives.
     The pieces a page waits for before it counts as ready are in `must` (a wide window waits for "desk", so the
     workspace is there when the page is shown); a piece that cannot be fetched stops being waited for, and is asked
     for again every few seconds. */
  /** @type {Record<string, number>} */ var FREE = { ask: 1 };
  /** @type {Record<string, "loading" | "held" | "in" | undefined>} */ var pcs = {};
  /** @type {Record<string, () => void>} */ var heldRun = {};
  /** @type {string[]} */ var must = [];
  /* (the installable app's files carry its version in their address, so a new version is never mixed with an old one) */
  var sa = /** @type {any} */ (window).__WP_STANDALONE,
    ver = sa && sa.v ? "?v=" + sa.v : "";
  function pieceIn(name) {
    pcs[name] = "in";
    /* (the questions that waited for their words go out now; nothing on the screen changes by their arriving) */
    if (name === "ask") {
      if (W.asksIn) W.asksIn();
      return;
    }
    if (!W.laterReady) ready();
    else if (W.changedApart) W.changedApart();
    else W.changed();
  }
  /** a piece's file has arrived: run its code now, or as soon as the second script has run */
  W.piece = function (name, run) {
    if (pcs[name] === "in" || pcs[name] === "held") return;
    if (!FREE[name] && !jsDone && !window.__WP_LATER) {
      pcs[name] = "held";
      heldRun[name] = run;
      return;
    }
    run();
    pieceIn(name);
  };
  /** is this piece here (its code has run)? */
  W.pieceIn = function (name) {
    return pcs[name] === "in";
  };
  /** every piece that was asked for is here (none is on its way) */
  W.piecesIn = function () {
    return Object.keys(pcs).every(function (k) {
      return !pcs[k] || pcs[k] === "in";
    });
  };
  /** ask for a piece (once; the second script is asked for with it, unless the piece does not need it) */
  W.loadPiece = function (name) {
    if (pcs[name] || window.__WP_LATER) return;
    pcs[name] = "loading";
    var s = document.createElement("script");
    s.src = "app." + name + ".js" + ver;
    s.charset = "utf-8";
    s.async = true;
    s.onerror = function () {
      pcs[name] = undefined;
      must = must.filter(function (m) {
        return m !== name;
      });
      ready();
      setTimeout(function () {
        W.loadPiece(name);
      }, 4000);
    };
    document.head.appendChild(s);
    if (!FREE[name]) W.loadLater();
  };
  /* (the second script has run: the pieces that came before it run now, in the order they were asked for) */
  function runHeld() {
    Object.keys(heldRun).forEach(function (name) {
      var run = heldRun[name];
      delete heldRun[name];
      try {
        run();
      } catch (e) {
        if (W.caught) W.caught(e, "the piece " + name);
      }
      pcs[name] = "in";
    });
  }
  /** @type {(() => void)[]} */ var waiting = [];
  function done() {
    if (W.laterReady) return;
    W.laterReady = true;
    W.laterLoading = false;
    unhold();
    /* (the kept taps first: the handlers that watch a tap before the screen acts on it see it first, as they would have) */
    replay();
    var q = waiting;
    waiting = [];
    q.forEach(function (f) {
      try {
        f();
      } catch (e) {
        if (W.caught) W.caught(e, "after the second script");
      }
    });
    /* (drawn with it in later tasks: running the second script, planning with it and drawing were one stretch of
       ~0.5-0.9 s on a slow phone just after the first screen, where a tap waited; see W.changedApart) */
    if (W.changedApart) W.changedApart();
    else W.changed();
  }
  function ready() {
    if (
      cssDone &&
      jsDone &&
      must.every(function (m) {
        return pcs[m] === "in";
      })
    )
      done();
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
      runHeld();
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
      W.loadPiece("ask");
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
      /* (the workspace's code is a piece of its own: this window needs it before it is shown) */
      must.push("desk");
      W.loadPiece("desk");
      W.loadLater();
    }
    var widened = function () {
      if (mq && mq.matches && deskCss === "idle") deskSheet();
      if (mq && mq.matches) W.loadPiece("desk");
      W.changed();
    };
    if (mq.addEventListener) mq.addEventListener("change", widened);
    else if (mq.addListener) mq.addListener(widened);
  }
})();
