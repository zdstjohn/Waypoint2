/* Waypoint and Google Maps, through the viewer's own Google Maps connection in Claude (the page cannot reach the
   internet itself, and holds no key). Five things, all of them extras: without the connection every screen works as
   it did.
     - the real time between a day's stops (walking, transit, driving), in place of the estimate from the distance
     - the forecast for a day inside Google's ten days
     - Explore's search on Google's listings
     - a day's places as one list in Google Maps, to keep there
     - a place from a pasted Google Maps link
   Only Google's basic kind of request is made: no live-traffic routing, five results at most, no extended details.
   What is kept: real times travel with the trip (S.rl, read by W.leg in lib/core.js); the forecast, and the times of
   a trip this device cannot write to, stay on this device (localStorage "waypoint-gmaps-v1"). Google's descriptions
   and ratings are shown while you search and never kept; a pin taken from Google is kept for 30 days (lib/import.js). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    V = W.V;
  var SERVER = "Google Maps",
    KEY = "waypoint-gmaps-v1",
    DAY_MAX = 300 /* requests a day from this device, of every kind */,
    BG_MAX = 120 /* requests the app makes by itself in one visit (times and forecasts) */,
    LEG_DAYS = 60 /* a real time is asked for again after this long */,
    NONE_DAYS = 14; /* "Google has no route" is asked again sooner */
  var MODES = ["walking", "transit", "driving"],
    ASK = { walking: "WALK", transit: "TRANSIT", driving: "DRIVE" };
  /** @type {any} */
  var L = load();
  /** state: idle (not looked yet) | checking | on | off; why it is off: you (the switch) | no (you said no when Claude
      asked) | none (no Google Maps connection) | view (this view has no connections) | a refusal's code */
  var G = { state: "idle", why: "", /** @type {any} */ mcp: null, /** @type {Promise<boolean> | null} */ p: null, wait: 0, bg: 0 };
  W.rlOwn = L.rl;

  function load() {
    var o = null;
    try {
      o = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {}
    o = o && typeof o === "object" ? o : {};
    o.rl = o.rl && typeof o.rl === "object" ? o.rl : {};
    o.wx = o.wx && typeof o.wx === "object" ? o.wx : {};
    return o;
  }
  var keepT = 0;
  function keep() {
    if (keepT) return;
    keepT = setTimeout(function () {
      keepT = 0;
      try {
        localStorage.setItem(KEY, JSON.stringify(L));
      } catch (e) {
        /* no room: the forecast and this device's own times can be asked for again */
        L.wx = {};
        try {
          localStorage.setItem(KEY, JSON.stringify(L));
        } catch (e2) {}
      }
    }, 400);
  }
  function stamp() {
    return Math.floor(Date.now() / 864e5);
  }

  /* ---------- is the connection there? (looking never asks the viewer anything) ---------- */
  function off(why) {
    G.state = "off";
    G.why = why;
    G.mcp = null;
    return false;
  }
  function ready() {
    if (G.p) return G.p;
    if (W.standalone || window.__WP_OFFLINE || !W.getMcp) return (G.p = Promise.resolve(off("view")));
    if (L.off) return (G.p = Promise.resolve(off("you")));
    if (L.no && Date.now() - L.no < 7 * 864e5) return (G.p = Promise.resolve(off("no")));
    G.state = "checking";
    return (G.p = W.getMcp()
      .then(function (m) {
        if (!m || !m.listTools) return off("view");
        return m.listTools(SERVER).then(function (r) {
          var s = ((r && r.servers) || []).filter(function (x) {
            return x && x.server === SERVER;
          })[0];
          if (!s || !(s.tools || []).length || s.authStatus === "needs_reauth")
            return off(s && s.authStatus === "needs_reauth" ? "needs_reauth" : "none");
          G.mcp = m;
          G.state = "on";
          G.why = "";
          return true;
        });
      })
      .then(null, function () {
        return off("none");
      })
      .then(function (ok) {
        if (ok) tidy();
        /* the screens now show what the connection adds (and Settings says how it stands) */
        if ((ok || document.getElementById("set-gm")) && W.arrived) W.arrived();
        return ok;
      }));
  }
  W.gmOn = function () {
    return G.state === "on";
  };
  W.gmState = function () {
    return { state: G.state, why: G.why, left: order.length + running };
  };

  /* one request. bg: the app asking by itself (counted against the visit's limit, and paused after a failure) */
  var SAID_NO = /^(not_in_manifest|approval_required|consent_required)$/,
    GONE =
      /^(needs_reauth|server_not_connected|server_not_found|selection_required|blocked_by_policy|not_granted|capability_disabled|capability_removed|user_changed)$/;
  function spend(bg) {
    var d = stamp();
    if (!L.n || L.n[0] !== d) L.n = [d, 0];
    if (L.n[1] >= DAY_MAX || (bg && G.bg >= BG_MAX)) return false;
    L.n[1]++;
    if (bg) G.bg++;
    keep();
    return true;
  }
  /** @param {string} tool @param {any} input @param {boolean} [bg] @returns {Promise<any>} */
  function call(tool, input, bg) {
    return ready()
      .then(function (ok) {
        if (!ok || !G.mcp) throw { code: "off" };
        if (bg && Date.now() < G.wait) throw { code: "wait" };
        if (!spend(bg)) throw { code: "budget" };
        return G.mcp.callTool(SERVER, tool, input);
      })
      .then(
        function (r) {
          var p = r && (r.payload !== undefined ? r.payload : r.structuredContent);
          if (typeof p === "string") {
            try {
              p = JSON.parse(p);
            } catch (e) {
              p = null;
            }
          }
          return p && typeof p === "object" ? p : {};
        },
        function (e) {
          var c = String((e && e.code) || "");
          if (SAID_NO.test(c) || GONE.test(c)) {
            off(SAID_NO.test(c) ? "no" : c);
            G.p = Promise.resolve(false);
            if (SAID_NO.test(c)) {
              L.no = Date.now();
              keep();
            }
            order = [];
            if (W.arrived) W.arrived();
          } else if (c === "server_unavailable" || c === "rate_limited" || c === "upstream_error")
            G.wait = Date.now() + Math.min(6e4, +(e && e.retryAfterMs) || 0) + 12e4;
          throw e;
        }
      );
  }
  /** what to say when a request the viewer asked for fails @param {any} e */
  function sorry(e) {
    var c = e && e.code;
    if (c === "budget") return "That's enough Google Maps requests for today from this device. It works again tomorrow.";
    if (c === "off") return "Google Maps isn't connected here.";
    if (!navigator.onLine) return "You're offline: Google Maps needs a connection.";
    return W.mcpMsg ? W.mcpMsg(e, SERVER) : "Google Maps didn't answer. Try again in a minute.";
  }
  function ll(p) {
    return { latLng: { latitude: p.lat, longitude: p.lng } };
  }
  function gUrl(u) {
    return typeof u === "string" && /^https:\/\/(www\.|maps\.)?google\.[a-z.]{2,6}\//.test(u) && u.length < 1200 ? u : "";
  }

  /* ---------- real times between stops ---------- */
  /** @type {any[]} */
  var order = [],
    /** @type {Record<string, number>} */ asked = {},
    running = 0,
    pumpT = 0,
    tellT = 0;
  /* W.leg found no real time for this pair: ask Google for it, a little later and two at a time */
  W.legAsk = function (k, a, b, e) {
    if (asked[k] || G.state === "off" || W.isExample || order.length > 300) return;
    asked[k] = 1;
    order.push({ k: k, a: { lat: a.lat, lng: a.lng }, b: { lat: b.lat, lng: b.lng }, mode: e.mode, est: e.min, d: e.d });
    if (!pumpT) pumpT = setTimeout(pump, 600);
  };
  function pump() {
    pumpT = 0;
    if (G.state === "off") {
      order = [];
      return;
    }
    while (running < 2 && order.length) one(order.shift());
  }
  /** Google's route between two pins: minutes and kilometres, or null when it has none @returns {Promise<{min: number, km: number} | null>} */
  function route(q, how) {
    var input = /** @type {any} */ ({ origin: ll(q.a), destination: ll(q.b), travelMode: how });
    if (how === "TRANSIT") input.departureTime = depart(q);
    return call("compute_routes", input, true).then(function (p) {
      var r = (Array.isArray(p.routes) ? p.routes : [])[0],
        s = r ? parseFloat(String(r.duration)) : 0,
        m = Math.round(s / 60);
      if (!(s > 0) || m > 900) return null;
      return { min: Math.max(1, m), km: Math.max(0, +r.distanceMeters || 0) / 1000 };
    });
  }
  function one(q) {
    running++;
    route(q, ASK[q.mode])
      .then(function (r) {
        var m = MODES.indexOf(q.mode);
        /* no transit there, or a connection so slow nobody would take it (a village bus twice a day): on foot when it
           is close, otherwise by car or taxi */
        if (q.mode === "transit" && (!r || r.min > Math.max(60, q.est * 2.5))) {
          var foot = q.d < 2.5;
          return route(q, foot ? "WALK" : "DRIVE").then(function (r2) {
            return r2 ? [r2.min, r2.km, foot ? 0 : 3] : r ? [r.min, r.km, 1] : [0, 0, 1];
          });
        }
        return r ? [r.min, r.km, m] : [0, 0, m];
      })
      .then(
        function (v) {
          put(q.k, [v[0], Math.round(v[1] * 10), v[2], stamp()]);
        },
        function () {
          /* no answer: the estimate stays, and this pair is not asked again in this visit */
        }
      )
      .then(function () {
        running--;
        if (!tellT)
          tellT = setTimeout(function () {
            tellT = 0;
            if (W.arrived) W.arrived();
          }, 1500);
        pump();
      });
  }
  /* The day on show asks as it is drawn. Besides that, once a visit: today and the two days after it (from two days
     before the trip: its first days), so the times are there before they are needed on the road. */
  var warmed = "",
    warmT = 0;
  function warm() {
    warmT = 0;
    try {
      var P = G.state === "on" && W.plan ? W.plan() : null,
        sig = (W.S.tripId || "") + "|" + W.isoDay(W.now());
      if (!P || !P.days || !W.S.start || W.isExample || warmed === sig) return;
      var tn = W.dayOfDate(W.isoDay(W.now()));
      if (tn == null) return;
      warmed = sig;
      P.days.forEach(function (day) {
        if (day.n < tn || day.n > tn + 2 || !day.slots || !day.slots.length) return;
        var home = W.homebase(day.country, day.city),
          prev = /** @type {any} */ (home);
        W.legWant++;
        try {
          W.dayTimes(day, P);
          day.slots.forEach(function (x) {
            if (!x.item || x.item.lat == null) return;
            W.leg(prev, x.item);
            prev = x.item;
          });
          if (prev !== home) W.leg(prev, home);
        } finally {
          W.legWant--;
        }
      });
    } catch (e) {
      if (W.caught) W.caught(e, "gmaps warm");
    }
  }
  /* a trip you can change keeps its times with it (so everyone it is shared with sees the same clock); otherwise here */
  function put(k, v) {
    if (!W.readOnly && !W.isExample) trim(W.S.rl || (W.S.rl = {}), k, v);
    else {
      trim(L.rl, k, v);
      keep();
    }
  }
  function trim(o, k, v) {
    o[k] = v;
    var ks = Object.keys(o);
    if (ks.length <= 600) return;
    ks.sort(function (x, y) {
      return (o[x][3] || 0) - (o[y][3] || 0);
    })
      .slice(0, ks.length - 500)
      .forEach(function (x) {
        delete o[x];
      });
  }
  /* with the connection there: times old enough to ask for again are dropped (a device without it keeps what it has) */
  function tidy() {
    var now = stamp();
    [W.readOnly || W.isExample ? null : W.S.rl, L.rl].forEach(function (o) {
      if (!o) return;
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (!Array.isArray(v) || now - (v[3] || 0) > (v[0] > 0 ? LEG_DAYS : NONE_DAYS)) delete o[k];
      });
    });
    keep();
  }
  /* when a transit trip is asked for: mid-morning on the day the stop is planned, when that is still to come and
     inside the 100 days Google's timetables cover; otherwise mid-morning next Wednesday. Local time is taken from the
     longitude, which is near enough for "a weekday morning". */
  function depart(q) {
    var when = /** @type {Date | null} */ (null),
      now = Date.now(),
      t = 0;
    function at(p) {
      return p && p.lat != null && Math.abs(p.lat - q.b.lat) < 6e-5 && Math.abs(p.lng - q.b.lng) < 6e-5;
    }
    try {
      var P = W.S.start && W.plan ? W.plan() : null;
      ((P && P.days) || []).some(function (day) {
        if (
          !(day.slots || []).some(function (x) {
            return at(x.item);
          })
        )
          return false;
        when = W.dateOf(day.n);
        return true;
      });
    } catch (e) {}
    var shift = (q.a.lng / 15) * 36e5;
    if (when) t = Date.UTC(when.getFullYear(), when.getMonth(), when.getDate(), 10) - shift;
    if (!when || t < now + 36e5 || t > now + 95 * 864e5) {
      var d = new Date(now + 864e5);
      while (d.getUTCDay() !== 3) d = new Date(d.getTime() + 864e5);
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10) - shift;
    }
    return new Date(Math.round(t / 6e4) * 6e4).toISOString().replace(/\.\d+Z$/, "Z");
  }

  /* ---------- the forecast ---------- */
  /** @type {Record<string, number>} */
  var wxBusy = {};
  var WET = /RAIN|SHOWER|THUNDER|STORM|SNOW|SLEET|HAIL|DRIZZLE/;
  /** the saved forecast for a trip day, asking for it when the day is inside Google's ten and it is missing or old */
  function wxGet(day) {
    var d = W.dateOf(day.n);
    if (!d) return null;
    var iso = W.isoDay(d),
      ahead = Math.round((Date.parse(iso) - Date.parse(W.isoDay(W.now()))) / 864e5);
    if (!(ahead >= 0 && ahead <= 9)) return null;
    var h = W.homebase(day.country, day.city);
    if (!h || h.lat == null) return null;
    var k = h.lat.toFixed(2) + "," + h.lng.toFixed(2) + "|" + iso,
      r = L.wx[k],
      age = r ? Date.now() - r.at : 1e15;
    if (age > (ahead <= 1 ? 3 : 8) * 36e5 && !wxBusy[k] && G.state !== "off" && !W.isExample) {
      wxBusy[k] = 1;
      setTimeout(function () {
        wxAsk(k, h, d);
      }, 500);
    }
    return r && r.x && age < 24 * 36e5 ? r : null;
  }
  function wxAsk(k, h, d) {
    call(
      "lookup_weather",
      { location: ll(h), capabilities: ["WEATHER"], date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() } },
      true
    )
      .then(
        function (p) {
          var w = p.weather || {},
            c = w.weatherCondition || {},
            pr = (w.precipitation && w.precipitation.probability) || {},
            num = function (x) {
              return typeof x === "number" && isFinite(x) ? Math.round(x * 10) / 10 : null;
            };
          var x = V.str((c.description && c.description.text) || "", 40),
            hi = num(w.maxTemperature && w.maxTemperature.degrees),
            lo = num(w.minTemperature && w.minTemperature.degrees);
          /* (anything else than Celsius would be a different request than the one made) */
          var ok = x && hi != null && lo != null && (!w.maxTemperature.unit || w.maxTemperature.unit === "CELSIUS");
          L.wx[k] = ok
            ? {
                at: Date.now(),
                x: x,
                t: V.str(c.type || "", 40),
                hi: hi,
                lo: lo,
                pop: Math.max(0, Math.min(100, Math.round(+pr.percent || 0))),
                pt: /SNOW/.test(String(pr.type || "")) ? "snow" : "rain",
                u: gUrl(w.attribution && w.attribution.url)
              }
            : { at: Date.now() };
        },
        function (e) {
          /* Google said no to this day (outside its ten days where the trip is): not asked again for a while */
          if (e && e.code === "tool_error") L.wx[k] = { at: Date.now() };
        }
      )
      .then(function () {
        delete wxBusy[k];
        /* days gone by are not kept */
        var today = W.isoDay(new Date(Date.now() - 864e5));
        Object.keys(L.wx).forEach(function (x) {
          if (x.split("|")[1] < today) delete L.wx[x];
        });
        keep();
        if (W.arrived) W.arrived();
      });
  }
  function fahrenheit() {
    return /-(US|LR|MM|BS|BZ|KY|PW)$/i.test(navigator.language || "");
  }
  /** the day's forecast as one line, with a way indoors when rain is likely and the day is under way
      @param {Day} day @param {boolean} [live] @param {boolean} [rescue] */
  W.wxLine = function (day, live, rescue) {
    var r = wxGet(day);
    if (!r) return "";
    var F = fahrenheit(),
      deg = function (c) {
        return Math.round(F ? (c * 9) / 5 + 32 : c);
      };
    var wet = r.pop >= 70 || (r.pop >= 50 && WET.test(r.t || ""));
    var bits = [
      esc(r.x),
      r.pop >= 20 ? r.pop + "% chance of " + r.pt : "",
      '<span class="nb">' + deg(r.lo) + "–" + deg(r.hi) + (F ? "°F" : "°C") + "</span>"
    ].filter(Boolean);
    return (
      '<p class="day-wx' +
      (wet ? " wet" : "") +
      '"><b>' +
      (live ? "Today's forecast" : "Forecast") +
      ":</b> " +
      bits.join(" · ") +
      ' <span class="muted">· ' +
      W.extLink(r.u || "https://www.google.com/search?q=" + encodeURIComponent("weather " + day.city + ", " + day.country), "Google ↗") +
      "</span>" +
      (wet && rescue ? ' <button type="button" class="chip" data-rescue="rain">Rain likely · go indoors</button>' : "") +
      "</p>"
    );
  };

  /* ---------- Explore's search, on Google's listings ---------- */
  /* Google answers with places (an ID, a pin, a title) and one written summary; the line about each place is the part
     of the summary that carries its number */
  function places(p, c, far) {
    var paras = String(p.summary || "").split(/\n+/),
      out = /** @type {any[]} */ ([]);
    (Array.isArray(p.places) ? p.places : []).forEach(function (pl, i) {
      if (!pl || typeof pl !== "object") return;
      var at = pl.attribution || {},
        n = V.name(String(at.title || "").replace(/\s+[-–]\s+Google Maps\s*$/i, "")),
        id = typeof pl.id === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(pl.id) ? pl.id : "",
        loc = pl.location || {},
        pin = c ? V.pinNear(loc.latitude, loc.longitude, c, far) : null;
      if (!n || !id || !pin) return;
      var line =
        paras.filter(function (s) {
          return s.indexOf("[" + i + "]") > -1;
        })[0] || "";
      var star = (line.match(/\((\d(?:\.\d)?)\s*★/) || [])[1],
        what = line
          .replace(/\*\*/g, "")
          .replace(/^.*?\[\d+\]\s*(\([^)]*\)\)?\s*)?/, "")
          .replace(/^(is|are)\s+(an?\s+|the\s+)?/i, "")
          .trim();
      what = what ? what.charAt(0).toUpperCase() + what.slice(1) : "";
      out.push({
        n: n,
        d: V.str([star ? star + "★" : "", what].filter(Boolean).join(" · "), 170),
        lat: pin.lat,
        lng: pin.lng,
        gid: id,
        url: gUrl(at.url)
      });
    });
    return out;
  }
  /** up to five of Google's places for these words, near the city @returns {Promise<any[]>} */
  W.gmSearch = function (q, c, city, country) {
    return call("search_places", {
      textQuery: q.slice(0, 200) + " in " + city + ", " + country,
      pageSize: 5,
      languageCode: "en",
      locationBias: { circle: { center: { latitude: c.lat, longitude: c.lng }, radiusMeters: 20000 } }
    }).then(function (p) {
      return places(p, c, 60);
    });
  };

  /* ---------- a place from a pasted Google Maps link ---------- */
  var LINK =
    /^https?:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|(www\.|maps\.)?google\.[a-z.]{2,6}\/maps[/?]|maps\.google\.[a-z.]{2,6}\/)\S+$/i;
  W.gmIsLink = function (q) {
    q = String(q || "").trim();
    return LINK.test(q) && q.length < 1500 ? q : "";
  };
  /* what a long link says by itself: the name in its path and the pin in its data */
  function readLink(u) {
    var o = /** @type {any} */ ({}),
      m = u.match(/\/maps\/place\/([^/@?]+)/),
      p = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m) {
      try {
        o.n = V.name(decodeURIComponent(m[1].replace(/\+/g, " ")));
      } catch (e) {}
    }
    if (p) {
      o.lat = +p[1];
      o.lng = +p[2];
    }
    return o;
  }
  /** the place behind a Google Maps link: {n, lat, lng, gid, d}; rejects with {msg}
      @param {string} u @param {LatLng} c the city's centre @returns {Promise<any>} */
  W.gmFromLink = function (u, c, city, country) {
    var own = readLink(u);
    function local(why) {
      var pin = own.n && own.lat != null ? V.pinNear(own.lat, own.lng, c, 150) : null;
      if (pin) return { n: own.n, lat: pin.lat, lng: pin.lng, d: "" };
      throw { msg: own.n && own.lat != null ? "That place is a long way from " + city + "." : why };
    }
    return ready().then(function (ok) {
      if (!ok)
        return local("A short Google Maps link can only be read with a Google Maps connection in Claude. Type the place's name instead.");
      return call("resolve_maps_urls", { urls: [u] })
        .then(function (p) {
          var e = (Array.isArray(p.entities) ? p.entities : [])[0],
            id = e && typeof e.place === "string" ? e.place.replace(/^places\//, "") : "";
          if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw { code: "nolink" };
          /* its name: Google's answers carry no name for an ID, but it titles the weather there "Weather for <name> -
             Google" and a drive there "(from) to <name> - Google Maps" */
          return (
            own.n
              ? Promise.resolve(own.n)
              : call("lookup_weather", { location: { placeId: id }, capabilities: ["WEATHER"] })
                  .then(
                    function (w) {
                      var m = String(((w.weather || {}).attribution || {}).title || "").match(/^Weather for (.+?)\s+[-–]\s+Google\s*$/);
                      return m ? V.name(m[1]) : "";
                    },
                    function () {
                      return "";
                    }
                  )
                  .then(function (n) {
                    if (n) return n;
                    return call("compute_routes", { origin: ll(c), destination: { placeId: id }, travelMode: "DRIVE" }).then(function (r) {
                      var m = String((((r.routes || [])[0] || {}).attribution || {}).title || "").match(
                        /^\([-\d.]+,\s*[-\d.]+\) to (.+?)\s+[-–]\s+Google Maps\s*$/
                      );
                      return m ? V.name(m[1]) : "";
                    });
                  })
          ).then(function (n) {
            if (!n) throw { code: "nolink" };
            /* its pin: Google's search for that name, taking the answer with the same ID */
            return call("search_places", {
              textQuery: n + " in " + city + ", " + country,
              pageSize: 5,
              languageCode: "en",
              locationBias: { circle: { center: { latitude: c.lat, longitude: c.lng }, radiusMeters: 50000 } }
            }).then(
              function (sp) {
                var hit = places(sp, c, 150).filter(function (x) {
                  return x.gid === id;
                })[0];
                if (hit) return hit;
                var pin = own.lat != null ? V.pinNear(own.lat, own.lng, c, 150) : null;
                return { n: n, lat: pin ? pin.lat : null, lng: pin ? pin.lng : null, gid: id, d: "" };
              },
              function () {
                return { n: n, lat: null, lng: null, gid: id, d: "" };
              }
            );
          });
        })
        .then(null, function (e) {
          if (e && e.msg) throw e;
          return local(
            e && e.code === "nolink" ? "Google Maps couldn't tell which place that link is for. Type the place's name instead." : sorry(e)
          );
        });
    });
  };

  /* ---------- a day's places as one list in Google Maps ---------- */
  /** @type {Record<string, any>} */
  var lists = {};
  function dayNames(day) {
    var seen = {};
    return (day.slots || [])
      .map(function (x) {
        return x.item && x.item.n;
      })
      .filter(function (n) {
        if (!n || seen[n]) return false;
        return (seen[n] = true);
      })
      .slice(0, 20);
  }
  function listKey(day) {
    return day.country + "|" + day.city + "|" + dayNames(day).join("|");
  }
  /** under "Open the whole route in Google Maps": the day's places as a list to keep there @param {Day} day */
  W.gmListHtml = function (day) {
    if (G.state !== "on" || dayNames(day).length < 2) return "";
    var s = lists[listKey(day)];
    if (s && s.url)
      return (
        '<div class="gm-list">' +
        W.extLink(
          s.url,
          "Open " + (s.found === s.total ? "these " + s.total : s.found + " of these " + s.total) + " places as a list in Google Maps ↗",
          "btn sm quiet"
        ) +
        (s.missing.length ? '<span class="small muted">Google Maps didn\'t find: ' + esc(s.missing.join(", ")) + "</span>" : "") +
        "</div>"
      );
    return (
      '<div class="gm-list"><button type="button" class="btn sm quiet" data-gmlist="' +
      day.n +
      '"' +
      (s && s.busy ? " disabled" : "") +
      ">" +
      (s && s.busy ? "Making the list…" : "Make a Google Maps list of these places") +
      "</button>" +
      (s && s.msg ? '<span class="small muted" role="status">' + esc(s.msg) + "</span>" : "") +
      "</div>"
    );
  };
  function makeList(day) {
    var k = listKey(day),
      names = dayNames(day),
      h = W.homebase(day.country, day.city);
    if ((lists[k] && lists[k].busy) || names.length < 2) return;
    lists[k] = { busy: true };
    W.changed();
    function ask(ns) {
      var input = /** @type {any} */ ({
        queries: ns.map(function (n) {
          return { text: n + ", " + day.city + ", " + day.country };
        })
      });
      if (h && h.lat != null)
        input.locationBias = {
          viewport: { low: { latitude: h.lat - 0.5, longitude: h.lng - 0.6 }, high: { latitude: h.lat + 0.5, longitude: h.lng + 0.6 } }
        };
      return call("resolve_names", input);
    }
    function sure(p, ns) {
      var rs = Array.isArray(p.results) ? p.results : [];
      return ns.filter(function (n, i) {
        return rs[i] && rs[i].confidence === "HIGH" && rs[i].entity && rs[i].entity.place;
      });
    }
    ask(names)
      .then(function (p) {
        var good = sure(p, names);
        if (!good.length) throw { msg: "Google Maps didn't recognise these places by name." };
        /* a list of only the places Google is sure of: one it half-recognised is asked for again without it */
        if (good.length === names.length) return { p: p, good: good };
        return ask(good).then(function (p2) {
          return { p: p2, good: sure(p2, good) };
        });
      })
      .then(function (r) {
        var url = String(r.p.saveToMapsUrl || "");
        if (!/^https:\/\/www\.google\.com\/maps\//.test(url) || url.length > 2000 || !r.good.length)
          throw { msg: "Google Maps didn't give a list this time." };
        lists[k] = {
          url: url,
          found: r.good.length,
          total: names.length,
          missing: names.filter(function (n) {
            return r.good.indexOf(n) < 0;
          })
        };
      })
      .then(null, function (e) {
        lists[k] = { msg: (e && e.msg) || sorry(e) };
      })
      .then(function () {
        W.changed();
      });
  }

  /* ---------- Settings ---------- */
  W.gmCard = function (card) {
    if (W.standalone || window.__WP_OFFLINE) return "";
    var s = G.state,
      y = G.why,
      body =
        s === "on"
          ? '<p class="small"><b>Connected.</b> Requests today from this device: ' +
            ((L.n && L.n[0] === stamp() && L.n[1]) || 0) +
            ".</p>" +
            '<div class="row"><button type="button" class="btn quiet" data-gm="off">Turn off on this device</button></div>'
          : y === "you"
            ? '<p class="small">Turned off on this device.</p><div class="row"><button type="button" class="btn quiet" data-gm="on">Turn on</button></div>'
            : y === "no"
              ? '<p class="small">You said no when Claude asked to use Google Maps here.</p><div class="row"><button type="button" class="btn quiet" data-gm="on">Ask me again</button></div>'
              : s === "idle" || s === "checking"
                ? '<p class="small muted">Looking for your Google Maps connection…</p>'
                : '<p class="small">' +
                  (y === "needs_reauth"
                    ? "Your Google Maps connection needs signing in again: Claude, Settings, Connectors."
                    : y === "blocked_by_policy"
                      ? "Your organization doesn't allow Google Maps here."
                      : "Not connected. Add Google Maps under Connectors in Claude's settings, then open this page again.") +
                  "</p>";
    return card(
      "Google Maps",
      "With your own Google Maps connection in Claude: real walking and transit times between stops (they travel with the trip, so everyone you share it with sees them), the forecast for the days ahead, Google's places in the search, and a day's places as a list in Google Maps. Without a connection the app estimates, as before.",
      body,
      "set-gm"
    );
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement | null} */ (e.target),
      b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-gmlist],[data-gm]")) : null;
    if (!b) return;
    if (b.dataset.gmlist) {
      var P = W.plan(),
        day = P && P.days && P.days[+b.dataset.gmlist - 1];
      if (day) makeList(day);
      return;
    }
    if (b.dataset.gm === "off") {
      L.off = 1;
      off("you");
      G.p = Promise.resolve(false);
      order = [];
    } else {
      delete L.off;
      delete L.no;
      G.p = null;
      G.state = "idle";
      asked = {};
      ready();
    }
    keep();
    W.changed();
  });

  /* look once the first screen is up (looking asks the viewer nothing) */
  setTimeout(ready, 1200);
  W.onData(function () {
    if (G.state === "on" && !warmT) warmT = setTimeout(warm, 2000);
  });
})();
