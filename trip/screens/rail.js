/* Waypoint's desktop workspace, part 2: the rail (second script). What a phone spreads over the header, the tab bar,
   the row of day numbers and the trip menu is one column here: the views, every day of the trip grouped by where
   you stay (a jump list, and where a stop is dropped to move it to another day), what the plan and the map show,
   and the tools. It draws from the plan and the workspace's choices and keeps no state of its own; its buttons are
   the workspace's (data-ws, lib/desk.js). The trip switcher and the next step are the phone's own elements, moved
   here by lib/desk.js. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var MAC = /Mac|iPhone|iPad/.test((navigator.platform || "") + (navigator.userAgent || ""));
  W.wsKey = function (k) {
    return (MAC ? "⌘" : "Ctrl ") + k;
  };
  var I = {
    search:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.4"/><path d="m10.4 10.4 3.4 3.4"/></svg>',
    csv: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8M4.8 7 8 10.2 11.200 7M2.500 12.500v1h11v-1"/></svg>',
    box: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.500 5.500h11v7.500h-11zM2 2.800h12v2.700H2zM6.300 8.300h3.400"/></svg>',
    map: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.200 6 2.700l4 1.500 4-1.500v9.100l-4 1.500-4-1.500-4 1.500zM6 2.700v9.100M10 4.200v9.100"/></svg>'
  };
  function nav(P) {
    var S = W.S,
      v = W.view(),
      ro = W.readOnly,
      trip = v === "trip" || v === "explore",
      tv = v === "explore" || (v === "trip" && S.tview === "map") ? "explore" : "days";
    function main(view, icon, label, on) {
      return (
        '<button type="button" data-ws="view:' +
        view +
        '"' +
        (on ? ' aria-current="page"' : "") +
        ' title="' +
        label +
        '">' +
        W.icon(icon, 2) +
        '<span class="wr-l">' +
        label +
        "</span></button>"
      );
    }
    function sub(ws, label, on, n) {
      return (
        '<button type="button" class="sub" data-ws="' +
        ws +
        '"' +
        (on ? ' aria-current="true"' : "") +
        ">" +
        label +
        (n ? ' <span class="gn">' + n + "</span>" : "") +
        "</button>"
      );
    }
    var h = "";
    if (!ro && !window.__WP_OFFLINE) h += main("setup", "plan", "Plan", v === "setup");
    h += main("days", "trip", "Itinerary", trip && tv === "days");
    h += sub("view:explore", "Explore ideas", trip && tv === "explore");
    h += main("go", "today", "Today", v === "go");
    h += main("book", "prepare", "Prepare", v === "book");
    if (v === "book") {
      var seg = S.prepTab || "tobook";
      h += [
        ["tobook", "To book"],
        ["booked", "Booked"],
        ["budget", "Budget"],
        ["pack", "Pack"],
        ["take", "Take along"]
      ]
        .map(function (g) {
          return sub("prep:" + g[0], g[1], seg === g[0]);
        })
        .join("");
    }
    return h;
  }
  function days(P) {
    var S = W.S,
      tn = W.todayN ? W.todayN(P) : 0,
      cur = W.view() === "go" && W.goDayN ? W.goDayN(P) : S.day,
      here = P.days[cur - 1];
    return P.stops
      .map(function (s, si) {
        var ds = P.days.filter(function (d) {
            return d.stop === si;
          }),
          n = W.nightsAt(P, si);
        return (
          '<div class="wr-city"><div class="wr-h">' +
          esc(s.name) +
          "<span>" +
          esc([W.stopRange(P, si), n ? n + (n === 1 ? " night" : " nights") : ""].filter(Boolean).join(" · ")) +
          "</span></div>" +
          ds
            .map(function (d) {
              var dt = W.dateOf(d.n),
                when = dt ? dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : d.city,
                hl = W.dayHeadline(d, P) || d.city;
              return (
                '<button type="button" class="wr-day' +
                (d.n === tn ? " today" : "") +
                (here && d.stop === here.stop ? " can" : "") +
                '" data-ws="day:' +
                d.n +
                '" data-wsday="' +
                d.n +
                '"' +
                (d.n === cur ? ' aria-current="true"' : "") +
                ' title="Day ' +
                d.n +
                " · " +
                esc(when) +
                " · " +
                esc(hl) +
                '"><span class="n">' +
                d.n +
                '</span><span class="t"><b>' +
                esc(hl) +
                "</b><i>" +
                esc(when) +
                (d.n === tn ? " · today" : "") +
                "</i></span>" +
                W.dayBars(d, P) +
                "</button>"
              );
            })
            .join("") +
          "</div>"
        );
      })
      .join("");
  }
  function filters() {
    var hide = W.wsPrefs.hide;
    return (
      '<div class="wr-h">Show<span>on the plan and the map</span></div><div class="wr-filters" role="group" aria-label="Show on the plan and the map">' +
      [
        ["sight", "Things to do", ""],
        ["food", "Meals", " food"]
      ]
        .map(function (f) {
          return (
            '<button type="button" class="wr-f' +
            f[2] +
            '" data-ws="f:' +
            f[0] +
            '" aria-pressed="' +
            !hide[f[0]] +
            '">' +
            f[1] +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function tools() {
    return (
      '<button type="button" data-ws="pal" title="Jump to a day, a place or a screen">' +
      I.search +
      '<span class="wr-l">Jump to…</span><kbd>' +
      W.wsKey("K") +
      "</kbd></button>" +
      '<button type="button" data-ws="csv" title="The whole plan as a spreadsheet file">' +
      I.csv +
      '<span class="wr-l">Export itinerary (CSV)</span></button>' +
      (W.readOnly || window.__WP_OFFLINE
        ? ""
        : '<button type="button" data-ws="settings" title="Import a plan, save or open a copy of your trips">' +
          I.box +
          '<span class="wr-l">Import and backups</span></button>') +
      (W.wsPrefs.map
        ? ""
        : '<button type="button" data-ws="map" title="Show the map beside the plan">' +
          I.map +
          '<span class="wr-l">Show the map</span></button>')
    );
  }
  /** draw the rail for this plan and screen (edited in place: a hover or a drag over it is never interrupted) */
  W.railRender = function (P) {
    var a = W.wsEl("wrNav"),
      b = W.wsEl("wrScroll"),
      c = W.wsEl("wrTools");
    if (!a || !b || !c) return;
    var has = !!(P && P.stops && P.stops.length),
      onDays = W.deskSplit && W.deskSplit();
    W.draw(a, nav(P), "rail-nav");
    W.draw(
      b,
      has
        ? days(P) + (onDays ? filters() : "")
        : '<p class="small muted" style="padding:8px">Your days appear here once the trip has a place.</p>',
      "rail-days"
    );
    W.draw(c, tools(), "rail-tools");
    /* the day you are on, in view */
    var cur = /** @type {HTMLElement | null} */ (b.querySelector('.wr-day[aria-current="true"]'));
    if (cur && cur.dataset.wsday !== b.dataset.at) {
      b.dataset.at = cur.dataset.wsday || "";
      var r = cur.getBoundingClientRect(),
        br = b.getBoundingClientRect();
      if (r.top < br.top + 8 || r.bottom > br.bottom - 8) b.scrollTop += r.top - br.top - b.clientHeight / 2 + r.height / 2;
    }
  };
})();
