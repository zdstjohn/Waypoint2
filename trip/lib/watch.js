/* Waypoint price watch: keeps an eye on your chosen hotel (Booking.com) and your flights (Expedia).
   Each watch is a private record in your account; the app re-checks it when you open it (at most every 6 hours),
   and a daily scheduled check does the same while the app is closed. A drop of 3% or more is flagged. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var db = null,
    uid = null,
    docs = {},
    sub = null,
    busy = {},
    tried = {},
    queue = false;
  var STALE = 6 * 3600e3;
  try {
    if (window.claude && window.claude.use) {
      window.claude.use("db").then(
        function (d) {
          db = d;
          start();
        },
        function () {}
      );
      window.claude.use("user").then(
        function (u) {
          if (u)
            u.id().then(
              function (id) {
                uid = id;
                start();
              },
              function () {}
            );
        },
        function () {}
      );
    }
  } catch (e) {}
  function col() {
    return "data/users/" + uid + "/watch/w";
  }
  function start() {
    if (!db || !uid || sub) return;
    sub = db.collection(col()).onSnapshot(
      function (snap) {
        var d = {};
        snap.docs.forEach(function (x) {
          d[x.id] = Object.assign({}, x.data(), { id: x.id });
        });
        docs = d;
        W.arrived(); /* (a snapshot: drawn with whatever else arrives with it) */
        later();
      },
      function () {}
    );
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function idFor(kind, key) {
    return (W.S.tripId || "trip") + "-" + kind + "-" + hash(key);
  }
  function drop(w) {
    var b = w && w.base,
      l = w && w.last;
    if (!b || !l || !(l.total > 0) || l.cur !== b.cur) return null;
    var d = b.total - l.total;
    return d >= Math.max(10, b.total * 0.03) ? { save: d, now: l.total, was: b.total, cur: b.cur } : null;
  }
  W.watchDrop = drop;
  /* this trip's watches that dropped */
  W.watchDrops = function () {
    var t = W.S.tripId;
    if (W.readOnly || !t) return [];
    return Object.keys(docs)
      .map(function (k) {
        return docs[k];
      })
      .filter(function (w) {
        return w.trip === t && drop(w);
      });
  };

  /* ---------- start or stop watching ---------- */
  function setDoc(id, data) {
    return db.doc(col() + "/" + id).set(data);
  }
  function watchStay(ck, P) {
    var st = W.S.stays[ck];
    if (!st || !st.live || !db || !uid) return;
    var I = W.stayInput(ck, P, st.label);
    if (!I) return;
    var city = ck.split("|")[1],
      id = idFor("stay", ck);
    setDoc(id, {
      trip: W.S.tripId || "",
      tripName: W.tripName ? W.tripName() : "",
      kind: "stay",
      key: ck,
      server: "Booking.com",
      tool: "accommodations_search",
      input: I.input,
      match: st.label,
      label: st.label + ", " + city + " · " + I.dt.nights + " night" + (I.dt.nights > 1 ? "s" : ""),
      url: st.live.url || "",
      end: I.dt.in,
      base: { total: st.live.total, cur: st.live.cur, at: Date.now() },
      last: { total: st.live.total, cur: st.live.cur, at: Date.now() },
      hist: [[Date.now(), st.live.total]],
      updated: Date.now()
    }).then(null, function () {});
  }
  function watchFare(dir, P) {
    var I = W.fareInput(dir, P),
      m = W.fareMin(dir, P);
    if (!I || !m || !db || !uid) return;
    var id = idFor("fare", dir);
    setDoc(id, {
      trip: W.S.tripId || "",
      tripName: W.tripName ? W.tripName() : "",
      kind: "fare",
      key: dir,
      server: "Expedia",
      tool: "search_flights",
      input: I.input,
      label: I.F.from + " → " + I.F.to + " · " + I.F.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      end: I.input.departure_date,
      base: { total: m.total, cur: m.cur, at: Date.now() },
      last: { total: m.total, cur: m.cur, at: Date.now() },
      hist: [[Date.now(), m.total]],
      updated: Date.now()
    }).then(null, function () {});
  }
  function unwatch(id) {
    if (db && uid)
      db.doc(col() + "/" + id)
        .delete()
        .then(null, function () {});
  }

  /* ---------- re-checking ---------- */
  function priceFrom(w, payload) {
    if (w.kind === "stay") {
      var want = W.norm(w.match),
        list = (payload && payload.accommodations) || [];
      var hit =
        list.filter(function (a) {
          return a && a.name && W.norm(a.name) === want;
        })[0] ||
        list.filter(function (a) {
          return a && a.name && (W.norm(a.name).indexOf(want) > -1 || want.indexOf(W.norm(a.name)) > -1);
        })[0];
      return hit && hit.price && +hit.price.book > 0
        ? { total: +hit.price.book, cur: String(hit.price.currency || w.base.cur), url: hit.url }
        : null;
    }
    var best = null;
    ((payload && payload.options) || []).forEach(function (o) {
      var p = o.price && o.price.total_price;
      var v = p && +p.value;
      if (v > 0 && (!best || v < best.total)) best = { total: v, cur: String(p.currency || w.base.cur) };
    });
    return best;
  }
  function check(w) {
    if (busy[w.id] || !db || !uid) return Promise.resolve();
    busy[w.id] = true;
    tried[w.id] = Date.now();
    W.changed();
    return W.callTool(w.server, w.tool, w.input)
      .then(function (r) {
        var p = priceFrom(w, r && r.payload),
          now = Date.now();
        var upd = { updated: now };
        if (p) {
          upd.last = { total: p.total, cur: p.cur, at: now };
          upd.hist = (w.hist || []).concat([[now, p.total]]).slice(-30);
          if (!w.low || p.total < w.low.total) upd.low = { total: p.total, at: now };
          upd.miss = false;
        } else {
          upd.miss = true;
          upd.last = Object.assign({}, w.last || {}, { at: now });
        }
        return db.doc(col() + "/" + w.id).update(upd);
      })
      .then(null, function () {})
      .then(function () {
        busy[w.id] = false;
        W.changed();
      });
  }
  /* when the app opens: anything for this trip not checked in the last 6 hours, one at a time */
  function later() {
    if (queue || W.readOnly) return;
    var t = W.S.tripId,
      today = W.isoDay ? W.isoDay(W.now()) : "";
    var due = Object.keys(docs)
      .map(function (k) {
        return docs[k];
      })
      .filter(function (w) {
        return (
          w.trip === t && !(w.end && today && w.end < today) && !tried[w.id] && !(w.last && w.last.at && Date.now() - w.last.at < STALE)
        );
      });
    if (!due.length || !W.getMcp) return;
    queue = true;
    W.getMcp().then(
      function (m) {
        if (!m) {
          queue = false;
          return;
        }
        due
          .reduce(function (p, w) {
            return p.then(function () {
              return check(w);
            });
          }, Promise.resolve())
          .then(function () {
            queue = false;
          });
      },
      function () {
        queue = false;
      }
    );
  }

  /* ---------- what you see ---------- */
  function money(v, c) {
    return W.money(v, c);
  }
  var ago = W.ago;
  /* the small button on a hotel or flight row */
  W.watchChip = function (kind, key, P) {
    if (W.readOnly || !db || !uid) return "";
    var w = docs[idFor(kind, key)];
    if (!w) {
      var can = kind === "stay" ? !!(W.S.stays[key] && W.S.stays[key].live) : !!(P && W.fareMin(key, P)); /* (a fare needs the plan) */
      return can ? '<button type="button" class="chip-a" data-watch="' + kind + '" data-wkey="' + esc(key) + '">Watch price</button>' : "";
    }
    var d = drop(w),
      cur = w.last || w.base;
    if (busy[w.id]) return '<span class="chip-a busy"><span class="loading">Checking price…</span></span>';
    return (
      '<button type="button" class="chip-a ' +
      (d ? "drop" : "watching") +
      '" data-unwatch="' +
      esc(w.id) +
      '" title="Checked ' +
      esc(ago(cur.at)) +
      '. Tap to stop watching.">' +
      (d ? "↓ " + money(d.now, d.cur) + " · was " + money(d.was, d.cur) : "Watching · " + money(cur.total, cur.cur)) +
      "</button>"
    );
  };
  /* the line at the top of Book ahead when something got cheaper */
  W.watchBanner = function () {
    var L = W.watchDrops();
    if (!L.length) return "";
    return (
      '<div class="wdrop">' +
      L.map(function (w) {
        var d = drop(w);
        if (!d) return "";
        return (
          "<p><b>Price drop</b> " +
          esc(w.label) +
          ": " +
          money(d.now, d.cur) +
          ' <span class="muted">(was ' +
          money(d.was, d.cur) +
          ")</span>" +
          (W.safeUrl(w.url) ? ' <a href="' + esc(W.safeUrl(w.url)) + '" target="_blank" rel="noopener">Book ↗</a>' : "") +
          "</p>"
        );
      }).join("") +
      "</div>"
    );
  };
  /* Trip settings: everything watched on this trip, with a way to stop */
  W.watchList = function () {
    if (W.readOnly || W.standalone) return "";
    if (!db || !uid)
      return (
        '<p class="small muted">' +
        W.esc(W.needsClaude("Price watching", "Price watching works when this page is open in the Claude app.")) +
        "</p>"
      );
    var t = W.S.tripId,
      L = Object.keys(docs)
        .map(function (k) {
          return docs[k];
        })
        .filter(function (w) {
          return w.trip === t;
        })
        .sort(function (a, b) {
          return String(a.end || "").localeCompare(String(b.end || ""));
        });
    if (!L.length)
      return '<p class="small muted">Nothing watched yet. Tap <b>Watch price</b> next to your hotel or flight under To book and it\'s re-checked every day.</p>';
    return (
      '<ul class="wlist">' +
      L.map(function (w) {
        var d = drop(w),
          cur = w.last || w.base || {};
        var line =
          (d ? "↓ " + money(d.now, d.cur) + " · was " + money(d.was, d.cur) : cur.total ? "Now " + money(cur.total, cur.cur) : "") +
          (cur.at ? " · checked " + ago(cur.at) : "") +
          (w.miss ? " · not found last check" : "");
        return (
          "<li" +
          (d ? ' class="drop"' : "") +
          '><div class="wl-b"><b>' +
          esc(w.label || "Watch") +
          '</b><span class="small muted">' +
          esc(line) +
          "</span></div>" +
          (W.safeUrl(w.url) ? '<a class="small" href="' + esc(W.safeUrl(w.url)) + '" target="_blank" rel="noopener">Book ↗</a>' : "") +
          (busy[w.id]
            ? '<span class="loading small">Checking…</span>'
            : '<button type="button" class="linkish" data-unwatch="' + esc(w.id) + '">Stop</button>') +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  };
  W.watchClick = function (d, P) {
    if (d.watch === "stay") {
      watchStay(d.wkey, P);
      return true;
    }
    if (d.watch === "fare") {
      watchFare(d.wkey, P);
      return true;
    }
    if (d.unwatch) {
      unwatch(d.unwatch);
      return true;
    }
    return false;
  };
})();
