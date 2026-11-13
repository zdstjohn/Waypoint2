"""Find each attraction's official website via Wikipedia -> Wikidata (property P856), for Waypoint's Tickets links.
Usage: python3 official_links.py <wanted_dir> <cities.json> <out_dir>
Writes <out_dir>/<slug>.json = {"items": {"<norm name>": {"url", "title", "q", "src": "wikidata"}}}"""
import json, math, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "WaypointTripPlanner/1.0 (personal trip planner; official-site lookup)"}
STOP = {"the", "of", "and", "a", "de", "di", "del", "della", "la", "le", "el", "il", "lo", "tour", "visit", "walk", "day", "trip",
        "museum", "museo", "church", "old", "town", "city", "park", "&", "at", "in", "to"}
RESELL = re.compile(r"(getyourguide|viator|tiqets|klook|headout|musement|civitatis|tripadvisor|expedia|booking\.com|google\.|facebook\.|instagram\.|wikipedia\.)", re.I)
EN = "Q1860"


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def toks(s, city=""):
    c = set(norm(city).split())
    return [t for t in norm(s).split() if t not in STOP and t not in c and len(t) > 1]


def km(a, b):
    r = math.pi / 180
    x = math.sin((b[0] - a[0]) * r / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin((b[1] - a[1]) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))


_last = [0.0]
def get(url):
    """one request at a time, at most ~1 per second, and back off when Wikimedia asks us to"""
    for i in range(6):
        wait = 0.9 - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            err = e
            time.sleep(int(e.headers.get("Retry-After") or 0) or 8 * (i + 1))
        except Exception as e:
            err = e; time.sleep(3 * (i + 1))
    raise err


def lookup(name, city, centre):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "generator": "search", "gsrsearch": name + " " + city, "gsrlimit": 4,
                                "prop": "pageprops|coordinates", "ppprop": "wikibase_item"})
    pages = sorted((get("https://en.wikipedia.org/w/api.php?" + q).get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 9))
    want = set(toks(name, city))
    for p in pages:
        qid = (p.get("pageprops") or {}).get("wikibase_item")
        if not qid: continue
        have = set(toks(p["title"], city))
        if not want or not have: continue
        overlap = len(want & have) / len(want)
        # the article must really be this place: most of the name matches, or the article's whole title sits inside the name
        # ("Alhambra" for "Alhambra and Nasrid Palaces"), checked against the city's location below
        if not ((overlap >= 0.6 and len(want & have) / len(have) >= 0.4) or (have <= want and len(have) >= 1 and sum(len(t) for t in have) >= 6)): continue
        co = (p.get("coordinates") or [{}])[0]
        if centre and co.get("lat") is not None and km(centre, (co["lat"], co["lon"])) > 60: continue   # same name, different city
        ent = get("https://www.wikidata.org/wiki/Special:EntityData/%s.json" % qid)["entities"]
        ent = ent.get(qid) or next(iter(ent.values()))
        sites = []
        for c in ent.get("claims", {}).get("P856", []):
            v = (c.get("mainsnak", {}).get("datavalue") or {}).get("value")
            if not v or RESELL.search(v): continue
            langs = [x.get("datavalue", {}).get("value", {}).get("id") for x in c.get("qualifiers", {}).get("P407", [])]
            rank = (0 if c.get("rank") == "preferred" else 1, 0 if EN in langs or re.search(r"/en(/|$)|\ben\.", v) else 1)
            sites.append((rank, v))
        if sites:
            url = sorted(sites)[0][1].replace("http://", "https://", 1)
            return {"url": url, "title": p["title"], "q": qid, "src": "wikidata"}
        return None
    return None


def main():
    wanted_dir, cities_path, out_dir = sys.argv[1:4]
    centres = {c["slug"]: tuple(c["detail"][:2]) for c in json.load(open(cities_path)) if c.get("detail")}
    os.makedirs(out_dir, exist_ok=True)
    for fn in sorted(os.listdir(wanted_dir)):
        if not fn.endswith(".json"): continue
        d = json.load(open(os.path.join(wanted_dir, fn))); d = d.get("data", d)
        slug = fn[:-5]
        centre = tuple(d.get("home") or d.get("center") or ()) or centres.get(slug)
        names = [x["n"] for x in d.get("paid") or []] or d.get("spots", [])
        only = os.environ.get("ONLY_MISSING")
        prev = json.load(open(os.path.join(out_dir, slug + ".json")))["items"] if only and os.path.exists(os.path.join(out_dir, slug + ".json")) else None
        if only:
            if slug not in only.split(","): continue
            names = [n for n in names if norm(n) not in (prev or {}) and len(toks(n, d["city"])) >= 2]
        if os.path.exists(os.path.join(out_dir, slug + ".json")) and not only:
            continue
        res = [(n, safe(lookup, n, d["city"], centre)) for n in names]
        items = dict(prev or {}); items.update({norm(n): r for n, r in res if r})
        json.dump({"items": items, "city": d["city"], "country": d["country"]}, open(os.path.join(out_dir, slug + ".json"), "w"), indent=1, ensure_ascii=False)
        print("%-22s %2d of %2d places have a verified official site" % (slug, len(items), len(names)), flush=True)


def safe(f, *a):
    try: return f(*a)
    except Exception as e:
        print("  skip", a[0], e, file=sys.stderr); return None


if __name__ == "__main__":
    main()
