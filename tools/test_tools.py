#!/usr/bin/env python3
"""Checks on the nightly tools' own logic, on fixed examples, with no network (the audit's T4):
    python3 tools/test_tools.py
What decides whether a place the check found on the map is the place the trip means (place_check.sim), how opening
hours written the OpenStreetMap way are read (hours_from_osm), distances, and the map-tile helpers (mvt, pin_check).
The examples are the ones the tools' own comments give as the reason for each rule. Fetching and writing are not
covered here: those need the services themselves."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import place_check as pc, mvt, pin_check as pk

fails = []
def ok(cond, what):
    if not cond: fails.append(what)

# --- is the place on the map the place the trip means? ---
pc.set_city("Rethymno", "Greece")
s = pc.sim
ok(s("Rethymno Public Garden", "Rethymno") == 0, "a map label that is only the town's name is no match for a place in that town")
ok(s("Rethymno City Beach", "Rethymno Beach") >= 0.7, "the town's beach under a slightly different name is still the same beach")
ok(s("Hersonissos Old Port", "Old Port") <= 0.35, "another town's Old Port is not this town's: the item has a name of its own the candidate lacks")
ok(s("Old Port", "Old Port") >= 0.85, "the same weak name on both sides, for the same kind of place, matches")
ok(s("Fortezza", "Fortetza") >= 0.85, "one letter's difference in a name is the same place")
ok(s("Public Garden", "Public") <= 0.45, "a shop called Public is not the Public Garden")
ok(s("Archaeological Museum of Rethymno", "Archaeological Museum") == 1.0, "the town's name adds nothing: the same museum")
ok(s("Central Market", "Municipal Library") == 0, "a market is not a library")
ok(s("Avli Restaurant", "Avli") == 1.0 and s("Avli Restaurant", "Bakery") == 0, "a restaurant matches its own name, and not a place called just Bakery")
ok(pc.norm("Caffè  Sant'Eustachio") == "caffe sant eustachio", "names are compared without accents, case or punctuation")
ok(pc.toks("The Old Bakery & Café") == [], "words that say only what kind of place it is are not a name")

# --- a map label near Google's pin: the place we mean, or another one next to it? (label_fits, the v174 audit's cases) ---
f = pc.label_fits
pc.set_city("Granada", "Spain")
ok(not f("Centro de Salud La Herradura", ["Playa de La Herradura", "La Herradura"], 348), "a health centre is not the beach it shares a name with")
ok(not f("Hotel Navas", ["Tapas Crawl on Calle Navas", "Calle Navas"], 44), "a hotel on the street is not the street")
ok(f("Castillo de Salobreña", ["Salobreña Castle and Old Town", "Salobreña Castle"], 38), "the castle in Spanish is the same castle")
ok(f("Cafetería - Heladería Isla de Capri", ["Evening paseo and ice cream", "Isla de Capri"], 39), "an ice-cream outing may land on the ice-cream shop of that name")
pc.set_city("Mallorca", "Spain")
ok(not f("Cala d'Or", ["Cafeteria Sa Plaça Cala d'Or", "Cafetería Plaza, Cala D'Or White Chairs"], 41, True), "a café is not the resort it is in")
ok(f("Es Port", ["Restaurant Es Port Cala Figuera", "Restaurante Pizzería Es Port"], 4, True), "within 25 m the pin is the place's either way")
ok(f("Ca'n Molinas", ["Ca n Molinas", "Forn i Pastisseria Ca'n Molinas"], 40, True), "a bakery under its own name, without the word for bakery")
pc.set_city("Chania", "Greece")
ok(f("ΞΥΛΟΣΚΑΛΟ", ["Xyloskalo Viewpoint Walk", "Xyloskalo"], 60), "a label in Greek letters is read as Latin ones")
ok(not f("Periptero Splantzia", ["Old Town (Splantzia & Topanas)", "Splantzia"], 54), "a kiosk on the square is not the quarter")
pc.set_city("Naples", "Italy")
ok(not f("Capri Watch", ["Capri Island Day Trip", "Capri"], 295), "a shop called Capri Watch is not the island")
ok(not f("Trattoria e pizzeria spaccanapoli", ["Naples Historic Centre (Spaccanapoli)", "SpaccaNapoli"], 45), "a restaurant named after the street is not the street")

# --- opening hours as OpenStreetMap writes them (minutes from midnight; closed: 0 = Sunday) ---
h = pc.hours_from_osm
ok(h("Mo-Fr 09:00-17:00") == {"o": 540, "c": 1020, "closed": [0, 6]}, "weekdays nine to five: closed at the weekend")
ok(h("Tu-Su 10:00-18:00; Mo off") == {"o": 600, "c": 1080, "closed": [1]}, "closed on Mondays")
ok(h("22:00-02:00") == {"o": 1320, "c": 1560, "closed": []}, "closing after midnight counts into the next day")
ok(h("Mo-Su 08:00-20:00; PH off") == {"o": 480, "c": 1200, "closed": []}, "a note about public holidays does not close a weekday")
ok(h("Mo 09:00-12:00; Tu 10:00-14:00; We off") is None and h("24/7") is None and h("") is None, "hours too varied to put in one line are left out, not guessed")

# --- distances and map tiles ---
ok(8.2 < pc.km(41.9, 12.5, 41.9, 12.6) < 8.4, "a tenth of a degree of longitude at Rome is about 8.3 km")
ok(all(mvt.varint(mvt.enc_varint(n), 0)[0] == n for n in (0, 1, 127, 128, 300, 2 ** 31)), "a number written as a varint reads back the same")
ok(mvt.tilexy(41.9, 12.5, 14) == (8760, 6088) and [int(v) for v in pk.tilexy_f(41.9, 12.5)] == [8760, 6088], "Rome's centre falls in the same map tile for both tools")
sq = [[(0, 0), (10, 0), (10, 10), (0, 10)]]
ok(pk._inside(5, 5, sq) and not pk._inside(15, 5, sq), "a point is inside a square or outside it")

# --- the Google check through a connector: no key, answers copied into a file by the nightly session ---
import json, tempfile, datetime
G1, F1 = "ChIJHdo3jOBhLxMRKCYIpacycaQ", "0x132f61e08c37da1d:0xa47132a7a5082628"     # a real pair (a gelateria in Rome)
G2, F2 = "ChIJkWu2F0VgLxMRTxb3BAW44A0", "0x132f604517b66b91:0xde0b80504f7164f"       # (the second number has 15 digits)
ok(pc.gid_ok(G1, F1) and pc.gid_ok(G2, F2), "a place ID agrees with the feature id in the place's own link")
ok(not pc.gid_ok(G1[:-1] + "R", F1) and not pc.gid_ok(G1, F1[:-1] + "9") and not pc.gid_ok(G1, "") and not pc.gid_ok("", F1), "one wrong character in either, or one of them missing, and the ID is not used")
ok(pc.says("**La Romana** [0] (4.9★ (16144)) is a trendy ice cream shop offering crêpes.") == (["ice_cream_shop"], ["ice_cream_shop"]), "what a place is, from Google's line about it")
ok(pc.says("**Museo** [2] (4.5★ (10)) is a small museum with a cafe.") == (["museum"], ["cafe", "museum"]), "a museum with a cafe is a museum; the cafe is only mentioned")
ok(pc.says("") == ([], []), "no line, no kinds")
_os = os
with tempfile.TemporaryDirectory() as tmp:
    db, work = _os.path.join(tmp, "db"), _os.path.join(tmp, "work")
    for d in ("wanted", "places"): _os.makedirs(_os.path.join(db, d))
    old = (datetime.date.today() - datetime.timedelta(days=27)).isoformat(); gone = (datetime.date.today() - datetime.timedelta(days=31)).isoformat()
    json.dump({"city": "Rome", "country": "Italy", "center": [41.8986, 12.4769], "spots": ["Pantheon"], "food": ["Gelateria La Romana", "Frigidarium", "Bar Senza Nome"], "used": [], "when": None},
              open(_os.path.join(db, "wanted", "italy-rome.json"), "w"))
    json.dump({"city": "Rome", "country": "Italy", "items": {
        "pantheon": {"st": "open", "name": "Pantheon", "lat": 41.8986, "lng": 12.4769, "g": "ChIJqUCGZ09gLxMRLM42IPpl0co"},
        "frigidarium": {"st": "open", "name": "Frigidarium", "lat": 41.8980, "lng": 12.4700, "g": G2, "gpin": 1, "gat": old},
        "old pin": {"st": "open", "name": "Old Pin", "lat": 41.9, "lng": 12.5, "g": "ChIJ_4zWvFFgLxMR3761mjXoB1c", "gpin": 1, "gat": gone}}},
              open(_os.path.join(db, "places", "italy-rome.json"), "w"))
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf): pc.gtodo(db, work, 30)
    lines = [x for x in buf.getvalue().splitlines() if x.strip()]
    todo = json.load(open(_os.path.join(work, "gtodo.json")))["todo"]
    ok(len(lines) == 4 and lines[0] == "1 | Frigidarium, Rome | 41.89800,12.47000 | 3" and lines[1].startswith("2 | Old Pin, Rome | "), "the list starts with the Google pins due for renewal: " + repr(lines))
    ok([e["kind"] for e in todo] == ["renew", "renew", "find", "find"] and {e.get("name") for e in todo[2:]} == {"Gelateria La Romana", "Bar Senza Nome"}, "then the places with no Google ID yet; one that has an ID is not asked again")
    ok([x.rsplit(" | ", 1)[1] for x in lines] == ["3", "3", "5", "5"], "a renewal asks Google for 3 places, a place with no pin yet for 5: " + repr(lines))
    by = {e.get("name") or e["key"]: e["n"] for e in todo}
    ans = [
        {"n": by["frigidarium"], "places": [{"id": G2, "lat": 41.8982333, "lng": 12.4704548, "title": "Frigidarium - Google Maps", "fid": "https://www.google.com/maps/place//data=!4m2!3m1!1s" + F2}], "summary": "**Frigidarium** [0] (4.7★ (9302)) is a popular takeout spot."},
        {"n": by["Gelateria La Romana"], "places": [
            {"id": G1[:-1] + "R", "lat": 41.8966936, "lng": 12.4741213, "title": "Gelateria La Romana dal 1947 - Google Maps", "fid": F1},      # a miscopied ID: left out
            [G1, 41.8966936, 12.4741213, "Gelateria La Romana dal 1947 - Google Maps", F1]],
         "summary": "**Gelateria La Romana dal 1947** [0] (4.9★ (16144)) is an ice cream shop.\n\n**Gelateria La Romana dal 1947** [1] (4.9★ (16144)) is a trendy and family-friendly ice cream shop offering crêpes."},
        {"n": by["Bar Senza Nome"], "places": [], "summary": ""}]
    af = _os.path.join(work, "ganswers.jsonl"); open(af, "w").write("\n".join(json.dumps(a) for a in ans) + "\nnot json\n")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf): pc.gapply(db, work, af)
    st = json.loads(buf.getvalue().strip().splitlines()[-1]); it = json.load(open(_os.path.join(work, "places", "italy-rome.json")))["items"]
    rom = it.get("gelateria la romana") or {}
    ok(rom.get("g") == G1 and rom.get("st") == "open" and abs(rom.get("lat", 0) - 41.8966936) < 1e-4, "a match keeps Google's place ID and its pin: " + json.dumps(rom))
    ok(st["bad_ids"] == 1 and st["matched"] == 1 and st["looked"] == 2, "a miscopied ID is dropped and counted: " + json.dumps(st))
    ok(it["frigidarium"]["gat"] == pc.TODAY and abs(it["frigidarium"]["lat"] - 41.8982333) < 1e-6 and st["renewed"] == 1, "a Google pin 27 days old is renewed from the answer with the same ID")
    ok("lat" not in it["old pin"] and "gpin" not in it["old pin"] and it["old pin"]["g"] and st["removed"] == 1, "one past 30 days comes off; its place ID stays")
    ok((it.get("bar senza nome") or {}).get("gq") == pc.TODAY and "g" not in it["bar senza nome"], "a place Google does not know is marked as asked")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf): pc.gtodo(_os.path.join(tmp, "db2") if False else db, _os.path.join(tmp, "work"), 30)
    ok("Bar Senza Nome" not in buf.getvalue() and "Gelateria La Romana" not in buf.getvalue(), "and is not asked again the next night: " + repr(buf.getvalue()))
    # with no answers at all (the connector not attached): nothing is matched, and old Google pins still come off
    work2 = _os.path.join(tmp, "work2"); buf = io.StringIO()
    with contextlib.redirect_stdout(buf): pc.gtodo(db, work2, 30); pc.gapply(db, work2, _os.path.join(work2, "none.jsonl"))
    st2 = json.loads(buf.getvalue().strip().splitlines()[-1]); it2 = json.load(open(_os.path.join(work2, "places", "italy-rome.json")))["items"]
    ok(st2["matched"] == 0 and st2["removed"] == 1 and st2["answers"] == 0 and "lat" not in it2["old pin"] and it2["frigidarium"]["gat"] == old, "without answers only the 30-day rule acts: " + json.dumps(st2))

# --- street-map packs: basE91 parts, the town centre first (pack2json.py) ---
import random, gzip, struct, pack2json as p2j
rg = random.Random(3)
ok(all(p2j.b91dec(p2j.b91enc(x)) == x for x in [b"", b"\x00", b"\xff", b"ab", bytes(range(256)), bytes(40), b"\xff" * 41] + [rg.randbytes(rg.randint(1, 900)) for _ in range(60)]), "basE91 text reads back as the bytes it was made from, for every length")
ok(not set(p2j.b91enc(rg.randbytes(5000))) & set('"\\'), "basE91 text has no quote or backslash, so a part's JSON needs no escapes")
big = rg.randbytes(300000); ok(len(p2j.b91enc(big)) / len(big) < 1.24, "basE91 is about 23% over the bytes (base64: 33%)")
def _tile(z, x, y, n): return ((z, x, y), gzip.compress(rg.randbytes(n), 1))
_t = [_tile(z, x, y, 3000) for z in (9, 10, 11, 12) for x in (1, 2) for y in (1, 2)] + [_tile(14, 7000 + i, 5000, 4000) for i in range(6)]
_h = {"v": 1, "slug": "x-y", "city": "Y", "country": "X", "b": [-1, -1, 1, 1], "places": [-0.01, -0.01, 0.01, 0.01], "zmin": 9, "zmax": 14}
_old = p2j.assemble(_h, _t); _new = p2j.relayout(_old)
ok(p2j.header(_new).get("lay") == 2 and p2j.relayout(_new) == _new, "an older pack is laid out town centre first once, and a laid-out one is left alone")
ok(dict(p2j.tiles_of(_new)[1]) == dict(p2j.tiles_of(_old)[1]), "laying a pack out moves tiles and changes none")
_cs = p2j.cuts(_new); ok(_cs[0][0] == 0 and _cs[-1][1] == len(_new) and all(_cs[i][1] == _cs[i + 1][0] for i in range(len(_cs) - 1)), "the parts cover the pack exactly, in order")
_pd = p2j.part_doc("x-y", 0, 1, 0, _new, len(_new)); _j = json.loads(_pd)
ok(_j["v"] == 2 and _j["enc"] == "b91" and p2j.b91dec(_j["d"]) == _new and _pd.rindex('"d"') > _pd.rindex('"size"'), "a part's text is JSON, its facts first and the bytes last")

# --- the copy the nightly tasks read (trip/tools/<name>.py.txt, published with the app) is the same as the one here ---
_here = os.path.dirname(os.path.abspath(__file__))
_pub = os.path.join(_here, "..", "trip", "tools")
_drift = [n for n in sorted(os.listdir(_pub)) if n.endswith(".py.txt") and os.path.exists(os.path.join(_here, n[:-4]))
          and open(os.path.join(_pub, n), "rb").read() != open(os.path.join(_here, n[:-4]), "rb").read()]
ok(not _drift, "each nightly script's published copy (trip/tools/*.py.txt) is the same as tools/*.py; these differ: " + ", ".join(_drift))

# --- the photo copies: small, WebP twins, blurred preview (big_photos.py, photos2.py, nightly.py), with no network ---
import subprocess
_here = os.path.dirname(os.path.abspath(__file__))
_chk = os.path.join(_here, "..", "test", "py", "photo_copies.py")
if os.path.exists(_chk):
    _r = subprocess.run([sys.executable, "-I", _chk], capture_output=True, text=True)
    try: _j = json.loads(_r.stdout)
    except Exception: _j = None; ok(False, "the photo copies check ran: " + (_r.stderr or _r.stdout)[-300:])
    if _j:
        _f = _j["files"]; _by = lambda suf: [v for k, v in _f.items() if k.endswith(suf)]
        ok(_j["planned"]["colosseum"] == ["big", "sm", "smwebp", "webp"] and _j["planned"]["pantheon"] == ["bigwebp", "sm", "smwebp", "webp"], "a photo gets only the copies it lacks: " + json.dumps(_j["planned"]))
        ok(all(v[1][0] == 320 for v in _by(".sm.jpg") + _by(".sm.webp")), "a small copy is 320 px wide")
        ok(_j["again_fetches"] == 0, "copies made on an earlier go are not fetched again")
        ok(all(r.get("lq") and r.get("sm", "").startswith("/_blob/") and set(r.get("webp", {})) >= {"sm", "url"} for k, r in _j["record"].items()), "the record carries sm, webp {sm, url} and lq: " + json.dumps(_j["record"]))
        ok(_j["record"]["pantheon"]["big"] == "/_blob/" + "b" * 32 and "big" in _j["record"]["pantheon"]["webp"], "an existing large copy is kept, and only its WebP is added")
        ok(_j["p2"]["lq_bytes"] < 400 and _j["p2"]["smw"] == 320, "the blurred preview stays a few hundred characters")
    for _n in ("nightly", "photos2", "big_photos"):   # the published copy is the same file
        _a, _b = os.path.join(_here, _n + ".py"), os.path.join(_here, "..", "trip", "tools", _n + ".py.txt")
        _c = _b if os.path.exists(_b) else os.path.join(_here, _n + ".py.txt")
        if os.path.exists(_c): ok(open(_a, "rb").read() == open(_c, "rb").read(), _n + ".py and its published .txt copy are the same file")

if fails:
    print("%d of the tools' checks failed:" % len(fails))
    for f in fails: print("  " + f)
    sys.exit(1)
print("tools: all their own checks pass (place matching, opening hours, distances, map tiles, the Google check through a connector, street-map pack parts)")
