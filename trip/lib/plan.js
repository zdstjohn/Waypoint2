/* Waypoint planning: which cities, how many days each, and what to do each day. */
(function () {
  "use strict";
  var W = window.W;

  /* trip style: how many of your chosen styles a place fits */
  function hits(t) {
    var n = 0;
    (t || []).forEach(function (x) {
      if (W.S.styles.indexOf(x) > -1) n++;
    });
    return n;
  }
  /* an idea that fits your trip style beats a slightly closer one that doesn't (the day still stays in one area) */
  function styleScore(t) {
    var n = hits(t);
    if (!n) return 0;
    /* with several styles chosen, the one with the fewest picks so far in this city gets a nudge, so the trip mixes them */
    var st = W.S.styles,
      lo = Infinity;
    if (st.length > 1)
      st.forEach(function (x) {
        lo = Math.min(lo, mix[x] || 0);
      });
    var behind =
      st.length > 1 &&
      (t || []).some(function (x) {
        return st.indexOf(x) > -1 && (mix[x] || 0) <= lo;
      });
    return 5 + 2 * n + (behind ? 5 : 0);
  }
  var mix = {}; /* how many of each style this city's days already have */
  var fameMix = { icon: 0, gem: 0 }; /* "best of both": how many famous and hidden picks this city's days have so far */
  function countMix(items) {
    mix = {};
    fameMix = { icon: 0, gem: 0 };
    items.forEach(addMix);
  }
  function addMix(it) {
    if (!it) return;
    if (it.t)
      it.t.forEach(function (x) {
        mix[x] = (mix[x] || 0) + 1;
      });
    var f = fameOf(it);
    if (f === 2) fameMix.icon++;
    else if (f === 0) fameMix.gem++;
  }
  /* how essential a place is: its rating when the list has one; for lists from before, its place in the list
     (the headline sights were asked for first) */
  function fameOf(it, idx) {
    if (it.fame === 0 || it.fame === 1 || it.fame === 2) return it.fame;
    if (idx == null) return 1;
    return idx < 6 ? 2 : idx < 14 ? 1 : 0;
  }
  /* Must-sees: the famous first. Hidden gems: where locals go. Best of both: the icons and the gems, taking turns.
     Whatever the choice, places visitors review well come first and poorly reviewed ones fall away. */
  var FOCUS_W = { icons: [-1, 4, 10], gems: [9, 2, -4], both: [6, 2, 6] };
  function focusScore(item, idx, food) {
    /* a rating counts in full; a guess from the place in the list (older lists, until they are rated) only gently */
    var f = fameOf(item, idx),
      w = FOCUS_W[W.focus ? W.focus() : "icons"][f],
      m = (food ? 0.5 : 1) * (item.fame === undefined ? 0.4 : 1);
    if ((W.focus ? W.focus() : "icons") === "both" && !food && f !== 1) {
      var behind = f === 2 ? fameMix.icon < fameMix.gem : fameMix.gem < fameMix.icon;
      if (behind) w += 4;
    }
    var r = item.rating,
      rev = r == null ? 0 : r >= 4.7 ? 5 : r >= 4.5 ? 3 : r >= 4.3 ? 1 : r >= 4.0 ? -2 : -8;
    return w * m + rev;
  }
  /* Food & drink trips favor the places food lovers seek out */
  function foodStyle(it) {
    return W.S.styles.indexOf("food") > -1 && it.fav ? 5 : 0;
  }
  function kidScore(k, p) {
    k = k || 0;
    return p.toddler ? (k === 1 ? 4 : k === -1 ? -7 : 0) : p.kid ? (k === 1 ? 2 : k === -1 ? -4 : 0) : 0;
  }
  function cityScore(c, p) {
    return (c.w || 2) + (c.pop || 3) * 1.5 + hits(c.t) * 4 + (p.toddler && (c.t || []).indexOf("family") > -1 ? 2 : 0);
  }
  /* Suggesting the places of a trip (a country added from v151 on: rank 2). The best known and best liked come first;
     what the app knows well counts for more (ideas built in, its own street map); your trip style counts, but no
     longer outweighs how good a place is (a windy kite-surf town no more beats the famous beach cities). */
  function bestScore(c, p, country) {
    var ck = W.cityKey(country, c.name),
      pool = W.C.city[ck],
      built = builtIn(country, c);
    return (
      /* (the places with ideas built in are the famous ones; their entries carry no number of their own) */
      (c.pop || (built ? 5 : 2)) * 3 +
      (built ? 2 : 0) +
      (W.vtFor && c.lat != null && W.vtFor(country, c.name, c.lat, c.lng) ? 2 : 0) +
      (pool && pool.spots && pool.spots.length >= 12 ? 1 : 0) +
      /* each of your trip's styles a place is good for counts for more than a step in how well known it is, and a place
         good for none of them counts for less (a beach trip goes to the famous beach cities before the capital) */
      (W.S.styles.length ? (hits(c.t) ? hits(c.t) * 5 : -4) : 0) +
      (c.w || 2) * 0.5 +
      (p.toddler && (c.t || []).indexOf("family") > -1 ? 1 : 0)
    );
  }
  /* one of the places with ideas built in (or the main town of an island that has them, like Palma for Mallorca): the
     famous ones, whose entries carry no number of their own (also how the city box ranks what you type) */
  W.builtIn = builtIn;
  function builtIn(country, c) {
    return ((window.TD[country] || {}).cities || []).some(function (b) {
      return W.norm(b.name) === W.norm(c.name) || (!!c.isl && c.pop == null && W.norm(b.name) === W.norm(c.isl));
    });
  }
  /* a day trip, never a place to stay: one the country list says is a day trip; a park or a reserve, always; mountains, a
     lake, falls or a stretch of coast, unless it is a city by name (Salt Lake City) or the country list says it is a
     place to stay (the Gold Coast) */
  var PARK =
      /\b(national park|natural park|nature park|nature reserve|parque nacional|parque natural|parc national|parc naturel|parco nazionale|parco naturale|nationalpark|naturpark|reserve|reserva)\b/i,
    SCENERY =
      /\b(sierra|mountains?|massif|valley|valle|vall[ée]e|gorges?|canyon|caves?|lake|lago|lac|falls|waterfalls?|desert|volcano|glacier|forest|coast|costa|riviera|c[ôo]te|region|province)\b/i;
  /* (also the Plan's quick-add chips: a day trip is never offered as somewhere to stay) */
  W.dayTrip = dayTrip;
  function dayTrip(c) {
    var n = c.name || "";
    return !!c.day || PARK.test(n) || (!c.stay && SCENERY.test(n) && !/\b(city|town)\b/i.test(n));
  }

  /* where you sleep in a city: your lodging if set, otherwise the city center */
  W.homebase = function (country, city) {
    var ck = W.cityKey(country, city),
      st = W.S.stays[ck],
      pool = W.C.city[ck],
      c = W.findCity(country, city);
    if (st && st.lat != null) {
      /* a stay chosen by name (an area, or a hotel typed in) has a guessed pin: a checked one wins; one found far out
         in the water falls back to the city centre. A Booking.com pick's pin is the hotel's own. */
      var fx = !st.live && W.placeInfo ? W.placeInfo({ n: st.label }, country, city) : null;
      if (fx && fx.lat != null) return { label: st.label, n: st.label, lat: fx.lat, lng: fx.lng == null ? null : fx.lng, set: true };
      if (!(fx && fx.nopin)) return { label: st.label, n: st.label, lat: st.lat, lng: st.lng == null ? null : st.lng, set: true };
      var la = pool && pool.lat != null ? pool.lat : c && c.lat,
        lo = pool && pool.lng != null ? pool.lng : c && c.lng;
      /* (its pin was wrong: the plan reckons from the middle, but directions go by its name: pending) */
      return {
        label: st.label,
        n: st.label,
        city: city,
        lat: la == null ? null : la,
        lng: lo == null ? null : lo,
        set: true,
        pending: true
      };
    }
    /* no stay picked: the plan still starts and ends the day at the city's centre (so the times hold), but nothing on
       screen calls that an address: it is "your stay" (none: true), with no directions to it */
    var lat = pool && pool.lat != null ? pool.lat : c && c.lat,
      lng = pool && pool.lng != null ? pool.lng : c && c.lng;
    return {
      label: st && st.label ? st.label : "your stay",
      n: st && st.label ? st.label : "your stay",
      none: !(st && st.label),
      city: city,
      lat: lat == null ? null : lat,
      lng: lng == null ? null : lng,
      set: false,
      pending: !!(st && st.label)
    };
  };

  /* A stay typed by name whose place could not be found yet (no signal, or Claude busy) is asked for again, at most
     every two minutes while a screen that uses it is open; until then directions go by its name and town. */
  /** @type {Record<string, number>} */ var stayTried = {};
  W.stayRetry = function (country, city) {
    var ck = W.cityKey(country, city),
      st = W.S.stays[ck];
    if (!st || !st.label || st.lat != null || st.live || W.readOnly || !W.geocode) return;
    if ((W.offline && W.offline.off) || Date.now() - (stayTried[ck] || 0) < 120000) return;
    var gk = "geo|" + ck + "|" + W.norm(st.label);
    if (W.status[gk] === "loading") return;
    stayTried[ck] = Date.now();
    delete W.status[gk];
    var label = st.label;
    W.geocode(country, city, label, function (g) {
      var s2 = W.S.stays[ck];
      if (s2 && s2.label === label && s2.lat == null) {
        s2.lat = g.lat;
        s2.lng = g.lng;
        W.freshPicks(country, city);
        W.save();
        W.changed();
      }
    });
  };
  /* days you set for a place yourself (only for cities you chose, so the list can't shift under them) */
  function setDays(country, name) {
    var c = W.S.countries.filter(function (x) {
      return x.name === country;
    })[0];
    if (!c || c.mode !== "manual") return 0;
    var v = +(W.S.cityDays || {})[W.cityKey(country, name)];
    return v >= 1 ? Math.min(30, Math.round(v)) : 0;
  }

  /* ---------- stops ---------- */
  function stops(N, p, ap) {
    var perCity = p.toddler ? 4 : 3;
    /* a suggested country: days or lodging once set for a whole island go to the island's usual base, which now stands in for it */
    W.S.countries.forEach(function (c) {
      if (c.mode === "manual") return;
      Object.keys(W.S.cityDays || {})
        .concat(Object.keys(W.S.stays || {}))
        .forEach(function (k) {
          if (k.indexOf(c.name + "|") !== 0) return;
          var is = W.isleOf(c.name, k.slice(c.name.length + 1));
          if (is) W.isleSwap(c.name, k.slice(c.name.length + 1), is.towns[0].name);
        });
    });
    var manualCount = 0,
      fixedSum = 0,
      fixedCount = 0,
      suggest = [];
    W.S.countries.forEach(function (c) {
      if (c.mode !== "manual") {
        suggest.push(c);
        return;
      }
      manualCount += c.picked.length;
      c.picked.forEach(function (n) {
        var f = setDays(c.name, n);
        if (f) {
          fixedSum += f;
          fixedCount++;
        }
      });
    });
    /* suggested cities share only the days you haven't given to a place */
    var target = Math.max(1, fixedCount + Math.floor(Math.max(0, N - fixedSum) / perCity));
    var left = Math.max(suggest.length, target - manualCount),
      out = [];
    W.S.countries.forEach(function (c) {
      if (c.mode === "manual") {
        W.loadCountry(c.name);
        c.picked.forEach(function (n) {
          out.push({ country: c.name, name: n, c: W.findCity(c.name, n) || { name: n }, manual: true });
        });
        return;
      }
      var cities = W.countryCities(c.name);
      if (!cities.length) {
        W.loadCountry(c.name);
        return;
      }
      var share = Math.floor(left / suggest.length) + (suggest.indexOf(c) < left % suggest.length ? 1 : 0);
      /* the best-fitting places, but only ones within an easy journey (under 5 hours) of another place on the trip */
      /* a list that came best known first has its first places marked (top): the choice is made among them first, so a
         plan started on them stands when the rest of the list arrives */
      var best = (c.rank || 0) >= 2,
        cn = c.name,
        sorted = (
          best
            ? /* only places to stay, and among them the well-known ones (a lesser one only when too few are left) */
              (function () {
                var stay = cities.filter(function (x) {
                    return !dayTrip(x);
                  }),
                  pop = function (x) {
                    return x.pop || (builtIn(cn, x) ? 5 : 2);
                  },
                  /* the very well known (4 and 5 of 5) when there are plenty; then the well known; then any town */
                  top4 = stay.filter(function (x) {
                    return pop(x) >= 4;
                  }),
                  good = stay.filter(function (x) {
                    return pop(x) >= 3;
                  });
                return top4.length >= Math.max(3, share * 2)
                  ? top4
                  : good.length >= Math.max(2, share)
                    ? good
                    : stay.length
                      ? stay
                      : cities;
              })()
            : cities.slice()
        ).sort(function (a, b) {
          return best
            ? (b.top || 0) - (a.top || 0) || bestScore(b, p, cn) - bestScore(a, p, cn)
            : (b.top || 0) - (a.top || 0) || cityScore(b, p) - cityScore(a, p);
        }),
        ranked = [];
      /* one base on an island first; a second town on the same island only when the list would otherwise run short,
         and then only one a real journey away (Chania after Heraklion, never Oia after Fira) */
      for (var pass = 0; pass < 2 && ranked.length < Math.max(1, share); pass++) {
        for (var i = 0; i < sorted.length && ranked.length < Math.max(1, share); i++) {
          var cand = sorted[i];
          if (ranked.indexOf(cand) > -1) continue;
          if (
            cand.isl &&
            ranked.some(function (q) {
              return q.isl === cand.isl && (!pass || (W.km(q, cand) || 0) < 40);
            })
          )
            continue;
          if (
            ranked.length &&
            !ranked.some(function (q) {
              return legMin(c.name, q, cand) < 300;
            })
          )
            continue;
          ranked.push(cand);
        }
      }
      /* start with the one nearest where you arrive, then the shortest way round */
      var prev = out.length ? out[out.length - 1].c : ap;
      ranked.sort(function (a, b) {
        return (W.km(prev, a) || 0) - (W.km(prev, b) || 0);
      });
      var seq = ranked.map(function (x) {
        return { country: c.name, name: x.name, c: x };
      });
      if (W.bestOrder && seq.length > 2) seq = W.bestOrder(seq);
      seq.forEach(function (x) {
        out.push(x);
      });
    });
    return out.slice(0, N);
  }

  /* journey time between two places: the way Claude found if known, otherwise a rough guess from the distance */
  function legMin(country, a, b) {
    var lg =
      (W.C.legs && W.C.legs[W.legKey({ country: country, name: a.name }, { country: country, name: b.name })]) ||
      (W.C.legs && W.C.legs[W.legKey({ country: country, name: b.name }, { country: country, name: a.name })]);
    var o = lg && lg.opts && lg.opts[0],
      m = o && W.parseDur(o.dur);
    return m || W.guessLeg(W.km(a, b));
  }

  /* days per place: the ones you set stay as set, the rest share the remaining days. Returns the trip length. */
  function allocate(list, N, p) {
    var fixed = list.map(function (s) {
      return setDays(s.country, s.name);
    });
    var free = list.filter(function (s, i) {
      return !fixed[i];
    });
    var fixedSum = fixed.reduce(function (a, b) {
      return a + b;
    }, 0);
    list.forEach(function (s, i) {
      s.days = fixed[i];
      s.set = !!fixed[i];
    });
    if (!free.length) return fixedSum;
    var M = N - fixedSum;
    /* a place added after you set the others gets a couple of days rather than squeezing them */
    if (M < free.length * (fixedSum ? 2 : 1)) M = free.length * (fixedSum ? 2 : 1);
    var wts = free.map(function (s) {
      return (s.c.w || 2) + hits(s.c.t) * 0.8;
    }); /* places that fit your trip style get more days */
    var minD = M >= free.length * 3 ? 3 : M >= free.length * 2 ? 2 : 1,
      alloc = free.map(function () {
        return minD;
      }),
      rem = M - minD * free.length;
    var tot =
      wts.reduce(function (a, b) {
        return a + b;
      }, 0) || 1;
    var raw = wts.map(function (w) {
      return (rem * w) / tot;
    });
    raw.forEach(function (r, i) {
      alloc[i] += Math.floor(r);
    });
    var rest =
      M -
      alloc.reduce(function (a, b) {
        return a + b;
      }, 0);
    raw
      .map(function (r, i) {
        return [r - Math.floor(r), i];
      })
      .sort(function (a, b) {
        return b[0] - a[0];
      })
      .slice(0, rest)
      .forEach(function (x) {
        alloc[x[1]]++;
      });
    free.forEach(function (s, i) {
      s.days = alloc[i];
    });
    return fixedSum + M;
  }

  /* ---------- slots ---------- */
  if (W.S.algo !== 2) {
    W.S.picks = {};
    W.S.seen = {};
    W.S.algo = 2;
  }
  var SLOT_NAME = { breakfast: "Breakfast", am: "Morning", lunch: "Lunch", pm: "Afternoon", dinner: "Dinner", eve: "Evening" };
  W.SLOT_NAME = SLOT_NAME;
  W.isFood = function (slot) {
    return slot === "breakfast" || slot === "lunch" || slot === "dinner";
  };
  /* every day gets all three meals and all three activity slots */
  /** @returns {Slot[]} */
  function slotsFor() {
    return ["breakfast", "am", "lunch", "pm", "dinner", "eve"];
  }
  /* breakfast: places marked for breakfast, or cafés and bakeries that aren't dinner-only */
  function breakfastOK(item) {
    if (item.meal === "breakfast" || item.meal === "all") return 2;
    if (item.meal === "dinner" || item.mealOk) return 0; /* (a checked record's meals hold, whatever the name says) */
    var k = W.picKind ? W.picKind(item, true) : "";
    return k === "cafe" ||
      k === "bakery" ||
      /breakfast|brunch|bakery|caf[eé]|coffee|pastry|bougatsa|croissant/i.test(item.n + " " + item.d + " " + (item.cuisine || ""))
      ? 1
      : 0;
  }
  /* afternoon places that also make a good evening: strolls, views, waterfronts */
  var EVENING_OK = ["viewpoint", "oldtown", "square", "harbor", "beach", "park", "bridge", "nightlife", "market"];
  /* a gelateria or a sweet shop is a treat, never lunch or dinner for a family (whatever the list says); a bakery or pastry
     shop can do a quick lunch, not dinner */
  var TREAT =
    /\b(gelato|gelateria|gelaterie|ice[- ]?cream|glacier|helader[ií]a|dessert|desserts|cr[eê]pe|cr[eê]perie|donuts?|churros|sweets|sweet shop|chocolaterie|juice bar|smoothies?|frozen yogh?urt|loukoumades)\b/i;
  var BAKE = /\b(bakery|bakeries|boulangerie|panader[ií]a|patisserie|p[aâ]tisserie|pasticceria|pastry|pastries|bougatsa|fournos)\b/i;
  function fits(item, slot) {
    if (slot === "breakfast") return breakfastOK(item);
    if ((slot === "lunch" || slot === "dinner") && TREAT.test(item.n + " " + (item.cuisine || ""))) return false;
    if (slot === "dinner" && BAKE.test(item.n + " " + (item.cuisine || ""))) return false;
    if (slot === "lunch") return item.meal !== "dinner" && item.meal !== "breakfast";
    if (slot === "dinner") return item.meal !== "lunch" && item.meal !== "breakfast";
    /* a sight: the data's own part of the day first; then the kind of place (a show is for the evening, a hike for the morning) */
    var c = W.classify(item, false),
      pref = c.slots.indexOf(slot) > -1;
    if (slot === "am") return item.s === "am" || item.s === "any" ? 2 : item.s === "pm" ? (pref ? 1 : 0) : pref ? 2 : 0;
    if (slot === "pm")
      return item.s === "pm" ? 2 : item.s === "am" ? (pref ? 1 : 0) : item.s === "eve" || item.s === "any" ? 0 : pref ? 2 : 0;
    if (slot === "eve")
      return item.s === "eve"
        ? 2
        : item.s === "any" || item.s === "am"
          ? 0
          : pref || (item.s === "pm" && EVENING_OK.indexOf(c.kind) > -1)
            ? 1
            : 0;
  }
  /** does this place serve that meal? (lib/ideas.js brings in places for the meals a stay leaves empty)
      @param {Food} item @param {string} meal */
  W.mealFits = function (item, meal) {
    return W.isFood(meal) && !!fits(item, meal);
  };
  /** a part of a day the ideas did not fill: nothing on it, and not left open by the clock (cut), by you (free), by a
      rest day, or because the lists are still on their way @param {SlotEntry} x */
  W.slotShort = function (x) {
    return !x.item && !x.cut && !x.free && !x.rest && !x.loading;
  };
  /* Geography. Each city gets a "day radius" sized to how spread out its places are:
     about 2 km in a compact city, up to ~25 km on a big island or region. A day's first stop is
     picked close to your lodging; every later stop has to sit near the stops already chosen that day. */
  function geoScale(pool, home) {
    var ds = (pool.spots || [])
      .map(function (x) {
        return W.km(home, x);
      })
      .filter(function (d) {
        return d != null;
      })
      .sort(function (a, b) {
        return a - b;
      });
    var med = ds.length ? ds[Math.floor(ds.length / 2)] : 3;
    return { med: Math.max(1.5, med), R: Math.max(2, Math.min(18, med * 0.25)) };
  }
  function centroid(pts) {
    if (!pts.length) return null;
    return {
      lat:
        pts.reduce(function (a, p) {
          return a + p.lat;
        }, 0) / pts.length,
      lng:
        pts.reduce(function (a, p) {
          return a + p.lng;
        }, 0) / pts.length
    };
  }
  /* Rule 4, a day stays in one area, for one more stop on a day (lib/rules.js checks the finished day the same way).
     The morning, lunch and the afternoon lie within four day radii of each other; breakfast, dinner and the evening
     are near the stay, or (unless the day is a day out) in the day's area. Only a day out goes farther from the stay
     than the town's ideas usually are. ctx.core: the planner's own pinned morning, lunch and afternoon stops already
     on the day; ctx.away: the day is a day trip or a day out. */
  function areaOK(item, slot, ctx) {
    if (item.lat == null || item.lng == null) return true;
    var lim = 4 * ctx.geo.R,
      core = ctx.core || [],
      hk = ctx.home.lat != null && ctx.home.lng != null ? W.km(ctx.home, item) : null;
    if (slot === "am" || slot === "lunch" || slot === "pm") {
      for (var i = 0; i < core.length; i++) if ((W.km(core[i], item) || 0) > lim) return false;
      var out = ctx.away || (slot === "am" && ctx.allowFull && W.isDayOut(item, slot));
      return out || hk == null || hk <= Math.max(6 * ctx.geo.R, 2 * ctx.geo.med);
    }
    if (hk == null || hk <= lim) return true;
    if (ctx.away) return false;
    for (var j = 0; j < core.length; j++) if ((W.km(core[j], item) || 0) <= lim) return true;
    return false;
  }
  /* ctx: { home, prev (point before this slot), pts (other stops already on this day), geo, allowFull } */
  function geoPenalty(item, slot, ctx, strict) {
    /* (a pin missing its other half counts as no pin) */
    if (item.lat == null || item.lng == null || ctx.home.lat == null || ctx.home.lng == null) return 2;
    if (!areaOK(item, slot, ctx)) return null;
    var R = ctx.geo.R,
      food = W.isFood(slot);
    if (!ctx.pts.length) {
      var dh = W.km(ctx.home, item) || 0; /* (both pins are there, checked above) */
      if (slot === "am" && W.isDayOut(item, slot)) return Math.min(8, (dh / 40) * 3); /* a day trip: allowed to go far */
      if (strict && dh > Math.max(3 * R, ctx.geo.med * 1.5)) return null;
      if (dh > Math.max(6 * R, ctx.geo.med * 2)) return null; /* never a cross-region trek for one slot */
      /* arrival, travel and departure days stay close to your lodging */
      return (dh / R) * (ctx.light ? 6 : 3);
    }
    var dPrev = W.km(ctx.prev, item) || 0,
      dCen = W.km(centroid(ctx.pts), item) || 0,
      d = dPrev * 0.6 + dCen * 0.4;
    var r = food ? R * 0.6 : R;
    if (strict && (dPrev > 2 * R || dCen > 2 * R)) return null;
    if (dPrev > 4 * R) return null; /* nothing close: leave it free rather than send you far */
    return (d / r) * (food ? 5 : 6);
  }
  function score(item, idx, len, slot, ctx, p, strict) {
    var f = fits(item, slot);
    if (!f) return null;
    if (item.s === "any" && slot === "am" && !ctx.allowFull) return null;
    if (W.gone(item)) return null; /* closed for good, or the check found no such place */
    if (W.V.vague(item.n, W.isFood(slot))) return null; /* not one real place (V.vague): from a list kept from before */
    if (!W.isFood(slot) && W.V.trainRide(item.n)) return null; /* a train journey is not a thing to do (rule 5) */
    /* the group's food needs: a place that can't feed them is never planned; one that clearly can is a little ahead */
    var eatF = W.isFood(slot) && W.eatFit ? W.eatFit(item) : "",
      /* what you love counts for more than a good rating (a place for it: +7; one with some of it: +3) */
      eatL = W.isFood(slot) && W.eatLike ? W.eatLike(item) : 0,
      eatB = (eatF === "good" ? 3 : eatF === "ok" ? 0.5 : 0) + (eatL === 2 ? 7 : eatL === 1 ? 3 : 0);
    if (eatF === "poor") return null;
    /* the first days after a long flight: no timed entries first thing */
    if (ctx.jet && slot === "am" && W.needsBooking(item)) return null;
    /* a rest day's one outing: something easy close to your lodging */
    if (ctx.rest && slot === "pm") {
      var easy = (item.t || []).some(function (t) {
        return /relax|beach|nature|family|wellness|scenic/.test(t);
      });
      if (!easy || (W.km(ctx.home, item) || 0) > Math.max(1.5, ctx.geo.R)) return null;
      if (W.classify(item, false).intensity >= 2) return null; /* (a boat tour or a play park is no rest) */
    }
    /* shut that day of the week */
    if (item.hours && ctx.wd != null && item.hours.closed.indexOf(ctx.wd) > -1) return null;
    if (ctx.n != null && W.shutOn(item, ctx.n)) return null; /* shut for a stretch that takes in this day (lib/places.js) */
    if (ctx.hol && ctx.hol.length && ctx.sun && item.hours && item.hours.closed.indexOf(0) > -1)
      return null; /* a public holiday keeps Sunday hours */
    if (W.shutBy(item.hours, slot)) return null; /* already shut by then (a museum for the evening) */
    /* with children where locals dine late: dinner places that open early win */
    var early = 0,
      h = item.hours;
    if (slot === "dinner" && ctx.kd != null && h && h.o < 1440) early = h.o > ctx.kd + 30 ? -9 : h.o <= ctx.kd ? 2 : 0;
    var g = geoPenalty(item, slot, ctx, strict);
    if (g == null) return null;
    var c = W.isFood(slot) ? null : W.classify(item, false),
      shape = 0;
    if (c) {
      /* a day has one big thing in it: a hike or a day trip after a strenuous morning is too much, doubly so with small children */
      if (ctx.big && (c.intensity >= 3 || c.min >= 240)) shape -= p.toddler ? 12 : 6;
      /* after a toddler's nap, the afternoon is something calm; the evening is never strenuous */
      if (p.toddler && slot === "pm" && c.intensity >= 2) shape -= 4;
      if (slot === "eve" && c.intensity >= 2) shape -= 6;
      if (p.kid && c.adults) shape -= 8; /* wine tastings are not for the children */
      /* grandparents along: steep climbs, long hikes and gorges are left out; moderate ones are a last resort */
      if (p.senior) {
        if (c.intensity >= 3) return null;
        else if (c.intensity === 2) shape -= 2;
      } /* a long hike or a gorge is left out, not merely marked down */
      /* the clock: would it still fit before the next meal, with the journey there? */
      if (ctx.at != null) {
        var lg = W.legEst(ctx.prev, item),
          start = ctx.at + (lg ? lg.min : 10),
          next = slot === "am" ? ctx.lunchAt : slot === "pm" ? ctx.dinnerAt : ctx.eveCap;
        if (next && item.s !== "any") {
          var over = start + Math.min(c.min, 240) - next;
          if (over > 90) shape -= 5;
          else if (over > 30) shape -= 2;
        }
      }
      /* a strenuous outing on a hot summer afternoon */
      if (ctx.hot && slot === "pm" && !c.indoor && c.intensity >= 2 && c.kind !== "beach" && c.kind !== "waterpark") shape -= 4;
    }
    /* the city's headline sights (first in its list) stay in the running whatever the trip style; with a rating, the focus decides */
    var top = !W.isFood(slot) && idx < 5 && item.fame === undefined && (W.focus ? W.focus() : "icons") !== "gems" ? 4 : 0;
    /* family hearts from a shared trip */
    var heart = W.heartsFor && W.heartsFor(item) ? 4 : 0;
    /* a place the check confirmed is a safer bet than one nobody has checked yet; a restaurant especially */
    var checked = item.st === "open" ? 3 : item.st === "unsure" ? -3 : item.st === "unverified" ? (W.isFood(slot) ? -10 : -4) : 0;
    /* with little kids: calm, shallow beaches first; rough or deep ones only if nothing better is near */
    var bf = p.kid && !W.isFood(slot) && W.beachFit ? W.beachFit(item) : "",
      beach = bf === "safe" ? 4 : bf === "care" ? (p.toddler ? -9 : -5) : 0;
    return (
      eatB +
      (W.isFood(slot) ? foodStyle(item) : styleScore(item.t)) +
      top +
      focusScore(item, idx, W.isFood(slot)) +
      kidScore(item.k, p) +
      (f === 2 ? 4 : 0) +
      ((len - idx) / len) * 3 -
      g +
      early +
      heart +
      beach +
      shape +
      checked
    );
  }
  /* the same place under another name: lists asked for in several goes come back with "Liston Promenade", "Liston
     Promenade Evening Stroll" and "Liston Promenade Evening Stroll and Gelato", or "Rouvas Restaurant" and "Rouvas
     Taverna". A place key keeps a name's own words (not "evening", "stroll", "restaurant", "old town"...), spelled
     loosely ("Palaeopolis" = "Palaiopolis"), and the planner never puts two places with one key on the same trip. */
  var PK_GEN = {};
  (
    "a an and the of at in on to by for with from di de del della la le il el les des du da dei degli ta tou tis " +
    "promenade evening stroll walk walking gelato ice cream breakfast brunch lunch dinner dessert swim swimming snorkel sunset sunrise " +
    "seafront waterfront restaurant ristorante taverna tavern trattoria osteria cafe caffe cafes bar bistro grill old town visit tour trip " +
    "day half kids family local short easy morning afternoon night view views viewpoint time free experience tasting class picnic shopping " +
    "area quarter district neighborhood neighbourhood traditional authentic classic best famous little"
  )
    .split(" ")
    .forEach(function (w) {
      PK_GEN[w] = 1;
    });
  function skel(w) {
    return w.length < 5
      ? w
      : w.charAt(0) +
          w
            .slice(1)
            .replace(/[aeiouy]/g, "")
            .replace(/(.)\1+/g, "$1");
  }
  W.placeKey = function (it) {
    if (!it || !it.n) return "";
    if (it._pk && it._pkn === it.n) return it._pk;
    var words = W.norm(String(it.n).replace(/\([^)]*\)/g, " "))
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    var own = words
      .filter(function (w) {
        return !PK_GEN[w];
      })
      .map(skel); /* in order: "13-6" is not "6-13" */
    var k = ("cuisine" in it || "meal" in it ? "f:" : "s:") + (own.length ? own.join(" ") : words.join(" "));
    try {
      Object.defineProperty(it, "_pk", { value: k, writable: true, configurable: true, enumerable: false });
      Object.defineProperty(it, "_pkn", { value: it.n, writable: true, configurable: true, enumerable: false });
    } catch (e) {}
    return k;
  };
  /** Every name a place goes by in a stop's map of what is planned: its own name; its name's own words (placeKey);
   *  Google's place ID, once the check has matched it (two names for one restaurant: "Taverna Axiotissa", "Axiotissa");
   *  and, for a thing to do, the real place where it happens ("Venetian Kastro of Naxos", "Naxos Old Town and Kastro
   *  wander" and "Venetian Kastro and Bazaar" are all the Kastro: one visit, not three). A real place that is only the
   *  town itself ("Naxos Town") says nothing, so it is left out: the stop's town words ride on the map (newUsed).
   *  @param {Record<string, any>} used @param {any} it */
  function keysOf(used, it) {
    var ks = [W.norm(it.n), "@" + W.placeKey(it)];
    if (it.gid) ks.push("g:" + it.gid);
    var food = "cuisine" in it || "meal" in it;
    if (!food && it.place && typeof it.place === "string") {
      var pk = W.placeKey({ n: it.place }).slice(2),
        town = /** @type {Record<string, number> | undefined} */ (used._town),
        own = pk.split(" ").filter(function (w) {
          return w && !(town && town[w]) && !PLACE_GEN[w];
        });
      if (own.length) ks.push("#" + own.join(" "));
    }
    return ks;
  }
  /* words that name a kind of place, not a place: a real place made only of these and the town's name is the town */
  var PLACE_GEN = {};
  "town chora centre center city village port harbour harbor marina beach beaches coast island centro citta"
    .split(" ")
    .forEach(function (w) {
      PLACE_GEN[skel(w)] = 1; /* (as placeKey writes its words) */
    });
  /** a stop's map of what is planned, knowing its town's words (not listed among its keys) @param {string} town */
  function newUsed(town) {
    /** @type {Record<string, any>} */ var u = {},
      words = /** @type {Record<string, number>} */ ({});
    W.norm(town || "")
      .split(" ")
      .forEach(function (w) {
        if (w) words[skel(w)] = 1;
      });
    try {
      Object.defineProperty(u, "_town", { value: words, enumerable: false });
    } catch (e) {
      /* (a frozen object: no town words, so a real place that is only the town counts as a place) */
    }
    return u;
  }
  /** a copy of a stop's map to try things on (bare: an empty one), knowing the same town words
      @param {Record<string, any>} used @param {boolean} [bare] */
  function likeUsed(used, bare) {
    /** @type {Record<string, any>} */ var u = {};
    try {
      Object.defineProperty(u, "_town", { value: used._town || {}, enumerable: false });
    } catch (e) {}
    return bare ? u : Object.assign(u, used);
  }
  function isUsed(used, it) {
    return keysOf(used, it).some(function (k) {
      return !!used[k];
    });
  }
  function usedHere(used, it) {
    return keysOf(used, it).some(function (k) {
      return !!used[k] && String(used[k]).charAt(0) !== "~";
    });
  }
  function mark(used, it, k) {
    keysOf(used, it).forEach(function (q) {
      used[q] = k;
    });
  }
  function unmark(used, it, k) {
    keysOf(used, it).forEach(function (q) {
      if (used[q] === k) delete used[q];
    });
  }
  /** booked: ticked as booked on Prepare, or matched by a booking of yours for that day. A booked place is yours like
      one you chose by hand: the planner never moves it or takes it off. @param {Day} d @param {any} it */
  function booked(d, it) {
    var S = W.S,
      t = S.booked ? S.booked["item|" + W.cityKey(d.country, d.city) + "|" + W.norm(it.n)] : undefined;
    if (t === 1) return true;
    return t !== 0 && !!(S.bookings && S.bookings.length && W.bookingFor && W.bookingFor(it, d));
  }
  /** what the owner put there by hand (rule 9): the planner works around it @param {Day} d @param {SlotEntry} x */
  function held(d, x) {
    return !!mine()[x.key] || (!!x.item && booked(d, x.item));
  }
  function byName(list, n) {
    var k = W.norm(n);
    return (
      list.filter(function (x) {
        return W.norm(x.n) === k;
      })[0] || null
    );
  }
  function key(day, slot) {
    return day.country + "|" + day.city + "|" + day.dayInCity + "|" + slot;
  }

  /* ---------- "not for us" ---------- */
  /* A place the family said no to is never planned or offered again in that city on this trip. S.nope holds
     "<country>|<city>|<place key>": "<name>" (the city whose list it came from: on a day trip, the other town).
     Putting it on a day yourself later takes it off the list. */
  function nopes() {
    var o = W.S.nope;
    return o && typeof o === "object" ? o : {};
  }
  function poolCity(d, x) {
    return x && x.trip && d.trip ? [d.trip.country, d.trip.name] : [d.country, d.city];
  }
  W.nopeKey = function (country, city, it) {
    return country + "|" + city + "|" + W.placeKey(it);
  };
  W.isNope = function (country, city, it) {
    return !!nopes()[W.nopeKey(country, city, it)];
  };
  W.nopeList = function (country, city) {
    var pre = country + "|" + city + "|",
      o = nopes();
    return Object.keys(o)
      .filter(function (k) {
        return k.indexOf(pre) === 0 && typeof o[k] === "string";
      })
      .map(function (k) {
        return { k: k, n: o[k] };
      });
  };
  W.unNope = function (k) {
    if (W.S.nope) delete W.S.nope[k];
  };
  function unNopeName(d, x, name) {
    var all = W.S.nope;
    if (!all) return;
    var o = all,
      pc = poolCity(d, x),
      pre = pc[0] + "|" + pc[1] + "|",
      n = W.norm(name);
    Object.keys(o).forEach(function (k) {
      if (k.indexOf(pre) === 0 && W.norm(o[k]) === n) delete o[k];
    });
  }
  /* the planner's list of what is taken: what you said no to counts as taken (marked "~" like an earlier stop's place,
     so a place you put on a day by hand still stays) */
  function markNope(used, s, cdays) {
    var o = nopes(),
      pres = [s.country + "|" + s.name + "|"];
    cdays.forEach(function (d) {
      if (d.trip) pres.push(d.trip.country + "|" + d.trip.name + "|");
    });
    Object.keys(o).forEach(function (k) {
      var pre = pres.filter(function (p) {
        return k.indexOf(p) === 0;
      })[0];
      if (!pre || typeof o[k] !== "string") return;
      var pk = k.slice(pre.length),
        nn = W.norm(o[k]);
      if (pk && !used["@" + pk]) used["@" + pk] = "~no";
      if (nn && !used[nn]) used[nn] = "~no";
    });
  }

  /* best idea for a slot that isn't used elsewhere and wasn't rerolled away; nearby first, then anywhere */
  function choose(pool, slot, used, seen, ctx, p, strictOnly) {
    var list = W.isFood(slot) ? pool.food || [] : pool.spots || [];
    for (var pass = 0; pass < (strictOnly ? 1 : 2); pass++) {
      var best = /** @type {Spot | Food | null} */ (null) /* (set in the loop below) */,
        bs = -1e9;
      list.forEach(function (it, i) {
        var k = W.norm(it.n);
        if (isUsed(used, it) || seen.indexOf(k) > -1) return;
        var sc = score(it, i, list.length, slot, ctx, p, pass === 0);
        if (sc != null && sc > bs) {
          bs = sc;
          best = it;
        }
      });
      if (best) return best;
    }
    return null;
  }
  /* every idea that could go in a slot, best first: the ones close by in the order choose() would take them, then
     the ones a little farther (for the fit pass, which tries each against the day's clock until one fits) */
  function ranked(pool, slot, used, seen, ctx, p) {
    var list = W.isFood(slot) ? pool.food || [] : pool.spots || [],
      out = [],
      have = {};
    [true, false].forEach(function (strict) {
      var sc = [];
      list.forEach(function (it, i) {
        var k = W.norm(it.n);
        if (have[k] || isUsed(used, it) || seen.indexOf(k) > -1) return;
        var v = score(it, i, list.length, slot, ctx, p, strict);
        if (v != null) sc.push([v, i, it]);
      });
      sc.sort(function (a, b) {
        return b[0] - a[0] || a[1] - b[1];
      }).forEach(function (q) {
        have[W.norm(q[2].n)] = 1;
        out.push(q[2]);
      });
    });
    return out;
  }
  /* geographic context for one slot, from the other stops already on that day */
  var CUR = null; /* the plan being built or repaired, so a slot's context can read the day's clock */
  function ctxFor(day, x, home, geo, allowFull) {
    var pts = [],
      prev = home,
      idx = day.slots.indexOf(x),
      big = false;
    var afterFull = day.fullDay && (x.slot === "dinner" || x.slot === "eve"),
      core = [],
      away = !!day.trip;
    day.slots.forEach(function (o, i) {
      if (o === x || !o.item) return;
      if (o.slot === "am" && W.isDayOut(o.item, "am")) away = true;
      if ((o.slot === "am" || o.slot === "lunch" || o.slot === "pm") && o.item.lat != null && o.item.lng != null && !held(day, o))
        core.push(o.item);
      if (!W.isFood(o.slot)) {
        var c = W.classify(o.item, false);
        if (c.intensity >= 3 || c.min >= 240 || o.item.s === "any") big = true;
      }
      if (o.item.lat == null) return;
      if (!!o.trip !== !!x.trip) return; /* on a day trip, the stops there and the evening back at base are two separate areas */
      if (afterFull && o.item.s === "any") return; /* after a day trip, the evening is back near home */
      pts.push(o.item);
      if (i < idx) prev = o.item;
    });
    if (afterFull) {
      pts = pts.length ? pts : [];
      prev = pts.length ? prev : home;
    }
    /* where the clock stands when this slot would start, from what is already on the day */
    var p = W.party(),
      at = null,
      T = null,
      mo = (W.dateOf(day.n) || new Date()).getMonth();
    try {
      T = W.dayTimes(day, CUR || { p: p, stops: [], days: [] });
    } catch (e) {
      T = null;
    }
    if (T) {
      var before = null;
      (T.order || []).some(function (sl) {
        if (sl === x.slot) return true;
        var R = T.rows[sl];
        if (R && R.end && !R.skip) before = R.end;
        return false;
      });
      at = before;
      if (x.slot === "pm" && T.nap) at = Math.max(at || 0, T.nap.end);
    }
    var M = W.mealsFor ? W.mealsFor(day.country) : null;
    return {
      home: home,
      prev: prev,
      pts: pts,
      geo: geo,
      core: core,
      away: away,
      allowFull: allowFull,
      light: !!(day.tripFirst || day.moveFrom || day.tripLast || day.jet),
      wd: W.weekday(day.n),
      n: day.n,
      hol: W.dayHolidays ? W.dayHolidays(day) : [],
      sun: W.holidaySunday ? W.holidaySunday(day.country) : true,
      kd: W.kidDinner(),
      jet: !!day.jet,
      rest: !!day.rest,
      big: big,
      at: at,
      lunchAt: M ? (p.kid ? Math.max(12 * 60, M[0] - 60) : M[0]) : 12 * 60 + 30,
      dinnerAt: W.kidDinner() || (M ? M[1] : 19 * 60),
      eveCap: p.toddler ? 20 * 60 : p.kid ? 20 * 60 + 45 : 22 * 60 + 30,
      hot: mo >= 5 && mo <= 8 && /Greece|Italy|Spain|Portugal|Turkey|Croatia|Afghanistan|Egypt|Morocco/.test(day.country)
    };
  }
  function remaining(pool, slot, used) {
    var list = W.isFood(slot) ? pool.food || [] : pool.spots || [];
    return list.filter(function (it) {
      return !isUsed(used, it) && fits(it, slot);
    }).length;
  }

  /* ---------- the whole trip ---------- */
  /* where a slot's ideas come from: the city's own list, or on a day trip (morning, lunch, afternoon) the other town's */
  var GEO = {};
  function dayPool(d, x, s) {
    if (x && x.trip && d.trip) {
      var tp = W.pool(d.trip.country, d.trip.name);
      if (tp) {
        var th = W.homebase(d.trip.country, d.trip.name),
          gk = W.cityKey(d.trip.country, d.trip.name);
        return { pool: tp, home: th, geo: GEO[gk] || (GEO[gk] = geoScale(tp, th)), trip: true };
      }
    }
    var st = s || (CUR && CUR.stops[d.stop]) || {},
      pool = W.pool(d.country, d.city),
      home = W.homebase(d.country, d.city);
    return { pool: pool, home: home, geo: st.geo || (pool ? geoScale(pool, home) : { med: 3, R: 2 }), trip: false };
  }
  W.dayPool = function (d, slot, P) {
    var x = (d.slots || []).filter(function (y) {
      return y.slot === slot;
    })[0];
    return dayPool(d, x, P && P.stops[d.stop]);
  };
  /* The plan is rebuilt only when something it depends on changed: the trip state (less the keys that only say what the
     screen shows), the cached city lists and journeys (W.dataV goes up when any arrive), and the day. Opening a sheet or
     ticking a booking re-renders without re-planning, which is most taps. */
  var memo = null,
    VIEW_ONLY = [
      "day",
      "transitOpen",
      "stepClosed",
      "tripFolded",
      "mapZoom",
      "jetOpen",
      "nextHide",
      "tview",
      "exF",
      "exSort",
      "prepTab",
      "pack",
      "packHide",
      "packOwn",
      "journal" /* (trips from before v176 keep theirs, unused) */,
      "names",
      "kidPicks",
      "hunt",
      "stamps",
      "celebrated",
      "warmSeen",
      "bag",
      "ct" /* (when each thing was changed, for joining your devices' copies: lib/sync.js) */
    ];
  function planSig() {
    var o = {},
      S = W.S;
    for (var k in S) if (VIEW_ONLY.indexOf(k) < 0) o[k] = S[k];
    return (
      (W.dataV || 0) + "|" + (W.isExample ? 1 : 0) + (W.readOnly ? 1 : 0) + "|" + (W.now ? W.isoDay(W.now()) : "") + "|" + JSON.stringify(o)
    );
  }
  W.plan = function () {
    var sig = planSig();
    if (memo && memo.sig === sig) return memo.P;
    var was = Object.assign({}, W.S.picks),
      P = planNow(),
      now = W.S.picks || {},
      wrote = W.planWrote || (W.planWrote = {});
    /* which picks this planning wrote or took off: they are the planner's, not a person's change (lib/sync.js sends
       and stamps only what a person changed, and reads this to tell the two apart) */
    Object.keys(now).forEach(function (k) {
      if (now[k] !== was[k]) wrote[k] = now[k];
    });
    Object.keys(was).forEach(function (k) {
      if (!(k in now)) wrote[k] = null;
    });
    memo = { sig: planSig(), P: P }; /* planning writes its picks into the state; the signature is taken after */
    return P;
  };
  W.replan = function () {
    memo = null;
  };
  /** whether W.plan() would hand back the plan it has (nothing it depends on changed since) */
  W.planFresh = function () {
    return !!memo && memo.sig === planSig();
  };
  function planNow() {
    var S = W.S,
      p = W.party(),
      N = Math.max(1, Math.min(60, +S.days || 10)),
      ap = W.airport();
    var st = stops(N, p, ap);
    if (!st.length) return { stops: [], days: [], N: N, p: p, ap: ap };
    N = allocate(st, N, p);
    /* the trip as a whole: enough nights per place for this group, day trips instead of extra hotel moves */
    if (W.shapeTrip) {
      st = W.shapeTrip(st, N, p);
      N = st.reduce(function (a, s) {
        return a + s.days;
      }, 0);
    }
    if (N !== +S.days) S.days = N; /* the trip is as long as the days you gave each place */
    var days = [],
      n = 0,
      jl = W.jetlag({ stops: st, ap: ap }),
      fitted = {};
    CUR = { p: p, stops: st, days: days, ap: ap };
    st.forEach(function (s, si) {
      for (var d = 0; d < s.days; d++) {
        n++;
        days.push({
          n: n,
          country: s.country,
          city: s.name,
          dayInCity: d + 1,
          stop: si,
          tripFirst: n === 1,
          tripLast: n === N,
          moveFrom: d === 0 && si > 0 ? st[si - 1].name : null,
          jet: n <= jl.days
        });
        var dd = days[days.length - 1],
          mt = (W.S.dayTrip || {})[W.restKey(dd)];
        /* a day you made a day trip ("Make it a day trip", screens/daytrip.js): not the arrival or packing day */
        if (mt && typeof mt.name === "string" && mt.name.trim() && !dd.tripFirst && !dd.tripLast && !dd.moveFrom) dd.mineTrip = mt;
        dd.rest = !dd.mineTrip && W.isRest(dd);
      }
      var sdays = days.filter(function (d) {
        return d.stop === si;
      });
      if (W.placeTrips) W.placeTrips(s, sdays); /* (the planner's own day trips keep off yours) */
      sdays.forEach(function (d) {
        var m = d.mineTrip;
        var num = function (v) {
          return typeof v === "number" && isFinite(v) ? v : null;
        };
        if (m)
          d.trip = {
            country: d.country,
            name: m.name.trim().slice(0, 60),
            lat: num(m.lat),
            lng: num(m.lng),
            min: num(m.min),
            why: "mine",
            mine: 1,
            planned: true
          };
      });
    });

    /* Fill each city's days from its own pool, in three rounds over the stops. Round 0 lays out every stop's days.
       Round 1 puts back what you chose by hand, on the whole trip, before the planner chooses anything anywhere.
       Round 2 puts back the planner's own picks and fills the rest, stop by stop. Stops that draw on the same town (two stays in
       one town, a town stayed in and also visited for a day from another) or lie close together (two stays on one
       island) share one map of what is planned, so a place is planned once among them (rule 3), also when the fit
       pass changes an earlier stop's day after a later stop was filled. */
    var before = [];
    [0, 1, 2].forEach(function (round) {
      st.forEach(function (s, si) {
        var found = W.pool(s.country, s.name);
        var cdays = days.filter(function (d) {
          return d.stop === si;
        });
        if (!found) {
          if (round) return;
          W.loadCity(s.country, s.name, false, s.days);
          cdays.forEach(function (d) {
            d.loading = true;
            d.slots = [];
          });
          return;
        }
        var pool = found;
        if (round === 0 && !pool.fallback && W.loadEatFit) {
          W.loadEatFit(s.country, s.name); /* the group's food needs: check these places */
          if (W.loadLoved) W.loadLoved(s.country, s.name); /* and a few places for what you love, if the list has few */
        }
        if (round === 0 && !pool.fallback && W.loadFame)
          W.loadFame(s.country, s.name); /* ratings for the ideas already there (no new ones) */
        var home = W.homebase(s.country, s.name),
          used = round ? s.used : newUsed(s.name);
        if (!round)
          cdays.forEach(function (d) {
            d.slots = slotsFor().map(function (sl) {
              var k = key(d, sl);
              return {
                slot: sl,
                key: k,
                rest: d.rest && (sl === "am" || sl === "eve"),
                free: !!(W.S.free || {})[k],
                trip: !!(d.trip && (sl === "am" || sl === "lunch" || sl === "pm"))
              };
            });
            /* a day trip: the morning, lunch and afternoon come from the other town's list (fetched if needed) */
            if (d.trip) {
              d.fullDay = true;
              if (!W.pool(d.trip.country, d.trip.name)) {
                W.loadCity(d.trip.country, d.trip.name);
                d.slots.forEach(function (x) {
                  if (x.trip) x.loading = true;
                });
              }
            }
          });
        if (round === 0) {
          /* (the towns this stop's days draw on: its own, and the ones it visits for a day) */
          var towns = {};
          towns[W.cityKey(s.country, s.name)] = 1;
          cdays.forEach(function (d) {
            if (d.trip) towns[W.cityKey(d.trip.country, d.trip.name)] = 1;
          });
          before.forEach(function (b) {
            var dk = W.km(b.home, home); /* null when either has no pin */
            /* (a town seen on a day trip from an earlier stop and stayed in later, or the other way round, is one town) */
            var shared = Object.keys(b.towns).some(function (k) {
              return !!towns[k];
            });
            if (!(shared || (dk != null && dk <= 40)) || b.used === used) return;
            /* one map for both from here on: what this one holds so far joins it, and every earlier stop that was on
             this one's map (a stop that ties two groups together) moves over with it */
            var old = used,
              into = b.used;
            Object.keys(old).forEach(function (k) {
              if (!into[k]) into[k] = old[k];
            });
            Object.keys(old._town || {}).forEach(function (w) {
              if (into._town) into._town[w] = 1;
            });
            before.forEach(function (e) {
              if (e.used === old) e.used = into;
            });
            st.forEach(function (o) {
              if (o.used === old) o.used = into;
            });
            used = into;
          });
          /* (the words of every town the map serves: a real place that is only one of them names no place, keysOf) */
          Object.keys(towns).forEach(function (ck) {
            W.norm(ck.slice(ck.indexOf("|") + 1))
              .split(" ")
              .forEach(function (w) {
                if (w && used._town) used._town[skel(w)] = 1;
              });
          });
          markNope(used, s, cdays);
          s.used = used;
          s.geo = geoScale(pool, home);
          before.push({ city: W.cityKey(s.country, s.name), home: home, used: used, towns: towns });
        }
        /* reserve the picks you already have: first what you put there by hand (chosen, or booked), so nothing the
         planner chose can take its place; then the planner's own */
        if (round === 0) return;
        [round === 1].forEach(function (handPass) {
          cdays.forEach(function (d) {
            d.slots.forEach(function (x) {
              if (x.rest || x.free || x.loading || x.item || x.lost)
                return; /* a rest day keeps its morning and evening free (your picks come back if you undo it); a slot you cleared stays free */
              var pl = dayPool(d, x, s),
                lp = pl.pool || pool /* (a day trip's town, else this stop's own list: a day's town is its stop's) */,
                nm = S.picks[x.key],
                food = W.isFood(x.slot),
                list = food ? lp.food || [] : lp.spots || [];
              var find = function (n) {
                return n ? byName(list, n) || (!lp.fallback && W.fromRest ? W.fromRest(lp, n, food) : null) : null;
              };
              /* (a mark that you chose this slot's place, with no place: you moved it to another day. The slot is the planner's again) */
              if (!nm && mine()[x.key]) delete mine()[x.key];
              var it = find(nm),
                hand = !!mine()[x.key] || (!!it && booked(d, it));
              if (hand !== handPass) return;
              if (hand) {
                delete under()[x.key];
                if (it) {
                  x.item = it;
                  x.stood = true;
                  mark(used, it, x.key);
                } else if (nm) x.lost = nm; /* your place is not in this town's lists now: nothing else takes its slot */
                return;
              }
              if (d.rest && x.slot === "pm") return; /* its one outing is chosen fresh: something easy nearby */
              /* a pick the planner made (not you) that turns out to be shut that day, a dinner that opens too late for the kids, or a
               meal the place doesn't serve, is replanned */
              var fine = function (y) {
                return !(
                  W.badForDay(y, W.weekday(d.n), x.slot, W.kidDinner(), d.n) ||
                  (W.holidayShut && W.holidayShut(y, d)) ||
                  (food && W.eatFit && W.eatFit(y) === "poor") ||
                  /* (a meal it turns out not to serve: the check found a "breakfast café" is a dinner restaurant) */
                  (food && !fits(y, x.slot)) ||
                  /* (what the rules never plan: a name that is not one place, a train ride, a climb with grandparents) */
                  W.V.vague(y.n, food) ||
                  /* (the day has become a jet-lag or a travel day since: no timed entry first thing, no day out) */
                  (x.slot === "am" && ((d.jet && W.needsBooking(y)) || ((d.jet || d.moveFrom) && W.isDayOut(y, "am")))) ||
                  (!food && (W.V.trainRide(y.n) || (p.senior && W.classify(y, false).intensity >= 3)))
                );
              };
              if (it && !fine(it)) it = null;
              /* what the fit pass moved aside here (under(), below) is where this slot starts again, with the place that
               stood in for it kept for the slot too. Not once the pick has changed by any other hand since. */
              var un = /** @type {[string, string, number] | null} */ (under()[x.key] || null);
              if (un && (lp.fallback || (nm || "") !== un[1] || today() - (un[2] || 0) > UNDER_DAYS)) {
                delete under()[x.key];
                un = null;
              }
              var own = un ? find(un[0]) : null;
              if (own && W.gone && W.gone(own)) {
                delete under()[x.key]; /* it has closed since: nothing to go back to */
                un = own = null;
              }
              if (own && fine(own) && !isUsed(used, own)) {
                if (it && !isUsed(used, it)) {
                  x.alt = it;
                  mark(used, it, x.key);
                }
                x.item = own;
                x.stood = true;
                mark(used, own, x.key);
                return;
              }
              /* a place the planner chose is not planned again where an earlier stop (or your own hand) already has it */
              if (it && !isUsed(used, it)) {
                x.item = it;
                x.stood = true; /* it was on the plan as last made (a place tried and taken off within one plan never is) */
                mark(used, it, x.key);
              }
            });
          });
        });
        if (round === 1) return;
        countMix(
          cdays.reduce(function (a, d) {
            return a.concat(
              d.slots.map(function (x) {
                return W.isFood(x.slot) ? null : x.item;
              })
            );
          }, [])
        );
        /* fill the rest: morning first (it sets where the day happens), then the other slots near it */
        var geo = geoScale(pool, home),
          fullDays = 0,
          maxFull = Math.floor(cdays.length / 3);
        s.geo = geo;
        cdays.forEach(function (d) {
          /* a day trip in the morning keeps every slot: lunch and the afternoon stay near it, dinner and the evening come back near your lodging */
          function dropForFull() {
            d.fullDay = true;
            fullDays++;
          }
          var am = d.slots.filter(function (x) {
            return x.slot === "am";
          })[0];
          if (am && !am.item && !am.rest && !am.free && !am.loading && !am.lost) {
            var pa = dayPool(d, am, s),
              apool = pa.pool || pool; /* (as above) */
            var a1 = choose(
              apool,
              "am",
              used,
              S.seen[am.key] || [],
              ctxFor(d, am, pa.home, pa.geo, !d.trip && fullDays < maxFull && !(d.tripFirst || d.moveFrom || d.tripLast || d.jet)),
              p
            );
            if (a1) {
              am.item = a1;
              mark(used, a1, am.key);
              addMix(a1);
              if (!apool.fallback) S.picks[am.key] = a1.n;
            }
          }
          if (am && am.item && am.item.s === "any" && !d.trip) dropForFull();
          d.slots.forEach(function (x) {
            if (x.item || x.rest || x.free || x.loading || x.lost) return;
            var px = dayPool(d, x, s),
              xpool = px.pool || pool; /* (as above) */
            var it = choose(xpool, x.slot, used, S.seen[x.key] || [], ctxFor(d, x, px.home, px.geo, false), p);
            if (it) {
              x.item = it;
              mark(used, it, x.key);
              if (!W.isFood(x.slot)) addMix(it);
              if (!xpool.fallback) S.picks[x.key] = it.n;
            }
          });
          /* how far today goes from your lodging, for the day header */
          var far = 0;
          d.slots.forEach(function (x) {
            var k = x.item && W.km(home, x.item);
            if (k && k > far) far = k;
          });
          d.farthest = far;
        });
        /* a city keeps its first ideas (15 of each, more for a longer stay) until someone taps "Find more". Two things grow
         them without being asked: a stay made longer, and a meal left without a place (mealGaps, below) */
        if (!pool.fallback) {
          var stay = st.reduce(function (a, o) {
            return a + (o.country === s.country && o.name === s.name ? o.days || 0 : 0);
          }, 0);
          var sck = W.cityKey(s.country, s.name);
          if (!fitted[sck]) fitted[sck] = W.fitIdeas(s.country, s.name, stay) ? 2 : 1; /* (2: its lists changed) */
          W.growIdeas(s.country, s.name, stay);
        }
      });
    });
    /* a place visited only as a day trip shows a day's worth of ideas */
    days.forEach(function (d) {
      var k = d.trip && W.cityKey(d.trip.country, d.trip.name);
      if (k && !fitted[k]) fitted[k] = W.fitIdeas(d.trip.country, d.trip.name, 1) ? 2 : 1;
    });
    var P = /** @type {Plan} */ ({ stops: st, days: days, N: N, p: p, ap: ap });
    fitDays(P);
    mealGaps(P, fitted);
    return P;
  }

  /* ---------- enough places to eat for the days ----------
     The meals the finished plan leaves without a place (a breakfast, a lunch, a dinner; never one the clock cut, one you
     freed, or a rest day's) are counted for each town, a day trip's town too, and handed to the ideas (W.mealIdeas,
     lib/ideas.js), which bring in places for exactly those meals; the planning that follows their arrival fills them.
     Each one says where it is needed: a meal goes near the stop before it (geoPenalty leaves a meal free rather than
     send you across town), so the usual reason a meal stays empty in a town with plenty of places to eat is that none
     of them is near that day's stops. The count stays on the plan (P.gaps). A town whose lists changed under this very
     plan (moved[ck] = 2: places brought out or set aside by W.fitIdeas) waits for the planning that follows */
  function mealGaps(P, moved) {
    /** @type {Record<string, MealGap>} */ var gaps = {};
    P.days.forEach(function (d) {
      (d.slots || []).forEach(function (x, i) {
        if (!W.isFood(x.slot) || !W.slotShort(x)) return;
        var pc = poolCity(d, x),
          ck = W.cityKey(pc[0], pc[1]),
          px = dayPool(d, x, P.stops[d.stop]),
          g = gaps[ck] || (gaps[ck] = { country: pc[0], city: pc[1], breakfast: 0, lunch: 0, dinner: 0, at: [] });
        g[x.slot]++;
        /* where the planner would look for it (ctxFor): the stop before it on the day, else where you are staying; back
           at your lodging after a full day out */
        /** @type {{ n: string, lat: number | null, lng: number | null } | null} */ var by = null;
        if (!(d.fullDay && x.slot === "dinner"))
          d.slots.forEach(function (o, j) {
            if (j < i && o.item && o.item.lat != null && !!o.trip === !!x.trip) by = o.item;
          });
        if (!by && px.home && px.home.lat != null && !px.trip) by = { n: px.home.label, lat: px.home.lat, lng: px.home.lng };
        g.at.push({
          meal: x.slot,
          day: d.n,
          n: by ? by.n : "",
          lat: by ? by.lat : null,
          lng: by ? by.lng : null,
          km: Math.max(1, Math.round(2 * ((px.geo && px.geo.R) || 2)))
        });
      });
    });
    P.gaps = gaps;
    if (W.mealIdeas && !W.readOnly)
      Object.keys(gaps).forEach(function (ck) {
        if (moved[ck] !== 2) W.mealIdeas(gaps[ck].country, gaps[ck].city, gaps[ck]);
      });
  }

  /* Only plans that fit. The planner's own picks that the day's clock can't fit (no time after a long journey, shut by the
     time you'd arrive, closing almost as you get there) are swapped for something that fits, or left out. After a long
     journey, and between two heavy days, the day is made lighter. Places you picked yourself are never touched: if one
     of those doesn't fit, the day says so. */
  function slotOf(d, sl) {
    return d.slots.filter(function (y) {
      return y.slot === sl;
    })[0];
  }
  /* When the fit pass takes off or swaps a place that stood on the plan as last made, it is remembered:
     S.under[slot] = [that place, what stands there now ("" when nothing does), the day it happened]. The place stays
     reserved for its slot, and the next plan starts from it again (the reserve step in planNow). So a change that
     comes and goes (a slower way of travelling picked and unpicked, dates moved and moved back, a heavy day made
     lighter and heavy again) leaves the day as it was, instead of whatever the planner would choose afresh once the
     first place had gone to another slot. Kept for a few days, so a place is not held back for good by a change that
     stays. A place the planner tries and takes off within one plan never stood, and is not remembered; places you
     chose yourself are never moved at all. */
  var UNDER_DAYS = 3;
  function under() {
    return W.S.under || (W.S.under = {});
  }
  function today() {
    return Math.floor(Date.now() / 864e5);
  }
  function drop(d, x, P) {
    var s = P.stops[d.stop],
      used = s.used || {};
    if (x.item) {
      var pl = dayPool(d, x, s),
        u = under()[x.key],
        keep = false;
      if (!mine()[x.key] && pl.pool && !pl.pool.fallback) {
        if (u) keep = W.norm(u[0]) === W.norm(x.item.n);
        else if (x.stood) {
          under()[x.key] = [x.item.n, "", today()];
          keep = true;
        }
      }
      if (!keep) unmark(used, x.item, x.key);
    }
    x.item = null;
    x.stood = false;
    x.cut = true;
    delete W.S.picks[x.key];
  }
  /* after the fit pass: a slot whose own pick stands again is no longer remembered; the others note what stands now */
  function settleUnder(P) {
    var U = under(),
      towns = {};
    P.stops.forEach(function (s) {
      towns[s.country + "|" + s.name + "|"] = 1;
    });
    P.days.forEach(function (d) {
      if (d.trip) towns[d.trip.country + "|" + d.trip.name + "|"] = 1;
      (d.slots || []).forEach(function (x) {
        var u = U[x.key];
        if (x.alt) {
          unmark(P.stops[d.stop].used || {}, x.alt, x.key);
          x.alt = null;
        }
        if (!u) return;
        if (x.item && W.norm(x.item.n) === W.norm(u[0])) {
          delete U[x.key];
          W.S.picks[x.key] = x.item.n;
        } else u[1] = W.S.picks[x.key] || "";
      });
    });
    /* (a town no longer on the trip takes its entries with it) */
    Object.keys(U).forEach(function (k) {
      if (!towns[k.split("|").slice(0, 2).join("|") + "|"]) delete U[k];
    });
  }
  /* The day's own check: the planner's stops that break a promise as the day stands, in clock order (lib/rules.js
     reads the finished plan the same way). What you put there by hand is never among them. A stop is named when its
     row has no time or the place is not open for the visit; when it gets under half an hour; when the meal after it
     falls outside meal times (the outing before a late lunch or dinner is the one to change, the meal itself when
     there is none); when it leaves a toddler's day without a nap; or when it lies outside the day's area (rule 4). */
  var SHUT = /^Closed on|^Closed for|^Closed [A-Z][a-z]{2} \d|^Not open until|before you'd get there|^Kitchen opens|: about \d.* there$/;
  function dayBads(d, P, T) {
    var out = [],
      p = P.p,
      /** @param {string} sl */ at = function (sl) {
        return slotOf(d, sl);
      },
      /** @param {SlotEntry | null | undefined} x */ own = function (x) {
        return !!x && !!x.item && !held(d, x);
      },
      /** @param {SlotEntry | null | undefined} x */ add = function (x) {
        if (x && out.indexOf(x) < 0) out.push(x);
      };
    (T.order || []).forEach(function (sl) {
      var x = at(sl),
        R = T.rows[sl];
      if (!own(x) || !R) return;
      if (
        R.skip ||
        R.warn.some(function (w) {
          return SHUT.test(w);
        })
      )
        return add(x);
      if (R.start == null || R.end == null) return;
      if (R.end - R.start < (W.isFood(sl) ? 20 : 30)) return add(x);
      var late = false;
      if (sl === "lunch") late = R.start < 690 || R.start > 870;
      if (sl === "dinner") {
        var kidCap = Math.max(1110 + (d.jet ? 0 : 30), T.travel ? T.travel.end + 60 : 0);
        late =
          R.start < 1020 ||
          R.start > 1305 ||
          (p.kid && R.start > kidCap) ||
          (d.jet && R.start > Math.max(1110, T.travel ? T.travel.end + 60 : 0));
      }
      if (late) {
        var prev = at(sl === "lunch" ? "am" : "pm");
        add(own(prev) && T.rows[prev.slot] && !T.rows[prev.slot].skip ? prev : x);
      }
    });
    /* a toddler's nap (a journey that takes lunch takes the nap with it) */
    if (p.toddler && !T.nap && !(T.travel && T.rows.lunch && T.rows.lunch.skip)) {
      var b = at("breakfast"),
        am = at("am"),
        lu = at("lunch");
      if (!((b && b.item && held(d, b)) || (am && am.item && held(d, am)) || (lu && lu.item && held(d, lu))))
        add(own(am) ? am : own(lu) ? lu : own(b) ? b : null);
    }
    /* the day's area */
    var home = W.homebase(d.country, d.city),
      s = P.stops[d.stop],
      /** @param {SlotEntry | null | undefined} x */ pin = function (x) {
        return own(x) && x.item.lat != null && x.item.lng != null;
      },
      core = [at("am"), at("lunch"), at("pm")].filter(pin),
      amx = at("am"),
      away = !!d.trip || !!(amx && amx.item && W.isDayOut(amx.item, "am")),
      g = dayPool(d, at("dinner"), s).geo,
      gc = dayPool(d, amx, s).geo;
    core.forEach(function (a, i) {
      core.slice(i + 1).forEach(function (c) {
        if ((W.km(a.item, c.item) || 0) > 4 * gc.R) add(c);
      });
      var hk = W.km(home, a.item);
      if (!away && hk != null && home.lat != null && hk > Math.max(6 * g.R, 2 * g.med)) add(a);
    });
    [at("breakfast"), at("dinner"), at("eve")].filter(pin).forEach(function (e) {
      var hk = W.km(home, e.item);
      if (hk == null || hk <= 4 * g.R) return;
      if (
        away ||
        !core.some(function (a) {
          return (W.km(a.item, e.item) || 0) <= 4 * g.R;
        })
      )
        add(e);
    });
    return out;
  }
  /* A place for an empty slot that keeps the whole day's promises: every idea that could go there is tried against
     the day's clock, best first, until one leaves the day with no new problem (ranked, dayBads). With commit it goes
     on the plan; without, the slot is left as it was and the place is only named (W.planX.wouldFill: how the check
     of the rules proves a slot marked "nothing fits" true). avoid: names not to take. */
  function tryFill(d, x, P, commit, avoid) {
    CUR = P;
    var s = P.stops[d.stop],
      pl = dayPool(d, x, s),
      pool = pl.pool;
    if (!pool || !s.geo || x.item || x.rest || x.free || x.loading || x.lost) return null;
    var used = s.used || (s.used = newUsed(s.name)),
      T0 = W.dayTimes(d, P),
      R0 = T0 && T0.rows[x.slot];
    if (!T0 || !R0 || R0.skip) return null; /* no time at all (after a long journey, or late in the day): nothing would fit */
    var u = used;
    if (avoid) {
      u = Object.assign(likeUsed(used), avoid);
    }
    /* (how the stop's days stand for the mix of styles and of famous and hidden places, as when the days were first filled) */
    if (!W.isFood(x.slot)) {
      var items = [];
      P.days.forEach(function (o) {
        if (o.stop === d.stop)
          (o.slots || []).forEach(function (y) {
            if (y !== x && y.item && !W.isFood(y.slot)) items.push(y.item);
          });
      });
      countMix(items);
    }
    var was = dayBads(d, P, T0),
      cut = x.cut,
      list = ranked(pool, x.slot, u, W.S.seen[x.key] || [], ctxFor(d, x, pl.home, pl.geo, false), P.p);
    for (var i = 0; i < list.length; i++) {
      x.item = list[i];
      x.cut = false;
      var T = W.dayTimes(d, P),
        ok =
          !!T &&
          dayBads(d, P, T).every(function (b) {
            return b !== x && was.indexOf(b) > -1;
          });
      if (ok && commit) {
        mark(used, list[i], x.key);
        if (!pool.fallback) W.S.picks[x.key] = list[i].n;
        return list[i];
      }
      x.item = null;
      x.cut = cut;
      if (ok) return list[i];
    }
    return null;
  }
  /* another idea for this slot that fits the day, or none */
  function refit(d, x, P) {
    CUR = P;
    var s = P.stops[d.stop],
      pl = dayPool(d, x, s),
      pool = pl.pool;
    if (!pool || !s.geo) return false;
    var used = s.used || (s.used = newUsed(s.name)),
      avoid = {};
    var was = x.item,
      alt = x.alt;
    drop(d, x, P);
    if (was) avoid[W.norm(was.n)] = 1; /* not the one that didn't fit */
    /* the place that stood in for it last time comes first, so the day does not change from one plan to the next */
    x.alt = null;
    if (alt) {
      var T0 = W.dayTimes(d, P),
        before = T0 ? dayBads(d, P, T0) : [];
      x.item = alt;
      x.cut = false;
      var Ta = W.dayTimes(d, P);
      if (
        Ta &&
        dayBads(d, P, Ta).every(function (b) {
          return b !== x && before.indexOf(b) > -1;
        })
      ) {
        mark(used, alt, x.key);
        if (!pool.fallback) W.S.picks[x.key] = alt.n;
        return true;
      }
      unmark(used, alt, x.key);
      avoid[W.norm(alt.n)] = 1;
      x.item = null;
      x.cut = true;
    }
    return !!tryFill(d, x, P, true, avoid);
  }
  function fitDay(d, P) {
    for (var guard = 0; guard < 14; guard++) {
      var T = W.dayTimes(d, P);
      if (!T) return;
      var bad = dayBads(d, P, T)[0];
      if (!bad) return;
      var R = T.rows[bad.slot];
      /* no time at all (after a long journey, or late in the day): nothing else will fit either */
      if (!R || R.skip) drop(d, bad, P);
      else if (!refit(d, bad, P)) drop(d, bad, P);
    }
    /* (still not right after all that: what does not fit is left out) */
    var Tl = W.dayTimes(d, P);
    if (Tl)
      dayBads(d, P, Tl).forEach(function (x) {
        drop(d, x, P);
      });
  }
  function level(d, P, noTravel) {
    var T = W.dayTimes(d, P),
      E = T && W.dayEnergy(d, P, T);
    if (!E) return 0;
    var sc = E.planScore != null ? E.planScore : E.score;
    /* the journey itself can't be lightened: judge what is planned around it */
    if (noTravel) sc -= (E.travel / 60) * 1.2;
    return sc < 3.5 ? 1 : sc < 6 ? 2 : sc < 8.5 ? 3 : 4;
  }
  /* Make a day lighter. A travel day (leaveOut) may lose its evening outing, then get an easy afternoon close to where
     you stay, then lose the afternoon too: the journey is part of the day, and the slot says so ("light"). Any other
     day keeps all its parts (rule 1: no shortened days): there the afternoon is only swapped for an easy one nearby
     and the morning for a nearer one, and when nothing lighter fits the day stays as it was. */
  function lighten(d, P, target, noTravel, leaveOut) {
    CUR = P;
    var steps = leaveOut ? ["eve", "pmEasy", "pm", "amNear"] : ["pmEasy", "amNear"];
    if (!leaveOut) {
      /* (a day that would be light enough without its evening outing keeps the evening and everything else: the
         evening is not left out any more, and a day is not rearranged for an evening stroll) */
      var ev = slotOf(d, "eve");
      if (ev && ev.item && !held(d, ev)) {
        var kept = ev.item;
        ev.item = null;
        var without = level(d, P, noTravel);
        ev.item = kept;
        if (without < target) return;
      }
    }
    for (var i = 0; i < steps.length && level(d, P, noTravel) >= target; i++) {
      var st = steps[i],
        sl = st.slice(0, 2) === "am" ? "am" : st.slice(0, 2) === "pm" ? "pm" : "eve",
        x = slotOf(d, sl);
      if (!x || !x.item || held(d, x) || x.rest) continue;
      if (st === "pmEasy" || st === "amNear") {
        var s = P.stops[d.stop],
          pl = dayPool(d, x, s),
          pool = pl.pool;
        if (!pool || !s.geo) continue;
        var home = pl.home,
          was = x.item,
          alt = x.alt,
          stood = x.stood,
          used = s.used || {};
        drop(d, x, P);
        x.alt = null;
        var cx = ctxFor(d, x, home, pl.geo, false);
        cx.light = true;
        if (st === "pmEasy") cx.rest = true;
        var av = likeUsed(used);
        av[W.norm(was.n)] = 1;
        /* (the lighter place it gave way to last time, when there was one: see under()) */
        var it = alt || choose(pool, sl, av, W.S.seen[x.key] || [], cx, P.p);
        if (it) {
          x.item = it;
          x.cut = false;
          mark(used, it, x.key);
          if (!pool.fallback) W.S.picks[x.key] = it.n;
          fitDay(d, P);
        }
        if (!x.item && (st === "amNear" || !leaveOut)) {
          /* nothing lighter that fits: keep what was there */
          if (it) unmark(used, it, x.key);
          x.item = was;
          x.stood = stood;
          x.cut = false;
          mark(used, was, x.key);
          if (!pool.fallback) W.S.picks[x.key] = was.n;
          var u = under()[x.key];
          if (u && W.norm(u[0]) === W.norm(was.n) && !u[1]) delete under()[x.key];
          fitDay(d, P);
        } else if (!x.item) x.light = true;
      } else {
        drop(d, x, P);
        x.light = true;
        fitDay(d, P); /* (a meal chosen near the outing that has gone may now be out of the day's area) */
      }
    }
  }
  /* The fit pass. It starts from the planner's own picks (the reserve step put back what an earlier pass had moved),
     takes off or swaps what does not fit, then gives every slot it left empty one more try with each place that could
     go there and runs once more over the result; then it notes what it moved (settleUnder), and last each part of a
     day still without a place says why (explain). */
  function fitDays(P) {
    fitOnce(P);
    if (refill(P)) {
      fitOnce(P);
      refill(P);
    }
    settleUnder(P);
    /* (the places kept in reserve for a slot are free again now: one more look at what is still empty) */
    if (refill(P)) settleUnder(P);
    /* (nothing the day's own check objects to is left standing, whatever the passes above did: what still does not
       fit is taken off, what that makes room for is put in, until nothing changes; then each empty slot says why) */
    for (var i = 0, moved = true; moved && i < 4; i++) {
      moved = false;
      P.days.forEach(function (d) {
        if (!d.slots || !d.slots.length || d.loading) return;
        var T = W.dayTimes(d, P);
        if (T)
          dayBads(d, P, T).forEach(function (x) {
            drop(d, x, P);
            moved = true;
          });
      });
      if (moved) moved = refill(P);
    }
    explain(P);
  }
  /* every part of a day left without a place (not by you, a rest day or a travel day kept light) gets each place
     that could go there tried against the day's clock; a day is gone over again while that fills anything, since a
     new stop can bring a meal's place within reach */
  function refill(P) {
    CUR = P;
    var any = false;
    P.days.forEach(function (d) {
      if (!d.slots || !d.slots.length || d.loading) return;
      for (var sweep = 0, got = true; got && sweep < 3; sweep++) {
        got = false;
        d.slots.forEach(function (x) {
          if (x.item || x.rest || x.free || x.loading || x.lost || x.light) return;
          if (tryFill(d, x, P, true)) got = any = true;
        });
      }
    });
    return any;
  }
  /* Why a part of a day has no place (rule 1: every day is full, or says why not). x.why is one of W.WHY's keys (lib/rules.js, second script: the words are only needed on screen):
     the checker (lib/rules.js) accepts an empty slot only with one of them, and proves "none" by looking for a
     place itself. Slots you freed (x.free), a rest day's (x.rest) and ones whose lists are on their way (x.loading)
     already say so. */
  function explain(P) {
    P.days.forEach(function (d) {
      if (!d.slots || !d.slots.length || d.loading) return;
      /** @type {any} */ var T = null;
      d.slots.forEach(function (x) {
        delete x.why;
        if (x.item || x.rest || x.free || x.loading) return;
        T = T || W.dayTimes(d, P);
        var R = T && T.rows[x.slot];
        x.why = x.lost ? "yours" : R && R.skip ? (d.moveFrom && T.travel ? "journey" : "late") : x.light && d.moveFrom ? "light" : "none";
      });
    });
  }
  function fitOnce(P) {
    P.days.forEach(function (d) {
      if (d.slots && d.slots.length && !d.loading) fitDay(d, P);
    });
    /* a travel day is never heavy; after a long journey (or with toddlers or grandparents) it is moderate at most */
    P.days.forEach(function (d) {
      if (!d.moveFrom || d.rest || d.loading || !d.slots) return;
      var L = W.legFor(P, d.stop);
      if (!L) return;
      lighten(d, P, L.min >= 240 || P.p.toddler || P.p.senior ? 2 : 3, true, true);
    });
    /* the day after a long journey stays gentle */
    P.days.forEach(function (d, j) {
      var prev = P.days[j - 1];
      if (!prev || !prev.moveFrom || d.moveFrom || d.tripLast || d.rest || d.loading || !d.slots) return;
      var L = W.legFor(P, prev.stop);
      if (L && L.min >= 300) lighten(d, P, 3);
    });
    /* no two heavy days in a row, and no three full ones */
    var lv = P.days.map(function (d) {
      return d.slots && d.slots.length && !d.loading ? level(d, P) : 0;
    });
    for (var k = 1; k < P.days.length; k++) {
      var d = P.days[k];
      if (d.loading || !d.slots || d.rest) continue;
      var two = lv[k] >= 4 && lv[k - 1] >= 4,
        three = k > 1 && lv[k] >= 3 && lv[k - 1] >= 3 && lv[k - 2] >= 3 && lv[k] + lv[k - 1] + lv[k - 2] >= 10;
      if (two || three) {
        lighten(d, P, two ? 4 : 3);
        lv[k] = level(d, P);
      }
    }
  }

  /* ---------- reroll and swap ---------- */
  /* everything needed to pick for one slot: what else is on the trip, and where the day happens */
  function slotCtx(day, slot, P) {
    CUR = P;
    var k = key(day, slot),
      x = day.slots.filter(function (s) {
        return s.slot === slot;
      })[0];
    if (!x) return null;
    var pl = dayPool(day, x, P.stops[day.stop]),
      pool = pl.pool;
    if (!pool) return null;
    var used = P.stops[day.stop].used || {},
      u = likeUsed(used, true);
    Object.keys(used).forEach(function (n) {
      if (used[n] !== k) u[n] = 1;
    });
    var home = pl.home,
      geo = pl.geo;
    var allowFull =
      slot === "am" &&
      !x.trip &&
      !(day.tripFirst || day.moveFrom || day.tripLast || day.jet) &&
      (day.fullDay ||
        P.days.filter(function (d) {
          return d.stop === day.stop && d.fullDay;
        }).length < Math.floor(P.stops[day.stop].days / 3));
    countMix(
      P.days
        .filter(function (d) {
          return d.stop === day.stop;
        })
        .reduce(function (a, d) {
          return a.concat(
            (d.slots || [])
              .filter(function (y) {
                return y !== x && !W.isFood(y.slot);
              })
              .map(function (y) {
                return y.item;
              })
          );
        }, [])
    );
    return { k: k, pool: pool, x: x, u: u, ctx: ctxFor(day, x, home, geo, allowFull) };
  }
  /* the best other options for a slot, nearest-fitting first (for "pick from list") */
  W.slotOptions = function (day, slot, P) {
    var c = slotCtx(day, slot, P);
    if (!c) return [];
    var u = c.u,
      ctx = c.ctx,
      list = W.isFood(slot) ? c.pool.food || [] : c.pool.spots || [],
      p = W.party(),
      cur = W.S.picks[c.k],
      have = {},
      out = [];
    if (cur) {
      have[W.norm(cur)] = 1;
      var curIt = byName(list, cur);
      if (curIt) have["@" + W.placeKey(curIt)] = 1;
    }
    [true, false].forEach(function (strict) {
      var sc = [];
      list.forEach(function (it, i) {
        var n = W.norm(it.n);
        if (have[n] || have["@" + W.placeKey(it)] || isUsed(u, it)) return;
        var v = score(it, i, list.length, slot, ctx, p, strict);
        if (v != null) sc.push([v, it]);
      });
      sc.sort(function (a, b) {
        return b[0] - a[0];
      }).forEach(function (q) {
        if (have["@" + W.placeKey(q[1])]) return;
        have[W.norm(q[1].n)] = 1;
        have["@" + W.placeKey(q[1])] = 1;
        out.push({ it: q[1], km: q[1].lat != null && ctx.prev && ctx.prev.lat != null ? W.km(ctx.prev, q[1]) : null });
      });
    });
    return out;
  };
  W.resetPicks = function () {
    W.S.picks = {};
    W.S.seen = {};
    W.S.mine = {};
  };

  /* slots you filled yourself (reroll or pick) stay put; the rest can be replanned when better-fitting ideas arrive */
  function mine() {
    return W.S.mine || (W.S.mine = {});
  }
  W.freshPicks = function (country, city) {
    var pre = country + "|" + city + "|",
      m = mine();
    Object.keys(W.S.picks).forEach(function (k) {
      if (k.indexOf(pre) === 0 && !m[k]) delete W.S.picks[k];
    });
  };
  /* a city's meals chosen again, keeping the ones you chose yourself (what you love changed) */
  W.freshMeals = function (country, city) {
    var pre = country + "|" + city + "|",
      m = mine();
    Object.keys(W.S.picks).forEach(function (k) {
      if (k.indexOf(pre) === 0 && !m[k] && W.isFood(k.slice(k.lastIndexOf("|") + 1))) delete W.S.picks[k];
    });
  };
  /* every city's days planned again, keeping the stops you chose yourself (the trip's feel changed) */
  W.freshAll = function () {
    var m = mine();
    Object.keys(W.S.picks).forEach(function (k) {
      if (!m[k]) delete W.S.picks[k];
    });
    W.S.seen = {};
  };
  /* what the second script's half of the planner (lib/planacts.js: "not for us", another suggestion, the rescues)
     uses of this one's workings */
  W.planX = {
    mine: mine,
    unmark: unmark,
    choose: choose,
    score: score,
    mark: mark,
    dayPool: dayPool,
    unNopeName: unNopeName,
    slotCtx: slotCtx,
    poolCity: poolCity,
    key: key,
    ctxFor: ctxFor,
    byName: byName,
    keysOf: keysOf,
    newUsed: newUsed,
    ranked: ranked,
    dayBads: dayBads,
    held: held,
    /** the scale of the town a slot's ideas come from: { med, R (the day radius) } @param {Day} d @param {SlotEntry} x @param {Plan} P */
    geoOf: function (d, x, P) {
      return dayPool(d, x, P.stops[d.stop]).geo;
    },
    /** a place that would fit this empty slot as the plan stands, or null; nothing is changed
        @param {Day} d @param {SlotEntry} x @param {Plan} P */
    wouldFill: function (d, x, P) {
      return tryFill(d, x, P, false);
    },
    /** why an empty slot stayed empty: how many of the town's ideas are on the trip already (used), are not for this
        part of this day (unfit: the wrong meal or time of day, shut, too far, not for this group), or do not fit the
        day's clock or area once put there (clock) @param {Day} d @param {SlotEntry} x @param {Plan} P */
    whyNot: function (d, x, P) {
      CUR = P;
      var s = P.stops[d.stop],
        pl = dayPool(d, x, s),
        out = { ideas: 0, used: 0, unfit: 0, clock: 0 };
      if (!pl.pool || x.item) return out;
      var list = W.isFood(x.slot) ? pl.pool.food || [] : pl.pool.spots || [],
        used = s.used || {},
        ctx = ctxFor(d, x, pl.home, pl.geo, false);
      out.ideas = list.length;
      list.forEach(function (it, i) {
        if (isUsed(used, it)) out.used++;
        else if (score(it, i, list.length, x.slot, ctx, P.p, false) == null) out.unfit++;
        else out.clock++;
      });
      return out;
    },
    /** the plan being repaired, so a slot's context can read the day's clock @param {any} P */
    cur: function (P) {
      CUR = P;
    }
  };
})();
