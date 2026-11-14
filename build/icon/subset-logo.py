#!/usr/bin/env python3
"""trip/fonts/dela-gothic-one-wordmark.woff2: Dela Gothic One cut down to the eight letters of the WAYPOINT wordmark
(trip/index.html draws it as text in a clip path; nothing else uses the face), hinting kept so the letters are drawn exactly as
by the whole font (checked pixel for pixel at 390 px, light and dark, at 1x and 2x). Run again when the wordmark changes:
    python3 build/icon/subset-logo.py [letters]
Needs fonttools and brotli (pip install fonttools brotli). """
import os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'fonts', 'dela-gothic-one-latin-400-normal.woff2')
dst = os.path.join(here, '..', '..', 'trip', 'fonts', 'dela-gothic-one-wordmark.woff2')
text = sys.argv[1] if len(sys.argv) > 1 else 'WAYPOINT'
o = subset.Options(); o.flavor = 'woff2'; o.layout_features = []; o.hinting = True; o.notdef_outline = False; o.name_IDs = []; o.glyph_names = False
f = TTFont(src); s = subset.Subsetter(o); s.populate(text=text); s.subset(f); f.flavor = 'woff2'; f.save(dst)
print(os.path.getsize(dst), 'bytes')   # (keep the @font-face's unicode-range at U+0020-007E: a range cut down to these letters changes how they are drawn)
