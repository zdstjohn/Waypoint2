"""Compare two screenshot folders: python3 test/lib/diff.py before after [out]. Prints each file whose pixels differ and writes a
side-by-side (before | after | difference) image for it."""
import sys, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]; out = sys.argv[3] if len(sys.argv) > 3 else None
if out: os.makedirs(out, exist_ok=True)
same = diff = missing = 0
for n in sorted(os.listdir(a)):
    if not n.endswith(".png"): continue
    if not os.path.exists(os.path.join(b, n)): missing += 1; print("missing after:", n); continue
    A, B = Image.open(os.path.join(a, n)).convert("RGB"), Image.open(os.path.join(b, n)).convert("RGB")
    if A.size != B.size: diff += 1; print("size differs:", n, A.size, B.size); continue
    d = ImageChops.difference(A, B); bbox = d.getbbox()
    if not bbox: same += 1; continue
    px = sum(1 for p in d.convert("L").getdata() if p > 24)
    diff += 1; print("differs: %-28s %6d px  box %s" % (n, px, bbox))
    if out:
        s = Image.new("RGB", (A.width * 3, A.height), "white"); s.paste(A, (0, 0)); s.paste(B, (A.width, 0))
        s.paste(Image.eval(d, lambda v: 255 if v > 24 else 0), (A.width * 2, 0)); s.save(os.path.join(out, n))
print("same %d, different %d, missing %d" % (same, diff, missing))
