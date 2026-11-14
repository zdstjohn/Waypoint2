#!/usr/bin/env python3
"""Blurred previews for the photos trips use (until v200 also large copies, small copies and WebP twins).

v201: only the blurred preview ("lq", on the record, no file) is still made, for a photo that lacks one and is not
in its city's pack; nothing is uploaded. The copies below filled the app's file store. What follows describes the
records as they are, and the old steps for reference.

The app's photos are stored at 720 px (JPEG): fine in a list, soft when one fills a wide screen, and heavy for a
72 px thumbnail. For the places a trip actually has on its days (and the city itself) this fetches the same Wikimedia
Commons picture again and makes, for photos whose record lacks them:
  big     the 1920 px copy that fills a header (as before; only for a place's own photo, never one taken nearby)
  sm      a small copy (320 px wide) for thumbnails, and "smw", its width
  webp    {sm, url, big}: the same pictures as WebP (about 30% smaller at the same SSIM)
  lq      a 16 px blurred preview (base64 WebP), shown until the photo has loaded
Nothing else about a record changes, and a record that has a copy never gets it again. The number made per night is
capped: <max> large fetches (1920 px, half a megabyte each) and <small> small-copy fetches (720 px, about 60 KB).

  python3 big_photos.py prepare <db dir> <work dir> [max=40] [small=80]
      reads <db>/wanted/*.json (what each trip uses) and <db>/photos/*.json; writes the files under <work>/big/,
      <work>/big_list.txt (the files to upload) and <work>/big_plan.json; prints a one-line summary
  python3 big_photos.py finish <db dir> <work dir> <uploaded.json>
      uploaded.json maps each local file path to the asset url its upload gave ("/_blob/<id>"); writes
      <work>/photos_big/<slug>.json, the full photos document for each city touched, ready to be saved
"""
import hashlib, io, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
UA = "WaypointTripPlanner/1.0 (family trip planner; photo copies)"
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

# ---- the copies of one photo: normal (720 px), small, WebP twins and a tiny blurred preview ----
# Small: 320 px wide (a stop's thumbnail is 72-96 CSS px, 288 device px at 3x), never taller than 480. WebP quality was
# chosen by SSIM on real photos so each WebP looks as good as the JPEG it sits beside and is about 30% smaller:
# JPEG q74 (normal, small) = WebP q70; JPEG q82 (large) = WebP q81. The preview is a 16 px wide WebP as base64 (about 140
# characters; the app adds "data:image/webp;base64,"): every photo record is read when the app opens, so it stays tiny.
SM_BOX, LQ_W = (320, 480), 16
JPEG_Q, WEBP_Q = {"url": 74, "sm": 74, "big": 82}, {"url": 70, "sm": 70, "big": 81}

def _save(im, fmt, **kw):
    out = io.BytesIO()
    im.save(out, fmt, **kw)
    return out.getvalue()

def jpeg_bytes(im, kind="url"):
    return _save(im.convert("RGB"), "JPEG", quality=JPEG_Q[kind], optimize=True, progressive=True)

def webp_bytes(im, kind="url"):
    return _save(im.convert("RGB"), "WEBP", quality=WEBP_Q[kind], method=6)

def small_copy(im):
    from PIL import Image
    c = im.convert("RGB")
    c.thumbnail(SM_BOX, Image.LANCZOS)
    return c

def tiny_preview(im):
    """a 16 px wide stand-in, base64 of a WebP (about 140 characters): the app blurs it and shows it until the photo has loaded"""
    import base64
    from PIL import Image
    w, h = im.size
    c = im.convert("RGB").resize((LQ_W, max(1, round(LQ_W * h / max(w, 1)))), Image.LANCZOS)
    return base64.b64encode(_save(c, "WEBP", quality=30, method=6)).decode()

def copies(im, base):
    """writes the small JPEG, the small and normal WebP next to <base>.jpg (the normal JPEG itself is written by the
    caller); returns what goes on the photo's record: files {sm, smwebp, webp}, lq, w (normal width), smw (small width)"""
    sm = small_copy(im)
    files = {"sm": base + ".sm.jpg", "smwebp": base + ".sm.webp", "webp": base + ".webp"}
    open(files["sm"], "wb").write(jpeg_bytes(sm, "sm"))
    open(files["smwebp"], "wb").write(webp_bytes(sm, "sm"))
    open(files["webp"], "wb").write(webp_bytes(im, "url"))
    return {"files": files, "lq": tiny_preview(im), "w": im.width, "smw": sm.width}

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

def commons_jpeg(name, width):
    """the picture at <width> px wide as JPEG bytes (Commons draws that size itself; else the original, made smaller
    here). None when the original is too small for a copy that big to be any sharper"""
    from PIL import Image
    h = hashlib.md5(name.encode("utf-8")).hexdigest(); q = urllib.parse.quote(name)
    base = "https://upload.wikimedia.org/wikipedia/commons/"
    tries = [base + "thumb/%s/%s/%s/%dpx-%s" % (h[0], h[:2], q, width, q), base + "%s/%s/%s" % (h[0], h[:2], q)]
    for i, u in enumerate(tries):
        raw = fetch(u)                                 # raises when the server stays busy: counted as "later", not "small"
        if raw is None: continue
        try:
            im = Image.open(io.BytesIO(raw)); im.load()
            if width >= 1000 and im.width < 1000: return None   # the original is small: a "large copy" would be no sharper
            if im.width <= width and len(raw) <= 700000 and (im.format or "") == "JPEG" and i == 0: return raw
            im = im.convert("RGB"); im.thumbnail((width, width))
            out = io.BytesIO(); im.save(out, "JPEG", quality=JPEG_Q["big"] if width >= 1000 else JPEG_Q["url"], optimize=True, progressive=True); return out.getvalue()
        except Exception: continue
    return None

def make_files(p, data, wide):
    """writes the files this plan entry still needs from the fetched JPEG bytes (the 1920 px one when <wide>, else the
    720 px one) and sets its lq, w and smw; returns False when the bytes are not a picture"""
    from PIL import Image
    try: im = Image.open(io.BytesIO(data)); im.load(); im = im.convert("RGB")
    except Exception: return False
    f = p["files"]
    if wide and "big" in f: open(f["big"], "wb").write(data)
    if wide and "bigwebp" in f: open(f["bigwebp"], "wb").write(webp_bytes(im, "big"))
    norm720 = im.copy(); norm720.thumbnail((720, 720), Image.LANCZOS)
    sm = small_copy(norm720)
    if "sm" in f: open(f["sm"], "wb").write(jpeg_bytes(sm, "sm"))
    if "smwebp" in f: open(f["smwebp"], "wb").write(webp_bytes(sm, "sm"))
    if "webp" in f: open(f["webp"], "wb").write(webp_bytes(norm720, "url"))
    p["lq"], p["w"], p["smw"] = tiny_preview(norm720), norm720.width, sm.width
    return True

def prepare(db, work, cap, small_cap=80):
    wanted, photos = load(os.path.join(db, "wanted")), load(os.path.join(db, "photos"))
    today = time.strftime("%Y-%m-%d")
    order = sorted(wanted.items(), key=lambda kv: (0 if (kv[1].get("when") or "") >= today else 1, kv[1].get("when") or "9999", kv[0]))
    plan, seen = [], set()
    os.makedirs(os.path.join(work, "big"), exist_ok=True)
    for slug, w in order:
        doc = photos.get(slug) or photos.get(slug_of(w.get("country", ""), w.get("city", "")))
        if not doc: continue
        items = doc.get("items") or {}
        food = {norm(n) for n in (w.get("food") or [])}
        names = [w.get("city", "")] + [u[0] for u in (w.get("used") or []) if isinstance(u, list) and u]
        for n in names:
            isfood = norm(n) in food
            k = photo_key(items, n, w.get("country", ""), w.get("city", "")) if not isfood else (norm(n) if isinstance(items.get(norm(n)), dict) and items[norm(n)].get("url") else None)
            it = items.get(k) if k else None
            if not isinstance(it, dict) or not it.get("url") or (slug, k) in seen: continue
            if isfood and it.get("near"): continue         # the app shows a restaurant only with its own picture
            name = commons_name(it.get("page"))
            if not name: continue
            # v201: no more copies. The 1920 px, 320 px and WebP twins (up to five files a photo, up to 280 new files a
            # night) filled the app's file store; a city's photos now live in its pack (tools/photopack.js), and a photo
            # with pk has no file of its own at all. What is still made here: the blurred preview a record lacks, which
            # is stored on the record and costs no file.
            if it.get("pk") or it.get("lq"): continue
            need = {"lq": 1}
            stem = os.path.join(work, "big", "%s__%s" % (slug, hashlib.md5(k.encode()).hexdigest()[:10]))
            suffix = {"big": ".jpg", "bigwebp": ".big.webp", "sm": ".sm.jpg", "smwebp": ".sm.webp", "webp": ".webp"}
            seen.add((slug, k))
            plan.append({"slug": slug, "key": k, "name": name, "need": sorted(need), "files": {f: stem + suffix[f] for f in need if f in suffix}, "stem": stem})
    done, small, later, large_n, small_n = [], 0, 0, 0, 0
    def ready(p): return all(os.path.exists(f) and os.path.getsize(f) > 0 for f in p["files"].values()) and os.path.exists(p["stem"] + ".meta.json")
    for p in plan:
        wide = "big" in p["need"] or "bigwebp" in p["need"]
        if ready(p):                                   # made on an earlier go
            p.update(json.load(open(p["stem"] + ".meta.json"))); done.append(p); continue
        if (wide and large_n >= cap) or (not wide and small_n >= small_cap) or later >= 3: continue   # enough for one night, or the photo server is refusing: the rest waits
        try: data = commons_jpeg(p["name"], WIDTH if wide else 720)
        except Exception: later += 1; continue
        if data is None:
            if wide and "big" in p["need"]: small += 1; continue     # the original is small: no large copy (a small one comes on a later night)
            continue
        if not make_files(p, data, wide): continue
        json.dump({"lq": p["lq"], "w": p["w"], "smw": p["smw"]}, open(p["stem"] + ".meta.json", "w"))
        done.append(p); large_n += 1 if wide else 0; small_n += 0 if wide else 1; time.sleep(2.5)
    json.dump(done, open(os.path.join(work, "big_plan.json"), "w"), indent=1)
    files = [f for p in done for f in p["files"].values()]
    open(os.path.join(work, "big_list.txt"), "w").write("\n".join(files) + ("\n" if files else ""))
    print(json.dumps({"photos": len(done), "cities": len({p["slug"] for p in done}), "wanted": len(plan), "waiting": max(0, len(plan) - len(done) - small), "original_too_small": small, "server_busy": later,
                      "files": len(files), "bytes": sum(os.path.getsize(f) for f in files)}))

def finish(db, work, uploaded):
    up = json.load(open(uploaded, encoding="utf-8")); plan = json.load(open(os.path.join(work, "big_plan.json")))
    photos = load(os.path.join(db, "photos")); out = os.path.join(work, "photos_big"); os.makedirs(out, exist_ok=True)
    touched, n = {}, 0
    for p in plan:
        doc = touched.get(p["slug"]) or photos.get(p["slug"])
        it = ((doc or {}).get("items") or {}).get(p["key"])
        if not isinstance(it, dict): continue
        got = {}
        for f, path in p["files"].items():
            url = up.get(path) or up.get(os.path.basename(path))
            if url and str(url).startswith("/_blob/"): got[f] = url     # only files that really reached the page's storage
        wb = dict(it.get("webp") or {})
        if "big" in got: it["big"] = got["big"]
        if "bigwebp" in got: wb["big"] = got["bigwebp"]
        if "sm" in got:
            it["sm"] = got["sm"]
            if p.get("smw") and p["smw"] != 320: it["smw"] = p["smw"]   # (the app assumes 320 and 720 wide)
        if "smwebp" in got: wb["sm"] = got["smwebp"]
        if "webp" in got: wb["url"] = got["webp"]
        if wb: it["webp"] = wb
        if p.get("lq") and not it.get("lq"): it["lq"] = p["lq"]
        if p.get("w") and p["w"] != 720 and not it.get("w"): it["w"] = p["w"]
        if got or p.get("lq"): touched[p["slug"]] = doc; n += 1
    for slug, doc in touched.items(): json.dump(doc, open(os.path.join(out, slug + ".json"), "w"), ensure_ascii=False)
    print(json.dumps({"photos_updated": n, "cities": sorted(touched)}))

if __name__ == "__main__":
    a = sys.argv
    if len(a) >= 4 and a[1] == "prepare": prepare(a[2], a[3], int(a[4]) if len(a) > 4 else 40, int(a[5]) if len(a) > 5 else 80)
    elif len(a) >= 5 and a[1] == "finish": finish(a[2], a[3], a[4])
    else: print(__doc__); sys.exit(2)
