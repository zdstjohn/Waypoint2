/* Waypoint times: a clock for each day (when each stop starts and ends, the nap, the journey on travel days),
   opening-hours checks, local meal times, dates and time zones. */
(function () {
  "use strict";
  var W = window.W;
  function hm(h, m) {
    return h * 60 + (m || 0);
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* when locals sit down for lunch and dinner; kitchens rarely open much earlier */
  var MEALS = {
    Spain: [hm(14), hm(21)],
    Portugal: [hm(13), hm(20)],
    Italy: [hm(13), hm(20)],
    Greece: [hm(14), hm(21)],
    Cyprus: [hm(13), hm(20, 30)],
    France: [hm(12, 30), hm(19, 30)],
    Croatia: [hm(13), hm(20)],
    Malta: [hm(12, 30), hm(20)],
    Montenegro: [hm(13), hm(20)],
    Turkey: [hm(12, 30), hm(20)],
    Argentina: [hm(13, 30), hm(21, 30)],
    Uruguay: [hm(13), hm(21)],
    Chile: [hm(13, 30), hm(21)],
    Mexico: [hm(14, 30), hm(20, 30)],
    Peru: [hm(13), hm(20)],
    Colombia: [hm(12, 30), hm(19, 30)],
    Brazil: [hm(12, 30), hm(20)],
    Lebanon: [hm(13, 30), hm(20, 30)],
    Jordan: [hm(14), hm(20, 30)]
  };
  function meals(country) {
    return MEALS[country] || [hm(12, 30), hm(19)];
  }
  W.mealsFor = meals;
  W.lateDinner = function (country) {
    return meals(country)[1] >= hm(20);
  };
  /* children eat early */
  W.kidDinner = function () {
    return W.party().kid ? hm(18, 30) : null;
  };

  /* ---------- the clock ----------
     Two readings, and the difference matters to anyone whose phone is not on the trip's time: a grandparent following
     a shared trip from home, a phone left on home time, a laptop that never changed zone.
       W.instant()  the moment it is, the same everywhere.
       W.now()      the trip's clock: a Date whose own fields (getHours, getDate…) read the time of day WHERE THE TRIP IS
                    TODAY. Everything live goes by it: which day is today, what is on now and next, when to leave,
                    "running late", the greeting. Before the trip and after it, it is the phone's own clock.
     W.tripShift() is the minutes between the two (0 when the phone is on the trip's time, as it is for travellers).
     Where the trip is today comes from the plan last made (W.P), else the first stop; its zone from tripZone().
     A test pins the clock with localStorage "waypoint-now": a time with no zone ("2027-06-09T10:30") is the trip's own
     clock, read as is; one with a zone ("…T08:30:00Z") is a moment, turned into trip time like the real clock is. */
  var pinC = /** @type {string | null | undefined} */ (undefined); /* (kept while a plan is made: a plan asks 700 times; W.timesMemo) */
  function pinned() {
    var o = pinC;
    if (o === undefined) {
      o = null;
      try {
        o = localStorage.getItem("waypoint-now");
      } catch (e) {}
      if (tmemo) pinC = o;
    }
    if (!o) return null;
    var d = new Date(o);
    return isNaN(d.getTime()) ? null : { d: d, wall: !/(Z|[+-]\d\d:?\d\d)$/.test(o) };
  }
  W.instant = function () {
    var p = pinned();
    return p ? p.d : new Date();
  };
  /* Countries with more than one time zone: the zone goes by how far east the place is (rough bands, right to within
     the hour, which the phone's own clock then settles: see tripShift). Everywhere else the country's one zone */
  var BANDS = {
    "United States": [
      [-169, "Pacific/Honolulu"],
      [-141, "America/Anchorage"],
      [-114.5, "America/Los_Angeles"],
      [-102, "America/Denver"],
      [-87, "America/Chicago"],
      [180, "America/New_York"]
    ],
    Canada: [
      [-120, "America/Vancouver"],
      [-110, "America/Edmonton"],
      [-102, "America/Regina"],
      [-90, "America/Winnipeg"],
      [-68, "America/Toronto"],
      [-57, "America/Halifax"],
      [180, "America/St_Johns"]
    ],
    Mexico: [
      [-115, "America/Tijuana"],
      [-105, "America/Mazatlan"],
      [-88, "America/Mexico_City"],
      [180, "America/Cancun"]
    ],
    Brazil: [
      [-67, "America/Rio_Branco"],
      [-57, "America/Manaus"],
      [180, "America/Sao_Paulo"]
    ],
    Australia: [
      [129, "Australia/Perth"],
      [138, "Australia/Darwin"],
      [141, "Australia/Adelaide"],
      [180, "Australia/Sydney"]
    ],
    Indonesia: [
      [114.5, "Asia/Jakarta"],
      [128, "Asia/Makassar"],
      [180, "Asia/Jayapura"]
    ]
  };
  BANDS.USA = BANDS["United States"];
  /** the time zone of a place: its country's, or for a country with several the one its longitude falls in
      @param {string} country @param {number | null} [lng] @param {number | null} [lat] @returns {{ tz: string | null, rough: boolean }} */
  W.tripZone = function (country, lng, lat) {
    var b = BANDS[country];
    if (b && lng != null) {
      /* (Hawaii lies under Alaska's longitudes: the latitude tells them apart) */
      if (b === BANDS.USA && lat != null && lat < 30 && lng < -150) return { tz: "Pacific/Honolulu", rough: true };
      for (var i = 0; i < b.length; i++) if (lng < /** @type {number} */ (b[i][0])) return { tz: String(b[i][1]), rough: true };
    }
    return { tz: W.tzFor(country), rough: !!b };
  };
  /* where the trip is on its day n: from the plan last made, else the first stop */
  function placeOn(n) {
    var P = W.P,
      d = P && P.days && P.days[n - 1],
      s = d && P.stops[d.stop];
    if (!s) {
      var c = (W.S.countries || [])[0];
      return c ? { country: c.name, lng: null, lat: null } : null;
    }
    var at = W.stopAt ? W.stopAt(s) : null;
    return { country: s.country, lng: at && at.lng != null ? at.lng : null, lat: at && at.lat != null ? at.lat : null };
  }
  var SHIFT = { key: "", v: 0 };
  W.tripShift = function () {
    var p = pinned();
    if (p && p.wall) return 0;
    var t = p ? p.d : new Date(),
      S = W.S;
    if (!S || !S.start) return 0;
    var key =
      Math.floor(t.getTime() / 60000) +
      "|" +
      S.start +
      "|" +
      (S.tripId || "") +
      "|" +
      (W.P && W.P.stops && W.P.stops[0] ? W.P.stops[0].name + W.P.N : "");
    if (SHIFT.key === key) return SHIFT.v;
    var dev = -t.getTimezoneOffset(),
      v = 0,
      first = placeOn(1);
    /* which day it is there: by the first stop's clock, then by that day's own place (a trip can cross a zone) */
    for (var pass = 0, pl = first; pass < 2 && pl; pass++) {
      var z = W.tripZone(pl.country, pl.lng, pl.lat),
        off = z.tz ? offsetMin(z.tz, t) : null;
      if (off == null) {
        v = 0;
        break;
      }
      /* a zone guessed from longitude is right to within the hour: a phone within the hour of it is there, and exact */
      v = z.rough && Math.abs(off - dev) <= 60 ? 0 : off - dev;
      var n = W.dayOfDate(W.isoDay(new Date(t.getTime() + v * 60000))),
        N = W.P && W.P.N ? W.P.N : S.days || 0;
      if (n == null || n < 1 || n > N) {
        v = 0; /* not on the trip today: the phone's own clock */
        break;
      }
      pl = placeOn(n);
    }
    SHIFT = { key: key, v: v };
    return v;
  };
  W.now = function () {
    var t = W.instant(),
      v = W.tripShift();
    return v ? new Date(t.getTime() + v * 60000) : t;
  };
  /* "Rome time", when the trip's clock is not the phone's (else "") @param {string} city */
  W.tripTimeNote = function (city) {
    return W.tripShift() ? city + " time" : "";
  };

  /* ---------- dates ---------- */
  /* The app's dates, in one style: the month is always short ("Jun 8"), the weekday short in rows ("Tue, Jun 8") and long in
     headings ("Tuesday, Jun 8"); a year only where it is needed ("Jun 8, 2027"). Everything that shows a date asks here,
     with a style: "md", "wmd" (the default), "Wmd" or "mdy". */
  var DATE_STYLES = /** @type {Record<string, Intl.DateTimeFormatOptions>} */ ({
    md: { month: "short", day: "numeric" },
    wmd: { weekday: "short", month: "short", day: "numeric" },
    Wmd: { weekday: "long", month: "short", day: "numeric" },
    mdy: { month: "short", day: "numeric", year: "numeric" }
  });
  W.fmtDate = function (/** @type {Date | null | undefined} */ d, /** @type {string | Intl.DateTimeFormatOptions} [style] */ style) {
    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, (typeof style === "string" ? DATE_STYLES[style] : style) || DATE_STYLES.wmd);
  };
  W.dateOf = function (n) {
    if (!W.S.start) return null;
    var d = new Date(W.S.start + "T12:00:00");
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + n - 1);
    return d;
  };
  W.weekday = function (n) {
    var d = W.dateOf(n);
    return d ? d.getDay() : null;
  };
  W.isoDay = function (d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  W.dayOfDate = function (iso) {
    /* which trip day a date (YYYY-MM-DD...) falls on, or null */
    if (!W.S.start || !iso) return null;
    var a = new Date(W.S.start + "T12:00:00"),
      b = new Date(String(iso).slice(0, 10) + "T12:00:00");
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((b.getTime() - a.getTime()) / 864e5) + 1;
  };
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  /* 9:30 AM or 09:30, as the device writes times */
  /* a day's page writes dozens of times: one formatter for all of them, and each minute's text is worked out once */
  var CLK = null,
    CLKS = {};
  W.clock = function (m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    if (CLKS[m]) return CLKS[m];
    try {
      CLK = CLK || new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
      return (CLKS[m] = CLK.format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60)));
    } catch (e) {
      return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
    }
  };
  /** a day and minutes from its midnight as local ISO time; past midnight is the next day (an evening journey that
   *  lands at 00:30 ends the day after it began) @param {Date} d @param {number} m */
  W.iso = function (d, m) {
    var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.floor(m / 1440));
    m = ((m % 1440) + 1440) % 1440;
    return W.isoDay(day) + "T" + pad(Math.floor(m / 60)) + ":" + pad(m % 60) + ":00";
  };
  /** the latest a stop in this part of the day may start, for this group (later, and it is left out: "No time left")
   *  @param {string} slot @param {Party} p */
  function slotCap(slot, p) {
    return {
      am: hm(16),
      lunch: hm(15),
      pm: hm(17, 30),
      dinner: p.kid ? hm(20, 30) : hm(21, 45),
      eve: p.toddler ? hm(20) : p.kid ? hm(20, 45) : hm(22, 30)
    }[slot];
  }
  W.slotCap = slotCap;

  /* ---------- time zones (for calendar events) ---------- */
  var EU = "Europe/", /* (the zone names share these starts: the first download carries this table) */
    AS = "Asia/",
    AM = "America/";
  var TZ = {
    Italy: EU + "Rome",
    Greece: EU + "Athens",
    Spain: EU + "Madrid",
    Portugal: EU + "Lisbon",
    France: EU + "Paris",
    Germany: EU + "Berlin",
    "United Kingdom": EU + "London",
    England: EU + "London",
    Scotland: EU + "London",
    Ireland: EU + "Dublin",
    Netherlands: EU + "Amsterdam",
    Belgium: EU + "Brussels",
    Switzerland: EU + "Zurich",
    Austria: EU + "Vienna",
    Croatia: EU + "Zagreb",
    Czechia: EU + "Prague",
    "Czech Republic": EU + "Prague",
    Hungary: EU + "Budapest",
    Poland: EU + "Warsaw",
    Denmark: EU + "Copenhagen",
    Sweden: EU + "Stockholm",
    Norway: EU + "Oslo",
    Finland: EU + "Helsinki",
    Iceland: "Atlantic/Reykjavik",
    Turkey: EU + "Istanbul",
    Cyprus: AS + "Nicosia",
    Malta: EU + "Malta",
    Slovenia: EU + "Ljubljana",
    Montenegro: EU + "Podgorica",
    Albania: EU + "Tirane",
    Japan: AS + "Tokyo",
    "South Korea": AS + "Seoul",
    Thailand: AS + "Bangkok",
    Vietnam: AS + "Ho_Chi_Minh",
    Singapore: AS + "Singapore",
    Morocco: "Africa/Casablanca",
    Egypt: "Africa/Cairo",
    "South Africa": "Africa/Johannesburg",
    Afghanistan: AS + "Kabul",
    India: AS + "Kolkata",
    China: AS + "Shanghai",
    Peru: AM + "Lima",
    Colombia: AM + "Bogota",
    Argentina: "America/Argentina/Buenos_Aires",
    Chile: AM + "Santiago",
    "Costa Rica": AM + "Costa_Rica",
    "New Zealand": "Pacific/Auckland",
    Israel: AS + "Jerusalem",
    Jordan: AS + "Amman",
    "United Arab Emirates": AS + "Dubai",
    Lebanon: AS + "Beirut",
    Uruguay: AM + "Montevideo"
  };
  W.tzFor = function (country) {
    var z = TZ[country] || W.C.tz[country];
    if (!z && W.loadTz) W.loadTz(country);
    return z || null;
  };

  /* ---------- jet lag ---------- */
  /* minutes a time zone is ahead of UTC on a date (one formatter per zone, kept: making one is the slow part) */
  var ZF = /** @type {Record<string, Intl.DateTimeFormat>} */ ({});
  function offsetMin(tz, date) {
    try {
      var p = {};
      (
        ZF[tz] ||
        (ZF[tz] = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hourCycle: "h23",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }))
      )
        .formatToParts(date)
        .forEach(function (x) {
          p[x.type] = x.value;
        });
      return Math.round(
        (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000
      );
    } catch (e) {
      return null;
    }
  }
  /* (the minutes a zone is ahead of UTC on a date, for the second script: sunrise and sunset, lib/gmaps.js) */
  W.tzOffsetMin = offsetMin;
  W.homeTz = function () {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {
      return null;
    }
  };
  /* the zones of the departure airports (the fifth field of each in window.AIRPORTS indexes this list): the jet lag counts
     from the airport's, which a person flying from another country's airport than the phone's may not share */
  var APZ = [AM + "Los_Angeles", AM + "Phoenix", AM + "Denver", AM + "Chicago", AM + "New_York", AM + "Mexico_City", EU + "London", EU + "Paris", AS + "Dubai", AS + "Singapore", AS + "Tokyo", "Australia/Sydney", "Pacific/Honolulu"];
  function apZone(/** @type {Airport | null} */ ap) {
    var a = ap && ap.lat != null ? (window.AIRPORTS || []).filter(function (x) { return x[1] === ap.code; })[0] : null;
    return a ? APZ[a[4]] : null;
  }
  /* how many hours the first stop is ahead of where the flight leaves from, and how many easy days that calls for. Home
     is the departure airport's zone when it is known (the phone may already be abroad, or be set to another zone); the
     phone's zone only when no departure airport with a zone is */
  W.jetlag = function (P) {
    var s = P.stops && P.stops[0];
    if (!s) return { days: 0 };
    var dest = W.tzFor(s.country),
      home = apZone(P.ap) || W.homeTz(),
      when = W.dateOf(1) || new Date(),
      gap = null;
    if (dest && home) {
      var a = offsetMin(dest, when),
        b = offsetMin(home, when);
      if (a != null && b != null) gap = Math.round((a - b) / 30) / 2;
    }
    if (gap == null && P.ap) {
      var km = W.km(P.ap, W.stopAt(s)) || 0;
      gap = km > 7000 ? 8 : km > 4000 ? 5 : 0;
    }
    var g = Math.abs(gap || 0);
    return { gap: gap || 0, days: g >= 7 ? 2 : g >= 4 ? 1 : 0, east: (gap || 0) > 0, dest: dest, home: home };
  };

  /* ---------- how tiring a day is ---------- */
  W.dayEnergy = function (day, P, T) {
    if (!T || !day.slots) return null;
    /* an hour at a calm place costs 1; a strenuous one (a gorge, a hike) costs 2; walking between stops and the journey in
       count too; a hot afternoon outdoors, and small children at anything but a beach or a park, make it all heavier */
    var home = W.homebase(day.country, day.city),
      prev = /** @type {LatLng} */ (home),
      walk = 0,
      legKm = 0 /* (of which on foot between stops: shown in the label; the planner does not lighten days for it) */,
      act = 0,
      effort = 0,
      big = 0,
      mo = (W.dateOf(day.n) || new Date()).getMonth();
    var hot = mo >= 5 && mo <= 8 && /Greece|Italy|Spain|Portugal|Turkey|Croatia|Afghanistan|Egypt|Morocco/.test(day.country);
    (T.order || []).forEach(function (sl) {
      var x = day.slots.filter(function (y) {
          return y.slot === sl;
        })[0],
        R = T.rows[sl],
        it = x && x.item;
      if (!it || !R || R.skip) return;
      var lg = W.leg(prev, it);
      if (lg && /^walk/.test(lg.mode)) {
        walk += lg.d || 0;
        legKm += lg.d || 0;
      } /* (W.leg says "walking": "walk" never matched) */
      if (!W.isFood(sl)) {
        var c = W.classify ? W.classify(it, false) : { intensity: 1, indoor: false, kind: "" },
          mins = R.end - R.start,
          w = 0.7 + c.intensity * 0.3;
        if (hot && !c.indoor && sl === "pm" && c.kind !== "beach" && c.kind !== "waterpark" && c.kind !== "lake") w += 0.3;
        if (P.p.toddler && c.intensity >= 2) w += 0.2;
        act += mins;
        effort += (mins / 60) * w;
        walk += 0.8;
        if (c.intensity >= 3 || mins >= 240) big++;
      }
      if (it.lat != null) prev = it;
    });
    var bk = W.leg(prev, home);
    if (bk && /^walk/.test(bk.mode)) {
      walk += bk.d || 0;
      legKm += bk.d || 0;
    }
    var travel = T.travel ? T.travel.end - T.travel.start : 0;
    /* grandparents along: every kilometre on foot counts for more */
    var score = effort + walk * (P.p.senior ? 0.8 : 0.5) + (travel / 60) * 1.2 + (day.fullDay ? 1 : 0) + (big > 1 ? 1.5 : 0);
    var level = score < 3.5 ? 1 : score < 6 ? 2 : score < 8.5 ? 3 : 4;
    return {
      walk: Math.round(walk * 10) / 10,
      /* the score as the planner judges it: without the walks between stops (counting them would take outings off
         days with grandparents along; the label says how tiring the day is, the plan stays as it was) */
      planScore: score - legKm * (P.p.senior ? 0.8 : 0.5),
      act: act,
      travel: travel,
      score: score,
      level: level,
      big: big,
      label: ["", "Easy", "Moderate", "Full", "Heavy"][level]
    };
  };
  /** the key of a day for everything saved against it (picks, free parts, rest days, day trips, bags): country|city|
      day in the stop, and "v2", "v3" after it for a later visit to a town the trip comes back to (the first visit
      keeps the plain key, so a saved trip's keys stay valid). W.P.days carry .visit only when the town repeats.
      @param {{country: string, city: string, dayInCity: number, visit?: number}} d */
  W.restKey = function (d) {
    return d.country + "|" + d.city + "|" + d.dayInCity + (d.visit && d.visit > 1 ? "v" + d.visit : "");
  };
  W.isRest = function (d) {
    return !!(W.S.rest || {})[W.restKey(d)];
  };

  /* ---------- durations ---------- */
  /* "1½–2 h", "45 min–1 h", "Full day" (from W.stayText) -> minutes to plan */
  var MINS = /** @type {Record<string, number | null>} */ ({}),
    nMins = 0;
  function textMin(t) {
    t = String(t || "");
    /* (kept by the text: the planner reads the same few durations over and over while it fits a trip's days) */
    if (Object.prototype.hasOwnProperty.call(MINS, t)) return MINS[t];
    if (++nMins > 2000) {
      MINS = {};
      nMins = 1;
    }
    return (MINS[t] = readMin(t));
  }
  /** @param {string} t */
  function readMin(t) {
    if (/^full day/i.test(t)) return 420;
    if (/^half day/i.test(t)) return 210;
    var parts = t.replace(/½/g, ".5").split(/[–-]/),
      unitLast = /min/.test(parts[parts.length - 1]) ? 1 : 60,
      vals = [];
    parts.forEach(function (p) {
      var v = parseFloat(p.replace(/^\s*\./, "0."));
      if (!isFinite(v)) return;
      vals.push(v * (/min/.test(p) ? 1 : /h/.test(p) ? 60 : unitLast));
    });
    if (!vals.length) return null;
    return vals.length > 1 ? (vals[0] + vals[vals.length - 1]) / 2 : vals[0];
  }
  /* how long to plan for a stop: what the data says, else what that kind of place takes; shorter with small children
     (a museum with a toddler is an hour, a beach is longer) */
  W.planMin = function (it, food, slot) {
    var c = W.classify ? W.classify(it, food) : null,
      p = W.party();
    var m = textMin(W.stayText(it, food, slot)) || (c ? c.min : food ? 60 : 90);
    if (!food && c && p.toddler && !it.dur)
      m = c.indoor
        ? Math.min(m, 75)
        : c.kind === "beach" || c.kind === "park" || c.kind === "themepark" || c.kind === "waterpark"
          ? m
          : Math.min(m, 120);
    /* (a toddler does not sit through a two-hour dinner: an hour and a quarter, which also leaves the evening its
       short outing before the latest hour a toddler's evening may start, W.slotCap) */
    return slot === "breakfast"
      ? Math.min(m, 60)
      : slot === "lunch"
        ? Math.min(m, 105)
        : slot === "dinner" && p.toddler
          ? Math.min(m, 75)
          : m;
  };
  /** a day out: a place for "any time" of day that does not say it takes under four hours (the morning carries on
      after lunch, and the day may go far from the stay) @param {any} it @param {string} [slot] */
  /** A day spent out (v193): a day trip to another town (day.trip), or a morning that takes the whole day (a full day
      out from where you stay, far or near). {name: what to call where you are (a day trip's town, the outing's place, or
      ""), far: more than about 12 km from your stay, item: the outing (none on a day trip)}; null on any other day.
      @param {Day} day */
  W.dayOut = function (day) {
    if (!day || !day.slots) return null;
    if (day.trip) return { name: day.trip.name, far: true, item: null };
    if (!day.fullDay) return null;
    var am = day.slots.filter(function (x) {
        return x.slot === "am";
      })[0],
      it = am && am.item;
    if (!it || !W.isDayOut(it, "am")) return null;
    var km = W.km(W.homebase(day.country, day.city), it);
    return { name: it.place || "", far: km != null && km > 12, item: it };
  };
  W.isDayOut = function (it, slot) {
    if (!it || it.s !== "any") return false;
    var own = textMin(W.stayText(it, false, slot || "am"));
    return !(own && own < 240);
  };
  W.parseDur = function (raw) {
    return textMin(W.durText(raw));
  };

  /* rough journey time between two places when no timetable is known yet */
  function guessLeg(d) {
    if (d == null) return 150;
    if (d < 160) return Math.max(40, Math.round((d / 70) * 60));
    if (d < 480) return Math.round((d / 110 + 0.5) * 60);
    return Math.round(W.flightHrs(d) * 60 + 150); /* a flight, with getting to and through the airport */
  }
  W.guessLeg = guessLeg;
  function at(s) {
    return s.c && s.c.lat != null ? s.c : W.homebase(s.country, s.name);
  }
  W.stopAt = at;
  /** The nights a stop has: its days, less the last day of the trip (you leave that day). One answer for All days,
      the stay bar, To book, the budget and the live prices. @param {Plan} P @param {number} si */
  W.nightsAt = function (P, si) {
    var s = P.stops[si];
    return s ? Math.max(0, s.days - (si === P.stops.length - 1 ? 1 : 0)) : 0;
  };
  /** "4 nights", "1 night", or for a last stop of one day, "the last day" @param {Plan} P @param {number} si */
  W.nightsText = function (P, si) {
    var n = W.nightsAt(P, si);
    return n ? n + " night" + (n === 1 ? "" : "s") : "the last day";
  };
  /* the journey into a stop on its first day: the best option Claude found, or a rough guess */
  W.legSig = function (o) {
    return W.norm(o.mode + " " + (o.op || "") + " " + (o.from || ""));
  };
  W.legFor = function (P, si) {
    if (!si) return null;
    var a = P.stops[si - 1],
      b = P.stops[si],
      key = W.legKey(a, b),
      lg = W.C.legs[key];
    /* the way you chose to go (Claude's best unless you picked another) */
    var pick = (W.S.legPick || {})[key],
      opts = (lg && lg.opts) || [];
    var i = opts.findIndex(function (o) {
      return W.legSig(o) === pick;
    });
    if (i < 0) i = W.pickLeg ? W.pickLeg(opts, P.p || W.party()) : 0; /* no choice made: the best way for this group */
    var o = opts[i],
      km = W.km(at(a), at(b));
    var mins = o && W.parseDur(o.dur);
    /* Rome2Rio's measured journey for the same way of going beats the estimate */
    var rr = o && lg && lg.r2r ? W.r2rFor(lg.r2r.routes, o.mode) : null;
    if (rr) mins = rr.min;
    return {
      a: a,
      b: b,
      key: key,
      opts: lg ? lg.opts : null,
      best: o || null,
      pick: i,
      min: mins || guessLeg(km),
      km: km,
      guessed: !mins,
      r2r: rr || null
    };
  };
  /* which Rome2Rio route is this way of going ("Fly to Seville Airport" is a flight; "Train, ferry" is mainly a train) */
  function r2rMode(name) {
    var n = String(name || "")
      .toLowerCase()
      .split(",")[0];
    return /\bfly\b|flight|plane|airport/.test(n)
      ? "flight"
      : /ferry|boat|hydrofoil|catamaran/.test(n)
        ? "ferry"
        : /train|rail|metro|tram/.test(n)
          ? "train"
          : /bus|coach|shuttle/.test(n)
            ? "bus"
            : /drive|car|taxi/.test(n)
              ? "car"
              : "";
  }
  W.r2rFor = function (routes, mode) {
    var m = String(mode || "").toLowerCase(),
      want = /flight|plane|fly/.test(m)
        ? "flight"
        : /ferry|boat/.test(m)
          ? "ferry"
          : /train|rail/.test(m)
            ? "train"
            : /bus|coach/.test(m)
              ? "bus"
              : /car|drive/.test(m)
                ? "car"
                : "";
    return want
      ? (routes || []).filter(function (r) {
          return r2rMode(r.name) === want;
        })[0] || null
      : null;
  };

  function up15(m) {
    return Math.ceil(m / 15) * 15;
  }
  var DFLT = { breakfast: 40, am: 150, lunch: 70, pm: 150, dinner: 80, eve: 60 };

  /* The planner asks for the same day's clock about 18 times (each trial of a place for a slot, each check after it), most
     of them with the slots as they were a moment ago, and it was half of the time a plan took. While one plan is being
     made (W.timesMemo, called by W.plan) a day's answer is kept as long as nothing it is made from has changed: the plan
     it is for, the day (where it goes, jet lag), and each slot's name and place. Nothing else the clock reads (the
     facts about places, the running-late minutes, the legs) changes while a plan is being made. Never kept past the
     plan: a change anywhere between plans may be in any of them. The answer is shared, so a caller must not change it. */
  var tmemo = /** @type {Map<any, any[] & { out?: any }> | null} */ (null);
  /** @param {boolean} on a plan is being made (true) or is done (false) */
  W.timesMemo = function (on) {
    tmemo = on ? new Map() : null;
    pinC = undefined;
  };
  W.dayTimesRuns = 0; /* (how many times a day was worked out: a test counts them) */
  /* the day on a clock. Returns { rows: {slot: {start, end, warn:[], info:[]}}, nap, travel, back } or null */
  W.dayTimes = function (day, P) {
    if (!day || !day.slots || !day.slots.length) return null;
    if (!tmemo) return timesNow(day, P);
    var m = /** @type {any} */ (tmemo.get(day)),
      g = /** @type {any[] & { out?: any }} */ ([P, day.stop, day.jet, day.moveFrom, day.n]);
    day.slots.forEach(function (/** @type {any} */ x) {
      g.push(x.slot, x.item);
    });
    if (
      m &&
      m.length === g.length &&
      g.every(function (v, i) {
        return v === m[i];
      })
    )
      return m.out;
    tmemo.set(day, g);
    return (g.out = timesNow(day, P));
  };
  function timesNow(day, P) {
    W.dayTimesRuns++;
    var p = P.p,
      home = W.homebase(day.country, day.city),
      M = meals(day.country),
      wd = W.weekday(day.n);
    var kd = W.kidDinner(),
      out = { rows: {}, wd: wd, notes: [] },
      hol = W.dayHolidays ? W.dayHolidays(day) : [];
    out.hol = hol;
    var t = p.kid ? hm(8) : hm(8, 30),
      prev = home;
    /* travel days: the journey comes first; you drop your bags at the new place and set off from there */
    /* (with a booked ticket that has a time: you leave in time for it, a flight's check-in included, and the day picks up
       from its arrival; a late departure leaves the morning free in the town you're leaving) */
    if (day.moveFrom && day.stop > 0) {
      var L = W.legFor(P, day.stop),
        s0 = hm(9, 30),
        tk = W.legTicket ? W.legTicket(P, day.stop) : null;
      if (tk) {
        var lead = { flight: 150, ferry: 75, train: 45, bus: 40 }[tk.kind] || 45,
          after = { flight: 60, ferry: 40, train: 30, bus: 30 }[tk.kind] || 40;
        var arr = tk.arr != null ? tk.arr : tk.dep + L.min;
        out.travel = {
          start: Math.max(hm(5), tk.dep - lead),
          end: up15(arr + after),
          leg: L,
          ticket: tk,
          dep: tk.dep,
          arr: arr,
          zone: !!tk.zone
        };
        if (out.travel.start - hm(9) >= 90) out.before = { start: hm(9), end: out.travel.start - 15, city: day.moveFrom };
      } else out.travel = { start: s0, end: up15(s0 + L.min + 40), leg: L };
      t = out.travel.end + 20;
    }
    function minStart(slot) {
      if (slot === "breakfast") return p.kid ? hm(8) : hm(8, 30);
      if (slot === "lunch") return p.kid ? Math.max(hm(12), M[0] - 60) : M[0];
      if (slot === "dinner") return day.jet ? Math.min(kd || M[1], hm(18, 30)) : kd || M[1];
      return 0;
    }
    /* arriving around lunchtime: lunch first, then the first thing to see */
    var order = day.slots.slice();
    if (out.travel && t >= Math.min(minStart("lunch") - 30, hm(11, 30))) {
      /* landing late morning or later: eat first */
      var li = order.findIndex(function (x) {
          return x.slot === "lunch";
        }),
        ai = order.findIndex(function (x) {
          return x.slot === "am";
        });
      if (li > ai && ai > -1) {
        var L2 = order.splice(li, 1)[0];
        order.splice(ai, 0, L2);
        out.moved = true;
      }
    }
    out.order = order.map(function (x) {
      return x.slot;
    });
    var EVE_CAP = slotCap("eve", p);
    order.forEach(function (x) {
      doRow(x);
      /* toddlers: after lunch, a nap or rest back at your lodging (whatever lunch was) */
      if (x.slot === "lunch" && p.toddler && !(out.rows.lunch && out.rows.lunch.skip)) {
        if (W.dayOut(day)) {
          /* out for the day (a day trip, or a morning that takes the whole day: v193, it used to send you back to the
             hotel for a nap from 34 km away): a nap in the stroller or the car */
          var na = up15(t + 10);
          if (na <= hm(16)) {
            out.nap = { start: na, end: na + 60, away: true };
            t = out.nap.end;
            lastFree = null; /* (the afternoon starts after the nap, also when lunch was free time) */
          }
        } else {
          var bk = W.leg(prev, home),
            ns = up15(t + (bk ? bk.min : 15));
          if (ns <= hm(16)) {
            out.nap = { start: ns, end: ns + 90 };
            t = out.nap.end;
            prev = home;
            lastFree = null;
          } /* too late for a nap: an early night instead */
        }
      }
    });
    var lastFree = null; /* free time is elastic: it ends when the next thing needs to start, never pushes it back */
    function doRow(x) {
      var it = x.item,
        food = W.isFood(x.slot),
        row = /** @type {TimeRow} */ ({ warn: [], info: [] });
      out.rows[x.slot] = row;
      /* a note that is nice to know but not needed to run the day: shown with the rest, left out in Simple view */
      var extra = function (/** @type {string} */ t) {
        row.info.push(t);
        (row.more = row.more || []).push(t);
      };
      if (out.travel && x.slot === "am") row.label = "After you arrive";
      if (x.slot === "breakfast" && out.travel && out.travel.end > hm(10, 30)) {
        var bs = out.before ? (p.kid ? hm(8) : hm(8, 30)) : out.travel.start - 50;
        row.skip = true;
        row.start = bs;
        row.end = out.before ? bs + 40 : out.travel.start - 15;
        /* (a ticket that leaves later in the day: breakfast is simply breakfast in the town you're leaving) */
        row.info.push(out.before ? "Breakfast in " + day.moveFrom : "Travel morning: have breakfast before you set off");
        return;
      }
      /* the latest a slot can still start; a long journey that lands after it leaves that meal or outing out */
      var capF = slotCap(x.slot, p);
      /* a ticket that leaves after lunchtime: lunch is in the town you're leaving, before you set off */
      if (x.slot === "lunch" && out.travel && out.travel.dep != null && out.travel.start >= hm(12, 45)) {
        row.skip = true;
        row.start = Math.max(hm(12), out.travel.start - 75);
        row.end = out.travel.start - 15;
        row.info.push("Lunch in " + day.moveFrom + " before you set off");
        return;
      }
      /* arriving after about two: lunch is on the way (a sit-down lunch at three is not lunch) */
      if (x.slot === "lunch" && out.travel && out.travel.end >= hm(14)) {
        row.skip = true;
        row.start = out.travel.start + 180;
        row.info.push("Travel day: lunch on the way");
        return;
      }
      /* a ticket that leaves in the evening (a night boat, a late train): dinner is in the town you're leaving too */
      if (x.slot === "dinner" && out.travel && out.travel.dep != null && out.travel.start >= hm(19, 15)) {
        row.skip = true;
        row.start = Math.max(hm(17, 30), Math.min(kd || M[1], out.travel.start - 90));
        row.end = Math.min(row.start + 75, out.travel.start - 15);
        row.info.push("Dinner in " + day.moveFrom + " before you set off");
        return;
      }
      /* landing late in the evening: eat on the way or after you land, nothing is planned */
      if (x.slot === "dinner" && out.travel && out.travel.end + 30 > capF) {
        row.skip = true;
        row.start = Math.min(out.travel.end, hm(21));
        row.info.push("Travel day: dinner on the way or after you land");
        return;
      }
      if (!it) {
        row.free = true;
        row.start = up15(Math.max(t, minStart(x.slot)));
        if (capF && row.start > capF) {
          row.skip = true;
          return;
        } /* no free evening at 10 pm */
        /* free time ends in time for the next meal (a free afternoon never pushes the children's dinner back) */
        var nextMeal = x.slot === "am" ? minStart("lunch") : x.slot === "pm" ? minStart("dinner") : null;
        row.end = nextMeal && nextMeal - 15 > row.start ? Math.min(row.start + DFLT[x.slot], nextMeal - 15) : row.start + DFLT[x.slot];
        t = row.end;
        lastFree = row;
        return;
      }
      var lg = W.leg(prev, it),
        way = lg ? lg.min : 10,
        start = up15(Math.max(t + way, minStart(x.slot))),
        h = W.hoursFor(it, wd);
      /* after free time, the next thing starts when it should (at least 45 minutes of free time first); the free row shrinks to fit */
      if (lastFree) {
        start = up15(Math.max(Math.min(t, lastFree.start + 45) + way, minStart(x.slot)));
        lastFree.end = Math.max(lastFree.start + 30, start - way);
        lastFree = null;
      }
      var dur = W.planMin(it, food, x.slot);
      /* a long journey or a nap can leave no room: say so rather than send you out at midnight */
      var cap = capF;
      if (x.slot === "eve" && p.kid) dur = Math.min(dur, 75); /* a short evening out with children */
      if (cap && start > cap) {
        row.skip = true;
        row.late = true;
        row.start = start;
        row.info.push(
          out.travel
            ? "No time for this today with the journey: swap it or save it for another day"
            : "No time left for this today: swap it or save it for another day"
        );
        return;
      }
      var shut = W.shutOn(it, day.n);
      if (shut) row.warn.push(W.shutText(shut)); /* shut for a stretch that takes in this day (the nightly check) */
      if (h) {
        if (wd != null && h.closed.indexOf(wd) > -1) row.warn.push("Closed on " + WEEKDAYS[wd] + "s");
        else if (hol.length && W.holidayShut && W.holidayShut(it, day, hol)) row.warn.push("Closed for " + hol[0].n);
        if (h.o > start && h.o < 1440) {
          if (h.o - start <= 120) {
            start = up15(h.o);
            row.info.push("Opens " + W.clock(h.o));
          } else row.warn.push("Not open until " + W.clock(h.o));
        }
      }
      /* (waiting for the doors can take the start past this group's latest hour: an open-air cinema at 8:30 pm with a toddler) */
      if (cap && start > cap) {
        row.skip = true;
        row.late = true;
        row.start = start;
        row.info.push("No time left for this today: swap it or save it for another day");
        return;
      }
      /* a day trip fills the morning and carries on after lunch */
      /* (a place that says how long it takes, under four hours, is not a day out, whatever its slot says) */
      var dayOut = W.isDayOut(it, x.slot);
      if (dayOut && x.slot === "am") {
        dur = Math.max(150, minStart("lunch") - start);
        row.info.push("Day trip: carries on after lunch");
      }
      /* the next meal sets when to leave: with children, dinner doesn't wait for a long afternoon */
      /* (a half hour's slack on an ordinary day; on a jet-lag day dinner is early and nothing pushes it) */
      var meal = x.slot === "am" ? minStart("lunch") : x.slot === "pm" ? minStart("dinner") : null,
        slack = day.jet && x.slot === "pm" ? 0 : 30;
      if (meal && !dayOut) {
        /* the way to the meal itself: the next slot's place when it is known, else a quarter hour */
        /* (measured from where you'll set off for it: this place, or the last one with a pin if this one has none) */
        var nx = order.filter(function (y) {
            return y.slot === (x.slot === "am" ? "lunch" : "dinner");
          })[0],
          nl = nx && nx.item ? W.leg(it.lat != null ? it : prev, nx.item) : null,
          way = nl ? Math.max(5, nl.min) : 15;
        /* (with children an afternoon can be as short as half an hour: a late arrival's quick look beats a late dinner) */
        if (start + dur > meal - way + slack && meal - way - start >= (day.jet || (p.kid && x.slot === "pm") ? 30 : 45)) {
          dur = meal - way - start;
          row.info.push("Leave by " + W.clock(start + dur) + " for " + (x.slot === "am" ? "lunch" : "dinner"));
        }
      }
      if (h && h.c < 1440 * 2 && !(h.o === 0 && h.c >= 1440)) {
        if (h.c <= start + 20) row.warn.push("Closes " + W.clock(h.c) + ", before you'd get there");
        else if (h.c < start + dur - 15)
          row.warn.push("Closes " + W.clock(h.c) + ": about " + W.fmtMin(Math.round((h.c - start) / 15) * 15) + " there");
      }
      if (x.slot === "dinner" && kd) {
        if (h && h.o > kd + 30) row.warn.push("Kitchen opens " + W.clock(h.o) + ": late for kids");
        else if (W.lateDinner(day.country))
          extra("Locals eat around " + W.clock(M[1]) + ". Going at opening means a calmer, kid-friendly table");
      }
      /* the group's food needs: what this place offers them, and allergies to mention */
      if (food && W.eatNeeds) {
        var en = W.eatNeeds(),
          ef = W.eatFit(it),
          ew = W.eatWhy(it);
        if (ef === "poor") row.warn.push("Hard for your food needs" + (ew ? ": " + ew : ""));
        else if (ew) extra(ew);
        if (en && en.al.length)
          row.info.push(
            "Tell the staff: " +
              en.al
                .map(function (k) {
                  var a = W.EAT_AL.filter(function (y) {
                    return y[0] === k;
                  })[0];
                  return a ? a[1].replace(/ \(.*\)$/, "").toLowerCase() : k;
                })
                .join(", ") +
              " allergy"
          );
      }
      if (!food && W.needsBooking(it))
        row.info.push("Timed entry: book the " + W.clock(start) + " slot" + (p.toddler && x.slot === "pm" ? ", after the nap" : ""));
      row.start = start;
      row.end = start + Math.round(dur);
      t = row.end;
      if (it.lat != null) prev = it;
    }
    var back = W.leg(prev, home);
    out.back = Math.round((t + (back ? back.min : 0)) / 5) * 5;
    if (W.lateShift) W.lateShift(day, out); /* running late today: the rest of the day moves back */
    return out;
  }

  /** a place's hours on a weekday: the world library's weekly hours where it has them (it.wk, lib/world.js), else the
      one pair every list carries @param {any} it @param {number | null | undefined} wd */
  W.hoursFor = function (it, wd) {
    var h = it && it.hours;
    if (!h || !it.wk || wd == null || it.wk.length !== 7) return h;
    var x = it.wk[wd];
    return x ? { o: x[0], c: x[1], closed: [] } : { o: 0, c: 0, closed: [wd] };
  };
  /* is a place shut on this trip day, or a dinner that opens too late for children? (the planner avoids these) */
  W.badForDay = function (it, wd, slot, kd, n) {
    if (W.gone(it)) return true; /* closed for good, or no such place */
    if (n != null && W.shutOn(it, n)) return true; /* shut for a stretch that takes in that day */
    var h = W.hoursFor(it, wd);
    if (!h) return false;
    if (wd != null && h.closed.indexOf(wd) > -1) return true;
    if (W.shutBy(h, slot)) return true;
    return slot === "dinner" && kd != null && h.o > kd + 30 && h.o < 1440;
  };
  /* not open in that part of the day: shut by then, or not open until much later (a dinner-only place for breakfast) */
  var WIN = {
    breakfast: [hm(10, 30), hm(9)],
    am: [hm(12, 30), hm(11)],
    lunch: [hm(14, 30), hm(13)],
    pm: [hm(17), hm(15, 30)],
    dinner: [hm(21, 30), hm(20)],
    eve: [hm(22), hm(20, 30)]
  };
  W.shutBy = function (h, slot) {
    var w = WIN[slot];
    if (!h || !w || (h.o === 0 && h.c >= 1440)) return false;
    return h.o > w[0] || h.c <= w[1];
  };
})();
