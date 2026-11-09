# Waypoint — how the code is laid out

One page. `index.html` is the markup; the code is plain files under data/, lib/ and screens/, joined and minified into
`app.js` (and app.css into `app.min.css`) by `build/bundle.js`. All code shares one namespace, `window.W`; the order in
`build/bundle.js` is the dependency order. `node test/run.js` builds first. The screens a first open never needs (the
Prepare screen, the booking autopilot, place search in Explore, the journal, family, settings, the kids' corner, the
recap, the packing list: LATER in build/bundle.js) go into a second script, `app2.js`, which lib/later.js loads once the first screen has painted (on idle time, or at once when you open one
of them, with "Loading…" for the moment it takes); W.needLater() says whether it has arrived. The offline copy carries both.
Travel mode stays in the first script on purpose: on the trip it is the first screen, often on a weak signal. What the
first screen reads from Prepare (the book-by checklist, the budget, which booking belongs to a stop) is lib/bookcore.js.

```
index.html        markup (header, tabs, one <main> per view); loads app.js and app.min.css (built)
app.css           the stylesheet, grouped by screen: fonts, foundations, header, Setup, My trip, a stop, storybook,
                  Explore, Bookings, Today, journal, settings, motion
fonts/            Nunito, Dela Gothic One and Patrick Hand SC as woff2, served by the app itself (Latin; extended Latin
                  letters in separate files the browser fetches only when a label needs them)
data/             built-in destinations (data1: Europe, data2: the rest, plus airports)
lib/              the shared library
  core.js         state, caches, helpers, Claude-powered data loading. "Find more" asks for 10 more things to do (at
                  least 3 for the evening) and 8 more places to eat, and stops offering once a city has 60 things to do
                  and 40 places to eat (W.IDEA_CAP, W.ideasFull): past that the planner has plenty and the nightly checks
                  and photos keep up
  errlog.js       what goes wrong on a real phone: uncaught errors and unhandled promise failures (not a connection you
                  didn't allow), at most 40 different ones a day, a repeat only counted, written every 15 seconds to your
                  own private corner of the database, data/users/<you>/errlog/d/<YYYY-MM-DD> ({items: [{msg, at, stack,
                  view, tv, build, ua, w, on, n}], updated}). Nothing personal: the message, where in the code, which
                  screen, the build, the browser and the screen width. Read it with ArtifactData get on that path.
  later.js        loads app2.js (above); loaded last
  classify.js     what a place is (kind, how long, how tiring, indoors, which parts of the day) — read by the planner,
                  the clock and the pictures
  validate.js     the one door for everything Claude sends back (W.V): names, pins near the city they were asked for
                  (a pin on another continent or at 0,0 is cleared, the place kept), tags, ratings, kid scores, times of
                  day, meals, hours, beach facts, money, time zones; links through the own-site rule. Loaded first.
  photos.js       real photos (from the nightly finder) and the credit line; a place with no photo shows no picture.
                  The list it leaves for the finder (wanted/<city>) puts the places your trip actually uses first, with
                  the trip's first day ("when") and the day each is used, so the nightly tasks do the soonest trip first
  places.js       checked place records (places/<city> in the database): fixed pins, official sites, hours, places
                  that have closed or never existed, and what to go to instead — laid over a city's list as it is read.
                  Pins: a place found on OpenStreetMap gets its real pin; a guessed pin that falls in the sea, a lake or a
                  river (tools/pin_check.py tests it against the map's own water) moves to the nearest shore when it is
                  close ("approx") or loses its pin when it is far out ("nopin": no pin beats a wrong one); a city centre
                  in the water gets one on land ("center"), which is where you stay until you pick a place. A match
                  needs evidence beyond the town's own name (a map label that just says "Rethymno" is no match for
                  "Rethymno Public Garden") and beyond a lone generic word ("Port", "Municipal", "Breakfast"); a beach the
                  map knows only by its village gets the shore in front of the village ("area"). `place_check.py recheck`
                  re-matches every stored pin under the current rules.
                  On the day map, stops on (nearly) the same spot share one marker showing every number ("1·2·4",
                  W.pinGroups, regrouped as you zoom), and a stop with no checked spot is listed as "not on the map".
                  Each place keeps its list's own pin (g) apart from any record's, so a record that is corrected gives
                  it back; a record that took a wrong pin off says which ("was"), and a saved list still holding that
                  pin asks Claude once where the place is (W.loadPins, checked against the city like every answer)
                  Google Places (New), with the owner's key in the nightly task only (never in the page, files, database
                  or repo): `place_check.py google` looks up the places whose pins rest on the least evidence first, and a
                  match leaves its place ID ("g", kept for good: every "Google Maps" link, W.gmapsPlace, and the whole-day
                  route's waypoint_place_ids then open the exact listing). The pin taken is the free map's own place at
                  Google's spot when there is one; otherwise Google's pin as "gpin" with its date ("gat"), which Google's
                  terms allow for 30 days: `place_check.py refresh` renews it after 25, the app ignores one older than 30,
                  and no map in the app draws one. Google's first answer counts only when it is the right kind of place
                  and holds the item's own words (in its name or address), or, for an item with no name of its own, when
                  it is the one such place in town (a park, a museum; never "any gelateria"); never a car park, a street,
                  a station, a tour desk or a supermarket unless the item says so, nor a hotel for a place to eat; a
                  day-trip match (over 15 km) must be the very same name, and nothing past 120 km or away from a town
                  the item names. Ratings and reviews are not kept. A city's ideas list the checked places first (open,
                  then not yet checked, then unsure) and a checked one says so ("✓ Checked").
  times.js        the clock for each day: starts, ends, the nap, travel days; how tiring a day is
  shape.js        the trip as a whole: nights per base, day trips instead of hotel moves, the way between bases,
                  what the group (toddlers, grandparents) can take
  plan.js         which cities, how many days each, what to do each day (the chooser and its shape rules). Above the
                  interests sits the trip's feel (S.focus, Plan step 1): Must-sees (the default: the famous places first),
                  Hidden gems (where locals go) or Best of both (famous and hidden in turn). Every idea is rated when it is
                  asked for (fame 2/1/0, a review score; older lists are rated once by W.loadFame), only well-reviewed
                  places are asked for, poorly reviewed ones fall away, and stop cards say Must-see or Hidden gem; rescuing
                  the rest of a day that has gone wrong (rain, tired, behind, closed). The plan is kept until the trip,
                  the cached data or the day changes, so most taps re-render without re-planning. One place is never
                  planned twice: a place key (W.placeKey: the name without generic words or brackets, a consonant
                  skeleton for longer words) catches "Liston" and "Liston Promenade", and two stays close together (two
                  bases on one island, or a city you come back to) share it, though a place you chose yourself always
                  stays. A gelateria, crêperie or juice bar is never lunch or dinner; a bakery is never dinner.
  route.js        trip shape check (and its one-tap fixes)   import.js  paste an itinerary   prices.js  live prices and booking sites
  watch.js        price watches   sync.js  saved and shared trips   fx.js  motion   vtmap.js  the street map (cities with a map pack)
  search.js       find any place and put it on the day: the city's own ideas, Mapbox (real places with exact pins,
                  through the viewer's Mapbox connection) and Claude (marked "Suggested by Claude" until the nightly
                  check confirms it), merged into one list; a Google Maps search for the same words is one link away.
                  An added place joins the city's list as your own (S.imported, with the trip) and goes in the part of
                  the day you pick. The page can't reach the internet itself: the map comes through the connection.
  offline.js      the trip without a signal: the photo index and photos kept on the phone (IndexedDB), map packs
                  warmed into the worker's cache, the offline note in Travel mode, and the "offline copy" (one HTML
                  file with the app, the trip and its photos inside, opened from the phone's files). Prepare > Take
                  along has "Before you leave": one button that saves the whole trip, with a row per place (street map
                  saved or not, photos for how many of its stops) and the size to expect, so it can be done on Wi-Fi
  packing.js      the packing list and the before-you-go list, read off the plan (who is going, how you travel, what
                  the days hold, the season, the plugs); ticks, removals and your own items stay with the trip
  warm.js         the warm touches: the family by name (typed in Plan; "Great for Mila & Leo", "Easy for Joe", a kid's
                  pick), the banner's greeting and the time where you're going (one gradient at every hour),
                  milestones that cheer once (with confetti, never under reduced motion), friendlier ticks, how ready
                  you are on Prepare, a day's mood in the journal, the recap's highlight reel and "one year ago today"
  autopilot.js    the book-by list kept for the morning helper (reads your inbox, writes calendar reminders, never books),
                  what it found, and the deadline timeline on Bookings. Both live in your private corner of the database:
                  data/users/<you>/bookby/t/<trip> and data/users/<you>/autopilot/t/<trip> (a document's path has an
                  even number of parts; the test database refuses any other path, as the real one does)
  The header is one banner: the wordmark, and the trip (its name opens your trips; under it a countdown that
  becomes "Day 4 of 20" on the trip), drawn by sync.js (W.countdown); on wide screens the tabs sit in it too.
screens/          one file per screen. The tabs are Plan (setup.js), Trip (trip.js, also the app controller: a labelled
                  switch for Day · Explore · All days. Explore: search any place, today's route (each stop with the
                  walk, transit or drive between them and its directions, and one button that opens the whole day in
                  Google Maps, unpinned stops by name), the street map from the city's map pack (every city in a trip has one; the nightly helper builds packs for
                  new ones, a few a night; tapping a pin opens it in Google Maps; never a sketch or a map picture), the free parts of the day with three picks
                  each, and every idea under the stop of today it is nearest to. On a big screen the Day view shows the
                  street map beside the day where there is one, otherwise today's route. Explore on a big screen puts
                  the search across the top, the route and map on the right below. The
                  Day · Explore · All days switch runs the full width in three equal parts. A Google map can't be shown
                  in the page (it may only load from its own server, and Google's terms don't allow keeping its map
                  pictures), so Google Maps is always one tap away instead. All days groups the days by place under a stay bar that sticks to
                  the top and lights the place you've scrolled to; the storybook opens from the trip menu and All days), Prepare (book.js: To book · Booked · Budget ·
                  Pack · Take along) and Today (travel.js: Travel mode, also the storybook). flow.js has the next-step
                  bar, undo, the stop sheet and the quick start (shown on the very first open); journal, family;
                  settings.js is now only "Import a plan" (sharing lives in the trip menu); kids.js is "For the kids"
                  (from the trip menu and Today): today's outings in big photo cards with a heart per kid, a passport
                  that stamps each place, and a treasure hunt per town
vt/              street-map data: the detailed packs live in the asset store (maps/<city> in the
                  database lists them), built nightly by tools/build.py and pack2json.py. A pack stays under 4 MB
                  (PACK_MAX_MB): the closest zoom levels are dropped farthest from the town first, never within 0.8 km
                  of it or of a place on its list; a city's wider area is still drawn from the coarser levels. vt/ keeps the engine, the
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
                strenuous outings); 2000 now pass. Later runs found two more: an afternoon after a late arrival
                that pushed the children's dinner past 7 (it now shrinks to as little as half an hour), and the way to
                dinner measured from a stop with no pin while the clock measured it from the last one with a pin.
  vitals        speed as a mid-range Android feels it: a 390px screen, CPU slowed 4x, slow 4G. Cold start must paint
                within 1.8 s (FCP) and its largest element within 2.5 s (LCP) with no layout shift (CLS < 0.1); then the
                taps a traveler makes most (next day, a day pill, open and close a stop, All days, Prepare, Pack, a tick,
                the trip menu) must each paint within 200 ms (the INP "good" line) without moving the layout. Numbers go
                into the report so a slowdown shows. What it found and fixed: the test server now gzips (the real host
                already does; a 448 KB script over slow 4G was the whole FCP); page flips (View Transitions) turn off on
                slow devices and after a slow flip; answers arriving right after a tap are drawn once, on idle time,
                after the tap's own frame has painted (they used to redraw and replan five times before it); Prepare
                builds only the open segment's markup; norm() and findCity() are memoized.
  desktop       the app with a mouse, from a 600 px side panel (the phone layout, as in the Claude app's artifact panel)
                to a 1920 px monitor, on a seven-place trip: every screen passes the phone's clipping checks and never
                scrolls sideways, and what a phone lets you swipe is reachable without swiping: stays shrink to fit and
                then wrap to an even second row, the Prepare tabs wrap, the previous/next day arrows stay at every width,
                the trip menu opens under the trip's name wherever the banner puts it, and the kids' corner stays
                picture-book sized and centred on a big screen.

Version control
  The code lives at github.com/zdstjohn/Waypoint2: trip/, test/, tools/, types/, build/, the test server, package.json.
  `npm install` then `npm test` runs everything; `npm run types` only the type check. GitHub Actions
  (.github/workflows/ci.yml) runs the full suite on every push and pull request (about 14 minutes), and a second job,
  "screens", takes every screen (phone, side panel, desktop; light and dark) for this commit and the one before and
  lists what changed in the run's summary, with the pictures attached (it never fails the build: a change can be
  intended). Every night .github/workflows/fuzz.yml plans 2000 random trips (pushes run 300) and lists any failing seed
  in its summary, ready to replay with FUZZ_SEED=<n>. Every published version of the artifact becomes a release: pushing a branch release/v<N> (or a tag v<N>)
  makes release.yml create the tag v<N>, build, and attach app.js, app2.js, app.min.css, index.html and README.md, so
  any version can be restored by republishing those files.

Source
  src/            the readable sources behind app.js (lib/, screens/ as .js.txt), the type declarations (waypoint.d.ts.txt) and both tsconfig
                  files, the test suites and the bundler: everything needed to rebuild and check the app, published with
                  it so the code is never only in one session's workspace. Strip .txt to use them.
