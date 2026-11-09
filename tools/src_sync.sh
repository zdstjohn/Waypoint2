#!/bin/sh
# Refresh trip/src (the readable sources published with the app, .txt-suffixed) from the working tree.
set -e
cd "$(dirname "$0")/.."
rm -rf trip/src; mkdir -p trip/src/lib trip/src/screens trip/src/test/lib trip/src/test/mocks trip/src/test/suites trip/src/ci
for f in trip/lib/*.js trip/screens/*.js; do cp "$f" "trip/src/${f#trip/}.txt"; done
for f in test/run.js test/shots.js test/styles.js test/lib/*.js test/mocks/*.js test/suites/*.js; do cp "$f" "trip/src/$f.txt"; done
cp types/waypoint.d.ts trip/src/waypoint.d.ts.txt; cp tsconfig.json tsconfig.strict.json trip/src/; cp build/bundle.js trip/src/bundle.js.txt
cp package.json trip/src/package.json; cp .github/workflows/ci.yml trip/src/ci/ci.yml.txt; cp .github/workflows/release.yml trip/src/ci/release.yml.txt
find trip/src -type f | wc -l
