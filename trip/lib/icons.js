/* Waypoint's own icons: one hand for every picture in the app. Drawn on a 24 grid with a round 1.9 line in the header's
   sunset gradient (#wpIg in index.html: indigo to rose to orange), and one small shape (class "ia") filled with the
   same gradient, lighter: the pin on the map, the sun on the calendar, the needle of the compass. Where an icon sits on
   colour (the header, a selected tab or switch, a button, a photo) it is drawn in the text colour instead, its small
   shape in moon gold (app.css, "the icon set"). W.icon(name, weight, cls) gives the picture; weight is the line's width
   on the 24 grid (thicker for pictures shown small: 2.5 at 16 px, 2.1 at 20 px). */
(function () {
  "use strict";
  var W = window.W;
  var I = {
    /* the four tabs */
    plan: '<path d="M3.5 6.6 9 4.5l6 2.1 5.5-2.1v12.9L15 19.5l-6-2.1-5.5 2.1z"/><path d="M9 4.5v12.9M15 6.6v12.9" opacity=".55"/><circle class="ia" cx="12" cy="11.2" r="2.3"/>',
    trip: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle class="ia" cx="15.6" cy="15" r="2.2"/>',
    prepare:
      '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z"/><path d="M15 6.5v11" stroke-dasharray="1.6 2.2"/><path class="ia" d="m9.2 9 .95 1.95 2.15.3-1.55 1.5.37 2.15-1.92-1.02-1.92 1.02.37-2.15-1.55-1.5 2.15-.3z"/>',
    today:
      '<path class="ia" d="M20.5 3.5 10.6 13.4l2.9 7.1z"/><path d="M20.5 3.5 3.5 10.5l7.1 2.9 2.9 7.1z"/><path d="M20.5 3.5 10.6 13.4"/>',
    /* the views of a trip */
    day: '<path d="M9.5 6h10.5M9.5 12h10.5M9.5 18h10.5"/><circle class="ia" cx="4.8" cy="6" r="1.7"/><circle class="ia" cx="4.8" cy="12" r="1.7"/><circle class="ia" cx="4.8" cy="18" r="1.7"/>',
    explore:
      '<circle cx="12" cy="12" r="8.8"/><path class="ia" d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
    alldays:
      '<rect x="3.5" y="4.5" width="17" height="15.5" rx="2.8"/><path d="M3.5 9.5h17M9.2 9.5V20M14.8 9.5V20M3.5 14.7h17"/><rect class="ia" x="9.9" y="10.2" width="4.2" height="3.8" rx=".7"/>',
    /* getting there */
    train:
      '<rect class="ia" x="7.3" y="5.3" width="9.4" height="3.6" rx="1"/><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10.5h14M8.5 20.5 10 16M15.5 20.5 14 16"/><circle cx="9" cy="13.3" r=".5" fill="currentColor"/><circle cx="15" cy="13.3" r=".5" fill="currentColor"/>',
    ferry:
      '<path class="ia" d="M8 7.6h8v3.4H8z"/><path d="M2.5 19c1.6 1.2 3.2 1.2 4.8 0 1.6-1.2 3.2-1.2 4.8 0 1.6 1.2 3.2 1.2 4.8 0 1.6-1.2 3.2-1.2 4.8 0"/><path d="M4.5 15.5 3.5 11h17l-1 4.5"/><path d="M7.5 11V7h9v4M12 7V4"/>',
    bus: '<rect class="ia" x="6.6" y="5.2" width="10.8" height="3.6" rx="1"/><rect x="4.5" y="3" width="15" height="14" rx="3"/><path d="M4.5 10.5h15M8 20.5V17M16 20.5V17"/><circle cx="8.3" cy="13.8" r=".5" fill="currentColor"/><circle cx="15.7" cy="13.8" r=".5" fill="currentColor"/>',
    flight:
      '<circle class="ia" cx="19" cy="5.5" r="2.2"/><path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2.2 1.6V21l3.7-1 3.7 1v-1.4L13 18v-5z"/>',
    car: '<path class="ia" d="m7.6 11.6 1.5-3.9h5.8l1.5 3.9z"/><path d="M5 16.5V12l2-5h10l2 5v4.5z"/><path d="M5 12h14"/><circle cx="8.5" cy="16.5" r="1.8" fill="var(--surface, #fff)"/><circle cx="15.5" cy="16.5" r="1.8" fill="var(--surface, #fff)"/>',
    walk: '<circle class="ia" cx="13" cy="4.6" r="2"/><path d="m9 21 2.2-5.6L9.5 13l1.2-4.6 3 1.2 1.6 3 2.7 1M15 21l-1.2-4.6"/>',
    /* a day's small signs */
    bed: '<circle class="ia" cx="7" cy="11.4" r="2"/><path d="M3 19V6.5M3 15h18v4M21 15v-2.4a3 3 0 0 0-3-3h-6.8V15"/>',
    moon: '<path class="ia" d="M19 14.6A8 8 0 0 1 9.4 5 8 8 0 1 0 19 14.6z"/><path d="M19 14.6A8 8 0 0 1 9.4 5 8 8 0 1 0 19 14.6z"/><path d="M17.5 4.2v2.6M16.2 5.5h2.6" stroke-width="1.5"/>',
    sun: '<circle class="ia" cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.8V12l3.4 2.1"/><circle class="ia" cx="12" cy="12" r="1.5"/>',
    reroll: '<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6"/><path d="M18.4 3.6v4h-4M5.6 20.4v-4h4"/>',
    star: '<path class="ia" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    heart:
      '<path class="ia" d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
    /* the trip menu */
    plancheck:
      '<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5V3.6h6v.9"/><path d="M9 3.6h6v2.6H9z"/><path d="m8.6 13.2 2.3 2.3 4.5-5"/>',
    settings:
      '<path d="M4 7.5h8M18 7.5h2M4 16.5h2M12 16.5h8"/><circle class="ia" cx="15" cy="7.5" r="2.6"/><circle cx="15" cy="7.5" r="2.6"/><circle class="ia" cx="9" cy="16.5" r="2.6"/><circle cx="9" cy="16.5" r="2.6"/>',
    /* what a stop offers */
    dir: '<path d="M12 3 21 12l-9 9-9-9z"/><path d="M9.6 14.4v-2.6c0-.9.6-1.6 1.6-1.6h3.2M13.2 8.4l1.8 1.8-1.8 1.8"/>',
    /* Prepare's tabs (on a phone the five tabs are pictures over short words) */
    wallet:
      '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1.5 1.5 0 0 1 1.5 1.5V8"/><path d="M3.5 7.5v10A2.5 2.5 0 0 0 6 20h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19 8H6a2.5 2.5 0 0 1-2.5-.5"/><circle class="ia" cx="16.5" cy="14" r="1.6"/>',
    bag: '<rect x="3.5" y="7.5" width="17" height="12.5" rx="2.5"/><path d="M8.5 7.5V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5v2"/><path d="M3.5 12.5h17"/><rect class="ia" x="10.5" y="11" width="3" height="3" rx=".8"/>',
    save: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2"/>',
    ticket:
      '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2.2"/><circle class="ia" cx="9" cy="12" r="1.9"/>',
    swap: '<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6"/><path d="M18.4 3.6v4h-4M5.6 20.4v-4h4"/><circle class="ia" cx="12" cy="12" r="2"/>',
    move: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 15h7M13 12.5l2.5 2.5-2.5 2.5"/>',
    order: '<path d="M7.5 4.5v15M4 8l3.5-3.5L11 8"/><path d="M16.5 19.5v-15M13 16l3.5 3.5L20 16"/>',
    free: '<circle cx="12" cy="12" r="8.5"/><path d="m7.8 16.2 8.4-8.4"/>',
    no: '<path d="M16 13.8V4.2M16 13.8l-3.6 6.3a1.9 1.9 0 0 1-2.4-1.8v-3.3H5.6a2 2 0 0 1-2-2.3l1-6.7a2.2 2.2 0 0 1 2.2-1.8H16"/><path class="ia" d="M16 4.2h4v9.6h-4z"/><path d="M16 4.2h4v9.6h-4z"/>',
    photo:
      '<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle class="ia" cx="9" cy="10" r="2.2"/><path d="m4 18 5.5-5 3.5 3 3-2.5 4 4.5"/>',
    map: '<path d="M3.5 6.6 9 4.5l6 2.1 5.5-2.1v12.9L15 19.5l-6-2.1-5.5 2.1z"/><path d="M9 4.5v12.9" opacity=".55"/><path class="ia" d="M15.2 17.6s-3.4-3-3.4-5.6a3.4 3.4 0 0 1 6.8 0c0 2.6-3.4 5.6-3.4 5.6z"/>',
    food: '<path d="M6.5 3.5v6a2.5 2.5 0 0 0 5 0v-6M9 3.5v17"/><path class="ia" d="M16 3.5c-1.7 1.6-2.5 3.8-2.5 6.3 0 1.6.9 2.6 2.5 2.9z"/><path d="M16 3.5c-1.7 1.6-2.5 3.8-2.5 6.3 0 1.6.9 2.6 2.5 2.9V3.5zM16 12.7v7.8"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle class="ia" cx="12" cy="10.4" r="2.6"/>',
    home: '<path d="M4 11 12 4l8 7v8.5h-5.2V14H9.200v5.5H4z"/><rect class="ia" x="9.9" y="14.7" width="4.2" height="4.8"/>',
    /* a route's verdicts */
    ok: '<circle cx="12" cy="12" r="8.8"/><path d="m8 12.4 2.8 2.8 5.2-5.8"/>',
    warn: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.4M12 17v.1"/>',
    tip: '<path class="ia" d="M8.2 14.4a5.6 5.6 0 1 1 7.6 0c-.7.7-1 1.3-1 2.100H9.200c0-.8-.3-1.4-1-2.100z"/><path d="M8.2 14.4a5.6 5.6 0 1 1 7.6 0c-.7.7-1 1.3-1 2.100H9.200c0-.8-.3-1.4-1-2.100zM9.8 19.500h4.4"/>',
    /* small controls (no gold: they are punctuation) */
    more: '<circle cx="5" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle class="ia" cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9" fill="currentColor" stroke="none"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 6.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevR: '<path d="m9 4.5 7.5 7.500L9 19.5"/>',
    chevL: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
    chevD: '<path d="m4.5 9 7.5 7.500L19.5 9"/>',
    chevU: '<path d="m4.5 15 7.5-7.5 7.5 7.5"/>',
    arrowR: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    arrowL: '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
    /* what kind of stop it is (W.kindIcon) */
    kCafe:
      '<path d="M5 9.500h11v4.500a4.500 4.500 0 0 1-4.500 4.500h-2A4.500 4.500 0 0 1 5 14z"/><path d="M16 11h1.500a2 2 0 0 1 0 4H16"/><path d="M8.500 3.500v2.500M12 3.500v2.500"/>',
    kGelato: '<path d="M7.500 10a4.500 4.500 0 0 1 9 0z"/><path d="M8.200 10 12 20.500 15.800 10"/>',
    kWine: '<path d="M8 3.500h8l-.600 5a3.400 3.400 0 0 1-6.800 0z"/><path d="M12 12v7.500M8.500 19.500h7"/>',
    kBeach:
      '<path d="M4 11.500a8 8 0 0 1 16 0z"/><path d="M12 11.500v6"/><path d="M4 20.500c1.300-1 2.700-1 4 0s2.700 1 4 0 2.700-1 4 0 2.700 1 4 0"/>',
    kMountain: '<path d="M2.500 19.500 9.500 6.500l4 7 2.500-3.500 5.500 9.500z"/>',
    kRuins: '<path d="M4 8.500 12 4l8 4.500z"/><path d="M6.500 8.500v9M10.200 8.500v9M13.800 8.500v9M17.500 8.500v9M4 20h16"/>',
    kChurch:
      '<path d="M12 2.500v5M10 4.500h4"/><path d="M7 20.500V12l5-4.500 5 4.500v8.500z"/><path d="M10.500 20.500v-4a1.500 1.500 0 0 1 3 0v4"/>',
    kMuseum:
      '<rect x="4" y="5" width="16" height="14" rx="1.500"/><path d="M4 15.500 8.500 11l3.500 3 2.500-2 5.500 4.500"/><circle cx="15.500" cy="9" r="1.200"/>',
    kCastle:
      '<path d="M5 20.500V9.500L4 8.500v-4h3V7h2.500V4.500h5V7H17V4.500h3v4l-1 1v11z"/><path d="M10 20.500V16a2 2 0 0 1 4 0v4.500"/>',
    kTown: '<path d="M3.500 20v-9.500L8 7l4.500 3.500V20"/><path d="M12.500 20v-6.500l4-3 4 3V20"/><path d="M2.500 20h19"/>',
    kBoat: '<path d="M12 3.500v10"/><path d="M12 5l6 8.500h-6z"/><path d="M3.500 16h17l-2 4.500h-13z"/>',
    kPark: '<path d="M12 21v-5.500"/><path d="M12 3.500a5 5 0 0 0-4.600 7 4 4 0 0 0 1.600 5h6a4 4 0 0 0 1.600-5A5 5 0 0 0 12 3.500z"/>',
    kMarket:
      '<path d="M4 9.500 5.500 4.500h13L20 9.500"/><path d="M4 9.500a2.700 2.700 0 0 0 5.300 0 2.700 2.700 0 0 0 5.400 0 2.700 2.700 0 0 0 5.300 0"/><path d="M5.500 12.500V20h13v-7.500"/>',
    kView:
      '<path d="M3 17.500h18M6 21h12"/><path d="M7 17.500a5 5 0 0 1 10 0"/><path d="M12 6.500V9M5.800 9.800l1.700 1.700M18.200 9.800l-1.700 1.700"/>',
    kWater: '<path d="M12 3.500c3.500 4.500 5.500 7.500 5.500 10.500a5.500 5.500 0 0 1-11 0c0-3 2-6 5.500-10.500z"/>',
    kFun: '<circle cx="12" cy="10.500" r="7"/><path d="M12 3.500v7M5 10.500h14M9 21l3-10.500L15 21"/>',
    nap: '<path class="ia" d="M18 14.800A7 7 0 0 1 9.7 6.4 7 7 0 1 0 18 14.800z"/><path d="M18 14.800A7 7 0 0 1 9.7 6.4 7 7 0 1 0 18 14.800z"/><path d="M14.5 3.500h4l-4 4.500h4" stroke-width="1.6"/>'
  };
  W.ICONS = I;
  /** @param {string} name @param {number} [weight] the line's width on the 24 grid @param {string} [cls] */
  W.icon = function (name, weight, cls) {
    return (
      "<svg" +
      (cls ? ' class="' + cls + '"' : "") +
      ' data-i="' +
      name +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="url(#wpIg)" stroke-width="' +
      (weight || 1.9) +
      '" stroke-linecap="round" stroke-linejoin="round">' +
      (I[name] || "")
        .replace(/class="ia"/g, 'class="ia" fill="url(#wpIg)"')
        .replace(/fill="currentColor"/g, 'fill="url(#wpIg)" class="if"') +
      "</svg>"
    );
  };
  /* the arrow before "Back" and after "See my trip": drawn, so it sits on the words' middle line in every font
     (the font's own "←" sat low on phones) */
  /* the icon for what a stop is: a meal by its kind (a cup for breakfast and cafés, a cone for gelato, a glass for a
     wine bar, else a knife and fork), a sight by the picture kind it was listed with, else by its tags, else a pin */
  var KIND = {
    beach: "kBeach",
    island: "kBoat",
    harbor: "kBoat",
    mountain: "kMountain",
    gorge: "kMountain",
    cave: "kMountain",
    ruins: "kRuins",
    temple: "kRuins",
    church: "kChurch",
    museum: "kMuseum",
    castle: "kCastle",
    oldtown: "kTown",
    square: "kTown",
    bridge: "kTown",
    park: "kPark",
    garden: "kPark",
    market: "kMarket",
    viewpoint: "kView",
    lake: "kWater",
    waterfall: "kWater",
    spa: "kWater",
    nightlife: "moon",
    themepark: "kFun",
    zoo: "kFun",
    vineyard: "kWine"
  };
  var TAGK = {
    beach: "kBeach",
    mountain: "kMountain",
    culture: "kRuins",
    nature: "kPark",
    scenic: "kView",
    nightlife: "moon",
    shopping: "kMarket",
    food: "food",
    wellness: "kWater",
    adventure: "kMountain"
  };
  W.kindIcon = function (it, food, slot) {
    if (food)
      return slot === "breakfast" || /^(cafe|bakery)$/.test(it.pic || "")
        ? "kCafe"
        : it.pic === "gelato"
          ? "kGelato"
          : it.pic === "wine"
            ? "kWine"
            : "food";
    if (KIND[it.pic]) return KIND[it.pic];
    var t = (it.t || []).filter(function (x) {
      return TAGK[x];
    })[0];
    return t ? TAGK[t] : "pin";
  };
  /* a stop's letter. Google Maps letters a route A, B, C from where it starts, and the day's route starts where you're
     staying: so the stay is A and the day's first stop is B, here, on the map's pins and in Google Maps alike */
  W.stopTag = function (n) {
    return n >= 0 && n <= 25 ? String.fromCharCode(65 + n) : String(n);
  };
  /* a stop's marker: the icon for what it is, with its letter as a small tag (the letter is what ties a row to its pin) */
  W.stopMark = function (it, food, slot, n) {
    return (
      '<span class="num ki' +
      (food ? " f" : "") +
      '">' +
      W.icon(W.kindIcon(it, food, slot), 2.1) +
      '<i class="nb">' +
      W.stopTag(n) +
      "</i></span>"
    );
  };
  W.homeMark = function () {
    return '<span class="rc-hi" aria-hidden="true">' + W.icon("home", 2.4) + '<i class="nb">A</i></span>';
  };
  /* the menu, as a button: a menu card */
  I.menu =
    '<path d="M6.500 3.500h11A1.500 1.500 0 0 1 19 5v14a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19V5a1.500 1.500 0 0 1 1.500-1.500z"/><path d="M9 7.500v2.200a1.400 1.400 0 0 0 2.800 0V7.500M10.400 9.700v3.800"/><path d="M14.800 7.500v6"/><path d="M8.500 16.800h7"/>';
  W.arrow = function (dir) {
    return W.icon(dir === "r" ? "arrowR" : "arrowL", 2.3, "arr" + (dir === "r" ? " arr-r" : ""));
  };
})();
