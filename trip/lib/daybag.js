/* Waypoint day bag: on Today, a short list of what to take out for the day, read off the day's own stops (a beach asks
   for swimsuits, a church for covered shoulders, a market for cash, a travel day for snacks and the tickets in one
   pocket). Each line says which stop asked for it. Ticks are kept with the trip by city and day there
   (S.bag: {"<country>|<city>|<day in city>": {"<item>": 1}}), so adding or removing a day elsewhere never moves them.
   While the trip is on and Today is open, the screen can stay on (the browser's screen wake lock), so directions and the
   next stop don't vanish while you walk; a setting on this phone turns that off. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;

  var HOT =
    /Greece|Italy|Spain|Portugal|Turkey|Croatia|Cyprus|Malta|Egypt|Morocco|Israel|Jordan|Tunisia|Mexico|Thailand|Vietnam|India|United Arab Emirates|Qatar|Oman/;
  W.dayBag = function (day, P) {
    var out = [],
      seen = {},
      p = (P && P.p) || W.party(),
      kids = !!p.kid,
      tod = !!p.toddler;
    function add(id, t, why) {
      if (seen[id]) {
        if (why && seen[id].why.indexOf(why) < 0 && seen[id].why.length < 2) seen[id].why.push(why);
        return;
      }
      seen[id] = { id: id, t: t, why: why ? [why] : [] };
      out.push(seen[id]);
    }
    var stops = (day.slots || []).filter(function (x) {
        return x.item;
      }),
      outdoor = 0,
      longOut = 0;
    var dt = W.dateOf(day.n),
      mo = (dt || new Date()).getMonth(),
      hot = mo >= 5 && mo <= 8 && HOT.test(day.country);
    stops.forEach(function (x) {
      var it = /** @type {Spot | Food} */ (x.item) /* stops keeps only the slots with a place */,
        food = W.isFood(x.slot),
        c = W.classify(it, food),
        k = c.kind || "",
        n = it.n,
        t = (n + " " + (it.d || "")).toLowerCase();
      if (food) {
        if (k === "streetfood" || /market|street food|food hall/.test(t)) add("cash", "Some cash in small notes", n);
        return;
      }
      if (!c.indoor) {
        outdoor++;
        if (c.min >= 150) longOut++;
      }
      if ((W.isBeach && W.isBeach(it)) || k === "waterpark" || /\b(beach|lido|pool|swim|water ?park|aqua ?park)\b/.test(t)) {
        add("swim", kids ? "Swimsuits, towels and a dry change of clothes" : "Swimsuits and towels", n);
        add("sun", "Sunscreen and sun hats", n);
        if (kids) add("shoes-w", "Water shoes for the kids (pebbles and rocks)", n);
      }
      if (c.act === "on the water" || /\b(boat|ferry|cruise|sailing|catamaran|kayak|snorkel)/.test(t)) {
        add("wind", "A light layer for the wind on the water", n);
        add("sea", "Something for seasickness, if anyone gets it", n);
      }
      if (c.act === "hike" || k === "mountain" || k === "gorge" || c.intensity >= 3) {
        add("shoes", "Good walking shoes", n);
        add("water", "A full water bottle each", n);
      }
      if (k === "church" || k === "temple" || /\b(church|cathedral|basilica|monastery|chapel|mosque|abbey|convent)\b/.test(t))
        add("cover", "Shoulders and knees covered (a light scarf works)", n);
      if (k === "museum" && kids) add("smallbag", "A small bag (big backpacks often have to be checked)", n);
      if (k === "market" || /\bmarket\b|bazaar|souk/.test(t)) add("cash", "Some cash in small notes", n);
      if (tod && c.stroller === false) add("carrier", "The baby carrier (no stroller there)", n);
      if (x.slot === "eve" && !c.indoor) add("layer", "A light layer for the evening", n);
    });
    if (hot && outdoor) {
      add("sun", "Sunscreen and sun hats", "A hot day out");
      add("water", "A full water bottle each", "A hot day out");
    }
    if (day.moveFrom) {
      add("docs", "Tickets and passports in one easy pocket", day.moveFrom + " → " + day.city);
      add("snacks", "Snacks and water for the journey", day.moveFrom + " → " + day.city);
      if (kids) add("busy", "Something to keep the kids busy on the way", day.moveFrom + " → " + day.city);
    } else if (kids && stops.length) add("snacks", "Snacks and water", longOut ? "A long day out" : "");
    var T = null;
    try {
      T = W.dayTimes(day, P);
    } catch (e) {
      W.caught(e, "the day's times, for the day bag");
    }
    if (tod && T && T.nap && T.nap.away) add("nap", "A stroller cover or blanket for a nap on the go", "Nap out today");
    if (longOut >= 2 || day.moveFrom) add("power", "A charged phone (or a power bank)", "");
    return out.map(function (o) {
      return { id: o.id, t: o.t, why: o.why.filter(Boolean).join(" · ") };
    });
  };

  /* ---------- keeping the screen on ---------- */
  var lock = null,
    asking = false,
    refused = false,
    want = false;
  function lget(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lset(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  W.awakeOn = function () {
    return lget("waypoint-awake") !== "0";
  };
  W.awakeCan = function () {
    return !!(navigator.wakeLock && navigator.wakeLock.request);
  };
  function sync() {
    var on = want && W.awakeOn() && W.awakeCan() && document.visibilityState === "visible" && W.view && W.view() === "go";
    if (on && !lock && !asking && !refused) {
      asking = true;
      navigator.wakeLock.request("screen").then(
        function (l) {
          asking = false;
          lock = l;
          l.addEventListener("release", function () {
            if (lock === l) lock = null;
          });
          if (!(want && W.awakeOn() && W.view() === "go")) {
            l.release().catch(function () {});
            lock = null;
          }
        },
        function () {
          asking = false;
          if (!refused) {
            refused = true;
            if (W.view && W.view() === "go") W.render();
          }
        }
      );
    } else if (!on && lock) {
      var l0 = lock;
      lock = null;
      l0.release().catch(function () {});
    }
  }
  /* Today calls this each time it draws: live = the day shown is today, while the trip is on */
  W.awakeTick = function (live) {
    want = !!live;
    sync();
  };
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("hashchange", function () {
    setTimeout(sync, 0);
  });
  setInterval(sync, 5000); /* leaving Today by any other route (a tab, a link) lets the screen sleep again soon */

  /** how much of the day's bag is packed @returns {{n: number, total: number} | null} */
  W.dayBagState = function (day, P) {
    var items = W.dayBag(day, P),
      got = (W.S.bag || {})[W.restKey(day)] || {};
    return items.length
      ? {
          n: items.filter(function (o) {
            return got[o.id];
          }).length,
          total: items.length
        }
      : null;
  };
  /* ---------- the card ---------- */
  W.dayBagCard = function (day, P, live) {
    var items = W.dayBag(day, P);
    if (!items.length) return "";
    var bk = W.restKey(day),
      got = (W.S.bag || {})[bk] || {},
      n = items.filter(function (o) {
        return got[o.id];
      }).length,
      can = W.canEdit ? W.canEdit() : true;
    var h =
      '<section class="go-bag sk" aria-label="Day bag"><div class="gb-h"><h3>Day bag</h3><span class="small muted">' +
      (n === items.length ? "All packed" : n + " of " + items.length + " packed") +
      '</span></div><ul class="gb-l">' +
      items
        .map(function (o) {
          var on = !!got[o.id];
          return (
            '<li><button type="button" class="gb-i' +
            (on ? " on" : "") +
            '" data-bag="' +
            esc(o.id) +
            '" data-bagday="' +
            esc(bk) +
            '" aria-pressed="' +
            on +
            '"' +
            (can ? "" : " disabled") +
            ">" +
            '<span class="box" aria-hidden="true">' +
            (on
              ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>'
              : "") +
            "</span>" +
            "<span><b>" +
            esc(o.t) +
            "</b>" +
            (o.why ? '<span class="small muted">' + esc(o.why) + "</span>" : "") +
            "</span></button></li>"
          );
        })
        .join("") +
      "</ul>";
    if (live && W.awakeCan())
      h +=
        '<div class="gb-awake"><button type="button" class="tog" data-awake="1" role="switch" aria-checked="' +
        W.awakeOn() +
        '"><span class="tg" aria-hidden="true"><i></i></span><span>Keep the screen on while Today is open</span></button>' +
        (W.awakeOn() && refused
          ? "<span class=\"small muted\">This browser didn't allow it here. Your phone's own screen timeout still applies.</span>"
          : "") +
        "</div>";
    return h + "</section>";
  };
  W.bagClick = function (d) {
    if (d.awake) {
      lset("waypoint-awake", W.awakeOn() ? "0" : "1");
      refused = false;
      sync();
      return true;
    }
    if (!d.bag || !d.bagday) return false;
    var S = W.S,
      b = S.bag || (S.bag = {}),
      day = b[d.bagday] || (b[d.bagday] = {});
    if (day[d.bag]) delete day[d.bag];
    else day[d.bag] = 1;
    if (!Object.keys(day).length) delete b[d.bagday];
    return true;
  };
})();
