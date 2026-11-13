/* stays.js's questions to Claude, word for word, and what is done with each answer: only needed once Claude is
   asked, so they come after the first screen (the "ask" piece; lib/core.js W.run sends a question when it is in).
   Each entry: q = the question, ok = the answer's handler, stream = the items handed over while the answer is written;
   all three are given what the loader in lib/stays.js had at hand when it asked. */
(function () {
  "use strict";
  var W = window.W,
    X = W.ASK_X.stays,
    centerOf = X.centerOf,
    who = X.who;
  var V = W.V;
  var newPool = W.newPool;
  var TIER_DESC = {
    budget: "budget (simple hotels, guesthouses, hostels with private family rooms, or good-value apartments)",
    mid: "mid-range (comfortable 3–4 star hotels or well-run apartments)",
    luxury: "luxury (the best 5-star or boutique hotels)"
  };
  function groupText() {
    var p = W.party(),
      n = W.ages().length || 2;
    return (
      "The group is " +
      n +
      " people: " +
      (p.adults || n) +
      " adult" +
      ((p.adults || n) === 1 ? "" : "s") +
      (p.kids.length
        ? " and " +
          p.kids.length +
          " child" +
          (p.kids.length === 1 ? "" : "ren") +
          " (ages " +
          p.kids.join(", ") +
          "). Every pick must suit a family: family rooms, connecting rooms or an apartment that sleeps " +
          n +
          "."
        : ". Rooms that fit the whole group.")
    );
  }
  /** picks into a city's list as they come (a few at a time while the answer is written, then the whole answer): none
   *  twice, and a list made for another group is started afresh.
   *  @param {string} ck @param {string} sig @param {any} list @param {Tier} [tier] */
  function addLodging(ck, sig, list, tier) {
    var c0 = W.C.city[ck] || newPool();
    if (c0.lodgeFor !== sig) {
      c0.lodging = [];
      c0.lodgeFor = sig;
    }
    var seen = {},
      have = c0.lodging || (c0.lodging = []); /* (a copy from elsewhere can carry the mark without the list) */
    have.forEach(function (x) {
      seen[W.norm(x.n)] = 1;
    });
    V.list(list, function (x) {
      return V.lodging(x, centerOf(ck), W.TIERS, tier);
    }).forEach(function (x) {
      if (!seen[W.norm(x.n)]) {
        seen[W.norm(x.n)] = 1;
        have.push(x);
      }
    });
    W.C.city[ck] = c0;
    return c0;
  }
  W.ASKS["stays.0"] = {
    q: function (names, need, sig) {
      return (
        "How many days should this group spend in each of these places? " +
        who() +
        " sights = full days to see the main sights and highlights at a steady pace. relaxed = full days for a slow, relaxing visit with downtime, long meals and nothing rushed. Don't count travel days. Places: " +
        names.join("; ") +
        '\nReply with JSON only: {"stays":[{"n":"place, country exactly as given","sights":3,"relaxed":5}]}'
      );
    },
    ok: function (names, need, sig) {
      return function (r) {
        var map = {};
        ((r && r.stays) || []).forEach(function (x) {
          if (x && x.n) {
            map[W.norm(x.n)] = x;
            map[W.norm(String(x.n).split(",")[0])] = map[W.norm(String(x.n).split(",")[0])] || x;
          }
        });
        need.forEach(function (x) {
          var rg = V.range(map[W.norm(x.name + ", " + x.country)] || map[W.norm(x.name)]);
          /* asked either way, so a place Claude skipped isn't asked about again and again */
          W.C.range[W.cityKey(x.country, x.name)] = rg ? { s: rg.s, r: rg.r, sig: sig } : { sig: sig };
        });
      };
    }
  };
  W.ASKS["stays.1"] = {
    q: function (city, ck, country, have, near, sig, tier) {
      return (
        (tier ? "Suggest 4 MORE " + TIER_DESC[tier] + " places to stay" : "Suggest places to stay") +
        " in " +
        city +
        ", " +
        country +
        ". " +
        groupText() +
        (tier
          ? ""
          : " Give 4 in each price tier: " +
            W.TIERS.map(function (t) {
              return TIER_DESC[t];
            }).join("; ") +
            ". Write the best pick of each tier first (budget, then mid, then luxury), then the others.") +
        " Real, currently operating places with good reviews, in safe, convenient areas for visitors (central, or close to the main sights and good transit)." +
        near +
        (have.length
          ? " Do not repeat: " +
            have
              .map(function (x) {
                return x.n;
              })
              .join("; ") +
            "."
          : "") +
        '\nReply with JSON only: {"lodging":[{"n":"name","tier":"' +
        (tier || "budget") +
        '","type":"hotel","area":"neighborhood","d":"why it\'s a good pick for this group, one short sentence","price":"€90–120","site":"","lat":0,"lng":0}]}\n' +
        "tier = budget, mid or luxury. type = hotel, apartment, guesthouse, hostel, resort or villa. price = the typical price per night for a room or unit that fits the group, in local currency. site = the place's own official website if you are confident of the exact address, else an empty string (never Booking.com, Expedia or another booking site). Use accurate coordinates."
      );
    },
    ok: function (city, ck, country, have, near, sig, tier) {
      return function (r) {
        var c0 = addLodging(ck, sig, r && r.lodging, tier);
        if (!tier) c0.lodgeAsked = 1;
      };
    },
    stream: function (city, ck, country, have, near, sig, tier) {
      return {
        list: "lodging",
        min: 1,
        take: function (items) {
          addLodging(ck, sig, items, tier);
        }
      };
    }
  };
  W.ASKS["stays.2"] = {
    q: function (center, city, country, need) {
      return (
        "Where exactly is each of these places in or near " +
        city +
        ", " +
        country +
        "? " +
        "Give the latitude and longitude of the place itself (its entrance, or the middle of a beach, square or market). If a name covers an area or a choice of places, give its most typical spot. " +
        "Use null for any you cannot place with confidence.\n" +
        need
          .map(function (x) {
            return x.n;
          })
          .join("; ") +
        '\nReply with JSON only: {"pins":[{"n":"the name exactly as given","lat":0.0,"lng":0.0}]}'
      );
    },
    ok: function (center, city, country, need) {
      return function (r) {
        var map = {};
        ((r && r.pins) || []).forEach(function (q) {
          if (q && q.n) map[W.norm(q.n)] = q;
        });
        need.forEach(function (x) {
          var q = map[W.norm(x.n)] || {},
            p = V.pinNear(q.lat, q.lng, center, 120);
          x.pinAsked = 1;
          if (p) {
            x.lat = p.lat;
            x.lng = p.lng;
            x.g = [p.lat, p.lng];
          }
        });
      };
    }
  };
  W.ASKS["stays.3"] = {
    q: function (
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
    ) {
      return (
        "For each of these places in " +
        city +
        ", " +
        country +
        ": " +
        "dur = the recommended time to spend there for these travelers, e.g. '45m', '1-2h', 'half day' (for places to eat, the time to allow for a meal). " +
        who() +
        " " +
        "book = the page on the place's OWN official website (or its official ticket office) where visitors buy tickets or book a table. Never a reseller, tour operator, search page or look-alike ticket site (no GetYourGuide, Viator, Tiqets, Klook, Headout, 'xyztickets.com'). " +
        "menu = for places to eat, the page on the place's own website that shows its menu (or its homepage). Use an empty string for any link you are not confident of." +
        (foodTrip
          ? " fav = for places to eat, true if food lovers seek it out (a famous classic, a top market, a destination restaurant)."
          : "") +
        (askHours
          ? ' hours = typical opening hours as {"open":"09:00","close":"19:00","closed":[1]}: closed lists the weekdays it is shut (0 = Sunday, 1 = Monday ... 6 = Saturday); for places to eat, the hours the kitchen serves; use "00:00" and "24:00" for places that are always open such as parks, beaches or viewpoints.'
          : "") +
        (askLead ? " lead = how many days ahead to book to be safe in high season (0 if there is no need to book)." : "") +
        (askRev
          ? ' st = "open" if you are confident it still operates, "closed" if it has closed for good or no longer exists, "unsure" otherwise. love = what reviewers praise most (at most 8 words). gripe = the most common complaint in reviews (at most 8 words; empty if none stands out).'
          : "") +
        (askBeach
          ? ' beach = for beaches only, what parents of young children need to know, as {"calm":"calm" or "some waves" or "often rough" (in summer), "shallow":true if the water stays shallow for a good way out, "shade":"umbrellas" or "trees" or "little" or "none", "lifeguard":true if there is usually a lifeguard in summer, "sand":"sand" or "pebbles" or "mixed" or "rocks", "walk":minutes on foot from the nearest parking or bus stop, "facilities":true if there are toilets or a café, "note":at most 10 words for parents}; leave it out for places that are not beaches.'
          : "") +
        (see.length
          ? "\nThings to do: " +
            see
              .map(function (x) {
                return x.n;
              })
              .join("; ")
          : "") +
        (eat.length
          ? "\nPlaces to eat: " +
            eat
              .map(function (x) {
                return x.n;
              })
              .join("; ")
          : "") +
        '\nReply with JSON only: {"links":[{"n":"the name exactly as given","dur":"1-2h","book":"https://...","menu":"https://..."' +
        (foodTrip ? ',"fav":false' : "") +
        (askHours ? ',"hours":{"open":"09:00","close":"19:00","closed":[]}' : "") +
        (askLead ? ',"lead":14' : "") +
        (askRev ? ',"st":"open","love":"","gripe":""' : "") +
        (askBeach
          ? ',"beach":{"calm":"calm","shallow":true,"shade":"umbrellas","lifeguard":true,"sand":"sand","walk":5,"facilities":true,"note":""}'
          : "") +
        "}]}"
      );
    },
    ok: function (
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
    ) {
      return function (r) {
        var map = {};
        ((r && r.links) || []).forEach(function (l) {
          if (l && l.n) map[W.norm(l.n)] = l;
        });
        need.forEach(function (x) {
          var l = map[W.norm(x.n)] || {},
            f = isF[W.norm(x.n)];
          if (wantLink(x)) {
            if (!f) {
              x.book = W.bookUrl(l.book || l.url);
              x.bookV = 2;
            } /* "" = asked, no confident official link */ else {
              if (x.menu === undefined) x.menu = W.bookUrl(l.menu);
              if (x.book === undefined) x.book = W.bookUrl(l.book);
            }
          }
          if (wantDur(x)) {
            if (W.durText(l.dur)) x.dur = V.str(l.dur, 24);
            x.durAsked = 1;
          }
          if (wantFav(x)) x.fav = l.fav === true;
          if (wantRev(x)) {
            x.st = V.status(l.st);
            x.love = V.str(l.love, 80);
            x.gripe = V.str(l.gripe, 80);
          }
          if (wantBeach(x)) x.bch = V.beach(l.beach);
          if (wantHours(x)) x.hours = V.hours(l.hours);
          if (wantLead(x)) x.lead = V.lead(l.lead);
        });
      };
    }
  };
})();
