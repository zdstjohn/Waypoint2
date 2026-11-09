"""Build one map pack per city for the MapLibre map: real vector tiles (streets, names, buildings, landmarks) around the trip's places.
Usage: python3 build.py <wanted_dir> <out_dir> [slug ...]
Pack format: b"WPVT1\\n" + 4-byte big-endian header length + header JSON + gzipped tiles.
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

def plan(d):
    pts = [tuple(p) for p in d.get('pts') or [] if isinstance(p, list) and len(p) == 2]
    home = tuple(d['home']) if d.get('home') else None
    if home: pts.append(home)
    centre_only = not pts
    if not pts and d.get('center'): pts = [tuple(d['center'])]
    la = sorted(p[0] for p in pts); ln = sorted(p[1] for p in pts)
    k = max(0, int(len(la) * 0.05))
    bb = [ln[k], la[k], ln[-1 - k], la[-1 - k]]           # w, s, e, n of the main spread of places
    pad = lambda b, f: [b[0] - (b[2] - b[0]) * f - 0.02, b[1] - (b[3] - b[1]) * f - 0.015, b[2] + (b[2] - b[0]) * f + 0.02, b[3] + (b[3] - b[1]) * f + 0.015]
    T = {}
    # with no places yet (a built-in city, by its centre) the pack covers the whole centre: 3 km of streets, 6 km around
    T[14] = around(pts, 14, 3.0 if centre_only else 1.0) | (around([home], 14, 2.0) if home else set())
    T[13] = {(x // 2, y // 2) for x, y in T[14]} | around(pts, 13, 6.0 if centre_only else 2.0)
    T[12] = {(x // 2, y // 2) for x, y in T[13]}
    r = rect(pad(bb, 0.1), 12)
    if len(r) <= 16: T[12] |= r
    for z, lim in ((11, 16), (10, 12), (9, 9), (8, 6)):
        r = rect(pad(bb, 0.3 + (11 - z) * 0.4), z)
        T[z] = r if len(r) <= lim else {(x // 2, y // 2) for x, y in T[z + 1]}
    return T, bb, pts

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
    body = bytearray(); index = {}
    for (z, x, y), b in res:
        if not b: continue
        index['%d/%d/%d' % (z, x, y)] = [len(body), len(b)]; body += b
    allb = [tile_bounds(x, y, 12) for (x, y) in T[12]]
    hdr = {'v': 1, 'slug': slug, 'city': d.get('city'), 'country': d.get('country'), 't': index,
           'b': [min(b[0] for b in allb), min(b[1] for b in allb), max(b[2] for b in allb), max(b[3] for b in allb)],
           'places': [bb[0], bb[1], bb[2], bb[3]], 'zmin': min(T), 'zmax': max(T)}
    hj = json.dumps(hdr, separators=(',', ':')).encode()
    data = b'WPVT1\n' + struct.pack('>I', len(hj)) + hj + bytes(body)
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
