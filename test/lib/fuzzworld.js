/* The world the random-trip test plans in (test/suites/fuzz.js). It runs in the page. From one seed it builds a trip
   nobody wrote by hand and the places it is planned from, so the planner meets what a real trip meets:

   the trip     1–3 countries, towns chosen or suggested (towns of one island, a town and its neighbour), 1–21 days,
                days set per town (a one-day stop too), any party (adults, children, toddlers, grandparents), start
                dates on daylight-saving changes, month ends and a leap day, a departure airport near or far (jet lag)
   the places   every town gets its own lists, made here, with pins: compact towns, and islands and regions whose
                ideas lie in areas tens of kilometres apart; opening hours, closing days, closures for part of the
                year, places closed for good, unverified ones; timed entries; hikes; day outs; the same place under
                two names, under one Google ID, or as two outings at one real place; names that are no real place;
                train rides; restaurants that open late, cafés, bakeries and ice-cream shops
   the journeys ways between towns from half an hour to nine hours, a chosen way, booked tickets with their times
   by hand      stays with a pin (central or far out), rest days, parts of a day left free, places chosen by hand
                (any place of the list: closed, far, already on another day), places ticked as booked, a table
                booked for a day, days made day trips
   afterwards   more ideas arrive, the nightly check closes places and adds hours, and the trip is planned again

   After each planning the plan is read by W.checkPlan (lib/rules.js: the owner's nine rules) and by a few checks of
   its own (the days asked for, each in a chosen town; nothing chosen by hand changed by planning). Nothing here
   asks Claude: the loaders are switched off, and the lists are written straight into the cache, as lists kept from
   before are (so nothing has been through lib/validate.js: the planner itself must refuse what the rules forbid). */
module.exports = function () {
  var W = window.W;
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var STYLES = window.STYLES.map(function (s) { return s[0]; }), FOCUS = ['icons', 'both', 'gems'];
  var AIR = ['Los Angeles (LAX)', 'New York (JFK)', 'London (LHR)', 'Sydney (SYD)', 'Rome (FCO)'];
  /* daylight-saving changes (Europe, the Americas, the south), month ends, a year's end, a leap day */
  var DATES = ['2027-03-26', '2027-03-27', '2027-10-29', '2027-10-30', '2027-03-12', '2027-11-05', '2027-04-02', '2027-09-25', '2027-01-29', '2027-02-26', '2028-02-27', '2027-04-29', '2027-12-28', '2027-07-30', '2027-08-31', '2027-05-31'];
  var once = false;
  function quiet() {
    if (once) return; once = true;
    /* nothing is asked of Claude or the network, and nothing is written to the phone: the lists are made here */
    ['loadCity', 'loadCountry', 'mealIdeas', 'growIdeas', 'loadEatFit', 'loadLoved', 'loadFame', 'loadTz', 'legAsk', 'stayRetry', 'geocode'].forEach(function (k) { if (W[k]) W[k] = function () { return ''; }; });
    W.save = function () {}; W.holdLoads = true;
  }

  /* ---------- the trip ---------- */
  function trip(seed) {
    var r = rng(seed), countries = Object.keys(window.TD), nC = r() < 0.6 ? 1 : int(r, 2, 3), cs = [];
    while (cs.length < nC) { var c = pick(r, countries); if (cs.indexOf(c) < 0) cs.push(c); }
    var spec = { seed: seed, countries: [], cityDays: {}, travelers: [], styles: [] };
    cs.forEach(function (c) {
      var all = W.countryCities(c).filter(function (x) { return x.lat != null && x.lng != null; }), built = window.TD[c].cities.map(function (x) { return x.name; });
      var n = int(r, 0, 4), picked = [];
      for (var g = 0; picked.length < n && g < 40; g++) {
        var x = null, m = r();
        if (m < 0.5 || !all.length) x = pick(r, built);
        else if (m < 0.8 && picked.length) {
          /* a neighbour of a town already chosen: another town on its island, the next town along */
          var base = W.findCity(c, picked[picked.length - 1]);
          var near = all.filter(function (y) { var k = base && W.km(base, y); return k != null && k > 3 && k < 120; });
          x = near.length ? pick(r, near).name : pick(r, built);
        } else x = pick(r, all).name;
        if (x && picked.indexOf(x) < 0) picked.push(x);
      }
      picked.forEach(function (name) { if (r() < 0.3) spec.cityDays[c + '|' + name] = r() < 0.3 ? 1 : int(r, 2, 7); });
      spec.countries.push({ name: c, mode: picked.length ? 'manual' : 'suggest', picked: picked });
    });
    spec.days = r() < 0.08 ? int(r, 1, 2) : int(r, 3, 21);
    spec.start = r() < 0.4 ? pick(r, DATES) : '2027-' + pad(int(r, 1, 12)) + '-' + pad(int(r, 1, 28));
    spec.depart = pick(r, AIR);
    var nA = int(r, 1, 3), nK = int(r, 0, 3), nS = r() < 0.3 ? int(r, 1, 2) : 0;
    for (var i = 0; i < nA; i++) spec.travelers.push(int(r, 25, 45));
    for (i = 0; i < nK; i++) spec.travelers.push(r() < 0.4 ? int(r, 0, 4) : int(r, 5, 17));
    for (i = 0; i < nS; i++) spec.travelers.push(int(r, 65, 80));
    var nSt = int(r, 0, 4); while (spec.styles.length < nSt) { var st = pick(r, STYLES); if (spec.styles.indexOf(st) < 0) spec.styles.push(st); }
    spec.focus = pick(r, FOCUS);
    return spec;
  }

  /* ---------- a town's places ---------- */
  var SIGHTS = [
    /* [name, part of the day, how long, tags, hours or null, ticket] */
    ['Archaeological Museum', 'am', '2h', ['culture'], [540, 1020, [1]], '€12'], ['Cathedral', 'am', '1h', ['culture'], [600, 1110, []], 'Free'],
    ['Castle', 'am', '2h', ['culture', 'scenic'], [570, 1080, [2]], '€10, book ahead'], ['Old Quarter', 'pm', '2h', ['culture', 'shopping'], null, 'Free'],
    ['Covered Market', 'am', '1h', ['food', 'shopping'], [480, 840, [0]], 'Free'], ['City Beach', 'pm', '3h', ['beach', 'relax', 'family'], null, 'Free'],
    ['Botanical Garden', 'pm', '1.5h', ['nature', 'relax', 'family'], [600, 1080, []], '€6'], ['Gorge Hike', 'am', '', ['adventure', 'nature'], null, 'Free'],
    ['Summit Trail Walk', 'am', '4h', ['adventure', 'mountain'], null, 'Free'], ['Harbour Promenade', 'eve', '1h', ['relax', 'scenic'], null, 'Free'],
    ['Sunset Viewpoint', 'eve', '1h', ['scenic'], null, 'Free'], ['Flamenco Show', 'eve', '1.5h', ['nightlife', 'culture'], [1170, 1410, [1]], '€25, book ahead'],
    ['Night Market', 'eve', '1.5h', ['food', 'shopping'], [1080, 1380, [2, 3]], 'Free'], ['Science Museum', 'pm', '2h', ['family', 'culture'], [600, 1080, [1]], '€14, timed entry'],
    ['Aquarium', 'pm', '2h', ['family', 'nature'], [570, 1140, []], '€18'], ['Playground Park', 'pm', '1h', ['family', 'relax'], null, 'Free'],
    ['Boat Tour', 'am', '3h', ['adventure', 'scenic'], [540, 1020, []], '€40, book ahead'], ['Wine Tasting', 'pm', '2h', ['food'], [660, 1080, [0]], '€30'],
    ['Thermal Spa', 'pm', '2h', ['wellness', 'relax'], [600, 1260, []], '€35'], ['Art Gallery', 'pm', '1.5h', ['culture'], [660, 1140, [1, 2]], '€9'],
    ['Lighthouse', 'pm', '1h', ['scenic'], null, 'Free'], ['Monastery', 'am', '1h', ['culture', 'scenic'], [540, 780, []], '€4'],
    ['Lagoon', 'any', '', ['beach', 'nature', 'scenic'], null, 'Free'], ['National Park', 'any', 'Full day', ['nature', 'adventure'], null, '€8'],
    ['Island Cruise', 'any', '', ['scenic', 'beach'], [480, 1140, []], '€60, book ahead'], ['Water Park', 'any', '5h', ['family'], [600, 1080, []], '€28'],
    ['Hilltop Village', 'any', '3h', ['scenic', 'culture'], null, 'Free'], ['Evening Stroll', 'eve', '1h', ['relax'], null, 'Free'],
    ['Rooftop Cocktails', 'eve', '1.5h', ['nightlife'], [1080, 1500, []], '€€'], ['Open-air Cinema', 'eve', '2h', ['nightlife', 'family'], [1230, 1440, []], '€8'],
    ['Lake Beach', 'pm', '2h', ['beach', 'family', 'relax'], null, 'Free'], ['Palace', 'am', '2h', ['culture'], [570, 990, [1]], '€16, book ahead'],
    ['Zoo', 'am', '3h', ['family', 'nature'], [540, 1050, []], '€15'], ['Square', 'eve', '1h', ['relax', 'food'], null, 'Free']
  ];
  var WORDS = ['Agia', 'Bella', 'Corvo', 'Dorada', 'Elia', 'Fonte', 'Gala', 'Horta', 'Isola', 'Jara', 'Kalo', 'Luna', 'Mira', 'Nova', 'Olea', 'Porta', 'Quinta', 'Rosa', 'Sol', 'Terra', 'Ursa', 'Vela', 'Xara', 'Yria', 'Zefiro', 'Alto', 'Brisa', 'Cala', 'Duna', 'Estela'];
  var EATS = [
    /* [kind, meal, cuisine, hours or null] */
    ['Taverna', 'both', 'Greek', [720, 1410, []]], ['Trattoria', 'both', 'Italian', [720, 1380, [1]]], ['Bistro', 'dinner', 'French', [1140, 1380, [0]]], ['Grill', 'dinner', 'Grill', [1080, 1410, []]],
    ['Café', 'breakfast', 'Café', [420, 960, []]], ['Bakery', 'breakfast', 'Bakery', [390, 840, [0]]], ['Brunch House', 'breakfast', 'Brunch', [480, 900, [1]]], ['Coffee Bar', 'breakfast', 'Coffee', null],
    ['Kitchen', 'all', 'Local', [480, 1380, []]], ['Lunch Counter', 'lunch', 'Sandwiches', [660, 930, [0]]], ['Noodle Bar', 'both', 'Asian', [690, 1320, [2]]], ['Fish House', 'both', 'Seafood', null],
    ['Supper Club', 'dinner', 'Modern', [1200, 1440, [0, 1]]], ['Pizzeria', 'both', 'Pizza', [720, 1380, []]], ['Gelateria', 'both', 'Ice cream', [660, 1380, []]], ['Tapas Bar', 'dinner', 'Tapas', [1170, 1440, []]],
    ['Garden Restaurant', 'both', 'Mediterranean', [750, 1350, [3]]], ['Diner', 'all', 'Diner', null]
  ];
  function off(c, km, deg) { var a = deg * Math.PI / 180; return { lat: c.lat + (km * Math.cos(a)) / 111, lng: c.lng + (km * Math.sin(a)) / (111 * Math.cos(c.lat * Math.PI / 180)) }; }
  function isoPlus(start, n) { var d = new Date(start + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /** the lists of one town, the same for a seed and a town whatever else the trip holds */
  function town(seed, country, name, stay, start) {
    var r = rng(hash(seed + '|' + country + '|' + name)), c = W.findCity(country, name) || {}, center = c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : { lat: 30 + r() * 20, lng: r() * 30 };
    var wide = !!(c.isl || W.isleOf(country, name) || W.dayTrip(c) || r() < 0.25), areas = [{ at: center, rad: wide ? 3 : 1 + r() * 2 }];
    var nAreas = wide ? int(r, 2, 5) : int(r, 0, 1);
    for (var i = 0; i < nAreas; i++) areas.push({ at: off(center, wide ? 8 + r() * 55 : 2 + r() * 3, r() * 360), rad: 0.5 + r() * (wide ? 4 : 1.5) });
    var want = Math.max(15, Math.min(30, 4 * stay + 3)), nS = want + int(r, -3, 10), nF = want + int(r, -3, 8), spots = [], food = [], T = name.split(/[ ,(]/)[0];
    function where(o) { if (r() < 0.08) { o.lat = null; o.lng = null; return o; } var a = r() < 0.45 ? areas[0] : pick(r, areas), p = off(a.at, r() * a.rad, r() * 360); o.lat = Math.round(p.lat * 1e5) / 1e5; o.lng = Math.round(p.lng * 1e5) / 1e5; return o; }
    function facts(o) {
      var m = r();
      if (m < 0.03) o.st = 'closed'; else if (m < 0.05) o.st = 'unfound'; else if (m < 0.06) o.st = 'dup'; else if (m < 0.25) o.st = 'open'; else if (m < 0.3) o.st = 'unsure'; else if (m < 0.36) o.st = 'unverified';
      if (r() < 0.05) { var f = int(r, -3, 14), len = int(r, 0, 6); o.shut = [{ f: isoPlus(start, f), t: isoPlus(start, f + len), why: 'works' }]; }
      if (r() < 0.5) o.rating = Math.round((3.6 + r() * 1.4) * 10) / 10;
      if (r() < 0.5) o.fame = int(r, 0, 2);
      if (r() < 0.3) o.gid = 'G' + hash(name + o.n).toString(36);
      return o;
    }
    function hours(h) { if (!h || r() < 0.35) return undefined; var o = { o: h[0], c: h[1], closed: h[2].slice() }; if (r() < 0.2) o.closed.push(int(r, 0, 6)); if (r() < 0.1) { o.o += 60 * int(r, 1, 3); } if (r() < 0.1) o.c -= 60 * int(r, 1, 3); if (o.c <= o.o + 30) o.c = o.o + 120; return o; }
    for (i = 0; i < nS; i++) {
      var k = pick(r, SIGHTS), o = { n: T + ' ' + pick(r, WORDS) + ' ' + k[0], d: 'What it is known for.', t: k[3].slice(), k: int(r, -1, 1), s: k[1], dur: r() < 0.7 ? k[2] : '', ticket: k[5], book: '', bookV: 2, pic: '', place: '' };
      if (spots.some(function (y) { return y.n === o.n; })) o.n += ' ' + (i + 1);
      var h = hours(k[4]); if (h) o.hours = h;
      spots.push(facts(where(o)));
      var m = r();
      /* the same place again: under a longer name, under another name with the same Google ID, as another outing at the same real place */
      if (m < 0.05) spots.push(Object.assign({}, o, { n: o.n + ' Evening Stroll and Gelato', s: 'eve' }));
      else if (m < 0.09) spots.push(Object.assign({}, o, { n: T + ' ' + pick(r, WORDS) + ' ' + k[0] + ' Tour', gid: o.gid || (o.gid = 'G' + i + hash(name).toString(36)) }));
      else if (m < 0.13) { o.place = T + ' ' + pick(r, WORDS) + ' Kastro'; spots.push(Object.assign({}, o, { n: T + ' ' + pick(r, WORDS) + ' ' + pick(r, SIGHTS)[0] + ' wander', gid: undefined })); }
      /* what is no real place, and what is a train ride */
      else if (m < 0.16) spots.push(where({ n: pick(r, ['Evening dinner in the ' + T + ' old town', T + ' Museum / ' + T + ' Gallery', 'Seafront tavernas of ' + T, 'Castle or the cathedral', 'Any of the beach bars']), d: '', t: ['food'], k: 1, s: pick(r, ['am', 'pm', 'eve']), dur: '', ticket: 'Free', place: '' }));
      else if (m < 0.19) spots.push(where({ n: pick(r, ['Scenic train ride to ' + pick(r, WORDS), T + ' Vintage Railway journey', 'Steam train to the hills', pick(r, WORDS) + ' Express train ride', 'Narrow-gauge rail trip to ' + pick(r, WORDS)]), d: '', t: ['scenic', 'family'], k: 1, s: pick(r, ['am', 'pm', 'any']), dur: pick(r, ['2h', '3h', '']), ticket: '€20', place: '' }));
    }
    for (i = 0; i < nF; i++) {
      var e = pick(r, EATS), fo = { n: pick(r, WORDS) + ' ' + pick(r, WORDS) + ' ' + e[0], d: 'Known for it.', cuisine: e[2], price: pick(r, ['€', '€€', '€€€']), meal: r() < 0.15 ? pick(r, ['breakfast', 'lunch', 'dinner', 'both', 'all']) : e[1], k: int(r, -1, 1), reserve: r() < 0.12, menu: '', dur: '', fav: r() < 0.1, pic: '', place: '' };
      if (food.some(function (y) { return y.n === fo.n; })) fo.n += ' ' + (i + 1);
      var fh = hours(e[3]); if (fh) fo.hours = fh;
      food.push(facts(where(fo)));
      m = r();
      if (m < 0.04) food.push(Object.assign({}, fo, { n: fo.n.replace(/ \S+$/, '') + ' Restaurant' }));
      else if (m < 0.07) food.push(where({ n: pick(r, [T + ' seafront tavernas', 'Cafés on the square', 'Market food stalls', 'Bars / bistros of the port']), d: '', cuisine: 'Local', price: '€', meal: 'both', k: 0, place: '' }));
    }
    return { spots: spots, food: food, lat: center.lat, lng: center.lng, d: '', askedN: Math.max(nS, nF), fameAsked: 1, transit: null, stay: [] };
  }
  /* every town on the plan gets its lists; says whether any was missing */
  function towns(seed, P) {
    var made = false;
    function need(country, name, stay) { var ck = W.cityKey(country, name); if (W.C.city[ck] && W.C.city[ck].spots && W.C.city[ck].spots.length) return; W.C.city[ck] = town(seed, country, name, stay, W.S.start); made = true; }
    P.stops.forEach(function (s) { need(s.country, s.name, s.days); (s.trips || []).forEach(function (t) { need(t.country, t.name, 1); }); });
    P.days.forEach(function (d) { if (d.trip && d.trip.lat != null && W.findCity(d.trip.country, d.trip.name)) need(d.trip.country, d.trip.name, 1); });
    if (made) W.dataV++;
    return made;
  }
  /* plan until the plan stands: lists that were missing are made, and what planning itself moves (ideas set aside or
     brought out for the length of a stay) is planned with */
  function plan(seed, out) {
    var P = null, sig = '';
    for (var i = 0; i < 8; i++) {
      var mineWas = handSig();
      W.replan(); P = W.plan(); W.P = P;
      if (handSig() !== mineWas) out.bad.push('planning changed what was chosen by hand: ' + mineWas.slice(0, 200) + ' -> ' + handSig().slice(0, 200));
      var made = towns(seed, P), s2 = JSON.stringify(W.S.picks) + '|' + Object.keys(W.C.city).map(function (k) { var c = W.C.city[k]; return c.spots.length + '/' + c.food.length; }).join();
      if (!made && s2 === sig) break;
      sig = s2; W.dataV++;
    }
    return P;
  }
  function handSig() { var S = W.S, o = {}; Object.keys(S.mine || {}).sort().forEach(function (k) { if (S.mine[k] && S.picks[k]) o[k] = S.picks[k]; }); return JSON.stringify(o) + JSON.stringify(S.free || {}) + JSON.stringify(S.rest || {}); }

  /* ---------- reading a plan ---------- */
  function audit(P, spec, out, phase, held) {
    var allowed = {};
    P.stops.forEach(function (s) { allowed[s.country + '|' + s.name] = 1; });
    if (P.days.length !== P.N || P.N !== +W.S.days) out.bad.push(phase + ': ' + P.days.length + ' days planned, the trip has ' + P.N + ' (' + W.S.days + ')');
    P.days.forEach(function (d) { if (!allowed[d.country + '|' + d.city]) out.bad.push(phase + ': D' + d.n + ' in ' + d.city + ', not a chosen place'); if (d.loading) out.loading++; });
    var v = W.checkPlan(P, { held: held });
    v.forEach(function (x) { out.rules[x.rule] = (out.rules[x.rule] || 0) + 1; out.bad.push(phase + ': D' + x.day + ' ' + x.slot + ' [rule ' + x.rule + '] ' + x.what); });
    P.days.forEach(function (d) { (d.slots || []).forEach(function (x) { out.slots++; if (x.item) out.filled++; else if (x.why) { out.why[x.why] = (out.why[x.why] || 0) + 1; if (window.__fuzzDetail) { if (x.why === 'none') { var wn = W.planX.whyNot(d, x, P), wk = 'NONE ' + (W.isFood(x.slot) ? 'meal' : 'act') + (wn.clock ? ' clock' : wn.unfit > wn.used ? ' unfit' : ' used'); out.why[wk] = (out.why[wk] || 0) + 1;
        if (wn.clock) { var X = W.planX, pl = X.dayPool(d, x, P.stops[d.stop]), cx = X.ctxFor(d, x, pl.home, pl.geo, false), c1 = X.ranked(pl.pool, x.slot, P.stops[d.stop].used, [], cx, P.p)[0];
          if (c1) { x.item = c1; var T1 = W.dayTimes(d, P), bb = X.dayBads(d, P, T1), R1 = T1.rows[x.slot], b0 = bb[0]; x.item = null;
            var ck2 = 'CLK ' + x.slot + (d.moveFrom ? ':move' : '') + (P.p.toddler ? ':todd' : P.p.kid ? ':kid' : '') + ' -> ' + (b0 ? b0.slot : '?') + ' ' + (R1.skip ? 'skip' : R1.warn.join('|').replace(/\d+:\d+ [AP]M/g, 'T').replace(/about .* there/, 'about N there') || (b0 === x ? 'self(area/short/meal)' : 'other')); out.why[ck2] = (out.why[ck2] || 0) + 1; } } } var dk = x.why + ':' + x.slot + (d.rest ? ':rest' : d.moveFrom ? ':move' : d.trip ? ':trip' : '') + (P.p.toddler ? ':todd' : P.p.kid ? ':kid' : ''); out.why[dk] = (out.why[dk] || 0) + 1; } } else if (x.free || x.rest) out.why.owner = (out.why.owner || 0) + 1; }); });
  }

  function run(spec) {
    quiet();
    var seed = spec.seed, r = rng(seed * 7 + 3), S = W.S, C = W.C, out = { seed: seed, bad: [], rules: {}, why: {}, loading: 0, slots: 0, filled: 0, days: 0 };
    C.city = {}; C.legs = {}; W.status = {};
    Object.assign(S, { styles: spec.styles.slice(), countries: JSON.parse(JSON.stringify(spec.countries)), days: spec.days, start: spec.start, depart: spec.depart, travelers: spec.travelers.slice(), focus: spec.focus,
      stays: {}, picks: {}, seen: {}, mine: {}, free: {}, rest: {}, legPick: {}, fold: {}, cityDays: Object.assign({}, spec.cityDays), names: [], day: 1, under: {}, booked: {}, bookings: [], dayTrip: {}, nope: {}, imported: {}, rl: {} });
    W.isExample = false;
    var P = plan(seed, out);

    /* 1. how the trip is laid out: where you stay, how you travel, rest days and day trips of your own */
    P.stops.forEach(function (s, si) {
      var ck = W.cityKey(s.country, s.name), c = W.pool(s.country, s.name);
      if (c && r() < 0.35) { var p = off(c, r() < 0.7 ? r() * 2 : r() * 25, r() * 360); S.stays[ck] = { label: 'Hotel ' + pick(r, WORDS), lat: p.lat, lng: p.lng, live: true }; }
      if (!si) return;
      var a = P.stops[si - 1], lk = W.legKey(a, s);
      if (r() < 0.6) {
        var n = int(r, 1, 3), opts = [];
        for (var i = 0; i < n; i++) { var mins = pick(r, [30, 45, 75, 100, 150, 200, 260, 330, 400, 540]); opts.push({ mode: pick(r, ['train', 'ferry', 'flight', 'bus', 'car']), op: 'Line ' + i, from: a.name, to: s.name, dur: Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm', price: '€30', book: true, url: '', note: r() < 0.1 ? 'overnight' : '' }); }
        C.legs[lk] = { v: 2, opts: opts };
        if (r() < 0.3) S.legPick[lk] = W.legSig(pick(r, opts));
      }
    });
    P = plan(seed, out);
    P.stops.forEach(function (s, si) {
      if (!si || r() > 0.2) return;
      var first = P.days.filter(function (d) { return d.stop === si; })[0], L = W.legFor(P, si), dep = pick(r, [360, 450, 600, 780, 900, 1080, 1200, 1290]), day = W.isoDay(W.dateOf(first.n));
      var arr = dep + L.min, day2 = W.isoDay(W.dateOf(first.n + Math.floor(arr / 1440)));
      S.bookings.push({ id: 'b' + si, kind: pick(r, ['train', 'ferry', 'flight', 'bus']), title: P.stops[si - 1].name + ' to ' + s.name, place: P.stops[si - 1].name, to: s.name, start: day + 'T' + pad(Math.floor(dep / 60)) + ':' + pad(dep % 60), end: r() < 0.8 ? day2 + 'T' + pad(Math.floor((arr % 1440) / 60)) + ':' + pad(arr % 60) : '' });
    });
    P.days.forEach(function (d) {
      if (r() < 0.08) S.rest[W.restKey(d)] = 1;
      else if (r() < 0.05 && !d.tripFirst && !d.tripLast && !d.moveFrom) {
        var cs = W.countryCities(d.country).filter(function (y) { var k = W.km(W.findCity(d.country, d.city), y); return y.lat != null && k != null && k > 5 && k < 90 && y.name !== d.city; });
        if (cs.length) { var t = pick(r, cs); S.dayTrip[W.restKey(d)] = { country: d.country, name: t.name, lat: t.lat, lng: t.lng, min: 30 + int(r, 0, 60) }; }
      }
    });
    P = plan(seed, out);
    audit(P, spec, out, 'laid out', []);

    /* 2. by hand: parts of a day left free, places chosen, places booked */
    var held = [];
    P.days.forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        var m = r();
        if (x.loading || x.rest) return;
        if (m < 0.04) { S.free[x.key] = 1; return; }
        if (m < 0.1) {
          var pl = W.dayPool(d, x.slot, P), list = pl.pool ? (W.isFood(x.slot) ? pl.pool.food : pl.pool.spots) || [] : [];
          if (!list.length) return;
          var it = pick(r, list);
          if (r() < 0.5) W.useIdea(d, x.slot, it.n, P); else { S.picks[x.key] = it.n; S.mine[x.key] = 1; }
          return;
        }
      });
    });
    P = plan(seed, out);
    Object.keys(S.mine).forEach(function (k) { if (S.mine[k] && S.picks[k] && !S.free[k]) held.push({ key: k, name: S.picks[k] }); });
    P.days.forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        if (!x.item || S.mine[x.key] || r() > 0.06) return;
        if (r() < 0.7) S.booked['item|' + W.cityKey(d.country, d.city) + '|' + W.norm(x.item.n)] = 1;
        else S.bookings.push({ id: 'k' + d.n + x.slot, kind: W.isFood(x.slot) ? 'restaurant' : 'ticket', title: x.item.n, start: W.isoDay(W.dateOf(d.n)) + 'T' + (W.isFood(x.slot) ? '19:30' : '10:00') });
        held.push({ key: x.key, name: x.item.n });
      });
    });
    P = plan(seed, out);
    audit(P, spec, out, 'by hand', held);

    /* 3. afterwards: more ideas arrive, the nightly check closes places and learns hours; planned again */
    Object.keys(C.city).forEach(function (ck) {
      var c = C.city[ck], parts = ck.split('|');
      if (r() < 0.4) { var more = town(seed + 7919, parts[0], parts[1], 2, S.start); more.spots.slice(0, int(r, 1, 8)).forEach(function (x) { x.n = x.n + ' II'; c.spots.push(x); }); more.food.slice(0, int(r, 1, 6)).forEach(function (x) { x.n = x.n + ' II'; c.food.push(x); }); }
      c.spots.concat(c.food).forEach(function (x) {
        var m = r();
        if (m < 0.03) x.st = 'closed';
        else if (m < 0.06) x.hours = { o: pick(r, [600, 720, 1020, 1200]), c: pick(r, [840, 1080, 1320, 1440]), closed: [int(r, 0, 6)] };
        else if (m < 0.07) x.shut = [{ f: isoPlus(S.start, int(r, 0, 5)), t: isoPlus(S.start, int(r, 6, 12)), why: 'season' }];
        if (x.hours && x.hours.c <= x.hours.o) x.hours.c = x.hours.o + 180;
      });
    });
    W.dataV++;
    P = plan(seed, out);
    audit(P, spec, out, 'afterwards', held);
    out.days = P.days.length;
    return out;
  }
  /* the plan on screen as text, for replaying one seed (FUZZ_SEED) */
  function dump() {
    var P = W.P, S = W.S;
    return P.days.map(function (d) {
      var T = d.slots && d.slots.length ? W.dayTimes(d, P) : null, home = W.homebase(d.country, d.city);
      return 'D' + d.n + ' ' + d.city + ' #' + d.dayInCity + (d.moveFrom ? ' [from ' + d.moveFrom + (T && T.travel ? ' ' + W.clock(T.travel.start) + '-' + W.clock(T.travel.end) : '') + ']' : '') + (d.jet ? ' [jet]' : '') + (d.rest ? ' [rest]' : '') + (d.trip ? ' [trip ' + d.trip.name + (d.trip.mine ? ' mine' : '') + ']' : '') + (d.fullDay ? ' [full]' : '') + (T && T.nap ? ' nap ' + W.clock(T.nap.start) + '-' + W.clock(T.nap.end) : '') + ' R=' + (P.stops[d.stop].geo ? P.stops[d.stop].geo.R.toFixed(1) : '?') + (T ? ' bads=' + W.planX.dayBads(d, P, T).map(function (b) { return b.slot; }).join() : '') + '\n' +
        (d.slots || []).map(function (x) { var R = T && T.rows[x.slot], it = x.item; return '   ' + (x.slot + '     ').slice(0, 9) + (R && R.start != null ? W.clock(R.start) + (R.end != null ? '-' + W.clock(R.end) : '') : '') + (R && R.skip ? ' SKIP' : '') + ' ' + (it ? it.n + ' {' + (it.s || it.meal) + (it.hours ? ' ' + W.clock(it.hours.o) + '-' + W.clock(it.hours.c) + ' x' + it.hours.closed.join('') : '') + (it.st ? ' ' + it.st : '') + (it.lat != null ? ' ' + (W.km(home, it) || 0).toFixed(1) + 'km' : ' nopin') + '}' + (S.mine[x.key] ? ' MINE' : W.planX.held(d, x) ? ' BOOKED' : '') : '-- ' + (x.free ? 'free' : x.rest ? 'rest' : x.why || '??')) + (R && R.warn.length ? ' !' + R.warn.join(';') : '') + (R && R.info.length ? ' (' + R.info.join(';') + ')' : ''); }).join('\n');
    }).join('\n');
  }
  window.__fuzz = { trip: trip, run: run, dump: dump };
};
