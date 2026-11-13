/* Waypoint's smaller questions to Claude: beaches, getting between two stops, food needs, what's on, what things cost,
   the time zone, where an address is. Split from lib/core.js. */
(function () {
  "use strict";
  var W = window.W,
    run = W.run,
    changed = W.changed,
    arrived = W.arrived;
  /* ---------- beach check ---------- */
  W.isBeach = function (x) {
    return !!x && W.picKind && W.picKind(x, false) === "beach" && !/\b(bar|club|restaurant|taverna|cafe|café|hotel|resort)\b/i.test(x.n);
  };
  /* how good a beach is for little ones: "safe", "care" or "" (unknown or in between) */
  W.beachFit = function (x) {
    var b = x && x.bch;
    if (!b || !b.calm) return "";
    var p = W.party();
    if (b.calm === "often rough" || (p.toddler && b.shallow === false) || (b.sand === "rocks" && p.toddler)) return "care";
    if (b.calm === "calm" && b.shallow !== false) return "safe";
    return "";
  };

  /* getting between two stops: train, bus, ferry, flight or car, with official operator sites */
  W.legKey = function (a, b) {
    return a.country + "|" + a.name + ">" + b.country + "|" + b.name;
  };
  var LEGV = 2; /* v2: always asks about ferries */
  W.legBusy = function (a, b) {
    return W.status["leg|" + W.legKey(a, b) + "|v" + LEGV] === "loading";
  };
  W.loadLeg = function (a, b) {
    var k = W.legKey(a, b);
    W.C.legs = W.C.legs || {};
    if (W.C.legs[k] && W.C.legs[k].v === LEGV) return;
    run("leg|" + k + "|v" + LEGV, { ask: "asks.0", a: [a, b, k] }, "quick");
  };

  /* real journey times from Rome2Rio (your connector), asked for on a tap: up to six ways to go, with how long each takes
     door to door and who runs it. It never books anything; the app keeps the times next to Claude's options. */
  W.checkRoutes = function (a, b) {
    var k = W.legKey(a, b),
      lg = W.C.legs && W.C.legs[k],
      sk = "r2r|" + k;
    if (!lg || W.status[sk] === "loading" || !W.callTool) return;
    W.status[sk] = "loading";
    W.r2rMsg = "";
    changed();
    W.callTool("Rome2Rio", "get-routes", { origin: a.name + ", " + a.country, destination: b.name + ", " + b.country }).then(
      function (res) {
        var p = (res && (res.payload || res.structuredContent)) || res || {};
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
            p = {};
          }
        }
        var list = (Array.isArray(p.available_routes) ? p.available_routes : [])
          .map(function (r) {
            return {
              name: String((r && r.name) || "").slice(0, 60),
              min: Math.round(+(r && r.duration)) || 0,
              carriers: (Array.isArray(r && r.carriers) ? r.carriers : []).slice(0, 3).map(function (c) {
                return String(c).slice(0, 40);
              })
            };
          })
          .filter(function (r) {
            return r.name && r.min > 0 && r.min < 72 * 60;
          })
          .slice(0, 6);
        lg.r2r = { at: Date.now(), routes: list };
        delete W.status[sk];
        arrived();
      },
      function (e) {
        W.status[sk] = "error";
        W.r2rMsg = W.mcpMsg ? W.mcpMsg(e, "Rome2Rio") : "Rome2Rio didn't answer. Try again in a minute.";
        changed();
      }
    );
  };

  /* food needs: check the places already listed once for these needs, and add a few that fit them well */
  W.loadEatFit = function (country, city) {
    var sig = W.eatSig();
    if (!sig || W.readOnly) return;
    var ck = W.cityKey(country, city),
      cur = W.C.city[ck];
    if (!cur || cur.fallback || !(cur.food || []).length || W.cityBusy(ck)) return;
    var todo = cur.food
      .filter(function (x) {
        return !x.eat || x.eat.sig !== sig;
      })
      .slice(0, 60);
    if (todo.length) run("eatfit|" + ck + "|" + sig + "|" + todo.length, { ask: "asks.1", a: [city, ck, country, sig, todo] }, "quick");
    /* no extra list of places that suit the food needs: the first list and every "Find more" are asked with them (foodAsk) */
  };

  /* regional holidays and festivals in a city for the days you're there (lib/holidays.js lays them on the days). The
     national holidays are worked out in the app and named in the question, so Claude adds only what they miss; for a
     country the app doesn't know, its national ones too. Asked once per city and dates; anything uncertain is left out. */
  var EVV = 1;
  W.loadEvents = function (country, city, from, to) {
    if (!from || !to || W.readOnly) return;
    var ck = W.cityKey(country, city),
      have = W.C.events[ck];
    if (have && have.v === EVV && have.from <= from && have.to >= to) return;
    var nat = W.holidaysBetween ? W.holidaysBetween(country, from, to) : [],
      known = W.holidaysKnown && W.holidaysKnown(country),
      yr = from.slice(0, 4);
    run("events|" + ck + "|" + from + "|" + to, { ask: "asks.2", a: [city, ck, country, from, known, nat, to, yr] }, "quick");
  };

  /* typical costs for the budget: meals, getting around and a mid-range room for this group, plus each paid sight's entry for the whole group */
  W.loadCosts = function (country, city) {
    var ck = W.cityKey(country, city),
      pool = W.C.city[ck];
    if (!pool || pool.fallback) return;
    var ages = W.ages().join(","),
      have = /** @type {Costs | null} */ (W.C.cost[ck]);
    if (have && have.ages !== ages) have = null;
    var paid = (pool.spots || []).filter(W.isPaid).map(function (x) {
      return x.n;
    });
    var missing = paid
      .filter(function (n) {
        return !have || !(W.norm(n) in have.tickets);
      })
      .slice(0, 40);
    if (have && !missing.length) return;
    run("cost|" + ck + "|" + ages + "|" + missing.length, { ask: "asks.3", a: [ages, city, ck, country, missing] }, "quick");
  };
  /* the time zone of a country, for calendar events (a short list is built in; anything else asks Claude once) */
  W.loadTz = function (country) {
    if (W.C.tz[country]) return;
    run("tz|" + country, { ask: "asks.4", a: [country] }, "quick");
  };

  /* find coordinates for a hotel or address */
  W.geocode = function (country, city, text, done) {
    var gk = W.cityKey(country, city) + "|" + W.norm(text);
    if (W.C.geo[gk]) return done(W.C.geo[gk]);
    var m = text.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
    if (m) return done({ lat: +m[1], lng: +m[3] });
    run("geo|" + gk, { ask: "asks.5", a: [city, country, done, gk, text] }, "quick");
  };
  /* what the questions and the answers' handling use from here: they come later, in a file of their own (lib/asksask.js) */
  W.ASK_X.asks = { EVV: EVV, LEGV: LEGV };
})();
