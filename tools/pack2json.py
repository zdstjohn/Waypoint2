"""Turn a street-map pack (.bin or .wasm from build.py) into JSON parts the artifact's asset store accepts, and write the
database record the app reads (collection "maps", one document per city) once the parts are uploaded.

  python3 pack2json.py split <pack file> <out_dir>            -> <out_dir>/<slug>.p0.json, .p1.json, ... (each under 10 MB of pack
                                                                 bytes, base64 in {"v":1,"slug":..,"part":i,"of":n,"b64":".."})
  python3 pack2json.py record <pack file> <uploaded.json> <out_dir>
                                                              -> <out_dir>/<slug>.json, the maps/<slug> document:
                                                                 {slug, city, country, b, places, parts: [url, ...], size, built}
  <uploaded.json> maps each part file name (e.g. "italy-rome.p0.json") to the asset url the upload gave ("/_blob/<id>").
Map data © OpenMapTiles © OpenStreetMap contributors (ODbL), tiles from OpenFreeMap."""
import base64, json, os, struct, sys, time
CHUNK = 10 * 1000 * 1000   # pack bytes per part: base64 of this is 13.4 MB, under the 16 MiB text-asset limit

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

def split(path, out):
    data = unwrap(open(path, "rb").read()); h = header(data); slug = h["slug"]
    os.makedirs(out, exist_ok=True); parts = [data[i:i + CHUNK] for i in range(0, len(data), CHUNK)]
    for i, p in enumerate(parts):
        json.dump({"v": 1, "slug": slug, "part": i, "of": len(parts), "b64": base64.b64encode(p).decode()}, open(os.path.join(out, "%s.p%d.json" % (slug, i)), "w"), separators=(",", ":"))
    print(json.dumps({"slug": slug, "parts": len(parts), "bytes": len(data)}))

def record(path, uploaded, out):
    data = unwrap(open(path, "rb").read()); h = header(data); slug = h["slug"]
    up = json.load(open(uploaded)); urls = []
    n = (len(data) + CHUNK - 1) // CHUNK
    for i in range(n):
        k = "%s.p%d.json" % (slug, i)
        u = up.get(k) or up.get(os.path.join(os.path.dirname(path), k))
        if not u: print("missing upload for", k, file=sys.stderr); sys.exit(1)
        urls.append(u)
    os.makedirs(out, exist_ok=True)
    doc = {"slug": slug, "city": h.get("city") or "", "country": h.get("country") or "", "b": h["b"], "places": h.get("places") or h["b"], "parts": urls, "size": len(data), "built": time.strftime("%Y-%m-%d")}
    json.dump(doc, open(os.path.join(out, slug + ".json"), "w"), separators=(",", ":"))
    print(json.dumps({"slug": slug, "parts": len(urls)}))

if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "split": split(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 5 and sys.argv[1] == "record": record(sys.argv[2], sys.argv[3], sys.argv[4])
    else: print(__doc__)
