/* Waypoint: the planner's promises, stated as code (the second script). W.checkPlan(P) reads a finished plan and
   returns every place where it breaks one of the owner's nine rules, each with its day, its part of the day and the
   rule's number; an empty list means the plan keeps them all. The random-trip test (test/suites/fuzz.js) runs it over
   thousands of trips, and it runs on the trip on screen from the console:  W.checkPlan()  or, as a table,
   W.checkPlan.table().  It changes nothing: it only reads the plan, the trip's state and the lists of ideas.

   The rules (W.RULES), and what each means here:
   1  A full day. Every day has the six parts (breakfast, morning, lunch, afternoon, dinner, evening), and each part
      holds a place unless the plan says why not, in the slot's own "why": the owner left it free (S.free), a rest day
      (its morning and evening rest; its one outing is easy and near the stay), "journey" (a travel day: the journey
      takes that part of the day, as lib/times.js says on the row), "light" (a travel day's outing left out so the day
      is not heavy), "late" (it would start past this group's latest hour, W.slotCap), "yours" (a place you chose
      that this town's lists no longer hold: the planner will not put another in its place) or "none" (nothing in this town's ideas fits there). A "none" is checked: if the planner's
      own search still finds a place that fits, the plan broke the rule. A jet-lag day has no day trip, no timed entry
      first thing and an early dinner; a travel day has no day trip.
   2  The planner's own days fit the clock: no "no time", stops in clock order, lunch and dinner at meal times, an
      outing of at least half an hour. Only a place chosen by hand may fail to fit.
   3  A real place is planned once on the trip: by name, by its name's own words, by Google's place ID, by the real
      place an outing happens at (lib/plan.js keysOf), among the days of one town or of towns close to each other.
   4  A day stays in one area: the morning, lunch and afternoon lie within four day radii of each other (the day
      radius is the town's own, about 2 km in a compact city, up to 18 km on a big island), and breakfast, dinner and
      the evening are either near the stay or in that area. A day trip is its own area; nothing but a day trip goes
      farther from the stay than the town's ideas usually are.
   5  No train journey as a thing to do.
   6  Open when you are there: not closed for good, not shut that weekday, that holiday or that stretch of the year,
      open by the time you arrive and for long enough; with children, a dinner place that opens early enough and
      nothing that starts later than their cap (W.slotCap).
   7  A toddler's day has a nap, and the afternoon starts after it; with grandparents along, no strenuous outing.
   8  A name that is not one real place is never planned.
   9  What was chosen by hand (S.picks marked in S.mine, and what is booked) stands where it was put. */
(function () {
  "use strict";
  var W = window.W;
  W.RULES = {
    1: "Every day is full, or says why not",
    2: "The planner's days fit the clock",
    3: "A real place is planned once",
    4: "A day stays in one area",
    5: "No train journeys as things to do",
    6: "Open when you are there",
    7: "Naps for toddlers, nothing strenuous for grandparents",
    8: "Only names that are one real place",
    9: "What you chose by hand stays put"
  };
  var SLOTS = ["breakfast", "am", "lunch", "pm", "dinner", "eve"],
    WHY = { journey: 1, light: 1, late: 1, none: 1, yours: 1 },
    /* what the day's clock says when a place is not open for the visit (lib/times.js writes these) */
    SHUT = /^Closed on|^Closed for|^Closed [A-Z][a-z]{2} \d|^Not open until|before you'd get there|^Kitchen opens|: about \d.* there$/;

  /** is this stop the owner's own doing: a place chosen by hand, or one that is booked
      @param {Day} d @param {SlotEntry} x */
  function byHand(d, x) {
    var S = W.S;
    if ((S.mine || {})[x.key]) return true;
    return !!x.item && booked(d, x.item);
  }
  /** @param {Day} d @param {any} it */
  function booked(d, it) {
    var S = W.S,
      t = (S.booked || {})["item|" + W.cityKey(d.country, d.city) + "|" + W.norm(it.n)];
    if (t === 1) return true;
    return t !== 0 && !!(S.bookings && S.bookings.length && W.bookingFor && W.bookingFor(it, d));
  }

  /** @param {Plan} [P0] @param {{ deep?: boolean, held?: { key: string, name: string }[] }} [opts]
      @returns {{ day: number, slot: string, rule: number, what: string }[]} */
  W.checkPlan = /** @type {any} */ (
    function (/** @type {Plan} */ P0, /** @type {any} */ opts) {
      var P = /** @type {Plan} */ (P0 || W.plan()),
        S = W.S,
        X = W.planX,
        o = opts || {},
        p = P.p,
        kd = W.kidDinner(),
        /** @type {{ day: number, slot: string, rule: number, what: string }[]} */ out = [];
      /** @param {Day | null} d @param {string} slot @param {number} rule @param {string} what */
      function bad(d, slot, rule, what) {
        out.push({ day: d ? d.n : 0, slot: slot, rule: rule, what: what });
      }
      /** @type {{ d: Day, x: SlotEntry, keys: string[], town: string, hand: boolean }[]} */ var all = [];
      P.days.forEach(function (d) {
        if (d.loading) return;
        var slots = d.slots || [];
        if (
          slots
            .map(function (x) {
              return x.slot;
            })
            .join() !== SLOTS.join()
        ) {
          bad(d, "", 1, "the day does not have its six parts");
          return;
        }
        var T = W.dayTimes(d, P),
          home = W.homebase(d.country, d.city),
          wd = W.weekday(d.n),
          am = slots[1],
          dayOut = !!(am.item && T && T.rows.am && (T.rows.am.info || []).join().indexOf("Day trip") > -1),
          last = -1;
        if (!T) return;
        /* ---- rule 1: the day's own kind ---- */
        if (d.jet && (d.trip || dayOut) && !byHand(d, am) && !(d.trip && d.trip.mine)) bad(d, "am", 1, "a jet-lag day has a day trip");
        if (d.moveFrom && ((d.trip && !d.trip.mine) || (dayOut && !byHand(d, am)))) bad(d, "am", 1, "a travel day has a day trip");
        if (d.rest && !(S.rest || {})[W.restKey(d)]) bad(d, "", 1, "a rest day nobody asked for");
        (T.order || SLOTS).forEach(function (sl) {
          var x = slots[SLOTS.indexOf(sl)],
            R = T.rows[sl],
            it = x.item,
            food = W.isFood(sl),
            hand = byHand(d, x);
          if (x.loading) return;
          /* ---- rule 1: an empty part of the day says why ---- */
          if (!it) {
            if (x.free) {
              if (!(S.free || {})[x.key]) bad(d, sl, 1, "left free, but nobody freed it");
            } else if (x.rest) {
              if (!d.rest || food || sl === "pm") bad(d, sl, 1, "resting outside a rest day's morning and evening");
            } else if (!x.why || !WHY[x.why]) bad(d, sl, 1, "empty without a stated reason");
            else if (x.why === "journey") {
              if (!(d.moveFrom && T.travel && R && R.skip)) bad(d, sl, 1, 'says "journey", but no journey takes this part of the day');
            } else if (x.why === "light") {
              if (!d.moveFrom || food) bad(d, sl, 1, 'says "light", but only a travel day\'s outing may be left out for that');
            } else if (x.why === "late") {
              if (!(R && R.skip) || (d.moveFrom && T.travel)) bad(d, sl, 1, 'says "late", but this part of the day could still start');
            } else if (x.why === "yours") {
              if (!((S.mine || {})[x.key] && S.picks[x.key])) bad(d, sl, 1, 'says "yours", but no place of yours is kept for it');
            } else if (o.deep !== false && X.wouldFill) {
              var fit = X.wouldFill(d, x, P);
              if (fit) bad(d, sl, 1, "left empty, though " + fit.n + " fits");
            }
            return;
          }
          var pc = X.poolCity(d, x),
            town = pc[0] + "|" + pc[1];
          all.push({ d: d, x: x, keys: X.keysOf(P.stops[d.stop].used || X.newUsed(pc[1]), it), town: town, hand: hand });
          if (hand) return; /* the rest are the planner's promises about its own choices */
          var c = food ? null : W.classify(it, false),
            h = it.hours;
          /* ---- rule 2: it fits the clock ---- */
          if (!R) bad(d, sl, 2, it.n + " has no time on the day's clock");
          else if (R.skip) bad(d, sl, 2, it.n + ": " + (R.info[0] || "no time for it"));
          else if (R.start != null && R.end != null) {
            if (R.start < last) bad(d, sl, 2, it.n + " starts before the stop before it ends its turn");
            last = R.start;
            if (R.end - R.start < (food ? 20 : 30)) bad(d, sl, 2, it.n + " gets only " + (R.end - R.start) + " minutes");
            if (sl === "lunch" && (R.start < 690 || R.start > 870)) bad(d, sl, 2, "lunch at " + W.clock(R.start));
            if (sl === "dinner") {
              /* (after a journey, dinner follows the landing) */
              var kidCap = Math.max(1110 + (d.jet ? 0 : 30), T.travel ? T.travel.end + 60 : 0);
              if (R.start < 1020 || R.start > 1305 || (p.kid && R.start > kidCap))
                bad(d, sl, 2, "dinner at " + W.clock(R.start) + (p.kid ? " with children" : ""));
              if (d.jet && R.start > Math.max(1110, T.travel ? T.travel.end + 60 : 0))
                bad(d, sl, 1, "a jet-lag day's dinner at " + W.clock(R.start));
            }
            /* ---- rule 6: open for the visit, and not too late for the children ---- */
            var cap = W.slotCap(sl, p);
            if (cap && R.start > cap) bad(d, sl, 6, it.n + " starts at " + W.clock(R.start) + ", past this group's cap");
            if (h && !(h.o === 0 && h.c >= 1440)) {
              if (h.o < 1440 && R.start < h.o) bad(d, sl, 6, it.n + " opens " + W.clock(h.o) + ", after you arrive at " + W.clock(R.start));
              if (h.c < 2880 && h.c <= R.start + 20) bad(d, sl, 6, it.n + " closes " + W.clock(h.c) + ", as you arrive");
            }
            R.warn.forEach(function (w) {
              if (SHUT.test(w)) bad(d, sl, 6, it.n + ": " + w);
            });
          }
          if (W.gone(it)) bad(d, sl, 6, it.n + " is closed for good, or no such place was found");
          if (h && wd != null && h.closed.indexOf(wd) > -1) bad(d, sl, 6, it.n + " is shut that weekday");
          if (W.shutOn(it, d.n)) bad(d, sl, 6, it.n + " is shut for a stretch that takes in this day");
          if (W.holidayShut && W.holidayShut(it, d)) bad(d, sl, 6, it.n + " is shut for the public holiday");
          if (sl === "dinner" && kd != null && h && h.o > kd + 30 && h.o < 1440)
            bad(d, sl, 6, "dinner at " + it.n + " opens " + W.clock(h.o) + ", late for children");
          /* ---- rules 5, 7, 8 ---- */
          if (!food && W.V.trainRide(it.n)) bad(d, sl, 5, it.n + " is a train journey");
          if (c && p.senior && c.intensity >= 3) bad(d, sl, 7, it.n + " is strenuous, with grandparents along");
          if (W.V.vague(it.n, food)) bad(d, sl, 8, it.n + " is not one real place");
          /* ---- rule 1: the days with rules of their own ---- */
          if (d.jet && sl === "am" && W.needsBooking(it)) bad(d, sl, 1, "a jet-lag day starts with a timed entry: " + it.n);
          if (d.rest && sl === "pm" && c) {
            var hk = W.km(home, it);
            if (c.intensity >= 2) bad(d, sl, 1, "a rest day's outing is not an easy one: " + it.n);
            if (hk != null && hk > Math.max(1.5, X.geoOf(d, x, P).R) + 0.01)
              bad(d, sl, 1, "a rest day's outing is " + hk.toFixed(1) + " km from the stay");
          }
        });
        /* ---- rule 7: the nap ---- */
        if (p.toddler) {
          var lunchRow = T.rows.lunch,
            pmRow = T.rows.pm;
          /* (a journey that takes lunch takes the nap with it: the toddler sleeps on the way) */
          var onTheWay = !!(T.travel && lunchRow && lunchRow.skip),
            /* (a place you chose yourself that runs past nap time is your own doing) */
            own = byHand(d, slots[0]) || byHand(d, slots[1]) || byHand(d, slots[2]);
          if (!T.nap && !onTheWay && !own) bad(d, "lunch", 7, "a toddler's day without a nap");
          if (T.nap && slots[3].item && !byHand(d, slots[3]) && pmRow && !pmRow.skip && pmRow.start != null && pmRow.start < T.nap.end)
            bad(d, "pm", 7, "the afternoon starts before the nap ends");
        }
        /* ---- rule 4: one area ---- */
        area(d, P, dayOut, bad);
      });
      /* ---- rule 3: once on the trip ---- */
      /** @type {Record<string, { d: Day, x: SlotEntry, town: string, hand: boolean }[]>} */ var by = {};
      all.forEach(function (e) {
        e.keys.forEach(function (k) {
          (by[k] || (by[k] = [])).forEach(function (f) {
            if (f.x === e.x || (f.hand && e.hand)) return; /* (the same place put on two days by hand is the owner's choice) */
            var near = f.town === e.town || k.slice(0, 2) === "g:";
            if (!near) {
              var dk = W.km(W.homebase(f.d.country, f.d.city), W.homebase(e.d.country, e.d.city));
              near =
                dk != null &&
                dk <= 40 &&
                X.poolCity(f.d, f.x).join("|") === f.d.country + "|" + f.d.city &&
                e.town === e.d.country + "|" + e.d.city;
            }
            if (near)
              bad(
                e.d,
                e.x.slot,
                3,
                e.x.item.n + " is also day " + f.d.n + "'s " + f.x.slot + (f.x.item.n === e.x.item.n ? "" : " (as " + f.x.item.n + ")")
              );
          });
          by[k].push(e);
        });
      });
      /* ---- rule 9: by hand ---- */
      /** @type {Record<string, SlotEntry>} */ var slotAt = {};
      P.days.forEach(function (d) {
        (d.slots || []).forEach(function (x) {
          slotAt[x.key] = x;
          var dn = d;
          if (x.item && !x.loading && (S.mine || {})[x.key] && S.picks[x.key] && W.norm(S.picks[x.key]) !== W.norm(x.item.n))
            bad(dn, x.slot, 9, "you chose " + S.picks[x.key] + ", the plan has " + x.item.n);
        });
      });
      (o.held || []).forEach(function (hd) {
        var x = slotAt[hd.key];
        if (!x || x.loading || x.free || x.rest) return;
        var d = P.days.filter(function (y) {
          return (y.slots || []).indexOf(x) > -1;
        })[0];
        if (!x.item ? x.why !== "yours" : W.norm(x.item.n) !== W.norm(hd.name))
          bad(d, x.slot, 9, hd.name + " was put here by hand; the plan has " + (x.item ? x.item.n : "nothing"));
      });
      return out;
    }
  );
  /* rule 4, for one day. The planner's own stops with a pin are looked at (a place you chose yourself may be anywhere) */
  /** @param {Day} d @param {Plan} P @param {boolean} dayOut @param {(d: Day, slot: string, rule: number, what: string) => void} bad */
  function area(d, P, dayOut, bad) {
    var X = W.planX,
      home = W.homebase(d.country, d.city),
      slots = d.slots,
      /** @param {SlotEntry} x */ pinned = function (x) {
        return !!x.item && x.item.lat != null && x.item.lng != null && !byHand(d, x);
      },
      core = [slots[1], slots[2], slots[3]].filter(pinned),
      edge = [slots[0], slots[4], slots[5]].filter(pinned),
      away = !!d.trip || dayOut,
      g = X.geoOf(d, slots[4], P) /* (the town's own scale: dinner is never a day trip's) */,
      gc = X.geoOf(d, slots[1], P); /* (the day trip's town, when the day is one) */
    core.forEach(function (a, i) {
      core.slice(i + 1).forEach(function (b) {
        var k = W.km(a.item, b.item) || 0;
        if (k > 4 * gc.R + 0.01)
          bad(
            d,
            b.slot,
            4,
            b.item.n +
              " is " +
              k.toFixed(1) +
              " km from " +
              a.item.n +
              " (" +
              a.slot +
              "); a day's area here is " +
              (4 * gc.R).toFixed(0) +
              " km"
          );
      });
      /* an ordinary day's outing is never a trek across the region (a day trip may be) */
      var hk = W.km(home, a.item);
      if (!away && hk != null && home.lat != null && hk > Math.max(6 * g.R, 2 * g.med) + 0.01)
        bad(d, a.slot, 4, a.item.n + " is " + hk.toFixed(0) + " km from the stay, and the day is not a day trip");
    });
    edge.forEach(function (e) {
      var hk = W.km(home, e.item),
        lim = 4 * g.R + 0.01;
      if (hk == null || hk <= lim) return;
      var by = away
        ? false
        : core.some(function (a) {
            return (W.km(a.item, e.item) || 0) <= lim;
          });
      if (!by)
        bad(
          d,
          e.slot,
          4,
          e.item.n + " is " + hk.toFixed(1) + " km from the stay" + (away ? ", after a day out" : " and not in the day's area")
        );
    });
  }
  /** the same as a table in the console, or "the plan keeps every rule" */
  W.checkPlan.table = function () {
    var v = W.checkPlan();
    if (!v.length) return "The plan keeps every rule.";
    if (window.console && console.table)
      console.table(
        v.map(function (x) {
          return { day: x.day, part: x.slot, rule: x.rule + ". " + W.RULES[x.rule], what: x.what };
        })
      );
    return v.length + " broken promise" + (v.length === 1 ? "" : "s");
  };
})();
