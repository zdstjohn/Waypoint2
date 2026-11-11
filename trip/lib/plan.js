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
  W.fameOf = fameOf;
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
      if (fx && fx.lat != null) return { label: st.label, lat: fx.lat, lng: fx.lng, set: true };
      if (!(fx && fx.nopin)) return { label: st.label, lat: st.lat, lng: st.lng, set: true };
      var la = pool && pool.lat != null ? pool.lat : c && c.lat,
        lo = pool && pool.lng != null ? pool.lng : c && c.lng;
      return { label: st.label, lat: la == null ? null : la, lng: lo == null ? null : lo, set: true };
    }
    var lat = pool && pool.lat != null ? pool.lat : c && c.lat,
      lng = pool && pool.lng != null ? pool.lng : c && c.lng;
    return {
      label: st && st.label ? st.label : city + " center",
      lat: lat == null ? null : lat,
      lng: lng == null ? null : lng,
      set: false,
      pending: !!(st && st.label)
    };
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
      var sorted = cities.slice().sort(function (a, b) {
          return (b.top || 0) - (a.top || 0) || cityScore(b, p) - cityScore(a, p);
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
    if (item.meal === "dinner") return 0;
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
  /* ctx: { home, prev (point before this slot), pts (other stops already on this day), geo, allowFull } */
  function geoPenalty(item, slot, ctx, strict) {
    if (item.lat == null || ctx.home.lat == null) return 2;
    var R = ctx.geo.R,
      food = W.isFood(slot);
    if (!ctx.pts.length) {
      var dh = W.km(ctx.home, item);
      if (item.s === "any" && slot === "am") return Math.min(8, (dh / 40) * 3); /* a day trip: allowed to go far */
      if (strict && dh > Math.max(3 * R, ctx.geo.med * 1.5)) return null;
      if (dh > Math.max(6 * R, ctx.geo.med * 2)) return null; /* never a cross-region trek for one slot */
      /* arrival, travel and departure days stay close to your lodging */
      return (dh / R) * (ctx.light ? 6 : 3);
    }
    var dPrev = W.km(ctx.prev, item),
      dCen = W.km(centroid(ctx.pts), item),
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
    /* the group's food needs: a place that can't feed them is never planned; one that clearly can is a little ahead */
    var eatF = W.isFood(slot) && W.eatFit ? W.eatFit(item) : "",
      eatB = eatF === "good" ? 3 : eatF === "ok" ? 0.5 : 0;
    if (eatF === "poor") return null;
    /* the first days after a long flight: no timed entries first thing */
    if (ctx.jet && slot === "am" && W.needsBooking(item)) return null;
    /* a rest day's one outing: something easy close to your lodging */
    if (ctx.rest && slot === "pm") {
      var easy = (item.t || []).some(function (t) {
        return /relax|beach|nature|family|wellness|scenic/.test(t);
      });
      if (!easy || W.km(ctx.home, item) > Math.max(1.5, ctx.geo.R)) return null;
    }
    /* shut that day of the week */
    if (item.hours && ctx.wd != null && item.hours.closed.indexOf(ctx.wd) > -1) return null;
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
  function isUsed(used, it) {
    return !!(used[W.norm(it.n)] || used["@" + W.placeKey(it)]);
  }
  function usedHere(used, it) {
    var a = used[W.norm(it.n)],
      b = used["@" + W.placeKey(it)];
    return !!((a && String(a).charAt(0) !== "~") || (b && String(b).charAt(0) !== "~"));
  }
  function mark(used, it, k) {
    used[W.norm(it.n)] = k;
    used["@" + W.placeKey(it)] = k;
  }
  function unmark(used, it, k) {
    if (used[W.norm(it.n)] === k) delete used[W.norm(it.n)];
    if (used["@" + W.placeKey(it)] === k) delete used["@" + W.placeKey(it)];
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
  W.sayNo = function (country, city, it, P) {
    var S = W.S;
    if (!it || !it.n) return;
    (S.nope || (S.nope = {}))[W.nopeKey(country, city, it)] = String(it.n).slice(0, 160);
    /* wherever the plan has it in that city, the slot gets a new suggestion */
    var pk = W.placeKey(it);
    ((P || W.P || {}).days || []).forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        var pc = poolCity(d, x);
        if (!x.item || pc[0] !== country || pc[1] !== city || (W.placeKey(x.item) !== pk && W.norm(x.item.n) !== W.norm(it.n))) return;
        delete S.picks[x.key];
        if (S.mine) delete S.mine[x.key];
      });
    });
  };
  W.unNope = function (k) {
    if (W.S.nope) delete W.S.nope[k];
  };
  function unNopeName(d, x, name) {
    var o = W.S.nope;
    if (!o) return;
    var pc = poolCity(d, x),
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
      /** @type {Spot | Food | null} */ var best = null,
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
  /* geographic context for one slot, from the other stops already on that day */
  var CUR = null; /* the plan being built or repaired, so a slot's context can read the day's clock */
  function ctxFor(day, x, home, geo, allowFull) {
    var pts = [],
      prev = home,
      idx = day.slots.indexOf(x),
      big = false;
    var afterFull = day.fullDay && (x.slot === "dinner" || x.slot === "eve");
    day.slots.forEach(function (o, i) {
      if (o === x || !o.item) return;
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
      allowFull: allowFull,
      light: !!(day.tripFirst || day.moveFrom || day.tripLast || day.jet),
      wd: W.weekday(day.n),
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
      "glanceOpen",
      "nextHide",
      "tview",
      "exF",
      "exSort",
      "prepTab",
      "pack",
      "packHide",
      "packOwn",
      "journal",
      "names",
      "kidPicks",
      "hunt",
      "stamps",
      "celebrated",
      "warmSeen",
      "bag"
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
    var P = planNow();
    memo = { sig: planSig(), P: P }; /* planning writes its picks into the state; the signature is taken after */
    return P;
  };
  W.replan = function () {
    memo = null;
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
        days[days.length - 1].rest = W.isRest(days[days.length - 1]);
      }
      if (W.placeTrips)
        W.placeTrips(
          s,
          days.filter(function (d) {
            return d.stop === si;
          })
        );
    });

    /* fill each city's days from its own pool. A place the plan already used at an earlier stop close by (two stays on
       one island, or coming back to a city) isn't planned again; marks from that stop start with "~" */
    var before = [];
    st.forEach(function (s, si) {
      var pool = W.pool(s.country, s.name);
      var cdays = days.filter(function (d) {
        return d.stop === si;
      });
      if (!pool) {
        W.loadCity(s.country, s.name, false, s.days);
        cdays.forEach(function (d) {
          d.loading = true;
          d.slots = [];
        });
        return;
      }
      if (!pool.fallback && W.loadEatFit)
        W.loadEatFit(s.country, s.name); /* the group's food needs: check these places, and add a few that fit */
      if (!pool.fallback && W.loadFame) W.loadFame(s.country, s.name); /* ratings for the ideas already there (no new ones) */
      var home = W.homebase(s.country, s.name),
        used = {};
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
      before.forEach(function (b) {
        var dk = W.km(b.home, home); /* null when either has no pin */
        if (!(b.city === W.cityKey(s.country, s.name) || (dk != null && dk <= 40))) return;
        Object.keys(b.used).forEach(function (k) {
          if (!used[k] && String(b.used[k]).charAt(0) !== "~") used[k] = "~" + b.used[k];
        });
      });
      markNope(used, s, cdays);
      /* reserve the picks you already have */
      cdays.forEach(function (d) {
        d.slots.forEach(function (x) {
          if (x.rest || x.free || x.loading)
            return; /* a rest day keeps its morning and evening free (your picks come back if you undo it); a slot you cleared stays free */
          if (d.rest && x.slot === "pm" && !mine()[x.key]) return; /* its one outing is chosen fresh: something easy nearby */
          var pl = dayPool(d, x, s),
            nm = S.picks[x.key],
            list = W.isFood(x.slot) ? pl.pool.food || [] : pl.pool.spots || [];
          var it = nm && (byName(list, nm) || (W.fromRest && !pl.pool.fallback ? W.fromRest(pl.pool, nm, W.isFood(x.slot)) : null));
          /* a pick the planner made (not you) that turns out to be shut that day, or a dinner that opens too late for the kids, is replanned */
          if (
            it &&
            !mine()[x.key] &&
            (W.badForDay(it, W.weekday(d.n), x.slot, W.kidDinner()) ||
              (W.holidayShut && W.holidayShut(it, d)) ||
              (W.isFood(x.slot) && W.eatFit && W.eatFit(it) === "poor"))
          )
            it = null;
          /* a place you chose yourself stays even if an earlier stop had it; one the planner chose doesn't */
          if (it && (mine()[x.key] ? !usedHere(used, it) : !isUsed(used, it))) {
            x.item = it;
            mark(used, it, x.key);
          }
        });
      });
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
        if (am && !am.item && !am.rest && !am.free && !am.loading) {
          var pa = dayPool(d, am, s);
          var a1 = choose(
            pa.pool,
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
            if (!pa.pool.fallback) S.picks[am.key] = a1.n;
          }
        }
        if (am && am.item && am.item.s === "any" && !d.trip) dropForFull();
        d.slots.forEach(function (x) {
          if (x.item || x.rest || x.free || x.loading) return;
          var px = dayPool(d, x, s);
          var it = choose(px.pool, x.slot, used, S.seen[x.key] || [], ctxFor(d, x, px.home, px.geo, false), p);
          if (it) {
            x.item = it;
            mark(used, it, x.key);
            if (!W.isFood(x.slot)) addMix(it);
            if (!px.pool.fallback) S.picks[x.key] = it.n;
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
      s.used = used;
      before.push({ city: W.cityKey(s.country, s.name), home: home, used: used });
      /* no top-ups in the background: a city keeps its first ideas (15 of each, more for a longer stay) until someone
         taps "Find more" (a day they don't fill says so: screens/trip.js). Only a stay made longer grows them */
      if (!pool.fallback) {
        var stay = st.reduce(function (a, o) {
          return a + (o.country === s.country && o.name === s.name ? o.days || 0 : 0);
        }, 0);
        if (!fitted[before[before.length - 1].city]) {
          fitted[before[before.length - 1].city] = 1;
          W.fitIdeas(s.country, s.name, stay);
        }
        W.growIdeas(s.country, s.name, stay);
      }
    });
    /* a place visited only as a day trip shows a day's worth of ideas */
    days.forEach(function (d) {
      var k = d.trip && W.cityKey(d.trip.country, d.trip.name);
      if (k && !fitted[k]) {
        fitted[k] = 1;
        W.fitIdeas(d.trip.country, d.trip.name, 1);
      }
    });
    var P = { stops: st, days: days, N: N, p: p, ap: ap };
    fitDays(P);
    return P;
  }

  /* Only plans that fit. The planner's own picks that the day's clock can't fit (no time after a long journey, shut by the
     time you'd arrive, closing almost as you get there) are swapped for something that fits, or left out. After a long
     journey, and between two heavy days, the day is made lighter. Places you picked yourself are never touched: if one
     of those doesn't fit, the day says so. */
  function conflict(R) {
    if (!R) return false;
    if (R.skip) return true;
    return R.warn.some(function (w) {
      return /^Closed on|^Not open until|before you'd get there|^Kitchen opens|: about \d+ min there/.test(w);
    });
  }
  function slotOf(d, sl) {
    return d.slots.filter(function (y) {
      return y.slot === sl;
    })[0];
  }
  function drop(d, x, P) {
    var used = P.stops[d.stop].used || {};
    if (x.item) unmark(used, x.item, x.key);
    x.item = null;
    x.cut = true;
    delete W.S.picks[x.key];
  }
  /* another idea for this slot that fits the clock, or none */
  function refit(d, x, P, avoid) {
    CUR = P;
    var s = P.stops[d.stop],
      pl = dayPool(d, x, s),
      pool = pl.pool;
    if (!pool || !s.geo) return false;
    var used = s.used || (s.used = {}),
      home = pl.home,
      tried = {};
    var was = x.item;
    drop(d, x, P);
    if (was) tried[W.norm(was.n)] = 1; /* not the one that didn't fit */
    for (var i = 0; i < 4; i++) {
      var u = Object.assign({}, used, tried, avoid || {});
      var it = choose(pool, x.slot, u, W.S.seen[x.key] || [], ctxFor(d, x, home, pl.geo, false), P.p);
      if (!it) break;
      x.item = it;
      x.cut = false;
      var T = W.dayTimes(d, P);
      if (T && !conflict(T.rows[x.slot])) {
        mark(used, it, x.key);
        if (!pool.fallback) W.S.picks[x.key] = it.n;
        return true;
      }
      tried[W.norm(it.n)] = 1;
      x.item = null;
      x.cut = true;
    }
    return false;
  }
  function fitDay(d, P) {
    for (var guard = 0; guard < 8; guard++) {
      var T = W.dayTimes(d, P);
      if (!T) return;
      /** @type {SlotEntry | null} */ var bad = null;
      (T.order || []).some(function (sl) {
        var x = slotOf(d, sl);
        if (x && x.item && !mine()[x.key] && conflict(T.rows[sl])) {
          bad = x;
          return true;
        }
        return false;
      });
      if (!bad) return;
      var R = T.rows[bad.slot];
      /* no time at all (after a long journey, or late in the day): nothing else will fit either */
      if (R.skip) drop(d, bad, P);
      else if (!refit(d, bad, P)) drop(d, bad, P);
    }
  }
  function level(d, P, noTravel) {
    var T = W.dayTimes(d, P),
      E = T && W.dayEnergy(d, P, T);
    if (!E) return 0;
    if (!noTravel) return E.level;
    /* the journey itself can't be lightened: judge what is planned around it */
    var sc = E.score - (E.travel / 60) * 1.2;
    return sc < 3.5 ? 1 : sc < 6 ? 2 : sc < 8.5 ? 3 : 4;
  }
  /* make a day lighter: no evening outing, then an easy afternoon close to where you stay, then no afternoon outing */
  function lighten(d, P, target, noTravel) {
    CUR = P;
    var steps = ["eve", "pmEasy", "pm", "amNear"];
    for (var i = 0; i < steps.length && level(d, P, noTravel) >= target; i++) {
      var st = steps[i],
        sl = st.slice(0, 2) === "am" ? "am" : st.slice(0, 2) === "pm" ? "pm" : "eve",
        x = slotOf(d, sl);
      if (!x || !x.item || mine()[x.key] || x.rest) continue;
      if (st === "pmEasy" || st === "amNear") {
        var s = P.stops[d.stop],
          pl = dayPool(d, x, s),
          pool = pl.pool;
        if (!pool || !s.geo) continue;
        var home = pl.home,
          was = x.item,
          used = s.used || {};
        drop(d, x, P);
        var cx = ctxFor(d, x, home, pl.geo, false);
        cx.light = true;
        if (st === "pmEasy") cx.rest = true;
        var av = Object.assign({}, used);
        av[W.norm(was.n)] = 1;
        var it = choose(pool, sl, av, W.S.seen[x.key] || [], cx, P.p);
        if (it) {
          x.item = it;
          x.cut = false;
          mark(used, it, x.key);
          if (!pool.fallback) W.S.picks[x.key] = it.n;
          fitDay(d, P);
        } else if (st === "amNear") {
          x.item = was;
          x.cut = false;
          mark(used, was, x.key);
          if (!pool.fallback) W.S.picks[x.key] = was.n;
        } /* nothing nearer: keep the morning */
      } else drop(d, x, P);
    }
  }
  function fitDays(P) {
    P.days.forEach(function (d) {
      if (d.slots && d.slots.length && !d.loading) fitDay(d, P);
    });
    /* a travel day is never heavy; after a long journey (or with toddlers or grandparents) it is moderate at most */
    P.days.forEach(function (d) {
      if (!d.moveFrom || d.rest || d.loading || !d.slots) return;
      var L = W.legFor(P, d.stop);
      if (!L) return;
      lighten(d, P, L.min >= 240 || P.p.toddler || P.p.senior ? 2 : 3, true);
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
      u = {};
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
    var list = W.isFood(slot) ? c.pool.food || [] : c.pool.spots || [],
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
        if (have[n] || have["@" + W.placeKey(it)] || isUsed(c.u, it)) return;
        var v = score(it, i, list.length, slot, c.ctx, p, strict);
        if (v != null) sc.push([v, it]);
      });
      sc.sort(function (a, b) {
        return b[0] - a[0];
      }).forEach(function (q) {
        if (have["@" + W.placeKey(q[1])]) return;
        have[W.norm(q[1].n)] = 1;
        have["@" + W.placeKey(q[1])] = 1;
        out.push({ it: q[1], km: q[1].lat != null && c.ctx.prev && c.ctx.prev.lat != null ? W.km(c.ctx.prev, q[1]) : null });
      });
    });
    return out;
  };
  W.reroll = function (day, slot, P) {
    var c = slotCtx(day, slot, P);
    if (!c) return;
    var k = c.k,
      pool = c.pool,
      u = c.u,
      ctx = c.ctx,
      cur = W.S.picks[k];
    if (W.S.free) delete W.S.free[k];
    var seen = (W.S.seen[k] = W.S.seen[k] || []);
    if (cur && seen.indexOf(W.norm(cur)) < 0) seen.push(W.norm(cur));
    /* rerolls stay in today's area: when the nearby ideas run out, start their cycle again and fetch more */
    var it = choose(pool, slot, u, seen, ctx, W.party(), true);
    if (!it) {
      W.S.seen[k] = cur ? [W.norm(cur)] : [];
      W.loadCity(c.x.trip && day.trip ? day.trip.country : day.country, c.x.trip && day.trip ? day.trip.name : day.city, true);
      it = choose(pool, slot, u, W.S.seen[k], ctx, W.party(), true);
      if (!it) {
        /* nothing else nearby yet: allow a little farther, but never across the region */
        var wide = {
          home: ctx.home,
          prev: ctx.prev,
          pts: ctx.pts,
          geo: { med: ctx.geo.med, R: ctx.geo.R * 2 },
          allowFull: ctx.allowFull,
          light: ctx.light,
          wd: ctx.wd,
          hol: ctx.hol,
          sun: ctx.sun,
          kd: ctx.kd,
          jet: ctx.jet,
          rest: ctx.rest
        };
        it = choose(pool, slot, u, W.S.seen[k], wide, W.party(), true);
      }
    }
    if (it) {
      W.S.picks[k] = it.n;
      mine()[k] = 1;
    }
  };
  /* put a specific idea into a slot; if it's on another day, the two trade places */
  W.useIdea = function (day, slot, name, P) {
    var k = key(day, slot),
      used = P.stops[day.stop].used || {},
      other = used[W.norm(name)];
    if (other && String(other).charAt(0) === "~") other = null; /* it was on an earlier stop's day: nothing to trade */
    var cur = W.S.picks[k],
      x = (day.slots || []).filter(function (y) {
        return y.slot === slot;
      })[0];
    unNopeName(day, x, name); /* you chose it after all */
    if (other && other !== k) {
      if (cur) {
        W.S.picks[other] = cur;
        mine()[other] = 1;
      } else delete W.S.picks[other];
    }
    W.S.picks[k] = name;
    mine()[k] = 1;
    if (W.S.free) delete W.S.free[k];
  };
  W.resetPicks = function () {
    W.S.picks = {};
    W.S.seen = {};
    W.S.mine = {};
  };

  /* ---------- rescue the rest of today ---------- */
  /* One tap when the day goes wrong. Nothing that has started or is booked is touched (unless it is what closed).
     rain: outdoor stops still to come become indoor ones nearby, or free time.  tired: one easy thing close to your
     lodging, an early dinner near it, nothing else.  behind: the plan moves back 45 minutes and whatever no longer
     fits is left out.  closed: the next outing is swapped for something open now. Returns what changed, for the note. */
  W.rescue = function (day, P, mode) {
    CUR = P;
    var S = W.S,
      nm = W.nowMin(),
      T = W.dayTimes(day, P),
      p = P.p;
    if (!T) return null;
    var s = P.stops[day.stop],
      home = W.homebase(day.country, day.city),
      used = s.used || (s.used = {});
    var undo = { picks: {}, mine: {}, free: {}, late: W.lateFor(day) },
      changed = [],
      freed = 0;
    day.slots.forEach(function (x) {
      undo.picks[x.key] = S.picks[x.key] || null;
      undo.mine[x.key] = mine()[x.key] || 0;
      undo.free[x.key] = (S.free || {})[x.key] || 0;
    });
    S.rescueUndo = S.rescueUndo || {};
    S.rescueUndo[W.restKey(day)] = undo;
    function booked(it) {
      var e = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
      return !!(e && e.done);
    }
    function later(x) {
      var R = T.rows[x.slot];
      return R && !R.skip && R.start != null && R.start > nm + 5;
    }
    function setFree(x, why) {
      (S.free || (S.free = {}))[x.key] = 1;
      if (x.item) unmark(used, x.item, x.key);
      delete S.picks[x.key];
      x.item = null;
      freed++;
      changed.push({ slot: x.slot, why: why });
    }
    function swap(x, filter, why) {
      var pl = dayPool(day, x, s),
        was = x.item,
        avoid = Object.assign({}, used);
      if (was) avoid[W.norm(was.n)] = 1;
      var cx = ctxFor(day, x, pl.home, pl.geo, false);
      cx.light = true;
      var list = W.isFood(x.slot) ? pl.pool.food || [] : pl.pool.spots || [];
      /** @type {Spot | Food | null} */ var best = null;
      var bs = -1e9;
      for (var i = 0; i < list.length; i++) {
        var it = list[i],
          k = W.norm(it.n);
        if (avoid[k] || !filter(it)) continue;
        if (W.badForDay(it, W.weekday(day.n), x.slot, W.kidDinner()) || (W.holidayShut && W.holidayShut(it, day))) continue;
        var sc = score(it, i, list.length, x.slot, cx, p, false);
        if (sc == null) sc = score(it, i, list.length, x.slot, cx, p, true);
        if (sc != null && sc > bs) {
          bs = sc;
          best = it;
        }
      }
      if (!best) return false;
      if (was) unmark(used, was, x.key);
      x.item = best;
      mark(used, best, x.key);
      S.picks[x.key] = best.n;
      mine()[x.key] = 1;
      if (S.free) delete S.free[x.key];
      changed.push({ slot: x.slot, from: was ? was.n : "", to: best.n, why: why });
      return true;
    }
    var openNow = function (it) {
      var h = it.hours;
      if (!h) return true;
      var t = nm + 30;
      return !(W.weekday(day.n) != null && h.closed.indexOf(W.weekday(day.n)) > -1) && h.o <= t && h.c > t + 45;
    };
    var near = function (km) {
      return function (it) {
        return it.lat == null || W.km(home, it) <= km;
      };
    };
    if (mode === "rain") {
      W.loadIndoor(day.country, day.city);
      day.slots.forEach(function (x) {
        /* an outing slot still empty later today stays free: the planner would otherwise fill it with whatever comes in
           next (the indoor list asked for just above brings outdoor places too), outdoors in the rain */
        if (!x.item && !W.isFood(x.slot) && later(x) && !(S.free || {})[x.key]) {
          (S.free || (S.free = {}))[x.key] = 1;
          return;
        }
        if (!x.item || W.isFood(x.slot) || !later(x) || booked(x.item)) return;
        var c = W.classify(x.item, false);
        if (c.indoor) return;
        if (
          !swap(
            x,
            function (it) {
              return W.classify(it, false).indoor && near(Math.max(3, s.geo ? s.geo.R * 2 : 3))(it);
            },
            "rain"
          )
        )
          setFree(x, "rain");
      });
    } else if (mode === "tired") {
      var kept = false;
      day.slots.forEach(function (x) {
        if (!x.item || !later(x)) return;
        if (W.isFood(x.slot)) {
          if (x.slot === "dinner" && !booked(x.item) && W.km(home, x.item) > 1.2)
            swap(
              x,
              function (it) {
                return near(1.2)(it) && openNow(it);
              },
              "tired"
            );
          return;
        }
        if (booked(x.item)) {
          kept = true;
          return;
        }
        var c = W.classify(x.item, false);
        if (!kept && x.slot !== "eve" && c.intensity <= 1 && W.km(home, x.item) <= 1.5) {
          kept = true;
          return;
        }
        if (
          !kept &&
          x.slot !== "eve" &&
          swap(
            x,
            function (it) {
              var cc = W.classify(it, false);
              return cc.intensity <= 1 && near(1.5)(it) && openNow(it);
            },
            "tired"
          )
        ) {
          kept = true;
          return;
        }
        setFree(x, "tired");
      });
    } else if (mode === "behind") {
      var L = S.late || (S.late = {}),
        lk = W.restKey(day) + "|" + W.isoDay(W.now());
      L[lk] = Math.min(240, (L[lk] || 0) + 45);
      var T2 = W.dayTimes(day, P);
      (T2.order || []).forEach(function (sl) {
        var x = day.slots.filter(function (y) {
            return y.slot === sl;
          })[0],
          R = T2.rows[sl];
        if (x && x.item && R && R.skip && R.start > nm && !booked(x.item)) setFree(x, "behind");
      });
      changed.push({ slot: "", why: "behind" });
    } else if (mode === "closed") {
      var nx = null;
      (T.order || []).some(function (sl) {
        var x = day.slots.filter(function (y) {
            return y.slot === sl;
          })[0],
          R = T.rows[sl];
        if (x && x.item && !W.isFood(sl) && R && !R.skip && R.end > nm) {
          nx = x;
          return true;
        }
        return false;
      });
      if (
        nx &&
        !swap(
          nx,
          function (it) {
            return openNow(it) && near(Math.max(2.5, s.geo ? s.geo.R * 1.5 : 2.5))(it);
          },
          "closed"
        )
      )
        setFree(nx, "closed");
    }
    S.rescued = S.rescued || {};
    S.rescued[W.restKey(day) + "|" + W.isoDay(W.now())] = { mode: mode, n: changed.length, freed: freed, at: nm };
    return { mode: mode, changed: changed, freed: freed };
  };
  /* The same, from a sentence ("it's raining, the little one is tired, we have three hours"): lib/replan.js asks Claude
     which of the stops still to come to keep, drop or swap, choosing only among this day's own other options, and hands
     the answer here. Every action is checked again: a slot that has started or is booked is left alone, a name that isn't
     on the city's list or is already planned elsewhere is ignored. Same undo as the one-tap rescues. */
  W.rescueApply = function (day, P, acts, say) {
    CUR = P;
    var S = W.S,
      nm = W.nowMin(),
      T = W.dayTimes(day, P);
    if (!T) return null;
    var s = P.stops[day.stop],
      used = s.used || (s.used = {});
    var undo = { picks: {}, mine: {}, free: {}, late: W.lateFor(day) },
      changed = [],
      freed = 0;
    day.slots.forEach(function (x) {
      undo.picks[x.key] = S.picks[x.key] || null;
      undo.mine[x.key] = mine()[x.key] || 0;
      undo.free[x.key] = (S.free || {})[x.key] || 0;
    });
    (acts || []).forEach(function (a) {
      var x = day.slots.filter(function (y) {
          return y.slot === a.slot;
        })[0],
        R = x && T.rows[x.slot];
      if (!x || !R || R.skip || R.start == null || R.start <= nm + 5) return;
      var e = x.item && W.bookEntryFor ? W.bookEntryFor(P, day, x.item) : null;
      if (e && e.done) return;
      if (a["do"] === "free") {
        if (!x.item && (S.free || {})[x.key]) return;
        (S.free || (S.free = {}))[x.key] = 1;
        if (x.item) unmark(used, x.item, x.key);
        delete S.picks[x.key];
        x.item = null;
        freed++;
        changed.push({ slot: x.slot, why: "ask" });
      } else if (a["do"] === "use" && a.name) {
        var pl = dayPool(day, x, s),
          list = W.isFood(x.slot) ? pl.pool.food || [] : pl.pool.spots || [],
          it = byName(list, a.name),
          was = x.item;
        if (!it || (was && W.norm(was.n) === W.norm(it.n))) return;
        var at = used[W.norm(it.n)];
        if (at && at !== x.key) return;
        if (was) unmark(used, was, x.key);
        x.item = it;
        mark(used, it, x.key);
        S.picks[x.key] = it.n;
        mine()[x.key] = 1;
        if (S.free) delete S.free[x.key];
        changed.push({ slot: x.slot, from: was ? was.n : "", to: it.n, why: "ask" });
      }
    });
    if (!changed.length) return { mode: "ask", changed: changed, freed: 0 };
    S.rescueUndo = S.rescueUndo || {};
    S.rescueUndo[W.restKey(day)] = undo;
    S.rescued = S.rescued || {};
    S.rescued[W.restKey(day) + "|" + W.isoDay(W.now())] = {
      mode: "ask",
      n: changed.length,
      freed: freed,
      at: nm,
      say: String(say || "").slice(0, 160)
    };
    return { mode: "ask", changed: changed, freed: freed };
  };
  W.unrescue = function (day) {
    var S = W.S,
      u = S.rescueUndo && S.rescueUndo[W.restKey(day)];
    if (!u) return false;
    Object.keys(u.picks).forEach(function (k) {
      if (u.picks[k]) S.picks[k] = u.picks[k];
      else delete S.picks[k];
      if (u.mine[k]) mine()[k] = 1;
      else delete mine()[k];
      if (S.free) {
        if (u.free[k]) S.free[k] = 1;
        else delete S.free[k];
      }
    });
    var lk = W.restKey(day) + "|" + W.isoDay(W.now());
    if (S.late) {
      if (u.late) S.late[lk] = u.late;
      else delete S.late[lk];
    }
    delete S.rescueUndo[W.restKey(day)];
    if (S.rescued) delete S.rescued[lk];
    return true;
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
  /* every city's days planned again, keeping the stops you chose yourself (the trip's feel changed) */
  W.freshAll = function () {
    var m = mine();
    Object.keys(W.S.picks).forEach(function (k) {
      if (!m[k]) delete W.S.picks[k];
    });
    W.S.seen = {};
  };
})();
