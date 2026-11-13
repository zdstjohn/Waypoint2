/* Waypoint photos: real, freely licensed photos (Wikipedia/Wikimedia) stored in this app's own files
   and listed in its database. A place's own photo when there is one, otherwise one taken near it (labelled so),
   otherwise nothing: the row simply has no picture. Places to eat show only a picture of the restaurant itself. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;

  /* ---------- real photos from the app's database ---------- */
  var PHOTOS = {},
    BYCITY = {},
    IDX = {},
    DB = null,
    LINKS = {};
  /* official site for a place, checked against Wikidata (the database behind Wikipedia) */
  W.officialLink = function (it, country, city) {
    var c = LINKS[want("links", W.slug(country + " " + city))],
      l = c && c[W.norm(it.n)];
    return l && l.url ? l : null;
  };
  /* "Photos" link: an image search for the place */
  W.photosUrl = function (name, city) {
    return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(name + " " + city);
  };
  W.slug = function (s) {
    return W.norm(s).replace(/ /g, "-").slice(0, 80) || "x";
  };
  /** a city's id in the shared database (photos, links, places to eat, menus, the city library) @param {string} country @param {string} city */
  W.citySlug = function (country, city) {
    return W.slug(country + " " + city);
  };
  var citySlug = W.citySlug;

  /* words that say what sort of place something is, not which one ("museum", "piazza", "evening") */
  var GENERIC = {};
  (
    "the and of at in on with from to near for by a an del della delle dei degli di de da la le les los las el il lo l d du des " +
    "san santa santo sant saint st museum museo musee museu church chiesa iglesia eglise basilica cathedral duomo catedral castle castello " +
    "castillo chateau palace palazzo palacio palais park parco parque garden gardens giardino jardin beach beaches spiaggia playa plage " +
    "square piazza plaza place street via calle rue old town city centre center historic quarter district neighborhood neighbourhood " +
    "tour tours visit walk stroll evening morning afternoon day trip sunset sunrise view views viewpoint national tower torre bridge ponte " +
    "market mercato mercado gallery galleria art arts modern royal great grand little new lake lago mount monte island isola river port " +
    "harbour harbor marina cafe food local famous best area hill hills coast village villages region temple fort fortress monastery " +
    "abbey chapel fountain fontana gate porta arch"
  )
    .split(" ")
    .forEach(function (w) {
      GENERIC[w] = 1;
    });
  function idWords(s, skip) {
    return W.norm(s)
      .split(" ")
      .filter(function (w) {
        return w.length > 2 && !GENERIC[w] && !skip[w];
      });
  }
  /* a city's own photos (not "nearby" stand-ins), each with the words that identify it */
  function index(slug, items, country, city) {
    if (IDX[slug]) return IDX[slug];
    var skip = {};
    idWords(country + " " + city, {}).forEach(function (w) {
      skip[w] = 1;
    });
    var out = [];
    Object.keys(items).forEach(function (k) {
      var p = items[k];
      if (!p || !p.url || p.near) return;
      var ws = idWords(k, skip);
      /* one identifying word must be long enough to be a name ("pantheon", "uffizi"), not a common word */
      if (ws.length >= 2 || (ws.length === 1 && ws[0].length >= 6)) out.push({ ws: ws, k: k, p: p });
    });
    return (IDX[slug] = { list: out, skip: skip });
  }
  W.photoFor = function (it, food, country, city) {
    var slug = want("photos", citySlug(country, city), city),
      c = PHOTOS[slug] || BYCITY[W.norm(city)];
    if (!c) return null;
    var p = c[W.norm(it.n)];
    if (p && p.url) return p;
    /* the real place behind an outing (its checked record) has its own photo */
    if (it.place) {
      p = c[W.norm(it.place)];
      if (p && p.url && !p.near) return p;
    }
    /* a place to eat shows only a photo of that restaurant, found by its full name */
    if (food || !it.n) return null;
    /* a sight named a little differently ("Colosseum & Roman Forum", "Sunset at Park Guell"): a stored sight whose
       identifying words are all in this name; the most specific one wins */
    var I = index(slug + "|" + W.norm(city), c, country, city),
      have = {};
    /** @type {{ ws: string[]; k: string; p: Photo } | null} */ var best = null;
    idWords(it.n, I.skip).forEach(function (w) {
      have[w] = 1;
    });
    for (var bi = 0; bi < I.list.length; bi++) {
      var e = I.list[bi];
      if (
        e.ws.every(function (w) {
          return have[w];
        }) &&
        (!best || e.ws.length > best.ws.length || (e.ws.length === best.ws.length && e.k.length < best.k.length))
      )
        best = e;
    }
    return best ? best.p : null;
  };
  /* ---------- which photos are known: the trip's towns only, kept on the phone (v182) ----------
     The photo index is one document per town (photos/<country-city>, and the official links likewise, links/...).
     Until v182 every page load downloaded all of them (about 150 towns, 1.6 MB) before any card could have its photo,
     a few seconds on a phone's signal. Now a town's document is asked for the first time a photo of that town is
     looked up (want), once per visit, and the last towns used are kept on the phone (KEEP), so on a reload the
     photos are there with the first screen and the asking only refreshes them. The pictures themselves are kept on
     the phone by the installable app's service worker. */
  var KEEP = "waypoint-photo-index-v1",
    KEEP_MAX = 16,
    /** @type {Record<string, number>} */ asked = {},
    /** @type {Record<string, string>} */ CITY = {},
    kept = {
      photos: /** @type {Record<string, any>} */ ({}),
      links: /** @type {Record<string, any>} */ ({}),
      order: /** @type {string[]} */ ([])
    };
  /* "Rome" alone finds Italy's Rome when only one loaded town has that name ("USA" and "United States" both find it) */
  function byCity() {
    BYCITY = {};
    var seen = {};
    Object.keys(PHOTOS).forEach(function (slug) {
      var cn = CITY[slug] ? W.norm(CITY[slug]) : "";
      if (!cn) return;
      seen[cn] = (seen[cn] || 0) + 1;
      BYCITY[cn] = seen[cn] > 1 ? null : PHOTOS[slug];
    });
  }
  try {
    var k0 = JSON.parse(localStorage.getItem(KEEP) || "null");
    if (k0 && k0.photos && k0.order) {
      kept = k0;
      Object.keys(kept.photos).forEach(function (slug) {
        var d = kept.photos[slug] || {};
        PHOTOS[slug] = d.items || {};
        if (d.city) CITY[slug] = d.city;
      });
      Object.keys(kept.links || {}).forEach(function (slug) {
        LINKS[slug] = kept.links[slug] || {};
      });
      kept.links = kept.links || {};
      byCity();
    }
  } catch (e) {
    /* (no copy on the phone, or one it can't read: the photos come from the database as before) */
  }
  var keepT = 0;
  function keep(coll, slug, v) {
    kept[coll][slug] = v;
    kept.order = kept.order
      .filter(function (x) {
        return x !== slug;
      })
      .concat([slug]);
    while (kept.order.length > KEEP_MAX) {
      var old = kept.order.shift() || "";
      delete kept.photos[old];
      delete kept.links[old];
    }
    clearTimeout(keepT);
    keepT = setTimeout(function () {
      try {
        localStorage.setItem(KEEP, JSON.stringify(kept));
      } catch (e) {
        /* (the phone's storage full or blocked: the index is simply asked for again next visit) */
      }
    }, 400);
  }
  var redrawT = 0;
  function arrived() {
    if (redrawT) return;
    redrawT = setTimeout(function () {
      redrawT = 0;
      W.redraw(); /* (photos change how a day looks, never the plan) */
    }, 60);
  }
  /** a town's index, asked for the first time it is wanted in this visit (again a minute after a failure)
      @param {"photos" | "links"} coll @param {string} slug @param {string} [city] @returns {string} the slug */
  function want(coll, slug, city) {
    var key = coll + "/" + slug;
    if (!DB || (asked[key] && (asked[key] > 0 || Date.now() + asked[key] < 60000))) {
      if (!DB && !(key in pendingAsk)) pendingAsk[key] = 1;
      return slug;
    }
    asked[key] = 1;
    /* (watched, not read once: a town's photos found by the nightly run while the app is open still come in, as when
       the whole list was watched; a town with no index yet gets one the same way) */
    var first = true;
    try {
      DB.doc(key).onSnapshot(
        function (/** @type {any} */ snap) {
          var x = snap && snap.exists ? snap.data() || {} : null;
          if (coll === "links") {
            if (x) {
              LINKS[slug] = W.V.shared(x.items) || {};
              keep("links", slug, LINKS[slug]);
            }
          } else if (x) {
            PHOTOS[slug] = x.items || {};
            if (x.city) CITY[slug] = x.city;
            IDX = {};
            byCity();
            keep("photos", slug, { items: PHOTOS[slug], city: x.city || "" });
          } else if (city && first) everyTown(city);
          first = false;
          if (x) arrived();
        },
        function () {
          asked[key] = -Date.now(); /* (no signal, or refused: asked again a minute later at the earliest) */
        }
      );
    } catch (e) {
      asked[key] = -Date.now(); /* (a database without watching: asked again a minute later at the earliest) */
    }
    return slug;
  }
  /** @type {Record<string, number>} */ var pendingAsk = {};
  /* No index under this town's name with this country ("USA" for "United States"): the whole list, once a visit, to
     find the town by its name alone (only then; a trip whose countries match never downloads it). The town found is
     kept on the phone under its own name, so the next visit has it at once. */
  var allAsked = false;
  function everyTown(/** @type {string} */ city) {
    if (allAsked || !DB) return;
    allAsked = true;
    DB.collection("photos")
      .get()
      .then(
        function (/** @type {any} */ snap) {
          (snap.docs || []).forEach(function (/** @type {any} */ d) {
            var x = d.data() || {};
            if (PHOTOS[d.id]) return;
            PHOTOS[d.id] = x.items || {};
            if (x.city) CITY[d.id] = x.city;
            if (x.city && W.norm(x.city) === W.norm(city)) keep("photos", d.id, { items: PHOTOS[d.id], city: x.city });
          });
          IDX = {};
          byCity();
          arrived();
        },
        function () {
          allAsked = false;
        }
      );
  }
  /* the index as saved with the trip for offline use (lib/offline.js): what the database hasn't answered yet */
  W.photosSnapshot = function () {
    return { PHOTOS: PHOTOS, BYCITY: BYCITY, LINKS: LINKS };
  };
  W.photosSeed = function (v) {
    if (!v) return;
    Object.keys(v.PHOTOS || {}).forEach(function (slug) {
      if (!PHOTOS[slug]) PHOTOS[slug] = v.PHOTOS[slug];
    });
    Object.keys(v.LINKS || {}).forEach(function (slug) {
      if (!LINKS[slug]) LINKS[slug] = v.LINKS[slug];
    });
    Object.keys(v.BYCITY || {}).forEach(function (cn) {
      if (!(cn in BYCITY)) BYCITY[cn] = v.BYCITY[cn];
    });
    IDX = {};
    arrived();
  };
  try {
    if (window.claude && window.claude.use)
      window.claude.use("db").then(
        function (db) {
          if (!db) return;
          DB = db;
          /* what was looked up before the database was there */
          Object.keys(pendingAsk).forEach(function (key) {
            var i = key.indexOf("/");
            want(/** @type {"photos" | "links"} */ (key.slice(0, i)), key.slice(i + 1));
          });
          pendingAsk = {};
        },
        function () {}
      );
  } catch (e) {}

  /* ---------- a city's own picture (the big photo at the top of a day and of each place in All days) ---------- */
  /* the city itself when there's a photo of it, else the first of these places (the day's stops, in order) with a photo
     of its own, else the city's best-known sight with one; never a "nearby" stand-in. A photo that has a large copy
     (it fills a wide screen sharply) wins over one that doesn't */
  W.cityPhoto = function (country, city, prefer) {
    if (W.simple && W.simple()) return null;
    var c = PHOTOS[want("photos", citySlug(country, city), city)] || BYCITY[W.norm(city)];
    if (!c) return null;
    var found = [],
      own = c[W.norm(city)];
    if (own && own.url && !own.near) found.push(own);
    var list = (prefer || []).concat(((W.pool(country, city) || {}).spots || []).slice(0, 15));
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || !it.n) continue;
      var p = W.photoFor(it, false, country, city);
      if (p && p.url && !p.near && found.indexOf(p) < 0) found.push(p);
    }
    if (!found.length) return null;
    if (canWide(found[0])) return found[0];
    for (var j = 1; j < found.length; j++) if (canWide(found[j])) return found[j];
    return found[0];
  };
  /* the same picture, large. Inside Claude the app may only show its own files, so a large copy is one the nightly
     helper stored ("big"); on its own site the app asks Wikimedia Commons for the size the screen needs */
  function commonsFile(ph) {
    var m =
      /^https:\/\/commons\.wikimedia\.org\/wiki\/(?:File:|Special:FilePath\/)([^?#]+)/.exec(ph.page || "") ||
      /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)/.exec(ph.url || "");
    return m ? m[1] : "";
  }
  function canWide(ph) {
    return !!(ph.big || (W.standalone && commonsFile(ph)));
  }
  /* ---------- a photo's copies ---------- */
  /* A photo record (the nightly photo tools) can have: url (720 px JPEG), sm (320 px JPEG, for thumbnails), big (1920 px,
     for headers), their WebP twins in webp {sm, url, big}, w and smw (the 720 and 320 copies' widths when they are not
     those) and lq (a 16 px blurred preview, base64 of a WebP). The browser picks among them (srcset, sizes) by how wide
     the picture is drawn and how sharp the screen is; a photo without the newer copies simply uses the ones it has. */
  var THUMB_SIZES = "(max-width:560px) 72px, 96px"; /* a stop's thumbnail (app.css .thumb) */
  var CARD_SIZES = "(max-width:560px) 100vw, 480px"; /* a card's picture: never claims to be small, so never softer than before */
  /* the pictures that have loaded this session: drawn again without their preview and fade (a redraw puts the page's
     attributes back to what the HTML says, so "loaded" has to be in the HTML, not added to the page afterwards) */
  /** @type {Record<string, 1>} */ var SEEN = {};
  document.addEventListener(
    "load",
    function (/** @type {any} */ e) {
      var t = e.target;
      if (!t || t.tagName !== "IMG" || !t.classList.contains("lqi")) return;
      SEEN[t.getAttribute("data-pk") || ""] = 1;
      t.classList.add("ld");
    },
    true
  );
  /** a width in a Commons address (".../Special:FilePath/X?width=960"), else the given one @param {string} u @param {number} dflt */
  function widthOf(u, dflt) {
    var m = /[?&]width=(\d+)$/.exec(u);
    return m ? +m[1] : dflt;
  }
  /** "<url> <width>w, ..." from the copies that exist @param {[string | undefined, number][]} list */
  function setOf(list) {
    return list
      .filter(function (x) {
        return !!x[0];
      })
      .map(function (x) {
        return esc(x[0] || "") + " " + x[1] + "w";
      })
      .join(", ");
  }
  /** the blurred preview behind a picture that has not loaded yet (nothing once it has) @param {Photo} ph @param {string} cls */
  function previewOf(ph, cls) {
    if (!ph.lq || SEEN[ph.url]) return "";
    var d = ph.lq.indexOf("data:") === 0 ? ph.lq : "data:image/webp;base64," + ph.lq;
    return '<span class="lq' + cls + '" style="background-image:url(' + esc(d) + ')"></span>';
  }
  /* the image itself, in WebP where the browser has it, with a JPEG to fall back on. @param {Photo} ph
     @param {{ cls: string; alt: string; sizes: string; lazy: boolean }} o */
  function imgOf(ph, o) {
    var off = (W.offline && W.offline.off) || window.__WP_OFFLINE,
      src = W.offline ? W.offline.src(ph.url) : ph.url,
      wb = ph.webp || {},
      jpg = "",
      webp = "";
    /* saved for offline (a photo from the phone's own storage, one file): as before */
    if (!off && src === ph.url) {
      var smU = ph.sm,
        smW = ph.smw || 320;
      /* on its own site the stored address is a Commons one: a small copy is the same file at a standard small width */
      if (!smU && W.standalone && /Special:FilePath\/[^?]+\?width=\d+$/.test(ph.url) && widthOf(ph.url, 0) > 400) {
        smU = ph.url.replace(/width=\d+$/, "width=330");
        smW = 330;
      }
      var normW = ph.w || widthOf(ph.url, 720);
      if (smU)
        jpg = setOf([
          [smU, smW],
          [ph.url, normW]
        ]);
      /* the WebP set must offer every size the JPEG one does (else a browser with WebP would get a bigger or softer one) */
      if (wb.url && (!smU || (ph.sm && wb.sm)))
        webp = setOf([
          [ph.sm && wb.sm, smW],
          [wb.url, normW]
        ]);
    }
    var attrs = ' class="' + o.cls + (ph.lq && !SEEN[ph.url] ? " lqi" : "") + '" data-pk="' + esc(ph.url) + '"';
    var tag =
      "<img" +
      attrs +
      ' src="' +
      esc(src) +
      '"' +
      (jpg ? ' srcset="' + jpg + '" sizes="' + o.sizes + '"' : "") +
      ' alt="' +
      esc(o.alt) +
      '" decoding="async"' +
      (o.lazy ? ' loading="lazy"' : "") +
      ">";
    return webp ? '<picture><source type="image/webp" srcset="' + webp + '" sizes="' + o.sizes + '">' + tag + "</picture>" : tag;
  }

  /* the photo filling a header, with the photographer's credit as plain text in its corner. Every photo fills its band
     (a small one too: v152 took away the side placement with a purple fade) */
  /* a phone gets the small picture (its header is narrow; the large copy is half a megabyte), a wide screen the large
     one: "sizes" tells the browser how wide the header is drawn. Headers further down a long page (All days) load as
     they come near (lazy); the day's own header is the largest thing on the first screen, so it is fetched first, ahead
     of the stops' photos and the second script (fetchpriority) */
  var HERO_SIZES = "(max-width:760px) 60vw, 1180px";
  /* a phone (the narrow layout, not the desktop workspace): the Day tab's photo goes behind the top card (v174) */
  /** the day's photo: its town's, picked with the day's own places in mind (the Trip and Today screens) @param {Day} day */
  W.dayPhoto = function (day) {
    return W.cityPhoto
      ? W.cityPhoto(
          day.country,
          day.city,
          (day.slots || [])
            .filter(function (x) {
              return x.item && !W.isFood(x.slot);
            })
            .map(function (x) {
              return /** @type {Spot | Food} */ (x.item);
            })
        )
      : null;
  };
  W.phoneTop = function () {
    return !(W.desk && W.desk()) && !!window.matchMedia && window.matchMedia("(max-width:560px)").matches;
  };
  /** the day's photo behind the phone's top card, and its credit (null: none). The card is drawn by the page and kept,
      so the photo is a property on it (app.css draws it with a shade for the words) and the credit an attribute.
      @param {Photo | null} ph */
  W.topPhoto = function (ph) {
    var top = document.querySelector("header.top");
    if (!top) return;
    var url = "";
    if (ph && !(W.simple && W.simple())) {
      var off = (W.offline && W.offline.off) || window.__WP_OFFLINE,
        src = W.offline ? W.offline.src(ph.url) : ph.url,
        wb = ph.webp || {};
      /* (the normal size is plenty for a card; WebP where there is a copy, as everywhere) */
      url = !off && src === ph.url && wb.url ? wb.url : src;
    }
    if ((top.getAttribute("data-photo") || "") === url) return;
    top.setAttribute("data-photo", url);
    top.style.setProperty("--top-photo", url ? 'url("' + url.replace(/["\\]/g, "") + '")' : "none");
    top.setAttribute("data-credit", url && ph ? "Photo: " + (ph.credit || "Wikimedia Commons") : "");
    top.classList.toggle("has-photo", !!url);
    /* the slim bar that takes the card's place when you scroll down keeps the same photo (the owner's ask, v179),
       showing the strip the card's bottom edge showed, so the photo carries on as the card scrolls under it (v180:
       the top of the photo there was jarring; lib/ahead.js W.pinPhotoFit places it) */
    var root = document.documentElement;
    root.style.setProperty("--top-photo", url ? 'url("' + url.replace(/["\\]/g, "") + '")' : "none");
    root.classList.toggle("top-photo", !!url);
    if (W.pinPhotoFit) W.pinPhotoFit();
  };

  W.heroImg = function (ph, alt, lazy) {
    var off = (W.offline && W.offline.off) || window.__WP_OFFLINE,
      file = !off && !ph.big && W.standalone ? commonsFile(ph) : "",
      small = W.offline ? W.offline.src(ph.url) : ph.url,
      src = small,
      set = "",
      webp = "",
      wb = ph.webp || {};
    if (file) {
      var at = function (/** @type {number} */ w) {
        return "https://commons.wikimedia.org/wiki/Special:FilePath/" + file + "?width=" + w;
      };
      src = at(960);
      set = ' srcset="' + esc(at(960)) + " 960w, " + esc(at(1280)) + " 1280w, " + esc(at(1920)) + ' 1920w" sizes="' + HERO_SIZES + '"';
    } else if (!off && ph.big) {
      set = ' srcset="' + esc(small) + " 720w, " + esc(ph.big) + ' 1920w" sizes="' + HERO_SIZES + '"';
      /* (WebP only when it has the large size too: else a wide screen would get the small one) */
      if (wb.url && wb.big && small === ph.url) webp = esc(wb.url) + " 720w, " + esc(wb.big) + " 1920w";
    } else if (!off && wb.url && small === ph.url) webp = esc(wb.url);
    var tag =
      '<img class="hero-img' +
      (ph.lq && !SEEN[ph.url] ? " lqi" : "") +
      '" data-pk="' +
      esc(ph.url) +
      '" src="' +
      esc(src) +
      '"' +
      set +
      ' alt="' +
      esc(alt) +
      '" decoding="async"' +
      (lazy ? ' loading="lazy"' : ' fetchpriority="high"') +
      ">";
    return (
      previewOf(ph, " hero-lq") +
      (webp
        ? '<picture><source type="image/webp" srcset="' +
          webp +
          '"' +
          (webp.indexOf(" ") > 0 ? ' sizes="' + HERO_SIZES + '"' : "") +
          ">" +
          tag +
          "</picture>"
        : tag) +
      '<span class="hero-credit">Photo: ' +
      esc(ph.credit || "Wikimedia Commons") +
      "</span>"
    );
  };

  /* ---------- the picture element ---------- */
  W.picture = function (it, food, country, city, opts) {
    opts = opts || {};
    if (W.simple && W.simple()) return ""; /* Simple view: no photos */
    var ph = W.photoFor(it, food, country, city);
    /* a place to eat shows a public picture of the restaurant itself or nothing at all (not a photo of the street outside) */
    if (ph && food && ph.near) ph = null;
    /* no photo yet: nothing at all. A drawing in its place looked worse than the plain row */
    if (!ph) return "";
    /* when the place itself has no photo, a photo of what's nearby says so ("Nearby: Piazza IX Aprile") */
    var near = ph.near ? (typeof ph.near === "string" ? "Nearby: " + ph.near : "Taken nearby") : "";
    return (
      previewOf(ph, "") +
      imgOf(ph, {
        cls: "pic photo",
        alt: !ph.near ? it.n : typeof ph.near === "string" ? ph.near + ", near " + it.n : "Taken near " + it.n,
        sizes: opts.size === "thumb" ? THUMB_SIZES : CARD_SIZES,
        lazy: true
      }) +
      /* the photographer's name stays (the photos' licences ask for it), but as plain text: a tap on the photo never leaves the app */
      (opts.credit
        ? '<span class="credit">' + (near ? esc(near) + " · " : "") + "Photo: " + esc(ph.credit || "Wikimedia Commons") + "</span>"
        : "")
    );
  };
})();
