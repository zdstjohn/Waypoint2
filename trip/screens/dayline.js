/* Waypoint: a day in a line (second script): what the day is (W.dayHeadline) and how full it is (W.dayBars), for the
   desktop rail's day list (screens/rail.js) and the Ctrl/Cmd+K palette (screens/palette.js). Until v154 these were
   part of All days, which is gone: the day row on a phone and the rail on a desktop are the way between days. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
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
      E = T && W.dayEnergy ? W.dayEnergy(d, P, T) : null,
      lv = E ? E.level : 0;
    return E
      ? '<span class="energy lv' +
          E.level +
          '" title="' +
          esc(E.label) +
          ' day"><span class="bars">' +
          [1, 2, 3, 4]
            .map(function (i) {
              return "<i" + (i <= lv ? ' class="on"' : "") + "></i>";
            })
            .join("") +
          "</span></span>"
      : "";
  };
})();
