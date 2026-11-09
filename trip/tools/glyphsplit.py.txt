"""Split the glyph pack in two: the letters nearly every map needs (basic Latin incl. accents, punctuation) and the rest
(extended Latin, Greek, Cyrillic), which the app fetches only when a label needs them.
  python3 glyphsplit.py <glyphs.wasm> <out_dir>   -> <out_dir>/glyphs.wasm (core), <out_dir>/glyphs-ext.wasm"""
import json, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack2json import unwrap, header
CORE = lambda start: start < 256 or start >= 8192

def leb(n):
    out = bytearray()
    while True:
        b = n & 0x7f; n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)

def wrap(payload, name=b"waypoint"):
    sec = leb(len(name)) + name + payload
    return b"\x00asm\x01\x00\x00\x00" + b"\x00" + leb(len(sec)) + sec

def pack(hdr, pieces):
    body = bytearray(); t = {}
    for k, b in pieces.items(): t[k] = [len(body), len(b)]; body += b
    h = dict(hdr); h["t"] = t
    hb = json.dumps(h, separators=(",", ":")).encode()
    return b"WPVT1\n" + struct.pack(">I", len(hb)) + hb + bytes(body)

def main(src, out):
    d = unwrap(open(src, "rb").read()); h = header(d); n = struct.unpack(">I", d[6:10])[0]; body = d[10 + n:]
    core, ext = {}, {}
    for k, (o, l) in h["t"].items():
        start = int(k.rsplit("/", 1)[1].split("-")[0])
        (core if CORE(start) else ext)[k] = body[o:o + l]
    os.makedirs(out, exist_ok=True)
    for name, pieces in (("glyphs.wasm", core), ("glyphs-ext.wasm", ext)):
        data = wrap(pack(h, pieces)); open(os.path.join(out, name), "wb").write(data)
        print(name, len(pieces), "ranges", len(data) // 1024, "KB")

if __name__ == "__main__": main(sys.argv[1], sys.argv[2])
