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

if fails:
    print("%d of the tools' checks failed:" % len(fails))
    for f in fails: print("  " + f)
    sys.exit(1)
print("tools: all their own checks pass (place matching, opening hours, distances, map tiles)")
