#!/usr/bin/env python3
"""Copy the working tree into the git repository (repo/): sources, tests, tools, types, the bundler, the test server
and the package files. Left out: installed packages, screenshots, the generated src/ copy and the big map packs
(only the index and the three Italy sketch maps go in). Files no longer in the working tree are removed from repo/."""
import os, shutil, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); REPO = os.path.join(ROOT, "repo")
ITEMS = ["trip", "test", "tools", "types", "judge", "csp_server.py", "vercel.json", "tsconfig.json", "tsconfig.strict.json", "package.json", "package-lock.json", ".gitignore", ".prettierrc.json", ".github", "supabase"]
SKIP_DIRS = {"node_modules", "__pycache__", "out", "base", "diffout", "after", "styles-after", "styles-base", "src", "trial"}
BUILT = {os.path.join("trip", "app.js"), os.path.join("trip", "app.min.css"), os.path.join("trip", "app.js.map"), os.path.join("trip", "app2.js"), os.path.join("trip", "app2.js.map"), os.path.join("trip", "app2.css"), os.path.join("trip", "app.desk.css")} | {os.path.join("trip", "app.%s.js%s" % (n, m)) for n in ("ask", "desk") for m in ("", ".map")}   # npm run build makes these
def keep(rel):
    parts = rel.split(os.sep)
    if any(p in SKIP_DIRS for p in parts[:-1]) or rel in BUILT: return False
    if rel == os.path.join("test", "screens-expected.txt"): return True   # the screens a commit means to change (CI reads it)
    if parts[-1].endswith((".pyc", ".txt", ".png", ".before-judge.py")) and parts[0] in ("tools", "test"): return False
    if parts[0] == "test" and len(parts) == 2 and parts[1].endswith(".css"): return False
    if parts[0] == "judge" and parts[-1] in ("fetch.log", "fetchcats.py"): return False
    if parts[:2] == ["trip", "maps"] and len(parts) == 3:
        return parts[2] == "index.json" or parts[2].startswith("italy-")
    return True
wanted = set()
for item in ITEMS:
    src = os.path.join(ROOT, item)
    if os.path.isfile(src): wanted.add(item); continue
    for d, dirs, files in os.walk(src):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            rel = os.path.relpath(os.path.join(d, f), ROOT)
            if keep(rel): wanted.add(rel)
wanted.add(os.path.join("build", "bundle.js")); wanted.add(os.path.join("build", "standalone.js")); wanted.add(os.path.join("build", "icon", "make-icons.js"))
for f in sorted(os.listdir(os.path.join(ROOT, "build", "icon", "out"))): wanted.add(os.path.join("build", "icon", "out", f))
for rel in sorted(wanted):
    dst = os.path.join(REPO, rel); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(os.path.join(ROOT, rel), dst)
# remove what the working tree no longer has (tracked or not), never the .git folder
for d, dirs, files in os.walk(REPO):
    dirs[:] = [x for x in dirs if x != ".git" and x != "node_modules"]
    for f in files:
        rel = os.path.relpath(os.path.join(d, f), REPO)
        if rel not in wanted: os.remove(os.path.join(d, f)); print("removed", rel)
print(len(wanted), "files")
sys.stdout.flush(); subprocess.run(["git", "status", "--short"], cwd=REPO)
