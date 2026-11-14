/* Waypoint setup view (second script): trip style, where, how long, from where, who, and where you're staying. */
(function () {
  "use strict";
  var W = window.W,
    $ = W.$,
    esc = W.esc,
    S = W.S;

  var names = [];
  /* the countries Plan offers: the 150 most visited (data/data2.js TOP_COUNTRIES, most visited first), which is also
     the order they are offered in as you type (after the ones with ideas built in) */
  var TOP = window.TOP_COUNTRIES || [],
    known = /** @type {Object<string, number>} */ ({});
  /* on its own (no Claude), only the countries with ideas built in can be planned */
  if (!W.standalone || W.cloud)
    try {
      var dn = new Intl.DisplayNames(["en"], { type: "region" });
      TOP.forEach(function (c, i) {
        var n = dn.of(c) || c;
        names.push(n);
        known[n] = 1 + (TOP.length - i) / 1000;
      });
    } catch (e) {}
  Object.keys(window.TD).forEach(function (k) {
    if (names.indexOf(k) < 0) names.push(k);
  });
  names.sort();
  /** every country Plan can take (lib/typeahead.js offers them as you type) */
  W.countryNames = function () {
    return names;
  };
  /** how well known a country is: 2 with ideas built in, about 1 for the most visited, 0 for the rest */
  W.countryRank = function (n) {
    return window.TD[n] ? 2 : known[n] || 0;
  };
  /* the lists the country and airport boxes offer (both in index.html; the airports come with the data, data/data2.js) */
  var countryList = $("countryList"),
    airportList = $("airportList");
  if (countryList)
    countryList.innerHTML = names
      .map(function (n) {
        return '<option value="' + esc(n) + '">';
      })
      .join("");
  if (airportList)
    airportList.innerHTML = (window.AIRPORTS || [])
      .map(function (a) {
        return '<option value="' + esc(a[0] + " (" + a[1] + ")") + '">';
      })
      .join("");
  /* other names people type for a country, by the name the list uses (what Intl calls it: "Czechia", "Türkiye") */
  var ALIASES = /** @type {[string, string][]} */ ([
    ["usa", "United States"],
    ["united states of america", "United States"],
    ["u s a", "United States"],
    ["u s", "United States"],
    ["us", "United States"],
    ["america", "United States"],
    ["uk", "United Kingdom"],
    ["great britain", "United Kingdom"],
    ["britain", "United Kingdom"],
    ["england", "United Kingdom"],
    ["scotland", "United Kingdom"],
    ["wales", "United Kingdom"],
    ["uae", "United Arab Emirates"],
    ["u a e", "United Arab Emirates"],
    ["emirates", "United Arab Emirates"],
    ["dubai", "United Arab Emirates"],
    ["korea", "South Korea"],
    ["republic of korea", "South Korea"],
    ["st kitts", "St. Kitts & Nevis"],
    ["saint kitts and nevis", "St. Kitts & Nevis"],
    ["st vincent", "St. Vincent & Grenadines"],
    ["saint vincent and the grenadines", "St. Vincent & Grenadines"],
    ["turks and caicos", "Turks & Caicos Islands"],
    ["us virgin islands", "U.S. Virgin Islands"],
    ["vatican", "Vatican City"],
    ["holy see", "Vatican City"],
    ["lao", "Laos"],
    ["viet nam", "Vietnam"]
  ]);
  /* a country's names as different browsers spell them (the list is the browser's own: "Türkiye" or "Turkey", "Macao SAR
     China" or "Macao"): whichever one the list has is the country's name here */
  var SAME = [
    ["Czechia", "Czech Republic"],
    ["Türkiye", "Turkey"],
    ["Myanmar (Burma)", "Myanmar", "Burma"],
    ["Hong Kong SAR China", "Hong Kong"],
    ["Macao SAR China", "Macao", "Macau"],
    ["Bosnia & Herzegovina", "Bosnia and Herzegovina", "Bosnia"],
    ["North Macedonia", "Macedonia"],
    ["Eswatini", "Swaziland"],
    ["Timor-Leste", "East Timor"],
    ["Côte d’Ivoire", "Ivory Coast"],
    ["Cape Verde", "Cabo Verde"],
    ["Netherlands", "The Netherlands", "Holland"],
    ["Bahamas", "The Bahamas"]
  ];
  /** the name the list uses for a country that goes by this name (or the name as given) @param {string} n */
  function canon(n) {
    if (names.indexOf(n) > -1) return n;
    var g = SAME.filter(function (x) {
      return x.indexOf(n) > -1;
    })[0];
    return (
      (g &&
        g.filter(function (m) {
          return names.indexOf(m) > -1;
        })[0]) ||
      n
    );
  }
  /** the other names for the countries on offer, as [what is typed, the country's name in the list] (the type-ahead
      matches them too, so "uae" and "holland" find their country) */
  W.countryAliases = function () {
    var out = /** @type {[string, string][]} */ ([]);
    ALIASES.forEach(function (a) {
      out.push([a[0], canon(a[1])]);
    });
    SAME.forEach(function (g) {
      g.forEach(function (m) {
        out.push([m, canon(m)]);
      });
    });
    return out.filter(function (a) {
      return names.indexOf(a[1]) > -1 && W.norm(a[0]) !== W.norm(a[1]);
    });
  };
  function countryName(v) {
    var k = W.norm(v);
    if (!k) return "";
    var hit = W.countryAliases().filter(function (a) {
      return W.norm(a[0]) === k;
    })[0];
    if (hit) return hit[1];
    return (
      names.filter(function (n) {
        return W.norm(n) === k;
      })[0] ||
      v.trim().replace(/\b\w/g, function (m) {
        return m.toUpperCase();
      })
    );
  }
  W.countryName = countryName;
  var openBrowse = {};
  /* a whole island typed as a place: the towns to choose between instead, by country */
  var isleAsk = {};
  /** "Crete is a whole island. Choose a town on it:" with its towns; pick = the chip's data attributes for one town */
  function isleHint(ch, pick, done) {
    return (
      '<div class="isle-ask" role="group" aria-label="Towns ' +
      (ch.group ? "in " : "on ") +
      esc(ch.isle) +
      '"><p class="small"><b>' +
      esc(ch.isle) +
      "</b> " +
      (ch.group ? "covers more than one place. Choose a town there:" : "is a whole island. Choose a town on it:") +
      '</p><div class="chips">' +
      ch.towns
        .map(function (t) {
          return '<button type="button" class="chip" ' + pick(t) + ' title="' + esc(t.d || "") + '">' + esc(t.name) + "</button>";
        })
        .join("") +
      (done || "") +
      "</div></div>"
    );
  }
  var ageLabel = function (a) {
    return a < 2 ? "Baby" : a < 5 ? "Toddler" : a < 13 ? "Child" : a < 18 ? "Teen" : a >= 65 ? "Grandparent" : "Adult";
  }; /* 65 and over: shorter days, fewer moves */

  var openStay = (W.openStay =
    W.openStay ||
    {}); /* which cities have their lodging panel open (made in lib/core.js: Trip and Today open one before this script has come) */
  var X_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  var UP_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 13V3M4 7l4-4 4 4"/></svg>';
  var BED_ICON =
    '<svg viewBox="0 0 20 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3v11M2 10h16v4M18 10V8a2 2 0 0 0-2-2H9v4"/><circle cx="5.5" cy="7.5" r="1.6"/></svg>';
  var CHEV =
    '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';

  /* one row per stop: its days, its dates and where you're staying */
  /** a stop's check-in and check-out days (lib/prices.js works them out), or {} without dates @param {Stop} s */
  function stayDatesFor(s) {
    var dt = W.stayDates ? W.stayDates(s, W.P) : null;
    return dt ? { in: dt.in, out: dt.out } : {};
  }
  function stopRow(s, i, c, ci, dayN) {
    var ck = W.cityKey(s.country, s.name),
      info = W.findCity(s.country, s.name),
      j = c.mode === "manual" ? c.picked.indexOf(s.name) : -1;
    var from = dateOf(dayN),
      to = dateOf(dayN + s.days - 1),
      hb = W.homebase(s.country, s.name),
      open = !!openStay[ck];
    var geoBusy = Object.keys(W.status).some(function (k) {
      return k.indexOf("geo|" + ck) === 0 && W.status[k] === "loading";
    });
    var sub = from ? (from === to ? from : from + " – " + to) : "",
      about = (info && info.d) || "";
    wantLodging(s, hb);
    return (
      '<div class="stop" id="stop-' +
      i +
      '"><div class="stop-h"><div class="nm">' +
      esc(s.name) +
      (sub ? "<small>" + esc(sub) + "</small>" : "") +
      "</div>" +
      '<div class="stepper sm"><button type="button" data-cdays="' +
      i +
      '" data-delta="-1" aria-label="One day less in ' +
      esc(s.name) +
      '"' +
      (s.days <= 1 ? " disabled" : "") +
      ">−</button>" +
      '<input id="cdays' +
      i +
      '" type="number" min="1" max="30" value="' +
      s.days +
      '" data-cdin="' +
      i +
      '" aria-label="Days in ' +
      esc(s.name) +
      '">' +
      '<button type="button" data-cdays="' +
      i +
      '" data-delta="1" aria-label="One more day in ' +
      esc(s.name) +
      '"' +
      (s.days >= 30 ? " disabled" : "") +
      ">+</button></div></div>" +
      (about ? '<p class="stop-d">' + esc(about) + "</p>" : "") +
      paceRow(s, i) +
      /* a stop from before islands gave way to their towns: it still works, and its towns are one tap away */
      (function () {
        var ch = W.isleChoice(s.country, s.name);
        return ch && ch.towns.length
          ? isleHint(ch, function (t) {
              return 'data-isleswap="' + i + '" data-town="' + esc(t.name) + '"';
            })
          : "";
      })() +
      '<div class="stop-a"><button type="button" class="stay-btn' +
      (hb.set ? " set" : "") +
      '" data-openstay="' +
      i +
      '" aria-expanded="' +
      open +
      '">' +
      BED_ICON +
      "<span>" +
      (geoBusy ? "Locating…" : hb.set ? "<b>" + esc(hb.label) + "</b>" : "Where to stay") +
      "</span>" +
      CHEV +
      "</button>" +
      (j > 0
        ? '<button type="button" class="icon-btn" data-up="' +
          j +
          '" data-ci="' +
          ci +
          '" aria-label="Visit ' +
          esc(s.name) +
          ' earlier">' +
          UP_ICON +
          "</button>"
        : "") +
      '<button type="button" class="icon-btn" data-rmstop="' +
      i +
      '" aria-label="Remove ' +
      esc(s.name) +
      '">' +
      X_ICON +
      "</button></div>" +
      (open ? stayPanel(s, i) : "") +
      "</div>"
    );
  }
  /* Places to stay are got ready while no stay is set: from Booking.com once a search there has worked (lib/prices.js
     W.liveLodge), else Claude's picks, asked for once per place and party. Where Booking.com may answer but has not
     been asked yet, nothing is asked until you open Where to stay. */
  function wantLodging(s, hb) {
    if (hb.set) return;
    var L = W.liveLodge ? W.liveLodge(W.cityKey(s.country, s.name), W.P, "warm") : /** @type {LiveLodge} */ ({ st: "off" });
    if (L.st === "idle" || L.st === "loading" || (L.st === "ok" && L.items && L.items.length)) return;
    claudeLodging(s);
  }
  /** @param {Stop} s */
  function claudeLodging(s) {
    if (W.sampleState === "off") return;
    var cur = W.C.city[W.cityKey(s.country, s.name)];
    if (!cur || cur.lodgeFor !== W.lodgeSig() || !cur.lodgeAsked) W.loadLodging(s.country, s.name);
  }
  /* where to stay in one place: a stay you booked already, the suggested areas and hotels, and other sites. In Plan it opens under the place's row; from any other screen it is a sheet (W.staySheet) */
  /* what "Food you love" and "Rather avoid" have done, so you can see they work: the places found for what you love
     and how many meals go to them, and how many places what you avoid keeps off the plan */
  function eatReport(P) {
    var n = W.eatNeeds && W.eatNeeds();
    if (!n || (!n.love && !n.avoid) || !P || !P.stops.length) return "";
    var love = n.love;
    var busy = Object.keys(W.status).some(function (k) {
      return /^eat(fit|love)\|/.test(k) && W.status[k] === "loading";
    });
    if (busy) return '<p class="eat-rep" role="status">Checking the places to eat in your cities for this…</p>';
    var loved = 0,
      off = 0,
      meals = 0,
      onMeals = 0;
    P.stops.forEach(function (s) {
      var c = W.C.city[W.cityKey(s.country, s.name)];
      ((c && c.food) || []).forEach(function (x) {
        if (love && W.eatLike(x) >= 2 && W.eatFit(x) !== "poor") loved++;
        if (W.eatFit(x) === "poor") off++;
      });
    });
    P.days.forEach(function (d) {
      d.slots.forEach(function (x) {
        if (!x.item || !W.isFood(x.slot)) return;
        meals++;
        if (love && W.eatLike(x.item) >= 2) onMeals++;
      });
    });
    var parts = [];
    if (n.love)
      parts.push(
        loved
          ? loved + " place" + (loved > 1 ? "s" : "") + " for " + n.love + " · " + onMeals + " of your " + meals + " meals go to them"
          : "No places for " + n.love + " found in your cities yet"
      );
    if (n.avoid)
      parts.push(
        off
          ? off + " place" + (off === 1 ? "" : "s") + " kept off your plan for what you'd rather avoid"
          : "No place in your cities has what you'd rather avoid"
      );
    return (
      '<p class="eat-rep" role="status">' +
      esc(parts.join(". ")) +
      "." +
      (!W.SAMPLE ? " (Without Claude, by the words in each place's name and description.)" : "") +
      "</p>"
    );
  }
  function stayPanel(s, i) {
    return (
      '<div class="stay-panel"><div class="row"><input class="field" id="stayIn' +
      i +
      '" placeholder="Already booked? Hotel name or address" aria-label="Already booked? Hotel name or address in ' +
      esc(s.name) +
      '" value="' +
      esc((S.stays[W.cityKey(s.country, s.name)] || {}).label || "") +
      '"><button type="button" class="btn quiet" data-setstay="' +
      i +
      '" aria-label="Set as our stay in ' +
      esc(s.name) +
      '">Set</button></div>' +
      lodgeCards(s, i) +
      "</div>"
    );
  }

  /* ---------- pick a stay without leaving the screen you are on ----------
     "Pick a place" on Today, in Prepare and on the Trip tab opens the same panel as a sheet over that screen; picking
     one (or ×, Escape, a tap beside it, Back) closes it and you are where you were. */
  /** @type {number | null} */ var staySi = null,
    stayDrawn = "",
    stayWas = "";
  var X16 =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  function fmtIso(iso) {
    var d = new Date(iso + "T12:00:00");
    return isNaN(d.getTime()) ? iso : W.fmtDate(d, "md");
  }
  function stayLabel(s) {
    return ((S.stays[W.cityKey(s.country, s.name)] || {}).label || "") + "";
  }
  function drawStay() {
    var host = $("stayhost");
    if (!host) {
      host = document.createElement("div");
      host.id = "stayhost";
      document.body.appendChild(host);
    }
    var P = W.P,
      s = staySi != null && P ? P.stops[staySi] : null;
    /* (a stay picked: the sheet has done its job) */
    if (s && stayLabel(s) && stayLabel(s) !== stayWas) s = null;
    if (!s) {
      staySi = null;
      stayDrawn = "";
      host.innerHTML = "";
      if (!document.querySelector("#sheethost .sheet, #qshost .sheet")) document.documentElement.classList.remove("modal-open");
      W.backShut("stay");
      return;
    }
    wantLodging(s, W.homebase(s.country, s.name));
    var dates = stayDatesFor(s),
      h =
        '<div class="sheet-back" data-stayclose="1"></div><div class="sheet stay-sheet" role="dialog" aria-modal="' +
        (W.desk() ? "false" : "true") +
        '" tabindex="-1" aria-label="Where to stay in ' +
        esc(s.name) +
        '"><div class="grab" aria-hidden="true"></div><div class="sh-top"><div><b role="heading" aria-level="2">Where to stay in ' +
        esc(s.name) +
        '</b><span class="small muted">' +
        esc(
          [W.nightsText(P, /** @type {number} */ (staySi)), dates.in && dates.out ? fmtIso(dates.in) + " to " + fmtIso(dates.out) : ""]
            .filter(Boolean)
            .join(" · ")
        ) +
        '</span></div><button type="button" class="icon-btn" data-stayclose="1" aria-label="Close">' +
        X16 +
        '</button></div><div class="stop" id="stop-' +
        staySi +
        '">' +
        /* (each place's name a heading under the sheet's own: level 3 here, where Plan's row has it at 4 under the country) */
        stayPanel(s, /** @type {number} */ (staySi)).replace(/<h4>/g, '<h4 aria-level="3">') +
        "</div></div>";
    if (h === stayDrawn) return;
    var first = !stayDrawn,
      box = host; /* (found or made above) */
    stayDrawn = h;
    W.keepInputs(box, function () {
      var sc = box.querySelector(".sheet"),
        y = sc ? sc.scrollTop : 0;
      box.innerHTML = h;
      var now = /** @type {HTMLElement | null} */ (box.querySelector(".sheet"));
      if (now && first) now.focus({ preventScroll: true });
      else if (now) now.scrollTop = y;
    });
    document.documentElement.classList.add("modal-open");
    W.backOpen("stay", closeStay);
  }
  function closeStay() {
    if (staySi == null) return false;
    staySi = null;
    drawStay();
    return true;
  }
  /** open the stay panel for a place as a sheet over the screen you are on (in Plan, its own row opens instead) */
  W.staySheet = function (si) {
    var P = W.P,
      s = P && P.stops[si];
    if (!s) return;
    /* (Plan's own copy of this place's row would share the panel's ids: Plan is drawn afresh when you go there) */
    var vs = /** @type {any} */ ($("viewSetup"));
    if (vs && vs.hidden) {
      vs.innerHTML = "";
      vs._sig = vs._html = null;
    }
    staySi = si;
    stayWas = stayLabel(s);
    stayDrawn = "";
    drawStay();
  };
  W.staySheetRedraw = function () {
    if (staySi != null) drawStay();
  };
  /* the sheet's buttons are Plan's own (W.setupClick), whatever screen is under it */
  document.addEventListener(
    "click",
    function (e) {
      if (staySi == null) return;
      var t = /** @type {HTMLElement | null} */ (e.target);
      if (!t || !t.closest || !t.closest("#stayhost")) return;
      if (t.closest("[data-stayclose]")) {
        e.preventDefault();
        e.stopPropagation();
        closeStay();
        return;
      }
      var b = /** @type {HTMLElement | null} */ (t.closest("button, a"));
      /* (a plain link out, to Booking.com or a map, is just a link) */
      if (!b || (b.tagName === "A" && !Object.keys(b.dataset).length)) return;
      if (b.tagName !== "A") e.preventDefault();
      e.stopPropagation();
      W.setupClick(b, b.dataset, W.P);
      W.save();
    },
    false
  );
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && staySi != null && !document.querySelector("#sheethost .sheet")) closeStay();
  });

  /* suggested stay for one place: enough to see the sights, or a relaxed pace */
  function paceRow(s, i) {
    var r = W.stayRange(s.country, s.name);
    if (!r) {
      var busy = Object.keys(W.status).some(function (k) {
        return k.indexOf("range|") === 0 && W.status[k] === "loading";
      });
      return busy ? '<div class="pace small muted"><span class="loading">Suggested stay…</span></div>' : "";
    }
    function chip(n, what) {
      return (
        '<button type="button" class="chip pace-chip" data-pace="' +
        i +
        '" data-d="' +
        n +
        '" aria-pressed="' +
        (s.days === n) +
        '" title="Suggested stay ' +
        (what === "Sights" ? "to see the main sights" : "for a relaxed pace") +
        '">' +
        what +
        " · " +
        n +
        " day" +
        (n === 1 ? "" : "s") +
        "</button>"
      );
    }
    return (
      '<div class="pace" role="group" aria-label="Suggested stay in ' +
      esc(s.name) +
      '">' +
      (r.s === r.r ? chip(r.s, "Suggested") : chip(r.s, "Sights") + chip(r.r, "Relaxed")) +
      "</div>"
    );
  }

  function countryBlock(c, ci, P, starts) {
    var cities = W.countryCities(c.name),
      loadingList = W.status["country|" + c.name] === "loading";
    var h =
      '<div class="country"><div class="country-h"><h3>' +
      esc(c.name) +
      '</h3><div class="row">' +
      '<div class="seg" role="group" aria-label="How to pick cities in ' +
      esc(c.name) +
      '">' +
      '<button type="button" data-mode="suggest" data-ci="' +
      ci +
      '" aria-pressed="' +
      (c.mode !== "manual") +
      '">Suggest cities</button>' +
      '<button type="button" data-mode="manual" data-ci="' +
      ci +
      '" aria-pressed="' +
      (c.mode === "manual") +
      "\">I'll choose</button></div>" +
      '<button type="button" class="icon-btn" data-rmcountry="' +
      ci +
      '" aria-label="Remove ' +
      esc(c.name) +
      '" title="Remove ' +
      esc(c.name) +
      '">' +
      X_ICON +
      "</button></div></div>";
    var rows = "";
    P.stops.forEach(function (s, i) {
      if (s.country === c.name) rows += stopRow(s, i, c, ci, starts[i]);
    });
    if (c.mode !== "manual") {
      return (
        h +
        (rows
          ? '<div class="stops">' +
            rows +
            '</div><p class="small muted">Suggested for your days and who\'s going. Change anything to make it yours.' +
            (W.libFrom && W.libFrom[W.slug(c.name)] ? " Ready from the shared library." : "") +
            "</p>"
          : loadingList
            ? '<div class="loading">Finding destinations in ' + esc(c.name) + "…</div>"
            : '<p class="small muted">' +
              (W.sampleState === "off" ? "Switch to “I'll choose” and type the cities you want." : "Getting destinations…") +
              "</p>") +
        "</div>"
      );
    }
    h += rows ? '<div class="stops">' + rows + "</div>" : '<p class="small muted">No cities yet. Search below or tap one to add it.</p>';
    h +=
      '<div class="row"><input class="field" id="cityIn' +
      ci +
      '" data-ta="city" data-tac="' +
      esc(c.name) +
      '" autocomplete="off" placeholder="Add any city or town" aria-label="Add any city or town in ' +
      esc(c.name) +
      '">' +
      '<button type="button" class="btn" data-addcity="' +
      ci +
      '" aria-label="Add this place in ' +
      esc(c.name) +
      '">Add</button></div>';
    var ask = isleAsk[c.name];
    if (ask)
      h += isleHint(
        ask,
        function (t) {
          return 'data-pick="' + esc(t.name) + '" data-ci="' + ci + '" aria-pressed="' + (c.picked.indexOf(t.name) > -1) + '"';
        },
        '<button type="button" class="linkish" data-isledone="' + ci + '">Done</button>'
      );
    var popular = cities
      .filter(function (x) {
        return c.picked.indexOf(x.name) < 0 && !W.dayTrip(x);
      })
      .sort(function (a, b) {
        return (b.pop || 4) - (a.pop || 4);
      })
      .slice(0, 5);
    /* the first three offered are asked for ahead (lib/ideas.js W.warmCity), so a tap on one fills its days at once */
    popular.slice(0, 3).forEach(function (x) {
      W.warmCity(c.name, x.name);
    });
    if (popular.length)
      h +=
        '<div class="chips">' +
        popular
          .map(function (x) {
            return '<button type="button" class="chip" data-pick="' + esc(x.name) + '" data-ci="' + ci + '">+ ' + esc(x.name) + "</button>";
          })
          .join("") +
        (!loadingList && cities.length > 5
          ? '<button type="button" class="linkish" data-browse="' +
            ci +
            '">' +
            (openBrowse[c.name] ? "Hide list" : "Browse all " + cities.length) +
            "</button>"
          : "") +
        "</div>";
    if (loadingList) h += '<div class="loading">Loading every destination in ' + esc(c.name) + "…</div>";
    else if (openBrowse[c.name]) {
      var byRegion = {};
      cities.forEach(function (x) {
        (byRegion[x.region || "Popular"] = byRegion[x.region || "Popular"] || []).push(x);
      });
      h +=
        '<div class="browse">' +
        Object.keys(byRegion)
          .sort()
          .map(function (r) {
            return (
              "<h4>" +
              esc(r) +
              '</h4><div class="chips">' +
              byRegion[r]
                .map(function (x) {
                  return (
                    '<button type="button" class="chip" data-pick="' +
                    esc(x.name) +
                    '" data-ci="' +
                    ci +
                    '" aria-pressed="' +
                    (c.picked.indexOf(x.name) > -1) +
                    '" title="' +
                    esc(x.d || "") +
                    '">' +
                    esc(x.name) +
                    "</button>"
                  );
                })
                .join("") +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }
    return h + "</div>";
  }

  /* three places to stay per stop: budget, mid-range and a splurge, each with its own reroll. From Booking.com, with
     their prices for your nights, when it can answer (lib/prices.js W.liveLodge); else Claude's picks */
  var ICON_REROLL = W.icon("reroll", 2.5);
  var TYPE_NAME = { hotel: "Hotel", apartment: "Apartment", guesthouse: "Guesthouse", hostel: "Hostel", resort: "Resort", villa: "Villa" };
  /** a tier's label, and its button for another place in that tier @param {Tier} t @param {number} i @param {Stop} s
   *  @param {boolean} more @param {string} [src] */
  function tierHead(t, i, s, more, src) {
    var tn = W.TIER_NAME[t];
    return (
      '<div class="lodge-h"><span class="tier t-' +
      t +
      '">' +
      tn +
      "</span>" +
      (more
        ? '<button type="button" class="icon-btn" data-lreroll="' +
          t +
          '" data-si="' +
          i +
          (src ? '" data-lsrc="' + src : "") +
          '" aria-label="Show a different ' +
          tn.toLowerCase() +
          " place in " +
          esc(s.name) +
          '" title="Show a different one">' +
          ICON_REROLL +
          "</button>"
        : "") +
      "</div>"
    );
  }
  /** "Stay here", or "✓ Staying here" @param {Tier} t @param {number} i @param {boolean} on @param {string} [src] */
  function stayBtn(t, i, on, src) {
    return (
      '<button type="button" class="btn quiet sm" data-lstay="' +
      t +
      '" data-si="' +
      i +
      (src ? '" data-lsrc="' + src : "") +
      '" aria-pressed="' +
      on +
      '">' +
      (on ? "✓ Staying here" : "Stay here") +
      "</button>"
    );
  }
  /** @param {Stop} s @param {number} i */
  function lodgeCards(s, i) {
    var ck = W.cityKey(s.country, s.name),
      L = W.liveLodge ? W.liveLodge(ck, W.P, "open") : /** @type {LiveLodge} */ ({ st: "off" });
    if (L.st === "ok" && L.items && L.items.length) return liveCards(s, i, ck, L);
    if (L.st === "loading")
      return (
        '<div class="lodges-h">Or pick one of these <span class="lodges-src">· Booking.com</span></div><div class="lodges">' +
        W.TIERS.map(function (t) {
          return (
            '<div class="lodge">' +
            tierHead(t, i, s, false) +
            '<p class="small muted"><span class="loading">Finding places on Booking.com…</span></p></div>'
          );
        }).join("") +
        "</div>"
      );
    /* Claude's picks: Booking.com can't answer here, has nothing, needs your dates or failed (it says so, with another try) */
    var note =
      L.st === "error"
        ? '<p class="small muted bk-note">' +
          esc(L.msg || "") +
          ' <button type="button" class="linkish" data-bkretry="' +
          i +
          '">Try Booking.com again</button></p>'
        : L.st === "ok"
          ? '<p class="small muted bk-note">Booking.com has nothing free in ' +
            esc(s.name) +
            " for your nights, so these are Claude's picks.</p>"
          : L.st === "nodates"
            ? '<p class="small muted bk-note">Add your dates under How long? to see real places and prices from Booking.com.</p>'
            : "";
    if (W.sampleState === "off") return note;
    claudeLodging(s);
    var cur = W.C.city[ck],
      key = "lodge|" + ck + "|" + W.lodgeSig();
    var err = W.status[key] && W.status[key] !== "loading" ? W.status[key] : "",
      stay = S.stays[ck] || /** @type {Partial<Stay>} */ ({});
    var cards = W.TIERS.map(function (t) {
      var it = W.lodgeShown(s.country, s.name, t);
      var more = Object.keys(W.status).some(function (k) {
        return k.indexOf(key + "|" + t + "|") === 0 && W.status[k] === "loading";
      });
      var head = tierHead(t, i, s, !!it);
      if (!it)
        return (
          '<div class="lodge">' +
          head +
          '<p class="small muted">' +
          (err ? "" : W.status[key] === "loading" || more ? '<span class="loading">Finding places…</span>' : "No pick yet.") +
          "</p></div>"
        );
      var on = stay.label === it.n,
        ph = W.picture(it, false, s.country, s.name, { credit: true });
      return (
        '<div class="lodge' +
        (on ? " on" : "") +
        '">' +
        (ph ? '<div class="pic-wrap">' + ph + "</div>" : "") +
        head +
        "<h4>" +
        esc(it.n) +
        "</h4>" +
        '<div class="small muted">' +
        esc([TYPE_NAME[it.type] || "", it.area].filter(Boolean).join(" · ")) +
        "</div>" +
        (it.d ? '<p class="small">' + esc(it.d) + "</p>" : "") +
        (it.price
          ? '<div class="lprice" title="Typical price per night">~' +
            esc(it.price.replace(/^~\s*/, "")) +
            (/night/i.test(it.price) ? "" : " <span>/ night</span>") +
            "</div>"
          : "") +
        '<div class="lodge-a">' +
        stayBtn(t, i, on) +
        '<a class="price" href="' +
        esc(W.priceUrl(it, s.name)) +
        '" target="_blank" rel="noopener">Compare prices</a>' +
        '<a href="' +
        esc(W.photosUrl(it.n, s.name)) +
        '" target="_blank" rel="noopener">Photos</a>' +
        '<a href="' +
        esc(W.gmapsPlace(it, s.name)) +
        '" target="_blank" rel="noopener">Map</a>' +
        (W.safeUrl(it.site) ? '<a href="' + esc(W.safeUrl(it.site)) + '" target="_blank" rel="noopener">Website</a>' : "") +
        "</div></div>"
      );
    });
    return (
      '<div class="lodges-h">Or pick one of these</div>' +
      note +
      '<div class="lodges">' +
      cards.join("") +
      "</div>" +
      (err
        ? '<p class="small muted">' + esc(err) + ' <button type="button" class="linkish" data-lretry="' + i + '">Try again</button></p>'
        : "")
    );
  }
  /** Booking.com's places for a stop: per tier the one on show, its rating, its price a night and for the whole stay,
   *  and its own page to book @param {Stop} s @param {number} i @param {string} ck @param {LiveLodge} L */
  function liveCards(s, i, ck, L) {
    var stay = S.stays[ck] || /** @type {Partial<Stay>} */ ({}),
      nights = (L.nights || 0) + " night" + (L.nights === 1 ? "" : "s");
    var cards = W.TIERS.map(function (t) {
      var it = W.liveShown(ck, t),
        head = tierHead(t, i, s, W.liveTierSize(ck, t) > 1, "bk");
      if (!it) return ""; /* (a few results fill a tier or two: no empty card for the others) */
      var on = stay.label === it.n,
        ph = W.picture(/** @type {any} */ (it), false, s.country, s.name, { credit: true }),
        kind = it.type ? it.type.charAt(0).toUpperCase() + it.type.slice(1) : "";
      return (
        '<div class="lodge lodge-bk' +
        (on ? " on" : "") +
        '">' +
        (ph ? '<div class="pic-wrap">' + ph + "</div>" : "") +
        head +
        "<h4>" +
        esc(it.n) +
        "</h4>" +
        '<div class="small muted">' +
        esc([kind, it.stars ? it.stars + "★" : "", it.area].filter(Boolean).join(" · ")) +
        "</div>" +
        (it.score
          ? '<div class="small lrate"><b>' +
            it.score.toFixed(1) +
            "</b>/10" +
            (it.reviews ? " · " + it.reviews.toLocaleString() + " reviews" : "") +
            "</div>"
          : "") +
        '<div class="lprice">' +
        esc(W.money(it.night, it.cur)) +
        " <span>/ night</span></div>" +
        '<div class="small muted">' +
        esc(W.money(it.total, it.cur) + " for " + nights) +
        "</div>" +
        '<div class="lodge-a">' +
        stayBtn(t, i, on, "bk") +
        W.extLink(it.url, "Book on Booking.com ↗") +
        '<a href="' +
        esc(W.gmapsPlace(it, s.name)) +
        '" target="_blank" rel="noopener">Map</a>' +
        "</div></div>"
      );
    });
    return (
      '<div class="lodges-h">Or pick one of these <span class="lodges-src">· Booking.com prices for your ' +
      esc(nights) +
      (L.busy ? ", updating…" : L.at ? ", " + esc(W.ago(L.at)) : "") +
      '</span></div><div class="lodges">' +
      cards.join("") +
      "</div>"
    );
  }

  /* the whole trip at either pace: every place's suggested stay added up */
  function paceTotals(P) {
    var t = { s: 0, r: 0, any: false };
    P.stops.forEach(function (x) {
      var r = W.stayRange(x.country, x.name);
      if (r) t.any = true;
      t.s += r ? r.s : x.days;
      t.r += r ? r.r : x.days;
    });
    return t;
  }
  function paceAll(P) {
    if (P.stops.length < 1) return "";
    if (W.sampleState !== "off") W.loadStayRanges(P.stops);
    var t = paceTotals(P);
    if (!t.any) return "";
    var on = function (k) {
      return P.stops.every(function (x) {
        var r = W.stayRange(x.country, x.name);
        return !r || x.days === r[k];
      });
    };
    return (
      '<div class="pace-all"><span class="small muted">Suggested for your cities</span><div class="chips">' +
      '<button type="button" class="chip pace-chip" data-paceall="s" aria-pressed="' +
      on("s") +
      '">Sightseeing · ' +
      t.s +
      " days</button>" +
      (t.r !== t.s
        ? '<button type="button" class="chip pace-chip" data-paceall="r" aria-pressed="' + on("r") + '">Relaxed · ' + t.r + " days</button>"
        : "") +
      "</div></div>"
    );
  }

  /* the overall feel of the trip, over and above its interests */
  var FOCUS_OPTS = [
    ["icons", "The famous sights"],
    ["both", "Icons and surprises"],
    ["gems", "Where locals go"]
  ];
  /* what each interest turns into under each choice: [the famous version, the local version] */
  var STYLE_FEEL = {
    relax: ["the classic cafés and promenades", "quiet squares where locals linger"],
    adventure: ["the headline hikes and outdoor trips", "lesser-known trails and outdoor spots"],
    food: ["the legendary restaurants and markets", "family-run tavernas and neighbourhood bakeries"],
    beach: ["the famous beaches", "quiet coves locals love"],
    mountain: ["the classic peaks and viewpoints", "hidden mountain villages and trails"],
    culture: ["the landmark museums and monuments", "small museums and old churches off the main streets"],
    nature: ["the best-known parks and reserves", "quiet gorges, springs and nature spots"],
    nightlife: ["the famous evening spots", "the bars locals go to"],
    shopping: ["the main shopping streets", "local markets and craft workshops"],
    family: ["the big family favourites", "the playgrounds and farms local families love"],
    wellness: ["the best-known spas", "local hot springs and quiet retreats"],
    scenic: ["the iconic viewpoints", "secret viewpoints"]
  };
  function focusNote(fc) {
    var st = S.styles
      .filter(function (x) {
        return STYLE_FEEL[x];
      })
      .slice(0, 3);
    var bits = st.map(function (x) {
      var f = STYLE_FEEL[x];
      return fc === "icons" ? f[0] : fc === "gems" ? f[1] : f[0] + " plus " + f[1];
    });
    var list = bits.length > 2 ? bits.slice(0, -1).join(", ") + ", and " + bits[bits.length - 1] : bits.join(" and ");
    if (!list)
      return fc === "icons"
        ? "Expect the sights a first visit shouldn't miss, and the best-reviewed places to eat."
        : fc === "gems"
          ? "Expect the places locals love that most visitors miss. All well reviewed."
          : "Expect the famous highlights with a few lesser-known gems mixed in. All well reviewed.";
    return "Expect " + list + ". All well reviewed.";
  }

  /* the allergy and diet lists fold away (folded unless you left one open); folded, each line shows what's picked */
  function eatFold(k, label, list, picked, hint) {
    var names = list
      .filter(function (a) {
        return picked.indexOf(a[0]) > -1;
      })
      .map(function (a) {
        return a[1];
      });
    return (
      '<details class="eat-f" data-fold="eat-' +
      k +
      '"' +
      (((S.eatOpen || {})[k] === undefined ? W.desk() : (S.eatOpen || {})[k]) ? " open" : "") +
      '><summary><span class="fld-l">' +
      label +
      '</span><span class="eat-s' +
      (names.length ? " on" : "") +
      '">' +
      esc(names.length ? names.join(", ") : "None") +
      "</span>" +
      CHEV +
      "</summary>" +
      (hint ? '<p class="small muted">' + hint + "</p>" : "") +
      '<div class="chips">' +
      list
        .map(function (a) {
          return (
            '<button type="button" class="chip" data-eat' +
            k +
            '="' +
            a[0] +
            '" aria-pressed="' +
            (picked.indexOf(a[0]) > -1) +
            '">' +
            esc(a[1]) +
            "</button>"
          );
        })
        .join("") +
      "</div></details>"
    );
  }

  /* a foldable step; while folded, its header sums up what you chose */
  var DONE = {},
    FIRST = null;
  function step(id, n, title, sum, body) {
    var sc = (S.stepClosed || {})[id],
      /* (on the desktop workspace the steps sit side by side: one you have not folded yourself is open) */
      open = sc === undefined ? W.desk() || id === FIRST : !sc,
      done = !!DONE[id];
    return (
      '<details class="step sk' +
      (done ? " done" : "") +
      '" data-fold="step-' +
      id +
      '"' +
      (open ? " open" : "") +
      /* (the tick is read as "Done", a word; a label on the <b> itself was not read at all) */
      '><summary class="step-h"><b' +
      (done ? ' aria-hidden="true"' : "") +
      ">" +
      (done ? '✓</b><span class="vh">Done: </span>' : n + "</b>") +
      "<h2>" +
      title +
      '</h2><span class="sum">' +
      esc(sum) +
      "</span>" +
      CHEV +
      "</summary>" +
      body +
      "</details>"
    );
  }

  W.renderSetup = function (P) {
    var h = "",
      p = W.party();
    /* going to a city's "where to stay" opens the step it lives in */
    if (W.scrollToStop != null) (S.stepClosed || (S.stepClosed = {})).where = false;
    var RC = P.stops.length ? W.routeBody(P) : null;
    DONE = {
      style: S.styles.length > 0,
      who: (S.travelers || []).length > 0 && !!S.depart,
      eat: !!(W.eatNeeds && W.eatNeeds()) || !!S.eatNone,
      long: !!S.start,
      where: P.stops.length > 0,
      check: !!RC && !RC.warn
    };
    FIRST =
      ["style", "who", "eat", "long", "where", "check"].filter(function (k) {
        return !DONE[k] && (k !== "check" || (RC && RC.body));
      })[0] || null;
    if (!S.countries.length && !W.readOnly)
      h =
        '<div class="qs-card sk"><div><b>Start with three questions</b><span class="small muted">Where, when and who. You get a full day-by-day plan you can change.</span></div><button type="button" class="btn" data-quick="1">Quick start</button>' +
        '<p class="small muted qs-imp">Planned it in Wanderlog or a doc already? <a href="#settings" data-view="settings">Import it</a></p></div>' +
        h;

    /* (on a desktop the steps stand in two columns, each stacked on its own: about you (01-03), the trip (04-06)) */
    var colA = h.length,
      colB = 0;
    /* 1 · what kind of trip */
    var fc = W.focus();
    h += step(
      "style",
      "01",
      "What kind of trip?",
      [W.FOCUS[fc]]
        .concat(
          S.styles.map(function (x) {
            return W.STYLE_NAME[x];
          })
        )
        .join(" · "),
      '<div class="focus" role="radiogroup" aria-label="What to see">' +
        FOCUS_OPTS.map(function (o) {
          return (
            '<button type="button" role="radio" data-focus="' +
            o[0] +
            '" aria-checked="' +
            (fc === o[0]) +
            '"><b>' +
            esc(W.FOCUS[o[0]]).replace(/\S+-\S+/g, '<span class="nw">$&</span>') /* (a hyphenated word is never split) */ +
            "</b><span>" +
            esc(o[1]) +
            "</span></button>"
          );
        }).join("") +
        "</div>" +
        '<p class="fld-l">Interests</p><div class="chips">' +
        window.STYLES.map(function (s) {
          return (
            '<button type="button" class="chip" data-style="' +
            s[0] +
            '" aria-pressed="' +
            (S.styles.indexOf(s[0]) > -1) +
            '">' +
            esc(s[1]) +
            "</button>"
          );
        }).join("") +
        "</div>" +
        '<p class="focus-note">' +
        esc(focusNote(fc)) +
        "</p>"
    );

    /* 2 · who's going, and from where */
    var who =
      (W.familyLine && W.familyLine()) ||
      (p.adults ? p.adults + " adult" + (p.adults === 1 ? "" : "s") : "") +
        (p.kids.length ? ", " + p.kids.length + " kid" + (p.kids.length === 1 ? "" : "s") + " (" + p.kids.join(", ") + ")" : "");
    var blanks = S.travelers.filter(function (a) {
        return a === "" || isNaN(a);
      }).length,
      noAge = blanks
        ? (blanks === 1 ? "One traveler has" : blanks + " travelers have") +
          " no age yet, so the plan treats them as adults: add ages for naps, early dinners and the kids' corner."
        : "";
    h += step(
      "who",
      "02",
      "Who's going?",
      [who, S.depart ? "from " + S.depart : "", blanks ? "add ages" : ""].filter(Boolean).join(" · ") || "Add travelers",
      '<label class="fld" for="depart"><span>Flying from</span><input class="field" id="depart" data-ta="airport" autocomplete="off" value="' +
        esc(S.depart) +
        '" placeholder="Your home city or airport"></label>' +
        '<div class="fld"><span>Travelers</span><div class="travs">' +
        S.travelers
          .map(function (a, i) {
            var nm = (S.names || [])[i] || "";
            return (
              '<div class="trav"><label class="role" for="nm' +
              i +
              '">' +
              (a === "" ? "Traveler" : ageLabel(+a)) +
              "</label>" +
              '<input class="field tnm" id="nm' +
              i +
              '" data-tname="' +
              i +
              '" value="' +
              esc(nm) +
              '" placeholder="Name" maxlength="20" autocomplete="off" aria-label="Name of traveler ' +
              (i + 1) +
              '">' +
              '<div class="age"><input class="field" id="age' +
              i +
              '" type="number" min="0" max="110" inputmode="numeric" value="' +
              esc(a) +
              '" data-age="' +
              i +
              '" placeholder="?" aria-label="Age of traveler ' +
              (i + 1) +
              '"><span class="small muted">yrs</span></div>' +
              (S.travelers.length > 1
                ? '<button type="button" class="icon-btn" data-rmtrav="' +
                  i +
                  '" aria-label="Remove traveler ' +
                  (i + 1) +
                  '">' +
                  X_ICON +
                  "</button>"
                : "") +
              "</div>"
            );
          })
          .join("") +
        '<button type="button" class="trav add" id="addAdult">+ Adult</button><button type="button" class="trav add" id="addChild">+ Child</button></div></div>' +
        /* (a traveler with no age is planned as a grown-up: nothing for children unless their age says they're one,
           the owner's rule. Said here, so a family that leaves ages blank knows why there are no naps; v181) */
        (noAge ? '<p class="small muted no-age">' + noAge + "</p>" : "")
    );

    /* 3 · what you eat: allergies, diets, likes, before any restaurant is suggested */
    var eat = S.eat || {},
      eatSum = W.eatText ? W.eatText() : "";
    h += step(
      "eat",
      "03",
      "What do you eat?",
      eatSum ? eatSum.charAt(0).toUpperCase() + eatSum.slice(1) : S.eatNone ? "Nothing special" : "Allergies, diets, favorites",
      eatFold("al", "Allergies", W.EAT_AL, eat.al || [], "Tap any that anyone in the group has.") +
        eatFold(
          "di",
          "Diet",
          /* picky kids only when children come (or it was picked already) */
          W.EAT_DI.filter(function (x) {
            return x[0] !== "plain" || W.party().kid || (eat.di || []).indexOf("plain") > -1;
          }),
          eat.di || [],
          ""
        ) +
        '<label class="fld" for="eatLove"><span>Food you love</span><input class="field" id="eatLove" data-eat="love" maxlength="120" value="' +
        esc(eat.love || "") +
        '" placeholder="Grilled fish, pizza, mezze" autocomplete="off"></label>' +
        '<label class="fld" for="eatAvoid"><span>Rather avoid</span><input class="field" id="eatAvoid" data-eat="avoid" maxlength="120" value="' +
        esc(eat.avoid || "") +
        '" placeholder="Very spicy food, raw fish" autocomplete="off"></label>' +
        '<label class="fld" for="eatNote"><span>Anything else</span><input class="field" id="eatNote" data-eat="note" maxlength="200" value="' +
        esc(eat.note || "") +
        '" placeholder="Our 4-year-old only eats plain pasta" autocomplete="off"></label>' +
        eatReport(P) +
        '<p class="small muted">Restaurant ideas are chosen with these in mind, places that can\'t feed you are never planned, and each meal says what you can have. With allergies, always tell the staff: no app can promise a kitchen is safe.</p>' +
        (!eatSum && !S.eatNone ? '<div><button type="button" class="btn quiet sm" data-eatnone="1">Nothing special</button></div>' : "")
    );

    /* 4 · how long: the total, or the sum of each place's days once you've set them */
    var allSet =
        P.stops.length &&
        P.stops.every(function (s) {
          return s.set;
        }),
      anySet = P.stops.some(function (s) {
        return s.set;
      });
    colB = h.length;
    h += step(
      "long",
      "04",
      "How long?",
      P.N + " days" + (dateOf(1) ? " · from " + dateOf(1) : ""),
      '<div class="row">' +
        (allSet
          ? '<div class="total-days" aria-live="polite">' + P.N + "</div>"
          : '<div class="stepper"><button type="button" id="daysMinus" aria-label="Fewer days">−</button><input id="days" type="number" min="2" max="60" value="' +
            S.days +
            '" aria-label="Number of days"><button type="button" id="daysPlus" aria-label="More days">+</button></div>') +
        '<span class="muted">days, starting</span><input class="field" id="startDate" type="date" value="' +
        esc(S.start) +
        '" style="flex:0 1 180px" aria-label="Start date (optional)"></div>' +
        paceAll(P) +
        (anySet
          ? '<p class="small muted">' +
            (allSet ? "The total of each place's days." : "Places you set keep their days.") +
            ' <button type="button" class="linkish" data-resetdays="1">Use suggested split</button></p>'
          : "")
    );

    /* 4 · where: every stop with its days and lodging, in travel order */
    var starts = [],
      dn = 1;
    P.stops.forEach(function (s) {
      starts.push(dn);
      dn += s.days;
    });
    h += step(
      "where",
      "05",
      "Where to?",
      P.stops
        .map(function (s) {
          return s.name;
        })
        .join(" → ") || "Add a country",
      S.countries
        .map(function (c, i) {
          return countryBlock(c, i, P, starts);
        })
        .join("") +
        (W.standalone && !W.cloud
          ? '<p class="small muted sa-note">This version plans trips to ' +
            esc(W.builtInCountries()) +
            ". Anywhere else comes with the full Waypoint, in Claude.</p>"
          : "") +
        '<div class="row add-country"><input class="field" id="countryIn" data-ta="country" data-tago="addCountry" autocomplete="off" placeholder="' +
        (S.countries.length ? "Add another country" : "Add a country") +
        '"><button type="button" class="btn' +
        (S.countries.length ? " quiet" : "") +
        '" id="addCountry" aria-label="Add this country">Add</button></div>'
    );

    /* 5 · route check */
    if (P.stops.length) {
      if (RC.body)
        h += step("check", "06", "Trip shape", RC.sum, RC.body).replace(
          'class="step sk"',
          'class="step sk rtcheck' + (RC.warn ? " has-warn" : "") + '"'
        );
      /* Claude reads the whole plan and flags real problems (lib/review.js; also from the trip menu) */
      if (W.reviewBlock) h += W.reviewBlock(P);
    }
    if (W.desk && W.desk())
      h =
        h.slice(0, colA) +
        '<div class="su-cols"><div class="su-col">' +
        h.slice(colA, colB) +
        '</div><div class="su-col">' +
        h.slice(colB) +
        "</div></div>";
    h += '<div class="cta"><button type="button" class="btn" data-view="trip">See my trip' + W.arrow("r") + "</button></div>";
    var el = $("viewSetup"),
      a = document.activeElement,
      id = a && a.id,
      val = a && a.value,
      sel = a && a.selectionStart;
    /* edited in place, like the trip's screens (lib/patch.js): a redraw that comes while a finger is down no longer
       replaces what is under it. Thrown away and rebuilt, a tick on Plan could be lost when data arrived mid-tap. */
    if (el) W.draw(el, h, "setup|" + (S.tripId || "")); /* (the screen's box, in index.html) */
    var n = id ? $(id) : null;
    if (n) {
      if (typeof val === "string" && n.value !== val && n.tagName === "INPUT" && n.type !== "number" && n.type !== "date") n.value = val;
      n.focus();
      try {
        if (sel != null && n.setSelectionRange) n.setSelectionRange(sel, sel);
      } catch (e) {}
    }
    if (W.scrollToStop != null) {
      var st = $("stop-" + W.scrollToStop);
      W.scrollToStop = null;
      if (st) st.scrollIntoView({ block: "start" });
    }
  };

  function dateOf(n) {
    if (!S.start) return "";
    var d = new Date(S.start + "T12:00:00");
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + n - 1);
    return W.fmtDate(d, "md");
  }

  /* ---------- actions ---------- */
  /* set one place's days: everything on screen stays as it is (same cities, same days elsewhere) and the trip length follows */
  /* set every place to its sightseeing or relaxed stay (places without a suggestion keep their days) */
  function setPace(which, P) {
    if (!P.stops.length) return;
    setCityDays(0, P.stops[0].days, P); /* freezes the city list and current days */
    P.stops.forEach(function (x) {
      var r = W.stayRange(x.country, x.name);
      if (r) S.cityDays[W.cityKey(x.country, x.name)] = r[which];
    });
    S.days = P.stops.reduce(function (a, x) {
      return a + S.cityDays[W.cityKey(x.country, x.name)];
    }, 0);
  }
  function setCityDays(i, val, P) {
    var s = P && P.stops[i];
    if (!s) return;
    S.cityDays = S.cityDays || {};
    S.countries.forEach(function (c) {
      if (c.mode === "manual") return;
      var mine = P.stops
        .filter(function (x) {
          return x.country === c.name;
        })
        .map(function (x) {
          return x.name;
        });
      if (mine.length) {
        c.picked = mine;
        c.mode = "manual";
      }
    });
    P.stops.forEach(function (x) {
      S.cityDays[W.cityKey(x.country, x.name)] = x.days;
    });
    S.cityDays[W.cityKey(s.country, s.name)] = Math.max(1, Math.min(30, Math.round(+val) || 1));
    S.days = P.stops.reduce(function (a, x) {
      return a + S.cityDays[W.cityKey(x.country, x.name)];
    }, 0);
  }

  function addCountry() {
    var inp = $("countryIn"),
      v = countryName((inp && inp.value) || "");
    if (!v) return;
    if (
      !S.countries.some(function (c) {
        return c.name === v;
      })
    )
      S.countries.push({ name: v, mode: "suggest", picked: [], rank: 2 });
    W.loadCountry(v);
    W.render();
  }
  function addCity(i) {
    var found = $("cityIn" + i),
      v = ((found && found.value) || "").trim();
    if (!found || !v) return;
    var inp = found;
    var c = S.countries[i],
      isle = W.isleChoice(c.name, v);
    /* an island is not a place to stay: its towns are offered instead, and nothing is added until one is chosen */
    if (isle && isle.towns.length) {
      isleAsk[c.name] = isle;
      inp.value = "";
      W.render();
      return;
    }
    delete isleAsk[c.name];
    var known = W.findCity(c.name, v),
      name = known
        ? known.name
        : v.replace(/\b\w/g, function (m) {
            return m.toUpperCase();
          });
    if (c.picked.indexOf(name) < 0) c.picked.push(name);
    inp.value = "";
    W.render();
    var again = $("cityIn" + i);
    if (again) again.focus();
  }
  function setStay(i, P) {
    var s = P.stops[i];
    if (!s) return;
    var ck = W.cityKey(s.country, s.name),
      box = $("stayIn" + i),
      v = ((box && box.value) || "").trim();
    if (!v) {
      delete S.stays[ck];
      W.render();
      return;
    }
    S.stays[ck] = { label: v };
    openStay[ck] = false;
    W.geocode(s.country, s.name, v, function (g) {
      if (S.stays[ck] && S.stays[ck].label === v) {
        S.stays[ck].lat = g.lat;
        S.stays[ck].lng = g.lng;
        W.freshPicks(s.country, s.name);
        W.changed();
      }
    });
    W.render();
  }

  W.setupClick = function (b, d, P) {
    if (W.importClick(d)) return;
    if (W.liveClick && W.liveClick(d, P)) {
      W.render();
      return;
    }
    if (W.watchClick && W.watchClick(d, P)) {
      W.render();
      return;
    }
    if (d.routeorder != null || d.fold || d.unfold || d.nights || (d.legpick != null && d.legkey)) {
      W.routeClick(d, P);
      W.render();
      return;
    }
    if (d.rest) {
      var rs = S.rest || (S.rest = {});
      if (rs[d.rest]) delete rs[d.rest];
      else rs[d.rest] = 1;
      W.render();
      return;
    }
    /* food needs: a chip on or off; "Nothing special" marks the step done */
    if (d.eatal || d.eatdi) {
      var ea = S.eat || (S.eat = {}),
        f = d.eatal ? "al" : "di",
        v = d.eatal || d.eatdi,
        arr = ea[f] || (ea[f] = []),
        at = arr.indexOf(v);
      if (at > -1) arr.splice(at, 1);
      else arr.push(v);
      delete S.eatNone;
      W.render();
      return;
    }
    if (d.eatnone) {
      S.eatNone = 1;
      (S.stepClosed || (S.stepClosed = {})).eat = true;
      W.render();
      return;
    }
    var ci = d.ci != null ? +d.ci : null,
      c = ci != null ? S.countries[ci] : null;
    if (d.style) {
      var k = S.styles.indexOf(d.style);
      if (k > -1) S.styles.splice(k, 1);
      else S.styles.push(d.style);
      W.resetPicks();
    } else if (d.focus && W.FOCUS[d.focus]) {
      /* the overall feel: re-plan the days around it (any choice, even the default, once tapped) */
      if (S.focus !== d.focus) {
        S.focus = d.focus;
        W.freshAll();
      }
    } /* stops you chose yourself stay */ else if (d.mode && c) {
      var cn = c.name;
      if (d.mode === "manual" && c.mode !== "manual" && !c.picked.length)
        c.picked = P.stops
          .filter(function (s) {
            return s.country === cn;
          })
          .map(function (s) {
            return s.name;
          });
      c.mode = d.mode;
      if (d.mode === "suggest") c.rank = 2; /* (suggested afresh: the best known first) */
      if (d.mode === "manual") W.loadCountry(c.name);
    } else if (d.rmcountry != null) S.countries.splice(+d.rmcountry, 1);
    else if (d.openstay != null) {
      var os = P.stops[+d.openstay];
      if (!os) return false;
      var ok = W.cityKey(os.country, os.name),
        oi = +d.openstay,
        panel = document.querySelector("#stop-" + oi + " .stay-panel");
      if (openStay[ok] && panel) {
        W.fxCollapse(panel, function () {
          openStay[ok] = false;
          W.render();
        });
        return false;
      }
      openStay[ok] = true;
      W.fxAfter(function () {
        W.fxExpand("#stop-" + oi + " .stay-panel");
        W.fxStagger("#stop-" + oi + " .lodge", { step: 60 });
      });
    } else if (d.rmstop != null) {
      /* removing a suggested city turns that country into your own list, minus this city */
      var gone = P.stops[+d.rmstop],
        rc =
          gone &&
          S.countries.filter(function (x) {
            return x.name === gone.country;
          })[0];
      if (rc) {
        if (rc.mode !== "manual") {
          rc.picked = P.stops
            .filter(function (x) {
              return x.country === rc.name;
            })
            .map(function (x) {
              return x.name;
            });
          rc.mode = "manual";
        }
        rc.picked.splice(rc.picked.indexOf(gone.name), 1);
      }
    } else if (d.pick && c) {
      var j = c.picked.indexOf(d.pick);
      if (j > -1) c.picked.splice(j, 1);
      else c.picked.push(d.pick);
    } else if (d.isledone != null) {
      var ic = S.countries[+d.isledone];
      if (ic) delete isleAsk[ic.name];
    } else if (d.isleswap != null) {
      var is = P.stops[+d.isleswap];
      if (is && d.town) W.isleSwap(is.country, is.name, d.town);
    } else if (d.unpick && c) c.picked.splice(c.picked.indexOf(d.unpick), 1);
    else if (d.up && c) {
      var u = +d.up,
        t = c.picked[u];
      c.picked[u] = c.picked[u - 1];
      c.picked[u - 1] = t;
    } else if (d.addcity != null) return addCity(+d.addcity);
    else if (d.browse != null) {
      var nm = S.countries[+d.browse].name;
      openBrowse[nm] = !openBrowse[nm];
      if (openBrowse[nm])
        W.fxAfter(function () {
          W.fxExpand(".browse", { reveal: false });
        });
    } else if (d.setstay != null) return setStay(+d.setstay, P);
    else if (d.lreroll && d.si != null) {
      var ls = P.stops[+d.si],
        li = +d.si,
        lt = d.lreroll;
      if (ls && d.lsrc === "bk") W.liveReroll(W.cityKey(ls.country, ls.name), lt);
      else if (ls) W.lodgeReroll(ls.country, ls.name, lt);
      W.fxAfter(function () {
        var r = document.querySelector("#stop-" + li + ' [data-lreroll="' + lt + '"]');
        W.fxPulse(r && r.closest(".lodge"));
      });
    } else if (d.lstay && d.si != null) {
      var lsp = P.stops[+d.si],
        lck = lsp ? W.cityKey(lsp.country, lsp.name) : "",
        bk = d.lsrc === "bk",
        lit = lsp && (bk ? W.liveShown(lck, d.lstay) : W.lodgeShown(lsp.country, lsp.name, d.lstay));
      if (!lsp || !lit) return false;
      if (S.stays[lck] && S.stays[lck].label === lit.n) delete S.stays[lck];
      else {
        /* (a Booking.com place comes with its price for your nights, for the budget and the price watch) */
        S.stays[lck] = bk ? W.liveStay(lck, /** @type {LiveLodging} */ (lit)) : { label: lit.n, lat: lit.lat, lng: lit.lng };
        /* fold the picks away, then show the chosen place on the city's row */
        var lsi = +d.si,
          lpanel = document.querySelector("#stop-" + lsi + " .stay-panel");
        W.freshPicks(lsp.country, lsp.name);
        if (lpanel) {
          W.fxCollapse(
            lpanel,
            function () {
              openStay[lck] = false;
              W.fxAfter(function () {
                W.fxPulse("#stop-" + lsi + " .stay-btn");
              });
              W.render();
            },
            { dur: 260 }
          );
          return false;
        }
        openStay[lck] = false;
      }
      W.freshPicks(lsp.country, lsp.name); /* the days regroup around where you're staying */
    } else if (d.bkretry != null) {
      var bs = P.stops[+d.bkretry];
      if (bs) W.liveLodgeRetry(W.cityKey(bs.country, bs.name));
    } else if (d.lretry != null) {
      var lr = P.stops[+d.lretry];
      if (lr) {
        var lk = "lodge|" + W.cityKey(lr.country, lr.name) + "|" + W.lodgeSig();
        delete W.status[lk];
        W.loadLodging(lr.country, lr.name);
      }
    } else if (d.cdays != null) {
      var cs = P.stops[+d.cdays];
      if (cs) setCityDays(+d.cdays, cs.days + (+d.delta || 0), P);
    } else if (d.pace != null) {
      setCityDays(+d.pace, +d.d, P);
      var pi = +d.pace;
      W.fxAfter(function () {
        W.fxPulse("#cdays" + pi);
      });
    } else if (d.paceall) {
      setPace(d.paceall, P);
      W.fxAfter(function () {
        W.fxStagger(".stop .stepper input", { y: 0, step: 50 });
        W.fxPulse(".total-days");
      });
    } else if (d.resetdays)
      P.stops.forEach(function (x) {
        delete S.cityDays[W.cityKey(x.country, x.name)];
      });
    else if (d.rmtrav != null) {
      S.travelers.splice(+d.rmtrav, 1);
      if (S.names) S.names.splice(+d.rmtrav, 1);
      W.resetPicks();
    } else if (b.id === "addCountry") return addCountry();
    else if (b.id === "addAdult" || b.id === "addChild") {
      S.travelers.push(b.id === "addAdult" ? 35 : 6);
      W.resetPicks();
      W.fxAfter(function () {
        var t = document.querySelectorAll(".travs .trav:not(.add)");
        W.fxPulse(t[t.length - 1]);
      });
    } else if (b.id === "daysMinus" || b.id === "daysPlus")
      S.days = Math.max(2, Math.min(60, (+S.days || 10) + (b.id === "daysPlus" ? 1 : -1)));
    else return false;
    W.render();
    return true;
  };
  W.setupEnter = function (t, P) {
    if (t.id === "countryIn") addCountry();
    else if (/^cityIn/.test(t.id)) addCity(+t.id.slice(6));
    else if (/^stayIn/.test(t.id)) setStay(+t.id.slice(6), P);
  };
  W.setupChange = function (t) {
    if (t.id === "days") S.days = Math.max(2, Math.min(60, +t.value || 10));
    else if (t.dataset.cdin != null) setCityDays(+t.dataset.cdin, t.value, W.P);
    else if (t.id === "startDate") S.start = t.value;
    else if (t.id === "depart") S.depart = t.value;
    else if (t.dataset.eat) {
      var ea2 = S.eat || (S.eat = {});
      ea2[t.dataset.eat] = t.value.trim().slice(0, t.dataset.eat === "note" ? 200 : 120);
      delete S.eatNone;
    } else if (t.dataset.tname != null) {
      S.names = S.names || [];
      while (S.names.length < S.travelers.length) S.names.push("");
      S.names[+t.dataset.tname] = t.value.trim().slice(0, 20);
      W.save();
    } else if (t.dataset.age != null) {
      S.travelers[+t.dataset.age] = t.value === "" ? "" : Math.max(0, Math.min(110, +t.value));
      W.resetPicks();
    } else if (t.id === "cityIn" + t.id.slice(6) && /^cityIn\d+$/.test(t.id)) {
      /* picking from the suggestion list adds it straight away */
      var i = +t.id.slice(6),
        c = S.countries[i];
      if (c && W.findCity(c.name, t.value)) return addCity(i);
      return;
    } else return;
    W.render();
  };
})();
