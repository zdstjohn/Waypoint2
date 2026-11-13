"""Checks the nightly photo scripts' new copies (small, WebP, blurred preview) with no network: Wikimedia is replaced by
pictures drawn here (smooth gradients, edges and noise, like a photograph). Prints one JSON line; test/suites/photoset.js reads it."""
import io, json, os, sys, tempfile, random
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fakephoto import fake_photo
TOOLS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools")
sys.path.insert(0, TOOLS)
import big_photos as bp


def jpeg(im, q=85):
    b = io.BytesIO(); im.save(b, "JPEG", quality=q); return b.getvalue()


def main():
    work = tempfile.mkdtemp(dir=os.environ.get('WP_TMP')); db = os.path.join(work, "db"); out = os.path.join(work, "out")
    os.makedirs(db + "/wanted"); os.makedirs(db + "/photos"); os.makedirs(out)
    pics = {"Colosseum.jpg": fake_photo(1, 1920, 1280), "Pantheon.jpg": fake_photo(2, 1500, 1000), "Tall_tower.jpg": fake_photo(3, 1000, 1500)}
    calls = []
    def fake_fetch(url):
        calls.append(url)
        import urllib.parse
        name = urllib.parse.unquote(url.rsplit("/", 1)[1]); name = name.split("px-", 1)[1] if "px-" in name else name
        im = pics.get(name)
        if im is None: return None
        m = 1920 if "/1920px-" in url else 720 if "/720px-" in url else max(im.size)
        c = im.copy(); c.thumbnail((m, m)); return jpeg(c)
    bp.fetch = fake_fetch
    bp.time.sleep = lambda s: None
    items = {k: {"url": "/_blob/" + "a" * 31 + str(i), "credit": "x", "page": "https://commons.wikimedia.org/wiki/File:" + f} for i, (k, f) in enumerate([("colosseum", "Colosseum.jpg"), ("pantheon", "Pantheon.jpg"), ("tall tower", "Tall_tower.jpg")])}
    items["pantheon"]["big"] = "/_blob/" + "b" * 32        # has a large copy already: only its WebP is missing
    items["tall tower"].update({"sm": "/_blob/" + "c" * 32, "webp": {"sm": "/_blob/" + "d" * 32, "url": "/_blob/" + "e" * 32}, "lq": "data:image/webp;base64,AAAA"})   # complete
    json.dump({"items": items, "city": "Rome", "country": "Italy"}, open(db + "/photos/italy-rome.json", "w"))
    json.dump({"city": "Rome", "country": "Italy", "spots": [], "food": [], "used": [["Colosseum"], ["Pantheon"], ["Tall tower"]], "when": "2099-01-01"}, open(db + "/wanted/italy-rome.json", "w"))
    sys.stdout = io.StringIO(); bp.prepare(db, out, 40, 80); summary = json.loads(sys.stdout.getvalue()); sys.stdout = sys.__stdout__
    plan = json.load(open(out + "/big_plan.json"))
    listed = open(out + "/big_list.txt").read().split()
    up = {f: "/_blob/%032x" % i for i, f in enumerate(listed)}
    json.dump(up, open(out + "/up.json", "w"))
    sys.stdout = io.StringIO(); bp.finish(db, out, out + "/up.json"); sys.stdout = sys.__stdout__
    doc = json.load(open(out + "/photos_big/italy-rome.json"))["items"]
    res = {"summary": summary, "planned": {p["key"]: p["need"] for p in plan}, "fetches": len(calls), "record": {k: {f: (v if f not in ("lq",) else len(v)) for f, v in r.items() if f in ("sm", "smw", "w", "webp", "big", "lq")} for k, r in doc.items()}}
    # sizes and widths of the written files
    res["files"] = {os.path.basename(f): [os.path.getsize(f), Image.open(f).size] for f in listed}
    # run again: nothing is made twice
    calls.clear(); sys.stdout = io.StringIO(); bp.prepare(db, out, 40, 80); again = json.loads(sys.stdout.getvalue()); sys.stdout = sys.__stdout__
    res["again_fetches"] = len(calls)
    # the nightly scripts' variants() on a photo
    import photos2 as p2
    im = pics["Colosseum.jpg"].copy(); im.thumbnail((720, 720)); base = os.path.join(out, "x")
    c = p2.copies(im, base)
    res["p2"] = {"w": c["w"], "smw": c["smw"], "lq_prefix": c["lq"][:4], "lq_bytes": len(c["lq"]), "files": {a: os.path.getsize(b) for a, b in c["files"].items()}}
    print(json.dumps(res))


main()
