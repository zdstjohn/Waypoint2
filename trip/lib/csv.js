/* Waypoint: files out of the app (second script). One way to hand the person a file (W.saveFile: inside Claude the
   page may not start a download itself, so it asks the viewer's "downloads"; on its own site an ordinary download),
   used by the saved copy of your trips, the PDF, the offline copy and, new in v153, the itinerary as a spreadsheet
   file (W.csvExport, in the desktop rail's tools and the palette). */
(function () {
  "use strict";
  var W = window.W;
  /** offer this file to the person; resolves once it is handed over, rejects when they decline or it fails
      @param {string} filename @param {Blob} blob @returns {Promise<any>} */
  W.saveFile = function (filename, blob) {
    return (window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null)).then(function (dl) {
      if (dl) return dl.save({ filename: filename, data: blob });
      var a = document.createElement("a"),
        url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 30000);
      return { status: "saved" };
    });
  };

  /* ---------- the itinerary as CSV: one row per stop, in the order of the trip ---------- */
  /* a cell: quoted when it has a comma, a quote or a line break; a leading = + - @ gets an apostrophe, so a place
     named "=SUM(...)" is text in a spreadsheet, never a formula */
  function cell(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  var HEAD = [
    "Day",
    "Date",
    "Weekday",
    "City",
    "Start",
    "End",
    "Part of day",
    "Place",
    "Kind",
    "About",
    "Getting there",
    "Minutes on the way",
    "Booked",
    "Booking reference",
    "Latitude",
    "Longitude"
  ];
  /** the plan's rows (the header first) @param {Plan} P @returns {string[][]} */
  W.csvRows = function (P) {
    var rows = [HEAD];
    P.days.forEach(function (day) {
      var T = W.dayTimes(day, P),
        dt = W.dateOf(day.n),
        home = W.homebase(day.country, day.city),
        prev = /** @type {any} */ (home),
        city = day.trip ? day.city + " (day trip to " + day.trip.name + ")" : day.city;
      (day.slots || []).forEach(function (x) {
        var it = x.item;
        if (!it) return;
        var R = T && T.rows[x.slot],
          timed = R && !R.skip && R.start != null,
          lg = W.leg(prev, it),
          bk = W.bookingFor ? W.bookingFor(it, day) : null;
        rows.push([
          String(day.n),
          dt ? W.isoDay(dt) : "",
          dt ? dt.toLocaleDateString("en", { weekday: "short" }) : "",
          city,
          timed ? W.clock(R.start) : "",
          timed && R.end != null ? W.clock(R.end) : "",
          W.SLOT_NAME[x.slot] || x.slot,
          it.n,
          W.isFood(x.slot) ? "Meal" : "Thing to do",
          it.d || "",
          lg ? lg.label : "",
          lg ? String(Math.round(lg.min)) : "",
          bk ? "yes" : "",
          bk && bk.ref ? String(bk.ref) : "",
          it.lat != null ? String(it.lat) : "",
          it.lng != null ? String(it.lng) : ""
        ]);
        if (it.lat != null) prev = it;
      });
    });
    return rows;
  };
  /** save the itinerary as a .csv file (with a byte-order mark, so a spreadsheet reads é and ü rightly) */
  W.csvExport = function (P) {
    if (!P || !P.days || !P.days.length) return Promise.resolve(false);
    var text = W.csvRows(P)
        .map(function (r) {
          return r.map(cell).join(",");
        })
        .join("\r\n"),
      name = ((W.tripName ? W.tripName() : "Trip") || "Trip").replace(/[^\w\- ]+/g, "").trim() || "Trip";
    return W.saveFile(name + " itinerary.csv", new Blob(["﻿" + text + "\r\n"], { type: "text/csv;charset=utf-8" })).then(
      function () {
        if (W.cheer) W.cheer("Saved", name + " itinerary.csv: one row per stop, " + (W.csvRows(P).length - 1) + " rows.");
        return true;
      },
      function () {
        return false;
      }
    );
  };
})();
