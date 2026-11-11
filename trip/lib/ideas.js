/* Waypoint ideas: what Claude is asked about a place (things to do, places to eat, a country's towns), how the
   answers are kept, and how many of them are on show for the length of the stay. Split from lib/core.js. */
(function () {
  "use strict";
  var W = window.W, run = W.run, changed = W.changed;
  var TAGS = W.TAGS = STYLES.map(function (s) { return s[0]; });
  /* every answer goes through W.V (validate.js): names, pins near the city, tags, ratings, links */
  var V = W.V, num = V.num;
  /** an empty city, before its lists arrive @returns {Pool} */
  function newPool() { return { spots: [], food: [], lat: null, lng: null }; }
  /* the city a list is for: its pin checks every pin in the answer */
  function centerOf(ck) { var c = W.C.city[ck], p = ck.split("|"), b = W.findCity(p[0], p[1]); return c && c.lat != null ? c : b && b.lat != null ? b : null; }
  function who() {
    return "Travelers' interests: " + (W.S.styles.map(function (s) { return W.STYLE_NAME[s]; }).join(", ") || "anything") +
      ". Travelers' ages: " + (W.ages().join(", ") || "adults") + ".";
  }
  W.who = who; W.newPool = newPool; W.centerOf = centerOf;   /* (lib/stays.js and lib/asks.js ask about a city too) */

  /* what kind of sights the trip is after, over and above its interests: the famous must-sees (the default), hidden gems
     where locals go, or the best of both */
  W.FOCUS = { icons: "Must-sees", both: "Best of both", gems: "Hidden gems" };
  W.focus = function () { return W.FOCUS[W.S.focus] ? W.S.focus : "icons"; };
  /* how a list request leans, in words */
  function focusAsk() {
    var f = W.focus();
    return f === "gems" ? " These travelers want to see the place like a local: favor hidden gems, neighborhood favorites and lesser-known places that delight, over the famous crowd-pullers."
      : f === "both" ? " These travelers want the famous highlights plus some lesser-known gems that delight: mix both."
      : " These travelers want the must-sees: favor the famous, essential places a first-time visitor should not miss.";
  }
  W.focusAsk = focusAsk;
  /* every suggestion is rated: how essential it is and how well visitors review it */
  var FAMERULE = " fame = 2 for the essential must-sees most visitors come for (a city's top handful), 1 for popular, well-known places, 0 for hidden gems and local favorites most visitors miss. rating = its typical visitor review score out of 5 on Google or Tripadvisor, one decimal (0 if you do not know). Only suggest places that are consistently well reviewed (about 4.3 or more); never a tourist trap.";
  /* booking links: only the place's own site. Never a search page, a reseller, or a look-alike "tickets" site that adds fees */
  var RESELLERS = /(^|\.)(google|bing|duckduckgo|yahoo|getyourguide|viator|tiqets|klook|headout|musement|civitatis|tripadvisor|expedia|booking|hotels|isango|ceetiz|tourradar|golden-?tours|city-?sightseeing|veltra|kkday|trip|agoda|groupon|tickets?(?:\.com|\.net|\.org)|stubhub|viagogo|seatgeek|vivid ?seats|ticketnetwork|ticketsales|tickettoride)\./i;
  W.bookUrl = function (u0) {
    var u = String(u0 || "").trim();
    if (!/^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u)) return "";
    var host = "";
    try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { return ""; }
    var parts = host.split("."), reg = parts.slice(-2).join(".");
    if (/^(co|com|org|gov|ac|net)\.[a-z]{2}$/.test(reg) && parts.length > 2) reg = parts.slice(-3).join(".");
    if (RESELLERS.test("." + reg + ".")) return "";          /* judged on the site itself, so booking.museum.it style official subdomains pass */
    /* third-party sites that mimic official ones: colosseumtickets.com, rome-skip-the-line.com, sagradafamiliatours.net … */
    if (/(tickets?|tours?|skip-?the-?line|fast-?track|guided)/i.test(reg.split(".")[0])) return "";
    return u.replace(/^http:/i, "https:");
  };
  /* a place the planner must never use: closed for good, or one the check could not find at all (a made-up name), or a duplicate */
  W.gone = function (it) { return !!it && (it.st === "closed" || it.st === "unfound" || it.st === "dup"); };
  W.isPaid = function (it) { return !!it.ticket && !/^\s*free/i.test(it.ticket); };
  W.needsBooking = function (it) { return /book|reserv|advance|timed|pre-?book|sell out|slot/i.test(it.ticket || "") || it.reserve === true; };

  /* recommended time to spend somewhere: "2-3 hours", "90 min", "1h30", "half day" -> "2–3 h", "1½ h", "Half day" */
  var U = "(hours?|hrs?|h|minutes?|mins?|m)";
  function unit(u) { return u && u.charAt(0) === "m" ? 1 : 60; }
  function hrs(m) { var h = Math.round(m / 30) / 2; return h % 1 ? (Math.floor(h) || "") + "½" : String(h); }
  function mins(m) { return Math.max(5, Math.round(m / 5) * 5); }
  function fmtDur(lo, hi) {
    if (!(lo > 0)) return "";
    if (hi != null && !(hi > lo)) hi = null;
    if (lo >= 420) return "Full day";
    if (hi == null) return lo < 60 ? mins(lo) + " min" : hrs(lo) + " h";
    if (hi <= 60) return mins(lo) + "–" + mins(hi) + " min";
    if (lo < 60) return mins(lo) + " min–" + hrs(hi) + " h";
    return hrs(lo) === hrs(hi) ? hrs(lo) + " h" : hrs(lo) + "–" + hrs(hi) + " h";
  }
  W.durText = function (raw) {
    var s = String(raw || "").toLowerCase().trim(); if (!s) return "";
    if (/full|all[ -]?day|whole day|entire day/.test(s)) return "Full day";
    if (/half[ -]?day|half a day/.test(s)) return "Half day";
    s = s.replace(/½/g, ".5").replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(\d+)\s*h(?:ours?|rs?)?\s*(\d{1,2})\s*(?:m(?:in(?:ute)?s?)?)?(?![\d.])/g, function (a, h, m) { return (+h + m / 60) + "h"; });
    var m = s.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + U + "?\\s*(?:-|–|—|to)\\s*(\\d+(?:\\.\\d+)?)\\s*" + U + "?"));
    if (m) return fmtDur(+m[1] * unit(m[2] || m[4]), +m[3] * unit(m[4] || m[2]));
    m = s.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + U + "?"));
    if (m) return fmtDur(+m[1] * (m[2] ? unit(m[2]) : +m[1] > 12 ? 1 : 60), null);
    return "";
  };
  /* time to plan for a stop: the place's own estimate, else a typical length for the meal */
  var MEAL_DUR = { breakfast: "30–45 min", lunch: "1–1½ h", dinner: "1½–2 h" };
  W.stayText = function (it, food, slot) {
    var t = W.durText(it.dur);
    if (food && /day$/.test(t)) t = "";   /* a meal is never a half day */
    if (!t && food) t = MEAL_DUR[slot] || MEAL_DUR[it.meal] || MEAL_DUR.lunch;
    if (!t && it.s === "any") t = "Full day";
    return t;
  };
  var MENURULE = "menu = the place's own website page that shows its menu (or its homepage if the menu is there), only if you are confident of the exact address; otherwise an empty string.";
  var BOOKRULE = "book = for any place that charges admission or needs booking: the page on the place's OWN official website (or its official government/foundation ticket office) where visitors buy tickets. Never a reseller, tour operator or look-alike ticket site (no GetYourGuide, Viator, Tiqets, Klook, Headout, Musement, 'colosseumtickets.com' style sites). If you are not confident of the exact official address, an empty string.";
  var TAGRULE = " Tags (t) only from: " + TAGS.join(",") + ". k: 1 = great for small kids, 0 = fine, -1 = better for older kids and adults.";

  /* every destination in a country: cities, towns and areas (the Amalfi Coast, the Algarve). An island is never an entry; its towns are, each naming the island
     (isl). A list cached before islands were handled this way (no v) is asked again once; the old one stays in use
     until the new one comes, and for good if it doesn't */
  W.COUNTRY_V = 2;
  W.loadCountry = function (name) {
    var key = "country|" + name, had = W.C.country[name];
    if ((had && had.v >= W.COUNTRY_V) || W.status[key]) return;
    if (had && had.part) had = undefined;   /* a list cut short last time (the app was closed while it came): asked whole */
    run(key, "List the cities, towns and areas that travelers visit in " + name +
      ", the best known first. Be thorough: 80 to 120 places covering every region, from major cities to small towns. Only real places.\n" +
      "An island or a group of islands is never an entry. For an island, list its towns instead " +
      "(not \"Crete\" but Heraklion, Chania, Rethymno; for a small island its main town or port by its usual name, like \"Hydra Town\" or \"Naxos Town\"), each with the island's name in isl. " +
      "isl is \"\" for a place on the mainland or on the country's main island.\n" +
      "Reply with JSON only: {\"blurb\":\"one sentence about traveling in " + name + "\",\"cities\":[{\"name\":\"\",\"region\":\"\",\"isl\":\"\",\"lat\":0,\"lng\":0,\"w\":2,\"pop\":3,\"t\":[\"tag\"],\"d\":\"what it is known for, max 12 words\"}]}\n" +
      "w = suggested days (1-4). pop = how popular with visitors, 1-5." + TAGRULE.split(" k:")[0],
      "quick", function (r) {
        var list = W.townsOnly(V.list(r && r.cities, V.city));
        /* the places the plan started on (below) stay first, as they were */
        var cur = W.C.country[name], top = cur && cur.part ? cur.cities : null;
        if (top) { var tk = {}; top.forEach(function (c) { tk[W.norm(c.name)] = 1; }); list = top.concat(list.filter(function (c) { return !tk[W.norm(c.name)]; })); }
        /* keep even an empty answer so the page never asks again in a loop */
        W.C.country[name] = { blurb: String(r && r.blurb || "") || (had && had.blurb) || "", cities: had && had.cities.length ? W.islesInto(had.cities, list) : list, v: W.COUNTRY_V };
      },
      /* A country with no list yet: the plan starts as soon as the first eight places are written (the best known),
         instead of waiting for all 80 to 120. They are marked (top) and the planner chooses among them first, so the
         stops it picked do not change when the rest of the list arrives. */
      { list: "cities", min: 8, take: function (items) {
        if ((had && had.cities.length) || W.C.country[name]) return;
        var first = W.townsOnly(V.list(items, V.city)).slice(0, 8); if (first.length < 5) return;
        first.forEach(function (c) { c.top = 1; });
        W.C.country[name] = { blurb: "", cities: first, part: 1 };
      } });
  };
  /** an answer that still names an island as a place (its name is its own isl) loses it when the island's towns are
      there too; alone, it is that island's one town and stays @param {BuiltCity[]} list */
  W.townsOnly = function (list) {
    return list.filter(function (c) {
      if (!c.isl || W.norm(c.isl) !== W.norm(c.name)) return true;
      return !list.some(function (o) { return o !== c && o.isl && W.norm(o.isl) === W.norm(c.isl); });
    });
  };
  /** A list from before, brought up to date with a new answer without the places you already see shifting: every
      town it had stays as it was (so a suggested trip keeps its stops), each island it named gives way to that
      island's towns, and a town now known to be on an island says so. Nothing else is added.
      @param {BuiltCity[]} old @param {BuiltCity[]} fresh */
  W.islesInto = function (old, fresh) {
    var isl = Object.create(null), by = Object.create(null), seen = Object.create(null), out = [];
    fresh.forEach(function (c) { by[W.norm(c.name)] = c; if (c.isl && W.norm(c.isl) !== W.norm(c.name)) isl[W.norm(c.isl)] = 1; });
    old.forEach(function (c) {
      var k = W.norm(c.name), f = by[k]; if (isl[k] || seen[k]) return;
      seen[k] = 1; out.push(f && f.isl && !c.isl ? Object.assign({}, c, { isl: f.isl }) : c);
    });
    fresh.forEach(function (c) { var k = W.norm(c.name); if (c.isl && !seen[k]) { seen[k] = 1; out.push(c); } });
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
  W.firstIdeas = function (stayDays) { return Math.max(W.FIRST_IDEAS, Math.min(30, 4 * (Math.round(+stayDays) || 0) + 3)); };
  /* the days this trip spends in a place, as the plan stands (0 for a day trip or a place not in the trip) */
  W.stayDays = function (country, city) {
    var n = 0; ((W.P && W.P.stops) || []).forEach(function (s) { if (s.country === country && s.name === city) n += s.days || 0; });
    return n;
  };
  function setAside(pool, list) { return (pool && pool.rest && pool.rest[list]) || []; }
  W.ideasFull = function (pool) {
    return !!pool && !setAside(pool, "spots").length && !setAside(pool, "food").length && (pool.spots || []).length >= W.IDEA_CAP.spots && (pool.food || []).length >= W.IDEA_CAP.food;
  };
  /** the first question about a place: its n best things to do, most important first, without booking links
      (lib/speedtest.js asks the same) @param {string} country @param {string} city @param {number} n */
  W.spotsAsk = function (country, city, n) {
    var lean = W.S.styles.length ? " Lean toward the travelers' interests (" + W.S.styles.map(function (x) { return W.STYLE_NAME[x]; }).join(", ") + "): at least half should suit them, alongside the must-see sights." : "";
    var focusSpots = W.focus() === "gems" ? " Lean toward places locals love and most visitors miss, each still well reviewed, alongside the few unmissable sights."
      : W.focus() === "icons" ? " Lean toward the most popular, best-reviewed places."
      : " Mostly the headline places most visitors come for, plus a few well-loved local favorites.";
    return "List the " + n + " best things to do in and around " + city + ", " + country + ", most important first." + focusSpots + lean +
      " Include at least 3 evening options (sunset spots, evening strolls, shows), at least 2 indoor options for a rainy or too-hot afternoon, and a day trip if there is a classic one." +
      " If it is a large region or island, give options in each main area so a day can stay in one area. Do not include trains, transfers or transport as activities. " + who() +
      "\nReply with JSON only: {\"d\":\"what " + city + " is known for, one sentence\",\"lat\":0,\"lng\":0,\"spots\":[" + SPOT_EX.replace("\"book\":\"\",", "") + "]}\n" + spotRules().replace(BOOKRULE + " ", "");
  };
  W.loadCity = function (country, city, more, stayDays, nMore) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!more && cur && cur.spots && cur.spots.length) return;
    /* never ask about the same city over and over if answers keep coming back empty */
    /* count real attempts only: a redraw while this city's lists are on their way isn't another try */
    if (!more && W.cityBusy(ck)) return;
    var tk = ck + (more ? "|more" : ""); tries[tk] = (tries[tk] || 0) + 1;
    if (!more && tries[tk] > 3) return;
    var ex = cur && cur.spots ? cur.spots.concat(setAside(cur, "spots")).map(function (x) { return x.n; }) : [];
    var exF = cur && cur.food ? cur.food.concat(setAside(cur, "food")).map(function (x) { return x.n; }) : [];
    var where = city + ", " + country, st = W.S.stays[ck];
    /* when you've set your lodging, extra ideas come from around it */
    var nearStay = more && st && st.label ? " Focus on places within an easy trip of " + st.label + "." : "";
    var lean = W.S.styles.length ? " Lean toward the travelers' interests (" + W.S.styles.map(function (x) { return W.STYLE_NAME[x]; }).join(", ") + "): at least half should suit them, alongside the must-see sights." : "";
    var EVE = " If it is a large region or island, give options in each main area so a day can stay in one area. Do not include trains, transfers or transport as activities. ";
    var TRANSIT = "\"transit\":{\"system\":\"how public transit works and what a ticket costs, one sentence\",\"pass\":\"best pass or card for visitors\",\"airport\":\"how to get from the main airport or station to the center\",\"tip\":\"one practical tip\"},\"stay\":[{\"n\":\"neighborhood\",\"d\":\"why stay here, short\",\"lat\":0,\"lng\":0}],";
    /* first = the first list: no booking or menu links (they come later, for the places a day uses) */
    function foodAsk(what, extra, first) {
      var ex = foodEx(), rules = foodRules();
      if (first) { ex = ex.replace("\"book\":\"\",\"menu\":\"\",", ""); rules = rules.replace(MENURULE + " ", "").replace("; then book = its official website or reservation page if you are confident of the address, else an empty string", ""); }
      return what + " " + who() + W.eatAsk() + (exF.length ? " Do not repeat: " + exF.join("; ") + "." : "") +
        "\nReply with JSON only: {" + (extra || "") + "\"food\":[" + ex + "]}\n" + rules + (extra ? " Give 4 stay neighborhoods." : "");
    }
    if (more) {
      /* a few more at a time, up to the city's cap: the last ideas of a long list are the likeliest to be made up, and
         every one of them waits for a nightly check and a photo */
      var have = W.pool(country, city), nS = have ? (have.spots || []).length : 0, nF = have ? (have.food || []).length : 0;
      var askS = Math.min(nMore || 10, W.IDEA_CAP.spots - nS - setAside(cur, "spots").length), askF = Math.min(nMore || 8, W.IDEA_CAP.food - nF - setAside(cur, "food").length);
      /* "Find more" (you asked): ten more things to do and eight more places to eat go on show. A city that holds more
         than it shows (ideas set aside by W.fitIdeas) brings those out at once; Claude is asked only for what is still missing */
      if (nMore == null && cur && !cur.fallback) {
        var stay = W.stayDays(country, city), sh = cur.showN || (cur.showN = {});
        sh.spots = Math.max(W.ideaLimit(cur, "spots", stay), nS) + 10; sh.food = Math.max(W.ideaLimit(cur, "food", stay), nF) + 8;
        if (W.fitIdeas(country, city, stay, true)) changed();
        askS = Math.min(sh.spots, W.IDEA_CAP.spots) - cur.spots.length; askF = Math.min(sh.food, W.IDEA_CAP.food) - (cur.food || []).length;
      }
      if (askS > 0)
        run("spots|" + ck, "List " + askS + " MORE things to do in and around " + where + ". Mix famous sights, local favorites, parks, markets, neighborhoods, experiences and a day trip." + lean + focusAsk() +
          " Include at least " + Math.max(1, Math.min(3, Math.round(askS / 4))) + " evening options (sunset spots, evening strolls, shows, night markets)." + EVE + nearStay + " " + who() +
          (ex.length ? " Do not repeat any of these: " + ex.join("; ") + "." : "") + "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules(),
          "default", function (r) { addSpots(ck, r, "more"); });
      if (askF > 0)
        run("food|" + ck, foodAsk("List " + askF + " MORE places to eat in " + where + ": breakfast cafés and bakeries, local classics, casual spots and markets, spread across the city or region." + focusAsk() + nearStay), "default", function (r) { addFood(ck, r, "more"); });
      return;
    }
    /* the first lists: 15 things to do and 15 places to eat (more for a long stay: W.firstIdeas), one question each. More only when someone asks for them
       ("Find more"): long lists take minutes to write, and their last ideas are the likeliest to be made up */
    /* A long stay's quota (18 or more of each) is asked for in two goes: 12 first, so the days fill sooner, and the rest
       in the background (W.growIdeas, after these arrive). The first lists leave the booking and menu links out; the
       links come with the check of the places a day uses (W.loadBookLinks). Both lists are taken in as they are
       written (stream): the days fill a few places at a time, and are planned afresh once the whole list is in. */
    var nFirst = W.firstIdeas(stayDays != null ? stayDays : W.stayDays(country, city)), n0 = nFirst >= 18 ? 12 : nFirst;
    var streamed = { spots: false, food: false };
    /* planned afresh once, when both lists are whole (what was picked while they came was picked from a few) */
    function settle() { if ((streamed.spots || streamed.food) && !W.cityBusy(ck) && W.freshPicks) W.freshPicks(country, city); }
    run("spots|" + ck, W.spotsAsk(country, city, n0), "default", function (r) { addSpots(ck, r, "head"); asked(ck, n0); settle(); },
      { list: "spots", take: function (items, head) { streamed.spots = true; addSpots(ck, { d: head.d, lat: head.lat, lng: head.lng, spots: items }, "head"); } });
    run("food|" + ck, foodAsk("List " + n0 + " places to eat in " + where + ": the best-loved local classics, casual and family-friendly spots, a couple of special dinners, and at least " + Math.max(4, Math.round(n0 / 4)) + " breakfast cafés or bakeries, spread across the city or region." + (W.focus() === "gems" ? " Favor the places locals go." : ""), TRANSIT, true),
      "default", function (r) {
        var c0 = W.C.city[ck] || newPool();
        var tr = r && V.transit(r.transit); if (tr && !c0.transit) c0.transit = tr;
        if (r && Array.isArray(r.stay) && !c0.stay) c0.stay = V.list(r.stay, function (x) { return V.stayArea(x, centerOf(ck)); });
        W.C.city[ck] = c0; addFood(ck, r, "head"); asked(ck, n0); settle();
      },
      { list: "food", take: function (items) { streamed.food = true; addFood(ck, { food: items }, "head"); } });
  };
  /* how many of each this city has been asked for (kept with its ideas): a longer stay later asks only for the difference */
  function asked(ck, n) { var c = W.C.city[ck]; if (c) c.askedN = Math.max(c.askedN || 0, n); }
  /* the stay got longer (you changed the days): the ideas grow with it, by the difference, once */
  W.growIdeas = function (country, city, stayDays) {
    var ck = W.cityKey(country, city), c = W.C.city[ck]; if (!c || !c.spots || !c.spots.length || W.readOnly || W.cityBusy(ck)) return;
    var had = Math.max(c.askedN || W.FIRST_IDEAS, Math.min(c.spots.length, (c.food || []).length)), want = W.firstIdeas(stayDays);
    if (want <= had) return;
    c.askedN = want;
    ["spots|", "food|"].forEach(function (p) { if (W.status[p + ck] !== "loading") delete W.status[p + ck]; });
    W.loadCity(country, city, true, stayDays, want - had);
  };
  /* ---------- no more ideas on show than the stay calls for ----------
     A city shows 15 things to do and 15 places to eat (more for a longer stay: W.firstIdeas), plus what you asked for
     ("Find more", a search, hidden gems: pool.showN). A city that holds more than that (lists from before the limit,
     places from another of your devices, the nightly restaurants) keeps the extra set aside in pool.rest: not shown,
     not planned with, and brought out first, at once, when you ask for more or stay longer. Never set aside: a place
     on one of this trip's days, and a place you added yourself. Among the places to eat, breakfast keeps its share,
     and among the things to do, the evening. Run after every planning (lib/plan.js), so it also tidies what arrives
     later; returns whether anything moved. Also never set aside: the replacement for a place that has closed */
  W.ideaLimit = function (c, list, stayDays) { return Math.max(W.firstIdeas(stayDays), (c && c.showN && c.showN[list]) || 0); };
  var fitTold = false, fitRuns = {};
  W.fitIdeas = function (country, city, stayDays, quiet) {
    var c = /** @type {any} */ (W.C.city[W.cityKey(country, city)]);   /* (both lists are handled the same way) */
    if (!c || c.fallback || W.readOnly || !c.spots || !c.spots.length) return false;
    var kept = {}, picks = W.S.picks || {}; Object.keys(picks).forEach(function (k) { if (picks[k]) kept[W.norm(picks[k])] = 1; });
    /* (rp: the replacement the nightly check gave for a place that has closed. lib/places.js adds it whenever it is not
       on the list, so setting it aside would have the two take turns for ever) */
    var isKept = function (x) { return !!(x.imp || x.rp || kept[W.norm(x.n)]); };
    var moved = false, rest = c.rest && typeof c.rest === "object" ? c.rest : { spots: [], food: [] };
    /** @type {Array<"spots" | "food">} */ (["spots", "food"]).forEach(function (L) {
      var n = W.ideaLimit(c, L, stayDays), list = c[L] || [], r = Array.isArray(rest[L]) ? rest[L] : [], on = {};
      list.forEach(function (x) { on[W.norm(x.n)] = 1; });
      var r2 = r.filter(function (x) { return x && x.n && !on[W.norm(x.n)]; }); if (r2.length !== r.length) { r = r2; moved = true; }
      if (list.length > n) {
        /* a kind every day needs keeps its share: breakfast among the places to eat, the evening among the things to do */
        var need = L === "food" ? function (x) { return x.meal === "breakfast" || x.meal === "all"; } : function (x) { return x.s === "eve"; };
        var quota = L === "food" ? Math.max(4, Math.round(n / 4)) : 3, room = n, take = [];
        list.forEach(function (x, i) { if (isKept(x)) { take[i] = 1; room--; if (need(x)) quota--; } });
        list.forEach(function (x, i) { if (!take[i] && room > 0 && quota > 0 && need(x)) { take[i] = 1; room--; quota--; } });
        list.forEach(function (x, i) { if (!take[i] && room > 0) { take[i] = 1; room--; } });
        var out = list.filter(function (x, i) { return !take[i]; });
        if (out.length) { c[L] = list.filter(function (x, i) { return take[i]; }); r = out.concat(r); moved = true; }
      } else if (list.length < n && r.length) {
        var up = r.slice(0, n - list.length); c[L] = list.concat(up); r = r.slice(up.length); moved = true;
      }
      rest[L] = r;
    });
    if (moved || c.rest) c.rest = rest;
    /* the lists changed under a plan that was being made: save them and draw again, once, when it is done. A city's
       lists settle in a pass or two; if something keeps putting back what this sets aside, stop redrawing for it
       (at most six times a minute for one city) rather than redraw without end */
    if (moved && !quiet) {
      var ck = W.cityKey(country, city), now = Date.now(), run = fitRuns[ck] || (fitRuns[ck] = { at: now, n: 0 });
      if (now - run.at > 60000) { run.at = now; run.n = 0; }
      run.n++;
      if (run.n <= 6 && !fitTold) { fitTold = true; setTimeout(function () { fitTold = false; changed(); }, 0); }
    }
    return moved;
  };
  /* a place one of your trips has on a day, found among the ideas set aside: back on show */
  W.fromRest = function (pool, name, food) {
    var L = food ? "food" : "spots", r = setAside(pool, L), k = W.norm(name);
    for (var i = 0; i < r.length; i++) if (W.norm(r[i].n) === k) { var it = r.splice(i, 1)[0]; (pool[L] || (pool[L] = [])).push(it); return it; }
    return null;
  };
  /* is anything still coming in for this city's first lists? */
  W.cityBusy = function (ck) { return ["spots|", "food|"].some(function (p) { return W.status[p + ck] === "loading"; }); };

  var FOOD_EX = "{\"n\":\"name\",\"d\":\"what it is known for or what to order, one short sentence\",\"fame\":1,\"rating\":4.5,\"cuisine\":\"\",\"price\":\"€€\",\"meal\":\"both\",\"dur\":\"1h\",\"fav\":false,\"k\":0,\"reserve\":false,\"book\":\"\",\"menu\":\"\",\"pic\":\"taverna\",\"lat\":0,\"lng\":0}";
  function foodRules() {
    return "pic = the picture that fits best, one of: " + W.FOOD_PICS.join(", ") + ". " + MENURULE + " reserve = true if booking a table ahead is recommended; then book = its official website or reservation page if you are confident of the address, else an empty string. meal = breakfast, lunch, dinner, both (lunch and dinner) or all (all three). dur = the recommended time to allow for a meal there, e.g. '30m' for a bakery, '1-1.5h' for a sit-down lunch, '2h' for a long dinner. fav = true for places food lovers seek out (a famous classic, a top market, a destination restaurant). Use real places and accurate coordinates." + TAGRULE.split(" Tags")[0] + " k: 1 = very family friendly, 0 = fine, -1 = adults-oriented." + FAMERULE.replace("must-sees most visitors come for (a city's top handful)", "famous institutions visitors seek out").replace("hidden gems and local favorites most visitors miss", "neighborhood places locals love");
  }
  /* add places to eat; front = the best-loved half, which stays at the top of the list whichever half arrives first */
  function foodEx() { return W.eatSig() ? FOOD_EX.replace(/\}$/, ",\"fit\":\"good\",\"fitw\":\"\"}") : FOOD_EX; }
  function addFood(ck, r, kind) {
    var c0 = W.C.city[ck] || newPool(), ctr = centerOf(ck);
    var add = V.list(r && r.food, function (x) { return V.food(x, ctr); });
    W.eatMark(add);
    c0.food = merge(c0.food || [], add, kind); W.C.city[ck] = c0;
  }
  /* A city's list is in a fixed order, whichever answer comes in first: the planner gives a list's first places a boost,
     so an order that followed the answers' arrival would plan the same data differently from one time to the next. Each
     batch has its kind's rank (RANK) and goes after everything of its rank or lower that came in this session (what was
     kept from before stays first); the headline half also takes the place of a repeat already listed. */
  var RANK = { head: 0, b: 1, more: 2, indoor: 5, eatmore: 3 };
  var rankOf = typeof WeakMap === "function" ? new WeakMap() : null;
  function merge(list, add, kind) {
    var r = RANK[kind] || 0, rk = function (x) { var v = rankOf && rankOf.get(x); return v == null ? -1 : v; };
    if (rankOf) add.forEach(function (x) { rankOf.set(x, r); });
    if (kind === "head") { var mine = {}; add.forEach(function (x) { mine[W.norm(x.n)] = 1; }); list = list.filter(function (x) { return !mine[W.norm(x.n)]; }); }
    else { var have = {}; list.forEach(function (x) { have[W.norm(x.n)] = 1; }); add = add.filter(function (x) { return !have[W.norm(x.n)]; }); }
    var at = list.length; for (var i = 0; i < list.length; i++) if (rk(list[i]) > r) { at = i; break; }
    return list.slice(0, at).concat(add, list.slice(at));
  }

  /* the shape of one thing to do, shared by every request for them */
  var SPOT_EX = "{\"n\":\"name\",\"d\":\"what it is or what it is known for, one short sentence\",\"t\":[\"tag\"],\"fame\":1,\"rating\":4.6,\"k\":0,\"s\":\"am\",\"dur\":\"2h\",\"ticket\":\"Free\",\"book\":\"\",\"pic\":\"oldtown\",\"place\":\"the real place\",\"lat\":0,\"lng\":0}";
  function spotRules() {
    return "place = the exact name of the real place, as on its sign or on a map (for an outing such as a stroll, a tasting or a cruise, the real place where it happens, e.g. 'Piazza Duomo' or 'Marina Grande'); never an invented or descriptive name. n may be descriptive, place may not. pic = the picture that fits best, one of: " + W.SPOT_PICS.join(", ") + ". s = best time: am, pm, eve, or any (a full-day outing). dur = the recommended time to spend there for these travelers (allow for children's ages), e.g. '45m', '1-2h', 'half day' or 'full day'. ticket = 'Free', or price and whether to book ahead, e.g. '€18, book ahead'. " + BOOKRULE + " Use accurate coordinates." + TAGRULE + FAMERULE;
  }
  /* extras you asked for by name (hidden gems, rainy-day ideas, ideas for your style) come on top of what is on show */
  function bumpShown(ck, c0, list, added) {
    if (added <= 0) return;
    var p = ck.split("|"), sh = c0.showN || (c0.showN = {});
    sh[list] = Math.min(c0[list].length, W.ideaLimit(c0, list, W.stayDays(p[0], p[1]))) + added;
  }
  function addSpots(ck, r, kind) {
    var c0 = W.C.city[ck] || newPool();
    if (r && r.d && !c0.d) c0.d = V.str(r.d, 240);
    /* the city's own pin: only when it agrees with the built-in one (when there is one) */
    var cp = r && V.pinNear(r.lat, r.lng, centerOf(ck), 120); if (cp && c0.lat == null) { c0.lat = cp.lat; c0.lng = cp.lng; }
    var ctr = centerOf(ck), add = V.list(r && r.spots, function (x) { return V.spot(x, ctr); });
    /* the headline half always leads the list (the planner gives the first few a boost), whichever half arrives first */
    var before = (c0.spots || []).length;
    c0.spots = merge(c0.spots || [], add, kind); W.C.city[ck] = c0;
    if (kind !== "head" && kind !== "more") bumpShown(ck, c0, "spots", c0.spots.length - before);
    return c0;
  }

  /* lists asked before every place was rated: how essential each one is and how well it is reviewed (once per city) */
  W.loadFame = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!cur || cur.fameAsked || W.cityBusy(ck)) return;
    var todo = /** @type {(Spot | Food)[]} */ (cur.spots || []).concat(cur.food || []).filter(function (x) { return x && x.n && x.fame === undefined; });
    if (todo.length < 4) return;
    cur.fameAsked = 1;
    run("fame|" + ck, "Rate how essential each of these places in and around " + city + ", " + country + " is for a visitor, and how well visitors review it.\n" +
      todo.slice(0, 90).map(function (x) { return x.n; }).join("\n") +
      "\nReply with JSON only: {\"r\":[[\"name exactly as given\",2,4.6]]}\nThe second value is fame: 2 = an essential must-see most visitors come for (or a famous food institution), 1 = popular and well known, 0 = a hidden gem or local favorite most visitors miss. The third is its typical review score out of 5 on Google or Tripadvisor, one decimal, 0 if you do not know.",
      "quick", function (r) {
        var by = {}; (r && r.r || []).forEach(function (x) { if (Array.isArray(x) && x[0]) by[W.norm(x[0])] = x; });
        todo.forEach(function (it) { var x = by[W.norm(it.n)]; if (!x) return; var f = V.fame(x[1]); if (f !== undefined) it.fame = f; var g = V.rating(x[2]); if (g !== undefined) it.rating = g; });
      });
  };

  /* rainy-day backups: indoor places for when the day has to change (asked once per city) */
  W.loadIndoor = function (country, city) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck];
    if (!cur || !cur.spots || cur.indoorAsked || W.cityBusy(ck)) return;
    cur.indoorAsked = 1;
    run("indoor|" + ck, "List 10 indoor things to do in " + city + ", " + country + " for a rainy or too-hot afternoon: aquariums, science and children's museums, covered markets, indoor play centres, swimming pools, planetariums, cinemas, big bookshops with a cafe, covered arcades. Real places only, each one open to walk-in visitors most days; never invent places. " + who() +
      " Do not repeat any of these: " + cur.spots.map(function (x) { return x.n; }).join("; ") + "." +
      "\nReply with JSON only: {\"spots\":[" + SPOT_EX + "]}\n" + spotRules() + " Set s to \"pm\" or \"any\". Tag each with the interests it fits and add \"indoor\" to t.",
      "default", function (r) { addSpots(ck, r, "indoor"); });
  };
})();
