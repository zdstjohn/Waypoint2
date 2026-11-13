"""Makes the picture files for the photo-copy tests: python3 -I make_fixtures.py <out dir> <count> [<dir of real JPEGs>]
Each picture gets the copies the nightly tools make (photos2.copies, big_photos for the large one); a manifest.json lists them.
Without a folder of real photos, photograph-like pictures are drawn (gradients, edges, noise)."""
import glob, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from fakephoto import fake_photo
import photos2 as p2
import big_photos as bp


out, n = sys.argv[1], int(sys.argv[2]); src = sorted(glob.glob(os.path.join(sys.argv[3], "*.jpg"))) if len(sys.argv) > 3 else []
os.makedirs(out, exist_ok=True); man = []
for i in range(n):
    im = Image.open(src[i % len(src)]).convert("RGB") if src else fake_photo(i + 1)
    big = im.copy(); big.thumbnail((1920, 1920))
    norm = big.copy(); norm.thumbnail((720, 720), Image.LANCZOS)
    base = os.path.join(out, "p%02d" % i)
    norm.save(base + ".jpg", "JPEG", quality=p2.JPEG_Q["url"], optimize=True, progressive=True)
    c = p2.copies(norm, base)
    e = {"jpg": base + ".jpg", "lq": c["lq"], "w": c["w"], "smw": c["smw"], **c["files"]}
    if i % 4 == 0:   # some have a large copy and its WebP twin
        open(base + ".big.jpg", "wb").write(p2.jpeg_bytes(big, "big")); open(base + ".big.webp", "wb").write(p2.webp_bytes(big, "big"))
        e["big"], e["bigwebp"] = base + ".big.jpg", base + ".big.webp"
    man.append(e)
json.dump(man, open(os.path.join(out, "manifest.json"), "w"))
