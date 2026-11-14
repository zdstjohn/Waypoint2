/* Waypoint: your bookings checked against the plan (v165, the owner's pick "Check my plan with your bookings").
   The stays, journeys, timed tickets and tables you added or imported (S.bookings, lib/bookcore.js) are read against
   the plan at once, on the phone, without asking Claude:
   - a stay whose nights don't match the plan's nights in that town (it starts or ends a day off, two stays the same
     night, a night in a booked town with no stay, a stay in a town the plan isn't in then);
   - a journey booked on another day than the plan's move between the two towns;
   - arriving before check-in, or leaving well after check-out (what to do with the bags);
   - a ticket, tour or table booked for another day or time than the plan has the place, or for a place not in the
     plan at all.
   Each is shown in "Check my plan" (lib/review.js W.reviewBlock) in the card's own form: the day, the part of the day,
   what is wrong and what to try. Claude's own check reads the bookings too (W.reviewFacts: booked). Nothing in the plan
   or the bookings is changed. Part of the second script. */
(function () {
  "use strict";
  var W = window.W;
  var TRAVEL = { train: 1, ferry: 1, bus: 1, flight: 1 },
    TIMED = { ticket: 1, tour: 1, activity: 1, restaurant: 1 };
  /* minutes from midnight of an ISO "YYYY-MM-DDTHH:MM", or null without a time */
  function hm(iso) {
    var m = /T(\d{2}):(\d{2})/.exec(iso || "");
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function day(iso) {
    return iso ? W.dayOfDate(iso) : null;
  }
  /** "Jun 9" for a trip day @param {number} n */
  function date(n) {
    var d = W.dateOf(n);
    return d ? W.fmtDate(d, "md") : "Day " + n;
  }
  /* a place's name against a booking's words, the way the rest of the bookings match them (lib/bookcore.js) */
  function like(/** @type {string} */ name, /** @type {string} */ text) {
    return W.nameMatch(name || "", text || "");
  }
  /** each town's nights on the plan: [{si, name, first, last}] (the night of a day is spent in that day's town; the
      trip's last day ends at home) @param {Plan} P */
  function nights(P) {
    var out = /** @type {{ si: number, name: string, first: number, last: number }[]} */ ([]);
    P.stops.forEach(function (s, si) {
      var ds = P.days.filter(function (d) {
        return d.stop === si;
      });
      if (!ds.length) return;
      var first = ds[0].n,
        last = ds[ds.length - 1].n;
      if (last >= P.N) last = P.N - 1;
      if (last >= first) out.push({ si: si, name: s.name, first: first, last: last });
    });
    return out;
  }
  /** the problems, most useful first @param {Plan} P @returns {{day: number, slot: string, kind: string, text: string, fix: string}[]} */
  W.bookCheck = function (P) {
    var list = (W.S.bookings || []).filter(function (b) {
      return b && b.kind && b.start;
    });
    if (!P || !P.days || !P.days.length || !list.length || !W.S.start) return [];
    var out = /** @type {any[]} */ ([]),
      N = nights(P);
    var add = function (/** @type {number} */ d, /** @type {string} */ slot, /** @type {string} */ text, /** @type {string} */ fix) {
      out.push({ day: Math.max(1, Math.min(P.N, d)), slot: slot, kind: "booking", text: text, fix: fix });
    };
    var townOf = function (/** @type {any} */ b) {
      return N.filter(function (t) {
        return like(t.name, b.place) || like(b.place, t.name);
      })[0];
    };

    /* ---- stays ---- */
    var stays = list
      .filter(function (b) {
        return b.kind === "lodging" && day(b.start) != null;
      })
      .map(function (b) {
        var ci = /** @type {number} */ (day(b.start)),
          co = day(b.end);
        return {
          b: b,
          ci: ci,
          co: co != null && co > ci ? co : ci + 1,
          name: b.title || b.provider || "your stay",
          t: /** @type {any} */ (null),
          off: false
        };
      });
    /* each stay's town: the one it names, or the town the plan has you in on its first night */
    stays.forEach(function (s) {
      var t = townOf(s.b),
        named = !!t;
      if (!t)
        t = N.filter(function (x) {
          return s.ci >= x.first && s.ci <= x.last;
        })[0];
      if (!t) return;
      s.t = t;
      if (named && (s.co - 1 < t.first || s.ci > t.last)) {
        s.off = true;
        add(
          s.ci,
          "",
          s.name + " (" + t.name + ", " + date(s.ci) + " to " + date(s.co) + ") is booked when the plan has you elsewhere.",
          "Check the booking's dates, or move " + t.name + " in Plan."
        );
        return;
      }
      if (s.ci < t.first && named)
        add(
          s.ci,
          "",
          s.name + " starts the night of " + date(s.ci) + ", before the plan reaches " + t.name + " (" + date(t.first) + ").",
          "Change the booking, or arrive earlier."
        );
      if (s.co - 1 > t.last && named)
        add(
          t.last,
          "",
          s.name + " runs to " + date(s.co) + ", but the plan leaves " + t.name + " on " + date(t.last + 1) + ".",
          "Shorten the booking, or stay longer in Plan."
        );
    });
    /** "the night of Jun 8" or "the nights of Jun 8 to Jun 10" @param {number} a @param {number} b */
    var nightsText = function (a, b) {
      return a === b ? "the night of " + date(a) : "the nights of " + date(a) + " to " + date(b);
    };
    /* each booked town, night by night: the first nights before any stay starts, nights with no stay, two stays at once;
       a run of nights is one problem */
    N.forEach(function (t) {
      var mine = stays
        .filter(function (s) {
          return s.t === t && !s.off;
        })
        .sort(function (x, y) {
          return x.ci - y.ci;
        });
      if (!mine.length) return;
      var from = t.first;
      if (mine[0].ci > t.first) {
        add(
          t.first,
          "",
          "The plan arrives in " +
            t.name +
            " on " +
            date(t.first) +
            ", but " +
            mine[0].name +
            " starts the night of " +
            date(mine[0].ci) +
            ".",
          "Book " + nightsText(t.first, Math.min(t.last, mine[0].ci - 1)) + ", or arrive later."
        );
        from = mine[0].ci;
      }
      /** @type {{n: number, k: string, who: string}[]} */
      var row = [];
      for (var n = from; n <= t.last; n++) {
        var on = mine.filter(function (s) {
          return n >= s.ci && n < s.co;
        });
        row.push({
          n: n,
          k: !on.length ? "none" : on.length > 1 ? "two" : "",
          who: on
            .map(function (s) {
              return s.name;
            })
            .join(" and ")
        });
      }
      for (var i = 0; i < row.length; i++) {
        var r = row[i];
        if (!r.k) continue;
        var j = i;
        while (j + 1 < row.length && row[j + 1].k === r.k && row[j + 1].who === r.who) j++;
        var span = nightsText(r.n, row[j].n);
        if (r.k === "none")
          add(
            r.n,
            "",
            span.charAt(0).toUpperCase() + span.slice(1) + " in " + t.name + (i === j ? " has" : " have") + " no stay booked.",
            "Extend a booking, or book " + (i === j ? "that night." : "those nights.")
          );
        else
          add(
            r.n,
            "",
            "Two stays are booked for " + span + ": " + r.who + ".",
            "Cancel the one you won't use, if it can still be cancelled."
          );
        i = j;
      }
    });

    /* ---- journeys: on the day the plan moves; and the bags around check-in and check-out ---- */
    for (var si = 1; si < P.stops.length; si++) {
      var a = P.stops[si - 1],
        bt = P.stops[si],
        move = P.days.filter(function (d) {
          return d.stop === si;
        })[0];
      if (!move) continue;
      var tk = list.filter(function (b) {
        return TRAVEL[b.kind] && like(a.name, b.place) && like(bt.name, b.to);
      })[0];
      if (tk) {
        var tn = day(tk.start);
        if (tn != null && tn !== move.n && !(tn === move.n - 1 && hm(tk.start) != null && /** @type {number} */ (hm(tk.start)) >= 19 * 60))
          add(
            move.n,
            "",
            "Your " +
              tk.kind +
              " from " +
              a.name +
              " to " +
              bt.name +
              " is booked for " +
              date(tn) +
              ", but the plan moves on " +
              date(move.n) +
              ".",
            "Check the ticket's date, or change the number of days in " + a.name + " in Plan."
          );
      }
      /* check-in later than you arrive */
      var ticket = W.legTicket ? W.legTicket(P, si) : null,
        T = W.dayTimes ? W.dayTimes(move, P) : null,
        arrive = ticket && ticket.arr != null && !ticket.zone ? ticket.arr % 1440 : T && T.travel ? T.travel.end : null;
      var inn = stays.filter(function (s) {
        return s.ci === move.n && hm(s.b.start) != null;
      })[0];
      if (inn && arrive != null && /** @type {number} */ (hm(inn.b.start)) - arrive >= 90)
        add(
          move.n,
          "",
          "You arrive in " +
            bt.name +
            " about " +
            W.clock(arrive) +
            "; check-in at " +
            inn.name +
            " is from " +
            W.clock(/** @type {number} */ (hm(inn.b.start))) +
            ".",
          "Ask to leave your bags at " + inn.name + " when you arrive, and plan something near it until then."
        );
      /* check-out well before you leave */
      var out0 = stays.filter(function (s) {
        return s.co === move.n && hm(s.b.end) != null;
      })[0];
      var leave = ticket ? ticket.dep : T && T.travel ? T.travel.start : null;
      if (out0 && leave != null && leave - /** @type {number} */ (hm(out0.b.end)) >= 180)
        add(
          move.n,
          "",
          "Check-out at " +
            out0.name +
            " is by " +
            W.clock(/** @type {number} */ (hm(out0.b.end))) +
            ", but you leave " +
            a.name +
            " about " +
            W.clock(leave) +
            ".",
          "Ask to keep your bags at " + out0.name + " after check-out, or book a late check-out."
        );
    }

    /* ---- tickets, tours and tables with a time: where the plan has the place ---- */
    list
      .filter(function (b) {
        return TIMED[b.kind] && day(b.start) != null;
      })
      .forEach(function (b) {
        var bn = /** @type {number} */ (day(b.start)),
          at = hm(b.start),
          words = (b.title || "") + " " + (b.what || "") + " " + (b.provider || ""),
          hits = /** @type {{d: any, x: any, r: number}[]} */ ([]);
        /* the plan's places with this name; only the closest names, so "Sight 2-2" isn't taken for "Sight 2-7" */
        var best = 0;
        P.days.forEach(function (d) {
          (d.slots || []).forEach(function (x) {
            var r = x.item ? W.nameRank(x.item.n, words) : 0;
            if (r) hits.push({ d: d, x: x, r: r });
            if (r > best) best = r;
          });
        });
        hits = hits.filter(function (h) {
          return h.r >= best - 1e-9;
        });
        var name = b.title || (hits[0] && hits[0].x.item.n) || "A booking";
        if (bn < 1 || bn > P.N) return;
        if (!hits.length) {
          add(
            bn,
            "",
            name + " is booked for " + date(bn) + (at != null ? " at " + W.clock(at) : "") + ", but it isn't in the plan.",
            "Add it to Day " + bn + " from Explore, or check the booking."
          );
          return;
        }
        var same = hits.filter(function (h) {
          return h.d.n === bn;
        })[0];
        if (!same) {
          var h0 = hits[0];
          add(
            h0.d.n,
            h0.x.slot,
            name + " is booked for " + date(bn) + ", but the plan has it on Day " + h0.d.n + " (" + date(h0.d.n) + ").",
            "Move it to Day " + bn + " (its sheet: Move to another day), or change the booking."
          );
          return;
        }
        if (at == null) return;
        var R = (W.dayTimes ? W.dayTimes(same.d, P) : null) || null,
          row = R && R.rows ? R.rows[same.x.slot] : null;
        if (row && row.start != null && !row.skip && Math.abs(row.start - at) > 45)
          add(
            bn,
            same.x.slot,
            name + " is booked for " + W.clock(at) + ", but the plan has it at " + W.clock(row.start) + ".",
            row.start > at
              ? "Go earlier: swap it with the stop before it (Reorder today)."
              : "Go later: swap it with the stop after it (Reorder today)."
          );
      });

    /* one of each, by day */
    var seen = {};
    return out
      .filter(function (i) {
        var k = i.day + "|" + i.text;
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      })
      .sort(function (a, b) {
        return a.day - b.day;
      })
      .slice(0, 12);
  };
  /** what is booked on a day, for Claude's own check (W.reviewFacts) @param {number} n */
  W.bookedOn = function (n) {
    return (W.S.bookings || [])
      .filter(function (b) {
        if (!b || !b.start) return false;
        var s = day(b.start),
          e = day(b.end);
        return s === n || (b.kind === "lodging" && s != null && e != null && n >= s && n <= e);
      })
      .map(function (b) {
        var o = /** @type {Record<string, any>} */ ({ kind: b.kind, what: String(b.title || b.what || "").slice(0, 60) });
        if (hm(b.start) != null && day(b.start) === n) o.at = W.clock(/** @type {number} */ (hm(b.start)));
        if (b.kind === "lodging") {
          if (day(b.start) === n) o.check_in = hm(b.start) != null ? W.clock(/** @type {number} */ (hm(b.start))) : true;
          if (day(b.end) === n) o.check_out = hm(b.end) != null ? W.clock(/** @type {number} */ (hm(b.end))) : true;
        }
        if (b.to) o.to = String(b.to).slice(0, 40);
        return o;
      });
  };
})();
