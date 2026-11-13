"""A small made-up street-map pack for the tests, written the way the nightly task writes a real one (tools/pack2json.py):
    python3 test/lib/mkpack.py <out dir>   -> parts <slug>.p0.json ... in the dir, and on stdout one JSON line:
    {"slug", "parts": [names], "sizes": [bytes], "tiles": {"z/x/y": sha256 of the tile once unzipped}, "order": [keys in pack order],
     "open": body bytes of the opening screen, "size": pack bytes}
The tiles are random bytes zipped (like real ones, they don't shrink further), at the zooms a real pack has, and the
parts are cut small so that there are several."""
import gzip, hashlib, json, math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
import pack2json as P

def tilexy(lat, lng, z):
    n = 2 ** z
    return int((lng + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

def make(out):
    rng = random.Random(7)
    lat, lng = 40.0, -3.0
    tiles, digest = [], {}
    for z, r in ((8, 0), (9, 0), (10, 0), (11, 1), (12, 2), (13, 3), (14, 4)):
        cx, cy = tilexy(lat, lng, z)
        for x in range(cx - r, cx + r + 1):
            for y in range(cy - r, cy + r + 1):
                raw = rng.randbytes(rng.randint(2000, 30000)); gz = gzip.compress(raw, 1)
                tiles.append(((z, x, y), gz)); digest["%d/%d/%d" % (z, x, y)] = hashlib.sha256(raw).hexdigest()
    hdr = {"v": 1, "slug": "syn-town", "city": "Synton", "country": "Testland", "b": [-3.3, 39.8, -2.7, 40.2], "places": [lng - 0.02, lat - 0.015, lng + 0.02, lat + 0.015], "zmin": 8, "zmax": 14, "c": [lng, lat]}
    old = P.assemble(hdr, sorted(tiles))   # an older pack: in z, x, y order
    data = P.relayout(old)
    P.CHUNK = 800000; P.MIN_PART = 20000
    open(os.path.join(out, "old.bin"), "wb").write(old); open(os.path.join(out, "new.bin"), "wb").write(data)
    cs = P.cuts(data); names, sizes = [], []
    for i, (a, b) in enumerate(cs):
        text = P.part_doc("syn-town", i, len(cs), a, data[a:b], len(data))
        names.append("syn-town.p%d.json" % i); sizes.append(len(text))
        open(os.path.join(out, names[-1]), "w", encoding="ascii").write(text)
    h = P.header(data); body0 = 10 + len(json.dumps(h, separators=(",", ":")).encode())
    order = [k for k, _ in sorted(h["t"].items(), key=lambda kv: kv[1][0])]
    print(json.dumps({"slug": "syn-town", "parts": names, "sizes": sizes, "tiles": digest, "order": order, "open": h["open"], "first": h["first"], "size": len(data), "index": h["t"]}))

if __name__ == "__main__":
    os.makedirs(sys.argv[1], exist_ok=True); make(sys.argv[1])
