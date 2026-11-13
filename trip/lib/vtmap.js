/* Waypoint detailed map, part 2 (second script): the MapLibre engine drawing real vector map data (streets and their
   names, buildings, landmarks, stations, parks, water) from map packs for the trip's cities. Packs live in the app's
   asset store (built nightly, listed in the database under maps/<city>, in parts the store accepts); a few older ones
   ship as files. Which city has one is lib/vtindex.js (first script); the state they share is W.vt.
   If anything is missing or blocked on this device, the app keeps its simpler built-in map.
   Map data © OpenMapTiles © OpenStreetMap contributors (ODbL), tiles via OpenFreeMap. */
(function () {
  "use strict";
  var W = window.W,
    ML = null;
  var S = W.vt;
  /* ---------- packs: one file per city with all its tiles (gzipped), read once ---------- */
  function gunzip(u8) {
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  /* basE91 text (tools/pack2json.py, "enc":"b91") -> `len` bytes: 13 bits in 2 characters, so a part is a bit smaller than
     the same bytes in base64 */
  var B91 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~'",
    B91DEC = null;
  function b91(text, len) {
    if (!B91DEC) {
      B91DEC = new Uint8Array(256);
      for (var k = 0; k < 91; k++) B91DEC[B91.charCodeAt(k)] = k;
    }
    var out = new Uint8Array(len),
      v = -1,
      b = 0,
      n = 0,
      p = 0;
    for (var i = 0; i < text.length; i++) {
      var c = B91DEC[text.charCodeAt(i) & 255];
      if (v < 0) v = c;
      else {
        v += c * 91;
        b |= v << n;
        n += (v & 8191) > 88 ? 13 : 14;
        do {
          out[p++] = b & 255;
          b >>= 8;
          n -= 8;
        } while (n > 7);
        v = -1;
      }
    }
    if (v >= 0) out[p++] = (b | (v << n)) & 255;
    return out;
  }
  /* an asset pack: JSON parts holding the pack's bytes in base91 (or, older, base64), joined in order (the main-thread
     way, used when the page may not start its own worker) */
  function readParts(urls) {
    return Promise.all(
      urls.map(function (u) {
        return fetch(u).then(function (r) {
          if (!r.ok) throw new Error("missing part " + u);
          return r.json();
        });
      })
    ).then(function (parts) {
      var bufs = parts.map(function (p) {
        if (typeof p.d === "string") return b91(p.d, p.n);
        var bin = atob(p.b64 || ""),
          a = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        return a;
      });
      var n = bufs.reduce(function (a, b) {
          return a + b.length;
        }, 0),
        all = new Uint8Array(n),
        o = 0;
      bufs.forEach(function (b) {
        all.set(b, o);
        o += b.length;
      });
      return parsePack(all);
    });
  }
  W.vtLoadTest = function (k, v, src) {
    return load(k, v, src);
  };
  /* (for the tests: a tile out of a pack that may still be arriving, and the wait for the whole pack) */
  W.vtPieceTest = function (p, key) {
    return piece(p, key);
  };
  W.vtReadyTest = function (p) {
    return ready(p, p.len || 0);
  };
  W.vtWorkerUsed = function () {
    return !!pw;
  };
  function parsePack(u8) {
    /* packs travel inside a WebAssembly file's custom section (a file type the app host serves untouched): unwrap it */
    if (u8[0] === 0 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d) {
      var i = 9,
        leb = function () {
          var v = 0,
            sh = 0,
            c;
          do {
            c = u8[i++];
            v += (c & 0x7f) * Math.pow(2, sh);
            sh += 7;
          } while (c & 0x80);
          return v;
        };
      leb();
      var nl = leb();
      i += nl;
      u8 = u8.subarray(i);
    }
    var magic = new TextDecoder().decode(u8.subarray(0, 6));
    if (magic !== "WPVT1\n") throw new Error("bad pack");
    var n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(6),
      hdr = JSON.parse(new TextDecoder().decode(u8.subarray(10, 10 + n)));
    return { hdr: hdr, body: u8.subarray(10 + n) };
  }
  function readPack(url) {
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("missing " + url);
        return r.arrayBuffer();
      })
      .then(function (buf) {
        return parsePack(new Uint8Array(buf));
      });
  }

  /* The pack worker (vt/packworker.js) downloads and decodes packs off the main thread and keeps them in IndexedDB, so a
     city's map costs one download ever and never freezes the screen. If the page may not start it, packs are read here. */
  var pw = null,
    pwP = null,
    pwJobs = {},
    pwId = 0;
  function packWorker() {
    if (pwP) return pwP;
    var abs = function (u) {
      return new URL(u, location.href).href;
    };
    function start(url) {
      return new Promise(function (ok) {
        var w,
          t = setTimeout(function () {
            fail();
          }, 3000);
        function fail() {
          clearTimeout(t);
          try {
            w && w.terminate();
          } catch (e) {}
          ok(null);
        }
        try {
          w = new Worker(url);
        } catch (e) {
          return fail();
        }
        w.onerror = fail;
        w.onmessage = function (ev) {
          if (ev.data && ev.data.pong) {
            clearTimeout(t);
            w.onmessage = onMsg;
            w.onerror = function () {};
            ok(w);
          }
        };
        w.postMessage({ ping: 1 });
      });
    }
    pwP = (window.Worker && window.indexedDB ? start(abs("vt/packworker.js")) : Promise.resolve(null))
      .then(function (w) {
        if (w) return w;
        return fetch("vt/packworker.js")
          .then(function (r) {
            return r.text();
          })
          .then(
            function (code) {
              return start(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
            },
            function () {
              return null;
            }
          );
      })
      .then(function (w) {
        pw = w;
        return w;
      });
    return pwP;
  }
  function onMsg(ev) {
    var m = ev.data || {},
      job = pwJobs[m.id];
    if (!job) return;
    if (m.part) {
      /* a pack read as it arrives: the first piece makes the pack (its header, an empty body of the right size), the
         rest fill the body in; whoever needs a tile waits until its bytes are in (see `ready`) */
      var pk = job.pack;
      if (!pk) {
        pk = job.pack = { hdr: m.hdr, body: new Uint8Array(m.len), have: 0, len: m.len, waits: [], failed: null, cached: false };
        job.ok(pk);
      } else {
        pk.body.set(new Uint8Array(m.add), m.at);
        pk.have = m.at + m.add.byteLength;
        flush(pk);
      }
      return;
    }
    delete pwJobs[m.id];
    if (m.end) {
      job.pack.have = job.pack.len;
      flush(job.pack);
    } else if (m.error) {
      var err = new Error(m.error);
      if (job.pack) {
        job.pack.failed = err;
        flush(job.pack);
        if (job.pack.drop) job.pack.drop();
      } else job.no(err);
    } else job.ok({ hdr: m.hdr, body: new Uint8Array(m.body), cached: !!m.cached });
  }
  /* a pack that is still arriving: `have` bytes of its body are in. Calls the waiting tiles whose bytes are all in. */
  function flush(pk) {
    var keep = [];
    pk.waits.forEach(function (w) {
      if (pk.failed) w.no(pk.failed);
      else if (pk.have >= w.end) w.ok();
      else keep.push(w);
    });
    pk.waits = keep;
  }
  /* resolves when the pack's body holds bytes up to `end` (at once for a pack that arrived whole) */
  function ready(pk, end) {
    if (pk.have === undefined || pk.have >= end) return Promise.resolve();
    if (pk.failed) return Promise.reject(pk.failed);
    return new Promise(function (ok, no) {
      pk.waits.push({ end: end, ok: ok, no: no });
    });
  }
  /* a pack by key: {urls} for asset parts or {url} for one file; `ver` says when a cached copy is stale */
  function load(key, ver, src) {
    return packWorker().then(function (w) {
      if (!w) return src.urls ? readParts(src.urls) : readPack(src.url);
      return new Promise(function (ok, no) {
        var id = ++pwId;
        pwJobs[id] = { ok: ok, no: no, pack: null };
        var abs = function (u) {
          return new URL(u, location.href).href;
        }; /* the worker resolves paths against its own file */
        w.postMessage({ id: id, key: key, ver: ver, urls: src.urls && src.urls.map(abs), url: src.url && abs(src.url), lay: src.lay });
      });
    });
  }
  function pack(slug) {
    if (S.packs[slug]) return S.packs[slug];
    var e = S.idx && S.idx[slug];
    var p =
      e && e.parts
        ? load("pack|" + slug, e.parts.join(","), { urls: e.parts, lay: e.lay })
        : load("pack|" + slug, "file", { url: "vt/" + slug + ".wasm" });
    var q = (S.packs[slug] = p.then(
      function (pk) {
        /* if the rest of the pack fails to arrive, the next request starts over */
        pk.drop = function () {
          if (S.packs[slug] === q) delete S.packs[slug];
        };
        return pk;
      },
      function (err) {
        delete S.packs[slug];
        throw err;
      }
    ));
    return q;
  }
  /* glyphs: the letters nearly every map needs come in one small file; extended Latin, Greek and Cyrillic in another,
     fetched only when a label needs them */
  var GLYPH_V = "2";
  function glyphs(rangeStart) {
    var ext = rangeStart >= 256 && rangeStart < 8192,
      k = ext ? "glyphsExt" : "glyphs";
    return (
      S[k] ||
      (S[k] = load("glyphs|" + (ext ? "ext" : "core"), GLYPH_V, { url: ext ? "vt/glyphs-ext.wasm" : "vt/glyphs.wasm" }).then(
        null,
        function (err) {
          delete S[k];
          throw err;
        }
      ))
    );
  }
  /* for offline saving: fetch a city's pack and the everyday glyphs now, so the worker's cache has them */
  W.vtWarm = function (slug) {
    return Promise.all([pack(slug), glyphs(0)]).then(function (r) {
      return ready(r[0], r[0].len || 0).then(function () {
        return true;
      });
    });
  };
  /* "nothing here" (a tile or a letter range the pack doesn't hold) is a NEW empty buffer every time: the engine hands
     each answer over to its worker, which empties the buffer on this side, so one shared buffer worked once and then made
     every later "nothing here" fail ("ArrayBuffer is already detached"), and a tile whose names needed such a letter
     range failed with it: the blank boxes on the map. */
  function none() {
    return new ArrayBuffer(0);
  }
  function piece(p, key) {
    var e = p.hdr.t[key];
    if (!e) return Promise.resolve(none());
    return ready(p, e[0] + e[1]).then(function () {
      return gunzip(p.body.subarray(e[0], e[0] + e[1]));
    });
  }

  /* ---------- the engine: loaded on first use, with a worker this page is allowed to start ---------- */
  function canWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  }
  function tryWorker(url) {
    return new Promise(function (ok) {
      var w,
        t = setTimeout(function () {
          done(false);
        }, 2500);
      function done(v) {
        clearTimeout(t);
        try {
          w && w.terminate();
        } catch (e) {}
        ok(v);
      }
      try {
        w = new Worker(url);
      } catch (e) {
        return done(false);
      }
      w.onmessage = function () {
        done(true);
      };
      w.onerror = function () {
        done(false);
      };
    });
  }
  function engine() {
    if (S.engineP) return S.engineP;
    S.engine = "loading";
    S.engineP = (function () {
      if (!canWebGL() || !window.DecompressionStream || !window.Worker) return Promise.reject(new Error("no webgl"));
      var abs = function (u) {
        return new URL(u, location.href).href;
      };
      /* the worker: the app's own file if allowed, else the same code started from memory */
      return tryWorker(abs("vt/ping.js"))
        .then(function (own) {
          if (own) return abs("vt/maplibre-gl-csp-worker.js");
          return tryWorker(URL.createObjectURL(new Blob(['postMessage("ok")'], { type: "text/javascript" }))).then(function (blobOk) {
            if (!blobOk) throw new Error("workers blocked");
            return fetch("vt/maplibre-gl-csp-worker.js")
              .then(function (r) {
                return r.text();
              })
              .then(function (code) {
                return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
              });
          });
        })
        .then(function (workerUrl) {
          return W.loadScript("vt/maplibre-gl-csp.js").then(function () {
            ML = window.maplibregl;
            if (!ML) throw new Error("engine missing");
            ML.setWorkerUrl(workerUrl);
            ML.addProtocol("wpvt", function (params) {
              var m = /^wpvt:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
              if (!m) return Promise.resolve({ data: none() });
              var key = m[2] + "/" + m[3] + "/" + m[4],
                slug = m[1];
              /* a tile that fails to come out of its pack is tried twice more before the map is told */
              function once() {
                return pack(slug).then(function (p) {
                  return piece(p, key);
                });
              }
              function wait(ms) {
                return new Promise(function (r) {
                  setTimeout(r, ms);
                });
              }
              return once()
                .then(null, function () {
                  return wait(150).then(once);
                })
                .then(null, function () {
                  return wait(600).then(once);
                })
                .then(
                  function (d) {
                    return { data: d };
                  },
                  function (e) {
                    mapErr("tile " + key + ": " + ((e && e.message) || e));
                    throw e;
                  }
                );
            });
            ML.addProtocol("wpgl", function (params) {
              var m = /^wpgl:\/\/([^/]+)\/([0-9]+-[0-9]+)/.exec(params.url),
                stack = m ? decodeURIComponent(m[1]).split(",")[0] : "";
              if (!m) return Promise.resolve({ data: none() });
              var range = m[2];
              return glyphs(parseInt(range, 10))
                .then(function (g) {
                  return piece(g, stack + "/" + range).then(function (d) {
                    return d.byteLength ? d : piece(g, "Noto Sans Regular/" + range);
                  });
                })
                .then(function (d) {
                  return { data: d };
                });
            });
          });
        });
    })().then(
      function () {
        S.engine = "ready";
        W.redraw(); /* (the street map coming or going changes the screen, not the plan) */
      },
      function (e) {
        S.engine = "off";
        S.why = String((e && e.message) || e);
        W.redraw(); /* (the street map coming or going changes the screen, not the plan) */
      }
    );
    return S.engineP;
  }

  /* ---------- the look: warm paper land, clear white streets, readable names (and a dark version) ---------- */
  /* (v156: quiet colours, as a printed city map: pale streets, soft water, labels in stone) */
  function palette() {
    var dark =
      document.documentElement.getAttribute("data-theme") === "dark" ||
      (document.documentElement.getAttribute("data-theme") !== "light" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    return dark
      ? {
          dark: true,
          land: "#1B1917",
          water: "#1E272C",
          waterLine: "#24313A",
          park: "#1F2620",
          wood: "#1E251F",
          grass: "#20271F",
          sand: "#2A2620",
          residential: "#1E1C1A",
          commercial: "#211E1B",
          industrial: "#1F1D1C",
          cemetery: "#1F2620",
          hospital: "#2A2020",
          school: "#25221D",
          building: "#262320",
          buildingLine: "#2F2B27",
          roadCase: "#141210",
          road: "#36322E",
          major: "#423D38",
          majorCase: "#141210",
          motorway: "#4D463F",
          motorwayCase: "#141210",
          rail: "#4A4440",
          path: "#3A3530",
          ferry: "#3B5563",
          boundary: "#4F4843",
          label: "#C9C3BC",
          halo: "#161412",
          place: "#D6D0C9",
          waterLabel: "#7F9BAA",
          parkLabel: "#8FA584",
          poi: "#B5AEA7",
          poiDot: "#8A847E",
          station: "#A5B4FC"
        }
      : {
          dark: false,
          land: "#F5F3F0",
          water: "#D4DADC",
          waterLine: "#C6D0D4",
          park: "#E2E9DC",
          wood: "#DCE5D4",
          grass: "#E6ECDF",
          sand: "#EFEADF",
          residential: "#F1EFEB",
          commercial: "#F2EEEA",
          industrial: "#EEECE9",
          cemetery: "#E2E9DC",
          hospital: "#F3E9E7",
          school: "#F1EDE4",
          building: "#E9E5E0",
          buildingLine: "#DEDAD4",
          roadCase: "#E3DFD9",
          road: "#FFFFFF",
          major: "#FFFFFF",
          majorCase: "#DAD5CE",
          motorway: "#FBF8F3",
          motorwayCase: "#D3CCC3",
          rail: "#D1CCC6",
          path: "#DAD5CE",
          ferry: "#AFC2CC",
          boundary: "#C9C2BC",
          label: "#6B6560",
          halo: "#FFFFFF",
          place: "#57534E",
          waterLabel: "#7D96A3",
          parkLabel: "#7A9070",
          poi: "#8A847E",
          poiDot: "#A8A29E",
          station: "#4338CA"
        };
  }
  var F_REG = ["Noto Sans Regular"],
    F_BOLD = ["Noto Sans Bold"],
    F_IT = ["Noto Sans Italic"];
  function z(stops) {
    var e = ["interpolate", ["exponential", 1.45], ["zoom"]];
    stops.forEach(function (s) {
      e.push(s[0], s[1]);
    });
    return e;
  }
  function cls(list) {
    return ["match", ["get", "class"], list, true, false];
  }

  function layersFor(src, C, lo) {
    var L = [],
      mz = lo ? {} : { minzoom: 13 };
    function add(o) {
      o.source = src;
      if (lo && o.labels) o.maxzoom = 13;
      if (!lo && (o.minzoom || 0) < 13) o.minzoom = 13;
      delete o.labels;
      L.push(o);
    }
    var p = src + "-";
    add({
      id: p + "landcover",
      type: "fill",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood",
          C.wood,
          "forest",
          C.wood,
          "grass",
          C.grass,
          "sand",
          C.sand,
          "wetland",
          C.grass,
          "farmland",
          C.land,
          C.grass
        ],
        "fill-opacity": ["match", ["get", "class"], "farmland", 0, "ice", 0.6, 0.85]
      }
    });
    add({
      id: p + "landuse",
      type: "fill",
      "source-layer": "landuse",
      minzoom: 10,
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "residential",
          C.residential,
          "suburb",
          C.residential,
          "neighbourhood",
          C.residential,
          "commercial",
          C.commercial,
          "retail",
          C.commercial,
          "industrial",
          C.industrial,
          "cemetery",
          C.cemetery,
          "hospital",
          C.hospital,
          "school",
          C.school,
          "university",
          C.school,
          "college",
          C.school,
          "stadium",
          C.park,
          "pitch",
          C.park,
          "playground",
          C.park,
          C.residential
        ],
        "fill-opacity": 0.9
      }
    });
    add({
      id: p + "park",
      type: "fill",
      "source-layer": "park",
      paint: { "fill-color": C.park, "fill-outline-color": C.dark ? "#3B5340" : "#B5D59C" }
    });
    add({
      id: p + "water",
      type: "fill",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": C.water }
    });
    add({
      id: p + "waterway",
      type: "line",
      "source-layer": "waterway",
      paint: {
        "line-color": C.waterLine,
        "line-width": z([
          [10, 0.6],
          [14, 1.6],
          [18, 6]
        ])
      }
    });
    if (!lo)
      add({
        id: p + "building",
        type: "fill",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-color": C.building,
          "fill-outline-color": C.buildingLine,
          "fill-opacity": z([
            [14, 0.55],
            [16, 1]
          ])
        }
      });
    /* streets: soft casing under a clean fill, sized by importance */
    var MOTOR = ["motorway", "trunk"],
      MAJOR = ["primary"],
      MID = ["secondary", "tertiary"],
      MINOR = ["minor", "service", "track", "raceway"];
    var notTunnel = ["!=", ["get", "brunnel"], "tunnel"];
    function road(id, list, color, casing, w, extra) {
      var f = ["all", ["==", ["geometry-type"], "LineString"], cls(list)].concat(extra || []);
      add({
        id: p + id + "-case",
        type: "line",
        "source-layer": "transportation",
        filter: f,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": casing,
          "line-width": z(
            w.map(function (s) {
              return [s[0], s[1] * 1.0 + 1.6];
            })
          )
        }
      });
      add({
        id: p + id,
        type: "line",
        "source-layer": "transportation",
        filter: f,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": z(w) }
      });
    }
    add({
      id: p + "path",
      type: "line",
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", cls(["path"]), notTunnel],
      paint: {
        "line-color": C.path,
        "line-width": z([
          [14, 0.8],
          [17, 1.8],
          [19, 3.5]
        ]),
        "line-dasharray": [2, 1.4]
      }
    });
    add({
      id: p + "pedestrian",
      type: "line",
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", cls(["pedestrian"]), notTunnel],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": C.road,
        "line-width": z([
          [14, 1.4],
          [17, 5],
          [19, 12]
        ])
      }
    });
    road(
      "minor",
      MINOR,
      C.road,
      C.roadCase,
      [
        [12, 0.4],
        [14, 2.2],
        [16, 6],
        [18, 18]
      ],
      [notTunnel]
    );
    road(
      "mid",
      MID,
      C.road,
      C.roadCase,
      [
        [9, 0.5],
        [12, 1.4],
        [14, 3.6],
        [16, 8],
        [18, 22]
      ],
      [notTunnel]
    );
    road(
      "major",
      MAJOR,
      C.major,
      C.majorCase,
      [
        [7, 0.6],
        [10, 1.4],
        [13, 3.4],
        [15, 7],
        [18, 24]
      ],
      [notTunnel]
    );
    road(
      "motor",
      MOTOR,
      C.motorway,
      C.motorwayCase,
      [
        [5, 0.6],
        [9, 1.6],
        [13, 4],
        [15, 8],
        [18, 26]
      ],
      [notTunnel]
    );
    add({
      id: p + "rail",
      type: "line",
      "source-layer": "transportation",
      filter: ["all", cls(["rail", "transit"]), notTunnel],
      paint: {
        "line-color": C.rail,
        "line-width": z([
          [10, 0.6],
          [14, 1.4],
          [18, 3]
        ]),
        "line-dasharray": [3, 2]
      }
    });
    add({
      id: p + "ferry",
      type: "line",
      "source-layer": "transportation",
      filter: cls(["ferry"]),
      paint: { "line-color": C.ferry, "line-width": 1.2, "line-dasharray": [3, 3] }
    });
    if (lo)
      add({
        id: p + "boundary",
        type: "line",
        "source-layer": "boundary",
        filter: ["==", ["get", "admin_level"], 2],
        paint: { "line-color": C.boundary, "line-width": 1.2, "line-dasharray": [3, 2] }
      });
    /* names */
    var name = ["coalesce", ["get", "name"], ""];
    var halo = { "text-halo-color": C.halo, "text-halo-width": 1.6, "text-halo-blur": 0.4 };
    ["Point", "LineString"].forEach(function (g) {
      add({
        labels: 1,
        id: p + "water-name-" + g,
        type: "symbol",
        "source-layer": "water_name",
        filter: ["==", ["geometry-type"], g],
        layout: {
          "text-field": name,
          "text-font": F_IT,
          "text-size": z([
            [10, 11],
            [16, 14]
          ]),
          "symbol-placement": g === "Point" ? "point" : "line",
          "text-letter-spacing": 0.08,
          "text-max-width": 8
        },
        paint: Object.assign({ "text-color": C.waterLabel }, halo)
      });
    });
    add({
      labels: 1,
      id: p + "waterway-name",
      type: "symbol",
      "source-layer": "waterway",
      minzoom: 12,
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["has", "name"]],
      layout: { "text-field": name, "text-font": F_IT, "text-size": 11.5, "symbol-placement": "line", "text-letter-spacing": 0.06 },
      paint: Object.assign({ "text-color": C.waterLabel }, halo)
    });
    add({
      labels: 1,
      id: p + "road-name",
      type: "symbol",
      "source-layer": "transportation_name",
      minzoom: lo ? 11 : 13,
      filter: lo ? cls(["motorway", "trunk", "primary", "secondary"]) : ["all"],
      layout: {
        "text-field": name,
        "text-font": F_REG,
        "text-size": z([
          [13, 10.5],
          [16, 12.5],
          [18, 14]
        ]),
        "symbol-placement": "line",
        "symbol-spacing": 260,
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "viewport",
        "text-letter-spacing": 0.02,
        "text-max-angle": 35
      },
      paint: Object.assign({ "text-color": C.label }, halo)
    });
    add({
      labels: 1,
      id: p + "park-name",
      type: "symbol",
      "source-layer": "park",
      minzoom: lo ? 12 : 14,
      layout: { "text-field": name, "text-font": F_IT, "text-size": 11.5, "text-max-width": 7 },
      paint: Object.assign({ "text-color": C.parkLabel }, halo)
    });
    if (!lo) {
      var station = cls(["railway", "bus", "ferry_terminal", "aerialway"]);
      /* notable landmarks only, with names short enough to read at a glance */
      var notable = [
        "all",
        ["<=", ["coalesce", ["get", "rank"], 99], 22],
        ["!", cls(["library", "information", "town_hall"])],
        ["<=", ["length", ["coalesce", ["get", "name"], ""]], 32]
      ];
      add({
        id: p + "poi-dot",
        type: "circle",
        "source-layer": "poi",
        minzoom: 14,
        filter: ["any", station, notable],
        paint: {
          "circle-radius": ["case", station, 4.2, 3.2],
          "circle-color": ["case", station, C.station, C.poiDot],
          "circle-stroke-color": C.halo,
          "circle-stroke-width": 1.4
        }
      });
      add({
        id: p + "poi-name",
        type: "symbol",
        "source-layer": "poi",
        minzoom: 14,
        filter: ["any", station, notable],
        layout: {
          "text-field": name,
          "text-font": F_REG,
          "text-size": z([
            [14, 10.5],
            [17, 12.5]
          ]),
          "text-anchor": "left",
          "text-offset": [0.7, 0],
          "text-max-width": 9,
          "text-optional": true,
          "symbol-sort-key": ["coalesce", ["get", "rank"], 99]
        },
        paint: Object.assign({ "text-color": ["case", station, C.station, C.poi] }, halo)
      });
    }
    add({
      labels: 1,
      id: p + "place-small",
      type: "symbol",
      "source-layer": "place",
      filter: cls(["suburb", "quarter", "neighbourhood", "hamlet"]),
      minzoom: lo ? 11 : 13,
      layout: {
        "text-field": ["upcase", name],
        "text-font": F_BOLD,
        "text-size": z([
          [11, 9.5],
          [15, 11.5]
        ]),
        "text-letter-spacing": 0.12,
        "text-max-width": 8
      },
      paint: Object.assign({ "text-color": C.place, "text-opacity": 0.8 }, halo)
    });
    add({
      labels: 1,
      id: p + "place-town",
      type: "symbol",
      "source-layer": "place",
      filter: cls(["city", "town", "village"]),
      layout: {
        "text-field": name,
        "text-font": F_BOLD,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          ["match", ["get", "class"], "city", 13, "town", 11, 10],
          13,
          ["match", ["get", "class"], "city", 17, "town", 15, 13]
        ],
        "text-max-width": 8
      },
      paint: Object.assign({ "text-color": C.label }, halo)
    });
    return L;
  }

  function tileBox(z, x, y) {
    var n = Math.pow(2, z),
      lng0 = (x / n) * 360 - 180,
      lng1 = ((x + 1) / n) * 360 - 180;
    function lat(t) {
      return (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
    }
    return [
      [lng0, lat(y)],
      [lng1, lat(y)],
      [lng1, lat(y + 1)],
      [lng0, lat(y + 1)],
      [lng0, lat(y)]
    ];
  }
  /* The cover (land colour, under the detailed map) hides the coarse map where a detailed tile is on screen, so streets
     never double up. It covers only the detailed tiles that have actually loaded: one that failed (or hasn't come yet)
     leaves the coarse map showing there, never an empty box. (It used to cover every tile the pack lists, so a single
     detailed tile that failed on a phone left a blank square until a zoom loaded others.) */
  var NONE = { type: "FeatureCollection", features: [] };
  function mask(keys, zl) {
    return {
      type: "FeatureCollection",
      features: keys
        .filter(function (k) {
          return +k.split("/")[0] === zl;
        })
        .map(function (k) {
          var q = k.split("/").map(Number);
          return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [tileBox(q[0], q[1], q[2])] } };
        })
    };
  }
  function coverSoon() {
    if (S.coverT) return;
    S.coverT = requestAnimationFrame(function () {
      S.coverT = 0;
      if (!S.map) return;
      var keys = Object.keys(S.got || {});
      [13, 14].forEach(function (zl) {
        var src = S.map.getSource("mask" + zl);
        if (src && src.setData) src.setData(mask(keys, zl));
      });
    });
  }
  /* map trouble goes to the app's error log (once per kind of message), so the evening error report says what failed */
  var mapSeen = {};
  function mapErr(msg) {
    var kind = String(msg)
      .replace(/\d+\/\d+\/\d+/g, "z/x/y")
      .slice(0, 160);
    if (mapSeen[kind]) return;
    mapSeen[kind] = 1;
    if (window.console) console.warn("[waypoint map]", msg);
    if (W.logError) W.logError("map: " + String(msg).slice(0, 200), "vtmap");
  }
  /** @param {string} slug @param {any} hdr @param {Record<string, any>} [over] colours to use instead of the theme's */
  function style(slug, hdr, over) {
    var C = Object.assign(palette(), over || {}),
      url = "wpvt://" + slug + "/{z}/{x}/{y}";
    var lo = layersFor("lo", C, true),
      hi = layersFor("hi", C, false);
    function shapes(L) {
      return L.filter(function (l) {
        return l.type !== "symbol";
      });
    }
    function names(L) {
      return L.filter(function (l) {
        return l.type === "symbol";
      });
    }
    /* order: coarse map, a cover where detailed tiles exist (so streets never double up), detailed map, then all names on top */
    /** @type {any[]} */ var layers = /** @type {any[]} */ ([{ id: "bg", type: "background", paint: { "background-color": C.land } }])
      .concat(shapes(lo))
      .concat([
        {
          id: "mask13",
          type: "fill",
          source: "mask13",
          minzoom: 13,
          maxzoom: 14,
          paint: { "fill-color": C.land, "fill-antialias": false }
        },
        { id: "mask14", type: "fill", source: "mask14", minzoom: 14, paint: { "fill-color": C.land, "fill-antialias": false } }
      ])
      .concat(shapes(hi))
      .concat(names(lo))
      .concat(names(hi));
    var b = hdr.b;
    return {
      version: 8,
      glyphs: "wpgl://{fontstack}/{range}",
      sources: {
        lo: { type: "vector", tiles: [url], minzoom: hdr.zmin || 8, maxzoom: 12, bounds: b },
        hi: { type: "vector", tiles: [url], minzoom: 13, maxzoom: 14, bounds: b },
        mask13: { type: "geojson", data: NONE },
        mask14: { type: "geojson", data: NONE }
      },
      layers: layers
    };
  }

  /* ---------- pins ---------- */
  /** The stops a pin stands for. A stop's key holds its city's name, and a city's name can have a space in it ("Naxos
   *  Town"), so the list on the pin is one key per line: split on spaces, every pin in such a city shared the pieces
   *  "Town|1|am" and the like, and pointing at one stop lit them all. @param {Element | null} el */
  W.pinKeys = function (el) {
    return ((el && el.getAttribute("data-keys")) || "").split("\n").filter(Boolean);
  };
  /** one marker: the lodging, or one or more stops that sit on the same spot at this zoom ("1·2·4") @param {any} g */
  function pinEl(g) {
    /** @type {HTMLElement} */ var el = document.createElement("div");
    if (g.home) {
      el.className = "vt-pin home";
      el.setAttribute("data-keys", "home"); /* (the desktop workspace lights it with the first hop of the day) */
      el.innerHTML =
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5V13h-3.5V9.5h-4V13H2.5z" fill="currentColor"/></svg><i>A</i>';
      el.setAttribute("aria-label", "A. Where you're staying");
      return el;
    }
    /* lettered as Google Maps letters the day's route: A is where you're staying, B the first stop (W.stopTag) */
    var ps = g.items,
      many = ps.length > 1,
      nums = ps
        .map(function (p) {
          return W.stopTag(p.num);
        })
        .join("·");
    /* one stop: the pin opens it in Google Maps (reviews, photos, hours, directions) */
    if (!many && S.city) {
      var a = document.createElement("a");
      a.href = W.gmapsPlace(ps[0], S.city);
      a.target = "_blank";
      a.rel = "noopener";
      el = a;
    }
    el.className = "vt-pin" + (many ? " many" : ps[0].food ? " food" : "");
    /* (which stops this pin stands for: the desktop workspace lights a pin and its card up together) */
    el.setAttribute(
      "data-keys",
      ps
        .map(function (p) {
          return p.key || "";
        })
        .join("\n")
    );
    /* (one stop: the icon for what it is, its letter as a small tag, as the day's list marks it; several: their letters) */
    el.innerHTML =
      (many
        ? "<b>" + nums + "</b>"
        : '<b class="ki">' + W.icon(W.kindIcon(ps[0].it || ps[0], ps[0].food, ps[0].slot), 2.1) + '<i class="nb">' + nums + "</i></b>") +
      "<span>" +
      W.esc(ps[0].n) +
      (many ? " +" + (ps.length - 1) : "") +
      "</span>";
    el.setAttribute(
      "aria-label",
      ps
        .map(function (p) {
          return W.stopTag(p.num) + ". " + p.n;
        })
        .join(", ")
    );
    el.title = ps
      .map(function (p) {
        return W.stopTag(p.num) + ". " + p.n;
      })
      .join("\n");
    return el;
  }
  /* Stops closer together on screen than a pin is wide share one marker at their common spot, numbers in a row, so
     none hides another (a café inside the market, dinner at the sunset spot). Regrouped whenever the zoom changes. */
  /** stops grouped by where they fall on screen: any two closer than minPx share a group, placed at their average
      @param {any[]} pts @param {(p: any) => {x: number, y: number}} project @param {number} [minPx] */
  W.pinGroups = function (pts, project, minPx) {
    var groups = [],
      m = minPx || 24;
    pts.forEach(function (p) {
      var at = project(p);
      var g = groups.filter(function (g) {
        return Math.hypot(g.x - at.x, g.y - at.y) < m;
      })[0];
      if (g) {
        g.items.push(p);
        g.x = (g.x * (g.items.length - 1) + at.x) / g.items.length;
        g.y = (g.y * (g.items.length - 1) + at.y) / g.items.length;
      } else groups.push({ x: at.x, y: at.y, items: [p] });
    });
    return groups;
  };
  /* In the desktop workspace's pane a pin never moves: each stop keeps its own pin on its own spot at every zoom (only
     stops on the very same spot share one), and where pins crowd, the later ones' names step aside instead (declutter).
     On a phone's small map, stops close together on screen share a pin, regrouped as the zoom changes. */
  function fixedPins() {
    return !!(S.el && S.el.closest && S.el.closest(".ws-canvas"));
  }
  /** stops on the same spot (to about 10 m), in order, each group at its first stop's spot @param {any[]} pts */
  function spotGroups(pts) {
    var at = /** @type {Record<string, any>} */ ({}),
      groups = /** @type {any[]} */ ([]);
    pts.forEach(function (p) {
      var k = (+p.lat).toFixed(4) + "," + (+p.lng).toFixed(4);
      if (at[k]) at[k].items.push(p);
      else groups.push((at[k] = { ll: [p.lng, p.lat], items: [p] }));
    });
    return groups;
  }
  /** the pane's pin names, kept clear of each other: a name that would cover a pin or a name before it is hidden
      (it shows when the pin is pointed at) */
  function declutter() {
    if (!fixedPins() || !S.pinMarkers) return;
    var els = S.pinMarkers.map(function (m) {
        return m.getElement();
      }),
      taken = /** @type {DOMRect[]} */ ([]);
    els.forEach(function (el) {
      el.classList.remove("nolabel");
    });
    var hit = function (r) {
      return taken.some(function (q) {
        return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
      });
    };
    els.forEach(function (el) {
      var dot = el.querySelector("b");
      if (dot) taken.push(dot.getBoundingClientRect());
    });
    els.forEach(function (el) {
      var name = el.querySelector("span");
      if (!name) return;
      var r = name.getBoundingClientRect();
      if (hit(r)) el.classList.add("nolabel");
      else taken.push(r);
    });
  }
  function groupPins() {
    if (!S.map || !S.pinPts) return;
    if (fixedPins()) {
      if (S.groupSig !== "fixed") {
        S.groupSig = "fixed";
        (S.pinMarkers || []).forEach(function (m) {
          m.remove();
        });
        S.pinMarkers = spotGroups(S.pinPts).map(function (g) {
          return new ML.Marker({ element: pinEl(g), anchor: "left", offset: [g.items.length > 1 ? -13 : -15, 0] })
            .setLngLat(g.ll)
            .addTo(S.map);
        });
        if (S.onPins) S.onPins();
      }
      declutter();
      return;
    }
    var groups = W.pinGroups(S.pinPts, function (p) {
      return S.map.project([p.lng, p.lat]);
    });
    var sig = groups
      .map(function (g) {
        return g.items
          .map(function (p) {
            return p.num;
          })
          .join(".");
      })
      .join("|");
    if (sig === S.groupSig) return;
    S.groupSig = sig;
    S.pinMarkers.forEach(function (m) {
      m.remove();
    });
    S.pinMarkers = [];
    groups.forEach(function (g) {
      var ll = S.map.unproject([g.x, g.y]);
      var el = pinEl(g);
      S.pinMarkers.push(
        new ML.Marker({ element: el, anchor: "left", offset: [g.items.length > 1 ? -13 : -15, 0] }).setLngLat(ll).addTo(S.map)
      );
    });
    if (S.onPins) S.onPins(); /* (new pin elements: the desktop workspace marks the lit and the open one again) */
  }
  function setPins(pts, home) {
    S.markers.forEach(function (m) {
      m.remove();
    });
    S.markers = [];
    (S.pinMarkers || []).forEach(function (m) {
      m.remove();
    });
    S.pinMarkers = [];
    S.groupSig = "";
    var all = pts.filter(function (p) {
      return p.lat != null && !p.gpin;
    }); /* Google's pins stay on Google's maps */
    if (home && home.lat != null)
      S.markers.push(new ML.Marker({ element: pinEl({ home: 1 }) }).setLngLat([home.lng, home.lat]).addTo(S.map));
    S.pinPts = all;
    groupPins();
    /* (no line between the stops: a straight line from pin to pin is a flight path, not the way you would walk or
       ride; the lettered pins say the order, and the list gives each hop's real way and time) */
  }
  /* ---------- for the desktop workspace (lib/deskmap.js) ---------- */
  /** small unnumbered pins for places not on the day (Explore's ideas): [{n, lat, lng, food}], at most 60; [] clears */
  W.vtIdeas = function (list) {
    if (!S.map || !S.ready) return false;
    var want = (list || []).slice(0, 60).filter(function (p) {
        return p.lat != null;
      }),
      sig = want
        .map(function (p) {
          return p.n + "|" + p.lat + "|" + p.lng + "|" + (p.food ? 1 : 0);
        })
        .join("~");
    /* the same ideas on the same map: the pins already there stay (each redraw used to make them all again) */
    if (sig === S.ideaSig && S.ideaMap === S.map) return true;
    S.ideaSig = sig;
    S.ideaMap = S.map;
    (S.ideaMarkers || []).forEach(function (m) {
      m.remove();
    });
    S.ideaMarkers = [];
    want.forEach(function (p) {
      var el = document.createElement("div");
      el.className = "vt-pin vt-idea" + (p.food ? " food" : "");
      el.setAttribute("data-idea", p.n);
      el.title = p.n;
      el.innerHTML = "<b></b><span>" + W.esc(p.n) + "</span>";
      S.ideaMarkers.push(new ML.Marker({ element: el, anchor: "left", offset: [-8, 0] }).setLngLat([p.lng, p.lat]).addTo(S.map));
    });
    return true;
  };
  /** bring a place into view, clear of whatever covers the map's left side (the inspector): pad = px covered */
  W.vtSee = function (lng, lat, pad) {
    if (!S.map || !S.ready || lat == null) return;
    try {
      var p = S.map.project([lng, lat]),
        w = S.el.clientWidth,
        h = S.el.clientHeight,
        left = (pad || 0) + 40;
      if (p.x < left || p.x > w - 60 || p.y < 70 || p.y > h - 50) {
        S.moved = true; /* (you asked to see this place: the map stays here until the day changes) */
        S.map.easeTo({ center: [lng, lat], offset: [(pad || 0) / 2, 0], duration: 350 });
      }
    } catch (e) {
      W.caught(e, "the map's look at a place");
    }
  };
  /* how far out the map goes: the town the pack is made for (its "places" frame) with a margin, stretched to take in
     the day's own stops, and no further. Zooming out stops there (MapLibre keeps the view inside these bounds), so the
     map never shows the sea and the next island where it has nothing to draw. */
  function area(places, c) {
    var w = places[0],
      s = places[1],
      e = places[2],
      n = places[3];
    c.forEach(function (q) {
      w = Math.min(w, q[0]);
      e = Math.max(e, q[0]);
      s = Math.min(s, q[1]);
      n = Math.max(n, q[1]);
    });
    var mx = Math.max((e - w) * 0.3, 0.035),
      my = Math.max((n - s) * 0.3, 0.025);
    return [
      [w - mx, s - my],
      [e + mx, n + my]
    ];
  }
  W.vtArea = area; /* (for the tests) */
  function fit(pts, home, animate) {
    var c = pts
      .filter(function (p) {
        return p.lat != null && !p.gpin;
      })
      .map(function (p) {
        return [p.lng, p.lat];
      });
    if (home && home.lat != null) c.push([home.lng, home.lat]);
    if (!c.length) return;
    if (S.places) {
      try {
        S.map.setMaxBounds(area(S.places, c));
      } catch (e) {
        W.caught(e, "the street map's bounds");
      }
    }
    var b = new ML.LngLatBounds(c[0], c[0]);
    c.forEach(function (q) {
      b.extend(q);
    });
    /* centred on the stops, all of them in view: room for a pin on every side, and on a wide screen, where each pin
       carries its name to the right, room for the name too (the stops then sit a little left, the names fill the rest) */
    var w = S.el.clientWidth || 340,
      named = window.innerWidth > 920 /* (as .vt-pin span in app.css) */,
      side = Math.min(40, w * 0.1);
    S.map.fitBounds(b, {
      /* (in the desktop workspace's pane the day's title and the map's buttons lie over its top edge) */
      padding: { top: S.el.closest(".ws-canvas") ? 88 : 40, bottom: 34, left: side, right: named ? Math.min(170, w * 0.3) : side },
      maxZoom: 16.2,
      duration: animate ? 600 : 0
    });
    if (!animate) groupPins();
  }

  /* ---------- show the map in a slot; returns true once the detailed map is on screen ---------- */
  W.vtMount = function (slot, o) {
    if (!slot || S.engine === "off") return false;
    if (S.engine !== "ready") {
      engine();
      return false;
    }
    if (!S.el) {
      S.el = document.createElement("div");
      S.el.className = "vt-map";
      /* the map's place can change size after it is drawn (fonts, photos, the side panel): fit the map to it */
      if (window.ResizeObserver)
        new ResizeObserver(function () {
          if (S.map && S.ready) {
            S.map.resize();
            S.map.triggerRepaint();
          }
        }).observe(S.el);
    }
    /* every redraw of the screen moves the one map into the new screen; a WebGL picture that moves is blank (black) until
       it draws again, and the map only draws when something changes, so ask it to */
    var movedIn = S.el.parentNode !== slot;
    if (movedIn) slot.appendChild(S.el);
    var themeKey = palette().dark ? "d" : "l";
    var make = (!S.map && !S.creating) || S.slug !== o.slug || S.theme !== themeKey;
    if (make) {
      S.creating = true;
      if (S.map) {
        try {
          S.map.remove();
        } catch (e) {}
        S.map = null;
      }
      S.ready = false;
      S.slug = o.slug;
      S.theme = themeKey;
      S.sig = "";
      /* only the latest request makes a map: switching city (or theme) twice while a pack is on its way used to let two
         answers each make one in the same place, the first never removed */
      var turn = (S.turn = (S.turn || 0) + 1);
      pack(o.slug).then(
        function (p) {
          if (turn !== S.turn) return;
          S.creating = false;
          if (S.slug !== o.slug) return;
          if (S.map) {
            try {
              S.map.remove();
            } catch (e) {}
            S.map = null;
          }
          try {
            S.places = p.hdr.places;
            S.map = new ML.Map({
              container: S.el,
              style: style(o.slug, p.hdr),
              bounds: [
                [p.hdr.places[0], p.hdr.places[1]],
                [p.hdr.places[2], p.hdr.places[3]]
              ],
              maxBounds: area(p.hdr.places, []),
              attributionControl: false,
              dragRotate: false,
              pitchWithRotate: false,
              touchPitch: false,
              cooperativeGestures: touchFirst(),
              maxZoom: 18,
              minZoom: 8,
              fadeDuration: 180,
              localIdeographFontFamily: "sans-serif"
            });
            S.map.touchZoomRotate.disableRotation();
            /* once you move the map yourself, it stops re-fitting to the day's stops until the day changes */
            ["dragstart", "zoomstart"].forEach(function (ev) {
              S.map.on(ev, function (e) {
                if (e && e.originalEvent) S.moved = true;
              });
            });
            S.map.on("zoomend", groupPins);
            S.map.on("load", function () {
              S.ready = true;
              S.sig = "";
              if (S.pend) W.vtMount(S.pend.slot, S.pend.o);
              W.redraw(); /* (the street map coming or going changes the screen, not the plan) */
            });
            S.got = {};
            S.retries = 0;
            var hdrT = p.hdr.t;
            var tkey = function (t) {
              var c = t && t.tileID && t.tileID.canonical;
              return c ? c.z + "/" + c.x + "/" + c.y : "";
            };
            S.map.on("sourcedata", function (e) {
              if (!e || e.sourceId !== "hi" || !e.tile) return;
              var k = tkey(e.tile);
              if (!k || !hdrT[k]) return;
              if (e.tile.state === "loaded" || e.tile.state === "reloading") {
                if (!S.got[k]) {
                  S.got[k] = 1;
                  coverSoon();
                }
              }
            });
            S.map.on("error", function (e) {
              var msg = String((e && e.error && e.error.message) || e);
              if (e && e.sourceId === "hi" && e.tile) {
                var k = tkey(e.tile);
                if (k && S.got[k]) {
                  delete S.got[k];
                  coverSoon();
                }
                /* ask for the detailed tiles again a moment later (a few times at most) */
                if (S.retries < 3 && !S.retryT)
                  S.retryT = setTimeout(function () {
                    S.retryT = 0;
                    S.retries++;
                    try {
                      var sc = S.map && S.map.style && S.map.style.sourceCaches && S.map.style.sourceCaches.hi;
                      if (sc && sc.reload) sc.reload();
                    } catch (x) {
                      W.caught(x, "the street map's reload");
                    }
                  }, 1500);
              }
              mapErr(msg);
              if (!S.ready && /webgl|context/i.test(msg)) {
                S.engine = "off";
                W.redraw(); /* (the street map coming or going changes the screen, not the plan) */
              }
            });
          } catch (e) {
            S.engine = "off";
            S.why = String((e && e.message) || e);
            W.redraw(); /* (the street map coming or going changes the screen, not the plan) */
          }
        },
        function () {
          if (turn !== S.turn) return;
          S.creating = false;
          S.engine = "off";
          W.redraw(); /* (the street map coming or going changes the screen, not the plan) */
        }
      );
    }
    S.pend = { slot: slot, o: o };
    S.city = o.city || "";
    if (!S.map || !S.ready) return false;
    var size = S.el.clientWidth + "x" + S.el.clientHeight,
      resized = size !== S.size;
    S.size = size;
    if (resized) S.map.resize();
    if (resized || movedIn) S.map.triggerRepaint();
    var sig =
      o.key +
      "|" +
      o.pts
        .map(function (p) {
          return p.n + p.lat + "," + p.lng;
        })
        .join(";") +
      "|" +
      (o.home && o.home.lat) +
      "," +
      (o.home && o.home.lng);
    if (sig !== S.sig) {
      var first = !S.sig;
      S.sig = sig;
      S.moved = false;
      setPins(o.pts, o.home);
      fit(o.pts, o.home, !first && o.animate);
    } else if (resized && !S.moved && S.el.clientHeight)
      fit(o.pts, o.home, false); /* the map changed size (list/map switch): frame the stops again */
    return true;
  };
  /* on a phone the page scrolls past the map with one finger and the map moves with two; with a mouse or trackpad the
     wheel zooms and dragging moves it (a laptop with a touch screen still counts as a mouse first) */
  function touchFirst() {
    try {
      return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    } catch (e) {
      return false;
    }
  }
  /* coming back to the page (another app, a locked phone) can leave a WebGL picture blank too */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && S.map && S.ready) {
      S.map.resize();
      S.map.triggerRepaint();
    }
  });
  /* ---------- a still picture of a town's street map (the Explore header, screens/trip.js) ----------
     The header of Explore shows the town's map as a picture, the same size as the day's photo. It is drawn once per town,
     theme and header shape by a second, hidden map (the live map is never touched: it may be on screen in the desktop
     pane) and kept as a blob URL in W.stills[o.key]: the picture and where it is framed, so the header can lay the day's
     stops over it as dots. A failure (no WebGL, no pack, a timeout) is kept too ("none"), so it is not tried again.
     o: {key, slug, w, h, pts: [{lat, lng}] (the town's places: the picture is framed on most of them)} */
  W.vtStill = function (o) {
    var st = W.stills;
    if (!st || st[o.key]) return;
    st[o.key] = "wait";
    Promise.resolve(S.engine === "ready" || engine())
      .then(function () {
        if (S.engine !== "ready") throw new Error("no engine");
        return pack(o.slug);
      })
      .then(function (p) {
        return new Promise(function (ok, no) {
          var host = document.createElement("div"),
            done = false,
            m = /** @type {any} */ (null),
            got = /** @type {Record<string, number>} */ ({}),
            timer = setTimeout(function () {
              end(null, new Error("took too long"));
            }, 20000);
          host.setAttribute("aria-hidden", "true");
          host.style.cssText = "position:fixed;left:-9999px;top:0;width:" + o.w + "px;height:" + o.h + "px;pointer-events:none";
          document.body.appendChild(host);
          function end(v, e) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try {
              if (m) m.remove();
            } catch (x) {
              W.caught(x, "the still map's removal");
            }
            host.remove();
            if (v) ok(v);
            else no(e);
          }
          /* framed on most of the town's places (the middle 84%: one far-off sight would shrink the town to a dot) */
          function frame() {
            var pts = (o.pts || []).filter(function (q) {
                return q.lat != null && q.lng != null;
              }),
              b = p.hdr.places;
            if (!pts.length)
              return [
                [b[0], b[1]],
                [b[2], b[3]]
              ];
            var cut = function (key) {
              var v = pts
                .map(function (q) {
                  return q[key];
                })
                .sort(function (a, c) {
                  return a - c;
                });
              var k = v.length >= 8 ? Math.floor(v.length * 0.08) : 0;
              return [v[k], v[v.length - 1 - k]];
            };
            var x = cut("lng"),
              y = cut("lat"),
              mx = Math.max((x[1] - x[0]) * 0.12, 0.006),
              my = Math.max((y[1] - y[0]) * 0.12, 0.004);
            return [
              [x[0] - mx, y[0] - my],
              [x[1] + mx, y[1] + my]
            ];
          }
          function snap() {
            if (done || !m) return;
            m.getCanvas().toBlob(
              function (bl) {
                if (!bl) return end(null, new Error("no picture"));
                var c = m.getCenter();
                end({ url: URL.createObjectURL(bl), lng: c.lng, lat: c.lat, zoom: m.getZoom(), w: o.w, h: o.h });
              },
              "image/webp",
              0.82
            );
          }
          try {
            var sty = style(o.slug, p.hdr, o.pal);
            /* no names unless asked for (o.keep: parts of the name layers' ids to keep, "place-small" for the
               neighbourhoods, "water-name"...): by default a quiet backdrop for the town's name and the dots */
            sty.layers = sty.layers.filter(function (l) {
              return (
                l.type !== "symbol" ||
                (o.keep || []).some(function (/** @type {string} */ k) {
                  return l.id.indexOf(k) > -1;
                })
              );
            });
            m = new ML.Map({
              container: host,
              style: sty,
              bounds: frame(),
              fitBoundsOptions: { padding: 10, maxZoom: 15.5 },
              interactive: false,
              attributionControl: false,
              fadeDuration: 0,
              preserveDrawingBuffer: true
            });
            /* the cover under the detailed tiles that loaded, as on the live map (see coverSoon) */
            m.on("sourcedata", function (e) {
              var t = e && e.sourceId === "hi" && e.tile;
              if (t && (t.state === "loaded" || t.state === "reloading") && t.tileID) {
                var c = t.tileID.canonical;
                got[c.z + "/" + c.x + "/" + c.y] = 1;
              }
            });
            m.on("error", function (e) {
              mapErr(String((e && e.error && e.error.message) || e));
            });
            m.once("idle", function () {
              var keys = Object.keys(got);
              [13, 14].forEach(function (zl) {
                var src = m.getSource("mask" + zl);
                if (src && src.setData) src.setData(mask(keys, zl));
              });
              m.triggerRepaint();
              setTimeout(snap, 400);
            });
          } catch (e) {
            end(null, e);
          }
        });
      })
      .then(
        function (r) {
          st[o.key] = r;
          W.redraw(); /* (the header takes the picture) */
        },
        function (e) {
          st[o.key] = "none";
          mapErr("still: " + ((e && e.message) || e));
        }
      );
  };
  W.vtZoom = function (how) {
    if (!S.map || !S.ready) return false;
    if (how === "in") S.map.zoomIn({ duration: 250 });
    else if (how === "out") S.map.zoomOut({ duration: 250 });
    else if (S.pend) {
      S.moved = false;
      fit(S.pend.o.pts, S.pend.o.home, true);
    }
    return true;
  };
})();
