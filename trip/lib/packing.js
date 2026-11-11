/* Waypoint packing: the packing list and the "before you go" list, read off the plan itself. The planner already knows
   who is going (toddlers, grandparents), how you travel between places (flights, trains, ferries, a car), what the days
   hold (beaches, hikes, museums, long walks), the season, the number of hotel moves and the countries' plugs. Each of
   those says something to pack or sort out; the lists say which day or fact asked for it. Ticks, removals and your own
   items are kept with the trip. */
(function () {
  "use strict";
  var W = window.W;

  /* plug types by country (the common ones); home is read from the departure airport */
  var PLUG = { "United States": "A/B", Canada: "A/B", Mexico: "A/B", Japan: "A/B", "United Kingdom": "G", Ireland: "G", Malta: "G", Cyprus: "G", Singapore: "G", "Hong Kong": "G", Italy: "C/F/L", Switzerland: "C/J", Australia: "I", "New Zealand": "I", Argentina: "C/I", Brazil: "C/N", "South Africa": "C/M/N", India: "C/D/M", Thailand: "A/B/C/O", China: "A/C/I", Israel: "C/H", Denmark: "C/E/F/K", France: "C/E", Belgium: "C/E", Poland: "C/E", "Czechia": "C/E", Slovakia: "C/E", Morocco: "C/E", Indonesia: "C/F", Vietnam: "A/C/F", Philippines: "A/B/C", Peru: "A/B/C", Colombia: "A/B", "Costa Rica": "A/B", Egypt: "C/F", Turkey: "C/F", Jordan: "C/D/F/G/J", "United Arab Emirates": "G", Qatar: "G", Oman: "G", Kenya: "G", Tanzania: "D/G", Uruguay: "C/F/I/L", Chile: "C/L" };
  var EURO = { Spain: 1, Portugal: 1, Italy: 1, France: 1, Germany: 1, Netherlands: 1, Belgium: 1, Austria: 1, Greece: 1, Ireland: 1, Finland: 1, Estonia: 1, Latvia: 1, Lithuania: 1, Slovenia: 1, Slovakia: 1, Croatia: 1, Malta: 1, Cyprus: 1, Luxembourg: 1, Monaco: 1, Montenegro: 1 };
  function plugOf(country) { return PLUG[country] || "C/F"; }   /* most of the world outside the listed ones takes the two round pins */
  function homePlug(ap) {
    if (!ap || ap.lat == null) return "A/B";
    if (ap.lat > 14 && ap.lat < 72 && ap.lng < -52 && ap.lng > -170) return "A/B";   /* North America */
    if (ap.lat > 49 && ap.lat < 61 && ap.lng > -11 && ap.lng < 2) return "G";        /* Britain and Ireland */
    if (ap.lat < -10 && ap.lng > 110) return "I";                                      /* Australia, New Zealand */
    if (ap.lat > 30 && ap.lat < 46 && ap.lng > 128 && ap.lng < 146) return "A/B";    /* Japan */
    return "C/F";
  }
  function key(s) { return W.norm(s).replace(/ /g, "-").slice(0, 60); }

  /* what the trip asks for */
  function facts(P) {
    var S = W.S, p = P.p || W.party(), ages = W.ages(), f = {
      toddlers: ages.filter(function (a) { return a < 5; }).length, kids: ages.filter(function (a) { return a < 12; }).length, babies: ages.filter(function (a) { return a < 2; }).length,
      seniors: ages.filter(function (a) { return a >= 65; }).length, adults: p.adults, p: p,
      countries: [], flight: !!P.ap, longHaul: false, train: [], ferry: [], car: [], bus: [], moves: Math.max(0, P.stops.length - 1), dayTrips: 0,
      beach: [], water: [], nature: [], hike: [], museum: [], carry: [], longWalk: [], eveOut: [], months: {}, lat: null, nights: P.N, jet: 0
    };
    P.stops.forEach(function (s, si) {
      if (f.countries.indexOf(s.country) < 0) f.countries.push(s.country);
      f.dayTrips += (s.trips || []).length;
      if (si && W.legFor) { var L = W.legFor(P, si), m = L && L.best && String(L.best.mode || "").toLowerCase() || "";
        var where = s.name + " (day " + (P.days.filter(function (d) { return d.stop === si; })[0] || {}).n + ")";
        if (/ferry|boat|hydrofoil|catamaran/.test(m)) f.ferry.push(where); else if (/train|rail/.test(m)) f.train.push(where); else if (/car|drive|taxi|transfer/.test(m)) f.car.push(where); else if (/bus|coach/.test(m)) f.bus.push(where); else if (/fl|plane|air/.test(m)) f.flight = true; }
      if (f.lat == null && W.stopAt) { var c = W.stopAt(s); if (c && c.lat != null) f.lat = c.lat; }
    });
    var jl = W.jetlag ? W.jetlag(P) : null; f.jet = jl ? jl.days : 0; f.longHaul = f.jet > 0;
    P.days.forEach(function (d) {
      var dt = W.dateOf(d.n); if (dt) f.months[dt.getMonth()] = 1;
      var walk = 0;
      (d.slots || []).forEach(function (x) {
        if (!x.item) return;
        var c = W.classify(x.item, W.isFood(x.slot)), k = c.kind || "", day = "Day " + d.n + " · " + x.item.n;
        if (!W.isFood(x.slot)) {
          if (/beach|pool|lido|waterpark|water park/.test(k)) f.beach.push(day);
          else if (/boat|snorkel|kayak|swim|aquarium|river|lake|gorge/.test(k) || /\b(boat|snorkel|kayak|swim|waterfall|gorge)\b/i.test(x.item.n)) f.water.push(day);
          if (/hike|trail|mountain|gorge|volcano|canyon/.test(k) || c.intensity >= 3) f.hike.push(day);
          else if (/park|garden|nature|forest|farm|zoo|island|countryside/.test(k)) f.nature.push(day);
          if (/museum|gallery|church|cathedral|palace|castle|exhibit/.test(k)) f.museum.push(day);
          if (c.stroller === false) f.carry.push(day);
          if (c.min >= 180 && c.intensity >= 2) walk++;
          if (x.slot === "eve") f.eveOut.push(day);
        }
      });
      if (walk >= 2) f.longWalk.push("Day " + d.n);
    });
    var ms = Object.keys(f.months).map(Number), south = f.lat != null && f.lat < 0;
    var hot = ms.some(function (m) { return south ? (m <= 1 || m === 11) : (m >= 5 && m <= 8); }), cold = ms.some(function (m) { return south ? (m >= 5 && m <= 7) : (m <= 1 || m === 11); });
    f.hot = hot; f.cold = cold; f.shoulder = !hot && !cold || ms.some(function (m) { return south ? (m >= 2 && m <= 4) || (m >= 8 && m <= 10) : (m >= 2 && m <= 4) || (m >= 9 && m <= 10); });
    f.homePlug = homePlug(P.ap); f.plugs = f.countries.map(plugOf).filter(function (x, i, a) { return a.indexOf(x) === i && x !== f.homePlug; });
    f.euro = f.countries.filter(function (c) { return EURO[c]; }).length; f.nonEuro = f.countries.filter(function (c) { return !EURO[c]; });
    f.abroad = f.homePlug !== "A/B" || f.countries.some(function (c) { return c !== "United States"; });
    f.stays = Object.keys(S.stays || {}).length;
    return f;
  }

  /* the lists. who: "all" | "kids" | "grandparents". why: the fact that asked for it. */
  function build(P) {
    var f = facts(P), pack = [], todo = [];
    function add(list, who, text, why, group) { list.push({ key: key(text), text: text, who: who, why: why || "", group: group || "" }); }
    var P_ = function (t, w, g) { add(pack, "all", t, w, g); }, K = function (t, w, g) { add(pack, "kids", t, w, g); }, G = function (t, w, g) { add(pack, "grandparents", t, w, g); };
    var T = function (t, w, g) { add(todo, "all", t, w, g); };
    var n = function (list, what) { return list.length + " " + what + (list.length === 1 ? "" : "s") + (list.length ? " (" + list.slice(0, 2).join(", ") + (list.length > 2 ? "…" : "") + ")" : ""); };

    /* --- documents and money --- */
    if (f.abroad) { P_("Passports for everyone, incl. the kids", "Travelling abroad", "papers"); T("Check every passport is valid 6 months past your return", "Travelling abroad", "weeks"); }
    P_("Photos of passports, cards and bookings on your phone", "", "papers");
    if (f.seniors && f.kids && f.adults > f.seniors) T("A signed letter for the grandparents if the kids travel with them without you on any leg", "Grandparents and kids on the trip", "weeks");
    T("Tell your bank and card issuers where you'll be", "Travelling abroad", "weeks");
    if (f.nonEuro.length && f.abroad) T("A little local cash for " + f.nonEuro.join(", ") + " (markets, small cafés, tips)", "", "days");
    else if (f.euro && f.abroad) T("A little cash in euros for markets and small cafés", "", "days");
    T("Travel insurance that covers the whole group, with the policy number saved on your phone", "", "weeks");

    /* --- getting there and around --- */
    if (f.flight) {
      P_("Carry-on with a change of clothes for everyone (bags do go missing)", "Flying", "travel");
      P_("Chargers and a power bank", "", "travel");
      if (f.kids) K("Plane kit: new small toys, stickers, snacks, headphones, a tablet with downloads", "Flying with kids", "travel");
      if (f.toddlers) K("Spare clothes and wipes within reach on the plane", "Flying with a toddler", "travel");
      if (f.babies) K("Formula or milk, bottles and a bib for the flight (allowed through security)", "Flying with a baby", "travel");
      T("Check in online and choose seats together the day before", "Flying", "days");
      if (f.toddlers) T("Ask the airline about the car seat and stroller: most take the stroller at the gate", "Flying with a toddler", "weeks");
    }
    if (f.longHaul) { P_("Eye masks, and travel clips for hotel curtains (blackout for naps)", "Long flight and jet lag", "sleep"); if (f.kids) K("White-noise app or small machine", "Jet-lag nights", "sleep"); }
    if (f.train.length) { P_("Day bag for train legs: water, snacks, something to do", n(f.train, "train leg"), "travel"); T("Book seats together on long trains; some need reservations", n(f.train, "train leg"), "weeks"); }
    if (f.ferry.length) { P_("Motion-sickness remedies for the ferry (ask a pharmacist about the kids' options)", n(f.ferry, "ferry"), "travel"); P_("Layers and a windproof for the deck", n(f.ferry, "ferry"), "travel"); T("Check the ferry's stroller and luggage rules", n(f.ferry, "ferry"), "weeks"); }
    if (f.car.length || f.dayTrips) { if (f.kids) T("Sort car seats: bring yours or reserve with the rental (ask for ISOFIX/LATCH)", f.car.length ? n(f.car, "drive") : f.dayTrips + " day trip" + (f.dayTrips === 1 ? "" : "s"), "weeks"); T("Download offline maps for every city, or save the app's offline copy", "", "days"); }
    if (f.moves >= 3) { P_("Packing cubes, one per person, so hotel moves take minutes", f.moves + " hotel moves", "bags"); }
    if (f.nights >= 7) { P_("Travel detergent or a laundry plan (a laundromat afternoon halfway through)", f.nights + " nights", "bags"); }

    /* --- toddlers and kids --- */
    if (f.toddlers) {
      K("Lightweight stroller that reclines for naps", "Naps on the go, every day", "kids");
      if (f.carry.length) K("Baby carrier for stairs, cobbles and crowds", n(f.carry, "place") + " not stroller-friendly", "kids");
      K("Nap kit: comfort object, light blanket, sleep sack, favourite book", "Daily nap", "kids");
      K("Snack pouch, refillable water bottle and a spill-proof cup", "", "kids");
      K("Diapers or pull-ups for the first 2 days, wipes, changing mat (buy more there)", "", "kids");
      K("Clip-on or travel high chair (many small restaurants have none)", "Dinners out", "kids");
      K("Children's fever and pain medicine, thermometer, plasters, saline", "", "health");
      K("Sun hat with a strap, and a UV swim shirt", f.hot || f.beach.length ? "Sun" : "", "kids");
      T("Ask every stay for a cot/crib and a high chair", f.stays ? f.stays + " stays" : "", "weeks");
      T("Freeze or plan the first-night dinner: arrive with something easy for the kids", "", "days");
    } else if (f.kids) {
      K("Day pack for each kid: water bottle, snacks, a small game", "", "kids");
      K("Children's fever and pain medicine, plasters", "", "health");
    }
    if (f.kids && f.museum.length) K("Quiet bag for museums: stickers, a small notebook and crayons, a scavenger list", n(f.museum, "museum day"), "kids");
    if (f.kids && f.eveOut.length) K("A light layer and a comfort item for evenings out", n(f.eveOut, "evening out"), "kids");
    if (f.kids) K("Wristbands or a card with your phone number for each child", "Crowded places", "kids");

    /* --- grandparents --- */
    if (f.seniors) {
      G("Regular medications for the whole trip plus a few days, in carry-on, with a list of names and doses", "", "health");
      G("Comfortable broken-in walking shoes (two pairs)", f.longWalk.length ? n(f.longWalk, "long walking day") : "", "clothes");
      G("Folding seat cane or a light stool for queues", f.museum.length ? n(f.museum, "museum day") : "", "comfort");
      G("Hat, sunglasses and a refillable bottle", "", "comfort");
      G("Reading glasses spare, and copies of prescriptions", "", "health");
      T("Check travel insurance covers the grandparents' medical needs abroad", "Grandparents along", "weeks");
    }

    /* --- the days --- */
    if (f.beach.length) { P_("Swimwear, towels or a travel towel, flip-flops, reef-safe sunscreen", n(f.beach, "beach day"), "days"); if (f.toddlers) K("Swim diapers, a shade tent and sand toys (or buy cheap ones there)", n(f.beach, "beach day"), "kids"); K("Water shoes for pebbly beaches", n(f.beach, "beach day"), "kids"); }
    if (f.water.length) P_("Quick-dry clothes and a dry bag", n(f.water, "day on or by the water"), "days");
    if (f.hike.length) { P_("Proper walking shoes and a small first-aid kit", n(f.hike, "hike or steep day"), "days"); if (f.kids) K("Carrier or a plan for tired legs on the hike", n(f.hike, "hike"), "kids"); }
    if (f.nature.length) P_("Bug spray and after-bite", n(f.nature, "park or nature day"), "days");
    if (f.museum.length && f.kids) P_("A small day bag that passes bag checks (museums limit backpack size)", n(f.museum, "museum day"), "days");
    P_("Reusable shopping bag and a few zip bags", "", "days");

    /* --- weather --- */
    if (f.hot) { P_("Sunscreen, hats and sunglasses for everyone", "Summer dates", "clothes"); P_("Light, breathable layers; one warm layer for air-conditioned trains and evenings", "Summer dates", "clothes"); }
    if (f.cold) { P_("Warm layers, hats and gloves; a warm sleep layer for the kids", "Winter dates", "clothes"); }
    if (f.shoulder || !f.hot) { P_("Rain jackets and a stroller rain cover", "Spring or autumn weather", "clothes"); }
    P_("One smart-casual outfit each for a nice dinner", "", "clothes");

    /* --- the practical bits --- */
    if (f.plugs.length) P_("Plug adapters (type " + f.plugs.join(", ") + ") and a small power strip", f.countries.join(", "), "tech");
    P_("Phone mounts, cables and headphones for everyone", "", "tech");
    T("Set up data abroad: eSIM or your carrier's plan, for two phones", "Travelling abroad", "weeks");
    T("Save the trip for offline in Travel mode (photos and maps on the phone)", "", "days");
    T("Share the plan with the grandparents and anyone at home", "", "days");
    T("Pharmacy run: the kids' medicines, motion-sickness, rehydration salts", "", "days");
    T("Charge everything and pack the chargers last", "", "day");

    return { pack: pack, todo: todo, facts: f };
  }

  var memo = null;
  W.packing = function (P) {
    var sig = (W.S.tripId || "") + "|" + P.N + "|" + P.stops.map(function (s) { return s.name + s.days; }).join(",") + "|" + (W.S.start || "") + "|" + W.ages().join(",") + "|" + (W.dataV || 0) + "|" + Object.keys(W.S.stays || {}).length;
    if (memo && memo.sig === sig) return memo.v;
    var v = build(P);
    /* your own items join the list; removed ones leave it */
    var own = (W.S.packOwn || []), hide = W.S.packHide || {};
    own.forEach(function (o) { (o.todo ? v.todo : v.pack).push({ key: o.key, text: o.text, who: o.who || "all", why: "Added by you", own: true, group: "" }); });
    v.pack = v.pack.filter(function (i) { return !hide[i.key]; }); v.todo = v.todo.filter(function (i) { return !hide[i.key]; });
    v.hidden = Object.keys(hide).length;
    memo = { sig: sig, v: v };
    return v;
  };
  W.packReset = function () { memo = null; };

  /* ---------- the block on Bookings ---------- */
  var tab = "pack", who = "all";
  W.packBlock = function (P) {
    var L = W.packing(P), S = W.S, ro = W.readOnly, ticks = S.pack || {}, list = tab === "pack" ? L.pack : L.todo;
    var shown = who === "all" ? list : list.filter(function (i) { return i.who === who || i.who === "all"; });
    var done = shown.filter(function (i) { return ticks[i.key]; }).length;
    var seg = '<div class="seg pk-seg" role="tablist"><button type="button" role="tab" aria-selected="' + (tab === "pack") + '" data-packtab="pack">Packing</button><button type="button" role="tab" aria-selected="' + (tab === "todo") + '" data-packtab="todo">Before you go</button></div>';
    var whoRow = L.facts.seniors && tab === "pack" ? '<div class="pk-who"><button type="button" class="chip' + (who === "all" ? " on" : "") + '" data-packwho="all" aria-pressed="' + (who === "all") + '">Everyone</button><button type="button" class="chip' + (who === "kids" ? " on" : "") + '" data-packwho="kids" aria-pressed="' + (who === "kids") + '">Kids\' bag</button><button type="button" class="chip' + (who === "grandparents" ? " on" : "") + '" data-packwho="grandparents" aria-pressed="' + (who === "grandparents") + '">Grandparents\' bag</button></div>' : "";
    /* in groups, so a long list reads as a few short ones */
    var GROUPS = tab === "pack" ? [["papers", "Papers and money"], ["travel", "Getting there"], ["sleep", "Sleeping away"], ["kids", "For the kids"], ["health", "Health kit"], ["days", "For the days out"], ["clothes", "Clothes and weather"], ["comfort", "Comfort"], ["bags", "Bags"], ["tech", "Tech and bits"], ["", "Your own"]]
      : [["weeks", "Weeks before"], ["days", "The last few days"], ["day", "The night before"], ["", "Your own"]];
    var row = function (i) {
      var on = !!ticks[i.key];
      return '<li class="chk pk' + (on ? " done" : "") + '"><button type="button" class="box" data-pack="' + W.esc(i.key) + '" aria-pressed="' + on + '" aria-label="' + W.esc((on ? "Unpack: " : "Packed: ") + i.text) + '"' + (ro ? " disabled" : "") + "></button>" +
        '<div class="chk-b"><div class="chk-t"><b>' + W.esc(i.text) + "</b>" + (i.who !== "all" ? '<span class="pk-tag">' + (i.who === "kids" ? "kids" : "grandparents") + "</span>" : "") + "</div>" +
        (i.why ? '<div class="chk-m">' + W.esc(i.why) + "</div>" : "") + "</div>" +
        (ro ? "" : '<button type="button" class="icon-btn pk-x" data-packhide="' + W.esc(i.key) + '" aria-label="Remove from the list" title="Not needed">×</button>') + "</li>";
    };
    var rows = GROUPS.map(function (g) {
      var items = shown.filter(function (i) { return (i.group || "") === g[0]; }); if (!items.length) return "";
      var gd = items.filter(function (i) { return ticks[i.key]; }).length;
      return '<li class="pk-g"><span>' + g[1] + '</span><span class="gn">' + gd + "/" + items.length + "</span></li>" + items.map(row).join("");
    }).join("");
    var add = ro ? "" : '<div class="pk-add"><input type="text" id="pkNew" placeholder="' + (tab === "pack" ? "Add something to pack" : "Add something to do") + '" aria-label="New item" maxlength="80"><button type="button" class="btn quiet" data-packadd="' + tab + '">Add</button></div>';
    var foot = (L.hidden ? '<button type="button" class="linkish small" data-packshow="1">Show ' + L.hidden + " removed</button>" : "");
    var top = (tab === "pack" ? done + " of " + shown.length + " packed" : done + " of " + shown.length + " done") + " · built from your plan: " + describe(L.facts);
    return '<section class="bk-card sk pk-card"><div class="bk-h"><div class="bk-hr"><h2>Pack and prepare</h2>' + seg + '</div><p class="small muted">' + W.esc(top) + "</p></div>" + whoRow +
      '<ul class="checklist pk-list">' + rows + "</ul>" + add + foot + "</section>";
  };
  function describe(f) {
    var bits = [];
    if (f.toddlers) bits.push(f.toddlers + " toddler" + (f.toddlers === 1 ? "" : "s")); else if (f.kids) bits.push(f.kids + " kid" + (f.kids === 1 ? "" : "s"));
    if (f.seniors) bits.push("grandparents");
    if (f.flight) bits.push(f.longHaul ? "a long flight" : "a flight");
    if (f.train.length) bits.push(f.train.length + " train leg" + (f.train.length === 1 ? "" : "s"));
    if (f.ferry.length) bits.push(f.ferry.length + " ferr" + (f.ferry.length === 1 ? "y" : "ies"));
    if (f.beach.length) bits.push(f.beach.length + " beach day" + (f.beach.length === 1 ? "" : "s"));
    if (f.hike.length) bits.push(f.hike.length + " hike" + (f.hike.length === 1 ? "" : "s"));
    if (f.museum.length) bits.push(f.museum.length + " museum" + (f.museum.length === 1 ? "" : "s"));
    if (f.moves) bits.push(f.moves + " hotel move" + (f.moves === 1 ? "" : "s"));
    bits.push(f.hot ? "summer" : f.cold ? "winter" : "spring/autumn weather");
    return bits.join(", ");
  }
  W.packClick = function (d) {
    var S = W.S;
    if (d.packtab) { tab = d.packtab; return true; }
    if (d.packwho) { who = d.packwho; return true; }
    if (W.readOnly) return false;
    if (d.pack) { var t = S.pack || (S.pack = {}); if (t[d.pack]) delete t[d.pack]; else t[d.pack] = 1; return true; }
    if (d.packhide) { var h = S.packHide || (S.packHide = {}); h[d.packhide] = 1; W.packReset(); return true; }
    if (d.packshow) { S.packHide = {}; W.packReset(); return true; }
    if (d.packadd) {
      var inp = document.getElementById("pkNew"), text = inp && inp.value.trim(); if (!text) return true;
      var own = S.packOwn || (S.packOwn = []); own.push({ key: "own-" + Date.now().toString(36), text: text.slice(0, 80), who: who === "all" ? "all" : who, todo: d.packadd === "todo" });
      W.packReset(); return true;
    }
    return false;
  };
})();
