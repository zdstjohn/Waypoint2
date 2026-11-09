"""Compare two computed-style dumps: python3 test/lib/stylediff.py before after [show]. Elements are matched by their path
(tag, id and classes up the tree, nth occurrence), so an extra element in one dump does not throw the rest off."""
import sys, os, json, collections, re
NUM = re.compile(r"-?\d+(?:\.\d+)?")
def same(a, b):
    """equal, allowing text widths to wobble by under a pixel between runs"""
    if a == b: return True
    na, nb = NUM.findall(a), NUM.findall(b)
    if len(na) != len(nb) or NUM.sub("#", a) != NUM.sub("#", b): return False
    return all(abs(float(x) - float(y)) < 0.75 for x, y in zip(na, nb))
a, b = sys.argv[1], sys.argv[2]; show = len(sys.argv) > 3
tot = 0; only = 0
def keyed(rows):
    seen = collections.Counter(); out = {}
    for sel, v in rows:
        seen[sel] += 1; out[(sel, seen[sel])] = v
    return out
for n in sorted(os.listdir(a)):
    if not os.path.exists(os.path.join(b, n)): print("missing", n); continue
    A, B = keyed(json.load(open(os.path.join(a, n)))), keyed(json.load(open(os.path.join(b, n))))
    diff = [(k, A[k], B[k]) for k in A if k in B and not same(A[k], B[k])]
    extra = len(set(A) ^ set(B)); only += extra
    if diff or extra:
        print("%-24s %d elements differ, %d only on one side" % (n, len(diff), extra)); tot += len(diff)
        if show:
            for (sel, i), va, vb in diff[:8]: print("    %s\n      %s\n      %s" % (sel[-120:], va[:170], vb[:170]))
print("TOTAL differing elements %d, one-sided %d" % (tot, only))
