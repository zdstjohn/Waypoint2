/* Waypoint stays: how long to stay in a place for this group, and where to stay (a budget, a mid-range and a splurge
   pick). Split from lib/core.js. */
(function () {
  "use strict";
  var W = window.W,
    run = W.run,
    who = W.who,
    centerOf = W.centerOf;
  /* ---------- how long to stay: enough to see the sights vs a relaxed pace, for this group ---------- */
  function rangeSig() {
    var p = W.party();
    return p.toddler ? "t" : p.kids.length ? "k" : "a";
  }
  W.stayRange = function (country, city) {
    var r = W.C.range[W.cityKey(country, city)];
    return r && r.sig === rangeSig() && r.s ? r : null;
  };
  W.loadStayRanges = function (stops) {
    var sig = rangeSig(),
      need = stops.filter(function (x) {
        var r = W.C.range[W.cityKey(x.country, x.name)];
        return !r || r.sig !== sig;
      });
    if (!need.length) return;
    var names = need.map(function (x) {
      return x.name + ", " + x.country;
    });
    run("range|" + sig + "|" + names.join(";"), { ask: "stays.0", a: [names, need, sig] }, "quick");
  };

  /* ---------- where to stay: a budget, a mid-range and a splurge pick per city ---------- */
  W.TIERS = ["budget", "mid", "luxury"];
  W.TIER_NAME = { budget: "Budget", mid: "Mid-range", luxury: "Splurge" };
  function lodgeSig() {
    var p = W.party();
    return p.adults + "a" + p.kids.length + "k";
  }
  W.lodgeSig = lodgeSig;
  W.loadLodging = function (country, city, tier) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck],
      sig = lodgeSig();
    var have = cur && cur.lodgeFor === sig ? cur.lodging || [] : [];
    var near =
      W.S.stays[ck] &&
      W.S.stays[ck].label &&
      !have.some(function (x) {
        return x.n === W.S.stays[ck].label;
      })
        ? " Prefer the area around " + W.S.stays[ck].label + " if it suits."
        : "";
    run(
      "lodge|" + ck + "|" + sig + (tier ? "|" + tier + "|" + have.length : ""),
      { ask: "stays.1", a: [city, ck, country, have, near, sig, tier] },
      "default"
    );
  };
  /* the pick shown for a tier, and a reroll that cycles through that tier's options (fetching more before they run out) */
  W.lodgeList = function (country, city, tier) {
    var cur = W.C.city[W.cityKey(country, city)];
    return cur && cur.lodgeFor === lodgeSig()
      ? (cur.lodging || []).filter(function (x) {
          return x.tier === tier;
        })
      : [];
  };
  /* The pick on show from a list (k: the place and the tier), and the next one: Claude's picks and Booking.com's
     (lib/prices.js) both go through these. The next one is one not shown yet; when all have been, round again. */
  /** @template {{n: string}} T @param {string} k @param {T[]} list @returns {T | null} */
  function pickShown(k, list) {
    var S = W.S;
    S.lodge = S.lodge || {};
    S.lodgeSeen = S.lodgeSeen || {};
    var nm = S.lodge[k],
      it =
        nm &&
        list.filter(function (x) {
          return x.n === nm;
        })[0];
    if (it) return it;
    var seen = S.lodgeSeen[k] || [];
    return (
      list.filter(function (x) {
        return seen.indexOf(W.norm(x.n)) < 0;
      })[0] ||
      list[0] ||
      null
    );
  }
  /** shows the next pick; returns how many were left not yet shown (so a caller can fetch more before they run out)
   *  @param {string} k @param {{n: string}[]} list */
  function pickNext(k, list) {
    var S = W.S,
      cur = pickShown(k, list),
      lodge = S.lodge || (S.lodge = {}),
      seenAll = S.lodgeSeen || (S.lodgeSeen = {}),
      seen = (seenAll[k] = seenAll[k] || []);
    if (cur && seen.indexOf(W.norm(cur.n)) < 0) seen.push(W.norm(cur.n));
    var left = list.filter(function (x) {
      return seen.indexOf(W.norm(x.n)) < 0;
    });
    if (left.length) lodge[k] = left[0].n;
    else {
      seenAll[k] = cur ? [W.norm(cur.n)] : [];
      var again = list.filter(function (x) {
        return !cur || x.n !== cur.n;
      })[0];
      if (again) lodge[k] = again.n;
    }
    return left.length;
  }
  W.pickShown = pickShown;
  W.pickNext = pickNext;
  W.lodgeShown = function (country, city, tier) {
    return pickShown(W.cityKey(country, city) + "|" + tier, W.lodgeList(country, city, tier));
  };
  W.lodgeReroll = function (country, city, tier) {
    if (pickNext(W.cityKey(country, city) + "|" + tier, W.lodgeList(country, city, tier)) < 2) W.loadLodging(country, city, tier);
  };
  /* every booking site's price for one place, side by side (Google Hotels), so you can see where it's cheapest */
  W.priceUrl = function (it, city) {
    return "https://www.google.com/travel/hotels?q=" + encodeURIComponent(it.n + " " + city);
  };

  /* Stops on the trip with no pin at all (a list saved before its pin was checked and then cleared, or a place added
     without one): Claude is asked once, for those names only, where each one is. A place the check took off the map
     on purpose (far out at sea) is not asked again; every answer must fall near the city like any other pin. */
  W.loadPins = function (country, city, names) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    if (!cur || !names || !names.length || W.cityBusy(ck)) return; /* (not while its lists are still being written) */
    var want = {};
    names.forEach(function (n) {
      want[W.norm(n)] = 1;
    });
    var need = /** @type {(Spot | Food)[]} */ ([])
      .concat(cur.spots || [], cur.food || [])
      .filter(function (x) {
        if (!x || !want[W.norm(x.n)] || x.lat != null || x.pinAsked) return false;
        var r = W.placeInfo ? W.placeInfo(x, country, city) : null;
        return !(r && (r.nopin || r.st === "closed" || r.st === "unfound" || r.st === "dup"));
      })
      .slice(0, 20);
    if (!need.length) return;
    var center = centerOf(ck);
    run(
      "pins|" +
        ck +
        "|" +
        need
          .map(function (x) {
            return W.norm(x.n);
          })
          .join(";"),
      { ask: "stays.2", a: [center, city, country, need] },
      "quick"
    );
  };

  /* official booking and menu links, and recommended visit times, for ideas saved before those existed.
     first = names to fill first (today's stops) */
  W.loadBookLinks = function (country, city, first) {
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    if (!cur || W.cityBusy(ck)) return; /* (not while its lists are still being written) */
    var spots = cur.spots || [],
      food = cur.food || [],
      isF = {};
    food.forEach(function (x) {
      isF[W.norm(x.n)] = 1;
    });
    function wantLink(x) {
      return isF[W.norm(x.n)]
        ? x.menu === undefined || (W.needsBooking(x) && x.book === undefined)
        : (W.isPaid(x) || W.needsBooking(x)) && x.bookV !== 2;
    }
    function wantDur(x) {
      return !x.dur && !x.durAsked;
    }
    var foodTrip = W.S.styles.indexOf("food") > -1;
    function wantFav(x) {
      return foodTrip && isF[W.norm(x.n)] && x.fav === undefined;
    }
    var pri = {};
    (first || []).forEach(function (n, i) {
      pri[W.norm(n)] = i + 1;
    });
    /* opening hours and how far ahead to book: only for places on the trip */
    /* with children where locals dine late, every dinner place's hours, so the plan can pick ones that open early */
    var kidLate = W.party().kid && W.lateDinner && W.lateDinner(country);
    function wantHours(x) {
      return x.hours === undefined && (pri[W.norm(x.n)] || (kidLate && isF[W.norm(x.n)] && x.meal !== "breakfast" && x.meal !== "lunch"));
    }
    function wantLead(x) {
      return pri[W.norm(x.n)] && x.lead === undefined && (W.isPaid(x) || W.needsBooking(x) || x.reserve);
    }
    /* place check: still open? and the gist of its reviews (places on the trip only) */
    function wantRev(x) {
      return pri[W.norm(x.n)] && x.st === undefined;
    }
    /* beach check: every beach when little kids come along (so the plan can favour calm ones), else just the trip's */
    var kids = W.party().kid;
    function wantBeach(x) {
      return !isF[W.norm(x.n)] && x.bch === undefined && W.isBeach(x) && (kids || pri[W.norm(x.n)]);
    }
    var need = /** @type {(Spot | Food)[]} */ (spots)
      .concat(food)
      .filter(function (x) {
        return wantLink(x) || wantDur(x) || wantFav(x) || wantHours(x) || wantLead(x) || wantRev(x) || wantBeach(x);
      })
      .sort(function (a, b) {
        return (pri[W.norm(a.n)] || 999) - (pri[W.norm(b.n)] || 999);
      })
      .slice(0, 30);
    if (!need.length) return;
    var see = need.filter(function (x) {
        return !isF[W.norm(x.n)];
      }),
      eat = need.filter(function (x) {
        return isF[W.norm(x.n)];
      });
    var askHours = need.some(wantHours),
      askLead = need.some(wantLead),
      askRev = need.some(wantRev),
      askBeach = need.some(wantBeach);
    run(
      "links|" + ck + "|" + need.length + "|" + W.norm(need[0].n),
      {
        ask: "stays.3",
        a: [
          askBeach,
          askHours,
          askLead,
          askRev,
          city,
          country,
          eat,
          foodTrip,
          isF,
          need,
          see,
          wantBeach,
          wantDur,
          wantFav,
          wantHours,
          wantLead,
          wantLink,
          wantRev
        ]
      },
      "default"
    );
  };
  /* what the questions and the answers' handling use from here: they come later, in a file of their own (lib/staysask.js) */
  W.ASK_X.stays = { centerOf: centerOf, who: who };
})();
