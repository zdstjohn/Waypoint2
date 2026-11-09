"""Photos for a city nobody's trip has used yet: its best-known sights, each with its own photo, straight from Wikidata.

  python3 top_sights.py <cities.json> <work_dir> [per_city] [slug ...]

cities.json = [{slug, country, city, r (km), kind ("city" | "region"), center [lat, lng]}]
For each city: the places within r km that have a photo on Wikidata, most written-about first (Wikipedia language
editions), minus people, stations, airports, schools, hospitals, hotels, companies and the city itself; each photo is
checked for its licence and size and by the photo judge, then downloaded. Writes <work_dir>/p2/<slug>.json in the
photos2 format (pick / info / none), so photos2.pending() and nightly.py finish handle the rest.
"""
import json, os, re, sys, time, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import photos2 as p2, photo_judge as PJ, wide_photos as wp

# what kind of thing a Wikidata item is, read from the names of its classes ("district of Barcelona", "art museum")
NOT_SIGHT = re.compile(r"\b(human|railway station|train station|metro station|subway station|tram stop|bus station|airport|university|college|school|"
                       r"hospital|hotel|hostel|company|business|enterprise|club|sports team|organi[sz]ation|institute|congregation|religious order|"
                       r"agency|embassy|consulate|legislature|parliament|political party|olympic games|sports event|sports season|championship|tournament|"
                       r"competition|film|television|newspaper|publisher|broadcaster|record label|band|research|ministry|court|prison|"
                       r"electoral|constituency|diocese|census|company|bank|corporation|trade union|association|foundation|award|country|"
                       r"sovereign state|language|empire|historical country|nation|dynasty|ethnic group|stock exchange|library|archive|"
                       r"painting|work of art|artwork|sculpture|statue|manuscript|vase|exhibit|collection|fictional|mythical|"
                       r"literary work|written work|book|song|video game)\b", re.I)
# a museum piece (the Venus de Milo) is not a place; a statue that is itself a landmark (the Statue of Liberty) is
LANDMARK = re.compile(r"\b(tourist attraction|monument|landmark|colossal|world heritage)\b", re.I)
ADMIN = re.compile(r"\b(district|comarca|ward|borough|province|county|metropolitan|urban area|administrative|municipality|commune|frazione|"
                   r"city|town|village|human settlement|capital|arrondissement|quarter of|neighbourhood of|parish|region)\b", re.I)
SIGHT = re.compile(r"\b(tourist attraction|museum|gallery|church|cathedral|basilica|chapel|monastery|abbey|mosque|temple|shrine|synagogue|"
                   r"castle|fortress|fort|citadel|palace|villa|mansion|tower|monument|memorial|statue|sculpture|fountain|square|plaza|piazza|"
                   r"park|garden|zoo|aquarium|amusement|theme park|water park|beach|bay|cove|lake|waterfall|cave|mountain|volcano|island|"
                   r"viewpoint|bridge|archaeological|ruins|amphitheat|theatre|theater|opera|concert hall|market|street|avenue|boulevard|"
                   r"promenade|old town|historic|lighthouse|harbou?r|marina|canal|national park|nature reserve|landmark|skyscraper|"
                   r"observation|gate|wall|arch|pier|cable car|funicular|stadium|arena|observatory|library building|lagoon|gorge|cape)\b", re.I)
# a whole state, province or statistical region is never a sight, even in a region where towns are (Florida, South Tyrol, Upper Carniola)
HIGH_ADMIN = re.compile(r"\b(state of the united states|statistical region|region of (iceland|italy|france|greece|portugal|spain)|autonomous region|"
                        r"autonomous province|province of|department of france|county of (florida|the united states|england)|"
                        r"municipality of (mexico|slovenia)|regional unit|administrative region)\b", re.I)
SPORT = re.compile(r"\b(stadium|arena|sports venue|football venue|training|multi-purpose hall|event venue)\b", re.I)
HARD = re.compile(r"\b(stock exchange|stock market|library|parliament|legislature|ministry|court|embassy|campus|school|university|"
                  r"hospital|hotel|company|headquarters|office building|railway station|airport)\b", re.I)
BAD_NAME = re.compile(r"\b(station|stazione|gare|bahnhof|estación|airport|aeroporto|aéroport|flughafen|university|università|hospital|"
                      r"ospedale|hôpital|embassy|ambasciata|consulate|ministry|ministero|headquarters|metro|tram stop|bus station|"
                      r"district court|prison|carcere|school|liceo|scuola|hotel|war memorial|olympics|championships?|open$|diocese|archdiocese|eparchy|"
                      r"community of|province of|metropolitan city|autonomous|prefecture|emirate of|monster|municipality|municipio|statistical region)\b|"
                      r"^(county|state|municipality|region) of\b|^(congress|treaty|battle|siege|council|peace|sack) of\b|\b(1[89]|20)\d\d\b|"
                      r"^(northern|southern|eastern|western|central) (italy|spain|france|greece|portugal|germany|europe|england|scotland|"
                      r"mexico|japan|california|florida|thailand|asia|america)$", re.I)

Q = """SELECT ?item ?label ?img ?links ?coord (SAMPLE(?cat) AS ?ccat) (COUNT(DISTINCT ?h) AS ?heritage)
       (GROUP_CONCAT(DISTINCT ?cl; separator="|") AS ?cls) (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(%f %f)"^^geo:wktLiteral . bd:serviceParam wikibase:radius "%g" . }
  ?item wdt:P18 ?img ; wikibase:sitelinks ?links .
  FILTER(?links >= %d)
  FILTER NOT EXISTS { ?item wdt:P576 ?gone }   # demolished or dissolved: the old World Trade Center, the Bastille
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  OPTIONAL { ?item wdt:P31 ?c . ?c rdfs:label ?cl . FILTER(LANG(?cl) = "en") }
  OPTIONAL { ?item wdt:P373 ?cat }
  OPTIONAL { ?item wdt:P1435 ?h }
  OPTIONAL { { ?item skos:altLabel ?alt FILTER(LANG(?alt) = "en") } UNION { ?item rdfs:label ?alt FILTER(LANG(?alt) = "%s") } }
} GROUP BY ?item ?label ?img ?links ?coord ORDER BY DESC(?links) LIMIT 250"""


def sights(c):
    lat, lng = c["center"]
    for minlinks in (12, 6, 3):
        lang = wp.LOCAL.get(wp.norm(c["country"]), "en")
        body = urllib.parse.urlencode({"query": Q % (lng, lat, c["r"], minlinks, lang), "format": "json"}).encode()
        d = json.loads(p2.get("https://query.wikidata.org/sparql", gap=4, accept="application/sparql-results+json", data=body, tries=8))
        out = keep(c, d["results"]["bindings"])
        if len(out) >= 30 or minlinks == 3:
            return out


def keep(c, rows):
    out, seen_img, seen_name = [], set(), set()
    city_n = wp.norm(c["city"])
    for b in rows:
        label = b["label"]["value"]; n = wp.norm(label)
        cls = (b.get("cls") or {}).get("value", "")
        img = urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1])
        if not n or n in seen_name or img in seen_img or BAD_NAME.search(label) or re.fullmatch(r"q\d+", n) or n == city_n:
            continue
        links = int(b["links"]["value"]); heritage = int(b["heritage"]["value"] or 0) > 0
        landmark = bool(LANDMARK.search(cls))
        classes = [x for x in cls.split("|") if x]
        art = re.compile(r"\b(painting|sculpture|statue|work of art|artwork|relief|mosaic|fresco)\b", re.I)
        if classes and all(art.search(x) for x in classes) and not landmark:
            continue   # a museum piece (the Venus de Milo), not a place
        place_cls = "|".join(x for x in classes if not art.search(x) or re.search(r"garden|park", x, re.I))   # a "sculpture garden" is a garden
        sight, admin = bool(SIGHT.search(place_cls)) or landmark, bool(ADMIN.search(cls))
        if NOT_SIGHT.search(place_cls) and not landmark and not sight:
            continue   # a company, a language, an event, a school
        if HIGH_ADMIN.search(cls) and not landmark:
            continue
        if HARD.search(cls) and not landmark and not heritage:
            continue   # a library, a stock exchange, a parliament: a building people work in, not one they visit
        if not (sight or heritage or links >= 100 or (admin and c["kind"] == "region")):
            continue   # (a region's towns, Sirmione or Vernazza, are its sights)
        if SPORT.search(cls) and links < 80:
            continue   # stadiums only when famous in their own right (Camp Nou)
        if admin and not sight and c["kind"] == "city" and not re.search(r"neighbou?rhood|quarter", cls, re.I):
            continue   # the city's districts and suburbs; a region's towns (Vernazza, Positano) stay
        score = links * (1.5 if sight else 1.0) * (1.3 if heritage else 1.0) * (0.45 if SPORT.search(cls) and not heritage else 1.0) * (0.6 if admin and not sight else 1.0)
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
        seen_name.add(n); seen_img.add(img)
        alts = []
        for a in (b.get("alts") or {}).get("value", "").split("|"):
            an = wp.norm(a)
            if an and an != n and an != city_n and len(an) >= 5 and an not in alts and not re.fullmatch(r"(the )?(cathedral|church|castle|museum|park|beach|old town|harbou?r|port|market|basilica|tower|palace)", an):
                alts.append(an)
        out.append({"name": label, "file": img, "links": links, "score": score, "cat": (b.get("ccat") or {}).get("value"), "cls": cls, "alts": alts[:8],
                    "pt": [float(m.group(2)), float(m.group(1))] if m else None})
    out.sort(key=lambda x: -x["score"])
    return out


def judged(c, s, f, state, common):
    """is this file a good photo of sight s? (licence, size, and the photo judge)"""
    if not re.search(r"\.jpe?g$", f, re.I):
        return False, "not a jpeg photo"
    ii = p2.file_info(f, state["info"])
    # a landmark's own photo may be a wide view (the Louvre's courtyard at night): the page crops it to the middle
    if not ii or ii["w"] < 640 or ii["h"] < 400 or not 0.66 <= ii["w"] / max(1, ii["h"]) <= 2.7:
        return False, "too small or not free"
    place = PJ.place_profile(s["name"], False, c["city"], c["country"], common)
    ph = PJ.photo_profile(f, ii.get("cats"), ii.get("desc", ""), ii["w"], ii["h"])
    hit = PJ.name_words_in(place, f, ii.get("cats") or [], ii.get("desc", ""))
    thit = PJ.name_words_in(place, f, ii.get("cats") or [], only_title=True, city=c["city"])
    ok, score, why = PJ.judge(place, ph, True, None, hit, True, True, thit)
    return ok, why


def run(c, work, per_city):
    path = os.path.join(work, "p2", c["slug"] + ".json")
    old = json.load(open(path)) if os.path.exists(path) else {}
    if old.get("done") and not REDO:
        return
    # with --redo a finished city is filtered again, keeping (and not re-fetching) the sights that still qualify
    state = {"pick": {}, "info": old.get("info") or {}, "none": [], "judged": old.get("judged") or {}, "city": c["city"], "country": c["country"]}
    before = old.get("pick") or {}
    cand = sights(c)
    common = set()
    for s in cand:
        if len(state["pick"]) >= per_city:
            break
        k = wp.norm(s["name"])
        if k in before and before[k]["title"][5:] not in BAD and judged(c, s, before[k]["title"][5:], state, common)[0]:
            state["pick"][k] = dict(before[k], alts=s.get("alts") or []); continue   # still passes today's rules: keep it
        f = s["file"]
        ok, why = (False, "turned down (black and white, or by eye)") if f in BAD else judged(c, s, f, state, common)
        state["judged"][f] = why
        if not ok and s.get("cat"):
            # the item's own photo won't do (an event in front of the Sagrada Família): the best photo in its Commons category
            fl = [x for x in p2.category_files(s["cat"]) if x[3] and x[4]]
            pl = PJ.place_profile(s["name"], False, c["city"], c["country"], common)
            fl.sort(key=lambda x: -((0.6 if PJ.name_words_in(pl, x[0], only_title=True) else 0) + (0.3 if p2.NICE.search(x[0]) else 0) + min(x[3], 4000) / 4000))
            for x in fl[:5]:
                if not p2.ok_title("File:" + x[0]) or x[0] in BAD:
                    continue
                ok, why = judged(c, s, x[0], state, common)
                state["judged"][x[0]] = why
                if ok:
                    f = x[0]; break
        if not ok:
            continue
        state["pick"][wp.norm(s["name"])] = {"title": "File:" + f, "why": "wikidata top %d: %s" % (s["links"], s["name"]), "near": False, "name": s["name"], "pt": s["pt"], "alts": s.get("alts") or []}
    state["done"] = True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(state, open(path, "w"), indent=0, ensure_ascii=False)
    print("  %s: %d sights with photos (of %d candidates)" % (c["slug"], len(state["pick"]), len(cand)), file=sys.stderr, flush=True)


REDO = False
BAD = set()   # files turned down after download: black and white (see colour_check), or by eye
def colour_check(work):
    """photos with no colour at all are old prints or black-and-white shots: turn them down so a colour photo is chosen"""
    from PIL import Image, ImageStat
    bad_path = os.path.join(work, "bad_files.json")
    bad = set(json.load(open(bad_path))) if os.path.exists(bad_path) else set()
    for fn in os.listdir(os.path.join(work, "p2")):
        st = json.load(open(os.path.join(work, "p2", fn)))
        for v in st["pick"].values():
            p = v.get("file")
            if p and os.path.exists(p):
                im = Image.open(p).convert("HSV"); im.thumbnail((200, 200))
                if ImageStat.Stat(im).mean[1] / 255 < 0.015:
                    bad.add(v["title"][5:])
    json.dump(sorted(bad), open(bad_path, "w"), indent=0, ensure_ascii=False)
    return bad
if __name__ == "__main__":
    REDO = "--redo" in sys.argv; sys.argv = [a for a in sys.argv if a != "--redo"]
    cities = json.load(open(sys.argv[1])); work = sys.argv[2]
    if os.path.isdir(os.path.join(work, "p2")):
        BAD = colour_check(work)
    per_city = int(sys.argv[3]) if len(sys.argv) > 3 else 18
    only = set(sys.argv[4:])
    for c in cities:
        if only and c["slug"] not in only:
            continue
        try:
            run(c, work, per_city)
            p2.download(c["slug"], os.path.join(work, "p2", c["slug"] + ".json"), os.path.join(work, "img"))
        except Exception as e:
            print("city failed", c["slug"], repr(e)[:200], file=sys.stderr, flush=True)
    print("requests ok %d, throttled %d" % (p2.stats["ok"], p2.stats["429"]), file=sys.stderr)
    print("ALLDONE", file=sys.stderr)
