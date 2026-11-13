"""Turn a street-map pack (.bin or .wasm from build.py) into parts the artifact's asset store accepts, and write the
database record the app reads (collection "maps", one document per city) once the parts are uploaded.

  python3 pack2json.py split <pack file> <out_dir>            -> <out_dir>/<slug>.p0.json, .p1.json, ... (rename each to
                                                                 .js for the upload, as before)
  python3 pack2json.py record <pack file> <uploaded.json> <out_dir>
                                                              -> <out_dir>/<slug>.json, the maps/<slug> document:
                                                                 {slug, city, country, b, places, parts: [url, ...], size, built, lay}
  python3 pack2json.py relayout <pack file> <out file> [lat lng]   -> the same tiles, town centre first (an older pack)
  <uploaded.json> maps each part file name (e.g. "italy-rome.p0.json" or "italy-rome.p0.js") to the asset url the upload
  gave ("/_blob/<id>").

The town centre first ("lay": 2). A pack's tiles are in the order the map needs them: the tiles of the screen the map
opens at (the town's frame on a phone), then the streets within about a kilometre of where you stay (where the map goes
next, to the day's stops), then the frame on a wide screen; the rest after, nearest first. The first part holds just the
opening screen, the second the rest of the first screen, the others the remainder, and the app draws each tile as soon
as its bytes are in (vt/packworker.js reads a part as it arrives), so the map is up after a small download instead of
the whole pack. Packs made before keep working as they are.

Parts are JSON, the pack's bytes in basE91 (13 bits in 2 characters, 23% over the bytes where base64 is 33%): {"v":2,
"slug":..,"part":i,"of":n,"enc":"b91","at":<pack offset>,"n":<bytes>,"size":<pack bytes>,"d":".."}, "d" last. The
alphabet leaves out the quote and the backslash, so "d" needs no escapes and the text is plain ASCII (the asset store
keeps JSON and JavaScript text byte for byte). Older parts ({"v":1,..,"b64":".."}) are still read everywhere.
Map data (c) OpenMapTiles (c) OpenStreetMap contributors (ODbL), tiles from OpenFreeMap."""
import base64, json, math, os, struct, sys, time

CHUNK = 10 * 1000 * 1000   # pack bytes per part at most: basE91 of this is 12.3 MB, under the 16 MiB script-asset limit
MIN_PART = 160 * 1000       # a first part smaller than this is not cut off on its own (one more request isn't worth it)
LAY = 2

# ---- basE91 (Joachim Henke's scheme), with the double quote swapped for the apostrophe so it sits in JSON as it is ----
B91 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~'"
assert len(B91) == 91 and '"' not in B91 and "\\" not in B91
_ENC2 = None


def b91enc(data):
    """bytes -> basE91 text"""
    global _ENC2
    if _ENC2 is None:   # every 13- or 14-bit value as its two characters, made once
        _ENC2 = [B91[v % 91] + B91[v // 91] for v in range(91 * 91)]
    enc2, out, b, n = _ENC2, [], 0, 0
    ap = out.append
    for byte in data:
        b |= byte << n
        n += 8
        if n > 13:
            v = b & 8191
            if v > 88:
                b >>= 13; n -= 13
            else:
                v = b & 16383; b >>= 14; n -= 14
            ap(enc2[v])
    if n:
        ap(B91[b % 91])
        if n > 7 or b > 90:
            ap(B91[b // 91])
    return "".join(out)


def b91dec(text):
    """basE91 text -> bytes (the app's decoder is in vt/packworker.js and lib/vtmap.js; this one is for the tests)"""
    dec = {c: i for i, c in enumerate(B91)}
    out, v, b, n = bytearray(), -1, 0, 0
    for ch in text:
        c = dec[ch]
        if v < 0:
            v = c
        else:
            v += c * 91
            b |= v << n
            n += 13 if (v & 8191) > 88 else 14
            while n > 7:
                out.append(b & 255); b >>= 8; n -= 8
            v = -1
    if v >= 0:
        out.append((b | v << n) & 255)
    return bytes(out)


# ---- the pack ----
def unwrap(data):
    """a pack inside a WebAssembly custom section (how the older files were published) -> the bare pack"""
    if data[:4] == b"\x00asm":
        i = 9   # 8-byte header, then the custom section's id byte
        def leb():
            nonlocal i; v = 0; sh = 0
            while True:
                c = data[i]; i += 1; v += (c & 0x7f) << sh; sh += 7
                if c < 0x80: return v
        leb(); n = leb(); i += n; data = data[i:]   # section size, then the section name
    assert data[:6] == b"WPVT1\n", "not a Waypoint map pack"
    return data


def header(data):
    n = struct.unpack(">I", data[6:10])[0]
    return json.loads(data[10:10 + n].decode())


def tiles_of(data):
    """a pack -> (header, [((z, x, y), gzipped tile bytes)] in the pack's order)"""
    n = struct.unpack(">I", data[6:10])[0]; h = json.loads(data[10:10 + n].decode()); body = data[10 + n:]
    out = []
    for k, (o, l) in sorted(h["t"].items(), key=lambda kv: kv[1][0]):
        out.append((tuple(int(v) for v in k.split("/")), body[o:o + l]))
    return h, out


def assemble(hdr, tiles):
    """header fields + tiles in order -> the pack's bytes (the index says where each tile is)"""
    body = bytearray(); index = {}
    for (z, x, y), b in tiles:
        if not b: continue
        index["%d/%d/%d" % (z, x, y)] = [len(body), len(b)]; body += b
    hdr = dict(hdr); hdr["t"] = index
    hj = json.dumps(hdr, separators=(",", ":")).encode()
    return b"WPVT1\n" + struct.pack(">I", len(hj)) + hj + bytes(body)


# ---- which tiles the map needs first ----
# The map opens on the town's frame ("places") fitted to its box, then goes to the day's stops. A phone's map is
# 378 x 367 px (a 390-px screen: .map-wrap.vt-on, aspect 34/33, 6-px margins), a desktop pane about 980 x 820.
PHONE = (378, 367)
DESK = (980, 820)
NEAR_KM = {12: 2.5, 13: 1.6, 14: 1.0}   # "where you stay": the streets the map shows next, around the day's stops


def tile_box(z, x, y):
    n = 2 ** z
    lat = lambda t: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * t / n))))
    return [x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)]   # w, s, e, n


def km(a, b):
    la1, ln1, la2, ln2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((ln2 - ln1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(min(1.0, h)))


def box_km(anchor, b):
    """from a point (lat, lng) to the nearest edge of a tile's box (0 inside it)"""
    return km(anchor, (min(max(anchor[0], b[1]), b[3]), min(max(anchor[1], b[0]), b[2])))


def opening(places, size):
    """the zoom and the box (w, s, e, n) the map opens at: MapLibre fits the frame into the map, no padding"""
    w, h = size
    merc = lambda la: math.log(math.tan(math.pi / 4 + math.radians(max(-85.0, min(85.0, la))) / 2))
    unmerc = lambda m: math.degrees(2 * math.atan(math.exp(m)) - math.pi / 2)
    dx = max(places[2] - places[0], 1e-7) / 360
    dy = max(merc(places[3]) - merc(places[1]), 1e-9) / (2 * math.pi)
    zoom = min(math.log2(w / (dx * 512)), math.log2(h / (dy * 512)))
    scale = 512 * 2 ** zoom
    cx = (places[0] + places[2]) / 2; cy = (merc(places[1]) + merc(places[3])) / 2
    hw = w / 2 / scale * 360; hh = h / 2 / scale * 2 * math.pi
    return zoom, [cx - hw, unmerc(cy - hh), cx + hw, unmerc(cy + hh)]


def needed(keys, zoom, box, zmin):
    """the tiles a view at this zoom draws: the coarse map (to z12) always, the detailed one (z13-14) from zoom 13"""
    meets = lambda b: b[0] <= box[2] and b[2] >= box[0] and b[1] <= box[3] and b[3] >= box[1]
    zs = {max(zmin, min(12, int(math.floor(zoom))))}
    if zoom >= 13: zs.add(min(14, int(math.floor(zoom))))
    return {k for k in keys if k[0] in zs and meets(tile_box(*k))}


def layout(tiles, places, anchor=None, pts=()):
    """tiles [((z, x, y), bytes)] -> (the same tiles in the order the map needs them, body bytes of the opening screen,
    body bytes of the whole first screen). anchor = (lat, lng) of where you stay (the frame's centre if not known);
    pts = the trip's places (a tile holding one counts as three times closer, as build.py's trim does)."""
    if not anchor: anchor = ((places[1] + places[3]) / 2, (places[0] + places[2]) / 2)
    keys = [k for k, b in tiles if b]
    zmin = min(k[0] for k in keys) if keys else 8
    size = {k: len(b) for k, b in tiles if b}
    dist = {k: box_km(anchor, tile_box(*k)) for k in keys}
    def score(k):
        b = tile_box(*k)
        has = any(b[0] <= p[1] <= b[2] and b[1] <= p[0] <= b[3] for p in pts)
        return (dist[k] / 3 if has else dist[k], k[0])
    zp, boxp = opening(places, PHONE); zd, boxd = opening(places, DESK)
    g1 = needed(keys, zp, boxp, zmin)                                                   # the phone's opening screen
    g2 = {k for k in keys if k[0] in NEAR_KM and dist[k] <= NEAR_KM[k[0]]} - g1        # around where you stay
    g3 = needed(keys, zd, boxd, zmin) - g1 - g2                                         # a wide screen's opening
    rest = set(keys) - g1 - g2 - g3
    order = []
    for g in (g1, g2, g3, rest):
        order += sorted(g, key=lambda k: (dist[k], k[0], k[1], k[2]) if g is not rest else score(k) + (k[1], k[2]))
    by = dict((k, b) for k, b in tiles if b)
    out = [(k, by[k]) for k in order]
    return out, sum(size[k] for k in g1), sum(size[k] for k in g1 | g2 | g3)


def relayout(data, anchor=None):
    """an older pack -> the same tiles and header, town centre first ("lay": 2); a pack already laid out is returned as is"""
    data = unwrap(data); h = header(data)
    if h.get("lay") == LAY: return data
    h, tiles = tiles_of(data)
    if not anchor and h.get("c"): anchor = (h["c"][1], h["c"][0])
    places = h.get("places") or h["b"]
    out, o1, o2 = layout(tiles, places, anchor)
    if not anchor: anchor = ((places[1] + places[3]) / 2, (places[0] + places[2]) / 2)
    h.update({"lay": LAY, "c": [round(anchor[1], 5), round(anchor[0], 5)], "open": o1, "first": o2})
    return assemble(h, out)


def cuts(data):
    """where the parts begin and end (pack offsets): the opening screen, the rest of the first screen, then CHUNK pieces.
    A pack laid out before has no first screen: CHUNK pieces only."""
    h = header(data); body0 = 10 + struct.unpack(">I", data[6:10])[0]; total = len(data)
    marks = [0]
    if h.get("lay") == LAY:
        for o in (h.get("open") or 0, h.get("first") or 0):
            at = body0 + o
            if at - marks[-1] >= MIN_PART and total - at >= MIN_PART: marks.append(at)
    while total - marks[-1] > CHUNK: marks.append(marks[-1] + CHUNK)
    marks.append(total)
    return [(marks[i], marks[i + 1]) for i in range(len(marks) - 1)]


def part_doc(slug, i, of, at, piece, total):
    """one part's text: its facts first, the bytes ("d") last, so a reader can start on the bytes as they arrive"""
    meta = json.dumps({"v": 2, "slug": slug, "part": i, "of": of, "enc": "b91", "at": at, "n": len(piece), "size": total}, separators=(",", ":"))
    return meta[:-1] + ',"d":"' + b91enc(piece) + '"}'


def prepared(path):
    """a pack file -> the bytes its parts carry: laid out town centre first (an older pack is laid out now)"""
    return relayout(open(path, "rb").read())


def split(path, out):
    data = prepared(path); h = header(data); slug = h["slug"]
    os.makedirs(out, exist_ok=True); cs = cuts(data); sizes = []
    for i, (a, b) in enumerate(cs):
        text = part_doc(slug, i, len(cs), a, data[a:b], len(data))
        open(os.path.join(out, "%s.p%d.json" % (slug, i)), "w", encoding="ascii").write(text); sizes.append(len(text))
    print(json.dumps({"slug": slug, "parts": len(cs), "bytes": len(data), "text": sizes}))


def record(path, uploaded, out):
    data = prepared(path); h = header(data); slug = h["slug"]
    up = json.load(open(uploaded)); urls = []
    for i in range(len(cuts(data))):
        u = None
        for ext in (".json", ".js"):   # the upload's names, before or after the rename to .js
            k = "%s.p%d%s" % (slug, i, ext)
            u = u or up.get(k) or up.get(os.path.join(os.path.dirname(path), k))
        if not u: print("missing upload for %s.p%d" % (slug, i), file=sys.stderr); sys.exit(1)
        urls.append(u)
    os.makedirs(out, exist_ok=True)
    doc = {"slug": slug, "city": h.get("city") or "", "country": h.get("country") or "", "b": h["b"], "places": h.get("places") or h["b"], "parts": urls, "size": len(data), "built": time.strftime("%Y-%m-%d"), "lay": LAY}
    json.dump(doc, open(os.path.join(out, slug + ".json"), "w"), separators=(",", ":"))
    print(json.dumps({"slug": slug, "parts": len(urls)}))


def main():
    a = sys.argv
    if len(a) >= 4 and a[1] == "split": split(a[2], a[3])
    elif len(a) >= 5 and a[1] == "record": record(a[2], a[3], a[4])
    elif len(a) in (4, 6) and a[1] == "relayout":
        anchor = (float(a[4]), float(a[5])) if len(a) == 6 else None
        open(a[3], "wb").write(relayout(open(a[2], "rb").read(), anchor))
    else: print(__doc__)


if __name__ == "__main__":
    main()
