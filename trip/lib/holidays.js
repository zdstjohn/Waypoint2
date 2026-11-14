/* Waypoint holidays: the public holidays on each trip day and the festivals around it.
   National holidays are worked out here for the countries the app knows best: fixed dates, Easter and Orthodox Easter,
   "the first Monday of May" kinds, Japan's equinoxes and substitute days. Regional holidays (a city's patron saint, an
   autonomous community's day), national ones for other countries, and festivals come from Claude for each city and the
   trip's dates (lib/core.js W.loadEvents), and say so.
   What they change: on a public holiday a place that closes on Sundays is planned as closed (in the countries where that
   holds; in Japan, Thailand and the US sights mostly open as usual), the day says what the holiday is, and a big one
   (Christmas, Easter, Ferragosto…) asks you to check a sight's hours. A festival only adds a line: crowds, closed
   streets, book ahead, or something worth seeing. */
(function () {
  "use strict";
  var W = window.W;
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function ymd(y, m, d) {
    var x = new Date(y, m - 1, d, 12);
    return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
  }
  function addDays(iso, n) {
    var x = new Date(iso + "T12:00:00");
    x.setDate(x.getDate() + n);
    return ymd(x.getFullYear(), x.getMonth() + 1, x.getDate());
  }
  function dow(iso) {
    return new Date(iso + "T12:00:00").getDay();
  }

  /* Easter Sunday (Gregorian; the anonymous algorithm) and Orthodox Easter (Julian, moved to the Gregorian calendar) */
  W.easter = function (y) {
    var a = y % 19,
      b = Math.floor(y / 100),
      c = y % 100,
      d = Math.floor(b / 4),
      e = b % 4,
      f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4),
      k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451);
    return ymd(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
  };
  W.orthodoxEaster = function (y) {
    var a = y % 4,
      b = y % 7,
      c = y % 19,
      d = (19 * c + 15) % 30,
      e = (2 * a + 4 * b - d + 34) % 7;
    return addDays(ymd(y, Math.floor((d + e + 114) / 31), ((d + e + 114) % 31) + 1), 13); /* 13 days between the calendars, 1900–2099 */
  };
  /* the n-th weekday (0 = Sunday) of a month; n = -1 is the last one */
  function nth(y, m, wd, n) {
    if (n > 0) {
      var off = (wd - new Date(y, m - 1, 1, 12).getDay() + 7) % 7;
      return ymd(y, m, 1 + off + (n - 1) * 7);
    }
    var last = new Date(y, m, 0, 12);
    return ymd(y, m, last.getDate() - ((last.getDay() - wd + 7) % 7));
  }
  /* Japan's equinox days (valid 1980–2099) */
  function equinox(y, autumn) {
    return ymd(y, autumn ? 9 : 3, Math.floor((autumn ? 23.2488 : 20.8431) + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)));
  }

  /* each country: [rule, name, big, custom]. custom = 1 for a day widely taken off that isn't a legal holiday. A rule is "MM-DD"; "E±n" days from Easter, "O±n" from Orthodox Easter; "n:M:WD:N" the
     N-th weekday WD of month M (N = -1, the last); or a named one below. big = 2 when most shops and many sights shut.
     sunday: whether a place that closes on Sundays is closed on a public holiday too (true for most of Europe and Latin
     America; in Japan, Thailand and the US sights mostly open as usual). */
  var NAT = {
    "Spain": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["01-06", "Three Kings' Day (Epifanía)", 1],
        ["E-3", "Maundy Thursday (Jueves Santo; most regions)", 1],
        ["E-2", "Good Friday (Viernes Santo)", 2],
        ["05-01", "Labour Day", 1],
        ["08-15", "Assumption Day", 1],
        ["10-12", "National Day of Spain (Fiesta Nacional)", 1],
        ["11-01", "All Saints' Day", 1],
        ["12-06", "Constitution Day", 1],
        ["12-08", "Immaculate Conception", 1],
        ["12-25", "Christmas Day", 2]
      ]
    },
    "Italy": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day (Capodanno)", 2],
        ["01-06", "Epiphany (Epifania)", 1],
        ["E+0", "Easter Sunday (Pasqua)", 2],
        ["E+1", "Easter Monday (Pasquetta)", 1],
        ["04-25", "Liberation Day", 1],
        ["05-01", "Labour Day", 1],
        ["06-02", "Republic Day", 1],
        ["08-15", "Ferragosto", 2],
        ["11-01", "All Saints' Day", 1],
        ["12-08", "Immaculate Conception", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "St Stephen's Day", 1]
      ]
    },
    "Greece": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["01-06", "Epiphany (Theophany)", 1],
        ["O-48", "Clean Monday (Kathara Deftera)", 1],
        ["03-25", "Independence Day", 1],
        ["O-2", "Orthodox Good Friday", 2],
        ["O+0", "Orthodox Easter Sunday", 2],
        ["O+1", "Orthodox Easter Monday", 1],
        ["05-01", "Labour Day", 1],
        ["O+50", "Whit Monday (Agiou Pnevmatos)", 1],
        ["08-15", "Dormition of the Virgin (Assumption)", 2],
        ["10-28", "Ochi Day", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "Synaxis of the Virgin", 1]
      ]
    },
    "France": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E+1", "Easter Monday", 1],
        ["05-01", "Labour Day (Fête du Travail)", 2],
        ["05-08", "Victory in Europe Day", 1],
        ["E+39", "Ascension Day", 1],
        ["E+50", "Whit Monday", 1],
        ["07-14", "Bastille Day (Fête nationale)", 1],
        ["08-15", "Assumption Day", 1],
        ["11-01", "All Saints' Day", 1],
        ["11-11", "Armistice Day", 1],
        ["12-25", "Christmas Day", 2]
      ]
    },
    "Portugal": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E-2", "Good Friday", 1],
        ["E+0", "Easter Sunday", 1],
        ["04-25", "Freedom Day", 1],
        ["05-01", "Labour Day", 1],
        ["E+60", "Corpus Christi", 1],
        ["06-10", "Portugal Day", 1],
        ["08-15", "Assumption Day", 1],
        ["10-05", "Republic Day", 1],
        ["11-01", "All Saints' Day", 1],
        ["12-01", "Restoration of Independence", 1],
        ["12-08", "Immaculate Conception", 1],
        ["12-25", "Christmas Day", 2]
      ]
    },
    "United Kingdom": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E-2", "Good Friday", 1],
        ["E+1", "Easter Monday", 1],
        ["n:5:1:1", "Early May bank holiday", 1],
        ["n:5:1:-1", "Spring bank holiday", 1],
        ["n:8:1:-1", "Summer bank holiday (England and Wales)", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "Boxing Day", 1]
      ]
    },
    "Ireland": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["brigid", "St Brigid's Day", 1],
        ["03-17", "St Patrick's Day", 1],
        ["E+1", "Easter Monday", 1],
        ["n:5:1:1", "May bank holiday", 1],
        ["n:6:1:1", "June bank holiday", 1],
        ["n:8:1:1", "August bank holiday", 1],
        ["n:10:1:-1", "October bank holiday", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "St Stephen's Day", 1]
      ]
    },
    "Germany": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E-2", "Good Friday", 2],
        ["E+1", "Easter Monday", 1],
        ["05-01", "Labour Day", 1],
        ["E+39", "Ascension Day", 1],
        ["E+50", "Whit Monday", 1],
        ["10-03", "German Unity Day", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "Boxing Day", 1]
      ]
    },
    "Austria": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["01-06", "Epiphany", 1],
        ["E+1", "Easter Monday", 1],
        ["05-01", "Labour Day", 1],
        ["E+39", "Ascension Day", 1],
        ["E+50", "Whit Monday", 1],
        ["E+60", "Corpus Christi", 1],
        ["08-15", "Assumption Day", 1],
        ["10-26", "National Day", 1],
        ["11-01", "All Saints' Day", 1],
        ["12-08", "Immaculate Conception", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "St Stephen's Day", 1]
      ]
    },
    "Netherlands": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E+0", "Easter Sunday", 1],
        ["E+1", "Easter Monday", 1],
        ["kingsday", "King's Day", 1],
        ["E+39", "Ascension Day", 1],
        ["E+49", "Whit Sunday", 1],
        ["E+50", "Whit Monday", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "Boxing Day", 1]
      ]
    },
    "Croatia": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["01-06", "Epiphany", 1],
        ["E+0", "Easter Sunday", 2],
        ["E+1", "Easter Monday", 1],
        ["05-01", "Labour Day", 1],
        ["05-30", "Statehood Day", 1],
        ["E+60", "Corpus Christi", 1],
        ["06-22", "Anti-Fascist Struggle Day", 1],
        ["08-05", "Victory Day", 1],
        ["08-15", "Assumption Day", 1],
        ["11-01", "All Saints' Day", 1],
        ["11-18", "Remembrance Day", 1],
        ["12-25", "Christmas Day", 2],
        ["12-26", "St Stephen's Day", 1]
      ]
    },
    "Iceland": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E-3", "Maundy Thursday", 1],
        ["E-2", "Good Friday", 1],
        ["E+0", "Easter Sunday", 2],
        ["E+1", "Easter Monday", 1],
        ["summer", "First Day of Summer", 1],
        ["05-01", "Labour Day", 1],
        ["E+39", "Ascension Day", 1],
        ["E+49", "Whit Sunday", 1],
        ["E+50", "Whit Monday", 1],
        ["06-17", "National Day", 1],
        ["n:8:1:1", "Commerce Day", 1],
        ["12-24", "Christmas Eve (from noon)", 2],
        ["12-25", "Christmas Day", 2],
        ["12-26", "Boxing Day", 1],
        ["12-31", "New Year's Eve (from noon)", 1]
      ]
    },
    "Mexico": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["n:2:1:1", "Constitution Day", 1],
        ["n:3:1:3", "Benito Juárez's Birthday", 1],
        ["E-3", "Holy Thursday (widely kept)", 1],
        ["E-2", "Good Friday (widely kept)", 1],
        ["05-01", "Labour Day", 1],
        ["09-16", "Independence Day", 1],
        ["n:11:1:3", "Revolution Day", 1],
        ["12-12", "Day of the Virgin of Guadalupe (widely kept)", 1],
        ["12-25", "Christmas Day", 2]
      ]
    },
    "Costa Rica": {
      sunday: true,
      list: [
        ["01-01", "New Year's Day", 2],
        ["E-3", "Holy Thursday", 2],
        ["E-2", "Good Friday", 2],
        ["04-11", "Juan Santamaría Day", 1],
        ["05-01", "Labour Day", 1],
        ["07-25", "Guanacaste Day", 1],
        ["08-02", "Our Lady of the Angels", 1],
        ["08-15", "Mother's Day", 1],
        ["09-15", "Independence Day", 1],
        ["12-25", "Christmas Day", 2]
      ]
    },
    "Japan": {
      sunday: false,
      sub: "jp",
      list: [
        ["01-01", "New Year's Day", 2],
        ["01-02", "New Year holidays", 1, 1],
        ["01-03", "New Year holidays", 1, 1],
        ["n:1:1:2", "Coming of Age Day", 1],
        ["02-11", "National Foundation Day", 1],
        ["02-23", "Emperor's Birthday", 1],
        ["eqv", "Vernal Equinox Day", 1],
        ["04-29", "Shōwa Day", 1],
        ["05-03", "Constitution Day", 1],
        ["05-04", "Greenery Day", 1],
        ["05-05", "Children's Day", 1],
        ["n:7:1:3", "Marine Day", 1],
        ["08-11", "Mountain Day", 1],
        ["n:9:1:3", "Respect for the Aged Day", 1],
        ["eqa", "Autumnal Equinox Day", 1],
        ["n:10:1:2", "Sports Day", 1],
        ["11-03", "Culture Day", 1],
        ["11-23", "Labour Thanksgiving Day", 1]
      ]
    },
    "Thailand": {
      sunday: false,
      list: [
        ["01-01", "New Year's Day", 1],
        ["04-06", "Chakri Day", 1],
        ["04-13", "Songkran (Thai New Year)", 2],
        ["04-14", "Songkran (Thai New Year)", 2],
        ["04-15", "Songkran (Thai New Year)", 2],
        ["05-01", "Labour Day", 1],
        ["05-04", "Coronation Day", 1],
        ["06-03", "Queen's Birthday", 1],
        ["07-28", "King's Birthday", 1],
        ["08-12", "Queen Mother's Birthday (Mother's Day)", 1],
        ["10-13", "King Bhumibol Memorial Day", 1],
        ["10-23", "Chulalongkorn Day", 1],
        ["12-05", "Father's Day", 1],
        ["12-10", "Constitution Day", 1],
        ["12-31", "New Year's Eve", 1]
      ]
    },
    "United States": {
      sunday: false,
      list: [
        ["01-01", "New Year's Day", 1],
        ["n:1:1:3", "Martin Luther King Jr. Day", 1],
        ["n:2:1:3", "Presidents' Day", 1],
        ["n:5:1:-1", "Memorial Day", 1],
        ["06-19", "Juneteenth", 1],
        ["07-04", "Independence Day", 1],
        ["n:9:1:1", "Labor Day", 1],
        ["n:10:1:2", "Columbus Day / Indigenous Peoples' Day", 1],
        ["11-11", "Veterans Day", 1],
        ["n:11:4:4", "Thanksgiving", 2],
        ["12-25", "Christmas Day", 2]
      ]
    }
  };
  W.holidaysKnown = function (country) {
    return !!NAT[country];
  };
  /* whether a place that shuts on Sundays shuts on this country's public holidays too */
  W.holidaySunday = function (country) {
    var c = NAT[country];
    return c ? c.sunday : true;
  };

  function dateOf(rule, y) {
    var m;
    if ((m = /^(\d\d)-(\d\d)$/.exec(rule))) return ymd(y, +m[1], +m[2]);
    if ((m = /^([EO])([+-]\d+)$/.exec(rule))) return addDays(m[1] === "E" ? W.easter(y) : W.orthodoxEaster(y), +m[2]);
    if ((m = /^n:(\d+):(\d):(-?\d)$/.exec(rule))) return nth(y, +m[1], +m[2], +m[3]);
    if (rule === "eqv" || rule === "eqa") return equinox(y, rule === "eqa");
    if (rule === "brigid") {
      var f1 = ymd(y, 2, 1);
      return dow(f1) === 5 ? f1 : nth(y, 2, 1, 1);
    } /* Feb 1 when it's a Friday, else the first Monday */
    if (rule === "kingsday") {
      var k = ymd(y, 4, 27);
      return dow(k) === 0 ? ymd(y, 4, 26) : k;
    } /* the 26th when the 27th is a Sunday */
    if (rule === "summer") {
      for (var d = 19; d <= 25; d++) if (dow(ymd(y, 4, d)) === 4) return ymd(y, 4, d);
    } /* the first Thursday after 18 April */
    return null;
  }
  var memo = {};
  function yearList(country, y) {
    var key = country + "|" + y;
    if (memo[key]) return memo[key];
    var c = NAT[country],
      out = {};
    if (c) {
      c.list.forEach(function (r) {
        var iso = dateOf(r[0], y);
        if (iso) (out[iso] = out[iso] || []).push({ n: r[1], big: r[2], src: "national", custom: !!r[3] });
      });
      /* Japan: a holiday on a Sunday moves its day off to the next day that isn't one */
      if (c.sub === "jp")
        Object.keys(out)
          .sort()
          .forEach(function (iso) {
            if (
              dow(iso) !== 0 ||
              out[iso].every(function (h) {
                return h.custom;
              })
            )
              return;
            var nx = addDays(iso, 1);
            while (out[nx]) nx = addDays(nx, 1);
            out[nx] = [{ n: "Substitute holiday (" + out[iso][0].n + ")", big: 1, src: "national" }];
          });
    }
    return (memo[key] = out);
  }
  /* the national public holidays on a date (YYYY-MM-DD), worked out here; [] for a country the app doesn't know */
  W.holidaysOn = function (country, iso) {
    if (!iso || !NAT[country]) return [];
    return (yearList(country, +iso.slice(0, 4))[iso.slice(0, 10)] || []).slice();
  };
  /* the national holiday names between two dates, for asking Claude only about the rest */
  W.holidaysBetween = function (country, from, to) {
    var out = [];
    if (!NAT[country] || !from || !to) return out;
    for (var y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
      var L = yearList(country, y);
      Object.keys(L)
        .sort()
        .forEach(function (iso) {
          if (iso >= from && iso <= to)
            L[iso].forEach(function (h) {
              out.push({ iso: iso, n: h.n, big: h.big });
            });
        });
    }
    return out;
  };

  /* a trip day: its public holidays (national, and from Claude: regional ones, or national ones for a country not above) */
  function iso(day) {
    var d = day && W.dateOf(day.n);
    return d ? W.isoDay(d) : "";
  }
  function cityEvents(day) {
    var c = W.C.events && W.C.events[W.cityKey(day.country, day.city)];
    return c && Array.isArray(c.items) ? c.items : [];
  }
  W.dayHolidays = function (day) {
    var i = iso(day);
    if (!i) return [];
    var out = W.holidaysOn(day.country, i),
      seen = {};
    out.forEach(function (h) {
      seen[W.norm(h.n)] = 1;
    });
    cityEvents(day).forEach(function (e) {
      if (e.kind !== "holiday" || i < e.from || i > e.to || seen[W.norm(e.n)]) return;
      out.push({ n: e.n, big: e.closes ? 2 : 1, src: "claude", note: e.note || "" });
    });
    return out;
  };
  /* festivals and events on a trip day (from Claude) */
  W.dayEvents = function (day) {
    var i = iso(day);
    if (!i) return [];
    return cityEvents(day).filter(function (e) {
      return e.kind !== "holiday" && i >= e.from && i <= e.to;
    });
  };
  /* is a place shut on this day's holiday? (it shuts on Sundays, in a country where holidays keep Sunday hours) */
  W.holidayShut = function (it, day, hol) {
    var h = it && it.hours;
    if (!h || !h.closed || h.closed.indexOf(0) < 0) return false;
    hol = hol || W.dayHolidays(day);
    return hol.length > 0 && W.holidaySunday(day.country);
  };
  /* the line under a day's heading: the holiday, then a festival */
  W.holidayLine = function (day) {
    var hol = W.dayHolidays(day),
      ev = W.dayEvents(day),
      out = [];
    if (hol.length) {
      var h = hol[0],
        sun = W.holidaySunday(day.country);
      out.push(
        '<p class="day-hol"><b>Public holiday: ' +
          W.esc(h.n) +
          "</b>" +
          (h.src === "claude" ? ' <span class="muted">(from Claude)</span>' : "") +
          ". " +
          W.esc(
            h.note ||
              (h.big > 1
                ? "Most shops and many sights close or keep short hours: check before you go."
                : sun
                  ? "Shops close; sights mostly keep Sunday hours."
                  : "Expect busy sights; most stay open.")
          ) +
          "</p>"
      );
    }
    ev.slice(0, 2).forEach(function (e) {
      out.push(
        '<p class="day-ev"><b>' +
          W.esc(e.n) +
          "</b> " +
          '<span class="muted">(' +
          W.esc(e.from === e.to ? fmt(e.from) : fmt(e.from) + "–" + fmt(e.to)) +
          ", from Claude)</span>" +
          (e.note ? " " + W.esc(e.note) : e.crowds ? " Busy streets and fuller restaurants: book tables ahead." : "") +
          "</p>"
      );
    });
    return out.join("");
  };
  /* ask Claude once per city about its holidays and festivals for the days you're there (only with travel dates) */
  W.eventsTick = function (P) {
    if (!W.S.start || !P || !P.stops || W.readOnly || W.isExample || !W.loadEvents) return;
    P.stops.forEach(function (st, si) {
      var ds = P.days.filter(function (d) {
        return d.stop === si;
      });
      if (!ds.length) return;
      var a = W.dateOf(ds[0].n),
        b = W.dateOf(ds[ds.length - 1].n);
      if (!a || !b) return;
      W.loadEvents(st.country, st.name, W.isoDay(a), W.isoDay(b));
    });
  };
  function fmt(iso) {
    var d = new Date(iso + "T12:00:00");
    return isNaN(d.getTime()) ? iso : W.fmtDate(d, "md");
  }
})();
