/* ideas.js's questions to Claude, word for word, and what is done with each answer: only needed once Claude is
   asked, so they come after the first screen (the "ask" piece; lib/core.js W.run sends a question when it is in).
   Each entry: q = the question, ok = the answer's handler, stream = the items handed over while the answer is written;
   all three are given what the loader in lib/ideas.js had at hand when it asked. */
(function () {
  "use strict";
  var W = window.W,
    X = W.ASK_X.ideas,
    TAGS = X.TAGS,
    V = X.V,
    centerOf = X.centerOf,
    namesOf = X.namesOf,
    newPool = X.newPool,
    who = X.who;
  /* how a list request leans, in words */
  function focusAsk() {
    var f = W.focus();
    return f === "gems"
      ? " These travelers want to see the place like a local: favor hidden gems, neighborhood favorites and lesser-known places that delight, over the famous crowd-pullers."
      : f === "both"
        ? " These travelers want the famous highlights plus some lesser-known gems that delight: mix both."
        : " These travelers want the must-sees: favor the famous, essential places a first-time visitor should not miss.";
  }
  W.focusAsk = focusAsk;
  /* every suggestion is rated: how essential it is and how well visitors review it */
  var FAMERULE =
    " fame = 2 for the essential must-sees most visitors come for (a city's top handful), 1 for popular, well-known places, 0 for hidden gems and local favorites most visitors miss. rating = its typical visitor review score out of 5 on Google or Tripadvisor, one decimal (0 if you do not know). Only suggest places that are consistently well reviewed (about 4.3 or more); never a tourist trap.";
  var MENURULE =
    "menu = the place's own website page that shows its menu (or its homepage if the menu is there), only if you are confident of the exact address; otherwise an empty string.";
  var BOOKRULE =
    "book = for any place that charges admission or needs booking: the page on the place's OWN official website (or its official government/foundation ticket office) where visitors buy tickets. Never a reseller, tour operator or look-alike ticket site (no GetYourGuide, Viator, Tiqets, Klook, Headout, Musement, 'colosseumtickets.com' style sites). If you are not confident of the exact official address, an empty string.";
  var TAGRULE =
    " Tags (t) only from: " + TAGS.join(",") + ". k: 1 = great for small kids, 0 = fine, -1 = better for older kids and adults.";
  /** the first question about a place: its n best things to do, most important first, without booking links
      (lib/speedtest.js asks the same) @param {string} country @param {string} city @param {number} n */
  W.spotsAsk = function (country, city, n) {
    var lean = W.S.styles.length
      ? " Lean toward the travelers' interests (" +
        W.S.styles
          .map(function (x) {
            return W.STYLE_NAME[x];
          })
          .join(", ") +
        "): at least half should suit them, alongside the must-see sights."
      : "";
    var focusSpots =
      W.focus() === "gems"
        ? " Lean toward places locals love and most visitors miss, each still well reviewed, alongside the few unmissable sights."
        : W.focus() === "icons"
          ? " Lean toward the most popular, best-reviewed places."
          : " Mostly the headline places most visitors come for, plus a few well-loved local favorites.";
    return (
      "List the " +
      n +
      " best things to do in and around " +
      city +
      ", " +
      country +
      ", most important first." +
      focusSpots +
      lean +
      " Include at least 3 evening options (sunset spots, evening strolls, shows), at least 2 indoor options for a rainy or too-hot afternoon, and a day trip if there is a classic one." +
      " If it is a large region or island, give options in each main area so a day can stay in one area. Do not include trains, transfers or transport as activities. " +
      who() +
      '\nReply with JSON only: {"d":"what ' +
      city +
      ' is known for, one sentence","lat":0,"lng":0,"spots":[' +
      SPOT_EX.replace('"book":"",', "") +
      "]}\n" +
      spotRules().replace(BOOKRULE + " ", "")
    );
  };
  /* the question for a list of places to eat. what = the list wanted, in words; have = the names not to repeat;
     extra = other fields asked for in the same answer (the first list brings transit and where to stay); first = the
     first list: no booking or menu links (they come later, for the places a day uses) */
  function foodAsk(what, have, extra, first) {
    var ex = foodEx(),
      rules = foodRules();
    if (first) {
      ex = ex.replace('"book":"","menu":"",', "");
      rules = rules
        .replace(MENURULE + " ", "")
        .replace("; then book = its official website or reservation page if you are confident of the address, else an empty string", "");
    }
    return (
      what +
      " " +
      who() +
      W.eatAsk() +
      (have.length ? " Do not repeat: " + have.join("; ") + "." : "") +
      "\nReply with JSON only: {" +
      (extra || "") +
      '"food":[' +
      ex +
      "]}\n" +
      rules +
      (extra ? " Give 4 stay neighborhoods." : "")
    );
  }
  /* how many of each this city has been asked for (kept with its ideas): a longer stay later asks only for the difference */
  function asked(ck, n) {
    var c = W.C.city[ck];
    if (c) c.askedN = Math.max(c.askedN || 0, n);
  }
  /* (v158: "sure" and the rule about names. Of 3,544 suggestions the nightly check had judged, 9% were not real places,
     nearly all of them places to eat in small towns, with names made from the kind of place and the town. Told to list
     only what it is certain of, Sonnet gave 1 to 8 places for a town; asked to mark what it is unsure of, it kept the
     list, and the unsure ones failed a map lookup 43% of the time against 5% for the sure ones: evo/v157/grade.
     V.food turns sure = false into "not checked yet", which the planner picks last: lib/validate.js) */
  var FOOD_EX =
    '{"n":"name","d":"what it is known for or what to order, one short sentence","fame":1,"rating":4.5,"cuisine":"","price":"€€","meal":"both","dur":"1h","fav":false,"k":0,"sure":true,"reserve":false,"book":"","menu":"","pic":"taverna","lat":0,"lng":0}';
  function foodRules() {
    return (
      "pic = the picture that fits best, one of: " +
      W.FOOD_PICS.join(", ") +
      ". " +
      MENURULE +
      " reserve = true if booking a table ahead is recommended; then book = its official website or reservation page if you are confident of the address, else an empty string. meal = breakfast, lunch, dinner, both (lunch and dinner) or all (all three). dur = the recommended time to allow for a meal there, e.g. '30m' for a bakery, '1-1.5h' for a sit-down lunch, '2h' for a long dinner. fav = true for places food lovers seek out (a famous classic, a top market, a destination restaurant). Use real places and accurate coordinates. n = the exact name on its sign: never a name made from the kind of place and the town ('Pasticceria Positano', 'Elounda Gelato'), never an area's places as one entry ('Plaka seaside tavernas'). sure = false when you are not certain the place exists under this exact name in this town (it may have closed, or you may be thinking of a place somewhere else), true otherwise; a place you are unsure of may still be listed, marked so." +
      TAGRULE.split(" Tags")[0] +
      " k: 1 = very family friendly, 0 = fine, -1 = adults-oriented." +
      FAMERULE.replace("must-sees most visitors come for (a city's top handful)", "famous institutions visitors seek out").replace(
        "hidden gems and local favorites most visitors miss",
        "neighborhood places locals love"
      )
    );
  }
  /* add places to eat; front = the best-loved half, which stays at the top of the list whichever half arrives first */
  function foodEx() {
    return W.eatSig() ? FOOD_EX.replace(/\}$/, ',"fit":"good","fitw":""}') : FOOD_EX;
  }
  function addFood(ck, r, kind) {
    var c0 = W.C.city[ck] || newPool(),
      ctr = centerOf(ck);
    var add = V.list(r && r.food, function (x) {
      return V.food(x, ctr);
    });
    W.eatMark(add);
    c0.food = V.oneEach(V.oneEach(merge(c0.food || [], add, kind), "menu"), "book");
    W.C.city[ck] = c0;
  }
  /* A city's list is in a fixed order, whichever answer comes in first: the planner gives a list's first places a boost,
     so an order that followed the answers' arrival would plan the same data differently from one time to the next. Each
     batch has its kind's rank (RANK) and goes after everything of its rank or lower that came in this session (what was
     kept from before stays first); the headline half also takes the place of a repeat already listed. */
  var RANK = { head: 0, b: 1, more: 2, indoor: 5, eatmore: 3 };
  var rankOf = typeof WeakMap === "function" ? new WeakMap() : null;
  function merge(list, add, kind) {
    var r = RANK[kind] || 0,
      rk = function (x) {
        var v = rankOf && rankOf.get(x);
        return v == null ? -1 : v;
      };
    add.forEach(function (x) {
      if (rankOf) rankOf.set(x, r);
    });
    if (kind === "head") {
      var mine = {};
      add.forEach(function (x) {
        mine[W.norm(x.n)] = 1;
      });
      list = list.filter(function (x) {
        return !mine[W.norm(x.n)];
      });
    } else {
      var have = {};
      list.forEach(function (x) {
        have[W.norm(x.n)] = 1;
      });
      add = add.filter(function (x) {
        return !have[W.norm(x.n)];
      });
    }
    var at = list.length;
    for (var i = 0; i < list.length; i++)
      if (rk(list[i]) > r) {
        at = i;
        break;
      }
    return list.slice(0, at).concat(add, list.slice(at));
  }
  /* the shape of one thing to do, shared by every request for them */
  var SPOT_EX =
    '{"n":"name","d":"what it is or what it is known for, one short sentence","t":["tag"],"fame":1,"rating":4.6,"k":0,"s":"am","dur":"2h","ticket":"Free","book":"","pic":"oldtown","place":"the real place","lat":0,"lng":0}';
  function spotRules() {
    return (
      "place = the exact name of the real place, as on its sign or on a map (for an outing such as a stroll, a tasting or a cruise, the real place where it happens, e.g. 'Piazza Duomo' or 'Marina Grande'); never an invented or descriptive name. n may be descriptive, place may not. pic = the picture that fits best, one of: " +
      W.SPOT_PICS.join(", ") +
      ". s = best time: am, pm, eve, or any (a full-day outing). dur = the recommended time to spend there for these travelers" +
      (W.party().kid ? " (allow for children's ages)" : "") +
      ", e.g. '45m', '1-2h', 'half day' or 'full day'. ticket = 'Free', or price and whether to book ahead, e.g. '€18, book ahead'. " +
      BOOKRULE +
      " Use accurate coordinates." +
      TAGRULE +
      FAMERULE
    );
  }
  /* extras you asked for by name (hidden gems, rainy-day ideas, ideas for your style) come on top of what is on show */
  function bumpShown(ck, c0, list, added) {
    if (added <= 0) return;
    var p = ck.split("|"),
      sh = c0.showN || (c0.showN = {});
    sh[list] = Math.min(c0[list].length, W.ideaLimit(c0, list, W.stayDays(p[0], p[1]))) + added;
  }
  function addSpots(ck, r, kind) {
    var c0 = W.C.city[ck] || newPool();
    if (r && r.d && !c0.d) c0.d = V.str(r.d, 240);
    /* the city's own pin: only when it agrees with the built-in one (when there is one) */
    var cp = r && V.pinNear(r.lat, r.lng, centerOf(ck), 120);
    if (cp && c0.lat == null) {
      c0.lat = cp.lat;
      c0.lng = cp.lng;
    }
    var ctr = centerOf(ck),
      add = V.list(r && r.spots, function (x) {
        return V.spot(x, ctr);
      });
    /* the headline half always leads the list (the planner gives the first few a boost), whichever half arrives first */
    var before = (c0.spots || []).length;
    c0.spots = V.oneEach(merge(c0.spots || [], add, kind), "book");
    W.C.city[ck] = c0;
    if (kind !== "head" && kind !== "more") bumpShown(ck, c0, "spots", c0.spots.length - before);
    return c0;
  }
  /* (two pieces of the questions about a city) */
  var EVE =
    " If it is a large region or island, give options in each main area so a day can stay in one area. Do not include trains, transfers or transport as activities. ";
  var TRANSIT =
    '"transit":{"system":"how public transit works and what a ticket costs, one sentence","pass":"best pass or card for visitors","airport":"how to get from the main airport or station to the center","tip":"one practical tip"},"stay":[{"n":"neighborhood","d":"why stay here, short","lat":0,"lng":0}],';
  W.ASKS["ideas.0"] = {
    q: function (had, name) {
      return (
        "List the cities, towns and areas that travelers visit in " +
        name +
        ", the best known first. Be thorough: 80 to 120 places covering every region, from major cities to small towns. Only real places.\n" +
        "An island or a group of islands is never an entry. For an island, list its towns instead " +
        '(not "Crete" but Heraklion, Chania, Rethymno; for a small island its main town or port by its usual name, like "Hydra Town" or "Naxos Town"), each with the island\'s name in isl. ' +
        'isl is "" for a place on the mainland or on the country\'s main island.\n' +
        'Reply with JSON only: {"blurb":"one sentence about traveling in ' +
        name +
        '","cities":[{"name":"","region":"","isl":"","lat":0,"lng":0,"w":2,"pop":3,"base":1,"t":["tag"],"d":"what it is known for, max 12 words"}]}\n' +
        "w = suggested days (1-4). pop = how popular with visitors, 1-5. base = 1 for a place to stay a few nights (a city, " +
        "town or resort with hotels and restaurants), 0 for a day trip (a national park, nature reserve, mountain range, " +
        "lake, single sight, or a village with few places to stay or eat)." +
        TAGRULE.split(" k:")[0]
      );
    },
    ok: function (had, name) {
      return function (r) {
        var list = W.townsOnly(V.list(r && r.cities, V.city));
        /* the places the plan started on (below) stay first, as they were */
        var cur = W.C.country[name],
          top = cur && cur.part ? cur.cities : null;
        if (top) {
          var tk = {};
          top.forEach(function (c) {
            tk[W.norm(c.name)] = 1;
          });
          list = top.concat(
            list.filter(function (c) {
              return !tk[W.norm(c.name)];
            })
          );
        }
        /* keep even an empty answer so the page never asks again in a loop */
        W.C.country[name] = {
          blurb: String((r && r.blurb) || "") || (had && had.blurb) || "",
          cities: had && had.cities.length ? W.islesInto(had.cities, list) : list,
          v: W.COUNTRY_V
        };
      };
    },
    stream: function (had, name) {
      return {
        list: "cities",
        min: 8,
        take: function (items) {
          if ((had && had.cities.length) || W.C.country[name]) return;
          var first = W.townsOnly(V.list(items, V.city)).slice(0, 8);
          if (first.length < 5) return;
          first.forEach(function (c) {
            c.top = 1;
          });
          W.C.country[name] = { blurb: "", cities: first, part: 1 };
        }
      };
    }
  };
  W.ASKS["ideas.1"] = {
    q: function (askS, ck, ex, lean, near, where) {
      return (
        "List " +
        askS +
        " MORE things to do in and around " +
        where +
        ". Mix famous sights, local favorites, parks, markets, neighborhoods, experiences and a day trip." +
        lean +
        focusAsk() +
        " Include at least " +
        Math.max(1, Math.min(3, Math.round(askS / 4))) +
        " evening options (sunset spots, evening strolls, shows, night markets)." +
        EVE +
        near +
        " " +
        who() +
        (ex.length ? " Do not repeat any of these: " + ex.join("; ") + "." : "") +
        '\nReply with JSON only: {"spots":[' +
        SPOT_EX +
        "]}\n" +
        spotRules()
      );
    },
    ok: function (askS, ck, ex, lean, near, where) {
      return function (r) {
        addSpots(ck, r, "more");
      };
    }
  };
  W.ASKS["ideas.2"] = {
    q: function (askF, ck, exF, near, where) {
      return foodAsk(
        "List " +
          askF +
          " MORE places to eat in " +
          where +
          ": breakfast cafés and bakeries, local classics, casual spots and markets, spread across the city or region." +
          focusAsk() +
          near,
        exF
      );
    },
    ok: function (askF, ck, exF, near, where) {
      return function (r) {
        addFood(ck, r, "more");
      };
    }
  };
  W.ASKS["ideas.3"] = {
    q: function (city, ck, country, n0, settle, streamed) {
      return W.spotsAsk(country, city, n0);
    },
    ok: function (city, ck, country, n0, settle, streamed) {
      return function (r) {
        addSpots(ck, r, "head");
        asked(ck, n0);
        settle();
      };
    },
    stream: function (city, ck, country, n0, settle, streamed) {
      return {
        list: "spots",
        take: function (items, head) {
          streamed.spots = true;
          addSpots(ck, { d: head.d, lat: head.lat, lng: head.lng, spots: items }, "head");
        }
      };
    }
  };
  W.ASKS["ideas.4"] = {
    q: function (ck, exF, n0, settle, streamed, where) {
      return foodAsk(
        "List " +
          n0 +
          " places to eat in " +
          where +
          ": the best-loved local classics, casual " +
          (W.party().kid ? "and family-friendly " : "") +
          "spots, a couple of special dinners, and at least " +
          Math.max(4, Math.round(n0 / 4)) +
          " breakfast cafés or bakeries, spread across the city or region." +
          (W.focus() === "gems" ? " Favor the places locals go." : ""),
        exF,
        TRANSIT,
        true
      );
    },
    ok: function (ck, exF, n0, settle, streamed, where) {
      return function (r) {
        var c0 = W.C.city[ck] || newPool();
        var tr = r && V.transit(r.transit);
        if (tr && !c0.transit) c0.transit = tr;
        if (r && Array.isArray(r.stay) && !c0.stay)
          c0.stay = V.list(r.stay, function (x) {
            return V.stayArea(x, centerOf(ck));
          });
        W.C.city[ck] = c0;
        addFood(ck, r, "head");
        asked(ck, n0);
        settle();
      };
    },
    stream: function (ck, exF, n0, settle, streamed, where) {
      return {
        list: "food",
        take: function (items) {
          streamed.food = true;
          addFood(ck, { food: items }, "head");
        }
      };
    }
  };
  W.ASKS["ideas.5"] = {
    q: function (city, ck, country, cur, parts, total) {
      return foodAsk(
        "List " +
          total +
          " MORE places to eat in " +
          city +
          ", " +
          country +
          ", for the meals this trip has no place for yet: " +
          parts.join("; ") +
          ". Each must really serve that meal: set its meal field to it (or to both or all when it serves more). Where a meal names a spot, the place must really be that close to it." +
          focusAsk(),
        namesOf(cur, "food")
      );
    },
    ok: function (city, ck, country, cur, parts, total) {
      return function (r) {
        var c0 = W.C.city[ck],
          before = c0 ? (c0.food || []).length : 0;
        addFood(ck, r, "more");
        c0 = W.C.city[ck];
        bumpShown(ck, c0, "food", c0.food.length - before);
      };
    }
  };
  W.ASKS["ideas.7"] = {
    q: function (city, country, todo) {
      return (
        "Rate how essential each of these places in and around " +
        city +
        ", " +
        country +
        " is for a visitor, and how well visitors review it.\n" +
        todo
          .slice(0, 90)
          .map(function (x) {
            return x.n;
          })
          .join("\n") +
        '\nReply with JSON only: {"r":[["name exactly as given",2,4.6]]}\nThe second value is fame: 2 = an essential must-see most visitors come for (or a famous food institution), 1 = popular and well known, 0 = a hidden gem or local favorite most visitors miss. The third is its typical review score out of 5 on Google or Tripadvisor, one decimal, 0 if you do not know.'
      );
    },
    ok: function (city, country, todo) {
      return function (r) {
        var by = {};
        ((r && r.r) || []).forEach(function (x) {
          if (Array.isArray(x) && x[0]) by[W.norm(x[0])] = x;
        });
        todo.forEach(function (it) {
          var x = by[W.norm(it.n)];
          if (!x) return;
          var f = V.fame(x[1]);
          if (f !== undefined) it.fame = f;
          var g = V.rating(x[2]);
          if (g !== undefined) it.rating = g;
        });
      };
    }
  };
  W.ASKS["ideas.8"] = {
    q: function (city, ck, country, cur) {
      return (
        "List 10 indoor things to do in " +
        city +
        ", " +
        country +
        " for a rainy or too-hot afternoon: " +
        (W.party().kid
          ? "aquariums, science and children's museums, covered markets, indoor play centres, swimming pools,"
          : "museums, galleries, aquariums, covered markets, food halls, spas and pools,") +
        " planetariums, cinemas, big bookshops with a cafe, covered arcades. Real places only, each one open to walk-in visitors most days; never invent places. " +
        who() +
        " Do not repeat any of these: " +
        cur.spots
          .map(function (x) {
            return x.n;
          })
          .join("; ") +
        "." +
        '\nReply with JSON only: {"spots":[' +
        SPOT_EX +
        "]}\n" +
        spotRules() +
        ' Set s to "pm" or "any". Tag each with the interests it fits and add "indoor" to t.'
      );
    },
    ok: function (city, ck, country, cur) {
      return function (r) {
        addSpots(ck, r, "indoor");
      };
    }
  };
})();
