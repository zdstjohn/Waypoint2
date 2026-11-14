/* Waypoint: the way between two stops along the streets, worked out from the map's own data (second script).
   The street map (lib/vtmap.js) draws a city from its map pack; the pack's most detailed tiles hold every street,
   lane, footpath and stairway as lines. This reads those lines, joins them into a network and finds the shortest
   walk between two pins, so the day's route can be drawn where you would really walk: no straight strokes from pin
   to pin. Nothing is asked of any service: it works without a signal, the same in the Claude version and on the
   website, and the line lies exactly on the streets the map draws (they are the same data, © OpenStreetMap
   contributors). The times beside the list stay where they came from (Google's, or the estimate): this is the line
   only. Pure functions, no screen: the tests feed them tiles they make themselves. */
(function () {
  "use strict";
  var W = window.W;
  var Z = 14,
    EXT = 4096,
    SPAN = Math.pow(2, Z) * EXT /* the world's width in tile units at the detailed zoom */,
    KEYF = 67108864 /* 2^26: a point's key is x * 2^26 + y, exact in a double */,
    CELL = 128 /* the grid that finds what is near: about 60 m in a city */,
    SNAP = 3 /* a street's end this close to another street joins it (units: about half a metre each) */,
    REACH = 420; /* a pin further than this from any street (about 200 m) has no walk drawn */
  /* how gladly each kind of way is walked: a footpath before a main road. Not listed: not walked (motorways, rails,
     tram and bus lanes, ferries, cable cars, race tracks). */
  var COST = { path: 0.9, minor: 1, service: 1.1, track: 1.1, tertiary: 1.05, secondary: 1.15, primary: 1.3, trunk: 3, pier: 1.2 },
    SUB = { pedestrian: 0.85, footway: 0.9, steps: 1.15, cycleway: 1.2, platform: 1.4 };

  /* ---------- reading a tile's streets (a Mapbox Vector Tile, the "transportation" layer) ---------- */
  /** @param {Uint8Array} b @param {number} i @returns {number[]} the number and where it ends */
  function vint(b, i) {
    var v = 0,
      m = 1,
      c;
    do {
      c = b[i++];
      v += (c & 127) * m;
      m *= 128;
    } while (c >= 128);
    return [v, i];
  }
  /** each field of a message: fn(field, wire type, value or [start, end]) @param {Uint8Array} b */
  function fields(b, s, e, fn) {
    var i = s;
    while (i < e) {
      var k = vint(b, i),
        f = k[0] >>> 3,
        wt = k[0] & 7;
      i = k[1];
      if (wt === 0) {
        var v = vint(b, i);
        i = v[1];
        fn(f, wt, v[0]);
      } else if (wt === 2) {
        var n = vint(b, i);
        fn(f, wt, [n[1], n[1] + n[0]]);
        i = n[1] + n[0];
      } else if (wt === 1) i += 8;
      else if (wt === 5) i += 4;
      else return;
    }
  }
  var utf = new TextDecoder();
  /** the streets of one tile: [{f: how gladly walked, over: a bridge or tunnel, lines: [[x, y, x, y, ...]]}], in the
      tile's own units @param {ArrayBuffer | Uint8Array} buf */
  function roads(buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf),
      /** @type {any[]} */ out = [];
    fields(b, 0, b.length, function (f, wt, v) {
      if (f !== 3 || wt !== 2) return;
      var name = "",
        /** @type {string[]} */ keys = [],
        /** @type {any[]} */ vals = [],
        /** @type {number[][]} */ feats = [],
        ext = EXT;
      fields(b, v[0], v[1], function (f2, wt2, v2) {
        if (f2 === 1) name = utf.decode(b.subarray(v2[0], v2[1]));
        else if (f2 === 2) feats.push(v2);
        else if (f2 === 3) keys.push(utf.decode(b.subarray(v2[0], v2[1])));
        else if (f2 === 4) {
          var val = /** @type {any} */ (null);
          fields(b, v2[0], v2[1], function (f3, wt3, v3) {
            if (f3 === 1) val = utf.decode(b.subarray(v3[0], v3[1]));
            else if (wt3 === 0) val = v3;
          });
          vals.push(val);
        } else if (f2 === 5) ext = v2;
      });
      if (name !== "transportation") return;
      var kc = keys.indexOf("class"),
        ks = keys.indexOf("subclass"),
        kb = keys.indexOf("brunnel"),
        sc = EXT / ext;
      feats.forEach(function (fr) {
        var type = 0,
          cls = "",
          sub = "",
          over = false,
          /** @type {number[] | null} */ g = null;
        fields(b, fr[0], fr[1], function (f3, wt3, v3) {
          if (f3 === 3) type = v3;
          else if (f3 === 2 && wt3 === 2) {
            var i = v3[0];
            while (i < v3[1]) {
              var k = vint(b, i),
                x = vint(b, k[1]);
              i = x[1];
              if (k[0] === kc) cls = vals[x[0]];
              else if (k[0] === ks) sub = vals[x[0]];
              else if (k[0] === kb) over = !!vals[x[0]];
            }
          } else if (f3 === 4 && wt3 === 2) g = v3;
        });
        var cost = COST[cls];
        if (type !== 2 || !cost || !g) return;
        if (cls === "path" && SUB[sub]) cost = SUB[sub];
        /* the lines: MoveTo (1), LineTo (2), each with a count, then zigzag steps */
        var lines = [],
          /** @type {number[]} */ cur = [],
          x0 = 0,
          y0 = 0,
          i2 = g[0];
        while (i2 < g[1]) {
          var c = vint(b, i2),
            id = c[0] & 7,
            n = c[0] >>> 3;
          i2 = c[1];
          if (id === 7) continue;
          if (id === 1 && cur.length > 2) lines.push(cur);
          if (id === 1) cur = [];
          for (var j = 0; j < n; j++) {
            var dx = vint(b, i2),
              dy = vint(b, dx[1]);
            i2 = dy[1];
            x0 += (dx[0] >>> 1) ^ -(dx[0] & 1);
            y0 += (dy[0] >>> 1) ^ -(dy[0] & 1);
            cur.push(Math.round(x0 * sc), Math.round(y0 * sc));
          }
        }
        if (cur.length > 2) lines.push(cur);
        if (lines.length) out.push({ f: cost, over: over, lines: lines });
      });
    });
    return out;
  }

  /* ---------- where things are: degrees <-> the tile units of the detailed zoom ---------- */
  function toX(lng) {
    return ((lng + 180) / 360) * SPAN;
  }
  function toY(lat) {
    var s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * SPAN;
  }
  function toLng(x) {
    return (x / SPAN) * 360 - 180;
  }
  function toLat(y) {
    return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / SPAN))) * 180) / Math.PI;
  }
  /** the detailed tiles a set of pins needs, with room around them: [[x, y], ...], or null when they lie too far apart
      to be one walk (more than `max` tiles) @param {{lat: number, lng: number}[]} pts @param {number} [max] */
  function tilesFor(pts, max) {
    var x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    pts.forEach(function (p) {
      var x = toX(p.lng),
        y = toY(p.lat);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    });
    if (!isFinite(x0)) return null;
    var pad = 700 /* about 330 m: a walk may leave the box its ends make */,
      a = Math.floor((x0 - pad) / EXT),
      b = Math.floor((x1 + pad) / EXT),
      c = Math.floor((y0 - pad) / EXT),
      d = Math.floor((y1 + pad) / EXT),
      out = [];
    if ((b - a + 1) * (d - c + 1) > (max || 16)) return null;
    for (var x = a; x <= b; x++) for (var y = c; y <= d; y++) out.push([x, y]);
    return out;
  }

  /* ---------- the network ---------- */
  function cellsOf(grid, seg, x, y, s) {
    var a = seg[s],
      b = seg[s + 1],
      cx0 = Math.floor(Math.min(x[a], x[b]) / CELL),
      cx1 = Math.floor(Math.max(x[a], x[b]) / CELL),
      cy0 = Math.floor(Math.min(y[a], y[b]) / CELL),
      cy1 = Math.floor(Math.max(y[a], y[b]) / CELL);
    for (var cx = cx0; cx <= cx1; cx++)
      for (var cy = cy0; cy <= cy1; cy++) {
        var ck = cx * KEYF + cy,
          list = grid.get(ck);
        if (!list) grid.set(ck, (list = []));
        list.push(s);
      }
  }
  /** The network of a set of tiles, built a slice at a time so a phone's screen never waits for it: step() does one
      slice and says whether more is left; G is whole once it says no. (graph() below runs them all at once.)
      @param {{x: number, y: number, buf: ArrayBuffer | Uint8Array}[]} tiles the detailed tiles, as the pack holds them */
  function builder(tiles) {
    var G = {
      /** @type {number[]} */ x: [],
      /** @type {number[]} */ y: [],
      /** @type {number[][]} */ adj: [] /* per point: [other, cost, other, cost, ...] */,
      /** @type {Map<number, number>} */ at: new Map(),
      /** @type {number[]} */ seg: [] /* each stretch between two points: a, b, f x 1000 x 2 (+1 when a bridge or tunnel) */,
      /** @type {Map<number, number[]>} */ grid: new Map()
    };
    var /** @type {number[]} */ lvl = [] /* per point: 1 on the ground, 2 on a bridge or in a tunnel, 3 both (where one begins) */,
      /** @type {number[]} */ raw = [] /* the stretches as the tiles give them, before they are cut */,
      grid0 = new Map(),
      /** @type {Map<number, number[]>} */ cuts = new Map() /* stretch -> [how far along, point, ...] */,
      done = new Set(),
      /** @type {number[][]} */ cells = [],
      probe = { seg: raw, x: G.x, y: G.y, grid: grid0 },
      phase = 0,
      at = 0,
      n1 = 0;
    function node(x, y) {
      var k = x * KEYF + y,
        i = G.at.get(k);
      if (i === undefined) {
        i = G.x.length;
        G.at.set(k, i);
        G.x.push(x);
        G.y.push(y);
        G.adj.push([]);
        lvl.push(0);
      }
      return i;
    }
    function link(a, b, f) {
      var c = Math.hypot(G.x[a] - G.x[b], G.y[a] - G.y[b]) * f;
      G.adj[a].push(b, c);
      G.adj[b].push(a, c);
    }
    function cut(s, t, n) {
      var c = cuts.get(s);
      if (!c) cuts.set(s, (c = []));
      c.push(t, n);
    }
    function piece(a, b, code) {
      if (a === b) return;
      link(a, b, (code >> 1) / 1000);
      G.seg.push(a, b, code);
    }
    /* A tile keeps a street's corners, not every point where another street meets it (a straight street loses the
       points along it), and cuts each street at its edge. So each stretch is cut where another street's corner or end
       lies on it (a side street; the same street carrying on in the next tile), and where another street crosses it
       without a corner there. A bridge or a tunnel meets only its own kind: it doesn't join the street it passes. */
    var steps = [
      /* 0: read the streets, a tile a slice */
      function () {
        var t = tiles[at++];
        if (!t) return false;
        var ox = t.x * EXT,
          oy = t.y * EXT;
        roads(t.buf).forEach(function (r) {
          var code = Math.round(r.f * 1000) * 2 + (r.over ? 1 : 0);
          r.lines.forEach(function (l) {
            var prev = -1;
            for (var i = 0; i < l.length; i += 2) {
              var n = node(ox + l[i], oy + l[i + 1]);
              lvl[n] |= r.over ? 2 : 1;
              if (prev >= 0 && prev !== n) raw.push(prev, n, code);
              prev = n;
            }
          });
        });
        return at < tiles.length;
      },
      /* 1: where each stretch is, for finding what is near */
      function () {
        for (var end = Math.min(raw.length, at + 18000); at < end; at += 3) cellsOf(grid0, raw, G.x, G.y, at);
        if (at < raw.length) return true;
        n1 = G.x.length;
        return false;
      },
      /* 2: corners and ends that lie on another street */
      function () {
        for (var end = Math.min(n1, at + 2500); at < end; at++) {
          var hit = nearest(probe, G.x[at], G.y[at], SNAP, at, lvl[at] === 2);
          if (hit) cut(hit.s, hit.t, at);
        }
        if (at < n1) return true;
        grid0.forEach(function (l) {
          if (l.length > 1) cells.push(l);
        });
        return false;
      },
      /* 3: streets that cross without a corner */
      function () {
        for (var end = Math.min(cells.length, at + 1200); at < end; at++) {
          var list = cells[at];
          for (var i = 0; i < list.length; i++)
            for (var j = i + 1; j < list.length; j++) {
              var p = list[i],
                q = list[j];
              if ((raw[p + 2] & 1) || (raw[q + 2] & 1)) continue;
              var a = raw[p],
                b = raw[p + 1],
                c = raw[q],
                d = raw[q + 1];
              if (a === c || a === d || b === c || b === d) continue;
              var ax = G.x[a],
                ay = G.y[a],
                rx = G.x[b] - ax,
                ry = G.y[b] - ay,
                sx = G.x[d] - G.x[c],
                sy = G.y[d] - G.y[c],
                den = rx * sy - ry * sx;
              if (!den) continue;
              var t = ((G.x[c] - ax) * sy - (G.y[c] - ay) * sx) / den,
                u = ((G.x[c] - ax) * ry - (G.y[c] - ay) * rx) / den;
              if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) continue;
              var pk = p < q ? p * KEYF + q : q * KEYF + p;
              if (done.has(pk)) continue;
              done.add(pk);
              var x = node(Math.round(ax + t * rx), Math.round(ay + t * ry));
              cut(p, t, x);
              cut(q, u, x);
            }
        }
        return at < cells.length;
      },
      /* 4: the stretches as they are walked: each one whole, or in the pieces its cuts make */
      function () {
        for (var end = Math.min(raw.length, at + 15000); at < end; at += 3) {
          var cs = cuts.get(at),
            from = raw[at],
            code = raw[at + 2];
          if (cs) {
            var order = [];
            for (var k = 0; k < cs.length; k += 2) order.push([cs[k], cs[k + 1]]);
            order.sort(function (m, n) {
              return m[0] - n[0];
            });
            for (var o = 0; o < order.length; o++) {
              piece(from, order[o][1], code);
              from = order[o][1];
            }
          }
          piece(from, raw[at + 1], code);
        }
        return at < raw.length;
      },
      /* 5: where each piece is, for the pins */
      function () {
        for (var end = Math.min(G.seg.length, at + 18000); at < end; at += 3) cellsOf(G.grid, G.seg, G.x, G.y, at);
        return at < G.seg.length;
      }
    ];
    return {
      G: G,
      step: function () {
        if (phase >= steps.length) return false;
        if (!steps[phase]()) {
          phase++;
          at = 0;
        }
        return phase < steps.length;
      }
    };
  }
  function graph(tiles) {
    var b = builder(tiles);
    while (b.step());
    return b.G;
  }
  /** the same, between the screen's own work: a few milliseconds at a time @param {(G: any) => void} then */
  function graphSoon(tiles, then) {
    var b = builder(tiles);
    (function go() {
      var t0 = Date.now(),
        more = true;
      while (more && Date.now() - t0 < 10) more = b.step();
      if (more) setTimeout(go, 0);
      else then(b.G);
    })();
  }
  /** the stretch nearest a point, within `max` units: {s, x, y, d, t} (its place on the stretch) or null. With `skip`
      (a point looking for the street it lies on): that point's own stretches don't count, only the inside of a stretch
      does, and a bridge's point (`over`) looks only at bridges, a street's only at streets */
  function nearest(G, px, py, max, skip, over) {
    var best = /** @type {any} */ (null);
    for (var i = Math.floor((px - max) / CELL), i1 = Math.floor((px + max) / CELL); i <= i1; i++)
      for (var j = Math.floor((py - max) / CELL), j1 = Math.floor((py + max) / CELL); j <= j1; j++) {
        var list = G.grid.get(i * KEYF + j);
        if (!list) continue;
        for (var k = 0; k < list.length; k++) {
          var s = list[k],
            a = G.seg[s],
            b = G.seg[s + 1];
          if (skip !== undefined && (a === skip || b === skip || !!(G.seg[s + 2] & 1) !== !!over)) continue;
          var ax = G.x[a],
            ay = G.y[a],
            dx = G.x[b] - ax,
            dy = G.y[b] - ay,
            len = dx * dx + dy * dy,
            t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
          if (skip !== undefined && (t <= 0.001 || t >= 0.999)) continue;
          t = Math.max(0, Math.min(1, t));
          var qx = ax + t * dx,
            qy = ay + t * dy,
            d = Math.hypot(px - qx, py - qy);
          if (d <= max && (!best || d < best.d)) best = { s: s, x: qx, y: qy, d: d, t: t };
        }
      }
    return best;
  }

  /* ---------- the shortest walk (A*) ---------- */
  /** @param {any} G @param {{lat: number, lng: number}} from @param {{lat: number, lng: number}} to
      @returns {number[][] | null} the walk as [lng, lat] points, from pin to pin; null when there is none */
  function path(G, from, to) {
    var ax = toX(from.lng),
      ay = toY(from.lat),
      bx = toX(to.lng),
      by = toY(to.lat),
      A = nearest(G, ax, ay, REACH),
      B = nearest(G, bx, by, REACH);
    if (!A || !B) return null;
    /* the two ends join the network for this one search: -1 is the start, -2 the end */
    var a0 = G.seg[A.s],
      a1 = G.seg[A.s + 1],
      b0 = G.seg[B.s],
      b1 = G.seg[B.s + 1],
      fa = (G.seg[A.s + 2] >> 1) / 1000,
      fb = (G.seg[B.s + 2] >> 1) / 1000,
      /** @type {Record<number, number>} */ toEnd = {};
    toEnd[b0] = Math.hypot(G.x[b0] - B.x, G.y[b0] - B.y) * fb;
    toEnd[b1] = Math.hypot(G.x[b1] - B.x, G.y[b1] - B.y) * fb;
    var n = G.x.length,
      dist = new Float64Array(n + 1).fill(Infinity) /* (the last one is the end) */,
      prev = new Int32Array(n + 1).fill(-1),
      heap = /** @type {number[]} */ ([]) /* pairs: priority, point */;
    function push(p, v) {
      var i = heap.length;
      heap.push(p, v);
      while (i > 0) {
        var par = ((i / 2 - 1) >> 1) * 2;
        if (heap[par] <= heap[i]) break;
        var t0 = heap[par],
          t1 = heap[par + 1];
        heap[par] = heap[i];
        heap[par + 1] = heap[i + 1];
        heap[i] = t0;
        heap[i + 1] = t1;
        i = par;
      }
    }
    function pop() {
      var v = heap[1],
        lp = /** @type {number} */ (heap[heap.length - 2]),
        lv = /** @type {number} */ (heap[heap.length - 1]);
      heap.length -= 2;
      if (heap.length) {
        heap[0] = lp;
        heap[1] = lv;
        var i = 0;
        for (;;) {
          var l = i * 2 + 2,
            r = l + 2,
            m = i;
          if (l < heap.length && heap[l] < heap[m]) m = l;
          if (r < heap.length && heap[r] < heap[m]) m = r;
          if (m === i) break;
          var t0 = heap[m],
            t1 = heap[m + 1];
          heap[m] = heap[i];
          heap[m + 1] = heap[i + 1];
          heap[i] = t0;
          heap[i + 1] = t1;
          i = m;
        }
      }
      return v;
    }
    var H = 0.85; /* (no way is walked more gladly than this: the guess never overshoots) */
    function guess(i) {
      return Math.hypot(G.x[i] - B.x, G.y[i] - B.y) * H;
    }
    /* both pins on the same stretch: straight along it */
    if (A.s === B.s) return [[from.lng, from.lat], [toLng(A.x), toLat(A.y)], [toLng(B.x), toLat(B.y)], [to.lng, to.lat]];
    [a0, a1].forEach(function (i) {
      var c = Math.hypot(G.x[i] - A.x, G.y[i] - A.y) * fa;
      if (c < dist[i]) {
        dist[i] = c;
        prev[i] = -1;
        push(c + guess(i), i);
      }
    });
    var END = n,
      found = false,
      closed = new Uint8Array(n + 1);
    while (heap.length) {
      var u = pop();
      if (closed[u]) continue;
      closed[u] = 1;
      if (u === END) {
        found = true;
        break;
      }
      var du = dist[u],
        e = G.adj[u];
      if (toEnd[u] !== undefined && du + toEnd[u] < dist[END]) {
        dist[END] = du + toEnd[u];
        prev[END] = u;
        push(dist[END], END);
      }
      for (var k = 0; k < e.length; k += 2) {
        var v = e[k],
          nd = du + e[k + 1];
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
          push(nd + guess(v), v);
        }
      }
    }
    if (!found) return null;
    var out = [[to.lng, to.lat], [toLng(B.x), toLat(B.y)]];
    for (var p = prev[END]; p >= 0; p = prev[p]) out.push([toLng(G.x[p]), toLat(G.y[p])]);
    out.push([toLng(A.x), toLat(A.y)], [from.lng, from.lat]);
    return out.reverse();
  }

  W.streetRoute = { Z: Z, roads: roads, tilesFor: tilesFor, graph: graph, graphSoon: graphSoon, path: path };
})();
