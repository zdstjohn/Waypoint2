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
    var c = LINKS[W.slug(country + " " + city)],
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
  function citySlug(country, city) {
    return W.slug(country + " " + city);
  }

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
    var slug = citySlug(country, city),
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
  /* the index as saved on the phone (lib/offline.js): used before the database answers, and instead of it offline */
  var fromDb = false;
  W.photosSnapshot = function () {
    return { PHOTOS: PHOTOS, BYCITY: BYCITY, LINKS: LINKS };
  };
  W.photosSeed = function (v) {
    if (fromDb || !v) return;
    PHOTOS = v.PHOTOS || {};
    BYCITY = v.BYCITY || {};
    LINKS = v.LINKS || {};
    IDX = {};
    W.redraw(); /* (photos change how a day looks, never the plan) */
  };
  try {
    if (window.claude && window.claude.use)
      window.claude.use("db").then(
        function (db) {
          if (!db) return;
          DB = db;
          db.collection("links").onSnapshot(
            function (snap) {
              fromDb = true;
              LINKS = {};
              snap.docs.forEach(function (d) {
                LINKS[d.id] = W.V.shared((d.data() || {}).items) || {};
              });
              W.redraw(); /* (photos change how a day looks, never the plan) */
            },
            function () {}
          );
          db.collection("photos").onSnapshot(
            function (snap) {
              fromDb = true;
              PHOTOS = {};
              BYCITY = {};
              IDX = {};
              var seen = {};
              snap.docs.forEach(function (d) {
                var x = d.data() || {};
                PHOTOS[d.id] = x.items || {};
                /* also by the city's name alone, so "USA" and "United States" find the same photos (only when no other country has that city) */
                if (x.city) {
                  var cn = W.norm(x.city);
                  seen[cn] = (seen[cn] || 0) + 1;
                  BYCITY[cn] = seen[cn] > 1 ? null : PHOTOS[d.id];
                }
              });
              W.redraw(); /* (photos change how a day looks, never the plan) */
            },
            function () {}
          );
          flushWanted();
        },
        function () {}
      );
  } catch (e) {}

  /* tell the photo finder which places this trip uses (one write per city, only when the list changes) */
  var written = {},
    pending = {},
    /** @type {Record<string, string>} */ refused = {}; /* refused while the app is open: not asked again on every redraw */
  try {
    written = JSON.parse(localStorage.getItem("waypoint-wanted-v1") || "null") || {};
  } catch (e) {}
  W.wantPhotos = function (country, city, pool, P) {
    /* (a shared trip is someone else's to describe; the installable app has no nightly helper reading these) */
    if (!pool || pool.fallback || W.readOnly || W.standalone) return;
    /* the places this trip has on its days come first (with the day's date), then the best of the rest, up to the city's
       cap: the nightly checks and the photo finder work down these lists, the soonest trip first ("when") */
    var used = {},
      first = "";
    ((P && P.days) || []).forEach(function (d) {
      if (d.country !== country || d.city !== city) return;
      var dt = W.dateOf ? W.dateOf(d.n) : null,
        iso = dt ? W.isoDay(dt) : "";
      if (iso && (!first || iso < first)) first = iso;
      (d.slots || []).forEach(function (x) {
        if (x.item && x.item.n && !(x.item.n in used)) used[x.item.n] = iso;
      });
    });
    function pick(list, cap) {
      var a = list.filter(function (x) {
          return x.n in used;
        }),
        b = list.filter(function (x) {
          return !(x.n in used);
        });
      return a.concat(b).slice(0, Math.max(cap, a.length));
    }
    var spotsL = pick(pool.spots || [], W.IDEA_CAP.spots),
      foodL = pick(pool.food || [], W.IDEA_CAP.food + 30); /* (the nightly places to eat come on top of the cap) */
    /* one entry per place, in the same order as the names (null where a place has no pin), so the nightly tools can pair them */
    var pts = spotsL.concat(foodL).map(function (x) {
      var la = x.lat,
        ln = x.lng;
      return la != null && ln != null ? [Math.round(la * 1e4) / 1e4, Math.round(ln * 1e4) / 1e4] : null;
    });
    var info = (pool.spots || [])
      .filter(function (x) {
        return W.isPaid(x) || W.needsBooking(x);
      })
      .map(function (x) {
        return { n: x.n, ticket: x.ticket || "", book: x.book || "", lat: x.lat, lng: x.lng };
      });
    var stays = (pool.stay || []).filter(function (x) {
      return x && x.n && x.lat != null;
    });
    var body = {
      country: country,
      city: city,
      spots: spotsL.map(function (x) {
        return x.n;
      }),
      food: foodL.map(function (x) {
        return x.n;
      }),
      pts: pts,
      /* each place to eat's menu page, when its list gave one (the nightly task reads the menu from it), in the same order */
      menus: foodL.map(function (x) {
        return x.menu || "";
      }),
      /* Everyone who can open the app can read this list, so it says nothing about any family: which places are on a
         trip (by name only), and the month of the first day there (the nightly checks do the soonest trips first),
         never the dates, the day of each place, where you stay or a hotel you typed. */
      when: first ? first.slice(0, 7) + "-01" : null,
      used: Object.keys(used).map(function (n) {
        return [n];
      }),
      paid: info,
      home: null,
      center: pool.lat != null ? [pool.lat, pool.lng] : null,
      /* where-to-stay areas and the stay you chose by name (not a Booking.com pick, whose pin is real): their pins are checked too */
      stays: stays.map(function (x) {
        return x.n;
      }),
      stayPts: stays.map(function (x) {
        return [Math.round((x.lat || 0) * 1e4) / 1e4, Math.round((x.lng || 0) * 1e4) / 1e4];
      }),
      homeLabel: null
    };
    /* (v7: the first list without the stay and the dates; every city a trip uses is written again without them) */
    var sig =
      "v7/" +
      foodL.length +
      "/" +
      (first || "") +
      "/" +
      body.used.length +
      "/" +
      (body.used.length ? body.used[body.used.length - 1][0] : "") +
      "/" +
      body.stays.length +
      "/" +
      info.filter(function (x) {
        return x.book;
      }).length +
      "/" +
      body.spots.length +
      "/" +
      body.food.length +
      "/" +
      (body.spots[body.spots.length - 1] || "") +
      "/" +
      (body.food[body.food.length - 1] || "");
    var id = citySlug(country, city);
    if (written[id] === sig || refused[id] === sig || (pending[id] && pending[id].sig === sig)) return;
    pending[id] = { sig: sig, body: body };
    flushWanted();
  };
  var flushing = false;
  function flushWanted() {
    if (!DB || flushing) return;
    var id = Object.keys(pending)[0];
    if (!id) return;
    var job = pending[id];
    flushing = true;
    DB.doc("wanted/" + id)
      .set(job.body)
      .then(
        function () {
          written[id] = job.sig;
          try {
            localStorage.setItem("waypoint-wanted-v1", JSON.stringify(written));
          } catch (e) {}
        },
        function (e) {
          refused[id] = job.sig;
          W.caught(e, "the photo finder's list for " + id);
        }
      )
      .then(function () {
        if (pending[id] === job) delete pending[id];
        flushing = false;
        flushWanted();
      });
  }

  /* ---------- a city's own picture (the big photo at the top of a day and of each place in All days) ---------- */
  /* the city itself when there's a photo of it, else the first of these places (the day's stops, in order) with a photo
     of its own, else the city's best-known sight with one; never a "nearby" stand-in. A photo that has a large copy
     (it fills a wide screen sharply) wins over one that doesn't */
  W.cityPhoto = function (country, city, prefer) {
    if (W.simple && W.simple()) return null;
    var c = PHOTOS[citySlug(country, city)] || BYCITY[W.norm(city)];
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
