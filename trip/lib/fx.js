/* Waypoint motion: sections slide open and closed, pages and days turn like pages, changed picks give a small pulse.
   Everything is skipped for people who ask their device for reduced motion. */
(function () {
  "use strict";
  var W = window.W;
  var EASE = "cubic-bezier(.2,.8,.2,1)",
    EASE_IN = "cubic-bezier(.4,0,.6,1)";
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function off() {
    return reduce.matches || !Element.prototype.animate;
  }
  W.fxOff = off;

  /* run something right after the next redraw (the redraw replaces the page, so animations start on the new elements) */
  var after = [];
  W.fxAfter = function (fn) {
    after.push(fn);
  };
  W.fxRunAfter = function () {
    var a = after;
    after = [];
    a.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        W.caught(e, "after a redraw");
      }
    });
  };
  function q(sel) {
    return typeof sel === "string" ? document.querySelector(sel) : sel;
  }

  /* the space a grid or flex column leaves between children, so a growing panel doesn't jump by that gap */
  function gapAbove(el) {
    var p = el.parentElement;
    if (!p || !el.previousElementSibling) return 0;
    var cs = getComputedStyle(p);
    if (!/grid|flex/.test(cs.display) || (/flex/.test(cs.display) && !/column/.test(cs.flexDirection))) return 0;
    return parseFloat(cs.rowGap) || 0;
  }
  function frames(el) {
    var cs = getComputedStyle(el),
      g = gapAbove(el);
    return [
      {
        height: "0px",
        paddingTop: "0px",
        paddingBottom: "0px",
        marginTop: -g + "px",
        marginBottom: "0px",
        opacity: 0,
        transform: "translateY(-6px)"
      },
      {
        height: el.offsetHeight + "px",
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        opacity: 1,
        transform: "none"
      }
    ];
  }
  /* grow a panel open, pushing what's below down smoothly, and bring it into view if it opened off screen */
  W.fxExpand = function (sel, opts) {
    var el = q(sel);
    opts = opts || {};
    if (!el || off()) return;
    var f = frames(el),
      ov = el.style.overflow;
    el.style.overflow = "hidden";
    var a = el.animate(f, { duration: opts.dur || 300, easing: EASE });
    a.onfinish = a.oncancel = function () {
      el.style.overflow = ov;
      if (opts.reveal !== false) {
        var r = el.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8)
          el.scrollIntoView({ block: r.height > window.innerHeight * 0.8 ? "start" : "nearest", behavior: "smooth" });
      }
    };
  };
  /* fold a panel shut, then do the change (which redraws without it) */
  W.fxCollapse = function (sel, done, opts) {
    var el = q(sel);
    opts = opts || {};
    if (!el || off()) {
      done();
      return;
    }
    var f = frames(el).reverse(),
      called = false;
    el.style.overflow = "hidden";
    var a = el.animate(f, { duration: opts.dur || 220, easing: EASE_IN, fill: "forwards" });
    function fin() {
      if (!called) {
        called = true;
        done();
      }
    }
    a.onfinish = fin;
    setTimeout(fin, (opts.dur || 220) + 120); /* never leave the change undone */
  };
  /* cards or list items arriving one after another */
  W.fxStagger = function (els, opts) {
    if (off()) return;
    opts = opts || {};
    Array.prototype.slice
      .call(typeof els === "string" ? document.querySelectorAll(els) : els || [])
      .slice(0, opts.max || 24)
      .forEach(function (el, i) {
        el.animate(
          [
            { opacity: 0, transform: "translateY(" + (opts.y || 10) + "px)" },
            { opacity: 1, transform: "none" }
          ],
          { duration: opts.dur || 320, delay: Math.min(i * (opts.step || 35), 420), easing: EASE, fill: "backwards" }
        );
      });
  };

  /* something just changed (a new pick, a chosen lodging): a quick squash-and-settle */
  W.fxPulse = function (sel) {
    var el = q(sel);
    if (!el || off()) return;
    el.animate(
      [
        { transform: "scale(.97)", opacity: 0.55 },
        { transform: "scale(1.012)", opacity: 1, offset: 0.55 },
        { transform: "none", opacity: 1 }
      ],
      { duration: 420, easing: EASE }
    );
  };

  /* page turns: between Plan and My trip ("page"), and from day to day ("day"). dir 1 = forward, -1 = back */
  /* A page turn snapshots the whole screen before its first frame. On a slow phone that takes long enough to make the
     tap feel sluggish, so: a modest phone (4 GB or 4 cores or less) never turns pages, and any phone that takes over
     120 ms to the first frame of a turn changes pages plainly from then on. The decoration gives way to the response. */
  var flipping = false,
    slowFlips =
      (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
        ? 1
        : 0;
  /* after (optional) runs once the new page is in place and done moving: the place to scroll to a spot on it */
  W.fxFlip = function (kind, dir, update, after) {
    if (off() || flipping) {
      update();
      if (after) after();
      return;
    }
    if (kind === "page" && W.fxEnter) W.fxEnter();
    var root = document.documentElement;
    /* a modest or slow phone skips the snapshot (below) but still gets a light slide of the new page: opacity and a few
       pixels, which the phone's compositor does without redrawing anything */
    if (slowFlips >= 1) {
      update();
      var el0 = kind === "day" ? document.querySelector(".dayflip") : document.querySelector("main:not([hidden])");
      if (el0 && el0.animate)
        el0.animate(
          [
            { opacity: 0, transform: "translateX(" + (dir < 0 ? -14 : 14) + "px)" },
            { opacity: 1, transform: "none" }
          ],
          { duration: 220, easing: EASE }
        );
      if (after) after();
      return;
    }
    if (document.startViewTransition) {
      flipping = true;
      root.classList.add("vt-" + kind);
      root.setAttribute("data-flip", dir < 0 ? "back" : "fwd");
      var t,
        t0 = performance.now();
      try {
        t = document.startViewTransition(function () {
          update();
        });
      } catch (e) {
        flipping = false;
        root.classList.remove("vt-" + kind);
        update();
        if (after) after();
        return;
      }
      var done = function () {
        flipping = false;
        root.classList.remove("vt-" + kind);
        root.removeAttribute("data-flip");
        if (after) after();
      };
      t.ready.then(
        function () {
          if (performance.now() - t0 > 120) slowFlips++;
          else slowFlips = Math.max(0, slowFlips - 1);
        },
        function () {}
      );
      t.finished.then(done, done);
      return;
    }
    /* browsers without page transitions: slide the new page in */
    update();
    var el = kind === "day" ? document.querySelector(".dayflip") : document.querySelector("main:not([hidden])");
    var an = el
      ? el.animate(
          [
            { opacity: 0, transform: "translateX(" + (dir < 0 ? -22 : 22) + "px)" },
            { opacity: 1, transform: "none" }
          ],
          { duration: 300, easing: EASE }
        )
      : null;
    if (after) {
      if (an && an.finished) an.finished.then(after, after);
      else after();
    }
  };

  /* for a transition made in the second script (a stop's card growing into its sheet: screens/sheet.js): is this one
     given the plain change (reduced motion, no such transition in this browser, a modest or slow phone, a turn
     already running), and the turn's start and end (with how long its first frame took, which is how "slow" is learned) */
  W.fxPlain = function () {
    return off() || flipping || slowFlips >= 1 || !document.startViewTransition;
  };
  W.fxTurn = function (on, ms) {
    flipping = on;
    if (ms > 120) slowFlips++;
  };

  /* folding sections (<details>): slide open and closed instead of snapping */
  document.addEventListener(
    "click",
    function (e) {
      var s = e.target && e.target.closest && e.target.closest("summary"),
        d = s && s.parentElement;
      if (!d || d.tagName !== "DETAILS") return;
      if (off()) {
        /* no sliding (reduced motion): the browser folds it. The choice is remembered now all the same: it used to wait
           for the browser's own notice a moment later, and a redraw in between put the section back as it was */
        if (W.saveFold) W.saveFold(d, !d.open);
        return;
      }
      e.preventDefault();
      if (d.getAttribute("data-moving")) return;
      var start = d.offsetHeight,
        ov = d.style.overflow;
      d.setAttribute("data-moving", "1");
      d.style.overflow = "hidden";
      var opening = !d.open,
        end;
      if (opening) {
        d.open = true;
        end = d.offsetHeight;
      } else {
        d.open = false;
        end = d.offsetHeight;
        d.open = true;
      }
      if (W.saveFold) W.saveFold(d, opening); /* remember it now, so a redraw mid-animation keeps it the way you chose */
      var body = Array.prototype.slice.call(d.children, 1),
        det = d; /* (the section found above, for fin below) */
      var a = d.animate([{ height: start + "px" }, { height: end + "px" }], {
        duration: opening ? 340 : 260,
        easing: opening ? EASE : EASE_IN
      });
      body.forEach(function (el, i) {
        el.animate(
          opening
            ? [
                { opacity: 0, transform: "translateY(-6px)" },
                { opacity: 1, transform: "none" }
              ]
            : [{ opacity: 1 }, { opacity: 0 }],
          { duration: opening ? 300 : 180, delay: opening ? Math.min(60 + i * 30, 240) : 0, easing: EASE, fill: "both" }
        );
      });
      function fin() {
        if (!det.getAttribute("data-moving")) return;
        det.removeAttribute("data-moving");
        det.style.overflow = ov;
        if (!opening) det.open = false;
        body.forEach(function (el) {
          el.getAnimations().forEach(function (x) {
            x.cancel();
          });
        });
      }
      a.onfinish = fin;
      setTimeout(fin, (opening ? 340 : 260) + 150);
    },
    true
  );
})();

/* a screen just opened (a tab, the first load): for a moment the page carries "view-enter", and what arrives then moves
   in once (the readiness ring fills, a day's photo settles). Later redraws of the same screen don't replay it. */
(function () {
  var W = window.W,
    t = 0;
  W.fxEnter = function () {
    if (W.fxOff && W.fxOff()) return;
    var r = document.documentElement;
    r.classList.add("view-enter");
    clearTimeout(t);
    t = setTimeout(function () {
      r.classList.remove("view-enter");
    }, 1500);
  };
})();
