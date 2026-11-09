"""How the judge does against photos judged by eye: python3 judge/validate.py [show]"""
import json, os, sys
sys.path.insert(0, "tools"); import photo_judge as J
rows = json.load(open("judge/labeled.json")); cats = json.load(open("judge/cats.json")) if os.path.exists("judge/cats.json") else {}
tp = fp = tn = fn = 0; wrong = []
from collections import Counter
freq = {}
for r in rows:
    for w in set(J.words(r["name"])): freq.setdefault(r["slug"], Counter())[w] += 1
for r in rows:
    common = {w for w, n in freq[r["slug"]].items() if n >= 3}
    pl = J.place_profile(r["name"], r["food"], r["city"], r["country"], common)
    c = cats.get(r["title"], {}); ph = J.photo_profile(r["title"], c.get("cats"), c.get("desc", ""))
    own = not r["near"]
    hit = J.name_words_in(pl, r["title"], c.get("cats") or [], c.get("desc", "") if own else "")
    trusted = r.get("why", "").startswith("wikidata") or r.get("why", "") == ""
    thit = J.name_words_in(pl, r["title"], c.get("cats") or [], only_title=True, city=r["city"])
    loc = trusted or J.located_in(r["city"], r["country"], r["title"], c.get("cats") or [], c.get("desc", ""), 0.3 if r["near"] else None)
    ok, score, why = J.judge(pl, ph, own, dist_km=0.3 if r["near"] else None, name_hit=hit, located=loc, trusted_name=trusted, title_hit=thit)
    keep = r["label"] == "keep"
    if keep and r["food"] and r["near"]: continue   # stand-ins for places to eat are out by policy now
    if ok and keep: tp += 1
    elif ok and not keep: fp += 1; wrong.append(("LET THROUGH", r, why, ph))
    elif not ok and keep: fn += 1; wrong.append(("LOST", r, why, ph))
    else: tn += 1
print("rejects caught %d/%d (%.0f%%), keeps kept %d/%d (%.0f%%), categories known for %d" % (tn, tn + fp, 100 * tn / max(1, tn + fp), tp, tp + fn, 100 * tp / max(1, tp + fn), sum(1 for r in rows if r["title"] in cats)))
if len(sys.argv) > 1:
    for kind, r, why, ph in wrong:
        if sys.argv[1] in kind:
            print(kind, "|", r["slug"].split("-", 1)[1][:9], "|", ("~" if r["near"] else "") + r["name"][:36], "|", r["title"][:55], "|", why, "|", ",".join(sorted(ph["subjects"])))
