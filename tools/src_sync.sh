#!/bin/sh
# Refresh trip/src (the readable sources published with the app) from the working tree: one packed file.
set -e
cd "$(dirname "$0")/.."
python3 tools/src_pack.py
