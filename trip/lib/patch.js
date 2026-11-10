/* Waypoint: redraw only what changed.
   A screen used to be thrown away and rebuilt (innerHTML) on every change, even when a photo arriving for another day
   changed nothing on it: every picture was decoded again, the street map was pulled out and put back (a blank moment),
   a text box lost what was being typed, and the scroll position of a row of pills started over.
   W.draw(el, html, sig) keeps the screen that is there:
     - the same HTML as last time: nothing is touched at all;
     - the same screen (sig) with different HTML: the new HTML is parsed aside and the live page is edited to match it,
       node by node: text and attributes that differ are set, nodes that came or went are added or removed, the rest
       stays (pictures, the map inside .vt-slot, focus, scrolling);
     - another screen (another day, another view), or no sig: rebuilt as before.
   What the page shows afterwards is exactly the new HTML; only how it gets there differs. */
(function () {
  "use strict";
  var W = window.W;
  /** @param {any} n */
  function key(n) { return n.nodeType === 1 ? n.id || n.getAttribute("data-key") || "" : ""; }
  /** @param {any} n */
  function kind(n) { var c = n.getAttribute("class") || "", i = c.indexOf(" "); return i < 0 ? c : c.slice(0, i); }
  /** the same thing, before and after? (same tag, same id, same leading class) @param {any} a @param {any} b */
  function same(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    return a.nodeName === b.nodeName && key(a) === key(b) && kind(a) === kind(b);
  }
  /** @param {any} a @param {any} b */
  function attrs(a, b) {
    var i, n, ba = b.attributes, aa = a.attributes;
    for (i = ba.length - 1; i >= 0; i--) { n = ba[i]; if (a.getAttribute(n.name) !== n.value) a.setAttribute(n.name, n.value); }
    if (aa.length !== ba.length) for (i = aa.length - 1; i >= 0; i--) { n = aa[i]; if (!b.hasAttribute(n.name)) a.removeAttribute(n.name); }
  }
  /** @param {any} a @param {any} b */
  function node(a, b) {
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    var tag = a.nodeName, field = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    /* a box being typed in keeps its text, unless the app itself set a new one (cleared it after sending, say) */
    var typing = field && a === document.activeElement && (tag === "TEXTAREA" ? a.defaultValue === b.defaultValue : a.getAttribute("value") === b.getAttribute("value"));
    attrs(a, b);
    if (a.classList.contains("vt-slot")) return;   /* the street map lives in here: lib/vtmap.js owns it */
    kids(a, b);
    if (field && !typing) {
      if (tag === "INPUT" && (a.type === "checkbox" || a.type === "radio")) { if (a.checked !== b.checked) a.checked = b.checked; }
      else if (a.value !== b.value) a.value = b.value;
    }
  }
  /** @param {any} a @param {any} b */
  function kids(a, b) {
    var ac = a.firstChild, bc = b.firstChild, bn, k, m, x;
    while (bc) {
      bn = bc.nextSibling;
      if (!ac) { a.appendChild(bc); bc = bn; continue; }
      if (same(ac, bc)) { node(ac, bc); ac = ac.nextSibling; bc = bn; continue; }
      /* a node with an id that is further along: bring it here */
      k = key(bc); m = null;
      if (k) for (m = ac.nextSibling; m; m = m.nextSibling) if (same(m, bc)) break;
      if (m) { a.insertBefore(m, ac); node(m, bc); bc = bn; continue; }
      /* the old one went away (the next old one is this new one) */
      x = ac.nextSibling;
      if (x && !key(ac) && same(x, bc)) { a.removeChild(ac); ac = x; continue; }
      /* a new one came in (the old one is the next new one), or it was replaced */
      if (bn && same(ac, bn)) a.insertBefore(bc, ac);
      else { a.replaceChild(bc, ac); ac = x; }
      bc = bn;
    }
    while (ac) { x = ac.nextSibling; a.removeChild(ac); ac = x; }
  }
  var tpl = null;
  /** make el's content match html, keeping what is the same @param {HTMLElement} el @param {string} html */
  W.patch = function (el, html) {
    if (!tpl) tpl = document.createElement("template");
    tpl.innerHTML = html;
    kids(el, tpl.content);
    tpl.innerHTML = "";
  };
  /** is someone typing in a box that a redraw would wipe? A box on a screen drawn with W.draw keeps its text, so data
      arriving (search results, photos) may redraw that screen; elsewhere (Plan, Prepare) a redraw waits for the box to lose focus */
  W.typingHeld = function () {
    var a = /** @type {any} */ (document.activeElement);
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    for (var n = a; n; n = n.parentElement) if (n._sig) return false;
    return true;
  };
  W.drawn = { same: 0, patched: 0, rebuilt: 0 };   /* counted for the tests */
  /** draw a screen; sig names which screen it is (a day, a view): only the same screen is edited in place
      @param {any} el @param {string} html @param {string} [sig] @returns {boolean} whether anything was touched */
  W.draw = function (el, html, sig) {
    if (sig && el._sig === sig && el.firstChild) {
      if (el._html === html) { W.drawn.same++; return false; }
      try { W.patch(el, html); W.drawn.patched++; el._html = html; return true; } catch (e) { if (W.logError) W.logError("draw: " + (e && /** @type {any} */ (e).message), "patch"); }
    }
    el.innerHTML = html; el._sig = sig || null; el._html = sig ? html : null; W.drawn.rebuilt++;
    return true;
  };
})();
