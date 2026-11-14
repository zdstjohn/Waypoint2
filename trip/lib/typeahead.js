/* Waypoint, choosing a country, a city or an airport as you type. A box marked data-ta ("country", "city" with
   data-tac naming the country, or "airport") shows a short list of matches right under itself once you have typed a
   letter or two: part of the page, so it pushes what is below it down and never sits over the phone's keyboard (the
   browser's own list did, and showed every country the moment the box was tapped). The best known come first. A tap
   on a match fills the box and does what Enter would (adds the country or city); arrow keys and Enter work too;
   Escape or leaving the box closes it. Part of the second script, with Plan and the quick start that use it. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var MAX = 6;
  /** @type {HTMLInputElement | null} */ var box = null;
  /** @type {HTMLElement | null} */ var ul = null;
  /** @type {{v: string, sub: string}[]} */ var items = [];
  var at = -1,
    seq = 0;

  /** what to choose from, best known first @returns {{v: string, sub: string, rank: number}[]} */
  function pool(inp) {
    var kind = inp.dataset.ta;
    if (kind === "country")
      /* the countries with ideas built in first, then the most visited, then every other, by name */
      return (W.countryNames ? W.countryNames() : []).map(function (n) {
        return { v: n, sub: "", rank: W.countryRank(n) };
      });
    if (kind === "airport")
      return (window.AIRPORTS || []).map(function (a, i) {
        return { v: a[0] + " (" + a[1] + ")", sub: "", rank: -i / 1e4 };
      });
    if (kind === "city") {
      var country = inp.dataset.tac || "";
      return W.countryCities(country)
        .filter(function (c) {
          return !c.whole;
        })
        .map(function (c, i) {
          return { v: c.name, sub: c.isl || c.region || "", rank: (c.pop || (W.builtIn(country, c) ? 5 : 2)) - i / 1e4 };
        });
    }
    return [];
  }
  /** the matches for what is typed: names starting with it, then names with a word starting with it, then the rest
      containing it; within each, the best known first */
  function matches(inp) {
    var q = W.norm(inp.value || "");
    if (!q) return [];
    var out = /** @type {{v: string, sub: string, rank: number, g: number}[]} */ ([]);
    pool(inp).forEach(function (o) {
      var n = W.norm(o.v),
        g = n.indexOf(q) === 0 ? 0 : (" " + n).indexOf(" " + q) > -1 ? 1 : n.indexOf(q) > -1 ? 2 : -1;
      if (g > -1 && n !== q) out.push({ v: o.v, sub: o.sub, rank: o.rank, g: g });
    });
    /* a country's other names ("uae", "holland", "burma") find it too */
    if (inp.dataset.ta === "country" && W.countryAliases)
      W.countryAliases().forEach(function (a) {
        var an = W.norm(a[0]);
        if (an.indexOf(q) !== 0 || W.norm(a[1]) === q) return;
        if (
          out.some(function (o) {
            return o.v === a[1];
          })
        )
          return;
        out.push({ v: a[1], sub: "also " + a[0], rank: W.countryRank(a[1]), g: 0 });
      });
    out.sort(function (a, b) {
      return a.g - b.g || b.rank - a.rank || (a.v < b.v ? -1 : 1);
    });
    return out.slice(0, MAX);
  }
  function close() {
    if (ul && ul.parentNode) ul.parentNode.removeChild(ul);
    if (box) {
      box.setAttribute("aria-expanded", "false");
      box.removeAttribute("aria-activedescendant");
    }
    ul = null;
    items = [];
    at = -1;
  }
  function draw(inp) {
    items = matches(inp);
    if (!items.length) return close();
    box = inp;
    if (!inp.id) inp.id = "ta" + ++seq;
    var id = inp.id + "-ta";
    if (!ul || !document.contains(ul)) {
      ul = document.createElement("ul");
      ul.className = "ta-l";
      ul.id = id;
      ul.setAttribute("role", "listbox");
      /* right under the box's own row, in the page's flow */
      var after = /** @type {HTMLElement} */ (inp.closest(".row, .fld") || inp);
      after.insertAdjacentElement("afterend", ul);
    }
    if (at >= items.length) at = items.length - 1;
    ul.innerHTML = items
      .map(function (o, i) {
        return (
          '<li role="option" id="' +
          id +
          i +
          '" aria-selected="' +
          (i === at) +
          '"><button type="button" tabindex="-1" data-tapick="' +
          i +
          '"><b>' +
          esc(o.v) +
          "</b>" +
          (o.sub ? '<span class="muted">' + esc(o.sub) + "</span>" : "") +
          "</button></li>"
        );
      })
      .join("");
    inp.setAttribute("role", "combobox");
    inp.setAttribute("aria-autocomplete", "list");
    inp.setAttribute("aria-controls", id);
    inp.setAttribute("aria-expanded", "true");
    if (at > -1) inp.setAttribute("aria-activedescendant", id + at);
    else inp.removeAttribute("aria-activedescendant");
    /* (a list that would end under the keyboard: the page moves it into view) */
    var vv = window.visualViewport,
      r = ul.getBoundingClientRect(),
      bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
    if (r.bottom > bottom - 8) window.scrollBy(0, Math.min(r.bottom - bottom + 16, r.top - 90));
  }
  /* a match chosen: the box takes it, then does what Enter would (adds the country or the city) */
  function pick(i) {
    var o = items[i],
      inp = box;
    if (!o || !inp) return;
    inp.value = o.v;
    close();
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    var go = inp.dataset.tago;
    if (go) {
      var b = document.getElementById(go);
      if (b) b.click();
    }
  }
  document.addEventListener("input", function (e) {
    var t = /** @type {HTMLInputElement} */ (e.target);
    if (!t || !t.dataset || !t.dataset.ta) return;
    at = -1;
    draw(t);
  });
  document.addEventListener(
    "keydown",
    function (e) {
      var t = /** @type {HTMLInputElement} */ (e.target);
      if (!t || !t.dataset || !t.dataset.ta || !ul || box !== t) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length + 1) % (items.length + 1);
        if (at === items.length) at = -1;
        draw(t);
      } else if (e.key === "Enter" && at > -1) {
        e.preventDefault();
        e.stopPropagation();
        pick(at);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    },
    true
  );
  /* (the press would take the focus out of the box, and leaving the box closes the list before the tap lands) */
  document.addEventListener(
    "pointerdown",
    function (e) {
      var t = /** @type {HTMLElement} */ (e.target);
      if (t && t.closest && t.closest("[data-tapick]")) e.preventDefault();
    },
    true
  );
  document.addEventListener(
    "click",
    function (e) {
      var t = /** @type {HTMLElement} */ (e.target),
        b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-tapick]")) : null;
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      pick(+(b.dataset.tapick || 0));
    },
    true
  );
  document.addEventListener("focusout", function (e) {
    if (e.target !== box) return;
    setTimeout(function () {
      if (box && document.activeElement !== box) close();
    }, 120);
  });
  /* (a box whose screen was drawn again keeps its list) */
  W.taRedraw = function () {
    if (!box || !ul) return;
    if (!document.contains(ul) || !document.contains(box)) {
      var a = /** @type {any} */ (document.activeElement);
      close();
      if (a && a.dataset && a.dataset.ta) draw(a);
    }
  };
})();
