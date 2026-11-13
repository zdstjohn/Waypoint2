/* Waypoint for the kids: the day in big photos and big words ("Today we're going to…"), a heart for each kid to pick
   what they're excited about (it shows on the grown-ups' plan as "Mila's pick"), a passport that collects a stamp for
   every place, and a treasure hunt in each town. Opened from the trip menu and from Today. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var tab = "today",
    kday = null,
    huntTown = null;
  function S() {
    return W.S;
  }
  function today() {
    var n = W.now();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* ---------- the places, in order (where you sleep and where you go for the day) ---------- */
  function places(P) {
    var out = [];
    P.stops.forEach(function (s, si) {
      var ds = P.days.filter(function (d) {
        return d.stop === si;
      });
      out.push({ key: W.cityKey(s.country, s.name), name: s.name, country: s.country, n: ds[0].n });
      ds.forEach(function (d) {
        if (
          d.trip &&
          !out.some(function (o) {
            return o.name === d.trip.name;
          })
        )
          out.push({ key: W.cityKey(d.trip.country, d.trip.name), name: d.trip.name, country: d.trip.country, n: d.n, trip: true });
      });
    });
    return out;
  }
  function stamped(pl) {
    if ((S().stamps || {})[pl.key]) return "you";
    var d = W.dateOf(pl.n);
    return d && d <= today() ? "auto" : "";
  }

  /* ---------- the treasure hunt: six things to spot in each town ---------- */
  var FINDS = [
    "a blue door",
    "a cat having a nap",
    "a statue with a beard",
    "a flag flapping in the wind",
    "a fountain",
    "a dog going for a walk",
    "a church bell",
    "a boat",
    "flowers in a window box",
    "a bicycle with a basket",
    "a bird sitting on a roof",
    "someone eating an ice cream",
    "a red car",
    "a big clock",
    "stairs with more than 20 steps",
    "a shop that sells sweets",
    "a lion (a statue or a picture)",
    "a wall with a painting on it",
    "a bridge",
    "a tree with fruit on it",
    "someone playing music in the street",
    "a map of the town",
    "a door knocker shaped like a hand or an animal",
    "a hat you'd like to wear",
    "something taller than ten grown-ups",
    "a pigeon eating crumbs"
  ];
  var BEACH = [
    "a shell with a hole in it",
    "a smooth round stone",
    "a crab (or its footprints)",
    "a sandcastle (or build one!)",
    "a boat with a sail",
    "a seagull"
  ];
  var COUNTRY = {
    Greece: ["a windmill", "a white house with a blue door", "an olive tree", "a cat on a sunny step"],
    Italy: ["a Vespa scooter", "a pizza oven", "a balcony with washing hanging out", "a gelato shop with more than 20 flavours"],
    Spain: ["an orange tree", "a tile with a pattern on it", "a flamenco dress", "a plate of churros"],
    France: ["a baguette under someone's arm", "a carousel", "a striped shirt", "a bakery window full of cakes"],
    Portugal: ["a yellow tram", "a wall covered in blue tiles", "a custard tart", "a rooster (a statue or a picture)"],
    Croatia: ["a stone wall older than your grandparents' grandparents", "a boat with an eye painted on it", "a lavender plant"],
    "United Kingdom": ["a red postbox", "a red phone box", "a double-decker bus", "a dog in a coat"],
    "United States": ["a yellow school bus", "a fire hydrant", "a squirrel", "a flag with stars"],
    Mexico: ["a piñata", "a cactus", "a colourful papel picado banner", "a mariachi hat"],
    Japan: ["a red gate", "a vending machine", "a lucky cat statue", "a bento box"]
  };
  function beachy(P, pl) {
    var c = W.findCity && W.findCity(pl.country, pl.name);
    if (c && (c.t || []).indexOf("beach") > -1) return true;
    return P.days.some(function (d) {
      return (
        (d.city === pl.name || (d.trip && d.trip.name === pl.name)) &&
        (d.slots || []).some(function (x) {
          return x.item && !W.isFood(x.slot) && /beach|lido/.test(W.classify(x.item, false).kind || "");
        })
      );
    });
  }
  function finds(P, pl) {
    var pick = [],
      seed = hash(pl.key);
    function take(list, n) {
      var l = list.slice();
      for (var i = 0; i < n && l.length; i++) {
        var j = (seed + i * 7919) % l.length;
        pick.push(l.splice(j, 1)[0]);
      }
    }
    take(COUNTRY[pl.country] || [], 2);
    if (beachy(P, pl)) take(BEACH, 2);
    take(FINDS, 6 - pick.length);
    return pick;
  }
  /* A town's hunt is kept as it was when the first thing was found (S.hunt[town]._l), and each find is ticked by its
     words, not its place in the list: a re-plan that makes a town beachy (or not) changes the list, and a tick kept by
     position would then move to another thing. Ticks from before v177 were by position, on the list as it is made now. */
  function hunt(P, pl) {
    var t = (S().hunt || {})[pl.key] || {},
      list = Array.isArray(t._l) ? t._l : finds(P, pl);
    return {
      list: list,
      got: function (/** @type {number} */ i) {
        return !!(t[list[i]] || t[i]);
      }
    };
  }
  /* the list and its ticks for a town, for the tests */
  W.huntFinds = function (P, key) {
    var pl = places(P).filter(function (p) {
      return p.key === key;
    })[0];
    return pl ? hunt(P, pl).list : [];
  };
  /* tick or untick the i-th find of a town; the list is kept from now on (and old ticks by position become ticks by words) */
  function huntTick(P, pl, i) {
    var s = S(),
      hu = s.hunt || (s.hunt = {}),
      h = hunt(P, pl),
      f = h.list[i],
      t = /** @type {Record<string, any>} */ ({ _l: h.list.slice() });
    if (f == null) return h;
    h.list.forEach(function (x, j) {
      if (h.got(j)) t[x] = 1;
    });
    if (t[f]) delete t[f];
    else t[f] = 1;
    hu[pl.key] = t;
    return hunt(P, pl);
  }

  /* ---------- drawings: the night sky over the kids' corner, passport stamps, the treasure map's coins and chest ---------- */
  /* the logo's night scene (moon, stars, hills, the black cat), wide */
  var SKY =
    '<svg class="k-sky" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
    '<defs><linearGradient id="kSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C2F63"/><stop offset="1" stop-color="#5A65A3"/></linearGradient></defs>' +
    '<rect width="400" height="120" fill="url(#kSky)"/>' +
    '<g fill="#F3E7C4"><circle cx="38" cy="22" r="1.6"/><circle cx="96" cy="40" r="1.2"/><circle cx="150" cy="16" r="1.8"/><circle cx="212" cy="34" r="1.3"/><circle cx="262" cy="14" r="1.5"/><circle cx="372" cy="46" r="1.3"/><circle cx="296" cy="52" r="1"/><path d="m118 20 1.3 2.8 3 .400-2.2 2.1.500 3-2.6-1.4-2.7 1.4.500-3-2.1-2.1 3-.400z"/></g>' +
    '<circle cx="304" cy="32" r="16" fill="#F6EAC6"/><circle cx="311.5" cy="26.5" r="14" fill="#333A78"/>' +
    '<path d="M0 96 44 66l34 20 46-34 50 32 40-22 60 28 54-26 72 30v46H0z" fill="#2B305C"/><path d="M0 108q100-12 200-6t200-2v20H0z" fill="#3A3F61"/>' +
    '<g fill="#1B1B22" transform="translate(272 77)"><ellipse cx="17" cy="19" rx="17" ry="9"/><circle cx="35" cy="10" r="7.5"/><path d="m29 5 2-9 4 8zM37 4l4-8 1 10z"/><path d="M1 18Q-11 6-5-6" stroke="#1B1B22" stroke-width="4" fill="none" stroke-linecap="round"/></g>' +
    '<circle cx="305" cy="86" r="1.3" fill="#F2C94C"/><circle cx="310" cy="86" r="1.3" fill="#F2C94C"/></svg>';
  /* what a stamp shows in its middle (drawn in a 40 by 40 box, in the stamp's ink) */
  var LINE = ' fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  var MOTIF = {
    temple:
      '<path d="M3 13 20 4l17 9z"/><rect x="5" y="15" width="30" height="3"/><rect x="7" y="20" width="4" height="13"/><rect x="14.5" y="20" width="4" height="13"/><rect x="21.5" y="20" width="4" height="13"/><rect x="29" y="20" width="4" height="13"/><rect x="4" y="34.5" width="32" height="3.5"/>',
    dome: '<path d="M7 22a13 13 0 0 1 26 0z"/><rect x="18.5" y="3" width="3" height="7"/><rect x="5" y="24" width="30" height="3"/><rect x="8" y="29" width="4" height="9"/><rect x="18" y="29" width="4" height="9"/><rect x="28" y="29" width="4" height="9"/>',
    spire: '<path d="M20 2 23 16h-6zM16 18h8l3 10H13zM11 30h18l4 8h-9v-4h-8v4H7z"/>',
    gate: '<path d="M2 8q18 6 36 0v4q-18 6-36 0z"/><rect x="6" y="16" width="28" height="3"/><rect x="9" y="10" width="4" height="28"/><rect x="27" y="10" width="4" height="28"/>',
    sea: '<circle cx="20" cy="13" r="8"/><path d="M3 28c4-4 7-4 11 0s7 4 11 0 7-4 12 0M3 36c4-4 7-4 11 0s7 4 11 0 7-4 12 0"' + LINE + "/>",
    boat:
      '<path d="M21 3v22h13zM18 8v17H8z"/><path d="M4 28h32l-5 7H9z"/><path d="M3 39c4-3 7-3 11 0s7 3 11 0 7-3 12 0"' +
      LINE.replace('width="3"', 'width="2.2"') +
      "/>",
    peak: '<path d="M1 36 14 12l7 11 5-7 13 20z"/><circle cx="31" cy="8" r="4.5"/>',
    palm:
      '<path d="M19 38c0-9 1-15 3-20"' +
      LINE +
      '/><path d="M22 18c-6-5-12-4-16 0 5-1 10 0 16 0zM22 18c2-7 8-10 14-8-5 1-9 4-14 8zM22 18c5-2 11 0 14 5-5-3-9-4-14-5zM22 18c-3-6-9-8-14-6 5 1 9 3 14 6z"/><path d="M8 38q12-5 24 0z"/>',
    moon: '<path d="M29 25A13 13 0 0 1 15 8a13 13 0 1 0 14 17z"/><path d="m31 5 1.4 3 3.3.500-2.4 2.3.600 3.3-2.9-1.6-2.9 1.6.600-3.300L26.3 8.500l3.3-.500z"/>',
    tram:
      '<rect x="6" y="9" width="28" height="22" rx="5"/><path d="M12 9 16 3h8l4 6M10 36l3-5M30 36l-3-5"' +
      LINE.replace('width="3"', 'width="2.4"') +
      '/><rect x="10" y="13" width="8" height="8" rx="1.5" fill="var(--paper, #fff)"/><rect x="22" y="13" width="8" height="8" rx="1.5" fill="var(--paper, #fff)"/>'
  };
  var BY_COUNTRY = {
    Greece: "temple",
    Italy: "dome",
    France: "spire",
    Japan: "gate",
    Portugal: "tram",
    Croatia: "boat",
    Spain: "sea",
    Mexico: "palm",
    Thailand: "palm",
    "Costa Rica": "palm",
    Iceland: "peak",
    Switzerland: "peak",
    Austria: "peak"
  };
  var ANY = ["sea", "peak", "moon", "boat", "palm", "dome"];
  function motifOf(P, pl, i) {
    /* the first place in a country wears the country's sign; after that, the seaside gets a boat or the sea, the rest take turns */
    var first = places(P).filter(function (x) {
      return x.country === pl.country;
    })[0];
    if (BY_COUNTRY[pl.country] && first && first.key === pl.key) return BY_COUNTRY[pl.country];
    if (beachy(P, pl)) return hash(pl.key) % 2 ? "boat" : "sea";
    return ANY[(hash(pl.key) + i) % ANY.length];
  }
  function stampSvg(P, pl, i, on, line) {
    var name = pl.name.toUpperCase(),
      fit = name.length > 9 ? ' textLength="108" lengthAdjust="spacingAndGlyphs"' : "";
    var fit2 = line.length > 13 ? ' textLength="104" lengthAdjust="spacingAndGlyphs"' : "";
    return (
      '<svg class="st-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="stA' +
      i +
      '" d="M19 60a41 41 0 0 1 82 0"/><path id="stB' +
      i +
      '" d="M11 60a49 49 0 0 0 98 0"/></defs>' +
      '<g class="st-ink"' +
      (on ? ' filter="url(#rough)"' : "") +
      '><circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" stroke-width="3"' +
      (on ? "" : ' stroke-dasharray="5 6"') +
      "/>" +
      (on ? '<circle cx="60" cy="60" r="52.5" fill="none" stroke="currentColor" stroke-width="1"/>' : "") +
      '<circle cx="60" cy="60" r="33" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1 4.5" stroke-linecap="round"/>' +
      '<text class="st-n"' +
      fit +
      '><textPath href="#stA' +
      i +
      '" startOffset="50%" text-anchor="middle">' +
      esc(name) +
      "</textPath></text>" +
      '<text class="st-d"' +
      fit2 +
      '><textPath href="#stB' +
      i +
      '" startOffset="50%" text-anchor="middle">' +
      esc(line.toUpperCase()) +
      "</textPath></text>" +
      '<path d="m12 57 1.5 3.2 3.5.500-2.5 2.4.600 3.4-3.1-1.6-3.1 1.6.600-3.400L7 60.700l3.5-.500zM108 57l1.5 3.2 3.5.500-2.5 2.4.600 3.4-3.1-1.6-3.1 1.6.600-3.4-2.5-2.4 3.5-.500z" fill="currentColor" transform="translate(0 -4)"/>' +
      (on
        ? '<g transform="translate(40 40)" fill="currentColor">' + MOTIF[motifOf(P, pl, i)] + "</g>"
        : '<text class="st-q" x="60" y="72" text-anchor="middle">?</text>') +
      "</g></svg>"
    );
  }
  /* a treasure map's spot: a numbered X until it's found, then a gold coin */
  function spotSvg(n, on) {
    return on
      ? '<svg class="hk-svg" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21.5" r="16" fill="#B9791F"/><circle cx="20" cy="19" r="16" fill="#F2B94A"/><circle cx="20" cy="19" r="12" fill="none" stroke="#FFE6A6" stroke-width="1.6"/>' +
          '<path d="m20 9.5 2.8 5.7 6.3.900-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.900z" fill="#FFF3CF"/><path d="M9 12a13 13 0 0 1 7-6" fill="none" stroke="#FFF7DD" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg class="hk-svg" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 4.5" stroke-linecap="round" opacity=".55"/><text x="20" y="26.5" text-anchor="middle" class="hk-n">' +
          n +
          "</text></svg>";
  }
  function chestSvg(open) {
    var box =
      '<rect x="14" y="46" width="72" height="38" rx="5" fill="#8A4B2A"/><rect x="14" y="46" width="72" height="9" fill="#6B3A20"/><rect x="24" y="46" width="8" height="38" fill="#E2A93B"/><rect x="68" y="46" width="8" height="38" fill="#E2A93B"/><rect x="43" y="56" width="14" height="14" rx="3" fill="#F2C94C"/><circle cx="50" cy="62" r="2.3" fill="#6B3A20"/><rect x="49" y="62" width="2" height="5" fill="#6B3A20"/>';
    if (!open)
      return (
        '<svg class="k-chest" viewBox="0 0 100 92" aria-hidden="true"><path d="M14 46V34a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16v12z" fill="#A65C32"/><path d="M24 46V20.500a16 16 0 0 1 6-2.500h2v28zM68 46V18h2a16 16 0 0 1 6 2.500V46z" fill="#E2A93B"/>' +
        box +
        "</svg>"
      );
    return (
      '<svg class="k-chest open" viewBox="0 0 100 92" aria-hidden="true"><path d="M18 30 12 12a8 8 0 0 1 7.5-10.500h61A8 8 0 0 1 88 12l-6 18z" fill="#A65C32"/><path d="M27 30 23 1.500h8L34 30zM66 30l3-28.500h8L73 30z" fill="#E2A93B"/><path d="M18 30h64l4 16H14z" fill="#5A2F18"/>' +
      '<g fill="#F2B94A"><circle cx="34" cy="42" r="7"/><circle cx="50" cy="38" r="8"/><circle cx="66" cy="42" r="7"/><circle cx="42" cy="45" r="6"/><circle cx="58" cy="45" r="6"/></g><g fill="#FFE6A6"><circle cx="50" cy="38" r="4"/><circle cx="34" cy="42" r="3"/><circle cx="66" cy="42" r="3"/></g>' +
      box +
      '<g fill="#FFF3CF"><path d="m12 22 1.6 3.6 3.6 1.6-3.6 1.600L12 32.400l-1.6-3.6-3.6-1.6 3.6-1.600zM90 14l1.3 2.9 2.9 1.3-2.9 1.300L90 22.400l-1.3-2.9-2.9-1.3 2.9-1.300zM84 34l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z"/></g></svg>'
    );
  }

  /* ---------- the screen ---------- */
  W.renderKids = function (P) {
    var el = W.$("viewKids");
    if (!el) return;
    if (!P.stops.length) {
      el.innerHTML = '<div class="kids"><div class="empty sk">Plan a trip first, then the kids get their own corner here.</div></div>';
      return;
    }
    var kids = W.kidNames(13),
      tn = W.todayN(P);
    if (kday == null || kday > P.N) kday = tn || S().day || 1;
    var hi = kids.length ? "Hi " + (kids.length > 3 ? "everyone" : W.joinNames(kids)) + "!" : "Hi there, explorers!";
    var du = W.daysUntil ? W.daysUntil() : null;
    var sub = tn
      ? "Day " + tn + " of " + P.N + " of your adventure"
      : du != null && du > 0
        ? du === 1
          ? "Your adventure starts tomorrow!"
          : du + " sleeps until your adventure"
        : P.N + " days of adventure";
    var h =
      '<div class="kids"><button type="button" class="linkish back" data-view="' +
      (W.travelOn && W.travelOn(P) ? "go" : "trip") +
      '">' +
      W.arrow() +
      "Back to the grown-up plan</button>" +
      '<header class="k-hero">' +
      SKY +
      '<div class="k-hero-t"><h2>' +
      esc(hi) +
      "</h2><p>" +
      esc(sub) +
      "</p></div></header>" +
      '<div class="k-tabs" role="tablist" aria-label="For the kids">' +
      [
        ["today", "Our day"],
        ["pass", "Passport"],
        ["hunt", "Treasure hunt"]
      ]
        .map(function (t) {
          return '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-ktab="' + t[0] + '">' + t[1] + "</button>";
        })
        .join("") +
      "</div>";
    if (tab === "today") h += dayHtml(P, kids, tn);
    else if (tab === "pass") h += passHtml(P);
    else h += huntHtml(P, tn);
    el.innerHTML = h + "</div>";
  };
  function dayHtml(P, kids, tn) {
    var day = P.days[kday - 1],
      live = tn === kday,
      d = W.dateOf(day.n);
    var h =
      '<div class="k-day"><button type="button" class="k-arrow" data-kday="-1"' +
      (kday <= 1 ? " disabled" : "") +
      ' aria-label="The day before">' +
      W.icon("chevL", 2.4) +
      "</button>" +
      "<div><b>Day " +
      day.n +
      "</b><span>" +
      esc(d ? d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : day.city) +
      "</span></div>" +
      '<button type="button" class="k-arrow" data-kday="1"' +
      (kday >= P.N ? " disabled" : "") +
      ' aria-label="The next day">' +
      W.icon("chevR", 2.4) +
      "</button></div>";
    h +=
      '<h3 class="k-say">' +
      (live ? "Today we're going to…" : tn && kday < tn ? "On Day " + day.n + " we went to…" : "On Day " + day.n + " we're going to…") +
      "</h3>";
    if (day.moveFrom) {
      var L = W.legFor(P, day.stop);
      h +=
        '<div class="k-move">We\'re off to <b>' +
        esc(day.city) +
        "</b>" +
        (L && L.best ? " by " + esc(W.modeName(L.best.mode).toLowerCase()) : "") +
        "!</div>";
    } else if (day.trip) h += '<div class="k-move">A day out in <b>' + esc(day.trip.name) + "</b>!</div>";
    var T = day.slots && day.slots.length ? W.dayTimes(day, P) : null;
    var cards = (day.slots || [])
      .filter(function (x) {
        return x.item && !W.isFood(x.slot);
      })
      .map(function (x, i) {
        var it = x.item,
          pic = W.picture(it, false, day.country, x.trip ? day.trip.name : day.city),
          picks = W.kidPicks(it);
        var love = kids.length
          ? kids
              .map(function (k) {
                var on = picks.indexOf(k) > -1;
                return (
                  '<button type="button" class="k-heart' +
                  (on ? " on" : "") +
                  '" data-kpick="' +
                  esc(it.n) +
                  '" data-kname="' +
                  esc(k) +
                  '" aria-pressed="' +
                  on +
                  '"><span aria-hidden="true">' +
                  W.icon("heart", 2.1) +
                  "</span> " +
                  esc(k) +
                  "</button>"
                );
              })
              .join("")
          : '<button type="button" class="k-heart' +
            (picks.length ? " on" : "") +
            '" data-kpick="' +
            esc(it.n) +
            '" data-kname="kids" aria-pressed="' +
            !!picks.length +
            '"><span aria-hidden="true">' +
            W.icon("heart", 2.1) +
            "</span> We want to go!</button>";
        return (
          '<article class="k-card c' +
          (i % 6) +
          '">' +
          (pic ? '<div class="k-pic">' + pic + "</div>" : '<div class="k-pic none"><span>' + esc(it.n.charAt(0)) + "</span></div>") +
          '<div class="k-b"><span class="k-when">' +
          esc(W.SLOT_NAME[x.slot] || "") +
          (T && T.rows && T.rows[x.slot] ? " · " + esc(W.clock(T.rows[x.slot].start)) : "") +
          "</span><h4>" +
          esc(it.n) +
          "</h4>" +
          (it.d ? "<p>" + esc(it.d) + "</p>" : "") +
          '<div class="k-love">' +
          love +
          "</div></div></article>"
        );
      });
    h += cards.length
      ? '<div class="k-cards">' + cards.join("") + "</div>"
      : '<div class="k-move">A slow day: playground, pool and ice cream time!</div>';
    if (T && T.nap && W.party().toddler)
      h +=
        '<div class="k-nap"><span class="k-nap-i" aria-hidden="true">' +
        W.icon("nap", 2) +
        "</span> Nap time at " +
        esc(W.clock(T.nap.start)) +
        "</div>";
    var meals = (day.slots || [])
      .filter(function (x) {
        return x.item && W.isFood(x.slot) && x.slot !== "breakfast";
      })
      .map(function (x) {
        return "<li><b>" + esc(W.SLOT_NAME[x.slot]) + ":</b> " + esc(x.item.n) + "</li>";
      });
    if (meals.length) h += '<ul class="k-meals">' + meals.join("") + "</ul>";
    return h;
  }
  function passHtml(P) {
    var pl = places(P),
      got = pl.filter(stamped).length,
      kids = W.kidNames(13);
    var h =
      '<section class="k-book"><header class="k-book-h"><span class="k-book-e" aria-hidden="true">' +
      W.icon("explore", 1.9) +
      "</span><div><b>Passport</b><span>" +
      esc(kids.length ? W.joinNames(kids) : "Explorers") +
      " · " +
      esc(W.tripName ? W.tripName() : "Our trip") +
      "</span></div>" +
      '<span class="k-book-n"><b>' +
      got +
      "</b>/" +
      pl.length +
      "</span></header>" +
      '<p class="k-tip">A stamp lands when you get to each place. Tap one to stamp it yourself.' +
      (got === pl.length ? " <b>A full passport!</b>" : "") +
      '</p><div class="k-pass">';
    h += pl
      .map(function (p, i) {
        var st = stamped(p),
          d = W.dateOf(p.n);
        var line = st
          ? d
            ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : "Stamped"
          : p.trip
            ? "Day trip"
            : "Not yet";
        return (
          '<button type="button" class="stamp c' +
          (i % 6) +
          (st ? " on" : "") +
          '" data-stamp="' +
          esc(p.key) +
          '" aria-pressed="' +
          !!st +
          '"' +
          (st === "auto" ? " disabled" : "") +
          ' aria-label="' +
          esc(p.name + (st ? ", stamped" : ", not yet")) +
          '">' +
          stampSvg(P, p, i, !!st, line) +
          '<span class="st-in"><b>' +
          esc(p.name) +
          "</b><small>" +
          esc(line) +
          "</small></span></button>"
        );
      })
      .join("");
    return h + "</div></section>";
  }
  function huntHtml(P, tn) {
    var pl = places(P);
    if (
      !huntTown ||
      !pl.some(function (p) {
        return p.key === huntTown;
      })
    ) {
      var dd = P.days[(tn || W.S.day || 1) - 1],
        cur = dd && dd.trip ? W.cityKey(dd.trip.country, dd.trip.name) : dd ? W.cityKey(dd.country, dd.city) : pl[0].key;
      huntTown = pl.some(function (p) {
        return p.key === cur;
      })
        ? cur
        : pl[0].key;
    }
    var p = pl.filter(function (x) {
        return x.key === huntTown;
      })[0],
      hh = hunt(P, p),
      list = hh.list,
      got = hh.got,
      n = list.filter(function (x, i) {
        return got(i);
      }).length;
    var h =
      '<div class="k-towns">' +
      pl
        .map(function (x) {
          return (
            '<button type="button" class="chip' +
            (x.key === huntTown ? " on" : "") +
            '" data-ktown="' +
            esc(x.key) +
            '" aria-pressed="' +
            (x.key === huntTown) +
            '">' +
            esc(x.name) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    var all = n === list.length;
    h +=
      '<section class="k-map"><p class="k-count">Can you find these in <b>' +
      esc(p.name) +
      "</b>? <span>" +
      n +
      " of " +
      list.length +
      " found</span></p>";
    h +=
      '<ol class="k-hunt">' +
      list
        .map(function (f, i) {
          return (
            '<li><button type="button" class="' +
            (got(i) ? "on" : "") +
            '" data-hunt="' +
            esc(p.key) +
            '" data-hi="' +
            i +
            '" aria-pressed="' +
            got(i) +
            '"><span class="hk" aria-hidden="true">' +
            spotSvg(i + 1, got(i)) +
            "</span><span>" +
            esc(f.charAt(0).toUpperCase() + f.slice(1)) +
            "</span></button></li>"
          );
        })
        .join("") +
      "</ol>";
    h +=
      '<div class="k-treasure' +
      (all ? " open" : "") +
      '">' +
      chestSvg(all) +
      "<p>" +
      (all
        ? "<b>You opened the treasure chest!</b> Every one found in " + esc(p.name) + "."
        : "<b>" + (list.length - n) + " to go.</b> Find them all to open the treasure chest.") +
      "</p></div></section>";
    return h;
  }

  /* ---------- taps ---------- */
  document.addEventListener(
    "click",
    function (e) {
      var b = e.target && e.target.closest && e.target.closest("button");
      if (!b || !b.closest("#viewKids")) return;
      var d = b.dataset,
        s = S(),
        P = W.P;
      if (d.view) return;
      e.stopPropagation();
      if (d.ktab) {
        tab = d.ktab;
        W.render();
        window.scrollTo(0, 0);
        return;
      }
      if (d.kday) {
        kday = Math.max(1, Math.min(P.N, kday + +d.kday));
        W.render();
        return;
      }
      if (d.ktown) {
        huntTown = d.ktown;
        W.render();
        return;
      }
      if (W.readOnly) return;
      if (d.kpick && d.kname) {
        var kp = s.kidPicks || (s.kidPicks = {}),
          k = W.norm(d.kpick),
          list = kp[k] || (kp[k] = []),
          at = list.indexOf(d.kname);
        if (at > -1) list.splice(at, 1);
        else list.push(d.kname);
        if (!list.length) delete kp[k];
        W.save();
        W.render();
        if (at < 0) W.cheer(d.kname === "kids" ? "Picked!" : d.kname + " picked it!", "It shows on the grown-ups' plan too.");
        return;
      }
      if (d.stamp) {
        var st = s.stamps || (s.stamps = {});
        if (st[d.stamp]) delete st[d.stamp];
        else {
          st[d.stamp] = W.isoDay(W.now());
          W.cheer("Stamped!", "Another one for the passport.");
        }
        W.save();
        W.render();
        return;
      }
      if (d.hunt) {
        var town = places(P).filter(function (x) {
          return x.key === d.hunt;
        })[0];
        if (!town) return;
        var i = Number(d.hi),
          h2 = huntTick(P, town, i),
          n = h2.list.filter(function (x, j) {
            return h2.got(j);
          }).length;
        W.save();
        W.render();
        if (h2.got(i) && n === h2.list.length) W.cheer("Treasure hunters!", "You found everything in " + town.name + "!", { big: true });
        else if (h2.got(i)) W.cheer("Found it!", n + " of " + h2.list.length + " in " + town.name + ".");
        return;
      }
    },
    true
  );
})();
