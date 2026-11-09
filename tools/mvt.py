"""Minimal Mapbox Vector Tile tools: split a tile into its layers and rebuild it with only some layers (no geometry re-encoding)."""
import gzip, json, math, urllib.request

UA = {'User-Agent': 'WaypointTripPlanner/1.0 (personal trip planner map)', 'Accept-Encoding': 'gzip'}

def varint(b, i):
    s = 0; n = 0
    while True:
        c = b[i]; i += 1; n |= (c & 0x7f) << s; s += 7
        if c < 0x80: return n, i

def enc_varint(n):
    out = bytearray()
    while True:
        c = n & 0x7f; n >>= 7
        if n: out.append(c | 0x80)
        else: out.append(c); return bytes(out)

def layers(tile):
    """yield (name, raw layer message bytes) for each layer in a tile"""
    i = 0
    while i < len(tile):
        key, i = varint(tile, i); f, wt = key >> 3, key & 7
        if wt == 2:
            ln, i = varint(tile, i); body = tile[i:i + ln]; i += ln
            if f == 3: yield layer_name(body), body
        elif wt == 0: _, i = varint(tile, i)
        elif wt == 1: i += 8
        elif wt == 5: i += 4
        else: raise ValueError('bad wire type')

def layer_name(body):
    i = 0
    while i < len(body):
        key, i = varint(body, i); f, wt = key >> 3, key & 7
        if wt == 2:
            ln, i = varint(body, i)
            if f == 1: return body[i:i + ln].decode()
            i += ln
        elif wt == 0: _, i = varint(body, i)
        elif wt == 1: i += 8
        elif wt == 5: i += 4
    return ''

def rebuild(parts):
    out = bytearray()
    for body in parts: out += b'\x1a' + enc_varint(len(body)) + body
    return bytes(out)

def get(url):
    r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40); b = r.read()
    return gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b

def tilexy(lat, lng, z):
    n = 2 ** z; lat = max(-85, min(85, lat))
    x = int((lng + 180) / 360 * n); y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


# ---------- slimming: keep only what the app's map style draws ----------
def fields(b):
    i = 0
    while i < len(b):
        key, i = varint(b, i); f, wt = key >> 3, key & 7
        if wt == 2:
            ln, i = varint(b, i); yield f, wt, b[i:i + ln]; i += ln
        elif wt == 0:
            v, i = varint(b, i); yield f, wt, v
        elif wt == 1: yield f, wt, b[i:i + 8]; i += 8
        elif wt == 5: yield f, wt, b[i:i + 4]; i += 4
        else: raise ValueError('wire type %d' % wt)

def packed(b):
    out = []; i = 0
    while i < len(b): v, i = varint(b, i); out.append(v)
    return out

def value_of(raw):
    for f, wt, v in fields(raw):
        if f == 1: return v.decode('utf-8', 'replace')
        if f in (4, 5): return v
        if f == 6: return (v >> 1) ^ -(v & 1)
        if f == 7: return bool(v)
        if f in (2, 3):
            import struct
            return struct.unpack('<f' if f == 2 else '<d', v)[0]
    return None

def slim_layer(body, keep_keys, keep_feature=None):
    name = ''; feats = []; keys = []; vals = []; extent = 4096; version = 2
    for f, wt, v in fields(body):
        if f == 1: name = v.decode()
        elif f == 2: feats.append(v)
        elif f == 3: keys.append(v.decode())
        elif f == 4: vals.append(v)
        elif f == 5: extent = v
        elif f == 15: version = v
    nk, nv, ki, vi, out_feats = [], [], {}, {}, []
    for fb in feats:
        fid = None; tags = []; gtype = 0; geom = b''
        for f, wt, v in fields(fb):
            if f == 1: fid = v
            elif f == 2: tags = packed(v)
            elif f == 3: gtype = v
            elif f == 4: geom = v
        props = {keys[tags[j]]: tags[j + 1] for j in range(0, len(tags) - 1, 2)}
        if keep_feature and not keep_feature({k: value_of(vals[x]) for k, x in props.items()}): continue
        # one name per feature: the Latin-script one when there is one (what the map labels show)
        nm = next((props[k] for k in ('name:latin', 'name_en', 'name_int', 'name') if k in props), None)
        for k in list(props):
            if k in NAMES: del props[k]
        if nm is not None and 'name' in keep_keys: props['name'] = nm
        nt = []
        for k, x in props.items():
            if k not in keep_keys: continue
            if k not in ki: ki[k] = len(nk); nk.append(k)
            raw = vals[x]
            if raw not in vi: vi[raw] = len(nv); nv.append(raw)
            nt += [ki[k], vi[raw]]
        fo = bytearray()
        if fid is not None: fo += b'\x08' + enc_varint(fid)
        if nt:
            p = b''.join(enc_varint(t) for t in nt); fo += b'\x12' + enc_varint(len(p)) + p
        fo += b'\x18' + enc_varint(gtype)
        fo += b'\x22' + enc_varint(len(geom)) + geom
        out_feats.append(bytes(fo))
    if not out_feats: return None
    o = bytearray(b'\x78' + enc_varint(version))
    nb = name.encode(); o += b'\x0a' + enc_varint(len(nb)) + nb
    for fo in out_feats: o += b'\x12' + enc_varint(len(fo)) + fo
    for k in nk: kb = k.encode(); o += b'\x1a' + enc_varint(len(kb)) + kb
    for raw in nv: o += b'\x22' + enc_varint(len(raw)) + raw
    o += b'\x28' + enc_varint(extent)
    return bytes(o)

NAMES = {'name', 'name:latin', 'name_en', 'name_int'}
KEEP = {
    'water': {'class', 'brunnel', 'intermittent'},
    'waterway': {'class', 'brunnel', 'intermittent'} | NAMES,
    'landcover': {'class', 'subclass'},
    'landuse': {'class'},
    'park': {'class'} | NAMES | {'rank'},
    'building': {'render_height', 'render_min_height', 'hide_3d'},
    'transportation': {'class', 'subclass', 'brunnel', 'ramp', 'oneway', 'layer', 'service', 'network', 'level'},
    'transportation_name': {'class', 'subclass', 'brunnel', 'ref', 'network', 'layer'} | NAMES,
    'water_name': {'class', 'intermittent'} | NAMES,
    'place': {'class', 'rank', 'capital'} | NAMES,
    'poi': {'class', 'subclass', 'rank'} | NAMES,
    'mountain_peak': {'class', 'ele'} | NAMES | {'rank'},
    'boundary': {'admin_level', 'maritime', 'disputed'},
}
POI_CLASSES = {'attraction', 'museum', 'castle', 'monument', 'place_of_worship', 'park', 'garden', 'zoo', 'theatre', 'stadium',
               'railway', 'ferry_terminal', 'aerialway', 'harbor', 'beach', 'town_hall', 'library', 'art_gallery', 'information', 'viewpoint', 'bus'}
def keep_poi(p):
    c = p.get('class')
    if c not in POI_CLASSES: return False
    if c == 'bus': return p.get('subclass') == 'bus_station'
    if c == 'information': return False
    if c == 'railway': return p.get('subclass') in ('station', 'halt', 'subway')
    if not p.get('name:latin') and not p.get('name'): return False
    if c == 'place_of_worship': return (p.get('rank') or 99) <= 12   # only the notable churches, temples and mosques
    return (p.get('rank') or 99) <= 40
def keep_boundary(p): return (p.get('admin_level') or 9) <= 4 and not p.get('maritime')

def slim_tile(raw, z=14):
    parts = []
    def keep_road(p):   # zoomed out, the little lanes and footpaths only add clutter
        return z >= 13 or p.get('class') not in ('path', 'track', 'service')
    def keep_road_name(p):   # footpath and service-lane names crowd out the street names people navigate by
        return p.get('class') not in ('path', 'track', 'service', 'busway', 'rail', 'transit') and (z >= 13 or p.get('class') not in ('minor',))
    for name, body in layers(raw):
        if name not in KEEP: continue
        if name == 'building' and z < 13: continue
        flt = {'poi': keep_poi, 'boundary': keep_boundary, 'transportation': keep_road, 'transportation_name': keep_road_name}.get(name)
        s = slim_layer(body, KEEP[name], flt)
        if s: parts.append(s)
    return rebuild(parts)
