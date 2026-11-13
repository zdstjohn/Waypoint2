"""Waypoint photo pass 2: a real photo for every stop, with very few requests to Wikimedia's throttled APIs.

  python3 photos2.py run <db_dir> <work_dir> [slug ...]     find and download, resumable (state in <work>/p2/<slug>.json)
  python3 photos2.py pending <db_dir> <work_dir> [slug ...] write <work>/pending.json + upload_list.txt (what nightly.py finish reads)

<db_dir> holds the artifact database as ArtifactData saves it: wanted/<slug>.json and photos/<slug>.json.

For each city, stops that have no photo yet get:
  1. their own photo: a Wikidata place with a photo (P18) near the stop whose name matches the stop's name;
  2. otherwise the photo of the nearest such place within a short walk, marked near=<that place's name>
     (the app shows "Nearby: <place>"). Never repeated within a city.
Only freely licensed JPEG photos, credited, big enough. How it stays cheap:
  - one Wikidata query (labels included) per cluster of stops, so a city needs a handful of queries in all;
  - licence, credit and size come from Magnus' Commons API on Toolforge, and the photos from thumb.wikimedia.org,
    neither of which is behind the Wikimedia API's per-connection limit.
"""
import hashlib, html, io, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wide_photos as wp
import photo_judge as PJ

UA = {"User-Agent": "WaypointTripPlanner/1.1 (https://claude.ai/artifact/YLT5eAnCMckYv9y3o4T9Dx; family trip planner, credited free photos)"}
DEADLINE = time.time() + float(os.environ.get("P2_MINUTES", "100000")) * 60   # stop starting new cities after this
stats = {"ok": 0, "429": 0}
_last = {}


def get(url, gap=1.0, tries=60, accept=None, data=None, timeout=120):
    """one request at a time per host, waiting out "too many requests" however long it takes"""
    host = urllib.parse.urlparse(url).netloc
    err = None
    for i in range(tries):
        wait = gap - (time.time() - _last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.time()
        try:
            h = dict(UA)
            if accept:
                h["Accept"] = accept
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
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


# ---------------- what a photo may show ----------------
BAD = re.compile(r"\b(interior|inside|innen|interno|altar|altare|fresco|affresco|detail|dettaglio|particolare|plaque|lapide|targa|"
                 r"inscription|iscrizione|tomb|tomba|grave|sarcophag\w*|ceiling|soffitto|floor|pavimento|organ|organo|"
                 r"relief|rilievo|crucifix|bust|busto|exhibit|artefact|artifact|vase|vaso|coin|moneta|manuscript|"
                 r"portrait|ritratto|wedding|selfie|map|mappa|pianta|plan|diagram|poster|logo|badge|stemma|coat of arms|"
                 r"drawing|disegno|painting|dipinto|engraving|incisione|postcard|cartolina|screenshot|scan|document|"
                 r"station|stazione|railway|ferrovia|automotrice|locomotiva|airport|aeroporto|motorway|autostrada|"
                 r"supermarket|supermercato|antenna|pylon|traliccio|cemetery|cimitero|hospital|ospedale)\b", re.I)
# a stand-in photo for somewhere nearby must show the place itself: no people, events, vehicles or museum rooms
NEAR_BAD = re.compile(r"\b(donatello|award|premio|festival|summit|g7|ceremony|cerimonia|actress|actor|attrice|attore|celebrity|"
                      r"politician|president|presidente|minister|ministro|concert|concerto|parade|corteo|procession|processione|"
                      r"car|cars|auto|fiat|rally|bus|taxi|truck|lorry|scooter|motorcycle|moto|vespa|traffic|traffico|museum|museo|"
                      r"exhibition|mostra|shop window|vetrina)\b", re.I)
SAT = re.compile(r"iss0\d|satellite|landsat|sentinel|nasa|astronaut|modis|from space", re.I)
NOT_JPEG = re.compile(r"\.(png|gif|svg|tiff?|webp)$", re.I)   # maps, diagrams and scans; real photos are JPEGs


def ok_title(t):
    lab = wp.file_label(t)
    return bool(re.search(r"\.jpe?g$", t, re.I)) and not BAD.search(lab) and not SAT.search(t) and not wp.NOT_PHOTO.search(lab)


# ---------------- 1. Wikidata places with photos around the stops (one query per cluster) ----------------
def places(state, pts, country):
    """state["wd"][cell] = [[qid, file, lat, lng, name, labels...]] for Wikidata places with a photo near the stops"""
    wd = state.setdefault("wd", {})
    G = 0.04
    cells = {}
    for p in pts:
        cells.setdefault((math.floor(p[0] / G), math.floor(p[1] / G)), []).append(p)
    lang = wp.LOCAL.get(wp.norm(country), "en")
    langs = ",".join('"%s"' % l for l in sorted({"en", lang}))
    for cell, ps in sorted(cells.items()):
        key = "%d,%d" % cell
        if key in wd:
            continue
        sw = (min(p[0] for p in ps) - 0.015, min(p[1] for p in ps) - 0.02)
        ne = (max(p[0] for p in ps) + 0.015, max(p[1] for p in ps) + 0.02)
        q = """SELECT ?item ?img ?coord (SAMPLE(?en) AS ?name) (SAMPLE(?lo) AS ?local) (GROUP_CONCAT(DISTINCT ?l; separator="|") AS ?labels) WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(%f %f)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(%f %f)"^^geo:wktLiteral . }
  ?item wdt:P18 ?img .
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?lo FILTER(LANG(?lo) = "%s") }
  OPTIONAL { { ?item rdfs:label ?l } UNION { ?item skos:altLabel ?l } FILTER(LANG(?l) IN (%s)) }
} GROUP BY ?item ?img ?coord LIMIT 20000""" % (sw[1], sw[0], ne[1], ne[0], lang, langs)
        body = urllib.parse.urlencode({"query": q, "format": "json"}).encode()
        d = json.loads(get("https://query.wikidata.org/sparql", gap=6, accept="application/sparql-results+json", data=body))
        rows, seen = [], set()
        for b in d["results"]["bindings"]:
            qid = b["item"]["value"].rsplit("/", 1)[-1]
            m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
            if not m or qid in seen:
                continue
            seen.add(qid)
            img = urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1])
            labels = [x for x in (b.get("labels") or {}).get("value", "").split("|") if x]
            name = (b.get("name") or b.get("local") or {}).get("value", "") or (labels[0] if labels else "")
            rows.append([qid, img, float(m.group(2)), float(m.group(1)), name] + labels)   # name to show, then every name to match
        wd[key] = rows
        print("    %s: %d places with photos (requests ok %d, throttled %d)" % (key, len(rows), stats["ok"], stats["429"]), file=sys.stderr, flush=True)
    out = {}
    for rows in wd.values():
        for r in rows:
            out[r[0]] = r
    return list(out.values())


# ---------------- 2. licence, credit, size: Magnus' Commons API on Toolforge ----------------
def file_info(name, cache):
    """{'thumb','w','h','credit','page'} for a Commons file, or None when it isn't freely licensed or can't be read"""
    if name in cache and (cache[name] is None or "cats" in cache[name]):
        return cache[name]
    url = "https://magnustools.toolforge.org/commonsapi/?" + urllib.parse.urlencode({"image": name, "thumbwidth": 960})
    try:
        x = get(url, gap=0.4, tries=4, timeout=40).decode("utf-8", "replace")
    except Exception as e:
        print("  no file info", name, e, file=sys.stderr); cache[name] = None; return None

    def tag(t):
        m = re.search(r"<%s>(.*?)</%s>" % (t, t), x, re.S)
        return html.unescape(m.group(1)).strip() if m else ""
    lic = [html.unescape(l).strip() for l in re.findall(r"<license>\s*<name>(.*?)</name>", x, re.S)]
    free = [l for l in lic if re.match(r"(CC-BY|CC-BY-SA|CC0|PD|Public domain|GFDL|Attribution|FAL|Copyrighted free use)", l, re.I) and not re.search(r"-NC|-ND", l)]
    w, h = tag("width"), tag("height")
    thumb = tag("thumbnail")
    if not free or not w.isdigit() or not h.isdigit() or not thumb:
        cache[name] = None; return None
    author = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", tag("author"))).strip()
    cats = [html.unescape(c) for c in re.findall(r"<category>(.*?)</category>", x)]
    desc = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(tag("description"))))[:400]
    l0 = free[0]
    l0 = "Public domain" if re.match(r"PD", l0) else l0.replace("CC-BY-SA-", "CC BY-SA ").replace("CC-BY-", "CC BY ").replace("CC0-1.0", "CC0")
    cache[name] = {"thumb": thumb, "w": int(w), "h": int(h), "cats": cats, "desc": desc,
                   "credit": ", ".join(v for v in [author[:60], l0] if v),
                   "page": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(name.replace(" ", "_"))}
    return cache[name]


def good_size(x):
    if not x or x["w"] < 640 or x["h"] < 400:
        return False
    return 0.66 <= x["w"] / max(1, x["h"]) <= 2.3


# ---------------- 2. the city's own photos on Commons: PetScan on its category tree (Toolforge) ----------------
def wikidata_city_category(w):
    """the Commons category of the town nearest the city's centre, from Wikidata (P373)"""
    c = w.get("center") or w.get("home")
    if not c:
        return None
    q = """SELECT ?cat ?dist WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(%f %f)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "12" . bd:serviceParam wikibase:distance ?dist . }
  ?item wdt:P373 ?cat ; wdt:P31/wdt:P279* wd:Q486972 .
} ORDER BY ?dist LIMIT 3""" % (c[1], c[0])
    try:
        d = json.loads(get("https://query.wikidata.org/sparql", gap=20, tries=20, accept="application/sparql-results+json",
                           data=urllib.parse.urlencode({"query": q, "format": "json"}).encode()))
        b = d["results"]["bindings"]
        return b[0]["cat"]["value"] if b else None
    except Exception as e:
        print("  no Wikidata category", repr(e)[:100], file=sys.stderr); return None


def city_files(state, w):
    """state["files"] = [[name, lat|None, lng|None, width, height]] for every photo in the city's Commons category tree"""
    if state.get("files") is not None:
        return state["files"]
    city = w.get("city", "")
    out = []
    tries = [(city, 2), (city, 3), (city + ", " + w.get("country", ""), 3)]
    for cat, depth in tries:
        if cat is None:
            continue
        url = "https://petscan.toolforge.org/?" + urllib.parse.urlencode({
            "language": "commons", "project": "wikimedia", "categories": cat.replace(" ", "_"), "depth": depth, "ns[6]": 1,
            "format": "json", "doit": 1, "add_coordinates": "on", "ext_image_data": "on", "output_limit": 120000})
        try:
            d = json.loads(get(url, gap=2, tries=6))
        except Exception as e:
            print("  petscan failed", cat, depth, repr(e)[:120], file=sys.stderr, flush=True); continue
        rows = []
        for x in ((d.get("*") or [{}])[0].get("a") or {}).get("*", []):
            m = x.get("metadata") or {}
            c = (m.get("coordinates") or "").split("/")
            la, lo = (float(c[0]), float(c[1])) if len(c) == 2 and c[0] and c[1] else (None, None)
            if (m.get("img_minor_mime") or x.get("img_minor_mime")) not in ("jpeg", "jpg"):
                continue
            rows.append([x["title"].replace("_", " "), la, lo, m.get("img_width") or x.get("img_width") or 0, m.get("img_height") or x.get("img_height") or 0])
        print("    Commons category %s (depth %d): %d photos, %d with a location" % (cat, depth, len(rows), sum(1 for r in rows if r[1] is not None)), file=sys.stderr, flush=True)
        if len(rows) > len(out):
            out = rows
        if len(out) >= 3000:
            break
        if cat == tries[-1][0] and len(out) < 50 and len(tries) == 3:
            wc = wikidata_city_category(w)   # Commons spells it differently ("Bamyan"): ask Wikidata for the town's category
            if wc and wc not in (city, tries[2][0]):
                tries += [(wc, 2), (wc, 3)]
    state["files"] = out
    return out


def category_files(cat):
    """[[name, lat|None, lng|None, width, height]] for the JPEG photos in one Commons category (and its subcategories)"""
    url = "https://petscan.toolforge.org/?" + urllib.parse.urlencode({
        "language": "commons", "project": "wikimedia", "categories": cat.replace(" ", "_"), "depth": 1, "ns[6]": 1,
        "format": "json", "doit": 1, "add_coordinates": "on", "ext_image_data": "on", "output_limit": 3000})
    try:
        d = json.loads(get(url, gap=1, tries=3, timeout=90))
    except Exception:
        return []
    rows = []
    for x in ((d.get("*") or [{}])[0].get("a") or {}).get("*", []):
        m = x.get("metadata") or {}
        c = (m.get("coordinates") or "").split("/")
        la, lo = (float(c[0]), float(c[1])) if len(c) == 2 and c[0] and c[1] else (None, None)
        if (m.get("img_minor_mime") or x.get("img_minor_mime")) in ("jpeg", "jpg"):
            rows.append([x["title"].replace("_", " "), la, lo, m.get("img_width") or 0, m.get("img_height") or 0])
    return rows


OLD = re.compile(r"\b(1[5-8]\d\d|19[0-4]\d)\b|gloeden|edizione|cartolina|recto|verso|monnaie|btv1b|stampa|lithograph|photochrom|"
                 r"brogi|alinari|sommer|crupi|galifi|bonfils|lantern slide", re.I)
NICE = re.compile(r"\b(panoram\w*|view|veduta|vista|street|strada|via|corso|piazza|square|lungomare|promenade|seafront|beach|"
                  r"spiaggia|bay|baia|harbou?r|porto|marina|coast|costa|sea|mare|canal|canale|bridge|ponte|town|village|borgo|"
                  r"centro|old town|church|chiesa|duomo|cathedral|castle|castello|tower|torre|garden|giardino|park|parco|"
                  r"terrace|terrazza|belvedere|alley|vicolo|steps|scalinata|fountain|fontana|island|isola|cliff)\b", re.I)


# ---------------- one city ----------------
def run_city(slug, w, have, path, wd_tried=(), have_pages=(), no=()):
    state = json.load(open(path)) if os.path.exists(path) else {}
    state.setdefault("pick", {}); state.setdefault("none", []); state.setdefault("info", {})
    names = [(n, False) for n in (w.get("spots") or [])] + [(n, True) for n in (w.get("food") or [])]
    pts = w.get("pts") or []
    pts = pts if len(pts) == len(names) else [None] * len(names)
    centre = tuple(w.get("center") or w.get("home") or ()) or None
    city_toks = set(wp.toks(w.get("city", ""))) | set(wp.toks(w.get("country", "")))
    todo, keys = [], set()
    for (n, food), pt in zip(names, pts):
        k = wp.norm(n)
        if not k or k in have or k in keys:
            continue
        cur = state["pick"].get(k)
        if (cur and not cur.get("near")) or (k in state["none"] and state.get("v") == 3):
            continue   # has its own photo already, or was searched by this version and nothing turned up
        keys.add(k)
        todo.append((n, food, tuple(pt) if pt and pt[0] is not None else centre, k))
    if not todo:
        return state
    print(slug, "to do:", len(todo), file=sys.stderr, flush=True)
    state["none"] = [k for k in state["none"] if k not in keys]

    def save():
        json.dump(state, open(path, "w"), indent=0, ensure_ascii=False)

    pl = places(state, [t[2] for t in todo if t[2]], w.get("country", "")); save()
    files = city_files(state, w); save()
    # stand-in ("nearby") photos are chosen again, after every stop has had the chance of its own photo
    for n, food, pt, k in todo:
        if (state["pick"].get(k) or {}).get("near"):
            del state["pick"][k]
    used_pages = set(have_pages)
    used_files = {x["title"][5:] for x in state["pick"].values()} | set(no)   # "no": photos turned down for this city

    # what each place is (its kind, and whether it is a fixed spot at all); words shared by many of this city's places
    # (its towns) do not identify one
    freq = {}
    for n, food in names:
        for wd_ in set(PJ.words(n)): freq[wd_] = freq.get(wd_, 0) + 1
    common = {wd_ for wd_, c in freq.items() if c >= 3}
    city_name, country_name = w.get("city", ""), w.get("country", "")
    profiles = {wp.norm(n): PJ.place_profile(n, food, city_name, country_name, common) for n, food in names}
    town_words = set(PJ.words(city_name)) | common
    state.setdefault("judged", {})

    def take(name, wh=None, place=None, own=True, dist=None, trusted=False):
        """a file this city hasn't used yet that passes every check: not used, a real photo, big enough, freely licensed,
        and (the judge) actually showing the right kind of thing for this place"""
        if name in used_files or not ok_title("File:" + name) or OLD.search(name):
            return None
        if wh and not good_size({"w": wh[0], "h": wh[1]}):
            return None
        ii = file_info(name, state["info"])
        if not good_size(ii) or ii["page"] in used_pages:
            return None
        if place is not None:
            ph = PJ.photo_profile(name, ii.get("cats"), ii.get("desc", ""), ii["w"], ii["h"])
            tw = set(PJ.words(name) + sum((PJ.words(c) for c in ii.get("cats") or []), []))
            ph["town_hit"] = bool(tw & town_words)
            hit = PJ.name_words_in(place, name, ii.get("cats") or [], ii.get("desc", "") if own else "")
            thit = PJ.name_words_in(place, name, ii.get("cats") or [], only_title=True, city=city_name)
            loc = trusted or PJ.located_in(city_name, country_name, name, ii.get("cats") or [], ii.get("desc", ""), dist)
            ok, score, why = PJ.judge(place, ph, own, dist_km=dist, name_hit=hit, located=loc, trusted_name=trusted, title_hit=thit)
            state["judged"][name] = why
            if not ok:
                return None
        used_files.add(name); used_pages.add(ii["page"])
        return ii

    # 1. the stop's own photo: a Wikidata place nearby whose name matches ...
    cands = []
    for r in pl:
        for lab in r[5:]:
            cands.append((lab, (r[2], r[3]), {"file": r[1]}))
    for n, food, pt, k in todo:
        if k in state["pick"] or not pt or k in wd_tried:
            continue
        lim = 0.6 if food else 2.5
        near = [c for c in cands if wp.km(pt, c[1]) <= (lim if food else lim * 2.4)]
        m = wp.best_match(n, near, city_toks, food, lambda p: wp.km(pt, p))
        if m and food and m[2].split(" ~ ")[0] != n:
            m = None
        if m and m[3] is not None and m[3] <= lim * (2.4 if not food and m[0] >= 2.4 else 1) and take(m[1]["file"], None, profiles[k], True, m[3], True):
            state["pick"][k] = {"title": "File:" + m[1]["file"], "why": "wikidata " + m[2], "near": False}
    save()
    # ... or a photo in the city's Commons categories whose file name names it (near the stop when the photo has a location)
    fc = [(wp.file_label("File:" + f[0]), (f[1], f[2]) if f[1] is not None else None, {"file": f[0], "wh": (f[3], f[4])}) for f in files]
    for n, food, pt, k in todo:
        if k in state["pick"]:
            continue
        lim = 1.0 if food else 4.0   # a stop's own coordinates can be a little off
        near = [c for c in fc if c[1] is None or (pt and wp.km(pt, c[1]) <= lim)]
        for _ in range(3):
            m = wp.best_match(n, near, city_toks, food, lambda p: wp.km(pt, p) if p and pt else None)
            if not m or m[0] < (2.0 if m[3] is None else 1.6) or (food and m[2].split(" ~ ")[0] != n):
                break
            if take(m[1]["file"], m[1]["wh"], profiles[k], True, m[3], False):
                state["pick"][k] = {"title": "File:" + m[1]["file"], "why": "commons " + m[2], "near": False}
                break
            near = [c for c in near if c[2]["file"] != m[1]["file"]]
    save()

    # ... or, for sights, the photos in a Commons category named after the place ("Porta Messina (Taormina)")
    tried_cats = state.setdefault("cats", {})
    for n, food, pt, k in todo:
        if k in state["pick"] or food:
            continue
        if profiles[k]["activity"] or not profiles[k]["distinct"]:
            continue   # "Fresh fruit and juice stalls" is not the name of a Commons category worth trusting
        for v in wp.variants(n)[:2]:
            if sum(len(t) for t in wp.toks(v) if t not in wp.GENERIC and t not in city_toks) < 4:
                continue
            got = None
            for cat in (v, "%s (%s)" % (v, w.get("city", "")), "%s, %s" % (v, w.get("city", ""))):
                if cat not in tried_cats:
                    tried_cats[cat] = category_files(cat)
                fl = [f for f in tried_cats[cat] if f[1] is None or not pt or wp.km(pt, (f[1], f[2])) <= 8]
                fl.sort(key=lambda f: -((f[1] is not None) * 0.5 + (0.3 if NICE.search(f[0]) else 0) + min(f[3], 4000) / 4000))
                # a category named "<place> (<city>)" is the place's own; a bare "<place>" category may be anything on Earth
                # with that name, so its files must still prove they are here
                own_cat = cat != v
                for f in fl[:6]:
                    d = wp.km(pt, (f[1], f[2])) if pt and f[1] is not None else None
                    if take(f[0], (f[3], f[4]), profiles[k], True, d, own_cat):
                        got = f; break
                if got:
                    state["pick"][k] = {"title": "File:" + got[0], "why": "category " + cat, "near": False}
                    break
            if got:
                break
    save()

    # 2. otherwise, for sights only, a photo taken a short walk away: a nearby Wikidata place's photo (named), or a Commons
    #    photo taken there. Places to eat never get a stand-in: the page draws the kind of food they serve instead.
    pool = [("wd", r[1], (r[2], r[3]), r[4], None) for r in pl] + \
           [("f", f[0], (f[1], f[2]), "", (f[3], f[4])) for f in files if f[1] is not None]
    for widen in (1, 2):
        for n, food, pt, k in todo:
            if k in state["pick"] or not pt or food or not profiles[k]["fixed"] or profiles[k]["kind"] in ("themepark", "zoo"):
                continue
            R = 0.6 * widen
            scored = []
            for kind, name, p, label, wh in pool:
                d = wp.km(pt, p)
                if d > R or name in used_files or NEAR_BAD.search(wp.file_label("File:" + name)):
                    continue
                s = -d * 2 + (0.35 if kind == "wd" else 0) + (0.25 if NICE.search(name) else 0)
                scored.append((s, kind, name, label, wh, d))
            scored.sort(key=lambda x: -x[0])
            for s, kind, name, label, wh, d in scored[:12]:
                if take(name, wh, profiles[k], False, d, False):
                    state["pick"][k] = {"title": "File:" + name, "why": "near %.2f km" % d, "near": label or True}
                    break
        save()
    for n, food, pt, k in todo:
        if k not in state["pick"] and k not in state["none"]:
            state["none"].append(k)
    state["v"] = 3
    save()
    got = sum(1 for t in todo if t[3] in state["pick"])
    nn = sum(1 for t in todo if (state["pick"].get(t[3]) or {}).get("near"))
    print("  %s: %d of %d now have a photo (%d of them nearby)" % (slug, got, len(todo), nn), file=sys.stderr, flush=True)
    return state


def fetch_thumb(url):
    """the 960 px thumbnail; a thumbnail that has to be drawn first can be refused for a while, so try other sizes"""
    base = url.split("?")[0]
    if "/thumb/" not in base:   # a small original: its 500 px thumbnail (the original's host is throttled)
        m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w/\w\w)/(.+)$", base)
        tries = (["https://thumb.wikimedia.org/wikipedia/commons/thumb/%s/%s/500px-%s" % (m.group(1), m.group(2), m.group(2))] if m else []) + [base]
    else:
        tries = [base] + [base.replace("/960px-", "/%dpx-" % w) for w in (1280, 500)]
    err = None
    for u in tries:
        try:
            return get(u, gap=0.3, tries=3, timeout=40)
        except Exception as e:
            err = e
    raise err


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


def download(slug, path, img_dir):
    from PIL import Image
    state = json.load(open(path))
    n = 0
    for k, x in state["pick"].items():
        if x.get("file") and os.path.exists(x["file"]):
            continue
        ii = file_info(x["title"][5:], state["info"])
        if not ii:
            continue
        dest = os.path.abspath(os.path.join(img_dir, slug, hashlib.sha1(k.encode()).hexdigest()[:14] + ".jpg"))
        try:
            im = Image.open(io.BytesIO(fetch_thumb(ii["thumb"]))).convert("RGB")
            im.thumbnail((720, 720))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            im.save(dest, "JPEG", quality=JPEG_Q["url"], optimize=True, progressive=True)
            x["file"] = dest; n += 1
            try:   # the small copy, the WebP twins and the blurred preview (a failure here never loses the photo)
                x["more"] = copies(im, dest[:-4])
            except Exception as e:
                print("  extra copies failed", k, e, file=sys.stderr)
            if n % 10 == 0:
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
    """matches -> pending.json {slug: {items: {k: {file, credit, page, near}}, tried, tried2, no}} + upload_list.txt
    (tried: asked Wikidata, kept as it was; tried2: nothing found at all, so not asked again for 30 days;
    no: Commons file names turned down for this city, never picked again)"""
    photos, wanted = load_dir(os.path.join(db, "photos")), load_dir(os.path.join(db, "wanted"))
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
        food = {wp.norm(n) for n in ((wanted.get(slug) or {}).get("food") or [])}
        no = set(cur.get("no") or [])
        items = {}
        for k, x in st["pick"].items():
            ii = st["info"].get(x["title"][5:])
            if k in (cur.get("items") or {}) or not x.get("file") or not ii or NOT_JPEG.search(x["title"]):
                continue
            if (x.get("near") and k in food) or x["title"][5:] in no:
                continue
            f = os.path.abspath(x["file"])
            if not os.path.exists(f):
                continue
            items[k] = {"file": f, "credit": re.sub(r"(\d\.\d)(,\d\.\d)+", r"\1", ii["credit"]), "page": ii["page"]}
            if x.get("near"):
                items[k]["near"] = x["near"]
            uploads.append(f)
            more = x.get("more") or {}
            extra = {a: os.path.abspath(b) for a, b in (more.get("files") or {}).items() if os.path.exists(b)}
            if extra:
                items[k].update({"extra": extra, "lq": more.get("lq", ""), "w": more.get("w"), "smw": more.get("smw")})
                uploads.extend(extra.values())
        tried, tried2 = dict(cur.get("tried") or {}), dict(cur.get("tried2") or {})
        for k in items:
            tried.pop(k, None); tried2.pop(k, None)
        for k in st["none"]:
            tried2[k] = today
        if items or tried != (cur.get("tried") or {}) or tried2 != (cur.get("tried2") or {}):
            out[slug] = {"items": items, "tried": tried, "tried2": tried2, "no": sorted(no)}
    json.dump(out, open(os.path.join(work, "pending.json"), "w"), indent=1, ensure_ascii=False)
    open(os.path.join(work, "upload_list.txt"), "w").write("\n".join(uploads) + ("\n" if uploads else ""))
    print(json.dumps({s: len(v["items"]) for s, v in out.items()}), "total", len(uploads))


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "run":
        db, work = sys.argv[2], sys.argv[3]
        wanted, photos = load_dir(os.path.join(db, "wanted")), load_dir(os.path.join(db, "photos"))
        os.makedirs(os.path.join(work, "p2"), exist_ok=True)
        for slug in (sys.argv[4:] or sorted(wanted)):
            if time.time() > DEADLINE:
                print("time budget used: stopping before", slug, file=sys.stderr, flush=True); break
            cur = photos.get(slug) or {}
            have = set((cur.get("items") or {}).keys())
            path = os.path.join(work, "p2", slug + ".json")
            try:
                run_city(slug, wanted[slug], have, path, wd_tried=set((cur.get("tried") or {}).keys()),
                         have_pages={(v or {}).get("page") for v in (cur.get("items") or {}).values()}, no=cur.get("no") or ())
                download(slug, path, os.path.join(work, "img"))
            except Exception as e:
                print("city failed", slug, repr(e), file=sys.stderr, flush=True)
            print("requests ok %d, throttled %d" % (stats["ok"], stats["429"]), file=sys.stderr, flush=True)
        print("ALLDONE", file=sys.stderr, flush=True)
    elif len(sys.argv) >= 4 and sys.argv[1] == "pending":
        pending(sys.argv[2], sys.argv[3], set(sys.argv[4:]))
    else:
        print(__doc__); sys.exit(2)
