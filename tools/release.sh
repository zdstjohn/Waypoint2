#!/bin/sh
# The mechanical steps of a release, up to the commit:   sh tools/release.sh <N>
#   sets the package version to 0.<N>.0, builds the app and the installable version, packs the readable sources,
#   brings the repository copy (repo/) up to date and checks that no Google API key is in it.
# After it: commit in repo/ (message "v<N>: ..."), push main and release/v<N>, publish the artifact, check Vercel.
set -e
cd "$(dirname "$0")/.."
N="$1"; [ -n "$N" ] || { echo "usage: sh tools/release.sh <version number>"; exit 1; }
python3 - "$N" <<'PY'
import json, re, sys
p = "package.json"; s = open(p, encoding="utf8").read()
s2 = re.sub(r'"version": "[^"]*"', '"version": "0.%s.0"' % sys.argv[1], s, count=1)
open(p, "w", encoding="utf8").write(s2); print("package.json version 0.%s.0" % sys.argv[1])
PY
node build/bundle.js | tail -1
node build/standalone.js | tail -1
python3 tools/src_pack.py
rm -f repo/node_modules
rm -rf repo/trip/src repo/trip/app.js repo/trip/app2.js repo/trip/app.min.css repo/trip/app2.css repo/trip/app.js.map repo/trip/app2.js.map
python3 tools/repo_sync.py | tail -40
if grep -rlE "AIza[0-9A-Za-z_-]{30,}" repo --exclude-dir=.git; then echo "A Google API key is in the repository copy: stop."; exit 1; fi
echo "ready to commit: v$N"
