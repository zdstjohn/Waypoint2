# Waypoint — how the code is laid out

One page. `index.html` is the markup; the code is plain files under data/, lib/ and screens/, joined and minified into
`app.js` (and app.css into `app.min.css`) by `build/bundle.js`, so the page makes one script request. All code shares one
namespace, `window.W`; the order in `build/bundle.js` is the dependency order. `node test/run.js` builds first.

```
index.html        markup (header, tabs, one <main> per view); loads app.js and app.min.css (built)
app.css           the stylesheet, grouped by screen: fonts, foundations, header, Setup, My trip, a stop, storybook,
                  Explore, Bookings, Today, journal, settings, motion
fonts/            Nunito, Dela Gothic One and Patrick Hand SC as woff2, served by the app itself (Latin; extended Latin
                  letters in separate files the browser fetches only when a label needs them)
data/             built-in destinations (data1: Europe, data2: the rest, plus airports)
lib/              the shared library
  core.js         state, caches, helpers, Claude-powered data loading
  classify.js     what a place is (kind, how long, how tiring, indoors, which parts of the day) — read by the planner,
                  the clock and the pictures
  validate.js     the one door for everything Claude sends back (W.V): names, pins near the city they were asked for
                  (a pin on another continent or at 0,0 is cleared, the place kept), tags, ratings, kid scores, times of
                  day, meals, hours, beach facts, money, time zones; links through the own-site rule. Loaded first.
  photos.js       real photos (from the nightly finder) and the credit line; a place with no photo shows no picture
  places.js       checked place records (places/<city> in the database): fixed pins, official sites, hours, places
                  that have closed or never existed, and what to go to instead — laid over a city's list as it is read.
                  Pins: a place found on OpenStreetMap gets its real pin; a guessed pin that falls in the sea, a lake or a
                  river (tools/pin_check.py tests it against the map's own water) moves to the nearest shore when it is
                  close ("approx") or loses its pin when it is far out ("nopin": no pin beats a wrong one); a city centre
                  in the water gets one on land ("center"), which is where you stay until you pick a place
  times.js        the clock for each day: starts, ends, the nap, travel days; how tiring a day is
  shape.js        the trip as a whole: nights per base, day trips instead of hotel moves, the way between bases,
                  what the group (toddlers, grandparents) can take
  plan.js         which cities, how many days each, what to do each day (the chooser and its shape rules). Above the
                  interests sits the trip's feel (S.focus, Plan step 1): Must-sees (the default: the famous places first),
                  Hidden gems (where locals go) or Best of both (famous and hidden in turn). Every idea is rated when it is
                  asked for (fame 2/1/0, a review score; older lists are rated once by W.loadFame), only well-reviewed
                  places are asked for, poorly reviewed ones fall away, and stop cards say Must-see or Hidden gem; rescuing
                  the rest of a day that has gone wrong (rain, tired, behind, closed). The plan is kept until the trip,
                  the cached data or the day changes, so most taps re-render without re-planning
  route.js        trip shape check (and its one-tap fixes)   import.js  paste an itinerary   prices.js  live prices and booking sites
  watch.js        price watches   sync.js  saved and shared trips   fx.js  motion   map.js / vtmap.js  the maps
  offline.js      the trip without a signal: the photo index and photos kept on the phone (IndexedDB), map packs
                  warmed into the worker's cache, the offline note in Travel mode, and the "offline copy" (one HTML
                  file with the app, the trip, its photos and sketch maps inside, opened from the phone's files)
  packing.js      the packing list and the before-you-go list, read off the plan (who is going, how you travel, what
                  the days hold, the season, the plugs); ticks, removals and your own items stay with the trip
  warm.js         the warm touches: the family by name (typed in Plan; "Great for Mila & Leo", "Easy for Joe", a kid's
                  pick), the banner's greeting and the sky where you're going,
                  milestones that cheer once (with confetti, never under reduced motion), friendlier ticks, how ready
                  you are on Prepare, a day's mood in the journal, the recap's highlight reel and "one year ago today"
  autopilot.js    the book-by list kept for the morning helper (reads your inbox, writes calendar reminders, never books),
                  what it found, and the deadline timeline on Bookings
  The header is one banner: the wordmark, and the trip (its name opens your trips; under it a countdown that
  becomes "Day 4 of 20" on the trip), drawn by sync.js (W.countdown); on wide screens the tabs sit in it too.
screens/          one file per screen. The tabs are Plan (setup.js), Trip (trip.js, also the app controller: a labelled
                  switch for Day · Map · All days. All days groups the days by place under a stay bar that sticks to
                  the top and lights the place you've scrolled to; the storybook opens from the trip menu and All days), Prepare (book.js: To book · Booked · Budget ·
                  Pack · Take along) and Today (travel.js: Travel mode, also the storybook). flow.js has the next-step
                  bar, undo, the stop sheet and the quick start (shown on the very first open); journal, family;
                  settings.js is now only "Import a plan" (sharing lives in the trip menu); kids.js is "For the kids"
                  (from the trip menu and Today): today's outings in big photo cards with a heart per kid, a passport
                  that stamps each place, and a treasure hunt per town
maps/ vt/         street-map data: sketch maps as JSON; the detailed packs live in the asset store (maps/<city> in the
                  database lists them), built nightly by tools/build.py and pack2json.py. vt/ keeps the engine, the
                  pack worker (packworker.js: downloads and decodes packs off the main thread, caches them in IndexedDB)
                  and the glyphs (glyphs.wasm: everyday letters; glyphs-ext.wasm: extended Latin, Greek, Cyrillic, on
                  demand; split by tools/glyphsplit.py)
```

Tests: `node test/run.js` (see test/run.js for the suites; `perf` records startup requests and render times). The nightly photo finder and its judge live in `tools/`.

Checks (node test/run.js, from the folder above trip/)
  types         TypeScript reads the plain JavaScript (checkJs, noEmit) against types/waypoint.d.ts, the shapes that
                travel between files (Spot, Food, Pool, TripState, Plan, Day, PlaceRecord, the W object ...). Every file
                passes the base check; the files in tsconfig.strict.json also pass strictNullChecks, and a file that
                becomes null-safe is added there and never removed. A new member on W must be declared.
  a11y          axe-core (WCAG 2.0/2.1 A and AA) over every screen in light and dark: no violations. Text colors have
                their own tokens (--muted, --note-text, --food-text) so a fill color can stay bright while text passes.
  validate      the door above, fed the kinds of answers a model can return.
  fuzz          random trips nobody wrote by hand: a seeded generator builds hundreds (1-3 countries, 1-4 places each or
                "suggest", 3-21 days, any mix of ages, interests and focus, near or far departure, random rest days and
                freed slots) and every plan is checked against the rules the hand-built tests check one trip at a time:
                day count, places, no repeats, every planner-made stop fits, clock order, meal windows, naps, jet-lag
                days, closures, strenuous outings with grandparents, far pins. A failure prints the seed; FUZZ_SEED=<n>
                replays that one trip, FUZZ=2000 runs more. The first 300 found five planner bugs (travel-day meals,
                free time that did not stretch, lunch starting too early, short cuts on jet-lag days, seniors sent on
                strenuous outings); 2000 now pass.
  vitals        speed as a mid-range Android feels it: a 390px screen, CPU slowed 4x, slow 4G. Cold start must paint
                within 1.8 s (FCP) and its largest element within 2.5 s (LCP) with no layout shift (CLS < 0.1); then the
                taps a traveler makes most (next day, a day pill, open and close a stop, All days, Prepare, Pack, a tick,
                the trip menu) must each paint within 200 ms (the INP "good" line) without moving the layout. Numbers go
                into the report so a slowdown shows. What it found and fixed: the test server now gzips (the real host
                already does; a 448 KB script over slow 4G was the whole FCP); page flips (View Transitions) turn off on
                slow devices and after a slow flip; answers arriving right after a tap are drawn once, on idle time,
                after the tap's own frame has painted (they used to redraw and replan five times before it); Prepare
                builds only the open segment's markup; norm() and findCity() are memoized.

Version control
  The code lives at github.com/zdstjohn/Waypoint2: trip/, test/, tools/, types/, build/, the test server, package.json.
  `npm install` then `npm test` runs everything; `npm run types` only the type check. GitHub Actions
  (.github/workflows/ci.yml) runs the full suite on every push and pull request (about 11 minutes). Every published
  version of the artifact becomes a release: pushing a branch release/v<N> (or a tag v<N>) makes release.yml create
  the tag v<N>, build, and attach app.js, app.min.css, index.html and README.md, so any version can be restored by
  republishing its two files.

Source
  src/            the readable sources behind app.js (lib/, screens/ as .js.txt), the type declarations (waypoint.d.ts.txt) and both tsconfig
                  files, the test suites and the bundler: everything needed to rebuild and check the app, published with
                  it so the code is never only in one session's workspace. Strip .txt to use them.
