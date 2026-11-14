/* Waypoint photo packs (v198): a city's photos in one file. A photo is three to five files in the app's store (a JPEG,
   its WebP twin, small copies), which is what fills it; a pack holds one copy of each of a city's photos, so saving a
   city for offline is one request, not sixty. What a pack is:
     "WPPK1\n" · the index's length (4 bytes, little-endian) · the index (JSON) · the pictures, one after another
   The index: { v: 1, slug, at, items: [[name, type, bytes], ...] }. A picture's name is the address its photo record
   has (photos/<city>.items[..].url), which is also what the phone's offline store files a photo under, so a picture
   out of a pack and one fetched on its own are the same thing afterwards. Made by tools/photopack.js; a city's pack is
   named in its photo index (photos/<city>.pack = { url, n, bytes, at }, which lib/photos.js keeps with the index). */
(function () {
  "use strict";
  var W = window.W;
  var MAGIC = "WPPK1\n",
    MAX_INDEX = 262144 /* (an index is about 60 bytes a photo: a quarter megabyte is far past any city) */,
    TYPES = /** @type {Record<string, 1>} */ ({ "image/webp": 1, "image/jpeg": 1 });

  /** what a pack holds: each picture's name, kind and place in the file. Null when it is not a pack this app can
      read: cut short, an index that runs past the file's end, or anything in it that is not a picture.
      @param {ArrayBuffer} buf @returns {{ slug: string; at: string; items: { url: string; type: string; start: number; end: number }[] } | null} */
  function read(buf) {
    if (!buf || buf.byteLength < MAGIC.length + 4) return null;
    var u8 = new Uint8Array(buf),
      i;
    for (i = 0; i < MAGIC.length; i++) if (u8[i] !== MAGIC.charCodeAt(i)) return null;
    var L = new DataView(buf).getUint32(MAGIC.length, true),
      at = MAGIC.length + 4;
    if (!L || L > MAX_INDEX || at + L > buf.byteLength) return null;
    var idx;
    try {
      idx = JSON.parse(new TextDecoder().decode(u8.subarray(at, at + L)));
    } catch (e) {
      return null;
    }
    if (!idx || idx.v !== 1 || !Array.isArray(idx.items)) return null;
    var pos = at + L,
      out = [],
      seen = /** @type {Record<string, 1>} */ ({});
    for (i = 0; i < idx.items.length; i++) {
      var it = idx.items[i];
      if (!Array.isArray(it) || typeof it[0] !== "string" || !it[0] || seen[it[0]] || !TYPES[it[1]]) return null;
      if (typeof it[2] !== "number" || !(it[2] > 0) || it[2] % 1 || pos + it[2] > buf.byteLength) return null;
      seen[it[0]] = 1;
      out.push({ url: it[0], type: it[1], start: pos, end: pos + it[2] });
      pos += it[2];
    }
    return { slug: String(idx.slug || ""), at: String(idx.at || ""), items: out };
  }

  /* a pack is fetched once however many ask for it at the same moment (a trip with two days in one city) */
  var going = /** @type {Record<string, Promise<{ url: string; blob: Blob }[]>>} */ ({});
  /** a pack's pictures, each as the file it would have been on its own. Rejects when the pack cannot be had or read:
      whoever asked then fetches the photos one by one, as before. @param {string} url */
  function get(url) {
    if (going[url]) return going[url];
    var p = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("photo pack: " + r.status);
        return r.arrayBuffer();
      })
      .then(function (buf) {
        var pk = read(buf);
        if (!pk) throw new Error("photo pack: not a pack");
        return pk.items.map(function (it) {
          return { url: it.url, blob: new Blob([buf.slice(it.start, it.end)], { type: it.type }) };
        });
      });
    going[url] = p;
    var done = function () {
      delete going[url];
    };
    p.then(done, done);
    return p;
  }

  /* ---------- which pack a picture is in ---------- */
  var PACK_URL = /^(\/_blob\/[0-9a-f]{32}|https:\/\/[^\s"'<>]+)$/,
    FILL_MIN = 4; /* (a pack is fetched for four photos or more: for fewer, they are fetched on their own) */
  /** the packs of the cities whose photo index is here, each with its photos' names (2: one with no file of its own)
      @returns {Record<string, { url: string; names: Record<string, number> }>} */
  function packs() {
    var snap = W.photosSnapshot ? W.photosSnapshot() : null,
      out = /** @type {Record<string, { url: string; names: Record<string, number> }>} */ ({});
    if (!snap || !snap.PACK) return out;
    Object.keys(snap.PACK).forEach(function (slug) {
      var pk = snap.PACK[slug];
      if (!pk || typeof pk.url !== "string" || !PACK_URL.test(pk.url)) return;
      var names = /** @type {Record<string, number>} */ ({}),
        items = snap.PHOTOS[slug] || {};
      Object.keys(items).forEach(function (k) {
        var p = items[k];
        if (p && p.url && !p.near) names[p.url] = p.pk ? 2 : 1;
      });
      out[slug] = { url: pk.url, names: names };
    });
    return out;
  }
  /** pictures into the phone's store (lib/offline.js keeps a photo there under its address)
      @param {{ url: string; blob: Blob }[]} items */
  function put(items) {
    if (!items.length) return Promise.resolve();
    return W.offline.tx("blobs", "readwrite", function (/** @type {any} */ s) {
      var at = Date.now();
      items.forEach(function (it) {
        s.put({ url: it.url, blob: it.blob, at: at });
      });
    });
  }
  /** Saving a trip for offline (lib/offline.js O.save): of the photos still to fetch, those a city's pack holds come
      from it in one request. Answers with the addresses now on the phone; never fails (what a pack could not give is
      fetched the old way). @param {string[]} todo @returns {Promise<string[]>} */
  function fill(todo) {
    var left = /** @type {Record<string, 1>} */ ({}),
      P = packs(),
      jobs = /** @type {Promise<string[]>[]} */ ([]);
    todo.forEach(function (u) {
      left[u] = 1;
    });
    Object.keys(P).forEach(function (slug) {
      var names = P[slug].names,
        n = 0,
        must = false;
      Object.keys(names).forEach(function (u) {
        if (!left[u]) return;
        n++;
        if (names[u] === 2) must = true;
      });
      if (n < FILL_MIN && !must) return;
      jobs.push(
        get(P[slug].url)
          .then(function (items) {
            var mine = items.filter(function (it) {
              return left[it.url];
            });
            return put(mine).then(function () {
              return mine.map(function (it) {
                return it.url;
              });
            });
          })
          .then(null, function () {
            return /** @type {string[]} */ ([]);
          })
      );
    });
    return Promise.all(jobs).then(function (lists) {
      return /** @type {string[]} */ ([]).concat.apply([], lists);
    });
  }

  /* ---------- a picture with no file of its own, wanted on the page ---------- */
  /* lib/offline.js O.src asks for it by name. From the phone when it is there (a city seen before, or saved); else its
     city's pack is fetched once and all of it kept, so the rest of that city's pictures are there at once, with no
     signal too. Asked once a visit per picture, and again when the signal comes back. */
  var wanted = /** @type {Record<string, 1>} */ ({}),
    tried = /** @type {Record<string, 1>} */ ({}),
    wantT = 0;
  function want(/** @type {string} */ u) {
    if (wanted[u] || tried[u]) return;
    wanted[u] = 1;
    if (!wantT) wantT = window.setTimeout(serve, 30);
  }
  function serve() {
    wantT = 0;
    var list = Object.keys(wanted);
    wanted = {};
    list.forEach(function (u) {
      tried[u] = 1;
    });
    W.offline
      .tx("blobs", "readonly", function (/** @type {any} */ s) {
        var got = /** @type {Record<string, Blob>} */ ({});
        list.forEach(function (u) {
          var r = s.get(u);
          r.onsuccess = function () {
            if (r.result && r.result.blob) got[u] = r.result.blob;
          };
        });
        return { result: got };
      })
      .then(null, function () {
        return /** @type {Record<string, Blob>} */ ({});
      })
      .then(function (/** @type {Record<string, Blob>} */ got) {
        var missing = /** @type {Record<string, 1>} */ ({}),
          any = false,
          none = true;
        list.forEach(function (u) {
          if (got[u]) {
            W.offline.take(u, got[u]);
            any = true;
          } else {
            missing[u] = 1;
            none = false;
          }
        });
        if (any) W.redraw();
        if (none) return;
        var P = packs();
        Object.keys(P).forEach(function (slug) {
          var names = P[slug].names;
          if (
            !Object.keys(missing).some(function (u) {
              return !!names[u];
            })
          )
            return;
          get(P[slug].url).then(
            function (items) {
              var hit = false;
              items.forEach(function (it) {
                if (!missing[it.url]) return;
                W.offline.take(it.url, it.blob);
                hit = true;
              });
              put(items).then(null, function () {
                /* the phone's storage full or blocked: the pictures still show this visit */
              });
              if (hit) W.redraw();
            },
            function () {
              /* no signal, or the pack is gone: the blurred preview stands */
            }
          );
        });
      });
  }
  window.addEventListener("online", function () {
    tried = {};
  });

  /* ---------- a library city, saved before any trip goes there (v198) ---------- */
  /* Settings, World library: "Save for offline" keeps a city on this phone: its checked record (lib/world.js), its
     photo index and photos (the pack, where it has one) and its street map. A trip made there later, with no signal,
     has its lists, its photos and its map. Which cities are saved is kept in CITIES; lib/world.js leaves their records
     alone when it tidies. */
  var CITIES = "waypoint-offline-cities-v1";
  /** @returns {Record<string, { name: string; country: string; at: number; photos: number; of: number; map: boolean }>} */
  function cities() {
    try {
      return JSON.parse(localStorage.getItem(CITIES) || "{}") || {};
    } catch (e) {
      /* storage blocked: no city is saved */
      return {};
    }
  }
  function setCities(/** @type {any} */ v) {
    try {
      localStorage.setItem(CITIES, JSON.stringify(v));
    } catch (e) {
      /* storage full or blocked: the save is not remembered, and can be done again */
    }
  }
  /** how a save is going, per city: { st: "saving" | "err", n, of, msg } (Settings draws it) */
  var going2 = /** @type {Record<string, { st: string; n: number; of: number; msg: string }>} */ ({});
  function kv(/** @type {string} */ k, /** @type {any} */ v) {
    return W.offline.tx("kv", "readwrite", function (/** @type {any} */ s) {
      if (v === null) s.delete(k);
      else s.put({ k: k, v: v, at: Date.now() });
    });
  }
  /** a city's own photos, by address, from its index */
  function ownPhotos(/** @type {any} */ items) {
    var out = /** @type {{ url: string; pk: boolean }[]} */ ([]),
      seen = /** @type {Record<string, 1>} */ ({});
    Object.keys(items || {}).forEach(function (k) {
      var p = items[k];
      if (!p || !p.url || p.near || seen[p.url]) return;
      seen[p.url] = 1;
      out.push({ url: p.url, pk: !!p.pk });
    });
    return out;
  }
  /** @param {string} country @param {string} city @param {() => void} [tick] called as it goes */
  function saveCity(country, city, tick) {
    var slug = W.citySlug(country, city),
      st = (going2[slug] = { st: "saving", n: 0, of: 0, msg: "" }),
      say = function () {
        if (tick) tick();
      },
      all = cities(),
      rec = /** @type {any} */ (null);
    if (!all[slug]) {
      all[slug] = { name: city, country: country, at: 0, photos: 0, of: 0, map: false };
      setCities(all); /* (named first, so its record is not tidied away while the rest is fetched) */
    }
    say();
    var dbp = window.claude && window.claude.use ? window.claude.use("db") : Promise.resolve(null);
    return W.worldRead(country, city)
      .then(function (/** @type {any} */ r) {
        if (!r) throw new Error("This city isn't in the library yet.");
        rec = r;
        return dbp;
      })
      .then(function (/** @type {any} */ d) {
        return d ? d.doc("photos/" + slug).get() : null;
      })
      .then(function (/** @type {any} */ snap) {
        var x = snap && snap.exists ? snap.data() || {} : {},
          /* (as lib/photos.js takes them: a photo's address is one of the app's own files, not a web link) */
          items = x.items && typeof x.items === "object" ? x.items : {},
          pack = x.pack && typeof x.pack.url === "string" && PACK_URL.test(x.pack.url) ? { url: x.pack.url } : null,
          seed = { PHOTOS: /** @type {any} */ ({}), PACK: /** @type {any} */ ({}), LINKS: {}, BYCITY: {} };
        seed.PHOTOS[slug] = items;
        seed.PACK[slug] = pack;
        W.photosSeed(seed);
        var list = ownPhotos(items),
          have = /** @type {Record<string, 1>} */ ({});
        st.of = list.length;
        say();
        return kv("photos:" + slug, { items: items, pack: pack, city: city })
          .then(null, function () {})
          .then(function () {
            return pack
              ? get(pack.url).then(
                  function (got) {
                    return put(got).then(function () {
                      got.forEach(function (it) {
                        have[it.url] = 1;
                      });
                    });
                  },
                  function () {
                    /* the pack could not be had: its photos one by one, those that have a file */
                  }
                )
              : null;
          })
          .then(function () {
            var todo = list.filter(function (p) {
                return !have[p.url] && !p.pk;
              }),
              i = 0;
            st.n = list.length - todo.length - list.filter(function (p) {
              return p.pk && !have[p.url];
            }).length;
            say();
            function next() {
              if (i >= todo.length) return Promise.resolve();
              var u = todo[i++].url;
              return fetch(u)
                .then(function (r) {
                  if (!r.ok) throw new Error(String(r.status));
                  return r.blob();
                })
                .then(function (b) {
                  return put([{ url: u, blob: b }]);
                })
                .then(
                  function () {
                    st.n++;
                    if (st.n % 6 === 0) say();
                  },
                  function () {
                    /* a photo that can't be fetched is skipped, not fatal (as when a trip is saved) */
                  }
                )
                .then(next);
            }
            return Promise.all([next(), next(), next(), next()]);
          });
      })
      .then(function () {
        var c = rec.center,
          map = W.vtFor && c ? W.vtFor(country, city, c[0], c[1]) : null;
        return map && W.vtWarm
          ? W.vtWarm(map).then(
              function () {
                return true;
              },
              function () {
                return false;
              }
            )
          : false;
      })
      .then(
        function (/** @type {boolean} */ map) {
          var now = cities();
          now[slug] = { name: city, country: country, at: Date.now(), photos: st.n, of: st.of, map: map };
          setCities(now);
          delete going2[slug];
          say();
        },
        function (/** @type {any} */ e) {
          var now = cities();
          if (now[slug] && !now[slug].at) {
            delete now[slug];
            setCities(now);
          }
          st.st = "err";
          st.msg = String((e && e.message) || e);
          say();
        }
      );
  }
  /** take a saved city off this phone: its photos (unless the open trip goes there), its index and its record's hold */
  function dropCity(/** @type {string} */ slug) {
    var all = cities(),
      c = all[slug];
    if (!c) return Promise.resolve();
    delete all[slug];
    setCities(all);
    delete going2[slug];
    var inTrip = ((W.P && W.P.days) || []).some(function (/** @type {any} */ d) {
      return d.country && d.city && W.citySlug(d.country, d.city) === slug;
    });
    var snap = W.photosSnapshot ? W.photosSnapshot() : null,
      list = inTrip ? [] : ownPhotos(snap && snap.PHOTOS[slug]);
    return kv("photos:" + slug, null)
      .then(function () {
        return list.length
          ? W.offline.tx("blobs", "readwrite", function (/** @type {any} */ s) {
              list.forEach(function (p) {
                s.delete(p.url);
              });
            })
          : null;
      })
      .then(null, function () {
        /* the phone's store could not be reached: the city is no longer listed as saved, its files stay until cleared */
      });
  }
  /* a saved city's photo index, back from the phone when the app opens (its photos resolve with no signal) */
  var mine = cities();
  if (Object.keys(mine).length && W.offline && W.offline.tx)
    W.offline
      .tx("kv", "readonly", function (/** @type {any} */ s) {
        var got = /** @type {Record<string, any>} */ ({});
        Object.keys(mine).forEach(function (slug) {
          var r = s.get("photos:" + slug);
          r.onsuccess = function () {
            if (r.result && r.result.v) got[slug] = r.result.v;
          };
        });
        return { result: got };
      })
      .then(
        function (/** @type {Record<string, any>} */ got) {
          var seed = { PHOTOS: /** @type {any} */ ({}), PACK: /** @type {any} */ ({}), LINKS: {}, BYCITY: {} };
          Object.keys(got).forEach(function (slug) {
            seed.PHOTOS[slug] = got[slug].items || {};
            seed.PACK[slug] = got[slug].pack || null;
          });
          if (Object.keys(got).length) W.photosSeed(seed);
        },
        function () {
          /* the store could not be read: the index comes from the database when there is a signal */
        }
      );
  W.offCities = cities;
  W.photoPack = { read: read, get: get, fill: fill, want: want, saveCity: saveCity, dropCity: dropCity, saving: going2 };
})();
