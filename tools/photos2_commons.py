"""Waypoint photo pass 2: a real photo for every stop, using few requests (Wikimedia throttles shared connections hard).

  python3 photos2.py run <db_dir> <work_dir> [slug ...]    find and download, resumable (state in <work>/p2/<slug>.json)
  python3 photos2.py pending <db_dir> <work_dir> [slug ...] write <work>/pending.json + upload_list.txt (what nightly.py finish reads)

<db_dir> holds the artifact database as ArtifactData saves it: wanted/<slug>.json and photos/<slug>.json.

For each city, stops that have no photo yet get, in this order:
  1. Their own photo: a Wikidata place with a photo (P18) near the stop whose name matches (cities never checked before),
     else a Commons photo taken near the stop whose file name matches the stop's name, else (sights only) a Commons
     search for the name in that city, kept only when the file is near the stop or names the city.
  2. Otherwise a photo taken near the stop, marked near=true (the app says "Photo taken nearby"): the best street, view or
     building photo within a short walk. Interiors, details, signs, maps, people and vehicles are skipped.
Every photo is freely licensed and credited, at least 800 px wide, landscape, and used once per city.
Commons photos with coordinates are fetched once per cluster of stops (up to 500 per request), so a city needs about
ten requests for the search, plus one per downloaded photo.
"""
import hashlib, io, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wide_photos as wp

UA = {"User-Agent": "WaypointTripPlanner/1.1 (https://claude.ai/artifact/YLT5eAnCMckYv9y3o4T9Dx; family trip planner, credited free photos)"}
API = "https://commons.wikimedia.org/w/api.php?"
GAP = float(os.environ.get("P2_GAP", "16"))   # seconds between Wikimedia requests (one shared limit for every host)
_last = [0.0]
DEADLINE = time.time() + float(os.environ.get("P2_MINUTES", "100000")) * 60   # stop starting new cities after this
stats = {"ok": 0, "429": 0}


def wm_get(url, tries=40):
    """one Wikimedia request at a time, waiting out "too many requests" however long it takes"""
    err = None
    for i in range(tries):
        wait = GAP - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=70) as r:
                b = r.read(); stats["ok"] += 1; return b
        except urllib.error.HTTPError as e:
            err = e
            if e.code in (400, 403, 404):
                raise
            if e.code == 429:
                stats["429"] += 1
            time.sleep(min(70, int(e.headers.get("Retry-After") or 0) or 10 * (i + 1)))
        except Exception as e:
            err = e
            time.sleep(min(60, 5 * (i + 1)))
    raise err


def api(**q):
    """a Commons API call; "rate limited" answers (sent as errors with status 200) are waited out too"""
    q.setdefault("format", "json")
    for i in range(30):
        d = json.loads(wm_get(API + urllib.parse.urlencode(q)))
        err = (d.get("error") or {}).get("code") if isinstance(d, dict) else None
        if not err:
            return d
        if err not in ("ratelimited", "maxlag", "readonly", "internal_api_error_DBQueryTimeoutError"):
            raise RuntimeError("Commons API: " + err)
        stats["429"] += 1
        time.sleep(min(70, 15 * (i + 1)))
    raise RuntimeError("Commons API kept refusing")


# ---------------- what a nearby photo may show ----------------
BAD = re.compile(r"\b(interior|inside|innen|interno|altar|altare|fresco|affresco|detail|dettaglio|particolare|plaque|lapide|targa|"
                 r"inscription|iscrizione|tomb|tomba|grave|sarcophag\w*|capital|ceiling|soffitto|floor|pavimento|organ|organo|window|"
                 r"finestra|door|doorway|portone|knocker|relief|rilievo|mosaic detail|icon|crucifix|statue of|bust|busto|"
                 r"exhibit|artefact|artifact|vase|vaso|coin|moneta|manuscript|car|cars|auto|bus|taxi|truck|lorry|van|scooter|"
                 r"motorcycle|moto|vespa|train|treno|locomotive|tram|ferry ticket|people|man|woman|girl|boy|child|children|kid|"
                 r"portrait|ritratto|wedding|selfie|cat|cats|gatto|dog|cane|bird|uccello|gull|gabbiano|pigeon|insect|butterfly|"
                 r"lizard|flower|fiore|macro|room|camera da letto|bed|bathroom|toilet|sign|cartello|signpost|map|mappa|pianta|panel|"
                 r"pannello|poster|graffiti|grave|cemetery|cimitero|hospital|ospedale|school|scuola|parking|parcheggio|construction|"
                 r"cantiere|scaffold|night sky|star trails|moon|sunset sky|cloud|clouds|nuvole|food|dish|plate|menu|logo|badge|"
                 r"stemma|coat of arms|drawing|disegno|painting|dipinto|print|stampa|engraving|incisione|postcard|cartolina|"
                 r"screenshot|scan|document|book|libro|page|pagina|quarry|mine|dump|rubbish|garbage|waste|station|stazione|railway|"
                 r"ferrovia|automotrice|locomotiva|binario|platform|airport|aeroporto|motorway|autostrada|highway|road sign|"
                 r"gas station|distributore|supermarket|supermercato|parking lot|antenna|pylon|traliccio|power line)\b", re.I)
NICE = re.compile(r"\b(panoram\w*|view|veduta|vista|street|strada|via|corso|piazza|square|lungomare|promenade|seafront|beach|"
                  r"spiaggia|bay|baia|harbou?r|porto|marina|coast|costa|sea|mare|canal|canale|bridge|ponte|town|village|borgo|"
                  r"centro|old town|church|chiesa|duomo|cathedral|castle|castello|tower|torre|garden|giardino|park|parco|"
                  r"terrace|terrazza|belvedere|alley|vicolo|steps|scalinata|fountain|fontana|island|isola|cliff|panoramio)\b", re.I)
SAT = re.compile(r"iss0\d|satellite|landsat|sentinel|nasa|astronaut|modis|from space|aerial image", re.I)
NOT_JPEG = re.compile(r"\.(png|gif|svg|tiff?)$", re.I)   # maps, diagrams and scans; real photos are JPEGs


def near_score(title, d_km, city_toks):
    lab = wp.file_label(title)
    if BAD.search(lab) or SAT.search(title) or not wp.is_photo_title(title):
        return None
    s = 1.0 - d_km * 1.5
    if NICE.search(lab):
        s += 0.6
    if set(wp.toks(lab)) & city_toks:
        s += 0.3
    if NOT_JPEG.search(title):
        return None
    return s


# ---------------- Commons photos with coordinates, once per cluster of stops ----------------
def geo_files(state, pts, need_km, save=None):
    """fill state["geo"] with Commons photos around every point (each cluster asked once; dense spots asked again closer)"""
    geo = state.setdefault("geo", {})
    G = 0.012
    cells = {}
    for p in pts:
        cells.setdefault((math.floor(p[0] / G), math.floor(p[1] / G)), []).append(p)
    asked = state.setdefault("asked", [])

    def ask(c, r_m, key):
        if key in asked:
            return geo.get(key, [])
        d = api(action="query", list="geosearch", gscoord="%f|%f" % c, gsradius=int(max(10, min(10000, r_m))), gsnamespace=6, gslimit=500)
        got = [[x["title"], x["lat"], x["lon"]] for x in (d.get("query") or {}).get("geosearch", [])]
        geo[key] = got; asked.append(key)
        print("    area %s: %d photos (requests ok %d, throttled %d)" % (key, len(got), stats["ok"], stats["429"]), file=sys.stderr, flush=True)
        if save:
            save()
        return got

    for cell, ps in sorted(cells.items()):
        c = (sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps))
        far = max(wp.km(c, p) for p in ps)
        got = ask(c, (far + need_km) * 1000, "c%d,%d" % cell)
        reach = max([wp.km(c, (g[1], g[2])) for g in got] or [0])
        if len(got) >= 500 and reach < far + need_km:   # a busy spot: the 500 nearest don't reach every stop
            for p in ps:
                if wp.km(c, p) + need_km > reach:
                    ask(p, need_km * 1000, "p%.4f,%.4f" % p)
    files = {}
    for lst in geo.values():
        for t, la, lo in lst:
            files[t] = (la, lo)
    return files


def info(titles, cache):
    """free licence, credit, size and a 960 px thumbnail for each file (40 per request)"""
    want = [t for t in titles if t not in cache]
    for i in range(0, len(want), 40):
        chunk = want[i:i + 40]
        d = api(action="query", titles="|".join(chunk), prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=960, redirects=1)
        back = {x["to"]: x["from"] for x in (d.get("query") or {}).get("normalized", []) + (d.get("query") or {}).get("redirects", [])}
        seen = set()
        for p in ((d.get("query") or {}).get("pages") or {}).values():
            ii = (p.get("imageinfo") or [None])[0]
            t = back.get(p.get("title"), p.get("title"))
            seen.add(t)
            if not ii:
                cache[t] = None; continue
            meta = ii.get("extmetadata") or {}
            lic = meta.get("LicenseShortName", {}).get("value", "")
            nonfree = "non-free" in (meta.get("NonFree", {}).get("value", "") or "").lower()
            artist = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
            cache[t] = None if nonfree or not lic else {
                "thumb": ii.get("thumburl") or ii.get("url"), "w": ii.get("width", 0), "h": ii.get("height", 0),
                "credit": ", ".join(x for x in [artist[:60], lic] if x),
                "page": ii.get("descriptionurl") or "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))}
        for t in chunk:
            if t not in seen:
                cache.setdefault(t, None)
    return cache


def good_size(x, near):
    if not x or x["w"] < (800 if near else 500) or x["h"] < (450 if near else 300):
        return False
    r = x["w"] / max(1, x["h"])
    return 1.15 <= r <= 2.1 if near else 0.6 <= r <= 2.3


# ---------------- one city ----------------
def run_city(slug, w, have, path, search_budget=40, wd_tried=(), have_pages=()):
    state = json.load(open(path)) if os.path.exists(path) else {}
    state.setdefault("pick", {}); state.setdefault("none", []); state.setdefault("info", {})
    names = [(n, False) for n in (w.get("spots") or [])] + [(n, True) for n in (w.get("food") or [])]
    pts = w.get("pts") or []
    pts = pts if len(pts) == len(names) else [None] * len(names)
    centre = wp.city_centre(w) if (w.get("center") or w.get("home")) else None
    city_toks = set(wp.toks(w.get("city", ""))) | set(wp.toks(w.get("country", "")))
    todo = []
    for (n, food), pt in zip(names, pts):
        k = wp.norm(n)
        if k and k not in have and k not in state["pick"] and k not in state["none"] and not any(t[3] == k for t in todo):
            todo.append((n, food, tuple(pt) if pt and pt[0] is not None else (tuple(centre) if centre else None), k))
    if not todo:
        return state
    print(slug, "to do:", len(todo), file=sys.stderr, flush=True)

    def save():
        json.dump(state, open(path, "w"), indent=0, ensure_ascii=False)

    # 1a. Wikidata, for stops it hasn't been asked about (the first pass asked it about every stop in its "tried" list)
    try:
        os.environ["WIDE_FALLBACKS"] = "0"; wp.FALLBACKS = False
        keys = {t[3] for t in todo}
        m = wp.find_city(slug, w, set(have) | set(wd_tried), path + ".wd")
        for k, x in m.get("matches", {}).items():
            if k in keys and k not in state["pick"]:
                state["pick"][k] = {"title": x["title"], "why": "wikidata " + x.get("why", ""), "near": False}
    except Exception as e:
        print("  wikidata failed", e, file=sys.stderr)
    save()

    # 1b/2. Commons photos taken around the stops
    files = geo_files(state, [t[2] for t in todo if t[2]], 0.6, save); save()
    used = set(state.get("used_pages") or []) | set(have_pages)
    flist = [(t, p) for t, p in files.items()]
    for n, food, pt, k in todo:
        if k in state["pick"] or not pt:
            continue
        R = 0.35 if food else 0.9
        cands = [(wp.file_label(t), p, {"title": t}) for t, p in flist if wp.km(pt, p) <= R and wp.is_photo_title(t) and not SAT.search(t) and not NOT_JPEG.search(t)]
        m = wp.best_match(n, cands, city_toks, food, lambda p: wp.km(pt, p))
        if m:
            state["pick"][k] = {"title": m[1]["title"], "why": "geo " + m[2], "near": False}
    save()

    # 1c. Commons search for sights with a distinctive name
    budget = search_budget - state.get("searched", 0)
    for n, food, pt, k in todo:
        if budget <= 0:
            break
        if food or k in state["pick"] or k in state.get("search_tried", []):
            continue
        if sum(len(t) for t in wp.toks(n) if t not in wp.GENERIC and t not in city_toks) < 5:
            continue
        budget -= 1; state["searched"] = state.get("searched", 0) + 1
        state.setdefault("search_tried", []).append(k)
        try:
            q = {"action": "query", "generator": "search", "gsrsearch": wp.variants(n)[0] + " " + w.get("city", "") + " filetype:bitmap",
                 "gsrnamespace": 6, "gsrlimit": 12, "prop": "coordinates"}
            d = api(**q)
            res = []
            for p in sorted(((d.get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 99)):
                c = (p.get("coordinates") or [{}])[0]
                res.append((p["title"], (c["lat"], c["lon"]) if "lat" in c else None))
        except Exception as e:
            print("  search failed", n, e, file=sys.stderr); continue
        cands = []
        for t, p in res:
            if not wp.is_photo_title(t) or SAT.search(t) or NOT_JPEG.search(t):
                continue
            if p and pt and wp.km(pt, p) > 8:   # the stop's own coordinates can be a few km off
                continue
            lab = wp.file_label(t)
            if not p and not (set(wp.toks(lab)) & (city_toks | (set(wp.toks(n)) - wp.GENERIC))):
                continue
            cands.append((lab, p, {"title": t}))
        m = wp.best_match(n, cands, city_toks, False, lambda p: wp.km(pt, p) if p and pt else None)
        if m and m[0] >= 2.0:
            state["pick"][k] = {"title": m[1]["title"], "why": "search " + m[2], "near": False}
        save()

    # check the stops' own photos: free, big enough, not a panorama; drop the ones that fail
    info([state["pick"][t[3]]["title"] for t in todo if t[3] in state["pick"]], state["info"]); save()
    taken = set()
    for n, food, pt, k in todo:
        x = state["pick"].get(k)
        if not x:
            continue
        ii = state["info"].get(x["title"])
        if not good_size(ii, False) or ii["page"] in used or x["title"] in taken:
            del state["pick"][k]
        else:
            taken.add(x["title"]); used.add(ii["page"])

    # 2. a photo taken nearby for the rest
    rest = [t for t in todo if t[3] not in state["pick"] and t[2]]
    for widen in (1, 2):
        want = {}
        for n, food, pt, k in rest:
            if k in state["pick"]:
                continue
            R = (0.25 if food else 0.6) * widen
            sc = []
            for t, p in flist:
                d = wp.km(pt, p)
                if d > R or t in taken:
                    continue
                s = near_score(t, d, city_toks)
                if s is not None:
                    sc.append((s, t))
            sc.sort(reverse=True)
            want[k] = [t for s, t in sc[:6]]
        info(sorted({t for v in want.values() for t in v}), state["info"]); save()
        for n, food, pt, k in rest:
            if k in state["pick"]:
                continue
            for t in want.get(k, []):
                ii = state["info"].get(t)
                if t not in taken and good_size(ii, True) and ii["page"] not in used:
                    state["pick"][k] = {"title": t, "why": "near %.2f km" % wp.km(pt, files[t]), "near": True}
                    taken.add(t); used.add(ii["page"]); break
    for n, food, pt, k in todo:
        if k not in state["pick"] and k not in state["none"]:
            state["none"].append(k)
    state["used_pages"] = sorted(used)
    save()
    got = sum(1 for t in todo if t[3] in state["pick"])
    print("  %s: %d of %d now have a photo (%d nearby)" % (slug, got, len(todo), sum(1 for t in todo if (state["pick"].get(t[3]) or {}).get("near"))), file=sys.stderr, flush=True)
    return state


def download(slug, path, img_dir):
    from PIL import Image
    state = json.load(open(path))
    n = 0
    for k, x in state["pick"].items():
        if x.get("file") and os.path.exists(x["file"]):
            continue
        ii = state["info"].get(x["title"])
        if not ii:
            continue
        dest = os.path.join(img_dir, slug, hashlib.sha1(k.encode()).hexdigest()[:14] + ".jpg")
        try:
            im = Image.open(io.BytesIO(wm_get(ii["thumb"]))).convert("RGB")
            im.thumbnail((720, 720))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            im.save(dest, "JPEG", quality=74, optimize=True, progressive=True)
            x["file"] = dest; n += 1
            if n % 5 == 0:
                json.dump(state, open(path, "w"), indent=0, ensure_ascii=False)
        except Exception as e:
            print("  download failed", k, e, file=sys.stderr)
    json.dump(state, open(path, "w"), indent=0, ensure_ascii=False)
    print("  %s: downloaded %d" % (slug, n), file=sys.stderr, flush=True)


def load_dir(d):
    out = {}
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".json") and not fn.startswith("."):
                j = json.load(open(os.path.join(d, fn)))
                out[fn[:-5]] = j.get("data", j) if isinstance(j, dict) and "data" in j and "items" not in j else j
    return out


def pending(db, work, only):
    """matches -> pending.json {slug: {items: {k: {file, credit, page, near}}, tried, tried2}} + upload_list.txt
    (tried: asked Wikidata, kept as it was; tried2: nothing found at all, so not asked again for 30 days)"""
    photos = load_dir(os.path.join(db, "photos"))
    today = int(time.time() // 86400)
    out, uploads = {}, []
    for fn in sorted(os.listdir(os.path.join(work, "p2"))):
        if not fn.endswith(".json"):
            continue
        slug = fn[:-5]
        if only and slug not in only:
            continue
        st = json.load(open(os.path.join(work, "p2", fn)))
        cur = photos.get(slug) or {}
        items = {}
        for k, x in st["pick"].items():
            ii = st["info"].get(x["title"])
            if k in (cur.get("items") or {}) or not x.get("file") or not ii or NOT_JPEG.search(x["title"]):
                continue
            items[k] = {"file": x["file"], "credit": ii["credit"], "page": ii["page"]}
            if x.get("near"):
                items[k]["near"] = True
            uploads.append(x["file"])
        tried, tried2 = dict(cur.get("tried") or {}), dict(cur.get("tried2") or {})
        for k in items:
            tried.pop(k, None); tried2.pop(k, None)
        for k in st["none"]:
            tried2[k] = today
        if items or tried != (cur.get("tried") or {}) or tried2 != (cur.get("tried2") or {}):
            out[slug] = {"items": items, "tried": tried, "tried2": tried2}
    json.dump(out, open(os.path.join(work, "pending.json"), "w"), indent=1, ensure_ascii=False)
    open(os.path.join(work, "upload_list.txt"), "w").write("\n".join(uploads) + ("\n" if uploads else ""))
    print(json.dumps({s: len(v["items"]) for s, v in out.items()}), "total", len(uploads))


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "run":
        db, work = sys.argv[2], sys.argv[3]
        wanted, photos = load_dir(os.path.join(db, "wanted")), load_dir(os.path.join(db, "photos"))
        os.makedirs(os.path.join(work, "p2"), exist_ok=True)
        for slug in (sys.argv[4:] or sorted(wanted)):
            cur = photos.get(slug) or {}
            have = set((cur.get("items") or {}).keys())
            path = os.path.join(work, "p2", slug + ".json")
            try:
                if time.time() > DEADLINE:
                    print("time budget used: stopping before", slug, file=sys.stderr, flush=True); break
                run_city(slug, wanted[slug], have, path, wd_tried=(cur.get("tried") or {}).keys(),
                         have_pages={(v or {}).get("page") for v in (cur.get("items") or {}).values()})
                download(slug, path, os.path.join(work, "img"))
            except Exception as e:
                print("city failed", slug, e, file=sys.stderr, flush=True)
            print("requests ok %d, throttled %d" % (stats["ok"], stats["429"]), file=sys.stderr, flush=True)
        print("ALLDONE", file=sys.stderr, flush=True)
    elif len(sys.argv) >= 4 and sys.argv[1] == "pending":
        pending(sys.argv[2], sys.argv[3], set(sys.argv[4:]))
    else:
        print(__doc__); sys.exit(2)
