/* Waypoint, for the keyboard and the screen reader: what every screen needs and no screen does on its own.
   - The keyboard keeps its place. Most taps draw the screen again, and a button that is drawn again is a new button:
     the keyboard's place fell back to the top of the page (a day pill, a tab, a chip, the trips menu). When the control
     that had the keyboard goes away and nothing else takes it, the same control in the new drawing gets it (the same
     id, or the same data-* attributes); inside a sheet that was redrawn, the sheet does; when a sheet closes, what
     opened it does; when the whole screen changed, the new screen does (its <main>, named, so a screen reader says
     which screen it is).
   - A sheet over a phone screen (role="dialog", aria-modal) keeps the keyboard and the screen reader in it: the page
     behind is inert while it is open, and Tab goes round inside it.
   - The control the keyboard is on is never left under the tabs pinned to the foot of a phone or the day's bar at its top.
   - Tabs and the one-of-three choices move with the arrow keys (and Home, End), as tabs and radio buttons do.
   - Larger text: from 120% of the usual text size, html.tbig lets the few rows drawn for the usual size wrap (app.css).
   - W.say(text): a short message a screen reader reads out (a change made, an undo offered), from one live region
     that is always on the page (a region drawn with the text already in it is often not read at all). */
(function () {
  "use strict";
  var W = window.W;

  /* ---------- the spoken messages ---------- */
  /** @type {HTMLElement | null} */ var sayEl = null,
    sayTimer = 0;
  W.say = function (text) {
    if (!sayEl) {
      sayEl = document.createElement("div");
      sayEl.id = "wpSay";
      sayEl.className = "vh";
      sayEl.setAttribute("role", "status");
      sayEl.setAttribute("aria-live", "polite");
      document.body.appendChild(sayEl);
    }
    var el = sayEl;
    /* (emptied first and filled a moment later: the same words twice in a row are read twice) */
    el.textContent = "";
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(function () {
      el.textContent = text || "";
    }, 60);
  };

  /* ---------- telling one control from another, across a redraw ---------- */
  var DIALOG = '[role="dialog"]',
    FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  /** @param {Element} el */
  function shown(el) {
    return !!(el.getClientRects().length && !el.closest("[hidden], [inert]"));
  }
  /** what makes this control this one: its id, or its tag with its data-* attributes, or its name
      @param {HTMLElement} el @returns {{id: string, sel: string, label: string, text: string}} */
  function mark(el) {
    var sel = el.tagName.toLowerCase(),
      data = 0;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf("data-") === 0) {
        sel += "[" + a.name + '="' + CSS.escape(a.value) + '"]';
        data++;
      }
    }
    var role = el.getAttribute("role");
    return {
      id: el.id || "",
      sel: data ? sel : "",
      label: el.getAttribute("aria-label")
        ? el.tagName.toLowerCase() + '[aria-label="' + CSS.escape(el.getAttribute("aria-label") || "") + '"]'
        : "",
      text:
        data || el.id
          ? ""
          : el.tagName.toLowerCase() + (role ? '[role="' + role + '"]' : "") + "|" + (el.textContent || "").trim().slice(0, 80)
    };
  }
  /** the control with that mark in the page now, if it is on screen @param {{id: string, sel: string, label: string, text: string}} m */
  function find(m) {
    /** @type {Element | null} */ var n = m.id ? document.getElementById(m.id) : null;
    if (n && shown(n)) return /** @type {HTMLElement} */ (n);
    var all = m.sel ? document.querySelectorAll(m.sel) : m.label ? document.querySelectorAll(m.label) : null;
    if (all) for (var i = 0; i < all.length; i++) if (shown(all[i])) return /** @type {HTMLElement} */ (all[i]);
    if (m.text) {
      var p = m.text.split("|"),
        cand = document.querySelectorAll(p[0]),
        t = p.slice(1).join("|");
      for (var j = 0; j < cand.length; j++)
        if ((cand[j].textContent || "").trim().slice(0, 80) === t && shown(cand[j])) return /** @type {HTMLElement} */ (cand[j]);
    }
    return null;
  }
  /** give the keyboard to an element that is not a control (a sheet, a screen): it takes it, without a ring
      @param {HTMLElement} el */
  function focusBox(el) {
    if (!el.hasAttribute("tabindex")) {
      el.setAttribute("tabindex", "-1");
      el.addEventListener(
        "blur",
        function () {
          el.removeAttribute("tabindex");
        },
        { once: true }
      );
    }
    el.focus({ preventScroll: true });
  }
  /** the sheet over the screen now, if any */
  function openDialog() {
    var all = document.querySelectorAll(DIALOG);
    for (var i = all.length - 1; i >= 0; i--) if (shown(all[i])) return /** @type {HTMLElement} */ (all[i]);
    return null;
  }

  /* ---------- the keyboard keeps its place ---------- */
  /** the controls just after and just before this one in the same screen or sheet, in Tab's order: where to land
      when it went away for good (an "Add" that was done, a suggestion taken) @param {HTMLElement} t */
  function around(t) {
    var box = t.closest("main, " + DIALOG + ", header") || document.body,
      after = [],
      before = [];
    Array.prototype.forEach.call(box.querySelectorAll(FOCUSABLE), function (/** @type {HTMLElement} */ x) {
      if (x === t || t.contains(x) || !shown(x)) return;
      (t.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING ? after : before).push(x);
    });
    return after.slice(0, 3).concat(before.slice(-3).reverse()).map(mark);
  }
  /** @type {{el: HTMLElement, m: ReturnType<typeof mark>, near: ReturnType<typeof mark>[], inDialog: boolean, main: HTMLElement | null} | null} */ var lost =
    null;
  /** @type {HTMLElement | null} */ var outside = null; /* the last control the keyboard was on outside any sheet */
  /** @type {ReturnType<typeof mark> | null} */ var outsideMark = null;
  function nobody() {
    var a = document.activeElement;
    return !a || a === document.body || a === document.documentElement;
  }
  function restore() {
    var l = lost;
    if (!l || !nobody()) return;
    if (l.el.isConnected && shown(l.el)) {
      lost = null; /* a blur of your own (a tap on nothing, another app): not ours to undo */
      return;
    }
    /* (its screen gave way to another: that screen, not a control of the same name elsewhere, such as its tab) */
    var gone = !!(l.main && l.main.hidden && !l.inDialog),
      n = gone ? null : find(l.m),
      d = openDialog();
    /* in a sheet that was drawn again (another of its pages), the sheet; one that closed: what opened it */
    if (!n && d && l.inDialog) n = d;
    if (!n && l.inDialog && !d && outside) n = outside.isConnected && shown(outside) ? outside : outsideMark ? find(outsideMark) : null;
    /* gone for good: the control next to where it was */
    for (var i = 0; !n && !d && !gone && i < l.near.length; i++) n = find(l.near[i]);
    if (!n && d) n = d;
    /* another screen: the screen */
    if (!n) n = /** @type {HTMLElement | null} */ (document.querySelector("main:not([hidden])"));
    if (!n) return;
    lost = null;
    if (n.matches(FOCUSABLE)) n.focus({ preventScroll: true });
    else focusBox(n);
  }
  document.addEventListener("focusin", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (t && t.closest && !t.closest(DIALOG) && t !== document.body) {
      outside = t;
      outsideMark = mark(t);
    }
  });
  document.addEventListener("focusout", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (e.relatedTarget || !t || !t.closest || t === document.body) return;
    lost = {
      el: t,
      m: mark(t),
      near: around(t),
      inDialog: !!t.closest(DIALOG),
      main: /** @type {HTMLElement | null} */ (t.closest("main"))
    };
    /* (the new drawing may come at once, or a moment later: the second script, a sheet that opens after the day is drawn) */
    [0, 150, 450].forEach(function (ms) {
      setTimeout(restore, ms);
    });
  });

  /* ---------- the keyboard's place is in sight ---------- */
  /* On a phone the tabs are pinned to the bottom of the screen and the day's bar to the top: the browser scrolls a
     control the keyboard moves to into the window, but not out from under those. After it has, this does (Tab only:
     a tap is where the finger is). */
  var byKey = false;
  document.addEventListener(
    "keydown",
    function () {
      byKey = true;
    },
    true
  );
  document.addEventListener(
    "pointerdown",
    function () {
      byKey = false;
    },
    true
  );
  /** the bottom edge of what is pinned over the top of the page, and the top edge of what is pinned over its foot */
  function pinned() {
    var top = 0,
      bottom = window.innerHeight;
    Array.prototype.forEach.call(document.querySelectorAll("nav.tabs, #pin, #viewTrip .daybar"), function (/** @type {HTMLElement} */ b) {
      var p = getComputedStyle(b).position;
      if ((p !== "fixed" && p !== "sticky") || !shown(b)) return;
      var r = b.getBoundingClientRect();
      if (r.top > window.innerHeight / 2) bottom = Math.min(bottom, r.top);
      else if (r.top < 120 && r.bottom < window.innerHeight / 2) top = Math.max(top, r.bottom);
    });
    return { top: top, bottom: bottom };
  }
  document.addEventListener("focusin", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (!byKey || !t || !t.closest || t.closest(DIALOG + ", nav.tabs, #pin, .daybar, header")) return;
    setTimeout(function () {
      if (document.activeElement !== t) return;
      var r = t.getBoundingClientRect(),
        p = pinned();
      if (r.height > p.bottom - p.top - 16) return;
      if (r.bottom > p.bottom - 8) window.scrollBy(0, r.bottom - p.bottom + 8);
      else if (r.top < p.top + 8) window.scrollBy(0, r.top - p.top - 8);
    }, 0);
  });

  /* ---------- a sheet keeps the keyboard ---------- */
  /** @type {Element[]} */ var benched = [];
  function modal() {
    var d = openDialog();
    return d && d.getAttribute("aria-modal") === "true" ? d : null;
  }
  /** the page behind an open sheet is inert (a screen reader's swipe and the Tab key stay in the sheet); the spoken
      messages and the undo bar are not behind it */
  function bench() {
    var d = modal(),
      host = d;
    while (host && host.parentElement && host.parentElement !== document.body) host = host.parentElement;
    var want = [];
    if (d && host && host.parentElement === document.body)
      for (var c = document.body.firstElementChild; c; c = c.nextElementSibling)
        if (c !== host && !/^(SCRIPT|STYLE|TEMPLATE|DATALIST|LINK)$/.test(c.tagName) && c.id !== "wpSay" && c.id !== "undohost")
          want.push(c);
    benched.forEach(function (c) {
      if (want.indexOf(c) < 0) /** @type {HTMLElement} */ (c).inert = false;
    });
    want.forEach(function (c) {
      /** @type {HTMLElement} */ (c).inert = true;
    });
    benched = want;
  }
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () {
      queued = false;
      bench();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal", "hidden"] });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
    var d = modal();
    if (!d) return;
    var all = Array.prototype.filter.call(d.querySelectorAll(FOCUSABLE), shown),
      a = document.activeElement;
    if (!all.length) return;
    var first = all[0],
      last = all[all.length - 1];
    if (!d.contains(a) || (e.shiftKey && (a === first || a === d)) || (!e.shiftKey && a === last)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });

  /* ---------- arrows in tabs and in a one-of-several choice ---------- */
  document.addEventListener("keydown", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (!t || !t.getAttribute || e.altKey || e.ctrlKey || e.metaKey) return;
    var role = t.getAttribute("role");
    if (role !== "tab" && role !== "radio") return;
    var group = t.closest(role === "tab" ? '[role="tablist"]' : '[role="radiogroup"]');
    if (!group) return;
    var k = e.key,
      items = Array.prototype.filter.call(group.querySelectorAll('[role="' + role + '"]'), function (/** @type {HTMLElement} */ x) {
        return shown(x) && !x.hasAttribute("disabled");
      }),
      i = items.indexOf(t),
      n = -1;
    if (i < 0 || !items.length) return;
    if (k === "ArrowRight" || (role === "radio" && k === "ArrowDown")) n = (i + 1) % items.length;
    else if (k === "ArrowLeft" || (role === "radio" && k === "ArrowUp")) n = (i - 1 + items.length) % items.length;
    else if (k === "Home") n = 0;
    else if (k === "End") n = items.length - 1;
    if (n < 0) return;
    e.preventDefault();
    var to = /** @type {HTMLElement} */ (items[n]),
      m = mark(to);
    to.click();
    setTimeout(function () {
      var x = to.isConnected && shown(to) ? to : find(m);
      if (x) {
        lost = null;
        x.focus({ preventScroll: true });
      }
    }, 0);
  });

  /* ---------- larger text ---------- */
  /* The type is in rem, so it grows with the phone's or the browser's text size. A few rows drawn for the usual size
     (words kept on one line, choices side by side, a badge on a tab's picture) let go from 120% on (html.tbig), so the
     bigger words fit the screen instead of running off it or over each other. At the usual size nothing changes.
     A probe 1rem wide tells when the size changes, a setting changed with the app open too. */
  var probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:0;top:0;width:1rem;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
  function textSize() {
    var r = probe.getBoundingClientRect().width / 16;
    document.documentElement.classList.toggle("tbig", r >= 1.2);
  }
  document.body.appendChild(probe);
  textSize();
  if (window.ResizeObserver) new ResizeObserver(textSize).observe(probe);
})();
