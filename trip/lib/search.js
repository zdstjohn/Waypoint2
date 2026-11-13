/* Waypoint place search: find any place, not only the ones on the list, and put it on the day. Three sources, merged:
     - the city's own ideas (instant; "On your list", with the day it is already on)
     - Google Maps, through the viewer's own connection (lib/gmaps.js): Google's listings, each with its place ID; a
       pasted Google Maps link gives that one place. Without that connection the list and Claude answer, and a line
       says how to add it (Mapbox was a second map until v177: the owner's call, one map is enough)
     - Claude, for what the map does not know by that name, or a description ("calm beach for toddlers"); marked
       "Suggested by Claude" until the nightly place check confirms it
   A place you add joins the city's list as your own (S.imported, which travels with the trip) and goes into the part
   of the day you pick. The page itself cannot reach the internet: Google Maps comes through the connection, Claude
   through the app, and every answer goes through the same checks as the rest (W.V: a name, a pin near the city). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    V = W.V;
  /** @type {{ q: string, ck: string, seq: number, local: any[], gg: any[], ai: any[], busyMap: boolean, msgMap: string, pick: string | null, added: string, link: boolean }} */
  var st = { q: "", ck: "", seq: 0, local: [], gg: [], ai: [], busyMap: false, msgMap: "", pick: null, added: "", link: false };
  /** Claude's answers by search, for this visit only (searches are not kept with the trip) @type {Record<string, any[]>} */
  var aiRes = {};
  var FOOD =
    /\b(restaurant|food|cafe|café|coffee|bakery|ice cream|gelat|bar|pub|pizz|tavern|trattoria|osteria|pastry|deli|snack|seafood|bistro|fast food|wine|brunch|breakfast|dining)\b/i;
  var SLOTS_DO = [
      ["am", "Morning"],
      ["pm", "Afternoon"],
      ["eve", "Evening"]
    ],
    SLOTS_EAT = [
      ["breakfast", "Breakfast"],
      ["lunch", "Lunch"],
      ["dinner", "Dinner"]
    ];

  /** a pin needs both halves: the map search is centred on it @returns {{ lat: number, lng: number } | null} */
  function centerFor(country, city) {
    var h = W.homebase(country, city);
    if (h && h.lat != null && h.lng != null) return { lat: h.lat, lng: h.lng };
    var p = W.pool(country, city);
    if (p && p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng };
    var c = W.findCity(country, city);
    return c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null;
  }
  function words(q) {
    return W.norm(q)
      .split(" ")
      .filter(function (w) {
        return w.length > 1;
      });
  }
  /* one id per result, stable across redraws */
  function rid(src, n) {
    return src + ":" + W.norm(n);
  }

  /* the city's own ideas whose name or description has every word of the query */
  function local(q, country, city) {
    var p = W.pool(country, city);
    if (!p) return [];
    var ws = words(q);
    if (!ws.length) return [];
    var out = [];
    [
      [p.spots || [], false],
      [p.food || [], true]
    ].forEach(function (L) {
      /** @type {any[]} */ (L[0]).forEach(function (it) {
        if (W.gone && W.gone(it)) return;
        var hay = W.norm(it.n + " " + (it.d || "") + " " + (it.cuisine || ""));
        if (
          ws.every(function (w) {
            return hay.indexOf(w) > -1;
          })
        )
          out.push({
            id: rid("list", it.n),
            src: "list",
            n: it.n,
            d: it.d || "",
            lat: it.lat,
            lng: it.lng,
            gid: it.gid,
            food: L[1],
            it: it
          });
      });
    });
    return out.slice(0, 6);
  }

  /* why the map has nothing to add this time: not connected says how to connect; the installable app, or the viewer
     having said no or turned it off, says nothing (the note under the list covers it) */
  function mapMsg() {
    var why = W.gmState ? W.gmState().why : "";
    if (W.gmOn && W.gmOn()) return "The map search didn't answer this time.";
    return why === "none" || why === "needs_reauth"
      ? "Connect Google Maps in Claude to search the map too."
      : why === "offline"
        ? "You're offline: the map search needs a connection."
        : "";
  }
  /* Google Maps: up to five of its listings near the city */
  function google(q, country, city, seq) {
    var c = centerFor(country, city);
    if (!c) return;
    st.busyMap = true;
    st.msgMap = "";
    W.gmSearch(q, c, city, country).then(
      function (list) {
        if (seq !== st.seq) return;
        st.gg = list.map(function (r) {
          return Object.assign(r, { id: rid("g", r.n), src: "google", food: FOOD.test(r.d + " " + r.n + " " + q) });
        });
        st.busyMap = false;
        W.changed();
      },
      function () {
        if (seq !== st.seq) return;
        st.busyMap = false;
        st.msgMap = mapMsg();
        W.changed();
      }
    );
  }
  /* a pasted Google Maps link: the one place it is for */
  function fromLink(u, country, city, seq) {
    var c = centerFor(country, city);
    st.link = true;
    if (!c) {
      st.msgMap = "This city has no place on the map yet: type the place's name instead.";
      return;
    }
    st.busyMap = true;
    W.gmFromLink(u, c, city, country)
      .then(
        function (r) {
          if (seq !== st.seq) return;
          st.gg = [Object.assign(r, { id: rid("g", r.n), src: "google", link: true, food: FOOD.test((r.d || "") + " " + r.n) })];
        },
        function (e) {
          if (seq === st.seq) st.msgMap = (e && e.msg) || "That link couldn't be read. Type the place's name instead.";
        }
      )
      .then(function () {
        if (seq === st.seq) {
          st.busyMap = false;
          W.changed();
        }
      });
  }

  /* Claude: up to six real, named places for the words you typed, checked like every other list */
  function claude(q, country, city) {
    var ck = W.cityKey(country, city),
      c = centerFor(country, city),
      key = "find|" + ck + "|" + W.norm(q);
    if (!W.run || W.readOnly || !W.SAMPLE || navigator.onLine === false) return; /* (no signal: the lists and the note below it) */
    W.run(
      key,
      'Find places that match "' +
        q.replace(/"/g, "'").slice(0, 120) +
        '" in or near ' +
        city +
        ", " +
        country +
        ", for this family trip. " +
        W.who() +
        ' Give up to 6 real, specific, named places that exist and are open today, best match first: no generic suggestions (not "local tavernas" or "a beach"). ' +
        "For each: n = its name, d = one short line on what it is and why it fits, food = true for a place to eat or drink, lat and lng = where it is, " +
        "t = 1-3 tags from [" +
        W.TAGS.join(", ") +
        "], k = 1 if great for the children, 0 if fine, -1 if not suitable. " +
        "For places to eat also meal (breakfast, lunch, dinner, both or all), cuisine and price (€, €€ or €€€); for things to do also s (am, pm, eve or any), dur (e.g. 1-2h) and ticket (e.g. Free or €12).\n" +
        'Reply with JSON only: {"places":[{"n":"","d":"","food":false,"lat":0.0,"lng":0.0,"t":[],"k":0,"s":"any","dur":"","ticket":"","meal":"both","cuisine":"","price":""}]}',
      "quick",
      function (r) {
        var list = ((r && r.places) || [])
          .map(function (x) {
            if (!x || typeof x !== "object") return null;
            var food = x.food === true,
              it = food ? V.food(x, c) : V.spot(x, c);
            if (!it) return null;
            return { id: rid("ai", it.n), src: "ai", n: it.n, d: it.d, lat: it.lat, lng: it.lng, food: food, it: it };
          })
          .filter(Boolean);
        aiRes[key] = list.slice(0, 6);
      }
    );
  }

  /* run a search: the list at once, the map and Claude together */
  W.placeSearch = function (q, country, city) {
    q = String(q || "").trim();
    st.q = q;
    st.ck = W.cityKey(country, city);
    st.seq++;
    st.pick = null;
    st.added = "";
    st.local = [];
    st.gg = [];
    st.msgMap = "";
    st.busyMap = false; /* (an older search's answer is dropped: it must not leave "Searching the map…" on for this one) */
    st.link = false;
    if (q.length < 2) return;
    if (W.gmIsLink && W.gmIsLink(q)) return fromLink(W.gmIsLink(q), country, city, st.seq);
    st.local = local(q, country, city);
    /* no signal: the trip's own lists answer (above), and the map says why it does not */
    if (navigator.onLine === false) st.msgMap = "You're offline: the map search needs a connection.";
    else google(q, country, city, st.seq);
    claude(q, country, city);
  };

  /* every result once: the list first, then the map, then Claude; the same place from two sources shows once */
  function merged(country, city) {
    var key = "find|" + st.ck + "|" + W.norm(st.q),
      ai = aiRes[key] || [],
      seen = {},
      out = [];
    function same(a, b) {
      var x = W.norm(a),
        y = W.norm(b);
      return x === y || (x.length > 5 && y.indexOf(x) > -1) || (y.length > 5 && x.indexOf(y) > -1);
    }
    var onMap = function (x) {
      return x.src === "google";
    };
    st.local.concat(st.gg, st.link ? [] : ai).forEach(function (r) {
      if (
        out.some(function (o) {
          return same(o.n, r.n) && (o.lat == null || r.lat == null || (W.km(o, r) || 0) < 1.5);
        })
      ) {
        /* a Claude idea the map also knows: the map's pin and the "checked on the map" mark */
        var o = out.filter(function (o) {
          return same(o.n, r.n);
        })[0];
        if (o && o.src === "ai" && onMap(r)) {
          o.lat = r.lat;
          o.lng = r.lng;
          o.onMap = true;
        }
        if (o && onMap(o) && r.src === "ai" && r.it) {
          o.it = r.it;
          o.d = o.d || r.d;
        }
        return;
      }
      if (seen[r.id]) return;
      seen[r.id] = 1;
      out.push(Object.assign({}, r));
    });
    if (st.link) return { list: out, aiBusy: false, aiErr: "" };
    return { list: out, aiBusy: W.status[key] === "loading", aiErr: W.status[key] && W.status[key] !== "loading" ? W.status[key] : "" };
  }

  /* where a result sits relative to today's plan */
  function nearLine(r, day, P) {
    if (r.lat == null) return "";
    var home = W.homebase(day.country, day.city),
      best = /** @type {{ d: number, a: any } | null} */ (null);
    [home]
      .concat(
        (day.slots || []).map(function (x) {
          return x.item;
        })
      )
      .forEach(function (a) {
        if (!a || a.lat == null) return;
        var d = W.km(a, r);
        if (d != null && (!best || d < best.d)) best = { d: d, a: a };
      });
    if (!best) return "";
    var lg = W.leg(best.a, r, true),
      from = best.a === home ? "where you're staying" : best.a.n;
    return lg ? W.fmtMin(lg.min) + " " + lg.label.toLowerCase() + " from " + from : W.fmtKm(best.d) + " from " + from;
  }

  /** the search box and its results, for one day @param {Day} day @param {Plan} P */
  W.searchBlock = function (day, P) {
    if (window.__WP_OFFLINE)
      return '<section class="psearch sk" aria-label="Search for a place"><p class="small muted ps-hint">Searching for a new place needs the live app. Every idea below is in this copy.</p></section>';
    var ck = W.cityKey(day.country, day.city);
    if (st.ck !== ck && st.q) {
      st.q = "";
      st.local = [];
      st.gg = [];
      st.link = false;
      st.pick = null;
      st.added = "";
    }
    var h =
      '<section class="psearch sk" aria-label="Search for a place"><div class="ps-row"><input class="field" id="placeQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search places in ' +
      esc(day.city) +
      '…" aria-label="Search any place in ' +
      esc(day.city) +
      '" value="' +
      esc(st.q) +
      '">' +
      '<button type="button" class="btn" data-psearch="1">Search</button></div>';
    if (!st.q)
      return (
        h +
        (navigator.onLine === false
          ? '<p class="small muted ps-hint">You\'re offline: this finds places already in your lists. Places from the map need a connection.</p></section>'
          : '<p class="small muted ps-hint">A restaurant you heard about, a beach, "gelato", ' +
            (P.p.toddler ? '"rainy day with toddlers"' : P.p.kid ? '"rainy day with kids"' : '"rainy afternoon"') +
            (W.gmOn && W.gmOn() ? ", or a link from Google Maps" : "") +
            "… then add it to Day " +
            day.n +
            ".</p></section>")
      );
    var M = merged(day.country, day.city),
      dayOf = {};
    P.days.forEach(function (d) {
      (d.slots || []).forEach(function (x) {
        if (x.item) dayOf[W.norm(x.item.n)] = d.n;
      });
    });
    if (st.added) h += '<p class="ps-ok" role="status">' + esc(st.added) + "</p>";
    h +=
      '<ul class="ps-list">' +
      M.list
        .map(function (r) {
          var tag =
            r.src === "list"
              ? '<span class="ps-src list">On your list' + (dayOf[W.norm(r.n)] ? " · Day " + dayOf[W.norm(r.n)] : "") + "</span>"
              : r.src === "google"
                ? '<span class="ps-src map">' + (r.link ? "From your link" : "On Google Maps") + "</span>"
                : r.onMap
                  ? '<span class="ps-src map">On the map</span>'
                  : '<span class="ps-src ai" title="Suggested by Claude; not checked against the map yet">Suggested by Claude</span>';
          var near = nearLine(r, day, P),
            gm = W.gmapsPlace(r, day.city);
          var open = st.pick === r.id,
            slots = r.food ? SLOTS_EAT : SLOTS_DO;
          var picker = !open
            ? ""
            : '<div class="ps-slots" role="group" aria-label="Add ' +
              esc(r.n) +
              " to Day " +
              day.n +
              '">' +
              slots
                .map(function (s) {
                  var x = (day.slots || []).filter(function (y) {
                      return y.slot === s[0];
                    })[0],
                    now = x && x.item ? "replaces " + x.item.n : x ? "free" : "";
                  return (
                    '<button type="button" class="ps-slot" data-padd="' +
                    esc(r.id) +
                    '" data-pslot="' +
                    s[0] +
                    '"><b>' +
                    s[1] +
                    "</b>" +
                    (now ? "<span>" + esc(now) + "</span>" : "") +
                    "</button>"
                  );
                })
                .join("") +
              '<button type="button" class="linkish" data-ppick="">Cancel</button></div>';
          return (
            '<li class="ps-it' +
            (open ? " open" : "") +
            '"><div class="ps-b"><b>' +
            esc(r.n) +
            "</b>" +
            tag +
            (r.d ? '<span class="ps-d">' + esc(r.d) + "</span>" : "") +
            (near ? '<span class="ps-near">' + esc(near) + "</span>" : "") +
            '<span class="ps-l">' +
            W.extLink(gm, "Google Maps ↗") +
            "</span></div>" +
            (W.readOnly
              ? ""
              : '<button type="button" class="btn sm' +
                (open ? " quiet" : "") +
                '" data-ppick="' +
                esc(open ? "" : r.id) +
                '" aria-expanded="' +
                open +
                '">+ Add</button>') +
            picker +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
    var busy = st.busyMap || M.aiBusy;
    if (busy)
      h +=
        '<p class="loading ps-busy">' +
        (st.link
          ? "Reading your Google Maps link…"
          : st.busyMap && M.aiBusy
            ? "Searching the map and asking Claude…"
            : st.busyMap
              ? "Searching the map…"
              : "Asking Claude…") +
        "</p>";
    if (!busy && !M.list.length && !st.link)
      h +=
        '<p class="small muted">Nothing found for "' +
        esc(st.q) +
        '". Try the place\'s own name, or a kind of place ("bakery", "playground").</p>';
    if (st.msgMap) h += '<p class="small muted">' + esc(st.msgMap) + "</p>";
    /* Google's own results for the same words, in Google Maps (they open there; add one here by searching its name) */
    if (!st.link)
      h +=
        '<p class="ps-google">' +
        W.extLink(
          "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(st.q + " near " + day.city + ", " + day.country),
          "Search Google Maps for “" + esc(st.q) + "” near " + esc(day.city) + " ↗"
        ) +
        "</p>";
    if (M.aiErr) h += '<p class="small muted">' + esc(M.aiErr) + "</p>";
    if (W.standalone && !W.cloud)
      return (
        h +
        '<p class="small muted ps-src-note">This version searches the ideas it has. Searching the map and asking Claude come with the full Waypoint, in Claude.</p></section>'
      );
    if (W.standalone)
      return (
        h +
        '<p class="small muted ps-src-note">Places marked "Suggested by Claude" haven\'t been checked against a map: look one up before you go.</p></section>'
      );
    return (
      h +
      '<p class="small muted ps-src-note">' +
      (st.gg.length ? "Places, ratings and descriptions from Google Maps · ideas" : "Ideas") +
      ' marked "Suggested by Claude" are checked against the map overnight.</p></section>'
    );
  };

  /* add a found place to the city's list (as your own) and put it in the day */
  function addFound(r, day, slot, P) {
    var ck = W.cityKey(day.country, day.city),
      pool = W.pool(day.country, day.city);
    var have =
      pool &&
      (pool.spots || []).concat(/** @type {any[]} */ (pool.food || [])).some(function (x) {
        return W.norm(x.n) === W.norm(r.n);
      });
    if (!have) {
      var imp = W.S.imported || (W.S.imported = {}),
        L = imp[ck] || (imp[ck] = []),
        it = r.it || {};
      var food = W.isFood(slot);
      /* from Google: its place ID is kept (every Google Maps link then opens that listing); its pin for 30 days
         (lib/import.js); its description and rating not at all */
      var g = r.src === "google";
      L.push({
        n: r.n,
        d: g ? it.d || "" : r.d || it.d || "",
        lat: r.lat,
        lng: r.lng,
        gid: g && r.gid ? r.gid : undefined,
        gat: g && r.gid && r.lat != null ? W.isoDay(new Date()) : undefined,
        food: food,
        slot: slot,
        src: r.src === "ai" && !r.onMap ? "claude" : g ? "google" : "map",
        t: it.t || [],
        k: it.k || 0,
        s: it.s,
        dur: it.dur,
        ticket: it.ticket,
        meal: food ? (it.meal && it.meal !== "both" ? it.meal : "all") : undefined,
        cuisine: it.cuisine,
        price: it.price
      });
      if (pool) pool._imp = ""; /* lay it in on the next read */
    }
    W.useIdea(day, slot, r.n, P);
    st.pick = null;
    st.added = r.n + " is on Day " + day.n + ", " + W.SLOT_NAME[slot].toLowerCase() + ".";
  }

  /** clicks inside the search; true when handled @param {DOMStringMap} d @param {Day} day @param {Plan} P */
  W.searchClick = function (d, day, P) {
    if (d.psearch) {
      var q = /** @type {HTMLInputElement | null} */ (document.getElementById("placeQ"));
      W.placeSearch(q ? q.value : "", day.country, day.city);
      return true;
    }
    if (d.ppick !== undefined) {
      st.pick = d.ppick || null;
      st.added = "";
      return true;
    }
    if (d.padd && d.pslot) {
      var M = merged(day.country, day.city),
        r = M.list.filter(function (x) {
          return x.id === d.padd;
        })[0];
      if (r) addFound(r, day, d.pslot, P);
      return true;
    }
    return false;
  };
  /* Enter in the box searches */
  document.addEventListener("keydown", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (e.key !== "Enter" || !t || t.id !== "placeQ") return;
    e.preventDefault();
    var b = document.querySelector('[data-psearch="1"]');
    if (b) /** @type {HTMLElement} */ (b).click();
  });
})();
