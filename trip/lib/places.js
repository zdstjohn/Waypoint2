/* Waypoint place records: what is actually known about each suggested place, checked against real sources
   (OpenStreetMap, the place's own website, recent reviews) by the audit and the nightly checker, and kept in the
   app's database under places/<country-city>. A record can fix a pin, add the official site and hours, say that a
   place has closed for good, and name a replacement. The records are laid over a city's list when it is read, so
   every screen (the planner, the map, the links) sees the checked facts without knowing where they came from. */
(function () {
  "use strict";
  var W = window.W;
  var REC = {}, applied = {}, gen = 0;

  /* the checked record for one place, if there is one */
  W.placeInfo = function (it, country, city) {
    var c = REC[W.slug(country + " " + city)]; if (!c || !it || !it.n) return null;
    return c.items[W.norm(it.n)] || null;
  };

  /* lay the checked facts over one list: a verified pin wins over a guessed one; a place that has closed is marked so
     the planner skips it; the official site fills an empty booking or menu link; hours fill in where unknown */
  function lay(list, items, food, added, pool) {
    (list || []).forEach(function (it) {
      var r = it && it.n && items[W.norm(it.n)]; if (!r) return;
      if (r.lat != null && r.lng != null) { it.lat = r.lat; it.lng = r.lng; }
      /* a guessed pin that landed far out in the water, with the real place not found yet: no pin beats a wrong one */
      else if (r.nopin) { it.lat = null; it.lng = null; }
      if (r.st) it.st = r.st;
      if (r.site) {
        if (food) { if (!it.menu) it.menu = r.site; }
        else if (!it.book) it.book = r.site;
      }
      if (r.hours && !it.hours) it.hours = r.hours;
      if (r.k != null) it.k = r.k;
      if (r.note) it.note = r.note;
      if (r.place) it.place = r.place;
      /* a closed place names what to go to instead: added to the list once, with its own checked facts */
      if (r.replace && r.replace.n && !added[W.norm(r.replace.n)]) {
        var exists = list.some(function (x) { return W.norm(x.n) === W.norm(r.replace.n); });
        if (!exists) list.push(Object.assign(food ? { meal: it.meal || "both", cuisine: it.cuisine || "", price: it.price || "", reserve: false } : { t: it.t || [], s: it.s || "any", ticket: "" }, JSON.parse(JSON.stringify(r.replace))));
        added[W.norm(r.replace.n)] = 1;
      }
    });
  }
  W.applyPlaces = function (country, city, pool) {
    if (!pool || pool.fallback) return pool;
    var slug = W.slug(country + " " + city), c = REC[slug]; if (!c) return pool;
    var stamp = slug + "|" + gen + "|" + (pool.spots || []).length + "|" + (pool.food || []).length;
    if (applied[slug] === stamp) return pool;
    var added = {};
    /* the city's centre (where you stay until you pick a place) when the guessed one sits in the water */
    if (c.center && c.center.length === 2) { pool.lat = c.center[0]; pool.lng = c.center[1]; }
    lay(pool.spots, c.items, false, added, pool); lay(pool.food, c.items, true, added, pool);
    (pool.stay || []).forEach(function (x) {
      var r = x && x.n && c.items[W.norm(x.n)]; if (!r) return;
      if (r.lat != null && r.lng != null) { x.lat = r.lat; x.lng = r.lng; } else if (r.nopin) { x.lat = null; x.lng = null; }
    });
    applied[slug] = slug + "|" + gen + "|" + (pool.spots || []).length + "|" + (pool.food || []).length;
    return pool;
  };

  try {
    if (window.claude && window.claude.use) window.claude.use("db").then(function (db) {
      if (!db) return;
      db.collection("places").onSnapshot(function (snap) {
        REC = {}; snap.docs.forEach(function (d) { var x = d.data() || {}; REC[d.id] = { items: x.items || {}, center: x.center || null }; });
        gen++; applied = {}; W.changed();
      }, function () {});
    }, function () {});
  } catch (e) {}
})();
