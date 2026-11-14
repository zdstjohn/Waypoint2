"""Waypoint nightly refresh: real photos, official sites and street-map packs for the places people's trips use.

  python3 nightly.py prepare <db_dir> <vt_index.json> <work_dir> [max_lookups] [max_packs]
      <db_dir> holds the artifact database as ArtifactData saves it: wanted/*.json, photos/*.json, links/*.json, maps/*.json
      <vt_index.json> is the app's bundled vt/index.json (older packs shipped as files); maps/*.json are the packs in the asset store
      Writes into <work_dir>:
        upload_list.txt     new photo files to upload as artifact assets (one path per line)
        pending.json        {slug: {name_key: {file, credit, page}}}  photos waiting for their asset url
        links/<slug>.json   full links documents that changed (write as links/<slug>)
        vt/<slug>.bin       new street-map packs (split into JSON parts with pack2json.py, upload them as assets, record maps/<slug>)
        summary.json        what was found
  python3 nightly.py finish <db_dir> <work_dir> <uploaded.json>
      <uploaded.json> = {"<local file path>": "<asset url from the upload result>"}
      Writes <work_dir>/photos/<slug>.json: full photos documents to write (as photos/<slug>)

Only real, freely licensed photos (Wikimedia Commons, credited): the place itself, or one taken near it (marked near),
and official sites from Wikidata (resellers rejected). Places tried without a result are not retried for 30 days.
"""
import hashlib, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
RETRY_DAYS = 30


def load_dir(d):
    out = {}
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".json"):
                try:
                    j = json.load(open(os.path.join(d, fn)))
                    out[fn[:-5]] = j.get("data", j) if isinstance(j, dict) else {}
                except Exception as e:
                    print("unreadable", fn, e, file=sys.stderr)
    return out


def today():
    return int(time.time() // 86400)


def fresh_try(tried, k):
    t = (tried or {}).get(k)
    return t is not None and today() - int(t) < RETRY_DAYS


def prepare(db_dir, vt_index_path, work, max_lookups=300, max_packs=3):
    import official_links as ol
    work = os.path.abspath(work)
    wanted = load_dir(os.path.join(db_dir, "wanted"))
    photos = load_dir(os.path.join(db_dir, "photos"))
    links = load_dir(os.path.join(db_dir, "links"))
    os.makedirs(work, exist_ok=True)
    summary = {"photos": {}, "links": {}, "packs": [], "lookups": 0}
    lookups = 0

    # ---- photos: every stop without one gets its own photo or, failing that, one taken nearby (see photos2.py) ----
    import photos2 as p2
    os.environ.setdefault("P2_MINUTES", "150")   # Wikimedia throttles shared connections: stop starting new cities after this
    p2.DEADLINE = time.time() + float(os.environ["P2_MINUTES"]) * 60
    os.makedirs(os.path.join(work, "p2"), exist_ok=True)
    def missing(slug):
        w, have = wanted[slug], set(((photos.get(slug) or {}).get("items") or {}).keys())
        return len({p2.wp.norm(n) for n in (w.get("spots") or []) + (w.get("food") or [])} - have)
    def soon(slug):
        """days until this city's first trip day ("when"); trips under way count as now; none comes last"""
        import datetime
        d = wanted[slug].get("when") if isinstance(wanted[slug].get("when"), str) else ""
        try: days = (datetime.date.fromisoformat(d[:10]) - datetime.date.today()).days
        except Exception: return 10 ** 6
        return max(days, 0) if days >= -30 else 10 ** 6
    # the soonest trip's cities first (their lists start with the stops on its days), then those missing the most
    for slug in sorted(wanted, key=lambda s: (soon(s), -missing(s))):
        w = wanted[slug]
        if time.time() > p2.DEADLINE:
            print("photo time budget used: the rest wait for tomorrow", file=sys.stderr); break
        cur = photos.get(slug) or {}
        tried, tried2 = cur.get("tried") or {}, cur.get("tried2") or {}
        # tried = asked Wikidata (the first passes); tried2 = this finder found nothing, not even a photo nearby
        have = set((cur.get("items") or {}).keys()) | {k for k in tried2 if fresh_try(tried2, k)}
        path = os.path.join(work, "p2", slug + ".json")
        try:
            p2.run_city(slug, w, have, path, wd_tried=tried.keys(), have_pages={(v or {}).get("page") for v in (cur.get("items") or {}).values()}, no=cur.get("no") or ())
            p2.download(slug, path, os.path.join(work, "img"))
        except Exception as e:
            print("skip photos for", slug, e, file=sys.stderr)
    p2.pending(db_dir, work, set())
    pending = json.load(open(os.path.join(work, "pending.json")))
    uploads = [x for x in open(os.path.join(work, "upload_list.txt")).read().split("\n") if x]
    for slug, p in pending.items():
        if p.get("items"):
            summary["photos"][slug] = len(p["items"])

    # ---- official sites (for paid sights) ----
    for slug, w in wanted.items():
        cur = links.get(slug) or {"items": {}, "city": w.get("city"), "country": w.get("country")}
        items, tried = dict(cur.get("items") or {}), dict(cur.get("tried") or {})
        names = [x.get("n") for x in (w.get("paid") or []) if x.get("n")] or (w.get("spots") or [])
        centre = tuple(w.get("home") or w.get("center") or ()) or None
        new = 0
        for n in names:
            k = ol.norm(n)
            if not k or k in items or fresh_try(tried, k) or len(ol.toks(n, w.get("city", ""))) < 1:
                continue
            if lookups >= max_lookups:
                break
            lookups += 1
            try:
                r = ol.lookup(n, w.get("city", ""), centre)
            except Exception as e:
                print("skip link", n, e, file=sys.stderr); continue
            if r:
                items[k] = r; new += 1
            else:
                tried[k] = today()
        if new or tried != (cur.get("tried") or {}):
            os.makedirs(os.path.join(work, "links"), exist_ok=True)
            json.dump({"items": items, "tried": tried, "city": w.get("city"), "country": w.get("country")},
                      open(os.path.join(work, "links", slug + ".json"), "w"), indent=1, ensure_ascii=False)
        if new:
            summary["links"][slug] = new

    # ---- street-map packs for cities that don't have one yet ----
    index = json.load(open(vt_index_path)) if vt_index_path and os.path.exists(vt_index_path) else {}
    maps_dir = os.path.join(db_dir, "maps")
    if os.path.isdir(maps_dir):
        for fn in os.listdir(maps_dir):
            if fn.endswith(".json"): index.setdefault(fn[:-5], {})
    missing = [s for s, w in wanted.items() if s not in index and (w.get("pts") or w.get("center"))]
    # packs built when a pack's frame followed every place (day trips too): one framed wider than about 25 km is
    # rebuilt around its town, after the cities that have no pack yet. The new record replaces the old one; the old
    # parts stay in the asset store until the owner clears unused files (Settings > Storage, which keeps every file a
    # document in its STORE_COLS collections names: a new collection that points at files must be added there).
    wide = []
    older = []   # packs laid out the old way (no "lay": 2 in their record): the town centre arrives with the rest
    if os.path.isdir(maps_dir):
        for fn in sorted(os.listdir(maps_dir)):
            if not fn.endswith(".json"): continue
            try:
                m = json.load(open(os.path.join(maps_dir, fn))); m = m.get("data", m); pl = m.get("places") or []
                sl = fn[:-5]
                if len(pl) == 4 and (pl[2] - pl[0] > 0.3 or pl[3] - pl[1] > 0.25) and sl in wanted and (wanted[sl].get("pts") or wanted[sl].get("center")): wide.append(sl)
                elif m.get("lay") != 2 and sl in wanted and (wanted[sl].get("pts") or wanted[sl].get("center")): older.append(sl)
            except Exception: pass
    missing += [s for s in wide if s not in missing]
    # then the older-layout ones, a few a night (RELAY_MAX, 2 by default; they count in max_packs too): rebuilt, they come out
    # town centre first, so their map draws after a small first download instead of the whole pack
    soon_first = sorted(older, key=lambda s: (soon(s), s))
    missing += [s for s in soon_first[:int(os.environ.get("RELAY_MAX", "2"))] if s not in missing]
    # then the cities people saved for offline in Settings (the app writes mapwant/<slug> = {country, city, center, at}
    # when a saved library city has no pack): after every trip city, oldest request first; a centre is all they need
    wish = load_dir(os.path.join(db_dir, "mapwant")); fromwish = set()
    def _centre(c):
        ok = isinstance(c, list) and len(c) == 2 and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in c)
        return ok and abs(c[0]) <= 90 and abs(c[1]) <= 180
    def _at(s):
        a = wish[s].get("at")
        return a if isinstance(a, (int, float)) and not isinstance(a, bool) else 10 ** 18
    for s in sorted(wish, key=lambda s: (_at(s), s)):
        w = wish[s]
        if s in index or s in wanted or s in missing or not _centre(w.get("center")): continue
        wanted[s] = {"city": str(w.get("city") or ""), "country": str(w.get("country") or ""), "center": list(w["center"]), "pts": []}
        missing.append(s)
        fromwish.add(s)
    summary["rebuilt"] = [s for s in missing[:max_packs] if s in wide or s in older]
    # only the cities of trips get a pack (v195, the owner): packs for the app's built-in cities that no trip used filled
    # the file store, so none are built ahead any more; a city gets its pack the night after a trip first needs it
    if missing and max_packs > 0:
        import build as vb
        from mvt import get
        vt_dir = os.path.join(work, "vt"); os.makedirs(vt_dir, exist_ok=True)
        tpl = json.loads(get("https://tiles.openfreemap.org/planet"))["tiles"][0]
        for slug in missing[:max_packs]:
            try:
                h = vb.build(slug, wanted[slug], vt_dir, tpl)
                index[slug] = {"b": h["b"], "places": h["places"], "city": h["city"], "country": h["country"]}
                summary["packs"].append(slug)
                if slug in fromwish: summary.setdefault("mapwant", []).append(slug)
            except Exception as e:
                print("skip pack", slug, e, file=sys.stderr)
        if summary["packs"]:
            json.dump(index, open(os.path.join(vt_dir, "index.json"), "w"), separators=(",", ":"))   # for the record; the app reads maps/<slug>

    summary["lookups"] = lookups
    json.dump(summary, open(os.path.join(work, "summary.json"), "w"), indent=1)
    print(json.dumps(summary))


def finish(db_dir, work, uploaded_path):
    photos = load_dir(os.path.join(db_dir, "photos")); wanted_all = load_dir(os.path.join(db_dir, "wanted"))
    pending = json.load(open(os.path.join(work, "pending.json")))
    uploaded = json.load(open(uploaded_path)) if os.path.exists(uploaded_path) else {}
    by_abs = {os.path.abspath(k): v for k, v in uploaded.items()}
    out_dir = os.path.join(work, "photos"); os.makedirs(out_dir, exist_ok=True)
    wrote = {}
    for slug, p in pending.items():
        cur = photos.get(slug) or {}
        items = dict(cur.get("items") or {})
        n = 0
        for k, r in (p.get("items") or {}).items():
            url = by_abs.get(os.path.abspath(r["file"]))
            if url:   # only photos that really reached the page's storage
                items[k] = {"url": url, "credit": r.get("credit", ""), "page": r.get("page", ""), "at": time.strftime("%Y-%m-%d")}; n += 1   # "at": when it was added, so the photo look checks only new ones
                if r.get("near"):
                    items[k]["near"] = True
                # the small copy, the WebP twins and the blurred preview (each only when its file really reached the storage)
                ex = {a: by_abs.get(os.path.abspath(f)) for a, f in (r.get("extra") or {}).items()}
                if ex.get("sm"):
                    items[k]["sm"] = ex["sm"]
                    if r.get("smw") and r["smw"] != 320: items[k]["smw"] = r["smw"]   # (the app assumes 320 and 720 wide)
                wb = {t: ex[a] for a, t in (("smwebp", "sm"), ("webp", "url")) if ex.get(a)}
                if wb: items[k]["webp"] = wb
                if r.get("lq"): items[k]["lq"] = r["lq"]
                if r.get("w") and r["w"] != 720: items[k]["w"] = r["w"]
        doc = {"items": items, "tried": p.get("tried") or cur.get("tried") or {}, "tried2": p.get("tried2") or cur.get("tried2") or {}}
        if cur.get("turned_down"): doc["turned_down"] = cur["turned_down"]   # photos the look rejected (kept for the record)
        wnt = wanted_all.get(slug) or {}
        for f in ("city", "country"):   # the city's name stays on the document (the app also finds photos by city name)
            if cur.get(f) or wnt.get(f): doc[f] = cur.get(f) or wnt.get(f)
        no = sorted(set(cur.get("no") or []) | set(p.get("no") or []))
        if no:
            doc["no"] = no   # photos turned down for this city, never picked again
        if n or doc["tried"] != (cur.get("tried") or {}) or doc["tried2"] != (cur.get("tried2") or {}) or no != sorted(cur.get("no") or []):
            json.dump(doc, open(os.path.join(out_dir, slug + ".json"), "w"), indent=1, ensure_ascii=False)
            wrote[slug] = n
    print(json.dumps({"photo_docs": wrote}))


if __name__ == "__main__":
    if len(sys.argv) >= 5 and sys.argv[1] == "prepare":
        prepare(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]) if len(sys.argv) > 5 else 500, int(sys.argv[6]) if len(sys.argv) > 6 else 3)
    elif len(sys.argv) == 5 and sys.argv[1] == "finish":
        finish(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print(__doc__); sys.exit(2)
