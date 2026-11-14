/* Waypoint stays, the second script's half: how long to stay in a place for this group, and where to stay (a budget, a
   mid-range and a splurge pick), which only Plan, Prepare and the stay sheet use. Split from lib/stays.js (v200 audit):
   nothing the first screen draws calls these. */
(function () {
  "use strict";
  var W = window.W,
    run = W.run;
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
})();
