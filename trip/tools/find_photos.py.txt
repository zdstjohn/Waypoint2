"""Find real, freely licensed photos on Wikipedia/Wikimedia Commons for the places a Waypoint trip uses.

Input:  wanted.json  -> [{"id": "italy-rome", "country": "Italy", "city": "Rome", "spots": [...], "food": [...]}, ...]
        done.json    -> (optional) {"italy-rome": {"<norm name>": {...}}} already found, skipped on re-runs
Output: out/<slug>/<n>.jpg resized photos, and manifest.json:
        {"cities": {"italy-rome": {"<norm name>": {"file": "...", "credit": "...", "page": "..."}}},
         "dishes": {"pasta": {"file": ..., "credit": ..., "page": ...}}}
Names are normalized exactly like the page's W.norm so the app can look them up.
"""
import io, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from PIL import Image

UA = {"User-Agent": "WaypointTripPlanner/1.0 (personal trip planner; photo lookup)"}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
STOP = {"the", "of", "and", "a", "de", "di", "del", "della", "la", "le", "el", "il", "lo", "das", "der", "tour", "visit", "walk", "day", "trip"}
DISHES = {"pasta": "Carbonara", "pizza": "Pizza Margherita", "seafood": "Grilled octopus", "grill": "Souvlaki", "taverna": "Greek salad",
          "cafe": "Cappuccino", "bakery": "Croissant", "gelato": "Gelato", "streetfood": "Gyros", "wine": "Wine tasting", "sushi": "Sushi",
          "noodles": "Ramen", "tacos": "Taco", "curry": "Curry", "deli": "Charcuterie"}


_FOLD = {"ł": "l", "ø": "o", "ß": "ss", "đ": "d", "æ": "ae", "þ": "th", "ı": "i"}  # (letters that are no base letter plus an accent)


def norm(s):
    """The app's name rule, trip/lib/core.js W.norm (one copy per script: each is fetched on its own by the nightly
    tasks; the tools suite checks every copy gives the app's answers): plain lower-case letters and digits; a name with
    no Latin letters or digits at all (Αθήνα, 東京) is "u" and the hex of each code point, so it still tells places apart"""
    t = "".join(_FOLD.get(c, c) for c in str(s or "").lower())
    t = re.sub("[\u0300-\u036f]", "", unicodedata.normalize("NFD", t))
    a = re.sub(r"[^a-z0-9]+", " ", t).strip()
    return a or " ".join("u%x" % ord(c) for c in t if c.isalnum())


def get_json(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                return json.load(r)
        except Exception as e:  # network hiccup or rate limit: back off briefly
            err = e
            time.sleep(1.5 * (attempt + 1))
    raise err


def tokens(s):
    return [t for t in norm(s).split() if t not in STOP and len(t) > 1]


def match_score(name, title):
    a, b = set(tokens(name)), set(tokens(title))
    if not a or not b:
        return 0
    return len(a & b) / len(a)


def search(query, name, need):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "generator": "search", "gsrsearch": query, "gsrlimit": 4,
                                "prop": "pageimages|info", "piprop": "thumbnail|name", "pithumbsize": 720, "pilicense": "free", "inprop": "url"})
    data = get_json("https://en.wikipedia.org/w/api.php?" + q)
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    for p in pages:
        if "thumbnail" in p and match_score(name, p["title"]) >= need:
            return p
    return None


def credit_for(file_name):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + file_name, "prop": "imageinfo", "iiprop": "extmetadata"})
    try:
        data = get_json("https://commons.wikimedia.org/w/api.php?" + q)
        page = next(iter(data["query"]["pages"].values()))
        meta = page["imageinfo"][0]["extmetadata"]
        artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
        lic = meta.get("LicenseShortName", {}).get("value", "")
        return ", ".join(x for x in [artist[:60], lic] if x) or "Wikimedia Commons"
    except Exception:
        return "Wikimedia Commons"


def save(url, path):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    im.thumbnail((720, 720))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "JPEG", quality=74, optimize=True, progressive=True)


def photo(query, name, need, path):
    p = search(query, name, need)
    if not p:
        return None
    save(p["thumbnail"]["source"], path)
    fname = p.get("pageimage", "")
    return {"file": path, "credit": credit_for(fname) if fname else "Wikimedia Commons",
            "page": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fname) if fname else p.get("fullurl", "")}


def main():
    wanted = json.load(open(os.path.join(HERE, "wanted.json")))
    done_path = os.path.join(HERE, "done.json")
    done = json.load(open(done_path)) if os.path.exists(done_path) else {}
    manifest = {"cities": {}, "dishes": {}}
    for c in wanted:
        slug, city, country = c["id"], c["city"], c["country"]
        got = manifest["cities"].setdefault(slug, {})
        for i, n in enumerate(c.get("spots", [])):
            k = norm(n)
            if k in done.get(slug, {}):
                continue
            try:
                r = photo(n + " " + city, n, 0.5, os.path.join(OUT, slug, "s%02d.jpg" % i))
            except Exception as e:
                print("skip", n, e, file=sys.stderr); r = None
            if r:
                got[k] = r
        for i, n in enumerate(c.get("food", [])):
            k = norm(n)
            if k in done.get(slug, {}):
                continue
            try:  # restaurants rarely have articles: only accept a near-exact title match
                r = photo(n + " " + city + " restaurant", n, 0.8, os.path.join(OUT, slug, "f%02d.jpg" % i))
            except Exception as e:
                print("skip", n, e, file=sys.stderr); r = None
            if r:
                got[k] = r
        print(slug, len(got), "photos", file=sys.stderr)
    if False:  # stand-in dish photos are not used: only photos of the actual place
        for kind, title in DISHES.items():
            try:
                r = photo(title, title, 0.5, os.path.join(OUT, "dishes", kind + ".jpg"))
            except Exception as e:
                print("skip dish", kind, e, file=sys.stderr); r = None
            if r:
                manifest["dishes"][kind] = r
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w"), indent=1)
    print(json.dumps({k: len(v) for k, v in manifest["cities"].items()}), len(manifest["dishes"]), "dishes")


if __name__ == "__main__":
    main()
