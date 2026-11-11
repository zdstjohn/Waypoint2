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
    ok(len(lines) == 4 and lines[0] == "1 | Frigidarium, Rome | 41.89800,12.47000" and lines[1].startswith("2 | Old Pin, Rome | "), "the list starts with the Google pins due for renewal: " + repr(lines))
    ok([e["kind"] for e in todo] == ["renew", "renew", "find", "find"] and {e.get("name") for e in todo[2:]} == {"Gelateria La Romana", "Bar Senza Nome"}, "then the places with no Google ID yet; one that has an ID is not asked again")
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

if fails:
    print("%d of the tools' checks failed:" % len(fails))
    for f in fails: print("  " + f)
    sys.exit(1)
print("tools: all their own checks pass (place matching, opening hours, distances, map tiles, the Google check through a connector)")
