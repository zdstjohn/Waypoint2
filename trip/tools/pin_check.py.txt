"""Waypoint pin check: is every pin a trip shows on dry land? Each place's pin (the checked one from places/<slug> when
there is one, otherwise the guessed one the trip carries in wanted/<slug>.pts), each city's stay pin (wanted.home) and
its centre are tested against the water of the very map the app draws (OpenFreeMap / OpenMapTiles vector tiles, z14).

  python3 pin_check.py scan <db_dir> <work_dir> [slug ...]
      reads <db_dir>/wanted/*.json and <db_dir>/places/*.json; writes <work_dir>/pins.json
      {slug: {center, home, items: [{name, food, lat, lng, src: checked|guess, water_m}]}} and prints a summary.
      water_m is how far into the water the pin sits (0 = on land). Tiles are cached in <work_dir>/tiles.

Used as a module by place_check.py: in_water(lat, lng) -> metres into the water (0 on land),
nearest_land(lat, lng) -> (lat, lng) just inside the nearest shore.
Map data (c) OpenMapTiles (c) OpenStreetMap contributors (ODbL), tiles from OpenFreeMap."""
import glob, gzip, json, math, os, re, sys, time, unicodedata, urllib.request

UA = {'User-Agent': 'WaypointTripPlanner/1.0 (pin check)', 'Accept-Encoding': 'gzip'}
Z = 14
TILE_DIR = None
_tpl = None
_cache = {}


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower()); s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _get(url, tries=3):
    for i in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40); b = r.read()
            return gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b
        except Exception:
            time.sleep(1 + 2 * i)
    return None


def _template():
    global _tpl
    if not _tpl:
        d = _get('https://tiles.openfreemap.org/planet')
        _tpl = json.loads(d)['tiles'][0] if d else 'https://tiles.openfreemap.org/planet/20250101_001001_pt/{z}/{x}/{y}.pbf'
    return _tpl


def tilexy_f(lat, lng, z=Z):
    n = 2 ** z; lat = max(-85, min(85, lat))
    x = (lng + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def _varint(b, i):
    s = 0; n = 0
    while True:
        c = b[i]; i += 1; n |= (c & 0x7f) << s; s += 7
        if c < 0x80: return n, i


def _fields(b):
    i = 0
    while i < len(b):
        key, i = _varint(b, i); f, wt = key >> 3, key & 7
        if wt == 2:
            ln, i = _varint(b, i); yield f, b[i:i + ln]; i += ln
        elif wt == 0:
            v, i = _varint(b, i); yield f, v
        elif wt == 1: yield f, b[i:i + 8]; i += 8
        elif wt == 5: yield f, b[i:i + 4]; i += 4
        else: raise ValueError('wire type %d' % wt)


def _packed(b):
    out = []; i = 0
    while i < len(b): v, i = _varint(b, i); out.append(v)
    return out


def _rings(cmds):
    rings, cur, x, y, i = [], [], 0, 0, 0
    while i < len(cmds):
        c = cmds[i]; i += 1; cid, cnt = c & 7, c >> 3
        if cid == 7:
            if cur: rings.append(cur); cur = []
            continue
        for _ in range(cnt):
            dx, dy = cmds[i], cmds[i + 1]; i += 2
            x += (dx >> 1) ^ -(dx & 1); y += (dy >> 1) ^ -(dy & 1)
            if cid == 1:
                if cur: rings.append(cur)
                cur = [(x, y)]
            else: cur.append((x, y))
    if cur: rings.append(cur)
    return rings


def water_polys(x, y, z=Z):
    """the water polygons of one tile: a list of features, each a list of rings in tile units, plus the extent"""
    k = (z, x, y)
    if k in _cache: return _cache[k]
    raw = None; path = os.path.join(TILE_DIR, '%d-%d-%d.pbf' % k) if TILE_DIR else None
    if path and os.path.exists(path): raw = open(path, 'rb').read()
    if raw is None:
        raw = _get(_template().replace('{z}', str(z)).replace('{x}', str(x)).replace('{y}', str(y)))
        if raw is None: _cache[k] = None; return None
        if path: open(path, 'wb').write(raw)
    out, extent = [], 4096
    for f, body in _fields(raw):
        if f != 3: continue
        name = ''; feats = []; ext = 4096; keys = []; vals = []
        for g, v in _fields(body):
            if g == 1: name = v.decode()
            elif g == 2: feats.append(v)
            elif g == 3: keys.append(v.decode())
            elif g == 4: vals.append(_value(v))
            elif g == 5: ext = v
        if name != 'water': continue
        extent = ext
        # a fountain, a pool or a garden pond is not "the water": only seas, lakes, rivers and harbours count
        mpu = 40075016.686 * math.cos(math.radians(_tile_lat(y + 0.5, z))) / (2 ** z) / ext
        for fb in feats:
            typ, geom, tags = 0, None, []
            for g, v in _fields(fb):
                if g == 2: tags = _packed(v)
                elif g == 3: typ = v
                elif g == 4: geom = _packed(v)
            if typ != 3 or not geom: continue
            cls = ''
            for t in range(0, len(tags) - 1, 2):
                if keys[tags[t]] == 'class': cls = str(vals[tags[t + 1]])
            if cls in ('swimming_pool', 'fountain'): continue
            rings = _rings(geom)
            if _area(rings) * mpu * mpu < 2500: continue
            out.append(rings)
    _cache[k] = (out, extent)
    return _cache[k]


def _value(raw):
    for f, v in _fields(raw):
        if f == 1: return v.decode('utf-8', 'replace')
        return v
    return ''


def _tile_lat(y, z):
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** z))))


def _area(rings):
    """area in tile units: outer rings minus holes (signed shoelace, summed)"""
    t = 0
    for r in rings:
        a = 0
        for i in range(len(r)):
            x1, y1 = r[i]; x2, y2 = r[(i + 1) % len(r)]; a += x1 * y2 - x2 * y1
        t += a / 2
    return abs(t)


_poi_cache = {}
def pois(x, y, z=Z):
    """the named places a map tile carries (OpenMapTiles poi, plus beaches, peaks and named water): [(name, alt names, class, lat, lng)]"""
    k = (z, x, y)
    if k in _poi_cache: return _poi_cache[k]
    if water_polys(x, y, z) is None: _poi_cache[k] = []; return []
    raw = open(os.path.join(TILE_DIR, '%d-%d-%d.pbf' % k), 'rb').read() if TILE_DIR and os.path.exists(os.path.join(TILE_DIR, '%d-%d-%d.pbf' % k)) else None
    out = []
    if raw:
        n = 2 ** z
        for f, body in _fields(raw):
            if f != 3: continue
            name = ''; feats = []; ext = 4096; keys = []; vals = []
            for g, v in _fields(body):
                if g == 1: name = v.decode()
                elif g == 2: feats.append(v)
                elif g == 3: keys.append(v.decode())
                elif g == 4: vals.append(_value(v))
                elif g == 5: ext = v
            if name not in ('poi', 'mountain_peak', 'water_name'): continue
            for fb in feats:
                tags, geom, typ = [], None, 0
                for g, v in _fields(fb):
                    if g == 2: tags = _packed(v)
                    elif g == 3: typ = v
                    elif g == 4: geom = _packed(v)
                if typ != 1 or not geom or len(geom) < 3: continue
                d = {keys[tags[i]]: vals[tags[i + 1]] for i in range(0, len(tags) - 1, 2)}
                nm = d.get('name:en') or d.get('name_en') or d.get('name')
                if not nm: continue
                alts = [str(d[k2]) for k2 in ('name', 'name:en', 'name_en', 'name_int', 'name:latin') if d.get(k2)]
                px = (geom[1] >> 1) ^ -(geom[1] & 1); py = (geom[2] >> 1) ^ -(geom[2] & 1)
                if not (0 <= px <= ext and 0 <= py <= ext): continue
                lng = (x + px / ext) / n * 360 - 180
                lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / ext) / n))))
                out.append((str(nm), alts, str(d.get('class') or name), str(d.get('subclass') or ''), lat, lng))
    _poi_cache[k] = out
    return out


def pois_near(lat, lng, ring=1):
    fx, fy = tilexy_f(lat, lng); x, y = int(fx), int(fy); out = []
    for dx in range(-ring, ring + 1):
        for dy in range(-ring, ring + 1): out += pois(x + dx, y + dy)
    return out


def _inside(px, py, rings):
    c = False
    for r in rings:
        n = len(r)
        for i in range(n):
            x1, y1 = r[i]; x2, y2 = r[(i + 1) % n]
            if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / ((y2 - y1) or 1e-12) + x1: c = not c
    return c


def _nearest_edge(px, py, rings, extent):
    """nearest point on a real shore (not a tile-clipping edge) of these rings: (dist, qx, qy)"""
    best = (1e18, px, py)
    for r in rings:
        n = len(r)
        for i in range(n):
            (x1, y1), (x2, y2) = r[i], r[(i + 1) % n]
            if (x1 == x2 and (x1 <= 0 or x1 >= extent)) or (y1 == y2 and (y1 <= 0 or y1 >= extent)): continue
            dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
            t = 0 if L == 0 else max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / L))
            qx, qy = x1 + t * dx, y1 + t * dy; d = math.hypot(px - qx, py - qy)
            if d < best[0]: best = (d, qx, qy)
    return best


def _locate(lat, lng):
    fx, fy = tilexy_f(lat, lng); x, y = int(fx), int(fy)
    t = water_polys(x, y)
    if t is None: return None
    polys, extent = t
    px, py = (fx - x) * extent, (fy - y) * extent
    m_per_unit = 40075016.686 * math.cos(math.radians(lat)) / (2 ** Z) / extent
    return x, y, polys, extent, px, py, m_per_unit


def in_water(lat, lng):
    """metres from this point to the nearest shore when it is in the water, 0 on land, None when the map is unreachable"""
    L = _locate(lat, lng)
    if L is None: return None
    x, y, polys, extent, px, py, mpu = L
    for rings in polys:
        if _inside(px, py, rings):
            d = _nearest_edge(px, py, rings, extent)[0]
            return round(min(d, 4 * extent) * mpu)
    return 0


def nearest_land(lat, lng, inland_m=12):
    """a point just inside the nearest shore (for a pin a little out in a harbour)"""
    L = _locate(lat, lng)
    if L is None: return None
    x, y, polys, extent, px, py, mpu = L
    for rings in polys:
        if _inside(px, py, rings):
            d, qx, qy = _nearest_edge(px, py, rings, extent)
            if d >= 1e17: return None
            ux, uy = (qx - px) / (d or 1), (qy - py) / (d or 1)
            for step in (inland_m, inland_m * 2, inland_m * 4):
                sx, sy = qx + ux * step / mpu, qy + uy * step / mpu
                if not any(_inside(sx, sy, r) for r in polys):
                    n = 2 ** Z
                    lng2 = (x + sx / extent) / n * 360 - 180
                    lat2 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + sy / extent) / n))))
                    return round(lat2, 6), round(lng2, 6)
            return None
    return lat, lng


def nearest_shore(lat, lng, max_m=2500, inland_m=15):
    """from a point on land (a village behind its beach), the nearest real shoreline within max_m, as a point just
    inland of it: (lat, lng), or None when no water is that close or the map is unreachable"""
    fx, fy = tilexy_f(lat, lng); x0, y0 = int(fx), int(fy)
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            t = water_polys(x0 + dx, y0 + dy)
            if t is None: continue
            polys, extent = t
            px, py = (fx - x0 - dx) * extent, (fy - y0 - dy) * extent      # the point in this tile's units
            for rings in polys:
                d, qx, qy = _nearest_edge(px, py, rings, extent)
                if d < 1e17 and (best is None or d < best[0]): best = (d, qx, qy, x0 + dx, y0 + dy, extent)
    if best is None: return None
    d, qx, qy, tx, ty, extent = best
    mpu = 40075016.686 * math.cos(math.radians(lat)) / (2 ** Z) / extent
    if d * mpu > max_m: return None
    px, py = (fx - tx) * extent, (fy - ty) * extent
    ux, uy = (px - qx) / (d or 1), (py - qy) / (d or 1)                 # from the shore back toward the village
    n = 2 ** Z
    for step in (inland_m, inland_m * 2, inland_m * 4):
        sx, sy = qx + ux * step / mpu, qy + uy * step / mpu
        lng2 = (tx + sx / extent) / n * 360 - 180
        lat2 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + sy / extent) / n))))
        if not in_water(lat2, lng2): return round(lat2, 6), round(lng2, 6)
    return None


def load_dir(d):
    out = {}
    for f in glob.glob(os.path.join(d, '*.json')):
        try: out[os.path.basename(f)[:-5]] = json.load(open(f))
        except Exception: pass
    return out


def scan(db, work, only):
    global TILE_DIR
    TILE_DIR = os.path.join(work, 'tiles'); os.makedirs(TILE_DIR, exist_ok=True)
    wanted, places = load_dir(os.path.join(db, 'wanted')), load_dir(os.path.join(db, 'places'))
    res, tot, wet, unchecked_wet, cities_wet = {}, 0, 0, 0, []
    for slug in sorted(wanted):
        if only and slug not in only: continue
        w = wanted[slug]; rec = (places.get(slug) or {}).get('items') or {}
        names = [(n, False) for n in (w.get('spots') or [])] + [(n, True) for n in (w.get('food') or [])]
        pts = w.get('pts') or []
        items = []
        for i, (n, food) in enumerate(names):
            r = rec.get(norm(n)) or {}
            if r.get('st') in ('closed', 'unfound', 'dup'): continue
            if r.get('lat') is not None: lat, lng, src = r['lat'], r['lng'], 'checked'
            elif r.get('nopin'): continue
            elif i < len(pts) and isinstance(pts[i], list) and len(pts[i]) == 2: lat, lng, src = pts[i][0], pts[i][1], 'guess'
            else: continue
            wm = in_water(lat, lng); tot += 1
            if wm: wet += 1; unchecked_wet += src == 'guess'
            items.append({'name': n, 'food': food, 'lat': lat, 'lng': lng, 'src': src, 'water_m': wm})
        out = {'items': items}
        pc = (places.get(slug) or {}).get('center')
        for k in ('home', 'center'):
            p = pc if (k == 'center' and pc) else w.get(k)
            if isinstance(p, list) and len(p) == 2: out[k] = {'lat': p[0], 'lng': p[1], 'water_m': in_water(p[0], p[1])}
        n_w = sum(1 for it in items if it['water_m'])
        if n_w or any((out.get(k) or {}).get('water_m') for k in ('home', 'center')): cities_wet.append('%s %d%s' % (slug, n_w, ' +home' if (out.get('home') or {}).get('water_m') else ''))
        res[slug] = out
        json.dump(res, open(os.path.join(work, 'pins.json'), 'w'), ensure_ascii=False, indent=0)
    print(json.dumps({'cities': len(res), 'pins': tot, 'in_water': wet, 'in_water_unchecked': unchecked_wet, 'cities_with_water_pins': cities_wet}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'scan': scan(sys.argv[2], sys.argv[3], set(sys.argv[4:]))
    else: print(__doc__)
