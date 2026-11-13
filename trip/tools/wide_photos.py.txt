"""Waypoint wide photo pass: finds real, freely licensed photos of a trip's stops on Wikidata / Wikimedia Commons.

  python3 wide_photos.py find <db_dir> <work_dir> [slug ...]     match stops to photos (resumable, per city)
  python3 wide_photos.py fetch <work_dir>                        download the chosen photos (720 px JPEG)

<db_dir>: wanted/*.json and photos/*.json as ArtifactData saves them. Stops that already have a photo are skipped.
Writes <work_dir>/match/<slug>.json  {name_key: {title, credit, page, src, why, km}}  and  <work_dir>/img/<slug>/*.jpg

How a stop is matched, most reliable first:
  1. Wikidata: every place with a photo (P18) near the stop's own coordinates; its name must match the stop's name.
  2. Commons photos taken within ~800 m of the stop whose file name matches the stop's name.
  3. Commons search for the stop's name in that city; the file name must match and, when the file has coordinates,
     it must be near the stop.
A stop with no confident match gets no photo: a wrong photo is worse than none.
"""
import difflib, hashlib, io, json, math, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "WaypointTripPlanner/1.0 (family trip planner; finds freely licensed photos of sights, credited)"}
STOP = {"the", "of", "and", "a", "an", "de", "di", "del", "dei", "della", "delle", "degli", "la", "le", "el", "il", "lo", "los", "las",
        "das", "der", "die", "du", "des", "y", "e", "at", "in", "on", "to", "from", "with", "for", "by", "st", "san", "santa", "sant",
        "tour", "visit", "walk", "walks", "day", "trip", "free", "half", "full", "morning", "evening", "sunset", "afternoon", "stroll",
        "kids", "family", "local", "best", "famous", "traditional", "old"}
GENERIC = {"beach", "beaches", "church", "cathedral", "museum", "palace", "castle", "fortress", "fort", "harbour", "harbor", "port",
           "square", "piazza", "plaza", "market", "park", "garden", "gardens", "monastery", "cave", "caves", "lake", "gorge", "village",
           "town", "city", "lighthouse", "quarter", "district", "street", "bay", "island", "islands", "hill", "mount", "mountain",
           "view", "viewpoint", "point", "bridge", "tower", "gate", "walls", "wall", "fountain", "basilica", "chapel", "mosque",
           "archaeological", "site", "ruins", "ancient", "national", "historic", "historical", "centre", "center", "promenade",
           "waterfront", "boat", "cruise", "lagoon", "valley", "plateau", "waterfall", "waterfalls", "forest", "trail", "hike",
           "restaurant", "taverna", "tavern", "cafe", "bar", "bakery", "trattoria", "osteria", "pizzeria", "gelateria", "ristorante",
           "kitchen", "house", "food", "wine", "winery", "tasting", "class", "cooking", "shop", "shops", "area", "new", "great",
           "small", "little", "big", "upper", "lower", "north", "south", "east", "west", "royal", "grand", "venetian", "roman",
           "greek", "italian", "spanish", "arab", "moorish", "byzantine", "medieval", "art", "gallery", "zoo", "aquarium", "water"}
NOT_PHOTO = re.compile(r"\b(map|plan|logo|coat of arms|flag|diagram|location|locator|scheme|stamp|coin|poster|drawing|engraving|"
                       r"painting|lithograph|postcard|svg|chart|sign|signage|menu|ticket|banknote|seal|emblem|collage|montage|"
                       r"patrol|patrolling|soldiers?|troops|officials|military|army|marines?|isaf|navy|air force|airmen|"
                       r"conference|meeting|ceremony|protest|portrait|visits?|visiting|delegation|minister|president|governor)\b", re.I)
_last = {}
# Commons and Wikipedia allow only a few requests a minute from busy shared connections; set WIDE_FALLBACKS=0 to use Wikidata only
FALLBACKS = os.environ.get("WIDE_FALLBACKS", "1") != "0"


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def toks(s):
    return [t for t in norm(s).split() if t not in STOP and len(t) > 1]


def km(a, b):
    if not a or not b or a[0] is None or b[0] is None:
        return None
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def get(url, host_gap=1.0, accept=None):
    """one request at a time per host, backing off whenever Wikimedia asks"""
    host = urllib.parse.urlparse(url).netloc
    err = None
    patient = os.environ.get("WIDE_PATIENT") == "1"   # keep waiting out "too many requests" (slow but gets there)
    for i in range(16 if patient else 7):
        wait = host_gap - (time.time() - _last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.time()
        try:
            h = dict(UA)
            if accept:
                h["Accept"] = accept
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=70) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            err = e
            if e.code in (400, 404):
                raise
            time.sleep(min(65 if patient else 50, int(e.headers.get("Retry-After") or 0) or 6 * (i + 1)))
        except Exception as e:
            err = e
            time.sleep(3 * (i + 1))
    raise err


def jget(url, gap=1.0):
    return json.loads(get(url, gap))


def tok_eq(a, b):
    if a == b:
        return True
    if len(a) >= 5 and len(b) >= 5:
        if a.startswith(b) or b.startswith(a):
            return True
        return difflib.SequenceMatcher(None, a, b).ratio() >= 0.84
    return False


def sim(name_toks, label, city_toks):
    B = toks(label)
    if not name_toks or not B:
        return 0, 0, 0
    hit_a = [t for t in name_toks if any(tok_eq(t, u) for u in B)]
    hit_b = [u for u in B if any(tok_eq(t, u) for t in name_toks)]
    distinct = [t for t in hit_a if t not in GENERIC and t not in city_toks and not t.isdigit()]
    return len(hit_a) / len(name_toks), len(hit_b) / len(B), sum(len(t) for t in distinct)


def variants(name):
    """the whole name, and its parts ("Lasithi Plateau and Dikteon Cave" -> each place on its own)"""
    out = [name]
    for p in re.split(r"\s+(?:and|&|with|plus|or|via)\s+|\s*[:;,/()\[\]–—]\s*|\s+-\s+", name):
        p = p.strip()
        if p and p != name and any(t not in GENERIC for t in toks(p)):
            out.append(p)
    return out


def best_match(name, cands, city_toks, food, point_km):
    """cands: [(label, point_or_None, payload)]. Returns (score, payload, why, dist) or None."""
    best = None
    for vi, v in enumerate(variants(name)):
        A = toks(v)
        if not A:
            continue
        for label, pt, payload in cands:
            r, p, dl = sim(A, label, city_toks)
            if dl < 4:
                continue
            if food:
                ok = r >= 0.75 and p >= 0.5
            else:
                ok = (r >= 0.6 and p >= 0.5) or (r >= 0.5 and p >= 0.99)
                if vi > 0:   # a part of a longer name has to match well on its own
                    ok = ok and r >= 0.75
            if not ok:
                continue
            d = point_km(pt)
            score = r + p + min(dl, 12) / 12 - (d or 0) / 4 - (0.15 if vi else 0)
            if best is None or score > best[0]:
                best = (score, payload, "%s ~ %s (r%.2f p%.2f)" % (v, label, r, p), d)
    return best


# ---------------- 1. Wikidata: places with photos near the stops ----------------
LOCAL = {"greece": "el", "italy": "it", "spain": "es", "portugal": "pt", "france": "fr", "germany": "de", "afghanistan": "fa",
         "croatia": "hr", "turkey": "tr", "netherlands": "nl", "japan": "ja", "mexico": "es", "austria": "de", "switzerland": "de"}


def wikidata_box(sw, ne, local="en"):
    q = """SELECT ?item ?img ?coord WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(%f %f)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(%f %f)"^^geo:wktLiteral . }
  ?item wdt:P18 ?img .
} LIMIT 60000""" % (sw[1], sw[0], ne[1], ne[0])
    data = json.loads(get("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"}), 61,
                          "application/sparql-results+json"))
    ents = {}
    for b in data["results"]["bindings"]:
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        e = ents.setdefault(qid, {"labels": set(), "img": None, "pt": None})
        for k in ("itemLabel", "loc"):
            if k in b and not re.match(r"^Q\d+$", b[k]["value"]):
                e["labels"].add(b[k]["value"])
        e["img"] = e["img"] or urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1])
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
        if m and not e["pt"]:
            e["pt"] = (float(m.group(2)), float(m.group(1)))
    return ents


def add_aliases(ents, qids, local):
    """English and local-language other names ("Palace of Knossos") for the places close to a stop"""
    qids = [q for q in qids if not ents[q].get("al")]
    for i in range(0, len(qids), 50):
        chunk = qids[i:i + 50]
        q = {"action": "wbgetentities", "format": "json", "ids": "|".join(chunk), "props": "labels|aliases", "languages": "en|" + local}
        try:
            d = jget("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(q))
        except Exception as e:
            print("  aliases failed", e, file=sys.stderr); return
        for qid, ent in (d.get("entities") or {}).items():
            if qid not in ents:
                continue
            for v in (ent.get("labels") or {}).values():
                ents[qid]["labels"].add(v["value"])
            for lst in (ent.get("aliases") or {}).values():
                for v in lst:
                    ents[qid]["labels"].add(v["value"])
            ents[qid]["al"] = True


def cells(points, pad=0.02, size=0.12):
    """group stops into small boxes so each Wikidata query stays quick"""
    groups = {}
    for p in points:
        groups.setdefault((math.floor(p[0] / size), math.floor(p[1] / size)), []).append(p)
    out = []
    for g in groups.values():
        out.append(((min(p[0] for p in g) - pad, min(p[1] for p in g) - pad), (max(p[0] for p in g) + pad, max(p[1] for p in g) + pad)))
    return out


def wiki_near(pt, radius=3000):
    q = {"action": "query", "format": "json", "generator": "geosearch", "ggscoord": "%f|%f" % pt, "ggsradius": radius, "ggslimit": 50,
         "prop": "pageimages|coordinates", "piprop": "name", "pilicense": "free", "pilimit": 50, "colimit": 50}
    d = jget("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(q))
    out = []
    for p in ((d.get("query") or {}).get("pages") or {}).values():
        c = (p.get("coordinates") or [{}])[0]
        if p.get("pageimage") and "lat" in c:
            out.append((p["title"], (c["lat"], c["lon"]), {"title": "File:" + p["pageimage"], "src": "wikipedia:" + p["title"]}))
    return out


# ---------------- 2/3. Commons ----------------
def commons_geo(pt, radius):
    q = {"action": "query", "format": "json", "list": "geosearch", "gscoord": "%f|%f" % pt, "gsradius": radius, "gsnamespace": 6, "gslimit": 100}
    d = jget("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q))
    return [(x["title"], (x["lat"], x["lon"])) for x in (d.get("query") or {}).get("geosearch", [])]


def commons_search(text):
    q = {"action": "query", "format": "json", "generator": "search", "gsrsearch": text + " filetype:bitmap", "gsrnamespace": 6,
         "gsrlimit": 12, "prop": "coordinates"}
    d = jget("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q))
    out = []
    for p in sorted(((d.get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 99)):
        c = (p.get("coordinates") or [{}])[0]
        out.append((p["title"], (c["lat"], c["lon"]) if "lat" in c else None))
    return out


def file_label(title):
    t = re.sub(r"^File:", "", title)
    t = re.sub(r"\.(jpe?g|png|tiff?|webp)$", "", t, flags=re.I)
    t = re.sub(r"[_]+", " ", t)
    t = re.sub(r"\b(img|dsc|dscn|dscf|p|pict|photo|image)\s*\d+\b|\b\d{3,}\b", " ", t, flags=re.I)
    return t


def is_photo_title(title):
    return bool(re.search(r"\.(jpe?g|png|tiff?|webp)$", title, re.I)) and not NOT_PHOTO.search(file_label(title))


def city_centre(w):
    c = w.get("center") or w.get("home")
    if c:
        return tuple(c)
    q = {"action": "query", "format": "json", "titles": w["city"], "prop": "coordinates", "redirects": 1}
    d = jget("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(q))
    for p in (d.get("query") or {}).get("pages", {}).values():
        c = (p.get("coordinates") or [{}])[0]
        if "lat" in c:
            return (c["lat"], c["lon"])
    return None


def find_city(slug, w, have, out_path):
    done = json.load(open(out_path)) if os.path.exists(out_path) else {"matches": {}, "checked": []}
    names = [(n, False) for n in (w.get("spots") or [])] + [(n, True) for n in (w.get("food") or [])]
    pts = w.get("pts") or []
    pts = pts if len(pts) == len(names) else [None] * len(names)
    centre = city_centre(w)
    city_toks = set(toks(w.get("city", ""))) | set(toks(w.get("country", "")))
    todo = []
    for (n, food), pt in zip(names, pts):
        k = norm(n)
        if k and k not in have and k not in done["matches"] and k not in done["checked"]:
            todo.append((n, food, tuple(pt) if pt and pt[0] is not None else None, k))
    if not todo:
        return done
    print(slug, "to check:", len(todo), file=sys.stderr)

    # 1. Wikidata around the stops
    ents = {}
    with_pts = [t[2] for t in todo if t[2]]
    allp = with_pts or ([centre] if centre else [])
    boxes = [((min(p[0] for p in allp) - 0.03, min(p[1] for p in allp) - 0.04), (max(p[0] for p in allp) + 0.03, max(p[1] for p in allp) + 0.04))] if allp else []
    local = LOCAL.get(norm(w.get("country", "")), "en")
    for sw, ne in boxes:
        try:
            ents.update(wikidata_box(sw, ne, local))
        except Exception as e:
            print("  wikidata box failed", sw, ne, e, file=sys.stderr)
    print("  wikidata places with photos nearby:", len(ents), file=sys.stderr)
    # other names for the places within reach of a stop
    close = set()
    for n, food, pt, k in todo:
        ref = pt or centre
        if ref:
            for qid, e in ents.items():
                d = km(ref, e["pt"])
                if d is not None and d <= (0.6 if food else 3):
                    close.add(qid)
    add_aliases(ents, sorted(close), local)
    ecands = []
    for qid, e in ents.items():
        if not e["img"] or not is_photo_title("File:" + e["img"]):
            continue
        for lab in e["labels"]:
            ecands.append((lab, e["pt"], {"title": "File:" + e["img"], "src": "wikidata:" + qid}))

    def save():
        json.dump(done, open(out_path, "w"), indent=1, ensure_ascii=False)
    wiki_cache = {}

    for n, food, pt, k in todo:
        ref = pt or centre
        lim = (0.6 if food else 2.5) if pt else (8 if not food else 3)

        def dist(p, ref=ref, lim=lim):
            d = km(ref, p)
            return d if d is not None and d <= lim * 2.4 else (None if d is None else 999)

        # nearby Wikidata places only
        near = [c for c in ecands if c[1] and km(ref, c[1]) is not None and km(ref, c[1]) <= (lim * 2.4 if not food else lim)] if ref else []
        try:
            if not pt and centre and FALLBACKS:
                if "city" not in wiki_cache:
                    wiki_cache["city"] = [c for c in wiki_near(centre, 10000) if is_photo_title(c[2]["title"])]
                near += wiki_cache["city"]
        except Exception as e:
            print("  wiki near failed", n, e, file=sys.stderr)
        m = best_match(n, near, city_toks, food, dist)
        if m and m[3] is not None and m[3] <= (lim if not food else lim) * (2.4 if not food and m[0] >= 2.4 else 1):
            done["matches"][k] = dict(m[1], why=m[2], km=round(m[3], 2), name=n)
            continue
        # 2. Commons photos taken right there
        found = None
        if pt and FALLBACKS:
            try:
                files = [(file_label(t), p, {"title": t, "src": "commons-geo"}) for t, p in commons_geo(pt, 300 if food else 800) if is_photo_title(t)]
                m = best_match(n, files, city_toks, food, lambda p: km(pt, p))
                if m:
                    found = dict(m[1], why=m[2], km=round(m[3] or 0, 2), name=n)
            except Exception as e:
                print("  geo failed", n, e, file=sys.stderr)
        # 3. Commons search in this city
        if not found and not food and FALLBACKS:
            for v in variants(n)[:2]:
                try:
                    res = commons_search(v + " " + w.get("city", ""))
                except Exception as e:
                    print("  search failed", n, e, file=sys.stderr); break
                files = []
                for t, p in res:
                    if not is_photo_title(t):
                        continue
                    if p and ref and km(ref, p) > (3 if pt else 15):
                        continue   # a different place with the same name
                    lab = file_label(t)
                    if not p and not (set(toks(lab)) & (city_toks | set(toks(n)) - GENERIC)):
                        continue
                    files.append((lab, p, {"title": t, "src": "commons-search"}))
                m = best_match(n, files, city_toks, food, lambda p: km(ref, p) if p and ref else None)
                if m and m[0] >= 2.0:
                    found = dict(m[1], why=m[2], km=round(m[3], 2) if m[3] is not None else None, name=n)
                    break
        if found:
            done["matches"][k] = found
        else:
            done["checked"].append(k)
        if len(done["matches"]) % 10 == 0:
            save()
    save()
    print("  matched", len(done["matches"]), "of", len(names), file=sys.stderr)
    return done


def credit_and_thumb(titles):
    """file name -> (thumb url, credit, page) for up to 50 files at a time"""
    out = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        q = {"action": "query", "format": "json", "titles": "|".join(chunk), "prop": "imageinfo", "iiprop": "url|extmetadata|size",
             "iiurlwidth": 960, "redirects": 1}
        d = jget(("https://commons.wikimedia.org" if FALLBACKS else "https://en.wikipedia.org") + "/w/api.php?" + urllib.parse.urlencode(q))
        back = {x["to"]: x["from"] for x in (d.get("query") or {}).get("normalized", []) + (d.get("query") or {}).get("redirects", [])}
        for p in ((d.get("query") or {}).get("pages") or {}).values():
            ii = (p.get("imageinfo") or [None])[0]
            if not ii:
                continue
            meta = ii.get("extmetadata") or {}
            lic = meta.get("LicenseShortName", {}).get("value", "")
            if "non-free" in (meta.get("NonFree", {}).get("value", "") or "").lower() or not lic:
                continue
            if ii.get("width", 0) < 400 or ii.get("height", 0) < 300:
                continue
            artist = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
            title = p["title"]
            out[back.get(title, title)] = out[title] = (ii.get("thumburl") or ii["url"], ", ".join(x for x in [artist[:60], lic] if x),
                                                         ii.get("descriptionurl") or "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")))
    return out


def fetch(work, only=None):
    from PIL import Image
    mdir = os.path.join(work, "match")
    for fn in sorted(os.listdir(mdir)):
        slug = fn[:-5]
        if only and slug not in only:
            continue
        path = os.path.join(mdir, fn)
        done = json.load(open(path))
        todo = {k: m for k, m in done["matches"].items() if not m.get("file")}
        if not todo:
            continue
        info = credit_and_thumb(sorted({m["title"] for m in todo.values()}))
        n = 0
        for k, m in todo.items():
            got = info.get(m["title"])
            if not got:
                m["file"] = ""; m["skip"] = "no free image info"
                continue
            url, credit, page = got
            dest = os.path.join(work, "img", slug, hashlib.sha1(k.encode()).hexdigest()[:14] + ".jpg")
            try:
                im = Image.open(io.BytesIO(get(url, 0.35))).convert("RGB")
                im.thumbnail((720, 720))
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                im.save(dest, "JPEG", quality=74, optimize=True, progressive=True)
                m.update(file=dest, credit=credit, page=page); n += 1
                if n % 10 == 0:
                    json.dump(done, open(path, "w"), indent=1, ensure_ascii=False)
            except Exception as e:
                print("  download failed", k, e, file=sys.stderr)
        json.dump(done, open(path, "w"), indent=1, ensure_ascii=False)
        print(slug, "downloaded", n, file=sys.stderr)


def load_dir(d):
    out = {}
    if os.path.isdir(d):
        for fn in os.listdir(d):
            if fn.endswith(".json"):
                j = json.load(open(os.path.join(d, fn)))
                out[fn[:-5]] = j.get("data", j) if isinstance(j, dict) and "data" in j and "items" not in j else j
    return out


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "find":
        db, work = sys.argv[2], sys.argv[3]
        wanted, photos = load_dir(os.path.join(db, "wanted")), load_dir(os.path.join(db, "photos"))
        os.makedirs(os.path.join(work, "match"), exist_ok=True)
        for slug in (sys.argv[4:] or sorted(wanted)):
            have = set(((photos.get(slug) or {}).get("items") or {}).keys())
            find_city(slug, wanted[slug], have, os.path.join(work, "match", slug + ".json"))
    elif len(sys.argv) >= 3 and sys.argv[1] == "fetch":
        fetch(sys.argv[2], sys.argv[3:] or None)
    else:
        print(__doc__); sys.exit(2)
