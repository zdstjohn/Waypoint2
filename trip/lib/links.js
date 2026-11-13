/* Waypoint links: where a place's buttons lead. A meal's menu, a sight's official ticket page (never a reseller), a
   flight or ferry search, and the names of the ways to travel. Split out of screens/trip.js (v116). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  /* (kept by the link: the same links are read again on every redraw, the booking list three or four times a draw,
     and taking a URL apart is the slow part) */
  var HOSTS = /** @type {Record<string, string>} */ ({}),
    nHosts = 0;
  function hostOf(u) {
    var k = String(u);
    if (Object.prototype.hasOwnProperty.call(HOSTS, k)) return HOSTS[k];
    var h = "";
    try {
      h = new URL(u).hostname.replace(/^www\./, "");
    } catch (e) {}
    if (++nHosts > 2000) {
      HOSTS = {};
      nHosts = 1;
    }
    return (HOSTS[k] = h);
  }
  function regOf(h) {
    var p = h.split("."),
      r = p.slice(-2).join(".");
    return /^(co|com|org|gov|ac|net)\.[a-z]{2}$/.test(r) && p.length > 2 ? p.slice(-3).join(".") : r;
  }
  /* menu: the restaurant's own menu page when Claude knows it, otherwise a search for that restaurant's menu */
  /* a planned meal's "Menu": its panel, opened at the menu (read from the restaurant's own site overnight) */
  W.menuBtn = function (key) {
    return (
      '<button type="button" class="menu-btn" data-open="' +
      esc(key) +
      '" data-menu="1" aria-haspopup="dialog" aria-label="Menu" title="Menu">' +
      W.icon("menu", 2) +
      '<span class="bt-l" aria-hidden="true">Menu</span></button>' /* (the word shows where there is room: a phone's stop card) */
    );
  };
  W.menuLink = function (it, city) {
    var own = W.safeUrl(it.menu),
      url = own || "https://www.google.com/search?q=" + encodeURIComponent(it.n + " " + city + " menu"),
      host = "";
    if (own) {
      try {
        host = new URL(own).hostname.replace(/^www\./, "");
      } catch (e) {}
    }
    /* the same menu picture as on a day's meal (W.menuBtn), here as a link out: an idea is not on the day yet, so it
       has no sheet to open */
    return W.iconLink(url, "menu", host ? "Menu of " + it.n + " on " + host : "Search for the menu of " + it.n);
  };
  /* tickets: straight to the place's own official site, never a reseller or a search page.
     Verified links (checked against Wikidata) win; otherwise Claude's official link if it passes the reseller filter; otherwise nothing. */
  W.reviewsUrl = function (name, city) {
    return "https://www.google.com/search?q=" + encodeURIComponent(name + " " + city + " reviews");
  };
  W.officialUrl = function (it, food, country, city) {
    var off = !food && W.officialLink && W.officialLink(it, country, city),
      url = W.safeUrl(it.book),
      verified = false;
    if (off && !W.safeUrl(off.url)) off = null;
    if (off) {
      var offHost = hostOf(off.url),
        bookHost = hostOf(url);
      /* keep Claude's deeper ticket page when it is on the same official site; otherwise use the verified site */
      if (!(url && bookHost && regOf(bookHost) === regOf(offHost))) url = off.url;
      verified = true;
    }
    var host = hostOf(url);
    if (!url || !host) return null;
    if (food && !W.needsBooking(it)) return null;
    if (!food && !W.isPaid(it) && !W.needsBooking(it)) return null;
    return { url: url, host: host, verified: verified };
  };
  W.hostOf = hostOf;
  W.bookLink = function (it, city, food, country) {
    var o = W.officialUrl(it, food, country, city);
    if (!o) return "";
    return (
      '<a class="book" href="' +
      esc(o.url) +
      '" target="_blank" rel="noopener" title="' +
      (o.verified ? "Official site, checked" : "Official site") +
      '">' +
      (food ? "Reserve" : "Tickets") +
      " · " +
      esc(o.host) +
      (o.verified ? '\u00a0<span class="ok" aria-label="checked official site">✓</span>' : "") +
      "</a>"
    ); /* (no break before the tick: it used to drop onto a line of its own) */
  };
  /* flights: a Google Flights search (airlines and fares change too often to pick one) */
  W.flightsUrl = function (from, to, d) {
    return (
      "https://www.google.com/travel/flights?q=" +
      encodeURIComponent("Flights from " + from + " to " + to + (d ? " on " + W.isoDay(d) : "") + " one way")
    );
  };
  var MODE = {
    train: "Train",
    bus: "Bus",
    ferry: "Ferry",
    catamaran: "Ferry",
    hydrofoil: "Ferry",
    vaporetto: "Ferry",
    ship: "Ferry",
    flight: "Flight",
    plane: "Flight",
    car: "Car",
    drive: "Car",
    boat: "Ferry",
    coach: "Bus"
  };
  /* a ferry whose own site Claude wasn't sure of: a search that finds the company's site (never a reseller we picked) */
  W.ferrySearch = function (o, a, b) {
    return {
      url:
        "https://www.google.com/search?q=" +
        encodeURIComponent((o.op ? o.op + " " : "") + "ferry " + (o.from || a.name) + " to " + (o.to || b.name) + " official site"),
      text: o.op ? "Find " + o.op + " online" : "Find the ferry company online"
    };
  };
  W.isFerry = function (m) {
    return /ferry|boat|catamaran|hydrofoil|vaporetto|ship/i.test(m || "");
  };
  W.modeName = function (m) {
    m = String(m || "").toLowerCase();
    for (var k in MODE) if (m.indexOf(k) > -1) return MODE[k];
    return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Travel";
  };

  /* ---------- small pictures instead of words (v118) ---------- */
  var PIC = {
    photos: W.icon("photo", 2),
    map: W.icon("map", 2),
    menu: W.icon("menu", 2)
  }; /* a photo: a frame with a sun and hills; a map: a folded map with a pin (no company's logo); a menu: the card a meal's own button shows */

  /** an outside link drawn as a picture; the words go to screen readers and the tooltip @param {string} url @param {"photos"|"map"|"menu"} kind @param {string} label */
  W.iconLink = function (url, kind, label) {
    return (
      '<a class="ilink ilink-' +
      kind +
      '" href="' +
      W.esc(url) +
      '" target="_blank" rel="noopener" aria-label="' +
      W.esc(label) +
      '" title="' +
      W.esc(label) +
      '">' +
      PIC[kind] +
      "</a>"
    );
  };
})();
