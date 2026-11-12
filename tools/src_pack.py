#!/usr/bin/env python3
"""Pack the readable sources into one file, trip/src/waypoint-source.txt, published with the app so the code is never
only in one place (the artifact holds a limited number of files; one file per source used up a fifth of them).
    python3 tools/src_pack.py            write trip/src/waypoint-source.txt
    python3 tools/src_pack.py --unpack waypoint-source.txt [folder]    write the files back out
Each file starts at a line "=====8<===== <path>" and runs to the next such line."""
import glob, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = "=====8<===== "
SETS = ["trip/index.html", "trip/app.css", "trip/desk.css", "trip/data/*.js", "trip/lib/*.js", "trip/screens/*.js", "types/waypoint.d.ts", "tsconfig.json", "tsconfig.strict.json",
        "package.json", "build/bundle.js", "build/standalone.js", "csp_server.py", "test/run.js", "test/shots.js", "test/styles.js", "test/lib/*.js", "test/lib/*.py",
        "test/mocks/*.js", "test/suites/*.js", "test/screens-expected.txt", ".github/workflows/*.yml", "tools/src_pack.py"]

def pack():
    files = []
    for pat in SETS:
        got = sorted(glob.glob(os.path.join(ROOT, pat)))
        if not got: sys.exit("nothing matches " + pat)
        files += got
    out = ["WAYPOINT: THE SOURCE", "",
           "Every source file behind the app, its tests and its build, in one file. Each file starts at a line",
           '"' + MARK + '<path>" and runs to the next such line. To write them back out as files:',
           "    python3 src_pack.py --unpack waypoint-source.txt   (src_pack.py is the last file in here, under tools/)",
           "Then: npm install, node build/bundle.js, node test/run.js. The same files are in the GitHub repository.", "",
           str(len(files)) + " files:"] + ["  " + os.path.relpath(f, ROOT) for f in files] + [""]
    for f in files:
        text = open(f, encoding="utf8").read()
        if any(l.startswith(MARK) for l in text.split("\n")) and not f.endswith("src_pack.py"): sys.exit(f + " has a line that starts like a file mark")
        out.append(MARK + os.path.relpath(f, ROOT)); out.append(text if text.endswith("\n") else text + "\n")
    dst = os.path.join(ROOT, "trip", "src")
    if os.path.isdir(dst):
        for d, _, fs in os.walk(dst, topdown=False):
            for x in fs: os.remove(os.path.join(d, x))
            if d != dst: os.rmdir(d)
    os.makedirs(dst, exist_ok=True)
    body = "\n".join(out)
    open(os.path.join(dst, "waypoint-source.txt"), "w", encoding="utf8").write(body)
    print("trip/src/waypoint-source.txt: %d files, %d KB" % (len(files), len(body.encode("utf8")) // 1024))

def unpack(src, folder):
    cur, buf, n = None, [], 0
    def close():
        nonlocal n
        if cur is None: return
        p = os.path.join(folder, cur); os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
        open(p, "w", encoding="utf8").write("\n".join(buf)); n += 1
    for line in open(src, encoding="utf8").read().split("\n"):
        # the packer itself names the mark in its own text: only a path that looks like one starts a file
        rest = line[len(MARK):].strip() if line.startswith(MARK) else ""
        if rest and "<" not in rest and " " not in rest:
            close(); cur, buf = line[len(MARK):].strip(), []
        elif cur is not None: buf.append(line)
    close(); print(n, "files written to", folder)

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--unpack": unpack(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ".")
    else: pack()
