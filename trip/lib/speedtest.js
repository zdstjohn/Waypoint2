/* Waypoint speed test (second script). One question, measured once: does asking Claude to think less before it writes
   make a list come sooner without making it worse? For the artifact's owner only, once per phone, when a real trip's
   city already has its ideas and nothing else is being asked: the first question about that city (its 12 best things
   to do) is asked twice, one after the other, at the platform's usual setting and at low effort. The answers are
   measured and thrown away, never shown or planned with: the time to the first words and to the end, how many places
   pass the checks every answer goes through, how many pins were refused, how many places the two answers share and
   how far apart their pins are. The result is kept in the owner's own space (data/users/<you>/diag/d/effort), so it can
   be read back and the setting decided on (W.EFFORT, lib/core.js). Never runs in the installable app, and in a test
   browser only when the test asks for it (window.__WP_SPEEDTEST: the answers are the stand-in's, the path is real).
   v139: the first version (v130) wrote to data/users/<you>/diag/effort, which is not a document's path (an odd number
   of parts names a collection), so the result was refused and the phone marked it "failed": hence the new key below. */
(function () {
  "use strict";
  var W = window.W,
    V = W.V,
    KEY = "waypoint-speedtest-v2",
    TEST = !!window.__WP_SPEEDTEST;
  var BUILD = "__BUILD__"; /* the build time, filled in by build/bundle.js */
  if (W.standalone || (navigator.webdriver && !TEST) || !window.claude || !window.claude.use) return;
  try {
    if (localStorage.getItem(KEY)) return;
  } catch (e) {
    return;
  }
  var started = false,
    checks = 0,
    timer = setInterval(check, TEST ? 500 : 30000);
  function stop(mark) {
    clearInterval(timer);
    if (mark) {
      try {
        localStorage.setItem(KEY, mark);
      } catch (e) {}
    }
  }
  function idle() {
    return !Object.keys(W.status).some(function (k) {
      return W.status[k] === "loading";
    });
  }
  function candidate() {
    var P = W.P;
    if (!P || !P.stops || W.isExample || W.readOnly) return null;
    for (var i = 0; i < P.stops.length; i++) {
      var s = P.stops[i],
        pool = W.C.city[W.cityKey(s.country, s.name)];
      if (pool && !pool.fallback && (pool.spots || []).length >= 8 && pool.lat != null)
        return { country: s.country, city: s.name, center: { lat: pool.lat, lng: pool.lng } };
    }
    return null;
  }
  function ask(prompt, effort) {
    var t0 = Date.now(),
      first = 0,
      opts = /** @type {any} */ ({
        modelTier: "default",
        cache: false,
        onText: function () {
          if (!first) first = Date.now() - t0;
        }
      });
    if (effort) opts.effort = effort;
    return W.SAMPLE.json(prompt, opts).then(
      function (r) {
        return { ms: Date.now() - t0, first: first, r: r, err: "" };
      },
      function (e) {
        return { ms: Date.now() - t0, first: first, r: null, err: String((e && e.code) || "error") };
      }
    );
  }
  function measure(a, center) {
    var raw = a.r && Array.isArray(a.r.spots) ? a.r.spots : [],
      st = V.stats,
      d0 = st.dropped,
      c0 = st.cleared;
    var list = V.list(raw, function (x) {
      return V.spot(x, center);
    });
    return {
      ms: a.ms,
      first: a.first,
      err: a.err,
      n: raw.length,
      ok: list.length,
      dropped: st.dropped - d0,
      cleared: st.cleared - c0,
      pinned: list.filter(function (x) {
        return x.lat != null;
      }).length,
      names: list.map(function (x) {
        return x.n;
      }),
      /* (as "lat,lng" text: a list inside a list is not something every document store keeps) */
      pins: list.map(function (x) {
        return x.lat != null ? x.lat + "," + x.lng : "";
      })
    };
  }
  function check() {
    if (started || ++checks > 60) {
      if (checks > 60) stop("");
      return;
    }
    if (!W.SAMPLE || W.sampleState !== "on" || !idle()) return;
    var c = candidate();
    if (!c) return;
    started = true;
    clearInterval(timer);
    Promise.all([window.claude.use("user"), window.claude.use("db")])
      .then(function (r) {
        var user = r[0],
          db = r[1];
        if (!user || !db) {
          stop("not-owner");
          return null;
        }
        /* (isOwner may answer at once or as a promise: either way, only a yes goes on) */
        return Promise.resolve(user.isOwner())
          .then(function (own) {
            if (own) return user.id();
            stop("not-owner");
            return null;
          })
          .then(function (uid) {
            if (!uid) return null;
            return measureFor(uid, db);
          });
      })
      .then(null, function (e) {
        stop("failed: " + String((e && (e.code || e.message)) || e).slice(0, 80));
        if (W.caught) W.caught(e, "the speed measurement");
      });
    function measureFor(uid, db) {
      var prompt = W.spotsAsk(c.country, c.city, 12);
      return ask(prompt, "").then(function (a) {
        return ask(prompt, "low").then(function (b) {
          var A = measure(a, c.center),
            B = measure(b, c.center),
            by = {},
            shared = 0,
            far = 0,
            km = [];
          A.names.forEach(function (n, i) {
            by[W.norm(n)] = A.pins[i] || "";
          });
          B.names.forEach(function (n, i) {
            var p = by[W.norm(n)];
            if (p === undefined) return;
            shared++;
            var q = B.pins[i];
            if (p && q) {
              var pa = p.split(","),
                qa = q.split(",");
              var d = W.km({ lat: +pa[0], lng: +pa[1] }, { lat: +qa[0], lng: +qa[1] }) || 0;
              km.push(Math.round(d * 100) / 100);
              if (d > 1) far++;
            }
          });
          var out = {
            at: new Date().toISOString(),
            build: BUILD,
            city: c.city + ", " + c.country,
            usual: A,
            low: B,
            shared: shared,
            pinsOver1km: far,
            pinKm: km
          };
          return db
            .doc("data/users/" + uid + "/diag")
            .collection("d")
            .doc("effort")
            .set(out)
            .then(function () {
              stop("done");
            });
        });
      });
    }
  }
})();
