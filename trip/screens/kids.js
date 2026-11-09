/* Waypoint for the kids: the day in big photos and big words ("Today we're going to…"), a heart for each kid to pick
   what they're excited about (it shows on the grown-ups' plan as "Mila's pick"), a passport that collects a stamp for
   every place, and a treasure hunt in each town. Opened from the trip menu and from Today. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc;
  var tab = "today", kday = null, huntTown = null;
  function S() { return W.S; }
  function today() { var n = W.now(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- the places, in order (where you sleep and where you go for the day) ---------- */
  function places(P) {
    var out = [];
    P.stops.forEach(function (s, si) {
      var ds = P.days.filter(function (d) { return d.stop === si; });
      out.push({ key: W.cityKey(s.country, s.name), name: s.name, country: s.country, n: ds[0].n });
      ds.forEach(function (d) { if (d.trip && !out.some(function (o) { return o.name === d.trip.name; })) out.push({ key: W.cityKey(d.trip.country, d.trip.name), name: d.trip.name, country: d.trip.country, n: d.n, trip: true }); });
    });
    return out;
  }
  function stamped(pl) {
    if ((S().stamps || {})[pl.key]) return "you";
    var d = W.dateOf(pl.n); return d && d <= today() ? "auto" : "";
  }

  /* ---------- the treasure hunt: six things to spot in each town ---------- */
  var FINDS = ["a blue door", "a cat having a nap", "a statue with a beard", "a flag flapping in the wind", "a fountain", "a dog going for a walk", "a church bell", "a boat",
    "flowers in a window box", "a bicycle with a basket", "a bird sitting on a roof", "someone eating an ice cream", "a red car", "a big clock", "stairs with more than 20 steps",
    "a shop that sells sweets", "a lion (a statue or a picture)", "a wall with a painting on it", "a bridge", "a tree with fruit on it", "someone playing music in the street",
    "a map of the town", "a door knocker shaped like a hand or an animal", "a hat you'd like to wear", "something taller than ten grown-ups", "a pigeon eating crumbs"];
  var BEACH = ["a shell with a hole in it", "a smooth round stone", "a crab (or its footprints)", "a sandcastle (or build one!)", "a boat with a sail", "a seagull"];
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
    return P.days.some(function (d) { return (d.city === pl.name || (d.trip && d.trip.name === pl.name)) && (d.slots || []).some(function (x) { return x.item && !W.isFood(x.slot) && /beach|lido/.test(W.classify(x.item, false).kind || ""); }); });
  }
  function finds(P, pl) {
    var pick = [], seed = hash(pl.key);
    function take(list, n) { var l = list.slice(); for (var i = 0; i < n && l.length; i++) { var j = (seed + i * 7919) % l.length; pick.push(l.splice(j, 1)[0]); } }
    take(COUNTRY[pl.country] || [], 2);
    if (beachy(P, pl)) take(BEACH, 2);
    take(FINDS, 6 - pick.length);
    return pick;
  }
  W.huntFinds = function (P, key) { var pl = places(P).filter(function (p) { return p.key === key; })[0]; return pl ? finds(P, pl) : []; };

  /* ---------- the screen ---------- */
  W.renderKids = function (P) {
    var el = W.$("viewKids"); if (!el) return;
    if (!P.stops.length) { el.innerHTML = '<div class="kids"><div class="empty sk">Plan a trip first, then the kids get their own corner here.</div></div>'; return; }
    var kids = W.kidNames(13), tn = W.todayN(P);
    if (kday == null || kday > P.N) kday = tn || S().day || 1;
    var hi = kids.length ? "Hi " + (kids.length > 3 ? "everyone" : W.joinNames(kids)) + "!" : "Hi there, explorers!";
    var du = W.daysUntil ? W.daysUntil() : null;
    var sub = tn ? "Day " + tn + " of " + P.N + " of your adventure" : du != null && du > 0 ? (du === 1 ? "Your adventure starts tomorrow!" : du + " sleeps until your adventure") : P.N + " days of adventure";
    var h = '<div class="kids"><button type="button" class="linkish back" data-view="' + (W.travelOn && W.travelOn(P) ? "go" : "trip") + '">← Back to the grown-up plan</button>' +
      '<header class="k-hero"><h2>' + esc(hi) + "</h2><p>" + esc(sub) + "</p></header>" +
      '<div class="k-tabs" role="tablist" aria-label="For the kids">' + [["today", "Our day"], ["pass", "Passport"], ["hunt", "Treasure hunt"]].map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-ktab="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>";
    if (tab === "today") h += dayHtml(P, kids, tn);
    else if (tab === "pass") h += passHtml(P);
    else h += huntHtml(P, tn);
    el.innerHTML = h + "</div>";
  };
  function dayHtml(P, kids, tn) {
    var day = P.days[kday - 1], live = tn === kday, d = W.dateOf(day.n);
    var h = '<div class="k-day"><button type="button" class="k-arrow" data-kday="-1"' + (kday <= 1 ? " disabled" : "") + ' aria-label="The day before">‹</button>' +
      "<div><b>Day " + day.n + "</b><span>" + esc(d ? d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : day.city) + "</span></div>" +
      '<button type="button" class="k-arrow" data-kday="1"' + (kday >= P.N ? " disabled" : "") + ' aria-label="The next day">›</button></div>';
    h += '<h3 class="k-say">' + (live ? "Today we're going to…" : tn && kday < tn ? "On Day " + day.n + " we went to…" : "On Day " + day.n + " we're going to…") + "</h3>";
    if (day.moveFrom) { var L = W.legFor(P, day.stop); h += '<div class="k-move">We\'re off to <b>' + esc(day.city) + "</b>" + (L && L.best ? " by " + esc(W.modeName(L.best.mode).toLowerCase()) : "") + "!</div>"; }
    else if (day.trip) h += '<div class="k-move">A day out in <b>' + esc(day.trip.name) + "</b>!</div>";
    var T = day.slots && day.slots.length ? W.dayTimes(day, P) : null;
    var cards = (day.slots || []).filter(function (x) { return x.item && !W.isFood(x.slot); }).map(function (x, i) {
      var it = x.item, pic = W.picture(it, false, day.country, x.trip ? day.trip.name : day.city), picks = W.kidPicks(it);
      var love = kids.length ? kids.map(function (k) { var on = picks.indexOf(k) > -1; return '<button type="button" class="k-heart' + (on ? " on" : "") + '" data-kpick="' + esc(it.n) + '" data-kname="' + esc(k) + '" aria-pressed="' + on + '"><span aria-hidden="true">' + (on ? "♥" : "♡") + "</span> " + esc(k) + "</button>"; }).join("")
        : '<button type="button" class="k-heart' + (picks.length ? " on" : "") + '" data-kpick="' + esc(it.n) + '" data-kname="kids" aria-pressed="' + !!picks.length + '"><span aria-hidden="true">' + (picks.length ? "♥" : "♡") + "</span> We want to go!</button>";
      return '<article class="k-card c' + (i % 6) + '">' + (pic ? '<div class="k-pic">' + pic + "</div>" : '<div class="k-pic none"><span>' + esc(it.n.charAt(0)) + "</span></div>") +
        '<div class="k-b"><span class="k-when">' + esc(W.SLOT_NAME[x.slot] || "") + (T && T.rows && T.rows[x.slot] ? " · " + esc(W.clock(T.rows[x.slot].start)) : "") + "</span><h4>" + esc(it.n) + "</h4>" + (it.d ? "<p>" + esc(it.d) + "</p>" : "") +
        '<div class="k-love">' + love + "</div></div></article>";
    });
    h += cards.length ? '<div class="k-cards">' + cards.join("") + "</div>" : '<div class="k-move">A slow day: playground, pool and ice cream time!</div>';
    if (T && T.nap && W.party().toddler) h += '<div class="k-nap"><span aria-hidden="true">😴</span> Nap time at ' + esc(W.clock(T.nap.start)) + "</div>";
    var meals = (day.slots || []).filter(function (x) { return x.item && W.isFood(x.slot) && x.slot !== "breakfast"; }).map(function (x) { return "<li><b>" + esc(W.SLOT_NAME[x.slot]) + ":</b> " + esc(x.item.n) + "</li>"; });
    if (meals.length) h += '<ul class="k-meals">' + meals.join("") + "</ul>";
    return h;
  }
  function passHtml(P) {
    var pl = places(P), got = pl.filter(stamped).length;
    var h = '<p class="k-count"><b>' + got + "</b> of " + pl.length + " stamps" + (got === pl.length ? " · a full passport!" : "") + "</p>" +
      '<p class="k-tip">A stamp lands when you get to each place. Tap one to stamp it yourself.</p><div class="k-pass">';
    h += pl.map(function (p, i) {
      var st = stamped(p), d = W.dateOf(p.n);
      return '<button type="button" class="stamp c' + (i % 6) + (st ? " on" : "") + '" data-stamp="' + esc(p.key) + '" aria-pressed="' + !!st + '"' + (st === "auto" ? " disabled" : "") +
        ' aria-label="' + esc(p.name + (st ? ", stamped" : ", not yet")) + '"><span class="st-in"><b>' + esc(p.name) + "</b><small>" + esc(st ? (d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Stamped") : p.trip ? "Day trip" : "Not yet") + "</small></span></button>";
    }).join("");
    return h + "</div>";
  }
  function huntHtml(P, tn) {
    var pl = places(P);
    if (!huntTown || !pl.some(function (p) { return p.key === huntTown; })) {
      var dd = P.days[(tn || W.S.day || 1) - 1], cur = dd && dd.trip ? W.cityKey(dd.trip.country, dd.trip.name) : dd ? W.cityKey(dd.country, dd.city) : pl[0].key;
      huntTown = pl.some(function (p) { return p.key === cur; }) ? cur : pl[0].key;
    }
    var p = pl.filter(function (x) { return x.key === huntTown; })[0], list = finds(P, p), got = (S().hunt || {})[p.key] || {}, n = list.filter(function (x, i) { return got[i]; }).length;
    var h = '<div class="k-towns">' + pl.map(function (x) { return '<button type="button" class="chip' + (x.key === huntTown ? " on" : "") + '" data-ktown="' + esc(x.key) + '" aria-pressed="' + (x.key === huntTown) + '">' + esc(x.name) + "</button>"; }).join("") + "</div>";
    h += '<p class="k-count">Can you find these in <b>' + esc(p.name) + "</b>? <span>" + n + " of " + list.length + " found</span></p>";
    h += '<ul class="k-hunt">' + list.map(function (f, i) {
      return '<li><button type="button" class="' + (got[i] ? "on" : "") + '" data-hunt="' + esc(p.key) + '" data-hi="' + i + '" aria-pressed="' + !!got[i] + '"><span class="hk" aria-hidden="true">' + (got[i] ? "✓" : "") + "</span>" + esc(f.charAt(0).toUpperCase() + f.slice(1)) + "</button></li>";
    }).join("") + "</ul>";
    return h;
  }

  /* ---------- taps ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button"); if (!b || !b.closest("#viewKids")) return;
    var d = b.dataset, s = S(), P = W.P;
    if (d.view) return;
    e.stopPropagation();
    if (d.ktab) { tab = d.ktab; W.render(); window.scrollTo(0, 0); return; }
    if (d.kday) { kday = Math.max(1, Math.min(P.N, kday + +d.kday)); W.render(); return; }
    if (d.ktown) { huntTown = d.ktown; W.render(); return; }
    if (W.readOnly) return;
    if (d.kpick) {
      var kp = s.kidPicks || (s.kidPicks = {}), k = W.norm(d.kpick), list = kp[k] || (kp[k] = []), at = list.indexOf(d.kname);
      if (at > -1) list.splice(at, 1); else list.push(d.kname);
      if (!list.length) delete kp[k];
      W.save(); W.render();
      if (at < 0) W.cheer(d.kname === "kids" ? "Picked!" : d.kname + " picked it!", "It shows on the grown-ups' plan too.");
      return;
    }
    if (d.stamp) {
      var st = s.stamps || (s.stamps = {});
      if (st[d.stamp]) delete st[d.stamp]; else { st[d.stamp] = W.isoDay(W.now()); W.cheer("Stamped!", "Another one for the passport."); }
      W.save(); W.render(); return;
    }
    if (d.hunt) {
      var hu = s.hunt || (s.hunt = {}), t = hu[d.hunt] || (hu[d.hunt] = {}), i = +d.hi;
      if (t[i]) delete t[i]; else t[i] = 1;
      W.save(); W.render();
      var list2 = W.huntFinds(P, d.hunt), n = list2.filter(function (x, j) { return t[j]; }).length, pl = d.hunt.split("|")[1] || "";
      if (t[i] && n === list2.length) W.cheer("Treasure hunters!", "You found everything in " + pl + "!", { big: true });
      else if (t[i]) W.cheer("Found it!", n + " of " + list2.length + " in " + pl + ".");
      return;
    }
  }, true);
})();
