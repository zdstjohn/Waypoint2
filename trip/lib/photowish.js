/* Waypoint photos, the finder's list (second script; until v182 part of lib/photos.js, moved so the first download
   is smaller): which places this trip uses, written for the nightly photo run and place checks (wanted/<town>), one
   write per town and only when its list changes. Nothing here is needed to draw the first screen. */
(function () {
  "use strict";
  var W = window.W,
    DB = /** @type {any} */ (null);
  var citySlug = W.citySlug;
  /* tell the photo finder which places this trip uses (one write per city, only when the list changes) */
  var written = {},
    pending = {},
    /** @type {Record<string, string>} */ refused = {}; /* refused while the app is open: not asked again on every redraw */
  try {
    written = JSON.parse(localStorage.getItem("waypoint-wanted-v1") || "null") || {};
  } catch (e) {}
  W.wantPhotos = function (country, city, pool, P) {
    /* (a shared trip is someone else's to describe; the installable app has no nightly helper reading these) */
    if (!pool || pool.fallback || W.readOnly || W.standalone) return;
    /* the places this trip has on its days come first (with the day's date), then the best of the rest, up to the city's
       cap: the nightly checks and the photo finder work down these lists, the soonest trip first ("when") */
    var used = {},
      first = "";
    ((P && P.days) || []).forEach(function (d) {
      if (d.country !== country || d.city !== city) return;
      var dt = W.dateOf ? W.dateOf(d.n) : null,
        iso = dt ? W.isoDay(dt) : "";
      if (iso && (!first || iso < first)) first = iso;
      (d.slots || []).forEach(function (x) {
        if (x.item && x.item.n && !(x.item.n in used)) used[x.item.n] = iso;
      });
    });
    function pick(list, cap) {
      var a = list.filter(function (x) {
          return x.n in used;
        }),
        b = list.filter(function (x) {
          return !(x.n in used);
        });
      return a.concat(b).slice(0, Math.max(cap, a.length));
    }
    var spotsL = pick(pool.spots || [], W.IDEA_CAP.spots),
      foodL = pick(pool.food || [], W.IDEA_CAP.food + 30); /* (the nightly places to eat come on top of the cap) */
    /* one entry per place, in the same order as the names (null where a place has no pin), so the nightly tools can pair them */
    var pts = spotsL.concat(foodL).map(function (x) {
      var la = x.lat,
        ln = x.lng;
      return la != null && ln != null ? [Math.round(la * 1e4) / 1e4, Math.round(ln * 1e4) / 1e4] : null;
    });
    var info = (pool.spots || [])
      .filter(function (x) {
        return W.isPaid(x) || W.needsBooking(x);
      })
      .map(function (x) {
        return { n: x.n, ticket: x.ticket || "", book: x.book || "", lat: x.lat, lng: x.lng };
      });
    var stays = (pool.stay || []).filter(function (x) {
      return x && x.n && x.lat != null;
    });
    var body = {
      country: country,
      city: city,
      spots: spotsL.map(function (x) {
        return x.n;
      }),
      food: foodL.map(function (x) {
        return x.n;
      }),
      pts: pts,
      /* each place to eat's menu page, when its list gave one (the nightly task reads the menu from it), in the same order */
      menus: foodL.map(function (x) {
        return x.menu || "";
      }),
      /* Everyone who can open the app can read this list, so it says nothing about any family: which places are on a
         trip (by name only), and the month of the first day there (the nightly checks do the soonest trips first),
         never the dates, the day of each place, where you stay or a hotel you typed. */
      when: first ? first.slice(0, 7) + "-01" : null,
      used: Object.keys(used).map(function (n) {
        return [n];
      }),
      paid: info,
      home: null,
      center: pool.lat != null ? [pool.lat, pool.lng] : null,
      /* where-to-stay areas and the stay you chose by name (not a Booking.com pick, whose pin is real): their pins are checked too */
      stays: stays.map(function (x) {
        return x.n;
      }),
      stayPts: stays.map(function (x) {
        return [Math.round((x.lat || 0) * 1e4) / 1e4, Math.round((x.lng || 0) * 1e4) / 1e4];
      }),
      homeLabel: null
    };
    /* (v7: the first list without the stay and the dates; every city a trip uses is written again without them) */
    var sig =
      "v7/" +
      foodL.length +
      "/" +
      (first || "") +
      "/" +
      body.used.length +
      "/" +
      (body.used.length ? body.used[body.used.length - 1][0] : "") +
      "/" +
      body.stays.length +
      "/" +
      info.filter(function (x) {
        return x.book;
      }).length +
      "/" +
      body.spots.length +
      "/" +
      body.food.length +
      "/" +
      (body.spots[body.spots.length - 1] || "") +
      "/" +
      (body.food[body.food.length - 1] || "");
    var id = citySlug(country, city);
    if (written[id] === sig || refused[id] === sig || (pending[id] && pending[id].sig === sig)) return;
    pending[id] = { sig: sig, body: body };
    flushWanted();
  };
  var flushing = false;
  function flushWanted() {
    if (!DB || flushing) return;
    var id = Object.keys(pending)[0];
    if (!id) return;
    var job = pending[id];
    flushing = true;
    DB.doc("wanted/" + id)
      .set(job.body)
      .then(
        function () {
          written[id] = job.sig;
          try {
            localStorage.setItem("waypoint-wanted-v1", JSON.stringify(written));
          } catch (e) {}
        },
        function (e) {
          /* no signal: the list stays, and goes when the signal is back (below) */
          if (navigator.onLine === false) hold = true;
          else {
            refused[id] = job.sig;
            W.caught(e, "the photo finder's list for " + id);
          }
        }
      )
      .then(function () {
        flushing = false;
        if (hold) return;
        if (pending[id] === job) delete pending[id];
        flushWanted();
      });
  }
  var hold = false;
  window.addEventListener("online", function () {
    hold = false;
    flushWanted();
  });

  try {
    if (window.claude && window.claude.use)
      window.claude.use("db").then(
        function (db) {
          if (!db) return;
          DB = db;
          flushWanted();
        },
        function () {}
      );
  } catch (e) {}
})();
