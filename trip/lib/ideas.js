/* Waypoint ideas: what Claude is asked about a place (things to do, places to eat, a country's towns), how the
   answers are kept, and how many of them are on show for the length of the stay. Split from lib/core.js. */
(function () {
  "use strict";
  var W = window.W,
    run = W.run,
    changed = W.changed;
  var TAGS = (W.TAGS = STYLES.map(function (s) {
    return s[0];
  }));
  /* every answer goes through W.V (validate.js): names, pins near the city, tags, ratings, links */
  var V = W.V,
    num = V.num;
  /** an empty city, before its lists arrive @returns {Pool} */
  function newPool() {
    return { spots: [], food: [], lat: null, lng: null };
  }
  /* the city a list is for: its pin checks every pin in the answer */
  function centerOf(ck) {
    var c = W.C.city[ck],
      p = ck.split("|"),
      b = W.findCity(p[0], p[1]);
    return c && c.lat != null ? c : b && b.lat != null ? b : null;
  }
  function who() {
    return (
      "Travelers' interests: " +
      (W.S.styles
        .map(function (s) {
          return W.STYLE_NAME[s];
        })
        .join(", ") || "anything") +
      ". Travelers' ages: " +
      (W.ages().join(", ") || "adults") +
      "."
    );
  }
  W.who = who;
  W.newPool = newPool;
  W.centerOf = centerOf; /* (lib/stays.js and lib/asks.js ask about a city too) */

  /* what kind of sights the trip is after, over and above its interests: the famous must-sees (the default), hidden gems
     where locals go, or the best of both */
  W.FOCUS = { icons: "Must-sees", both: "Best of both", gems: "Hidden gems" };
  W.focus = function () {
    var f = W.S.focus;
    return f && W.FOCUS[f] ? f : "icons";
  };
  /* a place the planner must never use: closed for good, or one the check could not find at all (a made-up name), or a duplicate */
  W.gone = function (it) {
    return !!it && (it.st === "closed" || it.st === "unfound" || it.st === "dup");
  };
  W.isPaid = function (it) {
    return !!it.ticket && !/^\s*free/i.test(it.ticket);
  };
  W.needsBooking = function (it) {
    return /book|reserv|advance|timed|pre-?book|sell out|slot/i.test(it.ticket || "") || it.reserve === true;
  };

  /* recommended time to spend somewhere: "2-3 hours", "90 min", "1h30", "half day" -> "2–3 h", "1½ h", "Half day" */
  var U = "(hours?|hrs?|h|minutes?|mins?|m)";
  function unit(u) {
    return u && u.charAt(0) === "m" ? 1 : 60;
  }
  function hrs(m) {
    var h = Math.round(m / 30) / 2;
    return h % 1 ? (Math.floor(h) || "") + "½" : String(h);
  }
  function mins(m) {
    return Math.max(5, Math.round(m / 5) * 5);
  }
  function fmtDur(lo, hi) {
    if (!(lo > 0)) return "";
    if (hi != null && !(hi > lo)) hi = null;
    if (lo >= 420) return "Full day";
    if (hi == null) return lo < 60 ? mins(lo) + " min" : hrs(lo) + " h";
    if (hi <= 60) return mins(lo) + "–" + mins(hi) + " min";
    if (lo < 60) return mins(lo) + " min–" + hrs(hi) + " h";
    return hrs(lo) === hrs(hi) ? hrs(lo) + " h" : hrs(lo) + "–" + hrs(hi) + " h";
  }
  /* (kept by the text: the planner reads the same few durations again for every slot it tries while it fits a trip's
     days, and taking one apart builds two patterns each time) */
  var DURS = /** @type {Record<string, string>} */ ({}),
    nDurs = 0;
  W.durText = function (raw) {
    var k = String(raw || "");
    if (Object.prototype.hasOwnProperty.call(DURS, k)) return DURS[k];
    if (++nDurs > 2000) {
      DURS = {};
      nDurs = 1;
    }
    return (DURS[k] = readDur(k));
  };
  /** @param {string} raw */
  function readDur(raw) {
    var s = String(raw || "")
      .toLowerCase()
      .trim();
    if (!s) return "";
    if (/full|all[ -]?day|whole day|entire day/.test(s)) return "Full day";
    if (/half[ -]?day|half a day/.test(s)) return "Half day";
    s = s
      .replace(/½/g, ".5")
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(\d+)\s*h(?:ours?|rs?)?\s*(\d{1,2})\s*(?:m(?:in(?:ute)?s?)?)?(?![\d.])/g, function (a, h, m) {
        return +h + m / 60 + "h";
      });
    var m = s.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + U + "?\\s*(?:-|–|—|to)\\s*(\\d+(?:\\.\\d+)?)\\s*" + U + "?"));
    if (m) return fmtDur(+m[1] * unit(m[2] || m[4]), +m[3] * unit(m[4] || m[2]));
    m = s.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + U + "?"));
    if (m) return fmtDur(+m[1] * (m[2] ? unit(m[2]) : +m[1] > 12 ? 1 : 60), null);
    return "";
  }
  /* time to plan for a stop: the place's own estimate, else a typical length for the meal */
  var MEAL_DUR = { breakfast: "30–45 min", lunch: "1–1½ h", dinner: "1½–2 h" };
  W.stayText = function (it, food, slot) {
    var t = W.durText(it.dur);
    if (food && /day$/.test(t)) t = ""; /* a meal is never a half day */
    if (!t && food) t = MEAL_DUR[slot] || MEAL_DUR[it.meal] || MEAL_DUR.lunch;
    if (!t && it.s === "any") t = "Full day";
    return t;
  };

  /* every destination in a country: cities, towns and areas (the Amalfi Coast, the Algarve). An island is never an entry; its towns are, each naming the island
     (isl). A list cached before islands were handled this way (no v) is asked again once; the old one stays in use
     until the new one comes, and for good if it doesn't */
  W.COUNTRY_V = 2;
  W.loadCountry = function (name) {
    var key = "country|" + name,
      had = /** @type {Cache["country"][string] | undefined} */ (W.C.country[name]);
    if ((had && (had.v || 0) >= W.COUNTRY_V) || W.status[key]) return;
    if (
      !had &&
      W.kept &&
      W.kept("country", name, function () {
        W.loadCountry(name);
      })
    )
      return; /* kept on this device? (lib/ideastore.js) */
    if (had && had.part) had = undefined; /* a list cut short last time (the app was closed while it came): asked whole */
    run(key, { ask: "ideas.0", a: [had, name], lib: { place: [name], kind: "cities" } }, "quick");
  };
  /** an answer that still names an island as a place (its name is its own isl) loses it when the island's towns are
      there too; alone, it is that island's one town and stays @param {BuiltCity[]} list */
  W.townsOnly = function (list) {
    return list.filter(function (c) {
      if (!c.isl || W.norm(c.isl) !== W.norm(c.name)) return true;
      return !list.some(function (o) {
        return o !== c && o.isl && W.norm(o.isl) === W.norm(c.isl);
      });
    });
  };
  /** A list from before, brought up to date with a new answer without the places you already see shifting: every
      town it had stays as it was (so a suggested trip keeps its stops), each island it named gives way to that
      island's towns, and a town now known to be on an island says so. Nothing else is added.
      @param {BuiltCity[]} old @param {BuiltCity[]} fresh */
  W.islesInto = function (old, fresh) {
    var isl = Object.create(null),
      by = Object.create(null),
      seen = Object.create(null),
      out = [];
    fresh.forEach(function (c) {
      by[W.norm(c.name)] = c;
      if (c.isl && W.norm(c.isl) !== W.norm(c.name)) isl[W.norm(c.isl)] = 1;
    });
    old.forEach(function (c) {
      var k = W.norm(c.name),
        f = by[k];
      if (isl[k] || seen[k]) return;
      seen[k] = 1;
      out.push(f && f.isl && !c.isl ? Object.assign({}, c, { isl: f.isl }) : c);
    });
    fresh.forEach(function (c) {
      var k = W.norm(c.name);
      if (c.isl && !seen[k]) {
        seen[k] = 1;
        out.push(c);
      }
    });
    return out;
  };

  /* 25+ things to do, plus places to eat, transit and where to stay, for one city */
  var tries = {};
  /* enough ideas for a city: past this, "Find more" stops asking (the lists stay as they are) */
  W.IDEA_CAP = { spots: 60, food: 40 };
  /* how many of each a city starts with: 15, and more when this trip stays there longer (about four for each day of
     the stay: a morning, an afternoon and three meals, with a few to choose between), up to 30. It goes by the days this
     trip spends in the place, never by how long a visit is recommended. When you make a stay longer, the difference is
     fetched (W.growIdeas). The rest comes only on "Find more" */
  W.FIRST_IDEAS = 15;
  /** @param {number} [stayDays] the days this trip spends in the place */
  W.firstIdeas = function (stayDays) {
    return Math.max(W.FIRST_IDEAS, Math.min(30, 4 * (Math.round(Number(stayDays)) || 0) + 3));
  };
  /* the days this trip spends in a place, as the plan stands (0 for a day trip or a place not in the trip) */
  W.stayDays = function (country, city) {
    var n = 0;
    ((W.P && W.P.stops) || []).forEach(function (s) {
      if (s.country === country && s.name === city) n += s.days || 0;
    });
    return n;
  };
  function setAside(pool, list) {
    return (pool && pool.rest && pool.rest[list]) || [];
  }
  W.ideasFull = function (pool) {
    return (
      !!pool &&
      !setAside(pool, "spots").length &&
      !setAside(pool, "food").length &&
      (pool.spots || []).length >= W.IDEA_CAP.spots &&
      (pool.food || []).length >= W.IDEA_CAP.food
    );
  };
  /* the names a city already has (on show or set aside): no list repeats them */
  function namesOf(cur, list) {
    return cur && cur[list]
      ? cur[list].concat(setAside(cur, list)).map(function (x) {
          return x.n;
        })
      : [];
  }
  /* when you've set your lodging, extra ideas come from around it */
  function nearStay(ck) {
    var st = W.S.stays[ck];
    return st && st.label ? " Focus on places within an easy trip of " + st.label + "." : "";
  }
  /** @param {string} country @param {string} city @param {boolean} [more] @param {number} [stayDays] @param {number} [nMore]
      @param {boolean} [low] asked ahead (a city Plan offers but nobody picked yet): after everything else */
  W.loadCity = function (country, city, more, stayDays, nMore, low) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    /* a city asked for ahead is asked for now once someone needs it (it moves up the line, or starts right away) */
    if (!more) W[low ? "loadLow" : "loadNow"](["spots|" + ck, "food|" + ck]);
    if (!more && cur && cur.spots && cur.spots.length) return;
    if (
      !cur &&
      W.kept &&
      W.kept("city", ck, function () {
        W.loadCity(country, city, more, stayDays, nMore);
      })
    )
      return; /* kept on this device? (lib/ideastore.js) */
    /* never ask about the same city over and over if answers keep coming back empty */
    /* count real attempts only: a redraw while this city's lists are on their way isn't another try */
    if (!more && W.cityBusy(ck)) return;
    var tk = ck + (more ? "|more" : "");
    tries[tk] = (tries[tk] || 0) + 1;
    if (!more && tries[tk] > 3) return;
    var ex = namesOf(cur, "spots"),
      exF = namesOf(cur, "food"),
      where = city + ", " + country,
      near = more ? nearStay(ck) : "";
    var lean = W.S.styles.length
      ? " Lean toward the travelers' interests (" +
        W.S.styles
          .map(function (x) {
            return W.STYLE_NAME[x];
          })
          .join(", ") +
        "): at least half should suit them, alongside the must-see sights."
      : "";
    if (more) {
      /* a few more at a time, up to the city's cap: the last ideas of a long list are the likeliest to be made up, and
         every one of them waits for a nightly check and a photo */
      var have = W.pool(country, city),
        nS = have ? (have.spots || []).length : 0,
        nF = have ? (have.food || []).length : 0;
      var askS = Math.min(nMore || 10, W.IDEA_CAP.spots - nS - setAside(cur, "spots").length),
        askF = Math.min(nMore || 8, W.IDEA_CAP.food - nF - setAside(cur, "food").length);
      /* "Find more" (you asked): ten more things to do and eight more places to eat go on show. A city that holds more
         than it shows (ideas set aside by W.fitIdeas) brings those out at once; Claude is asked only for what is still missing */
      if (nMore == null && cur && !cur.fallback) {
        var stay = W.stayDays(country, city),
          sh = cur.showN || (cur.showN = {});
        sh.spots = Math.max(W.ideaLimit(cur, "spots", stay), nS) + 10;
        sh.food = Math.max(W.ideaLimit(cur, "food", stay), nF) + 8;
        if (W.fitIdeas(country, city, stay, true)) changed();
        askS = Math.min(sh.spots, W.IDEA_CAP.spots) - cur.spots.length;
        askF = Math.min(sh.food, W.IDEA_CAP.food) - (cur.food || []).length;
      }
      if (askS > 0) run("spots|" + ck, { ask: "ideas.1", a: [askS, ck, ex, lean, near, where] }, "default");
      if (askF > 0) run("food|" + ck, { ask: "ideas.2", a: [askF, ck, exF, near, where] }, "default");
      return;
    }
    /* the first lists: 15 things to do and 15 places to eat (more for a long stay: W.firstIdeas), one question each. More only when someone asks for them
       ("Find more"): long lists take minutes to write, and their last ideas are the likeliest to be made up */
    /* A long stay's quota (18 or more of each) is asked for in two goes: 12 first, so the days fill sooner, and the rest
       in the background (W.growIdeas, after these arrive). The first lists leave the booking and menu links out; the
       links come with the check of the places a day uses (W.loadBookLinks). Both lists are taken in as they are
       written (stream): the days fill a few places at a time, and are planned afresh once the whole list is in. */
    var nFirst = W.firstIdeas(stayDays != null ? stayDays : W.stayDays(country, city)),
      n0 = nFirst >= 18 ? 12 : nFirst;
    var streamed = { spots: false, food: false };
    /* planned afresh once, when both lists are whole (what was picked while they came was picked from a few) */
    function settle() {
      if ((streamed.spots || streamed.food) && !W.cityBusy(ck) && W.freshPicks) W.freshPicks(country, city);
    }
    /* (both may be answered from the city library: lib/citylib.js) */
    var place = [country, city];
    run("spots|" + ck, { ask: "ideas.3", a: [city, ck, country, n0, settle, streamed], lib: { place: place, kind: "spots" } }, "default");
    run("food|" + ck, { ask: "ideas.4", a: [ck, exF, n0, settle, streamed, where], lib: { place: place, kind: "food" } }, "default");
  };
  /** Plan offers this city (a chip under its country): its first lists are asked for ahead, after everything else, so
      they are there or nearly there when it is picked (the owner: "3-5 seconds"). Most come from the city library at
      once; one that isn't there yet is asked of Claude, which then keeps it for everyone. @param {string} country
      @param {string} city */
  W.warmCity = function (country, city) {
    if (W.pool(country, city)) return;
    W.loadCity(country, city, false, undefined, undefined, true);
  };
  /* the stay got longer (you changed the days): the ideas grow with it, by the difference, once */
  W.growIdeas = function (country, city, stayDays) {
    var ck = W.cityKey(country, city),
      c = W.C.city[ck];
    if (!c || !c.spots || !c.spots.length || W.readOnly || W.cityBusy(ck)) return;
    var had = Math.max(c.askedN || W.FIRST_IDEAS, Math.min(c.spots.length, (c.food || []).length)),
      want = W.firstIdeas(stayDays);
    if (want <= had) return;
    c.askedN = want;
    ["spots|", "food|"].forEach(function (p) {
      if (W.status[p + ck] !== "loading") delete W.status[p + ck];
    });
    W.loadCity(country, city, true, stayDays, want - had);
  };
  /* ---------- enough places to eat for every meal of the stay ----------
     The first lists are sized by the days (W.firstIdeas), yet a meal can still be left without a place: none of the
     places is near that day's stops (the usual reason: the planner leaves a meal free rather than send you across
     town), too few breakfast cafés for a long stay, kitchens that open after the children's dinner time, places shut on
     the day, ones the group can't eat at, ones you said no to. After each planning, lib/plan.js counts the meals left
     empty in a town (short: how many breakfasts, lunches and dinners, and which stop each should be near) and this
     brings in places for exactly those: first the ones set aside that serve such a meal (pool.rest), then one question
     to Claude for the meals still missing, each near its stop, with one to spare so the day has a choice. At most
     MEAL_ASKS questions per town for a given stay and lodging (the count is kept with its ideas), MEAL_LIST places a
     question, never while its lists are still arriving, never past the town's cap. A meal that stays empty after that
     says so on its day, with "Find more ideas". Returns what it did: "out" (brought places out), "ask" (asked), or "" */
  var MEAL_ASKS = 3,
    MEAL_LIST = 12;
  function hhmm(m) {
    return Math.floor(m / 60) + ":" + ("0" + (m % 60)).slice(-2);
  }
  /** @param {string} country @param {string} city @param {MealGap} short */
  W.mealIdeas = function (country, city, short) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck],
      at = short.at || [];
    if (!at.length || !cur || cur.fallback || W.readOnly || !W.SAMPLE || !(cur.food || []).length) return "";
    if (W.cityBusy(ck) || W.status["food|" + ck]) return "";
    var stay = W.stayDays(country, city) || 1,
      sh = cur.showN || (cur.showN = {}),
      aside = setAside(cur, "food");
    /* set aside, and right for a meal that is missing: out first (the planning that follows counts again) */
    if (aside.length && cur.rest && W.mealFits) {
      var serves = function (x) {
        return at.some(function (a) {
          return W.mealFits(x, a.meal) && !W.gone(x);
        });
      };
      var hit = aside.filter(serves);
      if (hit.length) {
        cur.rest.food = hit.concat(
          aside.filter(function (x) {
            return !serves(x);
          })
        );
        sh.food = Math.max(W.ideaLimit(cur, "food", stay), cur.food.length) + Math.min(hit.length, at.length * 2);
        if (W.fitIdeas(country, city, stay)) return "out";
      }
    }
    /* a new stay or a new lodging starts the count again: the meals are somewhere else now */
    var st = W.S.stays[ck],
      sig = stay + "|" + ((st && st.label) || "");
    if (cur.mealFor !== sig) {
      cur.mealFor = sig;
      cur.mealAsks = 0;
    }
    var room = Math.min(MEAL_LIST, W.IDEA_CAP.food - cur.food.length - aside.length);
    if ((cur.mealAsks || 0) >= MEAL_ASKS || room <= 0) return "";
    /* the same meal near the same stop is one line: as many places as it is missing, and one more */
    var kd = W.kidDinner(),
      lines = /** @type {{ meal: string, n: string, lat: number | null, lng: number | null, km: number, c: number }[]} */ ([]),
      byKey = /** @type {Record<string, number>} */ ({});
    at.forEach(function (a) {
      var k = a.meal + "|" + a.n;
      if (byKey[k] == null) byKey[k] = lines.push({ meal: a.meal, n: a.n, lat: a.lat, lng: a.lng, km: a.km, c: 0 }) - 1;
      lines[byKey[k]].c++;
    });
    var total = 0,
      parts = /** @type {string[]} */ ([]);
    lines.forEach(function (l) {
      var n = Math.min(l.c + 1, room - total);
      if (n <= 0) return;
      total += n;
      parts.push(
        n +
          " for " +
          l.meal +
          (l.n && l.lat != null && l.lng != null
            ? " near " + l.n + " (" + l.lat.toFixed(3) + ", " + l.lng.toFixed(3) + "), no more than about " + l.km + " km from it"
            : "") +
          (l.meal === "breakfast"
            ? " (a café or bakery open in the morning)"
            : l.meal === "dinner" && kd != null
              ? " (kitchen open by " + hhmm(kd) + ": the children eat early)"
              : "")
      );
    });
    if (!total) return "";
    cur.mealAsks = (cur.mealAsks || 0) + 1;
    run("food|" + ck, { ask: "ideas.5", a: [city, ck, country, cur, parts, total] }, "default");
    return "ask";
  };
  /* ---------- what you love (Plan, "Food you love") ----------
     A city's first list was asked before you said what you love, so the places for it may not be in it: once per
     city and per what you typed, a few are asked for, unless the list has enough already. They come marked like
     any other (can you eat there, how much it is a place for what you love), and the meals the planner chose in
     that city are chosen again (never the ones you chose). */
  var LOVED_ENOUGH = 4;
  W.lovedCount = function (country, city) {
    var cur = W.C.city[W.cityKey(country, city)];
    return ((cur && cur.food) || []).filter(function (x) {
      return W.eatLike(x) >= 2 && W.eatFit(x) !== "poor";
    }).length;
  };
  W.loadLoved = function (country, city) {
    var n = W.eatNeeds && W.eatNeeds();
    if (!n || !n.love || W.readOnly || !W.SAMPLE) return;
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck],
      want = W.norm(n.love);
    if (!cur || cur.fallback || cur.lovedFor === want || W.cityBusy(ck) || W.status["eatlove|" + ck]) return;
    /* (the check of the places already listed comes first: it may find enough of them) */
    if (
      (cur.food || []).some(function (x) {
        return !x.eat || x.eat.sig !== W.eatSig();
      })
    )
      return;
    cur.lovedFor = want;
    if (W.lovedCount(country, city) >= LOVED_ENOUGH) return;
    run("eatlove|" + ck, { ask: "ideas.6", a: [city, ck, country, cur, n] }, "default");
  };
  /* ---------- no more ideas on show than the stay calls for ----------
     A city shows 15 things to do and 15 places to eat (more for a longer stay: W.firstIdeas), plus what you asked for
     ("Find more", a search, hidden gems: pool.showN). A city that holds more than that (lists from before the limit,
     places from another of your devices, the nightly restaurants) keeps the extra set aside in pool.rest: not shown,
     not planned with, and brought out first, at once, when you ask for more or stay longer. Never set aside: a place
     on one of this trip's days, and a place you added yourself. Among the places to eat, breakfast keeps its share,
     and among the things to do, the evening. Run after every planning (lib/plan.js), so it also tidies what arrives
     later; returns whether anything moved. Also never set aside: the replacement for a place that has closed */
  W.ideaLimit = function (c, list, stayDays) {
    return Math.max(W.firstIdeas(stayDays), (c && c.showN && c.showN[list]) || 0);
  };
  var fitTold = false,
    fitRuns = {};
  W.fitIdeas = function (country, city, stayDays, quiet) {
    var c = /** @type {any} */ (W.C.city[W.cityKey(country, city)]); /* (both lists are handled the same way) */
    if (!c || c.fallback || W.readOnly || !c.spots || !c.spots.length) return false;
    var kept = {},
      picks = W.S.picks || {};
    Object.keys(picks).forEach(function (k) {
      if (picks[k]) kept[W.norm(picks[k])] = 1;
    });
    /* (rp: the replacement the nightly check gave for a place that has closed. lib/places.js adds it whenever it is not
       on the list, so setting it aside would have the two take turns for ever) */
    var isKept = function (x) {
      return !!(x.imp || x.rp || kept[W.norm(x.n)]);
    };
    var moved = false,
      rest = c.rest && typeof c.rest === "object" ? c.rest : { spots: [], food: [] };
    /** @type {Array<"spots" | "food">} */ (["spots", "food"]).forEach(function (L) {
      var n = W.ideaLimit(c, L, stayDays),
        list = c[L] || [],
        r = Array.isArray(rest[L]) ? rest[L] : [],
        on = {};
      list.forEach(function (x) {
        on[W.norm(x.n)] = 1;
      });
      var r2 = r.filter(function (x) {
        return x && x.n && !on[W.norm(x.n)];
      });
      if (r2.length !== r.length) {
        r = r2;
        moved = true;
      }
      if (list.length > n) {
        /* a kind every day needs keeps its share: breakfast among the places to eat, the evening among the things to do */
        var need =
          L === "food"
            ? function (x) {
                return x.meal === "breakfast" || x.meal === "all";
              }
            : function (x) {
                return x.s === "eve";
              };
        var quota = L === "food" ? Math.max(4, Math.round(n / 4)) : 3,
          room = n,
          take = [];
        list.forEach(function (x, i) {
          if (isKept(x)) {
            take[i] = 1;
            room--;
            if (need(x)) quota--;
          }
        });
        list.forEach(function (x, i) {
          if (!take[i] && room > 0 && quota > 0 && need(x)) {
            take[i] = 1;
            room--;
            quota--;
          }
        });
        list.forEach(function (x, i) {
          if (!take[i] && room > 0) {
            take[i] = 1;
            room--;
          }
        });
        var out = list.filter(function (x, i) {
          return !take[i];
        });
        if (out.length) {
          c[L] = list.filter(function (x, i) {
            return take[i];
          });
          r = out.concat(r);
          moved = true;
        }
      } else if (list.length < n && r.length) {
        var up = r.slice(0, n - list.length);
        c[L] = list.concat(up);
        r = r.slice(up.length);
        moved = true;
      }
      rest[L] = r;
    });
    if (moved || c.rest) c.rest = rest;
    /* the lists changed under a plan that was being made: save them and draw again, once, when it is done. A city's
       lists settle in a pass or two; if something keeps putting back what this sets aside, stop redrawing for it
       (at most six times a minute for one city) rather than redraw without end */
    if (moved && !quiet) {
      var ck = W.cityKey(country, city),
        now = Date.now(),
        run = fitRuns[ck] || (fitRuns[ck] = { at: now, n: 0 });
      if (now - run.at > 60000) {
        run.at = now;
        run.n = 0;
      }
      run.n++;
      if (run.n <= 6 && !fitTold) {
        fitTold = true;
        setTimeout(function () {
          fitTold = false;
          changed();
        }, 0);
      }
    }
    return moved;
  };
  /* a place one of your trips has on a day, found among the ideas set aside: back on show */
  W.fromRest = function (pool, name, food) {
    var L = food ? "food" : "spots",
      r = setAside(pool, L),
      k = W.norm(name);
    for (var i = 0; i < r.length; i++)
      if (W.norm(r[i].n) === k) {
        var it = r.splice(i, 1)[0];
        (pool[L] || (pool[L] = [])).push(it);
        return it;
      }
    return null;
  };
  /* is anything still coming in for this city's first lists? */
  W.cityBusy = function (ck) {
    return ["spots|", "food|"].some(function (p) {
      return W.status[p + ck] === "loading";
    });
  };

  /* lists asked before every place was rated: how essential each one is and how well it is reviewed (once per city) */
  W.loadFame = function (country, city) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    if (!cur || cur.fameAsked || W.cityBusy(ck)) return;
    var todo = /** @type {(Spot | Food)[]} */ (cur.spots || []).concat(cur.food || []).filter(function (x) {
      return x && x.n && x.fame === undefined;
    });
    if (todo.length < 4) return;
    cur.fameAsked = 1;
    run("fame|" + ck, { ask: "ideas.7", a: [city, country, todo] }, "quick");
  };

  /* rainy-day backups: indoor places for when the day has to change (asked once per city) */
  W.loadIndoor = function (country, city) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    if (!cur || !cur.spots || cur.indoorAsked || W.cityBusy(ck)) return;
    cur.indoorAsked = 1;
    run("indoor|" + ck, { ask: "ideas.8", a: [city, ck, country, cur] }, "default");
  };
  /* what the questions and the answers' handling use from here: they come later, in a file of their own (lib/ideasask.js) */
  W.ASK_X.ideas = { TAGS: TAGS, V: V, centerOf: centerOf, namesOf: namesOf, newPool: newPool, who: who };
})();
