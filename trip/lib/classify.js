/* Waypoint place kinds: what sort of place each suggestion is (a beach, a museum, a bakery…), how long it takes, how tiring it is,
   whether it is indoors and which parts of the day suit it. The planner, the clock and the pictures all read this one answer. */
(function () {
  "use strict";
  var W = window.W;
  W.SPOT_PICS = ["beach", "island", "mountain", "gorge", "ruins", "temple", "church", "museum", "castle", "oldtown", "harbor", "park", "garden", "market", "viewpoint", "lake", "waterfall", "cave", "nightlife", "themepark", "zoo", "spa", "vineyard", "bridge", "square"];
  W.FOOD_PICS = ["pasta", "pizza", "seafood", "grill", "taverna", "cafe", "bakery", "gelato", "streetfood", "wine", "sushi", "noodles", "tacos", "curry", "deli"];

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var x = seed || 1; return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function f(n) { return Math.round(n * 10) / 10; }

  /* ---------- what kind of picture ---------- */
  /** @type {[RegExp, string][]} */
  var SPOT_WORDS = [
    [/sushi|ramen|izakaya/, ""],
    [/beach|playa|praia|plage|lido|\bcove\b|caló|cala\b|bay\b|lagoon(?! spa)/, "beach"],
    [/island|isola|islet|boat|cruise|catamaran|sail|kayak|ferry/, "island"],
    [/gorge|canyon|ravine/, "gorge"],
    [/waterfall|falls\b|cascad/, "waterfall"],
    [/cave|grotto|cavern|catacomb/, "cave"],
    [/lake|lago\b|loch|reservoir/, "lake"],
    [/hot spring|onsen|thermal|\bspa\b|bath|hammam|blue lagoon/, "spa"],
    [/vineyard|winery|wine|cellar|tasting|chianti|bodega/, "vineyard"],
    [/ruin|forum|ancient|archaeolog|acropolis|knossos|pompeii|amphithea|colosse|akrotiri|roman/, "ruins"],
    [/temple|shrine|pagoda|\bwat\b|parthenon|pantheon|tholos/, "temple"],
    [/church|cathedral|basilica|chapel|monaster|duomo|mosque|abbey|sagrada|sacr/, "church"],
    [/museum|gallery|uffizi|louvre|prado|exhibit|collection/, "museum"],
    [/castle|fortress|\bfort\b|citadel|tower of|alc[aá]zar|alhambra|kastro|walls/, "castle"],
    [/harbou?r|\bport\b|marina|waterfront|pier|promenade/, "harbor"],
    [/market|mercat|mercado|bazaar|souk|halles/, "market"],
    [/theme park|amusement|disney|universal|water ?park|aquarium|oceanari|fun park|tibidabo|legoland/, "themepark"],
    [/\bzoo\b|safari|sanctuary|wildlife|elephant|monkey|turtle|dolphin|bird/, "zoo"],
    [/garden|botanic|jard[ií]n|giardin|lavender|flower/, "garden"],
    [/park|forest|reserve|woods|valley|meadow/, "park"],
    [/mount|peak|hike|trail|volcano|summit|alp|ridge|cable car|funicular|glacier/, "mountain"],
    [/bridge|canal|gondola|ponte|river/, "bridge"],
    [/viewpoint|mirador|lookout|sunset|belvedere|panoram|miradouro|terrace|rooftop/, "viewpoint"],
    [/bar\b|club|night|jazz|flamenco|fado|show|theat|concert|opera|cabaret/, "nightlife"],
    [/square|piazza|plaza|plaça|fountain|platia/, "square"],
    [/old town|quarter|street|lane|alley|village|neighbo|district|town|barrio|centro/, "oldtown"]
  ];
  /** @type {[RegExp, string][]} */
  var FOOD_WORDS = [
    [/sushi|sashimi|omakase/, "sushi"],
    [/ramen|udon|soba|noodle|pho\b|dumpling|dim sum/, "noodles"],
    [/pizza|pizzeria/, "pizza"],
    [/taco|taquer|mexican|burrito|mole/, "tacos"],
    [/curry|indian|thai|biryani|rice bowl|massaman/, "curry"],
    [/gelat|granita|ice cream|dessert|chocolat|churro|cake|sweets|loukoumad/, "gelato"],
    [/bakery|bread|croissant|past[eé]is|nata|boulanger|panader|panific|forno|pastry|bougatsa|pasticceri|pastisser|pasteler|patisser|pâtisser|zacharoplast|kourabied|dolci|biscott/, "bakery"],
    [/coffee|caf[eé]|espresso|\btea\b|brunch|breakfast/, "cafe"],
    [/seafood|fish|pesc|psar|marisc|oyster|sardin|octopus|lobster|prawn|shrimp|clam|mussel|paella/, "seafood"],
    [/pasta|trattoria|osteria|ristorante|carbonara|rag[uù]|spaghetti|cacio|lasagn|risotto/, "pasta"],
    [/grill|meat|steak|souvlaki|kebab|bbq|barbecue|asador|gyro|churrasc|burger/, "grill"],
    [/street|sandwich|wrap|food truck|panino|bocadillo|lampredotto|francesinha|food hall|rosticceri|arancin|friggitori|focacceri|gyros/, "streetfood"],
    [/deli|alimentari|cheese|charcut|jam[oó]n|salumi|market|mercat|tapas|pintxo|cicchett|meze|mezze/, "deli"],
    [/wine|enoteca|bar\b|cocktail|tavern(?!a)|pub\b/, "wine"],
    [/taverna|greek|cretan|home ?cook|family/, "taverna"]
  ];

  /* ---------- what a place is: a classification used by the planner, the clock and the pictures ----------
     A suggestion's name is read in three steps: first what you DO there if it is an experience (a cooking class,
     a boat trip, a hike), then WHERE it is (a beach, a museum…), ignoring adjectives like "Roman" or "Cretan" that
     only describe a cuisine or a style. Each kind carries what the planner needs: how long it takes, how tiring it
     is, whether it is indoors, and which parts of the day suit it. Data that already says so (pic, dur, s, t) wins. */
  /** @type {[RegExp, string, Profile][]} */
  var ACT = [
    /* [pattern, kind the planner uses, experience profile] */
    [/cooking class|cookery|cooking (lesson|workshop|course)|pasta making|pizza (class|making)|pesto making|bread making|baking class/, "cafe", { act: "class", min: 180, intensity: 1, indoor: true, slots: ["am", "pm"] }],
    [/wine tasting|winery (visit|tour)|vineyard (visit|tour|tasting)|olive oil (tasting|farm)|cheese tasting|tasting (walk|tour|session)|enoteca|bodega tour/, "vineyard", { act: "tasting", min: 120, intensity: 1, indoor: false, adults: true, slots: ["pm"] }],
    [/food tour|street food (tour|walk|tasting)|tapas (crawl|tour|walk)|gelato (tasting|walk|crawl)|pastry (walk|tour)|market (tour|visit) and/, "streetfood", { act: "food walk", min: 150, intensity: 2, indoor: false, slots: ["am", "eve"] }],
    [/boat (trip|tour|ride|hop)|cruise|sailing|catamaran|speedboat|kayak\w*|canoe\w*|paddle ?board\w*|\bsup\b|rafting|snorkel\w*|scuba|diving|dive\b|windsurf\w*|kitesurf\w*|kite ?spot|wakeboard\w*|jet ?ski|surf lesson|water sports?/, "island", { act: "on the water", min: 180, intensity: 2, indoor: false, weather: true, slots: ["am", "pm"] }],
    [/\bhike\b|hiking|trek\w*|trail walk|canyoning|climbing|via ferrata|summit|gorge walk|gorge (hike|trek)/, "mountain", { act: "hike", min: 240, intensity: 3, indoor: false, weather: true, slots: ["am"] }],
    [/\bbike\b|biking|cycling|cycle|e-bike|segway|scooter tour|quad|buggy|jeep|4x4|atv|safari/, "park", { act: "ride", min: 180, intensity: 2, indoor: false, weather: true, slots: ["am", "pm"] }],
    [/horse ?(back )?riding|donkey ride|pony/, "park", { act: "ride", min: 120, intensity: 2, indoor: false, slots: ["am", "pm"] }],
    [/zip ?line|adventure park|rope course|tree ?top|go.?kart|mini ?golf|trampoline|playground|play ?centre|play ?center|soft play/, "themepark", { act: "play", min: 120, intensity: 2, indoor: false, slots: ["am", "pm"] }],
    [/water ?park|aqua ?park|aquapark|aquatropic|acqua ?plus|splash|slides\b/, "waterpark", { act: "play", min: 240, intensity: 2, indoor: false, weather: true, slots: ["am", "pm"] }],
    [/flamenco|tablao|folk (music|dance)|live music|concert|opera|theatre show|theater show|cinema|open-air cinema|puppet|show\b|performance|dinner show/, "nightlife", { act: "show", min: 90, intensity: 1, indoor: true, slots: ["eve"] }],
    [/pottery|ceramic workshop|craft workshop|painting class|art class|mosaic workshop|workshop\b/, "museum", { act: "class", min: 120, intensity: 1, indoor: true, slots: ["am", "pm"] }],
    [/hot spring|thermal|\bspa\b|hammam|hamam|wellness|massage/, "spa", { act: "soak", min: 120, intensity: 0, indoor: true, slots: ["pm"] }],
    [/picnic/, "park", { act: "picnic", min: 120, intensity: 1, indoor: false, weather: true, slots: ["pm"] }],
    [/sunset|sunrise|golden hour/, "viewpoint", { act: "sunset", min: 60, intensity: 0, indoor: false, slots: ["eve"] }],
    [/(evening|night) (stroll|walk|promenade|passeggiata|paseo)|passeggiata|evening (bazaar|market|shopping)|nightlife|bar hopping|bar crawl|pub crawl|cocktails?|aperitivo|drinks\b/, "nightlife", { act: "evening out", min: 90, intensity: 1, indoor: false, slots: ["eve"] }],
    [/walking tour|guided tour|city tour|old town (walk|tour)|(walk|stroll|wander) (through|around|along)|neighbou?rhood walk|lanes walk|heritage walk|photo walk/, "oldtown", { act: "walk", min: 120, intensity: 1, indoor: false, slots: ["am", "pm"] }],
    [/day trip|excursion/, "island", { act: "day trip", min: 420, intensity: 3, indoor: false, slots: ["am"] }],
    [/shopping|souvenir/, "market", { act: "shopping", min: 90, intensity: 1, indoor: false, slots: ["pm", "eve"] }]
  ];
  /* words that only describe a cuisine or a style, never where you are ("Roman cooking class", "Cretan dinner") */
  var ADJ = /\b(roman|greek|cretan|sicilian|neapolitan|tuscan|venetian|florentine|genoese|ligurian|andalusian|spanish|italian|afghan|afghani|traditional|authentic|local|classic|typical|homemade|family-style)\b/g;
  var SPOT_PROFILE = {
    beach: { min: 180, intensity: 1, indoor: false, weather: true, slots: ["am", "pm"] }, island: { min: 300, intensity: 2, indoor: false, weather: true, slots: ["am"] },
    gorge: { min: 240, intensity: 3, indoor: false, weather: true, slots: ["am"] }, waterfall: { min: 120, intensity: 2, indoor: false, weather: true, slots: ["am", "pm"] },
    cave: { min: 90, intensity: 1, indoor: true, slots: ["am", "pm"] }, lake: { min: 150, intensity: 1, indoor: false, weather: true, slots: ["am", "pm"] },
    spa: { min: 120, intensity: 0, indoor: true, slots: ["pm"] }, vineyard: { min: 120, intensity: 1, indoor: false, adults: true, slots: ["pm"] },
    ruins: { min: 120, intensity: 2, indoor: false, weather: true, slots: ["am"] }, temple: { min: 90, intensity: 2, indoor: false, slots: ["am"] },
    church: { min: 45, intensity: 0, indoor: true, slots: ["am", "pm"] }, museum: { min: 120, intensity: 1, indoor: true, slots: ["am", "pm"] },
    castle: { min: 120, intensity: 2, indoor: false, slots: ["am", "pm"] }, harbor: { min: 60, intensity: 0, indoor: false, slots: ["pm", "eve"] },
    market: { min: 60, intensity: 1, indoor: false, slots: ["am"] }, themepark: { min: 240, intensity: 2, indoor: false, slots: ["am", "pm"] },
    zoo: { min: 150, intensity: 2, indoor: false, slots: ["am", "pm"] }, garden: { min: 90, intensity: 1, indoor: false, slots: ["am", "pm"] },
    park: { min: 120, intensity: 1, indoor: false, slots: ["am", "pm"] }, mountain: { min: 240, intensity: 3, indoor: false, weather: true, slots: ["am"] },
    bridge: { min: 45, intensity: 0, indoor: false, slots: ["pm", "eve"] }, viewpoint: { min: 45, intensity: 1, indoor: false, slots: ["pm", "eve"] },
    nightlife: { min: 90, intensity: 1, indoor: false, slots: ["eve"] }, square: { min: 45, intensity: 0, indoor: false, slots: ["pm", "eve"] },
    oldtown: { min: 120, intensity: 1, indoor: false, slots: ["am", "pm", "eve"] }
  };
  var FOOD_PROFILE = { min: 75, intensity: 0, indoor: true, slots: ["lunch", "dinner"] };

  /* W.classify(item, food) -> { kind, act, min, intensity (0 calm … 3 strenuous), indoor, weather, adults, slots, stroller } */
  var CLS = {};
  W.classify = function (it, food) {
    var ck = (food ? "f|" : "s|") + it.n + "|" + (it.pic || "") + "|" + (it.s || "") + "|" + (it.dur || "");
    if (CLS[ck]) return CLS[ck];
    return (CLS[ck] = classify(it, food));
  };
  function classify(it, food) {
    var text = String(it.n + " " + (it.cuisine || "") + " " + (it.d || "")).toLowerCase(), name = String(it.n || "").toLowerCase().replace(ADJ, " ");
    var kind = null, prof = null, act = null;
    if (it.pic && (food ? W.FOOD_PICS : W.SPOT_PICS).indexOf(it.pic) > -1) kind = it.pic;
    if (!food) {
      for (var a = 0; a < ACT.length && !act; a++) if (ACT[a][0].test(name)) { act = ACT[a][2]; if (!kind) kind = ACT[a][1]; }
    }
    if (!kind) {
      var list = food ? FOOD_WORDS : SPOT_WORDS;
      if (food) {
        for (var i = 0; i < list.length && !kind; i++) if (list[i][1] && list[i][0].test(text)) {
          kind = list[i][1] === "wine" && /breakfast/.test(String(it.meal || "") + " " + (it.d || "").toLowerCase()) ? "cafe" : list[i][1];   /* an Italian "bar" at breakfast is a café */
        }
      } else {
        /* the head noun wins: in "Archaeological Museum of Chania" the museum, in "Vatican Museums & Sistine Chapel" the first part */
        var head = name.split(/\s*(?:&|,|:|\band\b|\bwith\b|\bnear\b|\bat\b|\bof\b|\bin\b)\s*/)[0] || name, best = -1;
        for (var i2 = 0; i2 < list.length; i2++) {
          if (!list[i2][1]) { if (list[i2][0].test(name)) break; continue; }
          var m = list[i2][0].exec(head), pos = m ? m.index + m[0].length : -1;
          if (pos > best) { best = pos; kind = list[i2][1]; }
        }
        if (!kind) for (var i3 = 0; i3 < list.length && !kind; i3++) if (list[i3][1] && list[i3][0].test(name)) kind = list[i3][1];
        /* the name said nothing: the description, then the tags */
        if (!kind) for (var j = 0; j < list.length && !kind; j++) if (list[j][1] && list[j][0].test(text)) kind = list[j][1];
      }
    }
    if (!kind) {
      var t = it.t || [];
      kind = food ? pick(rng(hash(it.n)), ["taverna", "pasta", "deli", "grill"]) : t.indexOf("beach") > -1 ? "beach" : t.indexOf("mountain") > -1 ? "mountain" : t.indexOf("nature") > -1 ? "park" : t.indexOf("nightlife") > -1 ? "nightlife" : t.indexOf("relax") > -1 || t.indexOf("scenic") > -1 ? "viewpoint" : "oldtown";
    }
    prof = act || (food ? FOOD_PROFILE : SPOT_PROFILE[kind] || SPOT_PROFILE.oldtown);
    var out = { kind: kind, act: act ? act.act : null, min: prof.min, intensity: prof.intensity, indoor: !!prof.indoor, weather: !!prof.weather, adults: !!prof.adults, slots: prof.slots };
    /* what the data itself says overrides the kind's defaults */
    var dm = it.dur ? W.parseDur(it.dur) : null; if (dm) out.min = dm;
    if (it.s === "any" && !(dm && dm < 240)) { out.min = Math.max(out.min, 420); out.slots = ["am"]; if (out.intensity < 2) out.intensity = 2; }   // a day out, unless the data says it is short
    else if (it.s === "any") out.slots = ["am", "pm"];
    else if (it.s === "eve") out.slots = ["eve"];
    if ((it.t || []).indexOf("relax") > -1 && out.intensity > 1) out.intensity = 1;
    if ((it.t || []).indexOf("indoor") > -1 || /\b(indoor|aquarium|planetarium|cinema|covered market|swimming pool|soft play|play cent(re|er))\b/.test(text)) { out.indoor = true; out.weather = false; }
    out.stroller = !(/stairs|steps|cliff|scramble|climb|rugged|rocky path|cobbl/.test(text)) && out.intensity < 3;
    return out;
  }
  W.picKind = function (it, food) { return W.classify(it, food).kind; };
})();
