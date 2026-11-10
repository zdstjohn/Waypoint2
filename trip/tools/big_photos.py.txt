#!/usr/bin/env python3
"""Large copies of the photos that fill a header (the top of a day, each place in All days).

The app's photos are stored small (720 px): fine in a list, soft when one fills a wide screen. For the places a trip
actually has on its days (and the city itself), this fetches the same Wikimedia Commons picture at 1920 px, to be
uploaded as an asset and noted on the photo's record as "big". Nothing else about a record changes, and a record that
has a large copy is never fetched again.

  python3 big_photos.py prepare <db dir> <work dir> [max=40]
      reads <db>/wanted/*.json (what each trip uses) and <db>/photos/*.json; writes <work>/big/*.jpg,
      <work>/big_list.txt (the files to upload) and <work>/big_plan.json; prints a one-line summary
  python3 big_photos.py finish <db dir> <work dir> <uploaded.json>
      uploaded.json maps each local file path to the asset url its upload gave ("/_blob/<id>"); writes
      <work>/photos_big/<slug>.json, the full photos document for each city touched, ready to be saved
"""
import hashlib, io, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
UA = "WaypointTripPlanner/1.0 (family trip planner; large header photos)"
WIDTH = 1920

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def slug_of(country, city): return norm(country + " " + city).replace(" ", "-")[:80] or "x"

def load(d):
    out = {}
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.endswith(".json"):
                try: out[f[:-5]] = json.load(open(os.path.join(d, f), encoding="utf-8"))
                except Exception: pass
    return out

def commons_name(page):
    m = re.match(r"^https://commons\.wikimedia\.org/wiki/File:(.+)$", page or "")
    return urllib.parse.unquote(m.group(1)).replace(" ", "_") if m else None

def fetch(url):
    """the bytes, waiting and trying again when the server says it is busy (429)"""
    for wait in (0, 5, 15):
        if wait: time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if e.code != 429 and e.code < 500: raise
    raise IOError("busy")

# the app's own way of finding a place's photo (lib/photos.js): its exact name, else a stored sight whose identifying
# words are all in this name ("Portara (Temple of Apollo) at sunset" finds "portara"); the most specific one wins
GENERIC = set(("the and of at in on with from to near for by a an del della delle dei degli di de da la le les los las el il lo l d du des "
  "san santa santo sant saint st museum museo musee museu church chiesa iglesia eglise basilica cathedral duomo catedral castle castello "
  "castillo chateau palace palazzo palacio palais park parco parque garden gardens giardino jardin beach beaches spiaggia playa plage "
  "square piazza plaza place street via calle rue old town city centre center historic quarter district neighborhood neighbourhood "
  "tour tours visit walk stroll evening morning afternoon day trip sunset sunrise view views viewpoint national tower torre bridge ponte "
  "market mercato mercado gallery galleria art arts modern royal great grand little new lake lago mount monte island isola river port "
  "harbour harbor marina cafe food local famous best area hill hills coast village villages region temple fort fortress monastery "
  "abbey chapel fountain fontana gate porta arch").split())
def id_words(s, skip): return [w for w in norm(s).split() if len(w) > 2 and w not in GENERIC and w not in skip]
def photo_key(items, name, country, city):
    k = norm(name)
    if isinstance(items.get(k), dict) and items[k].get("url"): return k
    skip = set(id_words(country + " " + city, set())); have = set(id_words(name, skip)); best = None
    for key, p in items.items():
        if not isinstance(p, dict) or not p.get("url") or p.get("near"): continue
        ws = id_words(key, skip)
        if not (len(ws) >= 2 or (len(ws) == 1 and len(ws[0]) >= 6)): continue
        if all(w in have for w in ws) and (best is None or len(ws) > len(best[1]) or (len(ws) == len(best[1]) and len(key) < len(best[0]))): best = (key, ws)
    return best[0] if best else None

def big_jpeg(name):
    """the picture at 1920 px wide as JPEG bytes (Commons draws that size itself; else the original, made smaller here)"""
    from PIL import Image
    h = hashlib.md5(name.encode("utf-8")).hexdigest(); q = urllib.parse.quote(name)
    base = "https://upload.wikimedia.org/wikipedia/commons/"
    tries = [base + "thumb/%s/%s/%s/%dpx-%s" % (h[0], h[:2], q, WIDTH, q), base + "%s/%s/%s" % (h[0], h[:2], q)]
    for i, u in enumerate(tries):
        raw = fetch(u)                                 # raises when the server stays busy: counted as "later", not "small"
        if raw is None: continue
        try:
            im = Image.open(io.BytesIO(raw)); im.load()
            if im.width < 1000: return None            # the original is small: a "large copy" would be no sharper
            if im.width <= WIDTH and len(raw) <= 700000 and (im.format or "") == "JPEG" and i == 0: return raw
            im = im.convert("RGB"); im.thumbnail((WIDTH, WIDTH))
            out = io.BytesIO(); im.save(out, "JPEG", quality=82, optimize=True, progressive=True); return out.getvalue()
        except Exception: continue
    return None

def prepare(db, work, cap):
    wanted, photos = load(os.path.join(db, "wanted")), load(os.path.join(db, "photos"))
    today = time.strftime("%Y-%m-%d")
    order = sorted(wanted.items(), key=lambda kv: (0 if (kv[1].get("when") or "") >= today else 1, kv[1].get("when") or "9999", kv[0]))
    plan, seen = [], set()
    for slug, w in order:
        doc = photos.get(slug) or photos.get(slug_of(w.get("country", ""), w.get("city", "")))
        if not doc: continue
        items = doc.get("items") or {}
        food = {norm(n) for n in (w.get("food") or [])}
        names = [w.get("city", "")] + [u[0] for u in (w.get("used") or []) if isinstance(u, list) and u and norm(u[0]) not in food]
        for n in names:
            k = photo_key(items, n, w.get("country", ""), w.get("city", "")); it = items.get(k) if k else None
            if not isinstance(it, dict) or it.get("big") or it.get("near") or not it.get("url"): continue
            name = commons_name(it.get("page"))
            if not name or (slug, k) in seen: continue
            seen.add((slug, k)); plan.append({"slug": slug, "key": k, "name": name})
    os.makedirs(os.path.join(work, "big"), exist_ok=True)
    done, small, later = [], 0, 0
    for p in plan: p["file"] = os.path.join(work, "big", "%s__%s.jpg" % (p["slug"], hashlib.md5(p["key"].encode()).hexdigest()[:10]))
    have = lambda p: os.path.exists(p["file"]) and os.path.getsize(p["file"]) > 20000
    for p in plan:
        if have(p): done.append(p); continue           # fetched on an earlier go
        if len(done) >= cap or later >= 3: continue    # enough for one night, or the photo server is refusing: the rest waits
        try: data = big_jpeg(p["name"])
        except Exception: later += 1; continue
        if data is None: small += 1; continue
        open(p["file"], "wb").write(data); done.append(p); time.sleep(2.5)
    json.dump(done, open(os.path.join(work, "big_plan.json"), "w"), indent=1)
    open(os.path.join(work, "big_list.txt"), "w").write("\n".join(p["file"] for p in done) + ("\n" if done else ""))
    print(json.dumps({"photos": len(done), "cities": len({p["slug"] for p in done}), "wanted": len(plan), "waiting": max(0, len(plan) - len(done) - small), "original_too_small": small, "server_busy": later,
                      "bytes": sum(os.path.getsize(p["file"]) for p in done)}))

def finish(db, work, uploaded):
    up = json.load(open(uploaded, encoding="utf-8")); plan = json.load(open(os.path.join(work, "big_plan.json")))
    photos = load(os.path.join(db, "photos")); out = os.path.join(work, "photos_big"); os.makedirs(out, exist_ok=True)
    touched, n = {}, 0
    for p in plan:
        url = up.get(p["file"]) or up.get(os.path.basename(p["file"]))
        doc = touched.get(p["slug"]) or photos.get(p["slug"])
        if not url or not str(url).startswith("/_blob/") or not doc: continue
        it = (doc.get("items") or {}).get(p["key"])
        if not isinstance(it, dict): continue
        it["big"] = url; touched[p["slug"]] = doc; n += 1
    for slug, doc in touched.items(): json.dump(doc, open(os.path.join(out, slug + ".json"), "w"), ensure_ascii=False)
    print(json.dumps({"large_copies": n, "cities": sorted(touched)}))

if __name__ == "__main__":
    a = sys.argv
    if len(a) >= 4 and a[1] == "prepare": prepare(a[2], a[3], int(a[4]) if len(a) > 4 else 40)
    elif len(a) >= 5 and a[1] == "finish": finish(a[2], a[3], a[4])
    else: print(__doc__); sys.exit(2)
