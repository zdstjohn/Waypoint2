/* Waypoint links: where a place's buttons lead. A meal's menu, a sight's official ticket page (never a reseller), a
   flight or ferry search, and the names of the ways to travel. Split out of screens/trip.js (v116). */
(function () {
  "use strict";
  var W = window.W, esc = W.esc;
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function regOf(h) { var p = h.split("."), r = p.slice(-2).join("."); return /^(co|com|org|gov|ac|net)\.[a-z]{2}$/.test(r) && p.length > 2 ? p.slice(-3).join(".") : r; }
  /* menu: the restaurant's own menu page when Claude knows it, otherwise a search for that restaurant's menu */
  /* a planned meal's "Menu": its panel, opened at the menu (read from the restaurant's own site overnight) */
  W.menuBtn = function (key) { return '<button type="button" class="menu-btn" data-open="' + esc(key) + '" data-menu="1" aria-haspopup="dialog">Menu</button>'; };
  W.menuLink = function (it, city) {
    var url = it.menu || "https://www.google.com/search?q=" + encodeURIComponent(it.n + " " + city + " menu"), host = "";
    if (it.menu) { try { host = new URL(it.menu).hostname.replace(/^www\./, ""); } catch (e) {} }
    return '<a class="menu-btn" href="' + esc(url) + '" target="_blank" rel="noopener" title="' + esc(host ? "Menu on " + host : "Search for the menu") + '">Menu</a>';
  };
  /* tickets: straight to the place's own official site, never a reseller or a search page.
     Verified links (checked against Wikidata) win; otherwise Claude's official link if it passes the reseller filter; otherwise nothing. */
  W.reviewsUrl = function (name, city) { return "https://www.google.com/search?q=" + encodeURIComponent(name + " " + city + " reviews"); };
  W.officialUrl = function (it, food, country, city) {
    var off = !food && W.officialLink && W.officialLink(it, country, city), url = it.book || "", verified = false;
    if (off) {
      var offHost = hostOf(off.url), bookHost = hostOf(url);
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
    var o = W.officialUrl(it, food, country, city); if (!o) return "";
    return '<a class="book" href="' + esc(o.url) + '" target="_blank" rel="noopener" title="' + (o.verified ? "Official site, checked" : "Official site") + '">' + (food ? "Reserve" : "Tickets") + " · " + esc(o.host) + (o.verified ? ' <span class="ok" aria-label="checked official site">✓</span>' : "") + "</a>";
  };
  /* flights: a Google Flights search (airlines and fares change too often to pick one) */
  W.flightsUrl = function (from, to, d) {
    return "https://www.google.com/travel/flights?q=" + encodeURIComponent("Flights from " + from + " to " + to + (d ? " on " + W.isoDay(d) : "") + " one way");
  };
  var MODE = { train: "Train", bus: "Bus", ferry: "Ferry", catamaran: "Ferry", hydrofoil: "Ferry", vaporetto: "Ferry", ship: "Ferry", flight: "Flight", plane: "Flight", car: "Car", drive: "Car", boat: "Ferry", coach: "Bus" };
  /* a ferry whose own site Claude wasn't sure of: a search that finds the company's site (never a reseller we picked) */
  W.ferrySearch = function (o, a, b) {
    return { url: "https://www.google.com/search?q=" + encodeURIComponent((o.op ? o.op + " " : "") + "ferry " + (o.from || a.name) + " to " + (o.to || b.name) + " official site"),
      text: o.op ? "Find " + o.op + " online" : "Find the ferry company online" };
  };
  W.isFerry = function (m) { return /ferry|boat|catamaran|hydrofoil|vaporetto|ship/i.test(m || ""); };
  W.modeName = function (m) { m = String(m || "").toLowerCase(); for (var k in MODE) if (m.indexOf(k) > -1) return MODE[k]; return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Travel"; };
})();
