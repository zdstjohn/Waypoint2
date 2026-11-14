/* Waypoint nightly restaurants and menus. A scheduled task each night (owner's account) finds more real places to eat
   for the trip cities (web-checked, fitting the group's food needs) and reads restaurants' menus from their own websites.
   It writes:
     morefood/<city slug>  {city, country, at, items: [a place to eat, as Claude's lists give them, plus src (where it was
                            confirmed) and fit/fitw when the trip has food needs]}
     menus/<city slug>     {city, country, items: {"<place name, normalized>": {n, src, at, sections: [{h, items: [{n, p, d}]}],
                            kids: [{n, p}], note}}}
   The places join the city's list (checked by the validator, never twice: the place key), and a restaurant's panel shows
   its menu: dishes and prices as on the restaurant's own site, with the date it was read and a link to it, plus its menu
   photos on Google Maps. Everything read here is data written by the nightly task, never code. */
(function () {
  "use strict";
  var W = window.W,
    V = W.V;
  var MORE = {},
    MENUS = {},
    moreV = 0,
    moreSig = "{}",
    menuSig = "{}";
  function docs(s) {
    var o = {};
    ((s && s.docs) || []).forEach(function (d) {
      o[d.id] = d.data() || {};
    });
    return o;
  }
  function sigOf(o) {
    try {
      return JSON.stringify(o);
    } catch (e) {
      return String(Math.random());
    }
  }
  /* only real changes count: the first, empty answer (most nights, most cities) costs nothing. New places change the
     lists the planner works from, so they re-plan (W.changed); a menu only shows in a restaurant's panel, so it redraws. */
  try {
    if (window.claude && window.claude.use)
      window.claude.use("db").then(
        function (db) {
          if (!db) return;
          db.collection("morefood").onSnapshot(
            function (s) {
              var o = docs(s),
                g = sigOf(o);
              if (g === moreSig) return;
              MORE = o;
              moreSig = g;
              moreV++;
              W.changed();
            },
            function () {}
          );
          db.collection("menus").onSnapshot(
            function (s) {
              var o = docs(s),
                g = sigOf(o);
              if (g === menuSig) return;
              MENUS = o;
              menuSig = g;
              if (W.render) W.render();
            },
            function () {}
          );
        },
        function () {}
      );
  } catch (e) {}
  var slug = W.citySlug;

  /* the nightly places join the city's list once per delivery (W.pool calls this every time it hands out a list) */
  W.withNightFood = function (country, city, pool) {
    var doc = MORE[slug(country, city)];
    /* (by what the nightly lists hold, kept with the city: a counter would start again with the page, and a list kept
       from yesterday would look up to date) */
    if (!doc || !Array.isArray(doc.items) || !pool || pool.nightV === moreSig) return;
    pool.nightV = moreSig;
    var have = {},
      ctr = pool.lat != null ? { lat: pool.lat, lng: pool.lng } : null,
      sig = W.eatSig ? W.eatSig() : "";
    (pool.food || []).concat((pool.rest && pool.rest.food) || []).forEach(function (x) {
      have[W.placeKey(x)] = 1;
      have[W.norm(x.n)] = 1;
    }); /* (and the ones set aside: W.fitIdeas) */
    doc.items.slice(0, 80).forEach(function (x0) {
      var x = V && V.food ? V.food(x0, ctr) : null;
      if (!x) return;
      if (have[W.placeKey(x)] || have[W.norm(x.n)]) return;
      /* (a mark from the nightly finder counts only when made for the food needs as they are now; any other is left for
         the check here, lib/asks.js W.loadEatFit) */
      if (x.fit && sig && (x0.sig === sig || doc.sig === sig))
        x.eat = { f: x.fit, w: x.fitw || "", l: W.eatLikeOf ? W.eatLikeOf(x.like) : 0, sig: sig };
      delete x.fit;
      delete x.fitw;
      delete x.like;
      x.night = typeof x0.src === "string" && /^https:\/\//.test(x0.src) ? x0.src.slice(0, 300) : "1";
      (pool.food || (pool.food = [])).push(x);
      have[W.placeKey(x)] = 1;
      have[W.norm(x.n)] = 1;
    });
  };

  /* a restaurant's menu, as the nightly task read it from the restaurant's own site */
  function clean(s, n) {
    return typeof s === "string"
      ? s
          .replace(/[\u0000-\u001f<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, n)
      : "";
  }
  W.menuFor = function (it, country, city) {
    var doc = MENUS[slug(country, city)],
      m = doc && doc.items && typeof doc.items === "object" ? doc.items[W.norm(it.n)] : null;
    if (!m || typeof m !== "object" || !/^https:\/\//.test(m.src || "")) return null;
    var secs = (Array.isArray(m.sections) ? m.sections : [])
      .slice(0, 8)
      .map(function (sec) {
        return {
          h: clean(sec && sec.h, 40),
          items: (sec && Array.isArray(sec.items) ? sec.items : [])
            .slice(0, 12)
            .map(function (d) {
              return { n: clean(d && d.n, 80), p: clean(d && d.p, 24), d: clean(d && d.d, 120) };
            })
            .filter(function (d) {
              return d.n;
            })
        };
      })
      .filter(function (sec) {
        return sec.items.length;
      });
    var kids = (Array.isArray(m.kids) ? m.kids : [])
      .slice(0, 8)
      .map(function (d) {
        return { n: clean(d && d.n, 80), p: clean(d && d.p, 24) };
      })
      .filter(function (d) {
        return d.n;
      });
    if (!secs.length && !kids.length) return null;
    return { src: m.src, at: clean(m.at, 10), sections: secs, kids: kids, note: clean(m.note, 200) };
  };

  /* the menu in a restaurant's panel (flow.js's stop sheet, through W.stopDetails); with the stop's key (a meal on the
     day) it starts with reading a photo of the menu, for this family (lib/menuread.js) */
  W.menuBlock = function (it, day, key) {
    var m = W.menuFor(it, day.country, day.city),
      loc = W.curOf ? W.curOf(day.country) : "",
      pt = function (p) {
        return W.priceText ? W.priceText(p, loc) : p;
      };
    var host = "";
    try {
      host = m ? new URL(m.src).hostname.replace(/^www\./, "") : "";
    } catch (e) {}
    var gm = W.gmapsPlace(it, day.city);
    var h = '<div class="menu-b"><h3>Menu</h3>' + (key && W.menuReadBlock ? W.menuReadBlock(key) : "");
    if (m) {
      h +=
        m.sections
          .map(function (sec) {
            return (
              (sec.h ? "<h4>" + W.esc(sec.h) + "</h4>" : "") +
              '<ul class="mn-l">' +
              sec.items
                .map(function (d) {
                  return (
                    "<li><span><b>" +
                    W.esc(d.n) +
                    "</b>" +
                    (d.d ? '<span class="small muted">' + W.esc(d.d) + "</span>" : "") +
                    "</span>" +
                    (d.p ? '<span class="mn-p">' + W.esc(pt(d.p)) + "</span>" : "") +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
            );
          })
          .join("") +
        (m.kids.length && W.party().kid
          ? '<h4>For the kids</h4><ul class="mn-l">' +
            m.kids
              .map(function (d) {
                return (
                  "<li><span><b>" + W.esc(d.n) + "</b></span>" + (d.p ? '<span class="mn-p">' + W.esc(pt(d.p)) + "</span>" : "") + "</li>"
                );
              })
              .join("") +
            "</ul>"
          : "") +
        (m.note ? '<p class="small muted">' + W.esc(m.note) + "</p>" : "") +
        '<p class="small muted">From the menu on <a href="' +
        W.esc(m.src) +
        '" target="_blank" rel="noopener">' +
        W.esc(host || "its website") +
        "</a>" +
        (m.at ? ", read " + W.esc(W.fmtDate(new Date(m.at + "T12:00"), "md")) : "") +
        ". Dishes and prices change.</p>";
    } else
      h +=
        '<p class="small muted">' +
        (it.menu
          ? "Not read yet: menus are read from restaurants' own sites overnight. Meanwhile, <a href=\"" +
            W.esc(it.menu) +
            '" target="_blank" rel="noopener">the menu on its site</a>.'
          : "Not read yet: menus are read from restaurants' own sites overnight.") +
        "</p>";
    return h + '<p><a class="chip-a" href="' + W.esc(gm) + '" target="_blank" rel="noopener">Menu photos on Google Maps ↗</a></p></div>';
  };
})();
