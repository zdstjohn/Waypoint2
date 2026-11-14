/* Waypoint, a step ahead: once what you are looking at has settled, the phone quietly fetches what you are about to
   look at. Three things, all only on a connection that is not metered and never in Simple view or offline:
   (1) the next and the previous day's header photo and the first few stops' photos, so a swipe between days shows them
       at once (a day change drops what was not fetched yet), and
   (2) the evening before a day that moves to a new town, that town's street-map pack, asked of the pack worker
       (lib/vtmap.js keeps it on the phone), at most one pack a day, and
   (3) while a day of a town with a street map is read, the map's engine, so the map waits only for the town's pack
       (v192).
   Nothing here changes what a screen shows; it only warms the browser's cache. */
(function () {
  "use strict";
  var W = window.W;
  var STOP_PHOTOS = 3 /* stop photos warmed per day: the first ones are what a swipe shows first */,
    SEEN_MAX = 60 /* pictures remembered as already asked for */,
    EVENING = 17 /* hour (by the trip's clock) from which tomorrow's map is fetched */,
    MAP_KEY = "waypoint-ahead-map",
    LANES = 2; /* pictures fetched at the same time */
  var lastFill = "",
    gen = 0 /* counts day changes: work for an older day stops */,
    last = "" /* the day (and view) the last tick saw */,
    cancelIdle = /** @type {null | (() => void)} */ (null),
    held = /** @type {HTMLImageElement[]} */ ([]) /* pictures on their way (kept so they are not dropped half fetched) */,
    seen = /** @type {Record<string, number>} */ ({}),
    seenN = 0,
    mapTries = 0,
    loadWait = false;

  /** The network, as far as the phone says: `strict` also holds back on a mobile-data connection and when the phone does
      not say at all (a map pack is megabytes: only where it is known to cost nothing). */
  function unmetered(strict) {
    try {
      if (navigator.onLine === false) return false;
      var c = /** @type {any} */ (navigator).connection;
      if (!c) return !strict;
      if (c.saveData || /^(slow-)?2g$/.test(String(c.effectiveType || ""))) return false;
      if (strict && c.type === "cellular") return false;
    } catch (e) {
      /* (the phone does not say: treated as unmetered for photos, held back for maps) */
    }
    return true;
  }
  /* nothing at all in Simple view, offline, or from an offline copy (its photos are already on the phone) */
  function allowed() {
    if (W.simple && W.simple()) return false;
    if ((W.offline && W.offline.off) || window.__WP_OFFLINE) return false;
    return true;
  }

  /** Run `fn` in idle time (a short wait where the phone has no idle callbacks). Returns the way to cancel it. */
  function idle(fn, wait) {
    var done = false;
    function run() {
      if (done) return;
      done = true;
      fn();
    }
    if (window.requestIdleCallback) {
      var h = window.requestIdleCallback(run, { timeout: wait || 6000 });
      return function () {
        done = true;
        if (window.cancelIdleCallback) window.cancelIdleCallback(h);
      };
    }
    var t = setTimeout(run, Math.min(1500, wait || 1500));
    return function () {
      done = true;
      clearTimeout(t);
    };
  }

  /* what an <img> in this markup would ask for (the same address and srcset the screen itself uses, so the picture
     that arrives now is the one it will ask for) */
  function reqOf(html) {
    if (!html) return null;
    var t = document.createElement("template");
    t.innerHTML = html; /* (an inert fragment: nothing is fetched from it) */
    var i = t.content.querySelector("img");
    var src = i && i.getAttribute("src");
    if (!i || !src) return null;
    /* a photo with a WebP copy comes as <picture>: the screen takes the WebP one (every browser the app runs in reads
       WebP), so that is the one to fetch, or the JPEG would arrive and never be shown */
    var s = t.content.querySelector('picture source[type="image/webp"]');
    var ss = s && s.getAttribute("srcset");
    if (ss) return { src: src, srcset: ss, sizes: (s && s.getAttribute("sizes")) || i.getAttribute("sizes") };
    return { src: src, srcset: i.getAttribute("srcset"), sizes: i.getAttribute("sizes") };
  }
  W.aheadReqOf = reqOf; /* (for the tests) */
  /** The header photo, then the first few stops' photos, of one day. */
  function wanted(day) {
    var out = [],
      slots = day.slots || [];
    var spots = slots
      .filter(function (x) {
        return x.item && !W.isFood(x.slot);
      })
      .map(function (x) {
        return x.item;
      });
    var hero = W.cityPhoto ? W.cityPhoto(day.country, day.city, spots) : null;
    var h = hero && W.heroImg ? reqOf(W.heroImg(hero, "")) : null;
    if (h) out.push(h);
    var n = 0;
    slots.forEach(function (x) {
      if (n >= STOP_PHOTOS || !x.item || !W.picture) return;
      var r = reqOf(W.picture(x.item, W.isFood(x.slot), day.country, day.city));
      if (r) {
        out.push(r);
        n++;
      }
    });
    return out;
  }

  /** Fetch the pictures, a couple at a time; a day change (g no longer current) stops the rest and drops what is on its way. */
  function fetchAll(list, g) {
    var i = 0;
    function lane() {
      if (g !== gen || i >= list.length) return;
      var r = list[i++],
        key = (r.srcset || "") + "|" + r.src;
      if (seen[key]) return lane();
      if (seenN >= SEEN_MAX) {
        seen = {};
        seenN = 0;
      }
      seen[key] = 1;
      seenN++;
      var im = new Image();
      /** @type {any} */ (im).fetchPriority = "low"; /* (behind anything the screen itself asks for) */
      im.decoding = "async";
      var next = function () {
        var at = held.indexOf(im);
        if (at > -1) held.splice(at, 1);
        lane();
      };
      im.onload = im.onerror = next;
      held.push(im);
      if (r.sizes) im.sizes = r.sizes;
      if (r.srcset) im.srcset = r.srcset;
      im.src = r.src;
    }
    for (var k = 0; k < LANES; k++) lane();
  }
  /** Stop what is on its way (the day changed, or the phone went offline). */
  function drop() {
    gen++;
    if (cancelIdle) cancelIdle();
    cancelIdle = null;
    held.splice(0).forEach(function (im) {
      im.onload = im.onerror = null;
      /* (an empty address cancels a fetch that has not finished; one that has stays in the browser's cache) */
      if (!im.complete) im.removeAttribute("src");
    });
    /* what was cancelled before it came may be asked for again */
    seen = {};
    seenN = 0;
  }

  /* the day's own header is the largest thing on the first screen: wait until it is in before taking the line */
  function heroPending() {
    var h = /** @type {HTMLImageElement | null} */ (document.querySelector("#viewTrip:not([hidden]) .hero-img"));
    return !!(h && !h.complete);
  }

  function photosAhead(P, g, tries) {
    if (g !== gen) return;
    if (heroPending() && tries < 12) {
      cancelIdle = idle(function () {
        setTimeout(function () {
          photosAhead(P, g, tries + 1);
        }, 600);
      });
      return;
    }
    if (!allowed() || !unmetered(false)) return;
    var n = W.S.day,
      list = [];
    [n + 1, n - 1].forEach(function (k) {
      var day = P.days[k - 1];
      if (day) list = list.concat(wanted(day));
    });
    fetchAll(list, g);
  }

  /* ---------- tomorrow's street map ---------- */
  function mapSlugFor(P, day) {
    var s = P.stops[day.stop];
    if (!s || !W.vtFor) return null;
    var hb = W.homebase ? W.homebase(s.country, s.name) : null,
      c = W.stopAt ? W.stopAt(s) : null,
      lat = hb && hb.lat != null ? hb.lat : c && c.lat,
      lng = hb && hb.lng != null ? hb.lng : c && c.lng;
    return lat != null ? W.vtFor(s.country, s.name, lat, lng) : null;
  }
  function mapAhead(P) {
    if (W.readOnly || !W.vtWarm || !W.todayN || !W.now) return;
    var n = W.todayN(P);
    if (!n || n >= P.N || W.now().getHours() < EVENING) return;
    var next = P.days[n]; /* (tomorrow: the list starts at day 1) */
    if (!next || !next.moveFrom) return; /* only a day that moves to a new town */
    if (!allowed() || !unmetered(true) || (W.vtState && W.vtState() === "off") || mapTries >= 2) return;
    var today = W.isoDay(W.now()),
      had = "";
    try {
      had = localStorage.getItem(MAP_KEY) || "";
    } catch (e) {
      /* (storage closed: the map is simply fetched again, at most twice a visit) */
    }
    if (had.slice(0, 10) === today) return; /* one pack a day */
    var slug = mapSlugFor(P, next);
    if (!slug) return; /* (the list of packs may not be in yet: the next tick tries again) */
    try {
      localStorage.setItem(MAP_KEY, today + " " + slug);
    } catch (e) {
      /* (storage closed: as above) */
    }
    mapTries++;
    var warm = W.vtWarm;
    idle(function () {
      if (!unmetered(true)) return;
      Promise.resolve(warm(String(slug))).then(null, function () {
        /* it did not come: try once more later in this visit */
        try {
          localStorage.removeItem(MAP_KEY);
        } catch (e) {
          /* (nothing to undo) */
        }
      });
    }, 2000);
  }

  /* ---------- the map's engine, before a map is on the screen (v192) ---------- */
  /* Today opens with the day's street map where the town has one, and the engine that draws it is the largest file the
     app has (it is fetched when a map is first shown). While a day of such a town is read, on the Day view or Today,
     the engine is asked for in idle time, so the map waits only for the town's pack. Held to the map packs' rule (only
     where the connection is known not to be mobile data), and asked once: the engine says when it is in or can't run. */
  var engineWait = false;
  function engineAhead(P) {
    if (engineWait || !W.vtEngineWarm || !W.vtState || W.vtState() !== "idle") return;
    if (document.readyState !== "complete" || !allowed() || !unmetered(true)) return;
    var v = W.view ? W.view() : "",
      day = P.days[W.S.day - 1];
    if ((v !== "trip" && v !== "go") || !day || !mapSlugFor(P, day)) return;
    engineWait = true;
    idle(function () {
      engineWait = false;
      if (unmetered(true) && W.vtEngineWarm) W.vtEngineWarm();
    }, 4000);
  }

  /** Called after each screen is drawn (screens/trip.js). The work is planned only when the day (or the screen) changed. */
  W.aheadTick = function (P) {
    if (!P || !P.days || !P.days.length) return;
    mapAhead(P);
    engineAhead(P);
    var key =
      (W.S.tripId || "") +
      "|" +
      W.S.day +
      "|" +
      (document.querySelector("#viewTrip:not([hidden])") ? "t" : "o") +
      "|" +
      (W.simple && W.simple() ? "s" : "");
    /* what the two neighbouring days hold so far (a town's ideas can arrive after its days are drawn) */
    var fill = [W.S.day - 1, W.S.day + 1]
      .map(function (k) {
        var d = P.days[k - 1];
        return d
          ? (d.slots || []).filter(function (x) {
              return x.item;
            }).length
          : 0;
      })
      .join(",");
    if (key === last && fill === lastFill) return;
    if (key !== last) drop(); /* the day changed: what was on its way for the old one stops */
    else if (cancelIdle) cancelIdle(); /* more of a neighbour has arrived: look again (pictures already asked for are kept) */
    last = key;
    lastFill = fill;
    if (!allowed()) return;
    /* not before the page has settled (its own pictures and scripts first) */
    if (document.readyState !== "complete") {
      if (!loadWait) {
        loadWait = true;
        window.addEventListener("load", function () {
          loadWait = false;
          last = "";
          if (W.P && W.aheadTick) W.aheadTick(W.P);
        });
      }
      return;
    }
    var g = gen;
    cancelIdle = idle(function () {
      photosAhead(P, g, 0);
    });
  };
  /* going offline stops it at once */
  window.addEventListener("offline", function () {
    drop();
    last = ""; /* (and plans again at the next screen once the connection is back) */
  });
  /* ---------- the slim bar's photo (v180) ---------- */
  /* Where the day's photo sits in the slim bar: the top card draws it "cover", centred across and 40% down (app.css);
     the bar takes the same size and offset, moved up by the card's height less its own, so its strip is the card's
     bottom one. Measured from the card itself (it stays in the page, scrolled away) when the bar shows (lib/warm.js)
     and when the window changes size; the photo's own size is read once per photo. Until then app.css shows the
     photo's bottom. (Here, in the second script: the bar only shows after scrolling.) */
  var pinPhoto = { url: "", w: 0, h: 0 };
  function pinPhotoFit() {
    var root = document.documentElement,
      top = /** @type {HTMLElement | null} */ (document.querySelector("header.top")),
      url = (top && top.getAttribute("data-photo")) || "";
    if (!top || !url) return;
    if (pinPhoto.url !== url) {
      pinPhoto = { url: url, w: 0, h: 0 };
      var im = new Image();
      im.onload = function () {
        if (pinPhoto.url !== url) return;
        pinPhoto.w = im.naturalWidth;
        pinPhoto.h = im.naturalHeight;
        pinPhotoFit();
      };
      im.src = url;
      return;
    }
    if (!pinPhoto.w || !pinPhoto.h) return;
    /* The bar's box is measured on a hidden stand-in (the same class, never seen), so the photo is in place before
       the bar first shows: measured on the bar itself, it was placed only in the frame after it appeared, and the
       photo jumped as you scrolled (v182: "jittery"). The stylesheet stays the one place that says where the bar is. */
    var probe = document.createElement("div");
    probe.className = "pin";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "visibility:hidden;pointer-events:none;animation:none";
    document.body.appendChild(probe);
    var c = top.getBoundingClientRect(),
      bar = getComputedStyle(probe, "::before"),
      pr = probe.getBoundingClientRect(),
      bl = pr.left + (parseFloat(bar.left) || 0),
      bh = pr.height - (parseFloat(bar.top) || 0) - (parseFloat(bar.bottom) || 0);
    probe.remove();
    if (!c.width || !c.height || !(bh > 0)) return;
    var k = Math.max(c.width / pinPhoto.w, c.height / pinPhoto.h),
      w = pinPhoto.w * k,
      h = pinPhoto.h * k,
      x = (c.width - w) / 2 + (c.left - bl),
      y = (c.height - h) * 0.4 - (c.height - bh);
    root.style.setProperty("--pin-photo-size", Math.round(w) + "px " + Math.round(h) + "px");
    root.style.setProperty("--pin-photo-at", Math.round(x) + "px " + Math.round(y) + "px");
  }
  /* at most once a frame, however many resizes or calls come in it (it reads the layout; v181) */
  var pinFitTick = 0;
  W.pinPhotoFit = function () {
    if (!pinFitTick)
      pinFitTick = requestAnimationFrame(function () {
        pinFitTick = 0;
        pinPhotoFit();
      });
  };
  window.addEventListener("resize", W.pinPhotoFit);
  /* (the day's photo may have been put on the card before this second script came: place it in the bar now, not
     when the bar first shows) */
  W.pinPhotoFit();
})();
