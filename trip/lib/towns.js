/* Waypoint destinations: the places a country offers (built in, and Claude's list), always towns, never whole islands.
   Split from lib/core.js; lib/ideas.js asks Claude for a country's list (W.loadCountry). */
(function () {
  "use strict";
  var W = window.W;
  /* ---------- destination data ---------- */
  /* A destination is a town, never a whole island: you stay somewhere on Crete, not "in Crete". window.TI (data/data2.js)
     lists the well-known islands with their towns. Wherever an island would be offered (the built-in list, Claude's
     list, a name you type), its towns are offered instead. A trip made before this, with an island as a stop, keeps
     working: W.findCity still knows the island (marked whole), and Plan offers its towns in its place. */
  var isleIdx = null;
  /* an island is matched by one of its listed names; "Santorini Island" and "the island of Santorini" also find
     Santorini (but "Vancouver" never finds Vancouver Island: only what is typed loses the word, not the list) */
  function isleFind(by, name) {
    var k = W.norm(name);
    return by[k] || by[k.replace(/^(the )?(isle|island) of /, "").replace(/ (island|islands|isle)$/, "")] || null;
  }
  function isles(country) {
    if (!isleIdx) {
      isleIdx = Object.create(null);
      var TI = /** @type {any} */ (window).TI || {};
      Object.keys(TI).forEach(function (cn) {
        var by = Object.create(null),
          rows = TI[cn].map(function (/** @type {string[]} */ row) {
            var group = row[0].charAt(0) === "*",
              names = row[0].replace(/^\*/, "").split(",");
            var is = {
              name: names[0],
              group: group,
              towns: row[1].split(";").map(function (t) {
                var m = t.split("@"),
                  q = m[1].split(",");
                return { name: m[0], lat: +q[0], lng: +q[1] };
              })
            };
            names.forEach(function (n) {
              by[W.norm(n)] = is;
            });
            return is;
          });
        isleIdx[cn] = { rows: rows, by: by };
      });
    }
    return isleIdx[country] || null;
  }
  /** the island a name stands for (null for a town, or a name that is no island we know)
      @param {string} country @param {string} name @returns {{ name: string, group: boolean, towns: { name: string, lat: number, lng: number }[] } | null} */
  W.isleOf = function (country, name) {
    var x = isles(country),
      is = (x && isleFind(x.by, name)) || null;
    /* "Victoria" is a town on Mahé before it is anything else */
    if (
      is &&
      is.towns.some(function (t) {
        return W.norm(t.name) === W.norm(name);
      })
    )
      return null;
    return is;
  };
  /* an island's towns as destinations. They take after the island's own entry where there is one (its tags, its
     suggested days, the ideas built into the app); the usual base comes first and counts as the best known */
  function isleTowns(is, base) {
    base = base || {};
    return is.towns.map(function (t, i) {
      var c = /** @type {BuiltCity} */ ({
        name: t.name,
        region: is.name,
        isl: is.name,
        lat: t.lat,
        lng: t.lng,
        w: i ? Math.max(1, (base.w || 2) - 1) : base.w || 2,
        t: base.t || [],
        d: i || !base.d ? (is.group ? "In " : "On ") + is.name + "." : base.d
      });
      if (i) c.pop = Math.max(1, (base.pop || 3) - Math.min(i, 2));
      else if (base.pop) c.pop = base.pop;
      if (base.spots) c.spots = base.spots;
      return c;
    });
  }
  /* one index per country, rebuilt when either list it was made from is replaced (the built-in one, or Claude's, which
     arrives later or comes back from a saved trip). list = what is offered; map = every name that can be looked up,
     which also has the islands themselves (whole) and every town of the islands we know */
  var ccCache = Object.create(null);
  function cityIndex(country) {
    var built = (window.TD[country] || {}).cities || null,
      ai = (W.C.country[country] || {}).cities || null,
      e = ccCache[country];
    if (e && e.built === built && e.ai === ai) return e;
    e = ccCache[country] = { built: built, ai: ai, list: [], map: Object.create(null) };
    var list = e.list,
      map = e.map,
      x = isles(country);
    var put = function (c) {
      var k = W.norm(c.name);
      if (map[k]) return;
      map[k] = c;
      list.push(c);
    };
    (built || []).concat(ai || []).forEach(function (c) {
      var is = x ? W.isleOf(country, c.name) : null;
      if (!is) {
        put(c);
        return;
      }
      var k = W.norm(c.name);
      if (map[k]) return;
      var isName = is.name;
      map[k] = Object.assign({}, c, { whole: 1, isl: isName });
      isleTowns(is, c).forEach(function (t) {
        var tk = W.norm(t.name),
          had = map[tk];
        if (!had) put(t);
        else if (!had.isl && !had.whole) had.isl = isName;
      });
    });
    /* an entry Claude placed on an island we know: say so (the planner keeps to one base on a small island) */
    if (x)
      x.rows.forEach(function (is) {
        var first = is.towns[0];
        is.towns.forEach(function (t) {
          var had = map[W.norm(t.name)];
          if (had && !had.isl && !had.whole) had.isl = is.name;
        });
        /* names that are not offered but can still be looked up: the island itself, and its towns */
        Object.keys(x.by).forEach(function (k) {
          if (x.by[k] === is && !map[k])
            map[k] = /** @type {BuiltCity} */ ({ name: is.name, lat: first.lat, lng: first.lng, whole: 1, isl: is.name });
        });
        isleTowns(is, null).forEach(function (t) {
          var tk = W.norm(t.name);
          if (!map[tk]) map[tk] = t;
        });
      });
    return e;
  }
  W.countryCities = function (name) {
    return cityIndex(name).list;
  };
  /* looked up for every stop on every redraw */
  W.findCity = function (country, name) {
    var e = cityIndex(country);
    return e.map[W.norm(name)] || isleFind(e.map, name) || null;
  };
  /** the towns to choose between when a name is an island (the ones we know first, then any others the country list
      places on it), or null when the name is a town @param {string} country @param {string} name @returns {{ isle: string, group: boolean, towns: BuiltCity[] } | null} */
  W.isleChoice = function (country, name) {
    var is = W.isleOf(country, name),
      e = cityIndex(country),
      k = W.norm(name),
      out = [],
      seen = {};
    var add = function (c) {
      var nk = W.norm(c.name);
      if (c && !c.whole && !seen[nk]) {
        seen[nk] = 1;
        out.push(c);
      }
    };
    if (is)
      is.towns.forEach(function (t) {
        add(e.map[W.norm(t.name)]);
      });
    /* towns the country list places on this island (also how an island we don't list ourselves is recognised) */
    var on = Object.create(null);
    on[is ? W.norm(is.name) : k] = 1;
    var listed = e.list.filter(function (c) {
      return c.isl && isleFind(on, c.isl);
    });
    if (!is && !listed.length) {
      on[k.replace(/^(the )?(isle|island) of /, "").replace(/ (island|islands|isle)$/, "")] = 1;
      listed = e.list.filter(function (c) {
        return c.isl && isleFind(on, c.isl);
      });
    }
    if (!is && (!listed.length || (e.map[k] && !e.map[k].whole))) return null;
    listed
      .slice()
      .sort(function (a, b) {
        return (b.pop || 0) - (a.pop || 0);
      })
      .forEach(add);
    return { isle: is ? is.name : listed[0].isl || name, group: !!(is && is.group), towns: out.slice(0, 8) };
  };
  W.cityKey = function (country, city) {
    return country + "|" + city;
  };
  /** a stop that is a whole island becomes one of its towns: it takes the island's place in your list, with the days
      and the lodging you had set (the ideas are the town's own) @param {string} country @param {string} from @param {string} to */
  W.isleSwap = function (country, from, to) {
    var S = W.S,
      c = S.countries.filter(function (x) {
        return x.name === country;
      })[0];
    if (!c || !to || from === to) return;
    var j = c.picked.indexOf(from),
      a = W.cityKey(country, from),
      b = W.cityKey(country, to);
    if (j > -1) {
      if (c.picked.indexOf(to) < 0) c.picked[j] = to;
      else c.picked.splice(j, 1);
    }
    [S.cityDays, S.stays].forEach(function (m) {
      if (m && m[a] != null) {
        if (m[b] == null) m[b] = m[a];
        delete m[a];
      }
    });
  };
  W.openStay = {}; /* which cities have their lodging panel open on Plan (screens/setup.js, second script) */
  /* idea pool for a city: Claude's list, or the built-in fallback when Claude isn't available */
  W.pool = function (country, city) {
    var c = W.C.city[W.cityKey(country, city)];
    if (c && c.spots && c.spots.length) {
      if (W.withImported) W.withImported(country, city, c);
      if (W.withNightFood) W.withNightFood(country, city, c);
      if (W.applyPlaces) W.applyPlaces(country, city, c);
      if (W.applyWorld) W.applyWorld(country, city, c);
      return c;
    }
    if (W.sampleState === "off") {
      var b = W.findCity(country, city);
      if (b && b.spots) return { d: b.d, lat: b.lat, lng: b.lng, spots: b.spots, food: [], fallback: true };
    }
    return null;
  };
})();
