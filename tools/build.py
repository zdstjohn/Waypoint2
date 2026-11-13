"""Build one map pack per city for the MapLibre map: real vector tiles (streets, names, buildings, landmarks) around the trip's places.
Usage: python3 build.py <wanted_dir> <out_dir> [slug ...]
Pack format: b"WPVT1\\n" + 4-byte big-endian header length + header JSON + gzipped tiles.
The tiles are laid out town centre first ("lay": 2, see pack2json.py): the tiles of the screen the map opens at come
first, so the app can draw them before the rest has arrived.
Map data © OpenMapTiles © OpenStreetMap contributors (ODbL), tiles from OpenFreeMap."""
import gzip, json, math, os, sys, struct, time
from concurrent.futures import ThreadPoolExecutor
from mvt import get, slim_tile, tilexy

def tile_bounds(x, y, z):
    n = 2 ** z
    lng0 = x / n * 360 - 180; lng1 = (x + 1) / n * 360 - 180
    lat = lambda t: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * t / n))))
    return [lng0, lat(y + 1), lng1, lat(y)]

def rect(bb, z):
    x0, y0 = tilexy(bb[3], bb[0], z); x1, y1 = tilexy(bb[1], bb[2], z)
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}

def around(pts, z, km):
    out = set()
    for la, ln in pts:
        dla = km / 111; dln = km / (111 * math.cos(math.radians(la)))
        out |= rect([ln - dln, la - dla, ln + dln, la + dla], z)
    return out

NEAR_KM = 8.0

def plan(d):
    pts = [tuple(p) for p in d.get('pts') or [] if isinstance(p, list) and len(p) == 2]
    home = tuple(d['home']) if d.get('home') else None
    if home: pts.append(home)
    centre_only = not pts
    if not pts and d.get('center'): pts = [tuple(d['center'])]
    # The pack is about the town: its frame ("places", where the map opens and which cities it serves) and its street
    # detail come from the places within NEAR_KM of where you stay (or the centre). Places farther out (day trips) used
    # to stretch the frame over a whole region, which spent the size limit on empty country and trimmed the town's streets.
    anchor = home or (tuple(d['center']) if d.get('center') else None)
    if not anchor: anchor = (sorted(p[0] for p in pts)[len(pts) // 2], sorted(p[1] for p in pts)[len(pts) // 2])
    near = [p for p in pts if km(anchor, p) <= NEAR_KM] or [anchor]
    far = [p for p in pts if km(anchor, p) > NEAR_KM]
    la = sorted(p[0] for p in near); ln = sorted(p[1] for p in near)
    k = max(0, int(len(la) * 0.05)) if len(la) > 20 else 0
    bb = [ln[k], la[k], ln[-1 - k], la[-1 - k]]           # w, s, e, n of the town's places
    pad = lambda b, f: [b[0] - (b[2] - b[0]) * f - 0.02, b[1] - (b[3] - b[1]) * f - 0.015, b[2] + (b[2] - b[0]) * f + 0.02, b[3] + (b[3] - b[1]) * f + 0.015]
    T = {}
    # with no places yet (a built-in city, by its centre) the pack covers the whole centre: 3 km of streets, 6 km around
    T[14] = around(near, 14, 3.0 if centre_only else 1.0) | (around([home], 14, 2.0) if home else set())
    T[13] = {(x // 2, y // 2) for x, y in T[14]} | around(near, 13, 6.0 if centre_only else 2.0) | around(far, 13, 0.8)
    T[12] = {(x // 2, y // 2) for x, y in T[13]}
    r = rect(pad(bb, 0.1), 12)
    if len(r) <= 16: T[12] |= r
    for z, lim in ((11, 16), (10, 12), (9, 9), (8, 6)):
        r = rect(pad(bb, 0.3 + (11 - z) * 0.4), z)
        T[z] = r if len(r) <= lim else {(x // 2, y // 2) for x, y in T[z + 1]}
    return T, bb, pts

def km(a, b):
    la1, ln1, la2, ln2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((ln2 - ln1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))

def trim(res, d, pts):
    """keep a pack light enough for a phone on mobile data (PACK_MAX_MB, 4 by default): past that, the detailed
    tiles farthest from where you stay go first (a tile with one of the trip's places in it counts as three times
    closer), then the next level's. The app shows the coarser map wherever the detailed one stops."""
    limit = float(os.environ.get('PACK_MAX_MB', '4')) * 1e6
    total = sum(len(b) for _, b in res if b)
    if total <= limit: return res
    anchor = tuple(d['home']) if d.get('home') else tuple(d['center']) if d.get('center') else pts[0]
    def score(j):
        z, x, y = j; b = tile_bounds(x, y, z)
        dist = km(anchor, ((b[1] + b[3]) / 2, (b[0] + b[2]) / 2))
        has = any(b[0] <= p[1] <= b[2] and b[1] <= p[0] <= b[3] for p in pts)
        return dist / 3 if has else dist
    keep = {j: b for j, b in res}
    for z in (14, 13):
        for j in sorted([j for j, b in res if b and j[0] == z], key=score, reverse=True):
            if total <= limit: break
            if score(j) <= 0.8: break          # never the streets right around where you stay
            total -= len(keep[j]); keep[j] = None
    dropped = sum(1 for j, b in res if b and keep[j] is None)
    if dropped: print('  trimmed %d detailed tiles to %.1f MB' % (dropped, total / 1e6), flush=True)
    return [(j, keep[j]) for j, _ in res]

def build(slug, d, out_dir, tpl):
    T, bb, pts = plan(d)
    jobs = [(z, x, y) for z in sorted(T) for (x, y) in sorted(T[z])]
    def fetch(j):
        z, x, y = j
        for i in range(4):
            try:
                return j, gzip.compress(slim_tile(get(tpl.replace('{z}', str(z)).replace('{x}', str(x)).replace('{y}', str(y))), z), 9)
            except Exception as e:
                err = e; time.sleep(2 * (i + 1))
        print('  skip tile', j, err, file=sys.stderr); return j, None
    with ThreadPoolExecutor(6) as ex: res = list(ex.map(fetch, jobs))
    res = trim(res, d, pts)
    body = bytearray(); index = {}
    for (z, x, y), b in res:
        if not b: continue
        index['%d/%d/%d' % (z, x, y)] = [len(body), len(b)]; body += b
    allb = [tile_bounds(x, y, 12) for (x, y) in T[12]]
    hdr = {'v': 1, 'slug': slug, 'city': d.get('city'), 'country': d.get('country'), 't': index,
           'b': [min(b[0] for b in allb), min(b[1] for b in allb), max(b[2] for b in allb), max(b[3] for b in allb)],
           'places': [bb[0], bb[1], bb[2], bb[3]], 'zmin': min(T), 'zmax': max(T)}
    anchor = tuple(d['home']) if d.get('home') else tuple(d['center']) if d.get('center') else None
    if anchor: hdr['c'] = [round(anchor[1], 5), round(anchor[0], 5)]   # where you stay (lng, lat): the tiles around it come first
    hj = json.dumps(hdr, separators=(',', ':')).encode()
    data = b'WPVT1\n' + struct.pack('>I', len(hj)) + hj + bytes(body)
    try:
        from pack2json import relayout   # same folder: the tiles in the order the map needs them (without it a pack still works)
        data = relayout(data); hdr = json.loads(data[10:10 + struct.unpack('>I', data[6:10])[0]])
    except ImportError: pass
    open(os.path.join(out_dir, slug + '.bin'), 'wb').write(data)
    counts = {z: len(T[z]) for z in sorted(T)}
    print('%-28s %6.2f MB  tiles %s' % (slug, len(data) / 1e6, counts), flush=True)
    return hdr

def main():
    wanted_dir, out_dir = sys.argv[1:3]; only = sys.argv[3:]
    os.makedirs(out_dir, exist_ok=True)
    tpl = json.loads(get('https://tiles.openfreemap.org/planet'))['tiles'][0]
    idx_path = os.path.join(out_dir, 'index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    for fn in sorted(os.listdir(wanted_dir)):
        slug = fn[:-5]
        if only and slug not in only: continue
        d = json.load(open(os.path.join(wanted_dir, fn))); d = d.get('data', d)
        if not (d.get('pts') or d.get('center')): print('%-28s no places yet, skipped' % slug); continue
        h = build(slug, d, out_dir, tpl)
        index[slug] = {'b': h['b'], 'places': h['places'], 'city': h['city'], 'country': h['country']}
        json.dump(index, open(idx_path, 'w'), separators=(',', ':'))

if __name__ == '__main__':
    main()
