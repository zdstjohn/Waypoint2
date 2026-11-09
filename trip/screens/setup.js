/* Waypoint setup view (second script): trip style, where, how long, from where, who, and where you're staying. */
(function () {
  "use strict";
  var W = window.W, $ = W.$, esc = W.esc, S = W.S;

  /* every country, named in the viewer's language */
  var CODES = "AD AE AF AG AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW".split(" ");
  var names = [];
  try { var dn = new Intl.DisplayNames(["en"], { type: "region" }); names = CODES.map(function (c) { return dn.of(c); }); } catch (e) {}
  Object.keys(window.TD).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); });
  names.sort();
  $("countryList").innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
  $("airportList").innerHTML = window.AIRPORTS.map(function (a) { return '<option value="' + esc(a[0] + " (" + a[1] + ")") + '">'; }).join("");
  function countryName(v) {
    var k = W.norm(v); if (!k) return "";
    var aliases = { usa: "United States", "united states of america": "United States", us: "United States", uk: "United Kingdom", england: "United Kingdom", scotland: "United Kingdom", holland: "Netherlands" };
    if (aliases[k]) return aliases[k];
    return names.filter(function (n) { return W.norm(n) === k; })[0] || v.trim().replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }
  W.countryName = countryName;
  var openBrowse = {};
  var ageLabel = function (a) { return a < 2 ? "Baby" : a < 5 ? "Toddler" : a < 13 ? "Child" : a < 18 ? "Teen" : a >= 65 ? "Grandparent" : "Adult"; };   /* 65 and over: shorter days, fewer moves */

  var openStay = W.openStay = W.openStay || {};   /* which cities have their lodging panel open (made in lib/core.js: Trip and Today open one before this script has come) */
  var X_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  var UP_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 13V3M4 7l4-4 4 4"/></svg>';
  var BED_ICON = '<svg viewBox="0 0 20 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3v11M2 10h16v4M18 10V8a2 2 0 0 0-2-2H9v4"/><circle cx="5.5" cy="7.5" r="1.6"/></svg>';
  var CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';

  /* one row per stop: its days, its dates and where you're staying */
  function stayDatesFor(s) {
    var P = W.P, si = P.stops.indexOf(s), f = P.days.filter(function (d) { return d.stop === si; })[0], a = f && W.dateOf(f.n), n = s.days - (si === P.stops.length - 1 ? 1 : 0);
    if (!a || n < 1) return {}; var b = new Date(a); b.setDate(b.getDate() + n); return { in: W.isoDay(a), out: W.isoDay(b) };
  }
  function stopRow(s, i, c, ci, dayN) {
    var ck = W.cityKey(s.country, s.name), info = W.findCity(s.country, s.name), j = c.mode === "manual" ? c.picked.indexOf(s.name) : -1;
    var from = dateOf(dayN), to = dateOf(dayN + s.days - 1), hb = W.homebase(s.country, s.name), open = !!openStay[ck];
    var geoBusy = Object.keys(W.status).some(function (k) { return k.indexOf("geo|" + ck) === 0 && W.status[k] === "loading"; });
    var sub = [from ? (from === to ? from : from + " – " + to) : "", info && info.d || ""].filter(Boolean).join(" · ");
    if (!hb.set && W.sampleState !== "off") { var cur = W.C.city[ck]; if (!cur || cur.lodgeFor !== W.lodgeSig() || !cur.lodgeAsked) W.loadLodging(s.country, s.name); }
    return '<div class="stop" id="stop-' + i + '"><div class="stop-h"><div class="nm">' + esc(s.name) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>" +
      '<div class="stepper sm"><button type="button" data-cdays="' + i + '" data-delta="-1" aria-label="One day less in ' + esc(s.name) + '"' + (s.days <= 1 ? " disabled" : "") + ">−</button>" +
      '<input id="cdays' + i + '" type="number" min="1" max="30" value="' + s.days + '" data-cdin="' + i + '" aria-label="Days in ' + esc(s.name) + '">' +
      '<button type="button" data-cdays="' + i + '" data-delta="1" aria-label="One more day in ' + esc(s.name) + '"' + (s.days >= 30 ? " disabled" : "") + ">+</button></div></div>" +
      paceRow(s, i) +
      '<div class="stop-a"><button type="button" class="stay-btn' + (hb.set ? " set" : "") + '" data-openstay="' + i + '" aria-expanded="' + open + '">' + BED_ICON +
      "<span>" + (geoBusy ? "Locating…" : hb.set ? "<b>" + esc(hb.label) + "</b>" : "Where to stay") + "</span>" + CHEV + "</button>" +
      (j > 0 ? '<button type="button" class="icon-btn" data-up="' + j + '" data-ci="' + ci + '" aria-label="Visit ' + esc(s.name) + ' earlier">' + UP_ICON + "</button>" : "") +
      '<button type="button" class="icon-btn" data-rmstop="' + i + '" aria-label="Remove ' + esc(s.name) + '">' + X_ICON + "</button></div>" +
      (open ? '<div class="stay-panel"><div class="row"><input class="field" id="stayIn' + i + '" placeholder="Already booked? Hotel name or address" value="' + esc((S.stays[ck] || {}).label || "") + '"><button type="button" class="btn quiet" data-setstay="' + i + '">Set</button></div>' + (W.liveStays ? W.liveStays(s, W.P) : "") + lodgeCards(s, i) + (W.altLinksFor ? W.altLinksFor("stay", { s: s, dates: stayDatesFor(s) }) : "") + "</div>" : "") +
      "</div>";
  }

  /* suggested stay for one place: enough to see the sights, or a relaxed pace */
  function paceRow(s, i) {
    var r = W.stayRange(s.country, s.name);
    if (!r) {
      var busy = Object.keys(W.status).some(function (k) { return k.indexOf("range|") === 0 && W.status[k] === "loading"; });
      return busy ? '<div class="pace small muted"><span class="loading">Suggested stay…</span></div>' : "";
    }
    function chip(n, what) { return '<button type="button" class="chip pace-chip" data-pace="' + i + '" data-d="' + n + '" aria-pressed="' + (s.days === n) + '" title="Suggested stay ' + (what === "Sights" ? "to see the main sights" : "for a relaxed pace") + '">' + what + " · " + n + " day" + (n === 1 ? "" : "s") + "</button>"; }
    return '<div class="pace" role="group" aria-label="Suggested stay in ' + esc(s.name) + '">' + (r.s === r.r ? chip(r.s, "Suggested") : chip(r.s, "Sights") + chip(r.r, "Relaxed")) + "</div>";
  }

  function countryBlock(c, ci, P, starts) {
    var cities = W.countryCities(c.name), loadingList = W.status["country|" + c.name] === "loading";
    var h = '<div class="country"><div class="country-h"><h3>' + esc(c.name) + '</h3><div class="row">' +
      '<div class="seg" role="group" aria-label="How to pick cities in ' + esc(c.name) + '">' +
      '<button type="button" data-mode="suggest" data-ci="' + ci + '" aria-pressed="' + (c.mode !== "manual") + '">Suggest cities</button>' +
      '<button type="button" data-mode="manual" data-ci="' + ci + '" aria-pressed="' + (c.mode === "manual") + '">I\'ll choose</button></div>' +
      '<button type="button" class="icon-btn" data-rmcountry="' + ci + '" aria-label="Remove ' + esc(c.name) + '" title="Remove ' + esc(c.name) + '">' + X_ICON + "</button></div></div>";
    var rows = "";
    P.stops.forEach(function (s, i) { if (s.country === c.name) rows += stopRow(s, i, c, ci, starts[i]); });
    if (c.mode !== "manual") {
      return h + (rows ? '<div class="stops">' + rows + '</div><p class="small muted">Suggested for your days and who\'s going. Change anything to make it yours.</p>'
        : loadingList ? '<div class="loading">Finding destinations in ' + esc(c.name) + "…</div>" : '<p class="small muted">' + (W.sampleState === "off" ? "Switch to “I'll choose” and type the cities you want." : "Getting destinations…") + "</p>") + "</div>";
    }
    h += rows ? '<div class="stops">' + rows + "</div>" : '<p class="small muted">No cities yet. Search below or tap one to add it.</p>';
    h += '<div class="row"><input class="field" id="cityIn' + ci + '" list="cl' + ci + '" placeholder="Add any city, town or island">' +
      '<datalist id="cl' + ci + '">' + cities.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc(x.region || "") + "</option>"; }).join("") + "</datalist>" +
      '<button type="button" class="btn" data-addcity="' + ci + '">Add</button></div>';
    var popular = cities.filter(function (x) { return c.picked.indexOf(x.name) < 0; }).sort(function (a, b) { return (b.pop || 4) - (a.pop || 4); }).slice(0, 5);
    if (popular.length) h += '<div class="chips">' + popular.map(function (x) { return '<button type="button" class="chip" data-pick="' + esc(x.name) + '" data-ci="' + ci + '">+ ' + esc(x.name) + "</button>"; }).join("") +
      (!loadingList && cities.length > 5 ? '<button type="button" class="linkish" data-browse="' + ci + '">' + (openBrowse[c.name] ? "Hide list" : "Browse all " + cities.length) + "</button>" : "") + "</div>";
    if (loadingList) h += '<div class="loading">Loading every destination in ' + esc(c.name) + "…</div>";
    else if (openBrowse[c.name]) {
      var byRegion = {};
      cities.forEach(function (x) { (byRegion[x.region || "Popular"] = byRegion[x.region || "Popular"] || []).push(x); });
      h += '<div class="browse">' + Object.keys(byRegion).sort().map(function (r) {
        return "<h4>" + esc(r) + '</h4><div class="chips">' + byRegion[r].map(function (x) {
          return '<button type="button" class="chip" data-pick="' + esc(x.name) + '" data-ci="' + ci + '" aria-pressed="' + (c.picked.indexOf(x.name) > -1) + '" title="' + esc(x.d || "") + '">' + esc(x.name) + "</button>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    }
    return h + "</div>";
  }

  /* three places to stay per stop: budget, mid-range and a splurge, each with its own reroll */
  var ICON_REROLL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 2.5v3h-3"/></svg>';
  var TYPE_NAME = { hotel: "Hotel", apartment: "Apartment", guesthouse: "Guesthouse", hostel: "Hostel", resort: "Resort", villa: "Villa" };
  function lodgeCards(s, i) {
    if (W.sampleState === "off") return "";
    var ck = W.cityKey(s.country, s.name), cur = W.C.city[ck], sig = W.lodgeSig(), key = "lodge|" + ck + "|" + sig;
    if (!cur || cur.lodgeFor !== sig || !cur.lodgeAsked) W.loadLodging(s.country, s.name);
    var err = W.status[key] && W.status[key] !== "loading" ? W.status[key] : "", stay = S.stays[ck] || /** @type {Partial<Stay>} */ ({});
    var cards = W.TIERS.map(function (t) {
      var it = W.lodgeShown(s.country, s.name, t), tn = W.TIER_NAME[t];
      var more = Object.keys(W.status).some(function (k) { return k.indexOf(key + "|" + t + "|") === 0 && W.status[k] === "loading"; });
      var head = '<div class="lodge-h"><span class="tier t-' + t + '">' + tn + "</span>" +
        (it ? '<button type="button" class="icon-btn" data-lreroll="' + t + '" data-si="' + i + '" aria-label="Show a different ' + tn.toLowerCase() + " place in " + esc(s.name) + '" title="Show a different one">' + ICON_REROLL + "</button>" : "") + "</div>";
      if (!it) return '<div class="lodge">' + head + '<p class="small muted">' + (err ? "" : W.status[key] === "loading" || more ? '<span class="loading">Finding places…</span>' : "No pick yet.") + "</p></div>";
      var on = stay.label === it.n, ph = W.picture(it, false, s.country, s.name, { credit: true });
      return '<div class="lodge' + (on ? " on" : "") + '">' + (ph ? '<div class="pic-wrap">' + ph + "</div>" : "") + head +
        "<h4>" + esc(it.n) + "</h4>" + '<div class="small muted">' + esc([TYPE_NAME[it.type] || "", it.area].filter(Boolean).join(" · ")) + "</div>" +
        (it.d ? '<p class="small">' + esc(it.d) + "</p>" : "") +
        (it.price ? '<div class="lprice" title="Typical price per night">~' + esc(it.price.replace(/^~\s*/, "")) + (/night/i.test(it.price) ? "" : " <span>/ night</span>") + "</div>" : "") +
        '<div class="lodge-a"><button type="button" class="btn quiet sm" data-lstay="' + t + '" data-si="' + i + '" aria-pressed="' + on + '">' + (on ? "✓ Staying here" : "Stay here") + "</button>" +
        '<a class="price" href="' + esc(W.priceUrl(it, s.name)) + '" target="_blank" rel="noopener">Compare prices</a>' +
        '<a href="' + esc(W.photosUrl(it.n, s.name)) + '" target="_blank" rel="noopener">Photos</a>' +
        '<a href="' + esc(W.gmapsPlace(it, s.name)) + '" target="_blank" rel="noopener">Map</a>' +
        (it.site ? '<a href="' + esc(it.site) + '" target="_blank" rel="noopener">Website</a>' : "") + "</div></div>";
    });
    return '<div class="lodges-h">Or pick one of these</div><div class="lodges">' + cards.join("") + "</div>" +
      (err ? '<p class="small muted">' + esc(err) + ' <button type="button" class="linkish" data-lretry="' + i + '">Try again</button></p>' : "");
  }

  /* the whole trip at either pace: every place's suggested stay added up */
  function paceTotals(P) {
    var t = { s: 0, r: 0, any: false };
    P.stops.forEach(function (x) { var r = W.stayRange(x.country, x.name); if (r) t.any = true; t.s += r ? r.s : x.days; t.r += r ? r.r : x.days; });
    return t;
  }
  function paceAll(P) {
    if (P.stops.length < 1) return "";
    if (W.sampleState !== "off") W.loadStayRanges(P.stops);
    var t = paceTotals(P); if (!t.any) return "";
    var on = function (k) { return P.stops.every(function (x) { var r = W.stayRange(x.country, x.name); return !r || x.days === r[k]; }); };
    return '<div class="pace-all"><span class="small muted">Suggested for your cities</span><div class="chips">' +
      '<button type="button" class="chip pace-chip" data-paceall="s" aria-pressed="' + on("s") + '">Sightseeing · ' + t.s + " days</button>" +
      (t.r !== t.s ? '<button type="button" class="chip pace-chip" data-paceall="r" aria-pressed="' + on("r") + '">Relaxed · ' + t.r + " days</button>" : "") + "</div></div>";
  }

  /* the overall feel of the trip, over and above its interests */
  var FOCUS_OPTS = [["icons", "The famous sights"], ["both", "Icons and surprises"], ["gems", "Where locals go"]];
  /* what each interest turns into under each choice: [the famous version, the local version] */
  var STYLE_FEEL = {
    relax: ["the classic cafés and promenades", "quiet squares where locals linger"], adventure: ["the headline hikes and outdoor trips", "lesser-known trails and outdoor spots"],
    food: ["the legendary restaurants and markets", "family-run tavernas and neighbourhood bakeries"], beach: ["the famous beaches", "quiet coves locals love"],
    mountain: ["the classic peaks and viewpoints", "hidden mountain villages and trails"], culture: ["the landmark museums and monuments", "small museums and old churches off the main streets"],
    nature: ["the best-known parks and reserves", "quiet gorges, springs and nature spots"], nightlife: ["the famous evening spots", "the bars locals go to"],
    shopping: ["the main shopping streets", "local markets and craft workshops"], family: ["the big family favourites", "the playgrounds and farms local families love"],
    wellness: ["the best-known spas", "local hot springs and quiet retreats"], scenic: ["the iconic viewpoints", "secret viewpoints"]
  };
  function focusNote(fc) {
    var st = S.styles.filter(function (x) { return STYLE_FEEL[x]; }).slice(0, 3);
    var bits = st.map(function (x) { var f = STYLE_FEEL[x]; return fc === "icons" ? f[0] : fc === "gems" ? f[1] : f[0] + " plus " + f[1]; });
    var list = bits.length > 2 ? bits.slice(0, -1).join(", ") + ", and " + bits[bits.length - 1] : bits.join(" and ");
    if (!list) return fc === "icons" ? "Expect the sights a first visit shouldn't miss, and the best-reviewed places to eat." : fc === "gems" ? "Expect the places locals love that most visitors miss. All well reviewed." : "Expect the famous highlights with a few lesser-known gems mixed in. All well reviewed.";
    return "Expect " + list + ". All well reviewed.";
  }

  /* a foldable step; while folded, its header sums up what you chose */
  var DONE = {}, FIRST = null;
  function step(id, n, title, sum, body) {
    var sc = (S.stepClosed || {})[id], open = sc === undefined ? id === FIRST : !sc, done = !!DONE[id];
    return '<details class="step sk' + (done ? " done" : "") + '" data-fold="step-' + id + '"' + (open ? " open" : "") + '><summary class="step-h"><b' + (done ? ' aria-label="done"' : "") + ">" + (done ? "✓" : n) + "</b><h2>" + title + '</h2><span class="sum">' + esc(sum) + "</span>" + CHEV + "</summary>" + body + "</details>";
  }

  W.renderSetup = function (P) {
    var h = "", p = W.party();
    /* going to a city's "where to stay" opens the step it lives in */
    if (W.scrollToStop != null) (S.stepClosed || (S.stepClosed = {})).where = false;
    var RC = P.stops.length ? W.routeBody(P) : null;
    DONE = { style: S.styles.length > 0, who: (S.travelers || []).length > 0 && !!S.depart, eat: !!(W.eatNeeds && W.eatNeeds()) || !!S.eatNone, long: !!S.start, where: P.stops.length > 0, check: !!RC && !RC.warn };
    FIRST = ["style", "who", "eat", "long", "where", "check"].filter(function (k) { return !DONE[k] && (k !== "check" || (RC && RC.body)); })[0] || null;
    if (!S.countries.length && !W.readOnly) h = '<div class="qs-card sk"><div><b>Start with three questions</b><span class="small muted">Where, when and who. You get a full day-by-day plan you can change.</span></div><button type="button" class="btn" data-quick="1">Quick start</button>' +
      '<p class="small muted qs-imp">Planned it in Wanderlog or a doc already? <a href="#settings" data-view="settings">Import it</a></p></div>' + h;

    /* 1 · what kind of trip */
    var fc = W.focus();
    h += step("style", "01", "What kind of trip?", [W.FOCUS[fc]].concat(S.styles.map(function (x) { return W.STYLE_NAME[x]; })).join(" · "),
      '<div class="focus" role="radiogroup" aria-label="What to see">' + FOCUS_OPTS.map(function (o) {
        return '<button type="button" role="radio" data-focus="' + o[0] + '" aria-checked="' + (fc === o[0]) + '"><b>' + esc(W.FOCUS[o[0]]) + "</b><span>" + esc(o[1]) + "</span></button>";
      }).join("") + "</div>" +
      '<p class="fld-l">Interests</p><div class="chips">' + window.STYLES.map(function (s) { return '<button type="button" class="chip" data-style="' + s[0] + '" aria-pressed="' + (S.styles.indexOf(s[0]) > -1) + '">' + esc(s[1]) + "</button>"; }).join("") + "</div>" +
      '<p class="focus-note">' + esc(focusNote(fc)) + "</p>");

    /* 2 · who's going, and from where */
    var who = W.familyLine && W.familyLine() || (p.adults ? p.adults + " adult" + (p.adults === 1 ? "" : "s") : "") + (p.kids.length ? ", " + p.kids.length + " kid" + (p.kids.length === 1 ? "" : "s") + " (" + p.kids.join(", ") + ")" : "");
    h += step("who", "02", "Who's going?", [who, S.depart ? "from " + S.depart : ""].filter(Boolean).join(" · ") || "Add travelers",
      '<label class="fld" for="depart"><span>Flying from</span><input class="field" id="depart" list="airportList" value="' + esc(S.depart) + '" placeholder="Your home city or airport"></label>' +
      '<div class="fld"><span>Travelers</span><div class="travs">' +
      S.travelers.map(function (a, i) {
        var nm = (S.names || [])[i] || "";
        return '<div class="trav"><label class="role" for="nm' + i + '">' + (a === "" ? "Traveler" : ageLabel(+a)) + "</label>" +
          '<input class="field tnm" id="nm' + i + '" data-tname="' + i + '" value="' + esc(nm) + '" placeholder="Name" maxlength="20" autocomplete="off" aria-label="Name of traveler ' + (i + 1) + '">' +
          '<div class="age"><input class="field" id="age' + i + '" type="number" min="0" max="110" inputmode="numeric" value="' + esc(a) + '" data-age="' + i + '" placeholder="?" aria-label="Age of traveler ' + (i + 1) + '"><span class="small muted">yrs</span></div>' +
          (S.travelers.length > 1 ? '<button type="button" class="icon-btn" data-rmtrav="' + i + '" aria-label="Remove traveler ' + (i + 1) + '">' + X_ICON + "</button>" : "") + "</div>";
      }).join("") +
      '<button type="button" class="trav add" id="addAdult">+ Adult</button><button type="button" class="trav add" id="addChild">+ Child</button></div></div>');

    /* 3 · what you eat: allergies, diets, likes, before any restaurant is suggested */
    var eat = S.eat || {}, eatSum = W.eatText ? W.eatText() : "";
    h += step("eat", "03", "What do you eat?", eatSum ? eatSum.charAt(0).toUpperCase() + eatSum.slice(1) : S.eatNone ? "Nothing special" : "Allergies, diets, favorites",
      '<p class="fld-l">Allergies (anyone in the group)</p><div class="chips">' + W.EAT_AL.map(function (a) { return '<button type="button" class="chip" data-eatal="' + a[0] + '" aria-pressed="' + ((eat.al || []).indexOf(a[0]) > -1) + '">' + esc(a[1]) + "</button>"; }).join("") + "</div>" +
      '<p class="fld-l">Diet</p><div class="chips">' + W.EAT_DI.map(function (a) { return '<button type="button" class="chip" data-eatdi="' + a[0] + '" aria-pressed="' + ((eat.di || []).indexOf(a[0]) > -1) + '">' + esc(a[1]) + "</button>"; }).join("") + "</div>" +
      '<label class="fld" for="eatLove"><span>Food you love</span><input class="field" id="eatLove" data-eat="love" maxlength="120" value="' + esc(eat.love || "") + '" placeholder="Grilled fish, pizza, mezze" autocomplete="off"></label>' +
      '<label class="fld" for="eatAvoid"><span>Rather avoid</span><input class="field" id="eatAvoid" data-eat="avoid" maxlength="120" value="' + esc(eat.avoid || "") + '" placeholder="Very spicy food, raw fish" autocomplete="off"></label>' +
      '<label class="fld" for="eatNote"><span>Anything else</span><input class="field" id="eatNote" data-eat="note" maxlength="200" value="' + esc(eat.note || "") + '" placeholder="Our 4-year-old only eats plain pasta" autocomplete="off"></label>' +
      '<p class="small muted">Restaurant ideas are chosen with these in mind, places that can\'t feed you are never planned, and each meal says what you can have. With allergies, always tell the staff: no app can promise a kitchen is safe.</p>' +
      (!eatSum && !S.eatNone ? '<div><button type="button" class="btn quiet sm" data-eatnone="1">Nothing special</button></div>' : ""));

    /* 4 · how long: the total, or the sum of each place's days once you've set them */
    var allSet = P.stops.length && P.stops.every(function (s) { return s.set; }), anySet = P.stops.some(function (s) { return s.set; });
    h += step("long", "04", "How long?", P.N + " days" + (dateOf(1) ? " · from " + dateOf(1) : ""),
      '<div class="row">' +
      (allSet ? '<div class="total-days" aria-live="polite">' + P.N + "</div>"
        : '<div class="stepper"><button type="button" id="daysMinus" aria-label="Fewer days">−</button><input id="days" type="number" min="2" max="60" value="' + S.days + '" aria-label="Number of days"><button type="button" id="daysPlus" aria-label="More days">+</button></div>') +
      '<span class="muted">days, starting</span><input class="field" id="startDate" type="date" value="' + esc(S.start) + '" style="flex:0 1 180px" aria-label="Start date (optional)"></div>' +
      paceAll(P) +
      (anySet ? '<p class="small muted">' + (allSet ? "The total of each place's days." : "Places you set keep their days.") + ' <button type="button" class="linkish" data-resetdays="1">Use suggested split</button></p>' : ""));

    /* 4 · where: every stop with its days and lodging, in travel order */
    var starts = [], dn = 1; P.stops.forEach(function (s) { starts.push(dn); dn += s.days; });
    h += step("where", "05", "Where to?", P.stops.map(function (s) { return s.name; }).join(" → ") || "Add a country",
      S.countries.map(function (c, i) { return countryBlock(c, i, P, starts); }).join("") +
      '<div class="row add-country"><input class="field" id="countryIn" list="countryList" placeholder="' + (S.countries.length ? "Add another country" : "Add a country") + '"><button type="button" class="btn' + (S.countries.length ? " quiet" : "") + '" id="addCountry">Add</button></div>');

    /* 5 · route check */
    if (P.stops.length) { if (RC.body) h += step("check", "06", "Trip shape", RC.sum, RC.body).replace('class="step sk"', 'class="step sk rtcheck' + (RC.warn ? " has-warn" : "") + '"'); }
    h += '<div class="cta"><button type="button" class="btn" data-view="trip">See my trip →</button></div>';
    var el = $("viewSetup"), a = document.activeElement, id = a && a.id, val = a && a.value, sel = a && a.selectionStart;
    el.innerHTML = h;
    if (id && $(id)) { var n = $(id); if (n.value !== val && n.tagName === "INPUT" && n.type !== "number" && n.type !== "date") n.value = val; n.focus(); try { if (sel != null) n.setSelectionRange(sel, sel); } catch (e) {} }
    if (W.scrollToStop != null) { var st = $("stop-" + W.scrollToStop); W.scrollToStop = null; if (st) st.scrollIntoView({ block: "start" }); }
  };

  function dateOf(n) {
    if (!S.start) return "";
    var d = new Date(S.start + "T12:00:00"); if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + n - 1);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ---------- actions ---------- */
  /* set one place's days: everything on screen stays as it is (same cities, same days elsewhere) and the trip length follows */
  /* set every place to its sightseeing or relaxed stay (places without a suggestion keep their days) */
  function setPace(which, P) {
    if (!P.stops.length) return;
    setCityDays(0, P.stops[0].days, P);   /* freezes the city list and current days */
    P.stops.forEach(function (x) { var r = W.stayRange(x.country, x.name); if (r) S.cityDays[W.cityKey(x.country, x.name)] = r[which]; });
    S.days = P.stops.reduce(function (a, x) { return a + S.cityDays[W.cityKey(x.country, x.name)]; }, 0);
  }
  function setCityDays(i, val, P) {
    var s = P && P.stops[i]; if (!s) return;
    S.cityDays = S.cityDays || {};
    S.countries.forEach(function (c) {
      if (c.mode === "manual") return;
      var mine = P.stops.filter(function (x) { return x.country === c.name; }).map(function (x) { return x.name; });
      if (mine.length) { c.picked = mine; c.mode = "manual"; }
    });
    P.stops.forEach(function (x) { S.cityDays[W.cityKey(x.country, x.name)] = x.days; });
    S.cityDays[W.cityKey(s.country, s.name)] = Math.max(1, Math.min(30, Math.round(+val) || 1));
    S.days = P.stops.reduce(function (a, x) { return a + S.cityDays[W.cityKey(x.country, x.name)]; }, 0);
  }

  function addCountry() {
    var v = countryName($("countryIn").value); if (!v) return;
    if (!S.countries.some(function (c) { return c.name === v; })) S.countries.push({ name: v, mode: "suggest", picked: [] });
    W.loadCountry(v); W.render();
  }
  function addCity(i) {
    var inp = $("cityIn" + i), v = inp && inp.value.trim(); if (!v) return;
    var c = S.countries[i], known = W.findCity(c.name, v), name = known ? known.name : v.replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    if (c.picked.indexOf(name) < 0) c.picked.push(name);
    inp.value = ""; W.render(); var again = $("cityIn" + i); if (again) again.focus();
  }
  function setStay(i, P) {
    var s = P.stops[i]; if (!s) return;
    var ck = W.cityKey(s.country, s.name), v = ($("stayIn" + i).value || "").trim();
    if (!v) { delete S.stays[ck]; W.render(); return; }
    S.stays[ck] = { label: v }; openStay[ck] = false;
    W.geocode(s.country, s.name, v, function (g) { if (S.stays[ck] && S.stays[ck].label === v) { S.stays[ck].lat = g.lat; S.stays[ck].lng = g.lng; W.freshPicks(s.country, s.name); W.changed(); } });
    W.render();
  }

  W.setupClick = function (b, d, P) {
    if (W.importClick(d)) return;
    if (W.liveClick && W.liveClick(d, P)) { W.render(); return; }
    if (W.watchClick && W.watchClick(d, P)) { W.render(); return; }
    if (d.routeorder != null || d.fold || d.unfold || d.nights || (d.legpick != null && d.legkey)) { W.routeClick(d, P); W.render(); return; }
    if (d.rest) { var rs = S.rest || (S.rest = {}); if (rs[d.rest]) delete rs[d.rest]; else rs[d.rest] = 1; W.render(); return; }
    /* food needs: a chip on or off; "Nothing special" marks the step done */
    if (d.eatal || d.eatdi) {
      var ea = S.eat || (S.eat = {}), f = d.eatal ? "al" : "di", v = d.eatal || d.eatdi, arr = ea[f] || (ea[f] = []), at = arr.indexOf(v);
      if (at > -1) arr.splice(at, 1); else arr.push(v);
      delete S.eatNone; W.render(); return;
    }
    if (d.eatnone) { S.eatNone = 1; (S.stepClosed || (S.stepClosed = {})).eat = true; W.render(); return; }
    var ci = d.ci != null ? +d.ci : null, c = ci != null ? S.countries[ci] : null;
    if (d.style) { var k = S.styles.indexOf(d.style); if (k > -1) S.styles.splice(k, 1); else S.styles.push(d.style); W.resetPicks(); }
    /* the overall feel: re-plan the days around it (any choice, even the default, once tapped) */
    else if (d.focus && W.FOCUS[d.focus]) { if (S.focus !== d.focus) { S.focus = d.focus; W.freshAll(); } }   /* stops you chose yourself stay */
    else if (d.mode && c) {
      if (d.mode === "manual" && c.mode !== "manual" && !c.picked.length) c.picked = P.stops.filter(function (s) { return s.country === c.name; }).map(function (s) { return s.name; });
      c.mode = d.mode; if (d.mode === "manual") W.loadCountry(c.name);
    }
    else if (d.rmcountry != null) S.countries.splice(+d.rmcountry, 1);
    else if (d.openstay != null) {
      var os = P.stops[+d.openstay]; if (!os) return false;
      var ok = W.cityKey(os.country, os.name), oi = +d.openstay, panel = document.querySelector("#stop-" + oi + " .stay-panel");
      if (openStay[ok] && panel) { W.fxCollapse(panel, function () { openStay[ok] = false; W.render(); }); return false; }
      openStay[ok] = true; W.fxAfter(function () { W.fxExpand("#stop-" + oi + " .stay-panel"); W.fxStagger("#stop-" + oi + " .lodge", { step: 60 }); });
    }
    else if (d.rmstop != null) {
      /* removing a suggested city turns that country into your own list, minus this city */
      var gone = P.stops[+d.rmstop], rc = gone && S.countries.filter(function (x) { return x.name === gone.country; })[0];
      if (rc) {
        if (rc.mode !== "manual") { rc.picked = P.stops.filter(function (x) { return x.country === rc.name; }).map(function (x) { return x.name; }); rc.mode = "manual"; }
        rc.picked.splice(rc.picked.indexOf(gone.name), 1);
      }
    }
    else if (d.pick && c) { var j = c.picked.indexOf(d.pick); if (j > -1) c.picked.splice(j, 1); else c.picked.push(d.pick); }
    else if (d.unpick && c) c.picked.splice(c.picked.indexOf(d.unpick), 1);
    else if (d.up && c) { var u = +d.up, t = c.picked[u]; c.picked[u] = c.picked[u - 1]; c.picked[u - 1] = t; }
    else if (d.addcity != null) return addCity(+d.addcity);
    else if (d.browse != null) { var nm = S.countries[+d.browse].name; openBrowse[nm] = !openBrowse[nm]; if (openBrowse[nm]) W.fxAfter(function () { W.fxExpand(".browse", { reveal: false }); }); }
    else if (d.setstay != null) return setStay(+d.setstay, P);
    else if (d.stayarea != null) {
      var s = P.stops[+d.stayarea], pool = W.C.city[W.cityKey(s.country, s.name)], area = pool.stay.filter(function (x) { return x.n === d.name; })[0];
      S.stays[W.cityKey(s.country, s.name)] = { label: area.n, lat: area.lat, lng: area.lng }; W.freshPicks(s.country, s.name);
    }
    else if (d.lreroll && d.si != null) { var ls = P.stops[+d.si], li = +d.si, lt = d.lreroll; if (ls) W.lodgeReroll(ls.country, ls.name, lt); W.fxAfter(function () { var r = document.querySelector("#stop-" + li + ' [data-lreroll="' + lt + '"]'); W.fxPulse(r && r.closest(".lodge")); }); }
    else if (d.lstay && d.si != null) {
      var lsp = P.stops[+d.si], lit = lsp && W.lodgeShown(lsp.country, lsp.name, d.lstay); if (!lit) return false;
      var lck = W.cityKey(lsp.country, lsp.name);
      if (S.stays[lck] && S.stays[lck].label === lit.n) delete S.stays[lck];
      else {
        S.stays[lck] = { label: lit.n, lat: lit.lat, lng: lit.lng };
        /* fold the picks away, then show the chosen place on the city's row */
        var lsi = +d.si, lpanel = document.querySelector("#stop-" + lsi + " .stay-panel");
        W.freshPicks(lsp.country, lsp.name);
        if (lpanel) { W.fxCollapse(lpanel, function () { openStay[lck] = false; W.fxAfter(function () { W.fxPulse("#stop-" + lsi + " .stay-btn"); }); W.render(); }, { dur: 260 }); return false; }
        openStay[lck] = false;
      }
      W.freshPicks(lsp.country, lsp.name);   /* the days regroup around where you're staying */
    }
    else if (d.lretry != null) { var lr = P.stops[+d.lretry]; if (lr) { var lk = "lodge|" + W.cityKey(lr.country, lr.name) + "|" + W.lodgeSig(); delete W.status[lk]; W.loadLodging(lr.country, lr.name); } }
    else if (d.cdays != null) { var cs = P.stops[+d.cdays]; if (cs) setCityDays(+d.cdays, cs.days + (+d.delta || 0), P); }
    else if (d.pace != null) { setCityDays(+d.pace, +d.d, P); var pi = +d.pace; W.fxAfter(function () { W.fxPulse("#cdays" + pi); }); }
    else if (d.paceall) { setPace(d.paceall, P); W.fxAfter(function () { W.fxStagger(".stop .stepper input", { y: 0, step: 50 }); W.fxPulse(".total-days"); }); }
    else if (d.resetdays) P.stops.forEach(function (x) { delete S.cityDays[W.cityKey(x.country, x.name)]; });
    else if (d.rmtrav != null) { S.travelers.splice(+d.rmtrav, 1); if (S.names) S.names.splice(+d.rmtrav, 1); W.resetPicks(); }
    else if (b.id === "addCountry") return addCountry();
    else if (b.id === "addAdult" || b.id === "addChild") { S.travelers.push(b.id === "addAdult" ? 35 : 6); W.resetPicks(); W.fxAfter(function () { var t = document.querySelectorAll(".travs .trav:not(.add)"); W.fxPulse(t[t.length - 1]); }); }
    else if (b.id === "daysMinus" || b.id === "daysPlus") S.days = Math.max(2, Math.min(60, (+S.days || 10) + (b.id === "daysPlus" ? 1 : -1)));
    else return false;
    W.render(); return true;
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
    else if (t.dataset.eat) { var ea2 = S.eat || (S.eat = {}); ea2[t.dataset.eat] = t.value.trim().slice(0, t.dataset.eat === "note" ? 200 : 120); delete S.eatNone; }
    else if (t.dataset.tname != null) { S.names = S.names || []; while (S.names.length < S.travelers.length) S.names.push(""); S.names[+t.dataset.tname] = t.value.trim().slice(0, 20); W.save(); }
    else if (t.dataset.age != null) { S.travelers[+t.dataset.age] = t.value === "" ? "" : Math.max(0, Math.min(110, +t.value)); W.resetPicks(); }
    else if (t.id === "cityIn" + t.id.slice(6) && /^cityIn\d+$/.test(t.id)) {
      /* picking from the suggestion list adds it straight away */
      var i = +t.id.slice(6), c = S.countries[i]; if (c && W.findCity(c.name, t.value)) return addCity(i);
      return;
    }
    else return;
    W.render();
  };
})();
