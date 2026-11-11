/* Waypoint stays: how long to stay in a place for this group, and where to stay (a budget, a mid-range and a splurge
   pick). Split from lib/core.js. */
(function () {
  "use strict";
  var W = window.W, V = W.V, run = W.run, who = W.who, centerOf = W.centerOf, newPool = W.newPool;
  /* ---------- how long to stay: enough to see the sights vs a relaxed pace, for this group ---------- */
  function rangeSig() { var p = W.party(); return p.toddler ? "t" : p.kids.length ? "k" : "a"; }
  W.stayRange = function (country, city) { var r = W.C.range[W.cityKey(country, city)]; return r && r.sig === rangeSig() && r.s ? r : null; };
  W.loadStayRanges = function (stops) {
    var sig = rangeSig(), need = stops.filter(function (x) { var r = W.C.range[W.cityKey(x.country, x.name)]; return !r || r.sig !== sig; });
    if (!need.length) return;
    var names = need.map(function (x) { return x.name + ", " + x.country; });
    run("range|" + sig + "|" + names.join(";"), "How many days should this group spend in each of these places? " + who() +
      " sights = full days to see the main sights and highlights at a steady pace. relaxed = full days for a slow, relaxing visit with downtime, long meals and nothing rushed. Don't count travel days. Places: " + names.join("; ") +
      "\nReply with JSON only: {\"stays\":[{\"n\":\"place, country exactly as given\",\"sights\":3,\"relaxed\":5}]}",
      "quick", function (r) {
        var map = {}; (r && r.stays || []).forEach(function (x) { if (x && x.n) { map[W.norm(x.n)] = x; map[W.norm(String(x.n).split(",")[0])] = map[W.norm(String(x.n).split(",")[0])] || x; } });
        need.forEach(function (x) {
          var rg = V.range(map[W.norm(x.name + ", " + x.country)] || map[W.norm(x.name)]);
          /* asked either way, so a place Claude skipped isn't asked about again and again */
          W.C.range[W.cityKey(x.country, x.name)] = rg ? { s: rg.s, r: rg.r, sig: sig } : { sig: sig };
        });
      });
  };

  /* ---------- where to stay: a budget, a mid-range and a splurge pick per city ---------- */
  W.TIERS = ["budget", "mid", "luxury"];
  W.TIER_NAME = { budget: "Budget", mid: "Mid-range", luxury: "Splurge" };
  var TIER_DESC = { budget: "budget (simple hotels, guesthouses, hostels with private family rooms, or good-value apartments)",
    mid: "mid-range (comfortable 3–4 star hotels or well-run apartments)", luxury: "luxury (the best 5-star or boutique hotels)" };
  function lodgeSig() { var p = W.party(); return p.adults + "a" + p.kids.length + "k"; }
  W.lodgeSig = lodgeSig;
  function groupText() {
    var p = W.party(), n = W.ages().length || 2;
    return "The group is " + n + " people: " + (p.adults || n) + " adult" + ((p.adults || n) === 1 ? "" : "s") +
      (p.kids.length ? " and " + p.kids.length + " child" + (p.kids.length === 1 ? "" : "ren") + " (ages " + p.kids.join(", ") + "). Every pick must suit a family: family rooms, connecting rooms or an apartment that sleeps " + n + "." : ". Rooms that fit the whole group.");
  }
  W.loadLodging = function (country, city, tier) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck], sig = lodgeSig();
    var have = cur && cur.lodgeFor === sig ? cur.lodging || [] : [];
    var near = W.S.stays[ck] && W.S.stays[ck].label && !have.some(function (x) { return x.n === W.S.stays[ck].label; }) ? " Prefer the area around " + W.S.stays[ck].label + " if it suits." : "";
    run("lodge|" + ck + "|" + sig + (tier ? "|" + tier + "|" + have.length : ""),
      (tier ? "Suggest 4 MORE " + TIER_DESC[tier] + " places to stay" : "Suggest places to stay") + " in " + city + ", " + country + ". " + groupText() +
      (tier ? "" : " Give 4 in each price tier: " + W.TIERS.map(function (t) { return TIER_DESC[t]; }).join("; ") + ".") +
      " Real, currently operating places with good reviews, in safe, convenient areas for visitors (central, or close to the main sights and good transit)." + near +
      (have.length ? " Do not repeat: " + have.map(function (x) { return x.n; }).join("; ") + "." : "") +
      "\nReply with JSON only: {\"lodging\":[{\"n\":\"name\",\"tier\":\"" + (tier || "budget") + "\",\"type\":\"hotel\",\"area\":\"neighborhood\",\"d\":\"why it's a good pick for this group, one short sentence\",\"price\":\"€90–120\",\"site\":\"\",\"lat\":0,\"lng\":0}]}\n" +
      "tier = budget, mid or luxury. type = hotel, apartment, guesthouse, hostel, resort or villa. price = the typical price per night for a room or unit that fits the group, in local currency. site = the place's own official website if you are confident of the exact address, else an empty string (never Booking.com, Expedia or another booking site). Use accurate coordinates.",
      "default", function (r) {
        var c0 = W.C.city[ck] || newPool();
        if (c0.lodgeFor !== sig) { c0.lodging = []; c0.lodgeFor = sig; }
        var seen = {}; c0.lodging.forEach(function (x) { seen[W.norm(x.n)] = 1; });
        V.list(r && r.lodging, function (x) { return V.lodging(x, centerOf(ck), W.TIERS, tier); }).forEach(function (x) { if (!seen[W.norm(x.n)]) { seen[W.norm(x.n)] = 1; c0.lodging.push(x); } });
        if (!tier) c0.lodgeAsked = 1;
        W.C.city[ck] = c0;
      });
  };
  /* the pick shown for a tier, and a reroll that cycles through that tier's options (fetching more before they run out) */
  W.lodgeList = function (country, city, tier) {
    var cur = W.C.city[W.cityKey(country, city)];
    return cur && cur.lodgeFor === lodgeSig() ? (cur.lodging || []).filter(function (x) { return x.tier === tier; }) : [];
  };
  W.lodgeShown = function (country, city, tier) {
    var k = W.cityKey(country, city) + "|" + tier, list = W.lodgeList(country, city, tier), S = W.S;
    S.lodge = S.lodge || {}; S.lodgeSeen = S.lodgeSeen || {};
    var nm = S.lodge[k], it = nm && list.filter(function (x) { return x.n === nm; })[0];
    if (it) return it;
    var seen = S.lodgeSeen[k] || [];
    return list.filter(function (x) { return seen.indexOf(W.norm(x.n)) < 0; })[0] || list[0] || null;
  };
  W.lodgeReroll = function (country, city, tier) {
    var k = W.cityKey(country, city) + "|" + tier, list = W.lodgeList(country, city, tier), S = W.S;
    var cur = W.lodgeShown(country, city, tier), seen = S.lodgeSeen[k] = S.lodgeSeen[k] || [];
    if (cur && seen.indexOf(W.norm(cur.n)) < 0) seen.push(W.norm(cur.n));
    var left = list.filter(function (x) { return seen.indexOf(W.norm(x.n)) < 0; });
    if (left.length < 2) W.loadLodging(country, city, tier);
    if (left.length) S.lodge[k] = left[0].n;
    else { S.lodgeSeen[k] = cur ? [W.norm(cur.n)] : []; var again = list.filter(function (x) { return !cur || x.n !== cur.n; })[0]; if (again) S.lodge[k] = again.n; }
  };
  /* every booking site's price for one place, side by side (Google Hotels), so you can see where it's cheapest */
  W.priceUrl = function (it, city) { return "https://www.google.com/travel/hotels?q=" + encodeURIComponent(it.n + " " + city); };

  /* Stops on the trip with no pin at all (a list saved before its pin was checked and then cleared, or a place added
     without one): Claude is asked once, for those names only, where each one is. A place the check took off the map
     on purpose (far out at sea) is not asked again; every answer must fall near the city like any other pin. */
  W.loadPins = function (country, city, names) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck]; if (!cur || !names || !names.length) return;
    var want = {}; names.forEach(function (n) { want[W.norm(n)] = 1; });
    var need = /** @type {(Spot | Food)[]} */ ([]).concat(cur.spots || [], cur.food || []).filter(function (x) {
      if (!x || !want[W.norm(x.n)] || x.lat != null || x.pinAsked) return false;
      var r = W.placeInfo ? W.placeInfo(x, country, city) : null;
      return !(r && (r.nopin || r.st === "closed" || r.st === "unfound" || r.st === "dup"));
    }).slice(0, 20);
    if (!need.length) return;
    var center = centerOf(ck);
    run("pins|" + ck + "|" + need.map(function (x) { return W.norm(x.n); }).join(";"), "Where exactly is each of these places in or near " + city + ", " + country + "? " +
      "Give the latitude and longitude of the place itself (its entrance, or the middle of a beach, square or market). If a name covers an area or a choice of places, give its most typical spot. " +
      "Use null for any you cannot place with confidence.\n" + need.map(function (x) { return x.n; }).join("; ") +
      "\nReply with JSON only: {\"pins\":[{\"n\":\"the name exactly as given\",\"lat\":0.0,\"lng\":0.0}]}", "quick", function (r) {
        var map = {}; (r && r.pins || []).forEach(function (q) { if (q && q.n) map[W.norm(q.n)] = q; });
        need.forEach(function (x) {
          var q = map[W.norm(x.n)] || {}, p = V.pinNear(q.lat, q.lng, center, 120);
          x.pinAsked = 1;
          if (p) { x.lat = p.lat; x.lng = p.lng; x.g = [p.lat, p.lng]; }
        });
      });
  };

  /* official booking and menu links, and recommended visit times, for ideas saved before those existed.
     first = names to fill first (today's stops) */
  W.loadBookLinks = function (country, city, first) {
    var ck = W.cityKey(country, city), cur = W.C.city[ck]; if (!cur) return;
    var spots = cur.spots || [], food = cur.food || [], isF = {};
    food.forEach(function (x) { isF[W.norm(x.n)] = 1; });
    function wantLink(x) { return isF[W.norm(x.n)] ? x.menu === undefined || (W.needsBooking(x) && x.book === undefined) : (W.isPaid(x) || W.needsBooking(x)) && x.bookV !== 2; }
    function wantDur(x) { return !x.dur && !x.durAsked; }
    var foodTrip = W.S.styles.indexOf("food") > -1;
    function wantFav(x) { return foodTrip && isF[W.norm(x.n)] && x.fav === undefined; }
    var pri = {}; (first || []).forEach(function (n, i) { pri[W.norm(n)] = i + 1; });
    /* opening hours and how far ahead to book: only for places on the trip */
    /* with children where locals dine late, every dinner place's hours, so the plan can pick ones that open early */
    var kidLate = W.party().kid && W.lateDinner && W.lateDinner(country);
    function wantHours(x) { return x.hours === undefined && (pri[W.norm(x.n)] || (kidLate && isF[W.norm(x.n)] && x.meal !== "breakfast" && x.meal !== "lunch")); }
    function wantLead(x) { return pri[W.norm(x.n)] && x.lead === undefined && (W.isPaid(x) || W.needsBooking(x) || x.reserve); }
    /* place check: still open? and the gist of its reviews (places on the trip only) */
    function wantRev(x) { return pri[W.norm(x.n)] && x.st === undefined; }
    /* beach check: every beach when little kids come along (so the plan can favour calm ones), else just the trip's */
    var kids = W.party().kid;
    function wantBeach(x) { return !isF[W.norm(x.n)] && x.bch === undefined && W.isBeach(x) && (kids || pri[W.norm(x.n)]); }
    var need = /** @type {(Spot | Food)[]} */ (spots).concat(food).filter(function (x) { return wantLink(x) || wantDur(x) || wantFav(x) || wantHours(x) || wantLead(x) || wantRev(x) || wantBeach(x); })
      .sort(function (a, b) { return (pri[W.norm(a.n)] || 999) - (pri[W.norm(b.n)] || 999); }).slice(0, 30);
    if (!need.length) return;
    var see = need.filter(function (x) { return !isF[W.norm(x.n)]; }), eat = need.filter(function (x) { return isF[W.norm(x.n)]; });
    var askHours = need.some(wantHours), askLead = need.some(wantLead), askRev = need.some(wantRev), askBeach = need.some(wantBeach);
    run("links|" + ck + "|" + need.length + "|" + W.norm(need[0].n), "For each of these places in " + city + ", " + country + ": " +
      "dur = the recommended time to spend there for these travelers, e.g. '45m', '1-2h', 'half day' (for places to eat, the time to allow for a meal). " + who() + " " +
      "book = the page on the place's OWN official website (or its official ticket office) where visitors buy tickets or book a table. Never a reseller, tour operator, search page or look-alike ticket site (no GetYourGuide, Viator, Tiqets, Klook, Headout, 'xyztickets.com'). " +
      "menu = for places to eat, the page on the place's own website that shows its menu (or its homepage). Use an empty string for any link you are not confident of." +
      (foodTrip ? " fav = for places to eat, true if food lovers seek it out (a famous classic, a top market, a destination restaurant)." : "") +
      (askHours ? " hours = typical opening hours as {\"open\":\"09:00\",\"close\":\"19:00\",\"closed\":[1]}: closed lists the weekdays it is shut (0 = Sunday, 1 = Monday ... 6 = Saturday); for places to eat, the hours the kitchen serves; use \"00:00\" and \"24:00\" for places that are always open such as parks, beaches or viewpoints." : "") +
      (askLead ? " lead = how many days ahead to book to be safe in high season (0 if there is no need to book)." : "") +
      (askRev ? " st = \"open\" if you are confident it still operates, \"closed\" if it has closed for good or no longer exists, \"unsure\" otherwise. love = what reviewers praise most (at most 8 words). gripe = the most common complaint in reviews (at most 8 words; empty if none stands out)." : "") +
      (askBeach ? " beach = for beaches only, what parents of young children need to know, as {\"calm\":\"calm\" or \"some waves\" or \"often rough\" (in summer), \"shallow\":true if the water stays shallow for a good way out, \"shade\":\"umbrellas\" or \"trees\" or \"little\" or \"none\", \"lifeguard\":true if there is usually a lifeguard in summer, \"sand\":\"sand\" or \"pebbles\" or \"mixed\" or \"rocks\", \"walk\":minutes on foot from the nearest parking or bus stop, \"facilities\":true if there are toilets or a café, \"note\":at most 10 words for parents}; leave it out for places that are not beaches." : "") +
      (see.length ? "\nThings to do: " + see.map(function (x) { return x.n; }).join("; ") : "") +
      (eat.length ? "\nPlaces to eat: " + eat.map(function (x) { return x.n; }).join("; ") : "") +
      "\nReply with JSON only: {\"links\":[{\"n\":\"the name exactly as given\",\"dur\":\"1-2h\",\"book\":\"https://...\",\"menu\":\"https://...\"" + (foodTrip ? ",\"fav\":false" : "") + (askHours ? ",\"hours\":{\"open\":\"09:00\",\"close\":\"19:00\",\"closed\":[]}" : "") + (askLead ? ",\"lead\":14" : "") + (askRev ? ",\"st\":\"open\",\"love\":\"\",\"gripe\":\"\"" : "") + (askBeach ? ",\"beach\":{\"calm\":\"calm\",\"shallow\":true,\"shade\":\"umbrellas\",\"lifeguard\":true,\"sand\":\"sand\",\"walk\":5,\"facilities\":true,\"note\":\"\"}" : "") + "}]}",
      "default", function (r) {
        var map = {}; (r && r.links || []).forEach(function (l) { if (l && l.n) map[W.norm(l.n)] = l; });
        need.forEach(function (x) {
          var l = map[W.norm(x.n)] || {}, f = isF[W.norm(x.n)];
          if (wantLink(x)) {
            if (!f) { x.book = W.bookUrl(l.book || l.url); x.bookV = 2; }   /* "" = asked, no confident official link */
            else {
              if (x.menu === undefined) x.menu = W.bookUrl(l.menu);
              if (x.book === undefined) x.book = W.bookUrl(l.book);
            }
          }
          if (wantDur(x)) { if (W.durText(l.dur)) x.dur = V.str(l.dur, 24); x.durAsked = 1; }
          if (wantFav(x)) x.fav = l.fav === true;
          if (wantRev(x)) { x.st = V.status(l.st); x.love = V.str(l.love, 80); x.gripe = V.str(l.gripe, 80); }
          if (wantBeach(x)) x.bch = V.beach(l.beach);
          if (wantHours(x)) x.hours = V.hours(l.hours);
          if (wantLead(x)) x.lead = V.lead(l.lead);
        });
      });
  };
})();
