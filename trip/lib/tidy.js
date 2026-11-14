/* Waypoint housekeeping (v201, second script): what the phone and the account keep is let go of when nobody needs it
   any more, so none of it only grows. Once a day, at idle: photos saved for offline that no city of any trip of yours and
   no saved city needs and nothing has used for 60 days (O.prune); ideas kept for cities no trip names and nothing has
   touched for 60 days (W.ideaStore.prune); and the days of the error log older than 30 (W.tidyErrors). All of it is a cache or a log: what goes is fetched or asked for again if it
   is ever needed. */
(function () {
  "use strict";
  var W = window.W,
    O = W.offline,
    photoUrls = O.photoUrls;
  /** the cities and countries any trip of yours names (the one on screen as it is now, the others as kept) */
  function tripPlaces() {
    var out = { city: /** @type {Record<string, number>} */ ({}), country: /** @type {Record<string, number>} */ ({}) },
      ex = W.tripsExport ? W.tripsExport() : null,
      inTrip = W.ideaStore.inTrip;
    ((ex && ex.trips) || [])
      .map(function (/** @type {any} */ t) {
        return t.id === W.S.tripId ? inTrip(W.S, (W.P && W.P.stops) || []) : inTrip(t.state, null);
      })
      .concat([inTrip(W.S, (W.P && W.P.stops) || [])])
      .forEach(function (x) {
        Object.keys(x.city).forEach(function (k) {
          out.city[k] = 1;
        });
        Object.keys(x.country).forEach(function (k) {
          out.country[k] = 1;
        });
      });
    return out;
  }
  /** run a job once, a while after opening, when the browser is idle @param {() => void} job @param {number} after */
  function whenIdle(job, after) {
    window.setTimeout(function () {
      if (window.requestIdleCallback) window.requestIdleCallback(job, { timeout: 60000 });
      else job();
    }, after);
  }
  /* ---------- photos on the phone ---------- */
  /* A photo on the phone carries when it was last used (lib/offline.js). Once a day, at idle, one unused for KEEP_DAYS
     that belongs to no city of any trip of yours and no saved city is deleted: the store only ever grew before. It is a
     cache: such a photo is fetched again if its city comes back. */
  var KEEP_DAYS = 60;
  var put = function (/** @type {string} */ store, /** @type {any} */ v) {
    return O.tx(store, "readwrite", function (/** @type {any} */ s) {
      s.put(v);
    }).then(null, function () {});
  };
  /** write down which photos were shown since last time (O.usedNow, filled by lib/offline.js) */
  function flushUsed() {
    var list = Object.keys(O.usedNow);
    list.forEach(function (u) {
      delete O.usedNow[u];
    });
    if (!list.length) return Promise.resolve();
    return O.tx("blobs", "readwrite", function (/** @type {any} */ s) {
      var t = Date.now();
      list.forEach(function (u) {
        var r = s.get(u);
        r.onsuccess = function () {
          if (r.result) {
            r.result.used = t;
            s.put(r.result);
          }
        };
      });
    }).then(null, function () {});
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && !O.copy) flushUsed();
  });
  /** every photo address the trips and saved cities need, so a photo of one is never let go. The photo index holds
      each city's addresses; a trip city whose index is not on this phone yet names none (such a photo, if unused for
      KEEP_DAYS, is simply fetched again). @returns {Record<string, 1>} */
  function keepUrls() {
    var keep = /** @type {Record<string, 1>} */ ({}),
      snap = W.photosSnapshot ? W.photosSnapshot() : null,
      slugs = /** @type {Record<string, 1>} */ ({});
    if (W.P && W.P.stops) photoUrls(W.P).forEach(function (u) {
      keep[u] = 1;
    });
    var use = tripPlaces();
    Object.keys(use.city).forEach(function (k) {
      var at = k.indexOf("|");
      if (at > 0) slugs[W.citySlug(k.slice(0, at), k.slice(at + 1))] = 1;
    });
    Object.keys(W.offCities ? W.offCities() : {}).forEach(function (sl) {
      slugs[sl] = 1;
    });
    Object.keys(slugs).forEach(function (sl) {
      var items = (snap && snap.PHOTOS[sl]) || {};
      Object.keys(items).forEach(function (k) {
        if (items[k] && items[k].url) keep[items[k].url] = 1;
      });
    });
    return keep;
  }
  /** let go of the unused photos, at most once a day. Answers how many went. @returns {Promise<number>} */
  O.prune = function () {
    if (O.copy || W.readOnly) return Promise.resolve(0);
    var day = Math.floor(Date.now() / 864e5);
    return flushUsed()
      .then(function () {
        return O.tx("kv", "readonly", function (/** @type {any} */ s) {
          return s.get("pruned");
        });
      })
      .then(function (/** @type {any} */ r) {
      if (r && r.v === day) return 0;
      var keep = keepUrls(),
        cut = Date.now() - KEEP_DAYS * 864e5,
        n = 0;
      return O.tx("blobs", "readwrite", function (s) {
        var c = s.openCursor();
        c.onsuccess = function () {
          var cur = c.result;
          if (!cur) return;
          var v = cur.value;
          if (!keep[v.url] && (v.used || v.at || 0) < cut) {
            cur.delete();
            n++;
          }
          cur.continue();
        };
      })
        .then(function () {
          return put("kv", { k: "pruned", v: day });
        })
        .then(function () {
          return n;
        });
    }).then(null, function () {
      return 0;
    });
  };
  if (!O.copy)
    whenIdle(function () {
      O.prune();
    }, 45000);

  /* ---------- ideas kept on the phone ---------- */
  var IDEAS_DAYS = 60;
  /** Let go of the ideas of cities no trip of yours names that nothing has touched for IDEAS_DAYS, at most once a day.
      The store (lib/ideastore.js) notes when each place was last written or read ("@touched", in its "sig" store); this
      notes when it last saw a place in use, or first saw it unused ("@seen"), so a place kept before there were notes
      starts its days at once and one a trip has just stopped naming starts them then. A place in memory stays (it is in use). Answers how many went.
      @returns {Promise<number>} */
  var pruneIdeas = (W.ideaStore.prune = function () {
    var now = Date.now(),
      today = Math.floor(now / 864e5);
    if (!W.ideaStore.isOn() || W.readOnly || !window.indexedDB) return Promise.resolve(0);
    return new Promise(function (res) {
      var r = indexedDB.open("waypoint-ideas", 1);
      r.onerror = r.onblocked = function () {
        res(0);
      };
      r.onsuccess = function () {
        var db = r.result,
          gone = /** @type {string[]} */ ([]);
        try {
          var tx = db.transaction(["v", "sig"], "readwrite"),
            a = tx.objectStore("v"),
            b = tx.objectStore("sig"),
            keys = b.getAllKeys(),
            vals = b.getAll();
          tx.oncomplete = function () {
            db.close();
            res(gone.length);
          };
          tx.onerror = tx.onabort = function () {
            db.close();
            res(0);
          };
          vals.onsuccess = function () {
            var all = /** @type {Record<string, string>} */ ({});
            /** @type {string[]} */ (keys.result).forEach(function (k, i) {
              all[k] = vals.result[i];
            });
            var read = function (/** @type {string} */ k) {
                try {
                  return JSON.parse(all[k]) || {};
                } catch (e) {
                  return {};
                }
              },
              touched = read("@touched"),
              seen = read("@seen");
            if (all["@pruned"] === String(today)) return;
            var use = tripPlaces(),
              C = /** @type {any} */ (W.C);
            Object.keys(all).forEach(function (id) {
              var at = id.indexOf("|");
              if (at < 1) return;
              var kind = id.slice(0, at),
                key = id.slice(at + 1);
              if (/** @type {any} */ (use)[kind][key] || (C[kind] && C[kind][key])) {
                seen[id] = now; /* (last seen in use) */
                return;
              }
              var last = Math.max(touched[id] || 0, seen[id] || 0) || (seen[id] = now);
              if (now - last >= IDEAS_DAYS * 864e5) {
                a.delete(id);
                b.delete(id);
                delete seen[id];
                gone.push(id);
              }
            });
            b.put(JSON.stringify(seen), "@seen");
            b.put(String(today), "@pruned");
          };
        } catch (e) {
          db.close();
          res(0);
        }
      };
    });
  });
  W.ideaStore.ready.then(function (yes) {
    if (yes)
      whenIdle(function () {
        pruneIdeas();
      }, 30000);
  });

  /* ---------- the error log ---------- */
  var ERR_DAYS = 30,
    ERR_KEY = "waypoint-errlog-tidied";
  /** The days of the error log (data/users/<you>/errlog/d/<YYYY-MM-DD>, written by lib/errlog.js) older than ERR_DAYS are
      deleted, at most once a day. The nightly error watch reads only the last day. Quiet: failing to tidy is not worth an
      error of its own. @returns {Promise<number>} how many went */
  W.tidyErrors = function () {
    var today = new Date(),
      name = function (/** @type {Date} */ d) {
        return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      };
    try {
      if (localStorage.getItem(ERR_KEY) === name(today)) return Promise.resolve(0);
    } catch (e) {}
    if (!window.claude || !window.claude.use || window.__WP_OFFLINE || W.readOnly) return Promise.resolve(0);
    var cut = new Date(today.getTime());
    cut.setDate(cut.getDate() - ERR_DAYS);
    return Promise.all([window.claude.use("db"), window.claude.use("user")])
      .then(function (r) {
        if (!r[0] || !r[1]) return 0;
        var db = r[0];
        return r[1].id().then(function (/** @type {string} */ uid) {
          var col = db.doc("data/users/" + uid + "/errlog").collection("d");
          return col.get().then(function (/** @type {any} */ snap) {
            var old = snap.docs.filter(function (/** @type {any} */ x) {
              return /^\d{4}-\d\d-\d\d$/.test(x.id) && x.id < name(cut);
            });
            return Promise.all(
              old.map(function (/** @type {any} */ x) {
                return col.doc(x.id).delete();
              })
            ).then(function () {
              try {
                localStorage.setItem(ERR_KEY, name(today));
              } catch (e) {}
              return old.length;
            });
          });
        });
      })
      .then(null, function () {
        return 0;
      });
  };
  whenIdle(function () {
    W.tidyErrors();
  }, 60000);
})();
