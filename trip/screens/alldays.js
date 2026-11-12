/* Waypoint: every day of the trip at a glance (second script). All days on the Trip screen (W.glance: one card per
   place you stay, its photo, a row for each day) and the two things a day's row is made of, which the desktop
   rail's day list uses too: what the day is (W.dayHeadline) and how full it is (W.dayBars). Until v153 this was part
   of screens/flow.js in the first script; no first screen needs it unless you left All days open, and that screen
   waits a moment for it (screens/trip.js). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  function fmt(d, o) {
    return d ? d.toLocaleDateString(undefined, o || { month: "short", day: "numeric" }) : "";
  }
  /* a day in a line (All days, and the desktop rail's day list): what the day is, and how full */
  /** a travel day's journey, a day trip, a rest day, or the day's first sight @param {Day} d @param {Plan} P */
  W.dayHeadline = function (d, P) {
    var hl = "";
    if (d.moveFrom) {
      var L = W.legFor(P, d.stop);
      hl = d.moveFrom + " → " + d.city + (L && L.best ? " by " + W.modeName(L.best.mode).toLowerCase() : "");
    } else if (d.trip) hl = "Day trip to " + d.trip.name;
    else
      (d.slots || []).some(function (x) {
        if (x.item && !W.isFood(x.slot)) {
          hl = x.item.n;
          return true;
        }
        return false;
      });
    if (d.rest) hl = "Rest day" + (hl ? " · " + hl : "");
    return hl;
  };
  /** the day's effort as four bars ("" while the day is still loading) @param {Day} d @param {Plan} P */
  W.dayBars = function (d, P) {
    var T = d.slots && d.slots.length ? W.dayTimes(d, P) : null,
      E = T && W.dayEnergy ? W.dayEnergy(d, P, T) : null;
    return E
      ? '<span class="energy lv' +
          E.level +
          '" title="' +
          esc(E.label) +
          ' day"><span class="bars">' +
          [1, 2, 3, 4]
            .map(function (i) {
              return "<i" + (i <= E.level ? ' class="on"' : "") + "></i>";
            })
            .join("") +
          "</span></span>"
      : "";
  };
  W.glance = function (P) {
    if (!W.S.glanceOpen) return "";
    var tn = W.todayN(P);
    function row(d) {
      var hl = W.dayHeadline(d, P),
        bars = W.dayBars(d, P);
      var dt = fmt(W.dateOf(d.n), { weekday: "short", month: "short", day: "numeric" });
      return (
        '<button type="button" role="listitem" class="g-day' +
        (d.n === W.S.day ? " on" : "") +
        (d.n === tn ? " today" : "") +
        '" data-day="' +
        d.n +
        '"' +
        (d.n === W.S.day ? ' aria-current="true"' : "") +
        ">" +
        '<span class="g-top"><b>Day ' +
        d.n +
        "</b>" +
        (dt ? " · " + esc(dt) : "") +
        (d.n === tn ? ' <span class="g-now">Today</span>' : "") +
        "</span>" +
        bars +
        '<span class="g-main">' +
        (hl ? esc(hl) : '<span class="muted">' + esc(d.city) + "</span>") +
        "</span></button>"
      );
    }
    /* one card per place you stay, in order, its days inside */
    /* "Check my plan" comes with the second script */
    var rev = W.reviewBlock ? W.reviewBlock(P) : (W.needLater(), "");
    return (
      rev +
      P.stops
        .map(function (s, si) {
          var ds = P.days.filter(function (d) {
              return d.stop === si;
            }),
            r = W.stopRange(P, si),
            n = s.days;
          var trips = (s.trips || [])
            .filter(function (t) {
              return t.planned !== false;
            })
            .map(function (t) {
              return t.name;
            });
          /* each place you stay opens with its photo, its name over it */
          var hero = W.cityPhoto
            ? W.cityPhoto(
                s.country,
                s.name,
                ds.reduce(function (a, d) {
                  return a.concat(
                    (d.slots || [])
                      .filter(function (x) {
                        return x.item && !W.isFood(x.slot);
                      })
                      .map(function (x) {
                        return x.item;
                      })
                  );
                }, [])
              )
            : null;
          return (
            '<section class="g-sec" data-stop="' +
            si +
            '"><h3 class="g-stop' +
            (hero ? " has-hero" : "") +
            '">' +
            (hero ? W.heroImg(hero, s.name, si > 0) : "") +
            '<span class="g-sn">' +
            esc(s.name) +
            '</span><span class="g-sm">' +
            esc(
              [r, W.nightsText(P, si), trips.length ? "day trip" + (trips.length > 1 ? "s" : "") + " to " + trips.join(", ") : ""]
                .filter(Boolean)
                .join(" · ")
            ) +
            "</span></h3>" +
            '<div class="glance sk" role="list">' +
            ds.map(row).join("") +
            "</div></section>"
          );
        })
        .join("") +
      '<p class="g-end">' +
      esc(
        "End of the trip" +
          (P.ap && P.days.length && W.dateOf(P.N)
            ? " · home from " + P.stops[P.stops.length - 1].name + " " + fmt(W.dateOf(P.N), { month: "short", day: "numeric" })
            : "")
      ) +
      "</p>"
    );
  };
})();
