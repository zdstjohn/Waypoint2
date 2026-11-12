/* Waypoint's desktop workspace, part 4: the keyboard (second script).
     Ctrl or Cmd + K   a palette: type a day ("3", "wed"), a place ("pantheon") or a screen ("budget") and go there
     [ and ]           the day before, the day after
     Esc               closes the palette; a stop's inspector, the stay and the day trip close on Esc themselves
   The palette is built from the plan each time it opens (nothing kept); going somewhere uses the workspace's own
   moves (W.wsDo, W.wsDay in lib/desk.js), so the keyboard and the rail can never disagree. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var open = false,
    sel = 0,
    /** @type {{ k: string, name: string, sub: string, hay: string, run: () => void }[]} */ all = [],
    /** @type {typeof all} */ shown = [],
    /** @type {HTMLElement | null} */ before = null;
  function host() {
    var h = W.wsEl("wsPal");
    if (!h) {
      h = document.createElement("div");
      h.id = "wsPal";
      h.setAttribute("role", "dialog");
      h.setAttribute("aria-modal", "true");
      h.setAttribute("aria-label", "Jump to a day, a place or a screen");
      document.body.appendChild(h);
    }
    return h;
  }
  function index(P) {
    var out = /** @type {typeof all} */ ([]),
      add = function (k, name, sub, run, more) {
        out.push({ k: k, name: name, sub: sub || "", hay: W.norm(name + " " + (sub || "") + " " + (more || "")), run: run });
      },
      go = function (what, which) {
        return function () {
          W.wsDo(what, which);
        };
      };
    (P.days || []).forEach(function (d) {
      var dt = W.dateOf(d.n),
        when = dt ? dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "";
      add(
        "Day",
        "Day " + d.n + " · " + (W.dayHeadline(d, P) || d.city),
        [d.city, when].filter(Boolean).join(" · "),
        go("day", String(d.n)),
        "day" + d.n + " d" + d.n
      );
    });
    (P.days || []).forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        if (!x.item) return;
        add("Place", x.item.n, "Day " + d.n + " · " + (W.SLOT_NAME[x.slot] || "") + " · " + d.city, function () {
          W.S.day = d.n;
          W.wsDo("view", "days");
          setTimeout(function () {
            W.openStop(x.key);
          }, 80);
        });
      });
    });
    if (!W.readOnly && !window.__WP_OFFLINE) add("Screen", "Plan", "Who, where, what you eat", go("view", "setup"), "setup");
    add("Screen", "Itinerary", "Day by day", go("view", "days"), "trip days");
    add("Screen", "Explore ideas", "More to do and eat near each day", go("view", "explore"));
    add("Screen", "Today", "Now, next and the way there", go("view", "go"));
    [
      ["tobook", "To book"],
      ["booked", "Booked"],
      ["budget", "Budget"],
      ["pack", "Pack"],
      ["take", "Take along"]
    ].forEach(function (g) {
      add("Prepare", g[1], "", go("prep", g[0]), "prepare");
    });
    add("Tool", "Export itinerary (CSV)", "One row per stop", go("csv", ""), "spreadsheet download");
    add("Tool", W.wsPrefs.map ? "Hide the map" : "Show the map", "", go("map", ""), "pane");
    add("Tool", "Fold or open the sidebar", "", go("rail", ""), "rail collapse");
    if (!W.readOnly && !window.__WP_OFFLINE)
      add("Tool", "Import and backups", "Import a plan, save a copy of your trips", go("settings", ""), "settings");
    return out;
  }
  function match(q) {
    var words = W.norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return all.slice(0, 40);
    var num = /^\d+$/.test(q.trim()) ? +q.trim() : 0;
    return all
      .map(function (it, i) {
        if (
          !words.every(function (w) {
            return it.hay.indexOf(w) > -1;
          })
        )
          return null;
        var name = W.norm(it.name),
          s =
            (num && it.k === "Day" && it.hay.indexOf(" day" + num + " ") > -1 ? 100 : 0) +
            (name.indexOf(words[0]) === 0 ? 20 : name.indexOf(" " + words[0]) > -1 ? 10 : 0);
        return { it: it, s: s, i: i };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return /** @type {any} */ (b).s - /** @type {any} */ (a).s || /** @type {any} */ (a).i - /** @type {any} */ (b).i;
      })
      .slice(0, 40)
      .map(function (x) {
        return /** @type {any} */ (x).it;
      });
  }
  function list() {
    var l = host().querySelector(".wp-list");
    if (!l) return;
    l.innerHTML = shown.length
      ? shown
          .map(function (it, i) {
            return (
              '<button type="button" class="wp-i" role="option" id="wpI' +
              i +
              '" data-wpi="' +
              i +
              '" aria-selected="' +
              (i === sel) +
              '"><span class="k">' +
              esc(it.k) +
              "</span><b>" +
              esc(it.name) +
              "</b><i>" +
              esc(it.sub) +
              "</i></button>"
            );
          })
          .join("")
      : '<p class="wp-none">Nothing by that name on this trip.</p>';
    var cur = l.querySelector('[aria-selected="true"]'),
      inp = host().querySelector("input");
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
    if (inp) inp.setAttribute("aria-activedescendant", cur ? cur.id : "");
  }
  W.palOpen = function () {
    if (open || !W.desk() || !W.P) return;
    open = true;
    before = /** @type {HTMLElement | null} */ (document.activeElement);
    all = index(W.P);
    shown = match("");
    sel = 0;
    var h = host();
    h.innerHTML =
      '<div class="wp-box"><input type="text" role="combobox" aria-expanded="true" aria-controls="wpList" aria-label="Jump to a day, a place or a screen" placeholder="Jump to a day, a place or a screen…" autocomplete="off" spellcheck="false">' +
      '<div class="wp-list" id="wpList" role="listbox"></div><div class="wp-hint"><span><kbd>↑</kbd><kbd>↓</kbd>choose</span><span><kbd>Enter</kbd>go</span><span><kbd>Esc</kbd>close</span><span><kbd>[</kbd><kbd>]</kbd>previous and next day</span></div></div>';
    h.classList.add("on");
    list();
    var inp = h.querySelector("input");
    if (inp) inp.focus();
  };
  W.palClose = function () {
    if (!open) return false;
    open = false;
    var h = host();
    h.classList.remove("on");
    h.innerHTML = "";
    if (before && document.contains(before) && before.focus) before.focus({ preventScroll: true });
    before = null;
    return true;
  };
  function run(i) {
    var it = shown[i];
    W.palClose();
    if (it) it.run();
  }
  document.addEventListener("input", function (e) {
    var t = /** @type {HTMLInputElement} */ (e.target);
    if (!open || !t || !t.closest || !t.closest("#wsPal")) return;
    shown = match(t.value);
    sel = 0;
    list();
  });
  document.addEventListener(
    "click",
    function (e) {
      if (!open) return;
      var t = /** @type {HTMLElement} */ (e.target),
        b = t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-wpi]")) : null;
      if (b) {
        e.preventDefault();
        e.stopPropagation();
        run(+(b.dataset.wpi || 0));
      } else if (!t.closest || !t.closest(".wp-box")) {
        e.preventDefault();
        e.stopPropagation();
        W.palClose();
      }
    },
    true
  );
  function typing(t) {
    return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }
  document.addEventListener(
    "keydown",
    function (e) {
      if (!W.desk || !W.desk()) return;
      var k = e.key;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (k === "k" || k === "K")) {
        e.preventDefault();
        e.stopPropagation();
        if (open) W.palClose();
        else W.palOpen();
        return;
      }
      if (open) {
        if (k === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          W.palClose();
        } else if (k === "ArrowDown" || k === "ArrowUp") {
          e.preventDefault();
          if (shown.length) sel = (sel + (k === "ArrowDown" ? 1 : shown.length - 1)) % shown.length;
          list();
        } else if (k === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          run(sel);
        } else if (k === "Tab") e.preventDefault(); /* (the palette holds the keyboard while it is open) */
        return;
      }
      if ((k === "[" || k === "]") && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
        var P = W.P;
        if (!P || !P.days.length) return;
        var cur = W.view() === "go" && W.goDayN ? W.goDayN(P) : W.S.day,
          n = cur + (k === "]" ? 1 : -1);
        if (n < 1 || n > P.days.length) return;
        e.preventDefault();
        W.wsDay(n);
      }
    },
    true
  );
})();
