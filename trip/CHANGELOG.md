# Waypoint: what changed, version by version

Newest first. Each note says what changed and where in the code. How the code is laid out is in README.md.

## v199

Ten improvements after the world library (the morning's list, Nov 14).

- One rule for which fact wins (lib/core.js W.fact). A stop's hours, booking link, lead time and ticket can come from
  its own official page (the world library), the map's data (the nightly place check) or Claude, and arrive in any
  order; each writer names its source and a fact is replaced only by one from as good a source or better: official,
  Google, the map, Claude. lib/world.js, lib/places.js and lib/staysask.js write through it. The map's opening hours
  now win over Claude's guess at them (until now Claude's, when it came first, stood).
- A checked fact says when it has aged. A stop's details (lib/world.js W.worldFacts) now add "· may have changed
  since" to the "Checked <date> on <site>" line, and the box takes the caution colours (.wf-old in app.css, World
  library), when the newest fact shown is past its shelf life: opening hours 60 days, the entry rule 90, counted from
  today rather than from the trip's date. The two numbers (HOURS_DAYS, ENTRY_DAYS) sit at the top of lib/world.js and
  match SHELF in tools/worldlib.js, which renews what is that old. A fresh fact renders exactly as before.
- Street maps for saved library cities. When "Save for offline" (Settings, World library) finds a city has no street-map
  pack, the app writes a small shared document, mapwant/<slug> = { country, city, center: [lat, lng], at }, with
  nothing of the person's in it and any failure ignored (lib/photopack.js askMap, called from saveCity). The nightly
  task's prepare step (tools/nightly.py) reads mapwant/* and builds a pack for each such city from its centre alone,
  after the trip cities, oldest request first, within the same three packs a night. The nightly task reads the new
  collection too (its step 2 lists it with wanted, photos, links and maps).
- A part of a day nothing fits fills itself (lib/ahead.js fillShort): where a day showed "Nothing in <town>'s ideas
  fits here" and waited for "Find more ideas", more are asked for by themselves, once a visit per town, for the day on
  show and its neighbours (a morning or afternoon only: not an evening, not a meal, which has its own fill capped at
  three questions a town; not offline, not a shared trip you only view, not when the lists are full).
  The free row also stops saying the same thing twice: a row that already says "Nothing in this town's ideas fits
  here" (its reason) gets only "Find more ideas" or "Finding more…" under it (screens/trip.js). The ahead suite checks
  it asks at once, fills the days, asks only once a visit and never offline or in a trip you only view (with the
  call taken out it fails); meals checks the reason is said once.
- Tickets you can't get in without, in the morning reminder: the book-by list the app keeps for the nightly helpers
  (lib/autopilot.js W.pushBookBy) now marks those places (must), and the morning error-watch task (part C) reminds you
  a week before the deadline, on the day, and each morning after it has passed, with the official ticket link.
- A weekly health report (scheduled task, Sundays): each Waypoint task's last run, time and model, the file store's
  use, and the two libraries' size, in one phone notification.
- Photo packs are text (lib/photopack.js, tools/photopack.js): JSON with each picture in base64, in a .js file, as the
  street map's parts are, because the app's file store takes text files, not raw binary ones. tools/photopack.js plan
  works out moving the stored photos into packs (the cities of trips keep their files; every other city is packed, and
  the files its photos had of their own are freed unless something else still points at one) and mark writes a
  city's photo index with its pack named.
- The nightly world library goes back to unread places (tools/worldlib.js): a record whose sights are mostly unread is
  looked at again, least read first, after expiring facts and trip cities; a place whose own pages gave nothing is
  marked (tried) and left alone for two weeks.
- Tests: new suite late (the same Granada trip planned with Claude's answers at once and then seconds late and out of
  order, each day drawn: every stop's checked facts and the To book list must match, and every fact the library
  checked must stand as its record says; with the v196 ticket-link bug put back it fails, as it should). The test
  stand-in can hold its answers back (window.__lateAsks).


## v198

The world library's phases 3 and 4 (the "Waypoint World Library — design" doc): a library city plans at once and
offline, and the planner and To book work from the places' own rules.

- A library city's days at once. Where a trip city has a record in the world library, its first lists (15 things to
  do, 15 places to eat) come from the record instead of a question to Claude: a three-day Granada trip is planned in
  about 50 ms, with a signal or without one (lib/world.js W.worldFirst, called from lib/ideas.js W.loadCity before
  the question). Which cities the library holds is world/_index ({v, at, cities: {<slug>: {n, c, p, at}}}), read once
  a visit and kept on the phone; a city added in the moment before it has come waits for it (1.5 s at most). A
  record too thin to plan from (fewer than 8 things to do or 6 places to eat), or a city the library doesn't hold, is
  asked about as before. "Find more" asks Claude as always. tools/worldlib.js build writes world/_index whenever the
  list of cities changes, and doctor checks it says what the records say.
- No entry without a ticket. A place whose own page says there is no entry without a booked ticket (entry.need
  "required") is marked (it.must): its details say so, its To book row says "no entry without a ticket", and To book
  opens with a "Don't miss these" card (screens/book.js mustCard): each such place not booked yet, its book-by date
  and the official ticket page. Where the page gives no lead time, the app books a timed entry a month ahead and any
  other two weeks ahead (MUST_TIMED, MUST_DAYS); a lead the page gives wins.
- Not checked yet. A paid or bookable place whose own page has not been read yet says so in its details ("Not
  checked yet ... Look before you go") instead of showing a guess as a checked fact; a place known for its hours but
  not its tickets says "Hours not checked yet". A free stroll says nothing.
- Save a city before any trip. Settings has a World library card: the library's cities, each with "Save for
  offline", which keeps its record, its photo index and its photos (from its photo pack where it has one) and its
  street map on the phone (lib/photopack.js saveCity), so a trip made there later plans, shows its photos and opens
  its map with no signal. A saved city's record is kept when the phone tidies the library (lib/world.js tidy);
  "Remove" takes it off again (its photos stay while the open trip goes there).
- Photo packs. A city's photos can travel as one file (new lib/photopack.js reads it; new tools/photopack.js makes and
  checks one: "WPPK1", the index's length, a JSON index, the pictures). photos/<city>.pack names it; a photo with
  pk: 1 has no file of its own and shows from the pack (fetched once, all of it kept on the phone; a blurred preview
  until then). Saving a trip for offline and making the offline copy take a city's photos from its pack in one
  request where it has one. Nothing is packed yet: moving the stored photos into packs (to bring the file store's
  5,000-file limit back in reach) is a change to the nightly photo task, for the owner's yes. The website's copy
  leaves packs out (tools/copy_to_cloud.js: its photos are Wikimedia Commons files).
- Fixes found on the way, all in lib/world.js: the official ticket link the record sets is no longer replaced a few
  seconds later by Claude's guess at one (the record's link is marked settled, bookV 2, so lib/stays.js
  W.loadBookLinks doesn't ask for it); a place put into a city's list after the record was laid (a list changed
  without changing its length) now gets the record's facts too (each place is marked as it is laid); the facts are
  laid again after the place check's records are (W.placesLaid), so a pin or closure that check sets can't undo
  them; and a place's always-closed days are no longer added twice when the trip's dates change. To book: a
  ticket's price line no longer ends in a stray dot where "book ahead" was taken off.
- Tests: new suite photopack (a pack made and read back byte for byte, anything else refused; a pack-only photo shown
  from its pack; an offline save from packs; a library city saved and then planned with no signal); world (the
  entry rules at work, the Don't miss card, the first lists from the record, the ticket link kept).

## v197

- The day's route along the streets, on the street map (Today, the Trip day beside its map, the desktop pane): from
  where you're staying to each stop in turn, as you would walk it, a line that draws itself when a day opens (at once
  with reduced motion). New lib/streetroute.js works the walk out from the map pack's own detailed tiles: it reads the
  street lines, joins them into a network (a tile keeps a street's corners, not every point another street meets it,
  so each stretch is cut where another street's corner or end lies on it and where another crosses it; a bridge or
  tunnel joins only its own kind; a street cut at a tile's edge carries on in the next), and finds the shortest walk
  (A*), a footpath sooner than a main road. Nothing is asked of any service, so it works offline and the same on
  the website, the line lies exactly on the streets drawn, and no data of Google's is put on the map (the rule the
  pins already kept). Checked against Google's own walks for a day in Seville: each of six hops within 0.1 km. The
  network is built a few milliseconds at a time (about 100 ms of work for a city centre). lib/vtmap.js: showRoute,
  two line layers under the map's names; Today hands over its hops with the returns to where you're staying
  (o.hops). A hop over 3 km (a ride), one off the detailed map, or one to a Google pin has no line.
- Motion: a stop's card grows into its sheet and the sheet settles back into it (the browser's shared-element
  transition, in screens/sheet.js; lib/fx.js says when a change is to be plain: W.fxPlain); another day slides across
  (the day you leave goes out one side as the next comes in), with the tabs and the day strip kept on top while it
  does; when a day arrives where its placeholders were, its stops come in one after another; a stop's card gives a
  little under a finger. As before: none of it with reduced motion, and a modest phone gets the plain change. The
  first download is no bigger for it (492 KB, as v196): the morph is in the second script, its styles in the second
  stylesheet (app.css "Motion II"), and the day's longer slide reuses the page turn's keyframes with a distance of
  its own (--wp-x).
- The nightly place check no longer pins a famous sight on a shop that shares its name (Granada's Alhambra sat on a
  shop's label by Plaza Nueva, about 1 km from the monument): tools/place_check.py gives a shop's label half the
  weight when it has fewer words than the name looked for, and between equal matches takes the one nearest the
  place's own rough position when it has one (the city centre only when it has none). tools/worldlib.js: a pin is marked as Google's only when Google
  gave it; a record that is already in the database is marked so (exists), and the nightly task reads its version
  before writing over it.
- Tests: new suite route (the router on streets made in the test, and Today's map on a made-up pack with detailed
  tiles: test/lib/synthpack.js).

## v196

- The world library (the "Waypoint World Library — design" doc): one checked record per destination, world/<country-city>,
  made by tools/worldlib.js (plan, build, doctor; published as tools/worldlib.js.txt), which a nightly task would run
  once the owner approves its wording.
  Every fact carries its source page and the day it was checked; a fact without them is refused; what has expired is
  re-checked first. First batch: Granada, Seville, Córdoba, from the database's own city library and place checks and
  the official pages (the Alhambra, the cathedrals, the Real Alcázar, the Mezquita, the science park).
- The app's side, lib/world.js (second script): a trip city's record is laid over its lists (after the place check's):
  hours per weekday for the trip's season (it.wk; W.hoursFor in lib/times.js gives the planner and the day's clock a
  weekday's own hours: Granada's cathedral opens at 3 pm on Sundays, so a Sunday morning never has it), the dates a
  place is always closed (as closures on the trip's days), the official entry rule (price, timed entry, booking, the
  ticket page), a pin looked up again, and Google's walks between its places (W.leg, kept 30 days). A stop's details say
  what was checked, where and when (W.worldFacts). The trip's own cities are kept on the phone for offline use.
- The website gets the records with the nightly copy (tools/copy_to_cloud.js sends world/ too; the staging table's
  rule lets them in: migration nightly_copy_allow_world).
- Tests: new suite world; WP_PORT lets a second copy of the app run the tests beside the first.

## v195

- Settings > Storage (screens/settings.js, the owner: "it says file storage is full ... now my nightly photo check won't
  do anything"). The artifact's file store takes 5,000 files; photos the nightly photo look turned down, copies replaced
  by better ones and the parts of rebuilt map packs were never removed, so it filled. The card, for a viewer who can
  edit the artifact only (`claude.use("assets")`), shows how full it is; "Find unused files" reads the collections the
  nightly tasks write (STORE_COLS) for every "/_blob/<id>" and lists the files none of them names, leaving out any from
  the last two days (a nightly run uploads first and writes its document after); "Remove them" asks on the page, then
  removes them four at a time and counts the store again. A scan that finds under one file in twenty in use is taken
  as a failed read and removes nothing. New suite: storage.
- The nightly photos and maps task (tools/nightly.py) builds street-map packs only for the cities of trips: the packs it
  built ahead for the app's built-in cities (125, about 232 MB) were in no trip and are removed (the owner's call).

## v194

- A rest day's cards keep their tint, time and place, and lose the ideas to tap (the owner: "it shouldn't suggest what
  to do like 'pool' etc. it's a rest day. Just let it be"). S.restDo is no longer written; the key stays view-only so
  a v193 phone's note never reaches the shared copy.
- The desktop: only stops (things to do, places to eat) glow under the pointer; free time, rest cards and a day out's
  free-time row don't (lib/deskmap.js; the owner: "these are trying to glow on desktop").

## v193

The owner picked each look from five previews drawn in the app ("B" for a day out, "E" for a rest day and for tomorrow).

- A day out (W.dayOut, lib/times.js: a day trip to another town, or a morning that takes the whole day): its stops under
  one band titled "Day trip · <place> · <from> – <to>" (screens/trip.js bandOf, .dt-band), from its first stop until a
  stop back near your stay; the parts of the day left open while out are one "Free time at <place>" row (flushHeld),
  not a row each saying nothing fits. The toddlers' nap on such a day is on the go (it was "back at the hotel", from
  34 km away).
- The map on a day out far away (W.vtForDay, lib/vtindex.js): the map of where you go, framed on the stops there, or
  no street map with the day's list and Google Maps; never the home town's, framed 30 km off the stops. Used by the
  Day view, Today and the desktop's map pane.
- A rest day's morning and evening (restCard): a card with a sunrise or dusk tint, where you are, and a few easy ideas
  to tap (pool, playground, nap; bath time, story and bed); the one tapped is marked, this phone only (S.restDo, view
  only). "Rest, pool or playground" rows are gone.
- Today: tomorrow in an "Up next" banner above tonight (.go-up), in the app's colours, with a "Next day" button (it was
  "See it", in a row under tonight). The day bag starts folded.
- Size: the first script and stylesheet are 492 KB (v192: 487). The tour's styles moved to the second stylesheet and
  sunrise and sunset to the second script (lib/gmaps.js) to make room; the perf suite's limit moved from 490 to 494 KB
  for what the first screen now draws.
- Tests: dayout (new).

## v192

Measured before building (slow-phone profile, 4x CPU, slow 4G): first paint 1.03 s, no layout shift, every common tap
20-66 ms, 1-3 layout passes a tap and 1-2 for a long scroll. Of six speed items asked for, four were already so
(answers shown as they are written, only the screen on show is drawn, the neighbouring days' photos fetched ahead,
nothing re-measured needlessly); two were built, and three of v191's additions were put right.

- The map's engine is asked for in idle time while a day of a town with a street map is read, on the Day view or Today
  (lib/ahead.js engineAhead, lib/vtmap.js W.vtEngineWarm), so a map waits only for the town's pack. Under the map
  packs' rule: never in Simple view, offline, on a data saver, a slow connection or mobile data.
- The website's listeners (lib/cloud.js listen): back on the page, one asks at once only when its last answer is older
  than its own pace (wake); every listener used to ask each time the app was switched back to.
- Put right from v191:
  - W.vtPrefetchNext (lib/vtmap.js) is gone. lib/ahead.js already fetched the next town's map pack (the evening before,
    never on mobile data, one a day); v191's copy of it had none of those rules.
  - The library documents v191 kept in the phone's storage (lib/citylib.js kept/keep) are gone, and what it wrote is
    removed. lib/ideastore.js already keeps every place's ideas on the phone and is looked in before anyone is asked;
    the copy was never cleared and could have crowded the storage the trips need.
  - The tour's last screen says what is true where the trip is open: the website installs as an app; in Claude the page
    follows its owner's changes.

## v191

- Sunrise and sunset on each dated day (W.sunTimes in lib/times.js, NOAA's formulas, shown in the place's own time zone;
  the line is part of W.wxLine in lib/gmaps.js, and stands alone when there is no forecast yet).
- A tour of three screens, once per phone, the first time a shared trip is opened (screens/quickstart.js W.tourOpen,
  W.tourMaybe, called from lib/sync.js after a shared trip loads; "waypoint-tour-seen" in localStorage).
- The city library keeps each place's document on the phone for three days (lib/citylib.js kept/keep; refreshed whenever
  an answer is saved), so a place opened again, or with no signal, answers at once.
- The next town's map pack is fetched in idle time while the day before it is on show (lib/vtmap.js vtPrefetchNext, called
  from the Day view; skipped on a data saver or a 2G connection), and the installable version opens its connection to the
  database early (a preconnect link, build/standalone.js).
- Already so, and left alone: the app starts from a first script and loads the rest later, and the street-map code
  loads only when a map opens.

## v190

- Menu and Swap are separate buttons again on a wide desktop (v188 had put them behind "..." there; the owner asked for
  them back). A phone, and the desktop's narrow pane, keep the "..." menu.

## v189

- The desktop's row of hover buttons on a stop card (drag, open, a day earlier or later, show on the map) is gone
  (the owner: "get rid of this on desktop"): the card is dragged by its number or photo, opens when clicked, and moves to
  another day from its "..." menu or the actions sheet. lib/desk.js deskQuick, the two handlers and desk.css go with it.
- The repository copy now carries the link-preview image and its script (tools/repo_sync.py): v188's website build
  failed on Vercel for want of build/icon/og-image.png.

## v188

Small fixes and a few things you asked for.
- A travel day: once you pick how you're getting there (or a ticket is booked) the options fold into one line under
  the ticket ("Bus · 3h"), and stay folded on this device (trip.js legCard, S.legClosed, a view-only key).
- Opening a day at what's on now keeps the walk there clear of the day strip at any text size (trip.js holdAt takes a
  function for the gap).
- One date style (times.js W.fmtDate: "md", "wmd", "Wmd", "mdy"): the month is always short. The 37 places that wrote
  dates their own way now ask it; the kids' corner, the trip's dates and the memories no longer spell the month out.
- Long names (Today's town, the day strip's stay, the stay button) wrap to two lines instead of being cut off.
- Checks: the built-in places (test/lib/datacheck.js), drawn buttons nothing reads (test/lib/deadcheck.js), the day
  keeps its scroll place when a stop's details close (back), the travel-day fold (flow).

## v187

Ten small jobs on the library, the website and the checks (each with a test where it can have one).
- Settings has a "City library" line (how many countries and cities are ready: lib/citylib.js W.libStats, counted by
  the nightly check into citylib/_stats) and a "What's new" card (data/data2.js WHATS_NEW).
- Plan says "Ready from the shared library" under a country's towns that came from it (core.js W.libFrom).
- The nightly plan picks among the next dozen most visited empty countries (not any of the 150), and
  `node tools/citylib.js gaps <db_dir>` prints what is still missing.
- Cities already seen stay on the phone after a reload and with no connection (a check in test/suites/citylib.js).
- The longest country names fit a 360 px phone (test/suites/names.js). Sign in / New account and "Find flights" get
  the unseen 44 px tap area (app.css), checked on the installable site in dark mode.

## v186

Small fixes from the owner's list.
- To book lists what is needed soonest first (by the day it is used, then its book-by date: screens/book.js).
- The speed measurement asks again after a passing "upstream_error" and does not count a run of two errors as done; it
  is re-armed (key waypoint-speedtest-v3: lib/speedtest.js).
- Other names for a country find it, typed and as you type: UAE, Holland, Czech Republic, Turkey, Burma, Macau and more,
  matched to whichever spelling the browser's list uses (screens/setup.js ALIASES and SAME, lib/typeahead.js).
- Logged errors: a screen that asks for the second script before it is in gets "not yet", never an error (core.js
  W.needLater stand-in); the delete x and the "..." on a stop get the unseen 44 px tap area (app.css).
- Sharing the installable site's link shows a proper title, description and picture (build/standalone.js, build/icon/og.js).

## v185

The city library is built up for anyone who uses the app (the owner: "building up the library ... so someone can use
the website and it'll have plenty to bring up"), not only from the questions one person's trips ask.
- General answers: each kind of question (a country's towns, a city's things to do, its places to eat) also has a
  general form, asked for no one in particular (no interests, adults, no food needs: lib/citylib.js W.libGeneral).
  A trip's own answer is used when the library has one; when it only has the general one, that fills the days at
  once and the trip's own question is asked after it, last in line, adding what suits its interests, travelers and
  food needs (lib/core.js run, key "<kind>|<city>|own").
- The nightly task fills general answers at random across the 150 most visited countries (tools/citylib.js plan:
  6 countries' towns and 15 towns' two lists a night, twice the countries while few towns are open), with the app's
  own words (tools/citylib-questions.json, which the citylib suite keeps equal to the app's). Nothing waits for the
  app: the private notes of a trip's questions (v184) are gone.
- The website gets the library too: the nightly task copies it to the website's database after filling it
  (tools/copy_to_cloud.js now carries citylib; its staged import, import_begin and import_finish, as for photos).
  The website reads that copy and never writes to it (its database lets no one else write there).
- Tests: citylib (a city with only the general lists fills from them at once, then asks its own question once and
  adds to them; the general questions name no interests, ages or food needs and match the nightly task's); tools
  (random but repeatable nights, the app's ids and fingerprints).

## v184

Places for a city in seconds, not twenty or more (the owner: "it shouldn't take more than 3-5 seconds to populate the
stops/places to eat"), and Plan offers the 150 most visited countries (the owner: "dial it down to the top 150").
- The city library (lib/citylib.js): once Claude has written a country's towns or a city's first lists (things to
  do, places to eat), the answer is kept in the shared database (citylib/<place>) and the same question, from anyone,
  is answered from there in about a second (lib/core.js run looks it up before asking; the answer goes through the
  same handler and checks). Questions are matched by their words with the place left out, so a trip with other
  interests, travelers or food needs gets its own answers; the shared store keeps only answers and a fingerprint of
  the words, and the words (which can carry food needs) are noted only in the person's own space
  (data/users/<you>/libq/q), for the nightly task.
- Asked ahead: the first three cities Plan offers under a country (the chips, when you choose cities yourself) have
  their lists asked for in the background (W.warmCity), last in line, and one place in the line is always kept free
  for what you tap; a city asked ahead moves up as soon as it is needed (W.loadLow, W.loadNow).
- The nightly task's helper, tools/citylib.js: plans the next countries' towns and cities' lists (most visited first),
  fills the place into the noted questions and checks the answers before they are written.
- Plan's country list is the 150 most visited (data/data2.js TOP_COUNTRIES, also the order they are offered in); any
  other country can still be typed, and a trip already planned for one keeps it.
- Shared helpers: W.citySlug (was copied in photos.js and nightfood.js), W.textHash (from ideastore.js).
- Tests: citylib (a second person's phone gets Croatia's towns and the offered cities without asking Claude, within a
  few seconds; another way of asking is asked again; the shared library holds no question's words; asking ahead and
  moving up; the 150 countries); tools checks the nightly helper on a made-up database. The test database's update
  now merges nested fields as the real one does.
- Fix: the markup-and-styles check (test/suites/same.js) reloaded its pages from the size job's own test port
  (8791) instead of the test server's (8771), so it failed in GitHub's run of v183.

## v183

- A smaller first download (the owner: "reduce app size without any negative effect"): what a phone downloads before
  its first screen fell from 519 KB to about 481 KB. The questions sent to Claude, word for word, and the checks on
  its answers moved to a piece of their own, app.ask.js (lib/ideasask.js, staysask.js, asksask.js, answers.js),
  fetched the first time Claude is asked, or by itself once the first screen is up. The desktop workspace moved to
  app.desk.js, which only a window 1024px or wider fetches; a phone never does. The trip budget's sums moved to the
  second script (lib/budget.js). build/bundle.js PIECES decides what goes in which piece; lib/later.js loads them
  (W.piece, W.pieceIn); the installable app keeps every piece for offline use.
- Nothing is drawn differently: a new suite, same, records the markup and the computed styles of every element on
  every screen at all five sizes, and they matched the build before the change, as did every screenshot.
- Tests: perf checks a phone never fetches the desktop workspace, and its limit on the first download falls from
  520 KB to 490 KB.

## v182

- Photos show at once on a reload (the owner: "takes a few seconds to load photos on page refresh"). Every load used to
  download every town's photo index (about 150 towns, 1.6 MB) before any card had a picture. Now a town's index is
  watched from the first time a photo of it is looked up (lib/photos.js want: photos/<town>, links/<town>; photos the
  nightly run finds while the app is open still come in), and the last
  16 towns used are kept on the phone ("waypoint-photo-index-v1"), so the first screen has its photos from them while
  the asking only refreshes. A trip that spells a country differently ("USA") gets the whole list once, to find the
  town by its name, and keeps the town found. The photo finder's list (W.wantPhotos) moved to the second script
  (lib/photowish.js), so the first download stays under its limit.
- The slim bar's photo is in place before the bar first shows (lib/ahead.js measures a hidden stand-in of the bar), so
  it no longer jumps as you scroll (the owner: "jittery"); placed as soon as the second script arrives.
- Tests: photos checks that only the trip's towns are asked for and kept, and finds a differently spelled country's
  town a moment later.

## v181

Everything the five reviewers raised about v180 (the owner: "fix all their issues including the smaller points").
- Sync's change log no longer grows for ever: stamps of things taken away more than 30 days ago go, on the way to the
  account, whose copy has them (lib/sync.js pruneCt, W.syncPrune). A trip still too big for the account drops older
  ones, and if it is still too big it says so once instead of retrying every 15 seconds.
- An edit found minutes after its tap (the app suspended before it saved) is still a person's change, stamped and sent
  (note: a tap since the last look counts, as well as one within two minutes).
- A hotel's price watch is offered, and starts, only from a Booking.com price for the nights it has now
  (lib/watch.js uses W.stayLive, as the budget does).
- The packing list sees your own and hidden items in its cache key, so ones added on another phone show at once.
- "+15 min" offers Undo: the undo snapshot holds "running late" (late, lateAt) though sync leaves it out.
- An empty part of a day says why (W.WHY, now in lib/rules.js: the journey, a light travel day, too late for this
  group, nothing fitting, your place gone from the list).
- Plan says when travelers have no age: they are planned as adults (nothing for children unless an age says so).
- The slim bar's photo is placed at most once a frame (lib/ahead.js), however many resizes come in.
- Tests: each fix checked in its suite (sync, bookings, packing, travel, planner, nokids).

## v180

- The slim bar's photo shows the strip the top card's bottom edge showed, so the photo carries on as the card scrolls
  under it (the owner: the top of the photo there was jarring). lib/ahead.js W.pinPhotoFit (second script) gives the bar the card's
  photo size and offset, moved up by the card's height, measured from the card when the bar shows and on resize.
- Tests, tidied (the owner's ask; no change to the app): smoke is folded into layout and desktop, which open every
  screen anyway (one view showing, with content, no page error: test/lib/drawn.js); fixes176's and cuts177's checks
  moved into their topic suites (clock, workspace, stays, explore, bookings, warm, nokids); accounts, airplane, copy
  and the account simulator use your own packing items instead of the journal as their saved data. 68 suites.

## v179

- Scrolled down on a phone, the slim bar that takes the top card's place keeps the day's photo behind it, shaded the
  same way (the owner's ask; lib/photos.js W.topPhoto puts the photo on the page's root too, html.top-photo, and
  app.css draws it under .pin on Trip and Today). Without a photo the bar keeps its colours. banner checks it.

## v178

The planner's rules and syncing between phones, made sound (two deep jobs, done by Fable in its own copy and merged
here; its full notes are with the session), the owner's pick for the stop cards' buttons, and no limits for people
who aren't coming.
- The owner's nine planner rules as code (lib/rules.js, W.checkPlan; W.checkPlan.table() on the trip on screen): every
  meal and part of the day, enough time, a real place once a trip, one area a day, no train outings, opening hours and
  the children's hours, a toddler's nap and nothing strenuous with grandparents, real named places, your own picks
  kept. Every empty part of a day says why (slot.why: journey, light, late, yours, none). The fuzz suite builds each
  town's places itself (test/lib/fuzzworld.js); 2,000 seeded trips (and 3,500 more) break no rule.
- Planner fixes from it (lib/plan.js, times.js, validate.js, planacts.js): hand picks and booked places are put back
  first across the whole trip and never overwritten; stops in one town or within 40 km share one list of planned
  places (no place twice); one day check that every pass repairs against, the area a hard test; only a travel day may
  lose an outing; train rides refused (V.trainRide); the afternoon never starts before a nap ends; a place opening
  after the group's latest hour isn't planned; with a toddler dinner is planned at 1¼ hours, so the evening keeps its
  short outing before 8 pm.
- Syncing (lib/sync.js): each change a person makes carries its time and device (S.ct), deletions included, and two
  copies join setting by setting and entry by entry, newer first (W.syncJoin), so phones agree whatever order their
  saves arrive in; nothing comes back after an undo, and offline changes survive closing the app. The planner's own
  fill-ins are never stamped (W.planWrote). Trips saved before load and join as "unchanged since the start". New
  suite devices (test/lib/devsim.js on acctsim.js): 500 seeded runs of 2-4 phones editing, undoing, losing signal,
  closing and reopening, saving in any order (SYNC=3000 passes too).
- The stop cards on a phone: Menu and Swap behind one "more" button (the owner's pick of five, screens/trip.js
  actsWrap/actsShow), top right or under the photo; its menu closes on a choice, a tap elsewhere or Escape, and takes
  the keyboard in and back. A card is a row shorter. Wider screens keep their buttons.
- Nothing for someone who isn't on the trip (the owner: "If there are no children going the app shouldn't make
  suggestions or limit things based on a person that's not there"). The rules already went by who is going
  (W.party); now also: the kids' corner in the trip menu, "Rest, pool or playground", the packing list (passports,
  ferry, cold, rain, pharmacy) and its Kids' bag tab, the picky-kids diet, "For the kids" on menus and the menu
  reader, the search hint, and what Claude is asked (the plan check, the evening briefing, places to eat, rainy-day
  places, idea times, running behind).
- Tests: new suites devices and nokids; fuzz rewritten; look waits a frame for the slim bar.

## v177

The owner's cuts, from asking each reviewer for the one thing they'd take out (the owner: "Do your picks").
- No "Booking sites" links: the Bookings card with its "Show links to" chips (Booking.com, Expedia, Trip.com,
  GetYourGuide, Ferryhopper) and the "Also on…" links it added to stays, stops, ferries and the to-book list are gone
  (lib/prices.js urls(), W.altLinksFor, W.altUrls, W.sitesRow). Each row keeps its official link, and the live
  Booking.com and Expedia prices where the connection is there.
- No Mapbox in Explore's place search (lib/search.js): the map there is Google Maps, through the viewer's connection.
  Without it, the trip's list and Claude answer and a line says how to connect Google Maps; when Google doesn't answer,
  it says so. Mapbox is off the artifact's connector list too.
- No Settings card for unused stored files (lib/storage.js and its suite deleted): it was upkeep for whoever runs the
  app, and the old journal photos it would have cleared don't exist (the saved trips' journals are empty).
- The treasure hunt keeps a tick on the find it was for (screens/kids.js hunt, huntTick): ticks are kept by the find's
  words, and a town's list is kept from its first tick, so a re-plan that makes a town beachy (or not) no longer moves
  ticks to other finds. Ticks saved by position before v177 still show and become ticks by words at the next tap.
- Tests: new suite cuts177; explore and gmaps search checks for Google only; the mock has no Mapbox.

## v176

The owner's asks: the journal gone everywhere, Today's top card like Trip's, and a review for size and bugs.
- No journal (the owner: "Get rid of journal everywhere"): Today's Journal fold, the Trip day's Journal button, the
  photos, notes and "How was today?" moods, and their place in the recap are gone (screens/journal.js deleted, its
  styles too). The recap stays (the trip in numbers, the highlight reel to send, each day's places), now in
  lib/memories.js (W.renderRecap). Trips from before keep their journal data, unused, so photos they point at are
  still "in use" for Settings → Storage. Sync no longer joins journals specially (lib/sync.js mergeJournal gone).
- Today's top card on a phone has the day's photo behind it, its credit and how full a day, as on Trip (the owner's
  ask; lib/photos.js W.dayPhoto shared by both, html.on-go). On the day itself the time there takes the date's place,
  so the line stays one line.
- Fixes from a code review (five readers, each finding checked before it was fixed):
  - Sync: another device putting a choice back is no longer undone by this one (what the account has after our own
    write is the common base); changes made offline and never sent survive the app closing and another device saving
    later (kept with the last version both had: idx unsent/base, joined on arrival); a listener that met an error in
    what the app did with an answer kept listening (lib/cloud.js listen).
  - A Booking.com price counts only while it is for the nights you have (lib/bookcore.js W.stayLive).
  - The price watch no longer takes any hotel's price for a name with no Latin letters (lib/watch.js).
  - "Way behind" sets free what no longer fits once the day has moved back (lib/times.js W.slotCap, shared by the
    planner); undoing a rescue takes back only the minutes it added, not a "running late" you said after it.
  - Calendar times past midnight are the next day (W.iso); the booking timeline says "leaving today" and "leaving
    tomorrow" on the right days; the booking helper's list goes under the trip it was made for.
  - CSV keeps negative numbers (a pin's longitude) as numbers; an imported place with no coordinates has no pin, not
    one at 0,0; the quick start no longer turns an empty age into a baby.
  - The plan check and the travel-day briefing are kept under the trip they were asked for; the nightly places join a
    city's list after a reload too (by what the lists hold, not a counter that restarted).
  - The map search can't stay on "Searching the map…" after a newer search; the offline copy's street-map index
    doesn't stay "loading"; Explore draws with an idea that has half a pin; an offline save and the offline copy are
    of the trip you started them on.
- Smaller: dead code out (unused icons and exports in trip.js, autopilot.js, setup.js, bookcore.js, ahead.js, times.js,
  plan.js, deskmap.js, sync.js, warm.js; the old Booking.com pick and calendar branches nothing could reach). With
  the journal: app.js 388 → 386 KB, app2.js 356 → 349 KB, app.min.css 120 → 119 KB, app2.css 45 → 43 KB.
- Tests: new suite fixes176; journal checks out of warm, travel, review, sync, a11y; banner checks Today's photo.

## v175

The owner's asks: Where to stay from Booking.com, and the pin-matcher fix pushed.
- Where to stay shows Booking.com's real places for your nights and your whole group when Booking.com answers (the
  Claude app with it connected; lib/prices.js W.liveLodge): each with its rating, its price a night and for the stay,
  and its own Booking.com page to book. They fill the same three tiers by price a night (the cheapest third Budget,
  the dearest Splurge), best rated first, a place rated under 7 by ten or more left out; the reroll goes through the
  rest of that tier. One search a town, a few seconds, kept 6 hours; opening Where to stay asks first (so a
  permission prompt comes from you), and once a search has worked the other towns are got ready one at a time. "Stay
  here" keeps its price for the budget and the price watch (W.liveStay). Without the connection (the installable
  app), without dates, with nothing free, or when Booking.com fails, Claude's picks as before, and the panel says why
  (with "Try Booking.com again" after an error). No search box comes back (gone in v152).
- Shared pieces: the place on show and the next one, for Claude's picks and Booking.com's (lib/stays.js W.pickShown,
  W.pickNext); a stop's check-in and check-out days in one place (lib/prices.js W.stayDates, used by setup.js);
  Booking.com's answer checked like any other (lib/validate.js V.bkStay: its page must be on booking.com).
- The place check's matcher (tools/place_check.py label_fits, pushed before this release): a free-map label must name
  the place, not only share a word with it.
- Tests: stays rewritten for the Booking.com places (tiers, reroll, Stay here, an error, nothing free, no
  connection); the mock's Booking.com can answer with more places or none (__bkMore, __bkNone).

## v174

The owner's picks for a phone's Trip day and Simple view, the Explore map taken out, and fixes from an audit of the
places and pins the owner found wrong.
- A phone's Trip day (the owner's option 2 of five; screens/trip.js, lib/photos.js W.phoneTop / W.topPhoto, app.css):
  the day's photo goes behind the top card, which already names the town and the date, on Day and Explore, so the
  first stop sits right under Day · Explore. The stop cards are roomier: the time on a line of its own, the whole name
  (up to three lines), a small square photo at the right, and Menu / Swap as buttons with words (.bt-l, .sl-acts).
- Simple view keeps only what runs the day: no descriptions, no "nice to know" notes (TimeRow.more in lib/times.js:
  "Locals eat around…" and the like), no tags but the booking ones, no photo behind the top card.
- The Explore map is gone (the owner: "Get rid of the explore map. It's not working."): the street-map picture over
  Explore's header, its tap, and W.vtStill (lib/vtmap.js) that drew it. Both tabs draw the same header.
- One real place is planned once (lib/plan.js keysOf): besides its name, a place is known by Google's place ID once
  the check has matched it, and an outing by the real place it happens at. The owner's Naxos trip had the Kastro on
  four days under four names. A real place that is only the town ("Naxos Town") counts for nothing.
- Names that are not one real place are dropped as lists come in and never planned from lists kept before
  (lib/validate.js V.vague): a group ("Ammoudara Beach Tavernas", "cafés on the square"), two places in one ("A / B",
  "A or B"), a meal as a thing to do ("Evening dinner in the old town").
- A checked record can say which meals a place serves (lib/places.js: r.meal, it.mealOk): "A dinner restaurant, not a
  breakfast café" holds over a café-sounding name (lib/plan.js breakfastOK), and a pick the planner made for a meal the
  place doesn't serve is planned again.
- The places themselves (the database, not the code): every place on the owner's trips and in their towns' lists that
  had no checked record was looked up on Google Maps (about 1,000 places in 33 towns, read by helpers and reviewed):
  wrong pins moved (to the free map's own place where it has one), invented places and ones in another town marked
  unfound, duplicates marked, closures noted. The rest of the towns' lists (about 600 places in 28 more towns) too.
- Street maps for 116 more towns (the database and the asset store, not the code): Milan, Bologna, Verona, Pisa, Siena,
  Turin and the rest of Italy's list, and Spain, France, Switzerland, Austria, Germany, the UK, Ireland, the Low
  Countries, Croatia, Portugal and more; the three Spanish trip towns that had none (Tarifa, Picos de Europa, Ordesa).
- Tests: phoneday (new), banner (rewritten: no map, both tabs alike), planner (one place under several names),
  validate (names that are not one place), places (a checked record's meals), photoset (the top card's photo), look
  and cloud (the new cards; places to stay as they are written). 68 suites.

## v173

Light or dark by choice, a quiet map for Explore, and four fixes from the owner's own testing.
- Light or dark (lib/core.js W.theme / W.setTheme / W.themeSwitch; Settings and the trip menu): Auto follows the
  phone, Light and Dark hold whatever the phone says. Kept on this phone only (localStorage "waypoint-theme"); the
  choice stays above the host page's own theme (a MutationObserver puts it back) and the browser bar's colour follows.
  One helper (remember) now saves this and Simple view.
- Explore's header (screens/trip.js, app.css .hero-city): the owner's pick of five, a quiet map. No dots, no photo
  lines over it: the town's streets with the neighbourhood names, and the town's name in the middle. W.vtStill
  (lib/vtmap.js) takes "keep" (which name layers stay) and "pal" (palette overrides) for it.
- The green check marks sit in the middle of their boxes on a phone (app.css .chk .box: the wider tap area is the
  box's ::before, so the tick's own ::after is no longer moved).
- The travel card's "Not booked yet" (screens/trip.js, app.css .tk-st / .tk-sub / .tk-mid): a centred tag with
  "Planned times, door to door" under it, and the dashed line runs through the plane or train icon.
- Desktop map: the pointer over one pin lit every pin in a town whose name has a space in it ("Naxos Town"), and
  never its card. A pin's list of stops was split on spaces, and a stop's key holds the town's name; it is now one
  key per line, read by W.pinKeys (lib/vtmap.js, lib/deskmap.js).
- Where to stay comes sooner (lib/stays.js addLodging): the picks are taken in as Claude writes them, the best of
  each price tier first, as sights and places to eat already were. The whole answer (12 picks with reasons, prices and
  pins) takes about half a minute; the three cards now fill within the first few seconds. (The suggestions are
  Claude's; Booking.com is used for the live price of the stay you choose, on Book.)
- Tests: theme (19 checks: the switch in both places, the choice surviving a reload and the host's theme, the check
  marks, the travel card at normal and 150% text), workspace (two more: pins in a town with a space in its name),
  banner (the quiet map), claude (three more: places to stay as they are written). 67 suites.

## v172

A flight day with no signal (the owner's pick, done by a helper and merged here): a new test plays a phone on a plane
and the app was fixed wherever it misbehaved.
- Changes made offline are held and sent when the signal is back (the 'online' event, or a retry every 15–20 s); the
  header says "Will sync" instead of a red "Not synced", and a change made right after an offline start survives a
  reload (lib/sync.js: held jobs, the stored signature, a tick at start, W.syncState).
- What needs a connection says so (lib/offline.js, the NEEDS table and W.needNet; app.css): Check my plan, the
  briefing, Find more, the replan box, Gmail, Live fares, Calendar, menu reading, Import, the PDF (until it is
  loaded) and the offline copy are dimmed with no signal, and a tap says "<what> needs a connection. It works again
  when you're back online." instead of trying, hanging or failing.
- Waits instead of spinners (lib/core.js): what was asked for offline says "Waits for a connection"; when the account
  answers after an offline start, requests you started are kept (only list loads are dropped).
- Search (lib/search.js) stays within your lists offline and says the map search needs a connection; the Google Maps
  check (lib/gmaps.js), photo-finder lists (lib/photos.js), shared-trip edits (lib/together.js) and the street-map
  index (lib/vtindex.js) wait for the signal and pick up again; no false "couldn't be sent" offline.
- Tests: flight (92 checks: a phone that loses its signal on a trip, one opened with none, and the installable app
  reloaded offline then back online with the change reaching the account). 66 suites.

## v171

Pictures and maps that come sooner at the same quality (the owner's "do all", done by four helpers and merged here),
a map banner for Explore, and Today without the slim bar.
- Explore's header (screens/trip.js, lib/vtmap.js W.vtStill, app.css .hero-alt): the same box as Day's photo, with a
  still street map of the town drawn once from the app's own map pack, the day's stops and Explore's ideas as dots in
  their colours, and the town's name where Day has it; a tap opens the map. Switching tabs crossfades the map over the
  photo in 0.2 s (none with reduced motion), so nothing below moves. A town with no street map shows the photo darkened.
- Photos (lib/photos.js; made by the nightly tools nightly.py, photos2.py and big_photos.py): a small copy (320 px)
  for thumbnails, WebP copies of every size with the JPEG to fall back on, and a 16 px blurred preview stored on the
  record that fills the photo's box until the picture fades in. Old records draw as before; the nightly task fills in
  the copies for the photos trips use, a capped number a night. The copy to the installable app keeps the preview.
- What you see first (lib/photos.js, lib/ahead.js new, second script): the day's header photo is fetched first
  (fetchpriority); when idle, on a connection that isn't saving data, the next and previous day's header and first
  stop photos are fetched ahead (in WebP when the photo has it), so a swipe shows them at once (about 3 s to 0.1 s at
  slow 4G); the evening before a move to a new town, on Wi-Fi, tomorrow's street map is kept (once a day).
- The installable app keeps photos on the phone (build/standalone.js, the service worker): Wikimedia Commons photos,
  cache-first, CORS only, up to 300 photos or about 60 MB, oldest out first, refreshed after 30 days; app updates
  keep them.
- Street maps, town centre first (tools/pack2json.py, build.py; vt/packworker.js, lib/vtmap.js): a new or rebuilt
  pack is laid out with the opening screen's tiles first, in a small first part, and the map draws as soon as they
  arrive (Rome at slow 4G: about 2–3 s, was about 40 s); the rest streams in behind. Parts are basE91 text, about 8%
  smaller than base64. Old packs work unchanged; the nightly task rebuilds two a night into the new layout.
- Today no longer grows the slim bar when scrolled (lib/warm.js); Day, Plan and Prepare keep it.
- The nightly place check asks Google for 3 results instead of 5 where the place is nearly sure (tools/place_check.py).
- Nightly scripts have one copy each: tools/<name>.py, published byte-identical as trip/tools/<name>.py.txt (a test
  checks they match).
- Merging fixes: a photo in a <picture> (WebP) adds no box to the header row, and the header's preview sits under
  its loaded photo.
- Tests: banner (52 checks), photoset (28), ahead (20), swphotos (20), packs (18). 65 suites.

## v170

Accessibility beyond the automated checker (the owner's pick, done by a helper and merged here), the slim header as
the same card, and the way back to a stay that no longer runs into its time.
- Keyboard and screen readers (lib/a11y.js, new, first script): focus stays on the control you used when the screen
  is drawn again (a day pill, a tab, a chip, Next day…), or goes to the one beside where it was; a stop's sheet, the
  day trip, the stay sheet, the welcome and the palette take the keyboard, keep it (the page behind is inert, Tab
  wraps) and give it back on Escape; the tabs and radio groups take the arrow keys, Home and End; a link to another
  screen lands on that screen; a control reached by keyboard is never left under the tab bar or the pinned bars; one
  live region reads changes and where Undo is (the Undo bar stays while the keyboard is on it).
- Names a screen reader reads right: times apart from names ("8:30 AM, Rome cafe"), Today's next and current stop,
  packing and booked ticks with one name and their state, named boxes and buttons in Plan, the stay sheet, Settings,
  Import and Journal; sheet titles are headings; error messages are alerts.
- Text grows with the phone's or browser's text size (the type is in rem): at the usual size every screen is the
  same; from 120% rows that need it wrap (html.tbig); at 130% and 200%, 360 and 390 px, nothing runs off or overlaps.
- Touch: an invisible tap area of at least 44 px on the small buttons and links; Plan's steppers show their focus
  ring inside the button.
- The slim bar that comes when you scroll is the header card grown shorter: inset like it, its corners and shadow,
  on a band of the page's ground (app.css .pin, lib/warm.js); the day strip sticks under it.
- The way back to your stay: the time bubble always holds all it says, and "Back to <a long hotel name>" goes on a
  line of its own under it when it doesn't fit beside it (app.css .nav-leg).
- Tests: keys (34 checks: focus kept, arrows, sheets modal and given back, names, text size). 60 suites.

## v169

Smooth on older phones (the owner's pick "smooth on older phones", done by a helper and merged here). Measured on a
phone slowed to a sixth of a laptop's speed, the longest stall after the first screen went from 430–750 ms to about
100 ms, and the first screen is usable sooner (example trip: 897 → 787 ms; a 21-day, 8-town trip: 987 → 761 ms;
Today: 852 → 557 ms). Every day's plan and every screen came out the same, byte for byte.
- What arrives after the first screen (the second script, Claude's handle, the checked place records, the street-map
  index, saved ideas) no longer re-plans and redraws the whole trip in one long task each: W.changedApart (lib/core.js)
  plans in the next task and draws in the one after, and the others are batched (W.arrived), one plan and one draw per
  burst; the task that runs the second script plans and draws nothing (lib/later.js done). Taps made before the
  second script arrived are still replayed at once.
- Smaller costs: durations, links' hosts, times and dates read once per text (W.durText, hostOf, textMin, fmtDate);
  the window's width read once per redraw (W.holdPaneW); the pinned bar's check and the trip bar drawn once per frame.
- Tests: perf (the second script's own task plans and draws nothing; what arrives is planned, then drawn, in tasks
  of their own); vitals notes the longest task after the first screen.

## v168

"Still open" (the owner's pick from the second list of ideas, for the nightly place check, which runs on Fable).
- The nightly place check asks again, a month after a place's last check, about the places of the trips coming up
  (their month in that town within 60 days, or begun): still open, closed for good, or shut for a stretch that
  takes in the trip (a renovation, holidays, a winter or summer season), with the dates (tools/place_check.py
  opentodo and openapply; places to eat and the soonest months first, about 40 a night; "unsure" is asked again in a
  week). The shared list keeps only a trip's month in a town, never its days, so that is all the check sees.
- A record's closures ("shut": [{f, t, why}]) are laid over the lists (lib/places.js W.cleanShut: real dates only,
  at most 4); W.shutOn(it, n) is the closure that takes in trip day n.
- The planner keeps a place off the days it is shut (lib/plan.js score; W.badForDay with the day, so a pick of the
  planner's that turns out shut is replanned, and Claude's own check hears of it).
- A day you put such a place on yourself says so on the stop and in its sheet: "Closed Jun 8 – Jun 20 (renovation)"
  (lib/times.js, with the day's other warnings).
- Tests: stillopen (closures kept and cleaned, kept off the days, the warning, shown as text; the script's two steps
  on a small database). 59 suites.

Every file crash-safe (the owner's pick "make every file crash-safe", done by a helper and merged here).
- All 75 source files are now in tsconfig.strict.json (strictNullChecks), up from 35; both type checks are clean.
  Most fixes keep a checked value in a local so the check holds inside a closure; five casts that say a value is
  there, each with why; no new "any".
- Real guards where a missing value could have thrown: the weather for a day with a home pin that has a latitude
  but no longitude (lib/gmaps.js wxGet, and the map area of a list); a city's stays answered without a list
  (lib/stays.js); click, key and touch handlers whose target is the page or the window (fx, memories, sync, warm,
  kids, today, flowacts, trip); a booking form with a box missing (screens/book.js); the screens' boxes on start.
- Two small fixes found on the way: a trip whose start date can't be read counts down by its length, not
  "Tomorrow" (lib/sync.js W.countdown); a pin with only one coordinate counts as no pin rather than as 0
  (lib/core.js W.km, and where distances are worked out).
- Types: W.dayOfDate, W.weekday and W.countdown can be null; TownLeg and GoEntry; a stale strict entry
  (trip/lib/map.js, gone long ago) removed.

## v167

Presses without square corners, and the desktop's hover glow in indigo (the owner's notes, from screenshots).
- The phone's own tap flash is off everywhere (app.css: html -webkit-tap-highlight-color transparent): it is a square
  drawn over the element's box, so rounded buttons flashed sharp corners. Buttons already answer a press themselves
  (they shrink a little); a tab being pressed in the bottom bar shows a soft rounded background; a plain link dims
  for a moment (phones only).
- On the desktop, the stop, place to eat or Explore card under the pointer glows in the buttons' indigo
  (--on-primary), not amber (desk.css .ws-hi).
- A way between two stops ("21 min · Navigate") no longer glows when the pointer is over it, and no longer lights
  the two stops in the list; it still lights their two pins on the map (lib/deskmap.js paint).
- Tests: workspace (a way lights the pins, nothing in the list).

## v166

The night-before briefing for a new town (the owner's pick from the second list of ideas).
- On Today, the evening before a travel day, "Tomorrow" offers "Briefing for <town>" (lib/brief.js, new, in the
  second script; screens/travel.js goTonight). One question to Claude names the town, where you come from and how,
  when you arrive, the day and any public holiday, the stay, the family and what they eat, and tomorrow's plan, and
  asks for four parts: from the station (or port, or airport) to the stay with small children and bags (how, how long,
  about what it costs), two or three easy first-dinner places near the stay, what is closed tomorrow, and three or
  four local ways worth knowing. Shown as "Arriving in <town>": the name and walk of each dinner place on one line,
  the local ways as a list, a word to check times and prices on the day, and "Ask again".
- The answer is kept on the phone with what it was for (the town, the date, the stay, how and when you arrive), so it
  opens at once and offline; when any of those change it says the plan has changed and offers "Update the briefing".
  Every word is shown as text (W.briefClean trims and caps each part).
- Nothing is shown when tomorrow stays in the same town, offline, or in a read-only shared trip.
- Tests: brief (the button, the four parts, the question, kept and shown as text, out of date when the stay changes,
  none when tomorrow stays put). 58 suites.

## v165

Your bookings checked against the plan, in "Check my plan" (the owner's pick from the second list of ideas).
- Plan's "Check my plan" starts with "Your bookings against the plan" whenever there are bookings (lib/bookcheck.js,
  new, in the second script; lib/review.js W.reviewBlock = bookBlock + claudeBlock). It is read on the phone at once,
  without Claude, from the stays, journeys, tickets, tours and tables you added or imported (S.bookings):
  - a stay that starts after the plan reaches its town (said once, with the nights to book), starts before it, runs
    past the day you leave, or falls when the plan has you elsewhere;
  - nights in a booked town with no stay, and two stays the same night (a run of nights is one problem; changing
    hotel halfway through a town is not a problem);
  - a train, ferry, bus or flight booked for another day than the plan moves (an evening departure the day before
    is fine);
  - arriving 90 minutes or more before check-in, or leaving 3 hours or more after check-out: what to do with the bags;
  - a ticket, tour or table booked for another day than the plan has the place, more than 45 minutes off its planned
    time, or for a place not in the plan.
  Each is drawn like Claude's own findings (the day, what is wrong, "Try:", "Open Day N"), without the kind label
  that would say "Bookings" every time. With nothing wrong: "Your 2 bookings match the plan".
- Claude's own check is told what is booked each day (W.bookedOn: kind, what, time, check-in, check-out) and looks
  for bookings that don't fit the plan (a new kind, "Bookings").
- One way of matching a place's name against a booking's words (lib/bookcore.js W.nameRank, W.nameMatch), used by
  the bookings and the new check: numbers count and must be whole ("Sight 2" is not "Sight 20"), and among several
  places that match, the closest name wins.
- Tests: bookcheck (each problem above; matching bookings and a change of hotel raise nothing; the section and its
  "Open Day" buttons; none without bookings). 57 suites.

## v164

Small text links as small buttons, chips with the buttons' corners, "Find more" in the gradient, photos first in Explore
(the owner's picks, from mock-ups).
- The day's end (screens/trip.js): "Make it a rest day" and "Make it a day trip" are small outlined buttons with their
  icons (a nap, a car), stacked under "Pick a place", one width (.de-a, .de-b).
- A text link that is an action of its own (.linkish: "Find more ideas", "Comment", "Show all", "Try again", "Undo",
  "Rename this trip"…) is a small outlined button like the others: indigo words and ring, soft corners. The arrows
  back (.back, .go-back, a sheet's "Back") and a word inside a sentence (.linkish.small) stay words.
- Explore's "On your trip (8) show": "show"/"hide" is a small outlined button with an arrow.
- Every chip (the filters under "Find more", Plan's interests, "Running late?"…) has the buttons' soft corners
  (--r-sm), not round ends.
- "Find more" in the icons' gradient (.grad-t: --ig-1..3, clipped to the letters).
- Explore lists, in each group, the ideas with a photo first and those without one last (screens/trip.js byTier, by
  W.photoFor as the card itself decides; a place to eat counts only a photo of itself; not in Simple view).
- The "Comment" button on a stop is gone (screens/family.js; the owner's call): the hearts stay, and claude.ai's own
  comments on the page still work.
- Tests: ideaorder (an idea given a photo comes first in its group). 56 suites.

## v163

Read a menu photo for your family (the owner's pick from the second list of ideas).
- A meal's Menu (its sheet, or the menu icon on the day) starts with "Read the menu" (lib/menuread.js, new, in the
  second script; lib/nightfood.js W.menuBlock(it, day, key); screens/tripacts.js passes the stop's key). The phone
  offers its camera or its photos, up to three pages, in any language. Each photo is shrunk on the phone (longest side
  1600 px, JPEG) and sent with one question: every dish's printed name, English name, what it is and its price, and
  how it suits this family from "What do you eat?" (W.eatText) and their ages (W.who): good for everyone, the kids
  will like, ask first (with the reason), skip (folded away); plus up to three phrases in the menu's language for the
  waiter about the allergies and diets. The answer is cleaned (W.menuClean: plain short text, a known fit, at most 60
  dishes) and shown as text only, with "Claude can misread a menu: check allergens with the staff". It lives for the
  visit, by the stop it was read for.
- Only where pictures can be sent to Claude (W.menuCanRead asks sample.limits()): the Claude app now declares
  pictures for its Claude requests (the first menu read asks to allow it once); the installable app sends them through
  its server: lib/cloud.js passes images (base64, at most three) and its limits say so, and the server function
  "claude" (supabase/functions/claude/index.ts, in the repository since v162, deployed with this version) accepts
  up to three JPEG/PNG/WebP pictures and checks their type and size.
- Tests: menuread (12 checks: the button, the picker with two pages, what is sent, the groups, the reasons, the
  phrases, the allergen note, markup in an answer shown as text, a failed read, no button on a sight or where
  pictures can't be sent); the test stand-in answers menus (test/mocks/mock2.js). 55 suites.

## v162

Buttons as one family, and Today's route with one directions button per stop. The owner chose each step from
mock-ups: indigo words and an indigo ring on every button (option "C"), the gradient icons kept, the rounded-square
corners kept, and for the route a mix of "round icon buttons" and "one Directions per stop".
- Every button (app.css): .btn, .btn.quiet, .btn.ghost, the link buttons .chip-a, Explore's "Add to Day" and Today's Map
  have indigo words, an indigo ring (--primary-ring, a lighter mix of --on-primary) and soft corners (--r-sm); the main
  action on a card (.btn, .chip-a.pri: the next stop's Directions, Pick a place, Book) is also filled with the soft
  indigo. A delete keeps its own colour (.btn.danger). Before, buttons came in four looks: square filled, square
  outlined with white words, round outlined with indigo words, round filled.
- Icons keep the gradient on every button: the filled button's icon had been drawn in its words' colour.
- One place for the colours: the per-screen rules for .chip-a (Today, the day's end, Prepare's checklist) keep only
  their size and spacing; their own backgrounds, borders, hovers and the .goto colour are gone.
- Today: its buttons are one height (44 px on a touch screen; the next stop's Directions a little larger), and the
  nearby list's Directions has the same padding as the others.
- Today's route (screens/travel.js W.routeStop, W.routeLeg; also the route beside the day on a big screen): each stop
  has the gradient arrow on the right (no box round it), the way to it from the stop before, or from where you are when
  the stay isn't picked yet; a place with no pin is found by its name and town. "Navigate" on the ways between,
  "find on Google Maps" (on two lines) and "Find it on the map" are gone; a way whose time can't be worked out says
  "Travel time not known". Only the way back to a picked stay keeps a button of its own.
- Tests: travel.js (one button per stop, none on the ways between), places.js (a stop with no pin is found by name).
  54 suites pass; screens change where they have buttons.

## v161

Two fixes for the web app (claude.ai in a phone's browser), from the owner's screenshots, and one for Explore.
- The tab bar grew tall with empty space under its labels (app.css). Chrome on Android draws the page under the gesture
  bar and says how tall it is (the bottom safe-area inset); the floating tab bar rose above it and also kept the
  edge-to-edge bar's bottom padding of the same inset, so it counted it twice. The floating bar now only rises:
  107 px -> 73 px tall with a 34 px gesture bar, 10 px above it as before; its sides keep clear of a side bar too.
- The slim top bar came only once the whole banner had left the screen, while the day strip below it had already
  stuck 44 px down, so the banner's last strip slid on in a gap above the strip and the slim bar then dropped in
  (lib/warm.js W.pinBar, app.css). It now comes the moment the banner's bottom reaches the line the strip sticks to
  (44 px plus the status bar's inset, measured), and fades in over the banner's own colours instead of dropping. A
  scroll check (one per frame) instead of an IntersectionObserver, which inside the Claude app's frame cannot be told
  to fire early.
- An idea in Explore with a long official site ("Tickets · gallerieaccademia.it") put its map icon on a line of its
  own (screens/trip.js, app.css). The picture links (menu, photos, map) are now one group that never splits, beside
  the tickets link, which wraps inside itself if it must; on phones of 360 px and under the gaps are a little tighter.
- Tools: evo/v161/film.js (scrolling filmstrip and the tab bar with a simulated gesture bar), rowcheck.js, sheet.js.
  54 suites pass; only Explore's screens changed, as listed.

## v160

The design review (the owner's follow-up 4 of 4): every screen looked over in light, dark, large text, tablet and
desktop; the fixes were shown to the owner as before | after sheets and approved.
- What is chosen is ringed in indigo, not black (app.css, desk.css): Plan's kind of trip (.focus), the open trip in
  the trips menu (.trips), a chosen stay (.lodge.on), a text box in use (.field:focus), a chosen card on the desktop
  (.ws-sel). The frames were var(--ink), left from before soft indigo; they are var(--on-primary) now.
- "Must-sees" stays one word (screens/setup.js: a hyphenated name is wrapped in .nw; .focus columns are
  minmax(min-content, 1fr), so its column is a little wider). At 340 px and under it may break, as it did.
- Settings and the recap had the bold sans for their title on a phone and the serif on a desktop: their own rules come
  with the second stylesheet, after the shared serif rule, and won. The serif is in their own rules now (.set-h h2,
  .rc-hero h2), at the size of a day's title.
- The build's check that a moved style rule never wins over a later one (build/bundle.js target()) compared rules by
  their last class, so ".set-h h2" (no class in its last part) was never compared. It now uses the last class above
  and the element. It then found two more of the kind on Plan's step headers (.step-h h2, .step-h b): each is one
  rule now, nothing to see on a phone.
- Less empty space between the day strip and Day | Explore on a phone (.vsw-row). The search hint is "Search places
  in Rome", which fits a 360 px phone (lib/search.js, screens/trip.js).
- A photo beside a stop has a hairline, not a 2 px black frame (.thumb).
- Desktop: a card's quick actions sat over its photo and buttons; they sit on its top edge (.ws-qa).
- Tools: evo/v159/snap.js and sheet.js (the before | after sheets), evo/v159/review_sheets.py (every screen at its
  five sizes). 54 suites pass.

## v159

Fixes from a sweep of awkward trips and random taps (the owner's follow-up 3 of 4). evo/v158/sweep.js plans nine trips
nobody would test by hand (30 days in 5 places with an overnight ferry, the date line, New Year in Tokyo, the night the
clocks change, one day with a baby, a leap day, 60 days in 13 places, a trip long over, a train past midnight on the
last night), draws every screen for every day and looks for broken text, clock order, dates and width;
evo/v158/monkey.js taps whatever is on screen, 2,100 taps over seven seeded runs on a phone and on a desktop.
- A journey that ends after midnight (lib/bookcore.js W.legTicket, screens/trip.js, screens/travel.js). The 11:30 PM
  ferry that lands at 5:40 AM showed "To Crete 6:30 AM" with no word of the day, its length was the unbooked boat's
  (2h, not 6h 10m), and the day said "Leave by 10:15 PM; the morning is yours". Now the ticket shows its own way and
  length, the arrival says "next day" (W.dayAfter), the day before is "yours", breakfast and dinner are in the town you
  are leaving (lib/times.js: a ticket that leaves after 7:15 PM keeps dinner there), and "Tonight" says "On the ferry:
  you arrive 5:40 AM" (W.nightOut) instead of "No Crete stay picked yet". A journey of several days counts each day.
- A flight that lands earlier by the clock than it left, across time zones (Tokyo 9:55 PM to Mexico City 10:15 AM the
  same date). It was dropped as a mistake, so the day planned the unbooked train instead. Now its times stand as booked,
  each "local time", and no length is worked out from them (Ticket.zone). A train or ferry "arriving" before it leaves
  is still taken as a typing mistake: its arrival is left out, as before.
- Nothing wider than the phone. The day's list (.slots) and the swap under a stop sized their one column to their widest
  content, so a row of swap cards could push a freed slot 127-165 px past the edge; the column is now minmax(0, 1fr).
  Plan's route check let a button that names two long places run 8 px past the edge; it wraps.
- Long place names on a ticket ("Mexico City") were cut to "Mexico C..."; they are smaller and may take two lines.
- Tests: tickets (the night ferry, the flight across time zones, the mistaken train). 54 suites pass; every screen of
  the test trip matches v158.

## v158

Places to eat that may not exist are marked, and picked last (the owner's follow-up 2 of 4: grade Sonnet's
suggestions, then tune the prompts from what the grading finds).
- What the grading found. The nightly check of places had already judged 3,544 suggestions in 59 towns: 9% were not
  real places, nearly all of them places to eat in small towns (Costa Smeralda 36%, Mykonos 31%, Positano 19%, Elounda
  17%), most with a name made from the kind of place and the town ("Pasticceria Positano", "Elounda Gelato"). Sights
  were rarely invented. Sonnet answering today's questions for six towns did the same: 21 of 90 places to eat did not
  resolve to a place on Google Maps.
- What was tried (evo/v157/grade: the questions, the answers, the lookups). Telling Sonnet to list only places it is
  certain of cut the lists to 5-10, then 1-8, a town: too few to plan meals from. Asking it to mark what it is unsure
  of kept all 15, and the mark means something: 43% of the places marked unsure failed the lookup, 5% of the sure ones.
- What changed. The question for places to eat (lib/ideas.js) asks for the exact name on the sign, never one made
  from the kind of place and the town, and for "sure": false where it is not certain. lib/validate.js turns that into
  the status "not checked yet": the day says so on the place, the planner picks such a place last (it already did for
  this status), and the nightly check settles it either way. Nothing is dropped.
- A limit, said plainly: the answers graded here came from Sonnet run as a helper, not through the app; what the app
  gets will show in the nightly check's own numbers.
- Tests: validate (the mark and the question). No screen changes with the test data.

## v157

Room in the first download (the owner's follow-up 1 of 4 after v156). The first script and stylesheet were 518.9 KB of
their 520 KB budget; they are 476.5 KB. No screen changes (every screenshot matches v156), and nothing a tap does is
lost.
- What a tap DOES now comes with the second script, a moment after the first screen; what is drawn stays in the first.
  screens/flow.js keeps the next-step bar, the day buttons and the doors to the sheets; screens/flowacts.js (new) has
  the next step's buttons, undo, swiping between days and reordering by drag or lift. screens/trip.js keeps drawing a
  day and changing day or view; screens/tripacts.js (new) has the swap under a stop, a place's details and what the
  screen's other buttons do. lib/plan.js keeps the planner; lib/planacts.js (new) has "not for us", another suggestion,
  an idea put on the day and the rescues. The halves share what they must through W.tripX and W.planX.
- A tap that lands before the second script is kept (lib/later.js): its click handlers register with W.onClickLater
  and are handed the taps that came early, in the order a click reaches them; the Trip screen's own handler asks for
  the script and acts when it arrives. test/suites/early.js holds app2.js back 7 s and checks a Swap and a tap on a
  stop made meanwhile are both done when it comes, and that changing day works at once.
- Styles follow their code (build/bundle.js LATER_CSS): the swap, the street map's own styles and pins, place search,
  "not for us", a menu and the plan check's link are drawn only by the second script, so their rules (11 KB) moved to
  app2.css. The build still refuses a move that would turn the cascade round.
- Removed: a stop's "more" block in the day list, built for every stop on every draw and never shown since the stop
  sheet replaced it (screens/trip.js), with its styles; an unused set of icons in screens/flow.js.
- How it was found: evo/v157/cover.js (what of app.js runs at start-up, by module) and render.js + idle.js (which
  functions never run when screens are only drawn, across every day, view, clock and size).

## v156

The redesign, chosen by the owner from three versions (the original, a first revision, and that revision as corrected by
the eight people who reviewed it), with soft indigo as the main colour.
- Colours (the tokens at the top of app.css): a warm off-white page, white cards on hairlines, and one colour per kind
  of thing: terracotta for food, green for sights, indigo for getting around, amber for pace and warnings. The dark
  theme is a warm near-black with the same roles.
- The main colour is its own pair of tokens, --primary and --on-primary: main buttons, the tab and the day you're on,
  a chosen chip, "Book" on a stay and the home mark in a route were a near-black block; they are a pale indigo fill with
  indigo text (a deep indigo fill with a hairline in the dark). On the desktop's rail the day you're on has its number
  in indigo.
- Type: Plus Jakarta Sans for text and headings (bold), Instrument Serif only for place names and the biggest titles,
  JetBrains Mono only for the budget's amounts; digits are even-width everywhere so times line up. Nunito's files are
  gone; Dela Gothic One stays for the logo alone.
- A day reads as a timeline (screens/trip.js): the way between two stops is a pill on the dashed line (how, how long,
  how far) with Navigate beside it. A travel day's leg is a ticket: from, to, the times, and whether it is booked
  ("Not booked yet · planned times, door to door", or "Booked" with its reference).
- The map (lib/vtmap.js): a quiet grey-and-stone palette; a pin shows its kind's icon with its letter as a small tag,
  so colour is not the only cue (screens/travel.js passes the stop to the pin). On the desktop the title and tools over
  the map are frosted glass, and the stop you point at has a pulsing ring (off under "reduce motion").
- Smaller numbers and labels are darker (they passed contrast before; the reviewers found them faint).
- On a phone the tab bar is frosted glass floating 10px off the bottom edge; Back to the top and the undo note sit 14px
  higher so they clear it (test/suites/flow.js caught the overlap).

## v155

Three speed fixes from the v154 performance review (approved by the owner; the review's other ideas were judged not
to fit Waypoint). Timed on a phone-size page with the CPU 4x slower, v154 against v155 (evo/v155/bench.js):
- A burst of answers is drawn once. lib/core.js grouped only what arrived within one frame, so answers coming a few
  dozen milliseconds apart (read back from this device or the account) were each a re-plan and a redraw. Now an answer
  that comes within 100 ms of the last joins the same redraw, which happens at most 300 ms after the first. Twelve
  answers 40 ms apart: 12 re-plans and redraws and 480 KB written (about 710 ms of work) became 2 redraws (about 190 ms) and
  nothing written.
- Photos and the street map only redraw (new W.redraw): they change how a screen looks, never the plan, but called
  W.changed, which threw the plan away (lib/photos.js, lib/vtmap.js). A photo arriving: about 85 ms with a 37-74 KB
  write became about 60 ms with none.
- The saved ideas are written only when they differ from what was last written (lib/core.js writeCache): every change
  to the trip used to rewrite them in full. Leaving "Food you love" after typing: 4-7 rewrites became 3-4 (only when
  new ideas came) and 5-9 redraws 5-6; its total time varies too much from run to run to name a gain.
- Explore's idea pins on the desktop are kept while the ideas are the same (lib/vtmap.js W.vtIdeas): each redraw made
  all of them again. Five redraws: 9 of 9 pins made again before, none now.

## v154

Desktop fixes asked for after v153, and All days gone everywhere.
- The map's pins stay on their places. In v153 the desktop eased every pin's position for 0.12 s (a transition on the
  marker, meant for the dot's grow on hover), so while the map zoomed or moved each pin trailed behind it (measured
  about 80 px off on a typical frame, up to 1,700 px on the worst) and on a new day each pin slid in from up to 245 px
  away. The ease is on the dot alone now (desk.css). And the desktop no longer merges close stops into one pin that
  splits again as you zoom: each stop keeps its own pin on its own spot at every zoom (lib/vtmap.js spotGroups; only
  stops on the very same spot share one), and where pins crowd, a later pin's name steps aside until it is pointed at
  (declutter). A new day is shown at once rather than flown to. A phone's small map is as it was.
- No lines on the map: the dashed links between stops are gone (W.vtLegs, W.vtLegHi removed). A way between two stops
  in the list now lights the two pins it joins. (This also ends a cost the v154 performance review measured: every
  hover repainted the whole map through the links' filter.)
- All days is gone, on the phone and the desktop: the itinerary's switch is Day | Explore, the rail lists the days,
  and the phone's row of day numbers goes between them. "Check my plan" moved to the end of Plan (and stays in the
  trip menu, which now opens Plan); its "Open Day 2" links work from any screen (data-goday). screens/alldays.js is
  now screens/dayline.js (the day's headline and effort bars, for the rail); the stay bar, its scroll tracking and
  their styles are removed, and S.glanceOpen with them.
- Plan on a wide screen: two columns, each stacked on its own (about you, steps 1 to 3; the trip, 4 to 6 and Check my
  plan), so a tall step never leaves a hole beside a short one; at most 1360px wide (setup.js .su-cols, desk.css).
- Prepare on a wide screen: To book and Pack in a wide column, each list flowing into columns of its own (To book's
  items side by side, the packing list in newspaper columns with its "kids" tags inline and the × under the pointer);
  the bookings, budget, sites, price watches and Take along beside it, in two stacks on a very wide screen
  (book.js .bv-main, .bv-aside). At 1440px the page went from 4,851 to about 2,650 px tall; at 1920px it is about
  2,200; at 2560px about 1,900. Take along's buttons no longer overlap.
- Tests: workspace (pins never eased, no lines, Plan's two stacks with no holes, Prepare's main and side columns),
  flow (Day | Explore; nights agree between To book and the plan), claude (Check my plan on Plan and from the menu),
  and the suites that visited All days.

## v153

The desktop workspace. On a window 1024px wide or more Waypoint is no longer the phone's page stretched: it is three
panes (two from 1024 to 1279px). Below 1024px nothing changed: every phone and tablet screen is the same picture as
in v152, and the workspace's stylesheet is never fetched there.
- The panes (new lib/desk.js, trip/desk.css). A rail on the left (264 to 280px; a 64px strip of icons and day
  numbers below 1280px or when folded), the screen you are on in the middle (440 to 500px beside the map, with its own
  scroll bar at its own edge), and the street map on the right for as long as you look at days (the itinerary,
  Explore, Today). All days, Plan, Prepare, the kids' corner and Settings take the whole width instead. A handle
  between the plan and the map resizes them (drag, arrow keys, double-click to reset); buttons fold the rail, hide the
  map, or show the map alone. What you chose is kept per device (localStorage "waypoint-ws"), never in the trip.
- How it is built: the screens' own width rules follow the pane, not the window. A wide window loads app.desk.css in
  place of the two phone stylesheets (lib/later.js): the whole of app.css with every @media width rule written again
  as a container query on the pane (build/bundle.js deskCss), then desk.css. So a 440px pane lays its cards out as a
  phone does and a 1200px pane as a big screen does, and the phone's stylesheets are byte for byte what they were.
  The page is held back until the workspace is here, so the old layout never flashes first; if its stylesheet cannot
  be had (the offline copy), the layout stays as it was.
- The rail (new screens/rail.js): the trip switcher and the next step (the phone's own elements, moved), the views
  (Plan, Itinerary, All days, Explore ideas, Today, Prepare and its five parts), every day of the trip grouped by
  where you stay (the day's headline, date and effort; a click goes there), what the plan and the map show (Things to
  do, Meals), and tools: Jump to, Export itinerary (CSV), Import and backups.
- The map pane (new lib/deskmap.js): the day's lettered pins, the ways between them as thin dashed links (straight
  ones: they show the order; the list gives each way's real time), and on Explore the ideas as small pins. A card and
  its pin light each other up under the pointer, a way in the list and its link too. A click on a pin opens the stop
  beside the plan. A place with no street map shows the day's route as a list with the way to Google Maps.
- A stop, a meal, Where to stay and Make it a day trip open as an inspector beside the plan: no dimmed page, the plan
  still scrolls, the map stays live, the open stop's card and pin are marked, Esc closes it.
- The day, denser: a line adds the day up (stops, time getting around, first and last hour, booked); each way between
  two stops says how long there is to spare; each card has quick actions on hover or focus (drag, open, a day earlier,
  a day later, show on the map). A card dragged by its handle onto a day in the rail moves there (the same place only);
  one way of moving a stop now (W.moveStop, screens/sheet.js), used by the sheet, the quick actions and the drop.
- Wide screens in columns: Plan's steps side by side and open; Prepare as one page of three columns (To book; Booked
  and Budget; Pack and Take along) with no tabs; All days as a grid. Folded lists start open on the desktop. Long
  text is no wider than about 65 characters.
- The keyboard (new screens/palette.js): Ctrl or Cmd + K opens a palette to jump to any day, place or screen; [ and ]
  go to the day before and after; Esc closes the palette and the inspector.
- The itinerary as a file (new lib/csv.js): one row per stop with day, date, times, place, how you get there and
  whether it is booked; a name starting with = is written as text. W.saveFile is now the one way a file leaves the
  app (the saved copy of your trips, the PDF and the offline copy used three copies of the same code).
- Moved to the second script: All days (new screens/alldays.js, with the day headline and effort bars the rail
  shares). First load stays under 520 KB.
- Tests: new suite workspace (55 checks: the panes, the map pane without a map, card and pin, the inspector, the
  keyboard, moving a stop, the columns, the CSV, narrow and wide again with nothing lost, and a phone that loads none
  of it); desktop follows the workspace from 1024px; evo/v153/check.js runs the same with Rome's real street map.

## v152

Your requests after v151: a smaller "First up", booking reminders that follow the trip's clock, one Add per idea in
Explore, a design pass, no Booking.com search in Where to stay, the food words made to matter, a day trip day, and the
desktop city banners as they were before v123.
- Today (screens/travel.js heroCard, option A): "First up" before the trip and "Next" on the day are a compact card,
  a small photo beside the name instead of a full-width one, so Today scrolls less. "Now" is unchanged. The card after
  it reads "After that · 11:30 AM" with the name in bold and its walk and Directions on one row (nextCard).
- Booking reminders follow the trip's clock (lib/bookcore.js): something whose book-by day has gone by and is not
  ticked is no longer "Book by Mar 9" for ever. On To book it moves to "Did you book these?" (folded, with a count),
  out of what's left to book, the next-to-book line and Plan's readiness (W.leftToBook, W.bookByText: "Booked", "Did
  you book it?", "Book now", "Book by …"); the Day tab's badge, Today and the next-step bar use the same words.
- Explore (screens/trip.js useBlock): one "Add to Day N" button per idea; tapping it shows the slots it fits (free
  ones first), and an idea that fits one slot is added at once. Shared trips planned together can use it.
- Design pass, no state logic changed: the stop rows in Plan put what the place is under the row, full width (it was
  squeezed beside the stepper; setup.js .stop-d); the overdue badge and the dark-mode badges have their own colour
  tokens with stronger contrast (--late-*, --in-*, --ok-*); the header gradient ends a deeper warm red (--grad); press
  feedback on the buttons that had none (Explore's Add, the day bag, the route chips, tick boxes); Pack fits a 320px
  phone (its title wraps and shrinks below 360px); tick boxes, small buttons and fields are at least 44px to touch.
- Where to stay has no Booking.com search any more, in Plan or the "Pick a place" sheet (lib/prices.js, setup.js
  stayPanel; the old code is kept out of the app). A stay picked from it before keeps its price, and the price watch
  still asks Booking.com for your nights (W.stayInput). "Also on Booking.com · Expedia" links stay.
- Food you love, rather avoid, anything else (the deep dive found "love" changed no meal): Claude is now asked how
  much each place has of what you love, not only whether it can feed you (lib/eat.js W.eatLike, W.eatLikeAsk; asks.js);
  meals lean to those places (plan.js, a larger bonus), and once the marks arrive the planner's own meal picks for that
  city are made again (W.freshMeals; yours stay); a city with few such places gets a few more asked for (ideas.js
  W.loadLoved). Words decide without Claude too ("pizza" in a place's name or note). A mark from the nightly task made
  for other food words is ignored (nightfood.js); the marks never go into the shared lists of places
  (tools/copy_to_cloud.js), and the nightly task no longer writes them and clears old ones. Plan says what it did:
  "13 places for pizza · 11 of your 24 meals go to them. 6 places kept off your plan for what you'd rather avoid."
  (setup.js eatReport).
- A day trip day (new screens/daytrip.js, second script): at the end of a full day in a place, next to "Make it a
  rest day", "Make it a day trip" opens the places an easy day out from it (from the country's list, within the
  group's day-trip range, each with what it is and about how long it takes) and a box for anywhere else. Picking one
  drops the planner's picks for that day (yours stay) and plans it again there: morning, lunch and afternoon from the
  place's ideas, the evening back near the stay (S.dayTrip by day, plan.js mineTrip; the planner's own day trips keep
  off it, shape.js placeTrips). Undo is offered at once; the link then reads "Undo day trip". A day trip the planner
  chose reads "Change day trip". Not on the arrival or packing day, and a rest day is not a day out.
- Desktop city banners (lib/photos.js, app.css): every photo fills its band again. v123 set a photo with no large copy
  at the side at its own size, fading into purple; you asked for it gone.
- First load stays under 520 KB: lib/nightfood.js and a stop's sheet's styles load with the second script.
- Tests: new suite daytrip; stays (no search; an old pick keeps its price), bookings (the past group), flow (one Add),
  eat (likes, fresh meals, stale marks, the report line) and photos (a small photo fills its band) follow the changes.

## v151

Your three requests from v150, and two more of the code review's ten (suggestions 2 and 10).
- Choosing a country, a city or an airport as you type (lib/typeahead.js, second script): the browser's own list
  showed every country as soon as the box was tapped and sat over the phone's keyboard. Now a short list (at most six,
  each 44px tall) appears only once you type, right under the box and part of the page, so it pushes the page down
  and never covers the keyboard. The best known come first: countries with ideas built in, then the most visited
  (W.countryRank), then the rest; cities by how well known they are, the famous built-in ones first (W.builtIn). One
  tap adds it; arrow keys, Enter and Escape work. The round back-to-top button hides while you type (it sat on the
  list). Plan's country and city boxes, the quick start's.
- "Suggest cities" proposes the famous, well-covered places first (lib/plan.js bestScore): how well known a place is
  counts three times over, what the app knows well counts (ideas built in, its own street map, a long list of
  ideas), and your trip style counts but no longer outweighs how good a place is. Spain for a beach trip was Tarifa
  and Palma; it is now Barcelona and Palma (Madrid and Barcelona for culture). Places with few ideas behind them are
  not suggested when there are enough good ones. A national park, a nature reserve, mountains, a lake or a stretch of
  coast is never suggested as somewhere to stay, nor offered in "I'll choose"'s quick-add buttons (W.dayTrip): those
  are day trips, and Claude now marks them so in its list of a country's places (ideas.js "base"; validate.js). A
  city whose name sounds like scenery stays a place to stay (Salt Lake City by its name, the Gold Coast when Claude's
  list says so); a park never is.
  Countries in trips made before v151 keep the old choice until you suggest again.
- Each account's trips stay with that account (suggestion 2; installable app, lib/cloud.js). Signing out puts your
  trips away on the phone, so the next person to sign in never sees them and never has them copied into their
  account; signing in again brings them back. Trips made without an account go to the first account that signs in.
  The example trip is marked as the example in the saved trip itself (it used to stop counting as the example after a
  reload, and signing in reloads), so a new phone never saves "Italy trip" into your account; it becomes yours the
  moment you change its plan (core.js W.save, sync.js). A trip deleted on another device no longer comes back from a
  phone that still had it: one that was in your account and is not any more is taken off this phone too, or, if it
  is open there, kept on that phone only until you change it. From the re-review before release: if someone used the
  phone without an account in between, the trip you had open comes back into your list whole, with what was not yet
  sent (it came back as a name with nothing behind it); once your trips are put away at sign-out nothing writes them
  back before the page reloads (a save while the sign-out request was slow, or on the way out, left your trip on the
  phone with no owner for the next account to take; window.__WP_AWAY, checked by W.save, sync.js and together.js);
  put-away trips are kept until every one is back; the example is never sent to an account however it got into your
  list (it could after the quick start: sync.js keepCurrent, pushTrip). New suite: accounts (no browser; the bug
  review's shared-phone simulation, test/lib/acctsim.js).
- Safety nets (suggestion 10). The build checks itself: one list sets the order of both scripts, and it stops when
  moving a style rule to app2.css (which loads last) would let it beat a later rule it used to lose to, the fault
  behind v148's button colour (rules in different contexts, plain and touch-screen, are compared too); `node build/bundle.js --check` runs the checks without writing. Errors that were
  dropped unseen in sharing, planning together, the offline copy, the exchange rates and the journal's photo store go
  to the error log (W.caught), and a test holds the number of silent catches to fewer each time.
- A stop's sheet has no "⋯" any more (you found it unnecessary): Directions, then the tickets and Swap, then the facts,
  and at the end, under "Change this stop", the four rarer changes it hid (move to another day, reorder today, leave
  it free, not for us; "Not for us" still asks once). Opening a stop closes the trip menu if it was open behind it.
  Reviews, Photos and Map sit centred on their own row. screens/sheet.js, app.css.
- Tests: review (the boxes, suggested places, the build's checks), cloud (Bob on Ann's phone, a new phone's example, a
  trip deleted on another phone).

## v150

The first of the code review's ten suggestions (evo/v149/agents/ten.md), and small faults from it.
- Privacy (suggestion 3): the list the app leaves for the nightly photo and map checks (wanted/<city>), which anyone
  who can open the app can read, no longer holds where you stay (its pin, a hotel you typed), the date of each place,
  or the day you arrive: only the places' names and the month. A shared trip's viewers and the installable app write
  none. A refused write is not tried again on every redraw. Each city a trip uses is written again without them. (The
  nightly check of a typed hotel's pin no longer has that pin to check.) lib/photos.js.
- One odd answer from Claude cannot jam the app (suggestion 6): an answer in an unexpected shape used to leave its
  place in the queue taken, and after three every list stayed on "Gathering…" until a reload. It now ends with "Try
  again" and is logged. lib/core.js.
- Nothing typed or added is left behind (suggestion 4): the journal line is kept as you type and when the app goes
  to the background with the keyboard up (it was kept only when you tapped out of the box); a photo that finishes
  uploading, and a change taken from someone planning with you, is sent like a change of yours, even minutes after
  your last tap (W.realChange, lib/sync.js). screens/journal.js, lib/together.js.
- A stay you named never leads to the middle of the town (suggestion 5): when its place could not be found (no signal),
  directions to and from it go by its name and town, and it is asked for again (at most every two minutes while a
  screen uses it). One helper turns any place into what Google Maps directions take (W.dirPoint), and travel modes
  are spelled as Google spells them ("walking", not "walk"). lib/core.js, lib/plan.js (W.stayRetry).
- How tiring a day is now counts the walks between stops (it compared "walk" with "walking" and never matched): some
  days read a step fuller. As you chose, the planner judges days as before, so no outing is taken off (planScore).
- Enter on a button in the trip bar does the button's job (it was swallowed).
- New suite: review.
- From your look at v149: no "+ Add" beside the Day · All days · Explore switch (it was noise; Explore's search and
  "Add a place of your own" under the day stay); a place's name on Today's cards is set in the text face at 24px, not
  the poster face at up to 32px, and its line under it stops at three lines.

## v149

The other five changes from the design review, and four faults the code review turned up in the same screens.
- Prepare shows the list first. "0% ready" is one line and a thin bar above the tabs (it was a card with a ring);
  what the autopilot does is behind an (i) beside its one-line status; a booking's deadline is plain words ("Book
  now", "by Mar 9": coral only when it is due within two weeks or overdue), not a pill that read as a button.
  lib/memories.js (W.readyRing), lib/autopilot.js (W.autoLine), app.css.
- A stop's sheet leads with what you do. Right under the name: Directions (the one main button), the tickets or
  the table to book, Swap, and "⋯" for the rest (move to another day, reorder today, leave it free, "Not for us",
  which still asks once). Reviews, Photos and Map are buttons with words. The sheet is its own module in the second
  script, screens/sheet.js; W.openStop asks for it. It moves the keyboard into the sheet and back to what opened it,
  and is not rebuilt when nothing changed. The tickets-or-menu link is one helper, W.stopLink, shared with Today.
- Explore's buttons say what they do: "Add to Day 2:", then a row for each part of the day, "+ Morning · replaces
  Roman Forum…" or "+ Evening · free now". Adding says what happened ("Added to Day 2 afternoon, in place of …")
  with "See day" and Undo (W.undoPoint takes the day). "+ Add" sits beside the Day · All days · Explore switch and
  opens Explore with the search ready.
- Pick a stay without losing your place: "Pick a place" on Today, in Prepare and on the Trip tab opens where to
  stay as a sheet over that screen (the same panel as Plan's: your own booking, the Booking.com search, the
  suggestions); picking one closes it, with Undo. screens/setup.js (stayPanel, W.staySheet).
- Calmer colour: the chosen view in the Day · All days · Explore switch is the raised white one, like Prepare's
  tabs; "Replan" and "Find unused files" are quiet buttons. The gradient is the banner and a screen's main button.
- Fixed, from the code review:
  - "Running late" slipped back stop by stop as the clock passed each stop's old time. The moment you said so is
    kept (S.lateAt, this device), and what had not started then stays moved. screens/today.js (W.lateAdd).
  - On Today, a stop's "Swap" and "Reorder today" did nothing (they need the Day view's cards): they go there first.
  - With no stay picked, some directions started from the middle of the town: Today's first-up and "after that"
    cards, the stop's sheet, and the whole-day route (which now runs from the first stop to the last).
  - A fault while drawing the day could leave every later hop asking Google for its time (W.legWant, now in a
    try/finally).
- Back also closes the stay sheet (lib/back.js). First load: the stop's sheet moved to the second script (513 KB).

## v148

The first five of the ten changes from the design review: the screens you use on the street.
- Today opens on what you do next. While you are at a stop, Now and Next are one card: where you are (until when,
  tickets), then what is next, when to leave ("Leave in 25 min · 22 min walk") and the screen's one main button,
  "Directions to lunch". A real fault went with it: the Now card's Directions ran from the stop you were at to
  itself. Every way there on a live day now starts where you are (no starting point is sent, so Google Maps uses the
  phone's), and "Directions here" is a quiet link. screens/travel.js (nextPart, leaveLine, heroCard).
- Today is shorter. The route (and map) sit right under Now and Next. "Rescue the day" is behind "Change of plans":
  "Running late?" is a question with its three answers in one row under it (+15 min, +30 min, Change of plans). The day bag and the journal are one line each outside their time of day (the
  bag opens until the first stop, the journal after the last; what you open stays open). The kids' corner is a quiet
  row further down, not a banner at the top. On a phone the banner carries the day (city, date, the time, the whole
  route), as on the Trip tab, so the heading that repeated it is gone and the days before and after are at the
  foot. The forecast is one line with a picture of the weather. screens/travel.js (fold, W.goDayN), lib/gmaps.js
  (W.wxLine), screens/trip.js (W.bannerDay).
- The Day view starts with the plan. On the day itself the TODAY box is one line ("Now · Roman Forum until 1:30 ·
  Today ›") that opens Today; stops that are over are dimmed, the one you are at is marked "Now", and the day opens
  scrolled to it (once per visit; holdAt keeps the spot while photos load). "Rome's ideas don't fill this day" moved
  from above the plan into the free row it is about. screens/today.js (W.todayRow), screens/trip.js (dayStops).
- Android's Back button, in the installed app: Back closes what is open (a stop's details, the trips menu, the
  new-trip questions), then returns from a screen you reached by a link (Settings, the kids' corner, Prepare from
  "Tickets today") to the one you came from, and only then leaves the app. Tabs take each other's place and never
  pile up. New lib/back.js (W.backOpen, W.backShut, W.navTo); every change of screen goes through W.navTo. Off inside
  Claude, where the page lives in Claude's own frame. New suite: back.
- One name and one size for "take me there". "Navigate" is from one stop to the next (the Day view's lines, Today's
  route); "Directions" is to one place from where you are (Near you's "Go" is now "Directions"). On a touch screen
  day numbers and row buttons are 44px, and the round icon buttons and pills take a 44px touch without changing
  their look (app.css, "touch sizes"). The back-to-top button is smaller and comes only when you scroll back up, so it
  no longer covers the buttons at the right of each row; tapping the tab you are on also goes to the top.
- Fixed on the way: the banner's route button vanished whenever the banner was redrawn without the day (the cloud's
  status changing); the link is now kept (lib/warm.js). Tonight's "Directions" started from the stay itself.
- Room for all this in the first script: the new-trip questions moved to the second script (screens/quickstart.js;
  W.whenLater in lib/later.js opens them when it has come).

## v147

Street maps in the installable app, hosted in Waypoint's own Supabase project.
- The map packs (83 cities, about 260 MB) are in the project's file storage, a public "maps" folder that only the
  nightly copy can add to, and only while its window is open; a stored pack never changes (each is named by its id in
  the Claude version's file store, and a rebuilt pack has a new id). Migration supabase/migrations/
  20261111195557_map_packs_storage.sql: the folder, its two rules, and maps/<slug> documents in the staging rule.
- The installable app carries the same map engine as the Claude version (build/standalone.js copies vt/: MapLibre, its
  worker, the pack reader and the letters; the service worker keeps them, .wasm included, once fetched). Which cities
  have a map comes from the maps/<slug> documents on the server (signed in); each pack, once seen, is kept on the phone
  (vt/packworker.js, IndexedDB), so a city's map works offline afterwards, as in the Claude version.
- The nightly copy (tools/copy_to_cloud.js) copies the maps collection too: "--need" lists the packs not stored yet,
  the task fetches those from the Claude version's file store (at most 20 a night), and "--packs <dir>" stores them
  and points each document at its stored pack. A document whose pack can't be stored is left for the next night.
- Tests: cloud (the stand-in server serves a pack and a maps document; the installable app finds the city's map and
  decodes the pack from storage), standalone (the engine files are in the build).

## v146

Your list from the third round of reviews, with the layouts you picked (navigate C, Google Maps D3, back to top A).
- Restaurant swap: tapping a suggestion (a card, a row of the longer list, or "Next suggestion") shows it up close
  inside the swap: photo, cuisine, price, distance, how long, the notes, what reviewers love it for, the menu, and
  links. "Add for lunch" puts it in; "Skip" shows the next idea; nothing changes on the plan until Add. "Not for us"
  sits at the foot, apart from Add and Skip. screens/trip.js (swapPeekHtml, swapPeek); the place facts that a stop's
  panel and this close-up share are one set of helpers (placeNotes, placeRev, placeLinks).
- Booking.com search in Where to stay: type an area, a hotel or what you need, and tick filters (family rooms,
  apartments, free cancellation, breakfast, pool, rated 8+). In Claude it searches through your Booking.com
  connection with your nights and everyone's ages, and the places come back with prices and "Stay here"; a hotel's
  name is looked up by name, and a filter searches again. In the installable app it opens Booking.com's own search
  with all of that filled in. lib/prices.js (W.liveStays, W.bookingSearchUrl); new suite stays.
- Near you, on Today: the closest things to do or places to eat (food first at meal times), open now where the hours
  are known, never one you said no to or already planned, each with the walk, Go (directions) and Add (into a free
  part of today, with undo). In the installable app "Use my location" asks the phone where you are (used on the
  phone only, never kept); in Claude, which has no location, it is near where the plan has you. screens/near.js.
- Navigate on each stop (C): the way to each stop is a line between the cards, "Navigate · 19 min", opening Google
  Maps directions from the stop before (from where you are, when no stay is picked). The card no longer repeats the
  time; the way back to your stay is the same kind of line.
- Google Maps under the day's stops (D3): one row of three round buttons, Maps (the whole route), Save as list (the
  day's places as a list in Google Maps, with your connection; it becomes "Open the list") and About times (where
  the times come from). Today and the Day tab share it (W.gmRow); the stacked buttons, the "Make a Google Maps list"
  button and the ↗ are gone.
- Back to the top (A): a round ↑ with a gradient ring in the bottom corner once you have scrolled most of a screen,
  above the tab bar on a phone (lib/warm.js).
- Today's map frames the day's stops in the middle (it kept room on the right for buttons that are no longer over
  the map), and Today and the Day tab each frame their own stops.
- Nights: one calculation (W.nightsAt, lib/times.js) for All days, the stay bar, To book, the budget and live prices.
  All days counted the last place's days as nights (Venice "3 nights" where To book said 2).
- No stay picked yet: "Tonight: no Rome stay picked yet" and "nap back at your stay", no Directions to the city's
  middle and no house pin there (the placeholder read like a real address).
- Two class names that collided: the forecast's temperatures took the stop letter's badge style and stuck out past
  the edge; the plan check's cards took the kids' storybook paper. Both renamed (wx-t, pc-).
- A ticket link three or more places share is no one place's page, so it is cleared (V.oneEach, lib/validate.js); a
  stop's ticket tag is cut at a word ("On the Colosseum…", W.clip).
- The review screenshots' stand-in now uses each place's real spot and ticket price (evo/v141/realnames.js), so the
  pins and prices in them are the real ones.
- The first load stays under its 520 KB budget (519 KB): how ready you are and the trip's memories (the mood row,
  the highlight reel, "one year ago today") move from lib/warm.js to a new lib/memories.js, and Near you
  (screens/near.js) comes with the second script, as do their styles (build/bundle.js LATER and LATER_CSS). The
  Prepare section heading in app.css was two lines, so the stylesheet splitter never saw it; it is one line now.

## v145

- A meal card's time and name are one line of text that wraps between words (v144 put them side by side, so a long
  word could be split: "Sant'Eustach / io Il Caffè"). Two lines at most, as before. look checks every name on the
  day for a word split in two (a hyphen is a fair place to wrap).

## v144

Four of the reviews' suggestions, as you chose them (4A, 6A, 9A + 9C, 10A + 10B).
- Whole names (4A). A place's name runs to two lines instead of being cut to a few letters ("Sant'Eustachio Il
  Caffè", not "Sant'Eustach…"): on the day's meal cards, on All days and on the next-day bar. One rule in app.css
  for the three; a name longer than two lines is still shortened at the end.
- Today's map is open (6A). Where the city has a street map, Today's route shows it above the stops without a tap.
  "Hide map" folds it and the phone remembers; a phone saving data (its data-saver setting) starts folded, since a
  city's map is a few megabytes the first time. (6B, the map beside the day on a big screen, was already there in the
  Claude version for every city of a trip: 83 cities have a map. The installable app has none; see below.)
- Prepare on a phone (9A): five equal tabs, a picture over each name, the counts as badges. "Take along" is no
  longer cut off (on the narrowest phones its name takes two short lines). Three new pictures in lib/icons.js
  (wallet, bag, save). The badges use the accent's own ink, so they read in the dark theme too.
- Prepare on a big screen (9C): To book and Booked keep the left column; the budget sits at the top of the right
  column (the table, the total and "Open the budget ›"), then the booking sites and price watches. One budget
  function (budgetSeg) draws both the Budget tab and this compact copy.
- Flights in the budget (10A + 10B). Flights from home used to count only once booked, or after "Live fares"
  (Expedia); otherwise the total left them out in small print. Now, with no booking and no live fare, Claude is
  asked once for a typical fare each way (half a return booked a few months ahead, the whole group; W.fareGuess in
  lib/prices.js, cached per route, month and group). The flights row and the total include it and say "estimate";
  a card under the table says so too, with "Add what we paid" (the add-a-booking form under Booked, open on a
  flight) and live fares. A booked flight's price replaces its estimate. When no fare is known at all the total
  reads "+ flights" and the card says they are not counted yet.
- Not done, a decision for you: street maps in the installable app. The maps live in Claude's file store, which
  the installable app can't load. Two ways to give it maps are set out in the reply to you.
- Tests: money (the five phone tabs; the fare estimate asked once each way, counted, marked and carded; "Add what
  we paid"; a booked flight replacing its estimate; "+ flights" when nothing is known), desktop (the two columns on
  To book and Booked; the page width with and without a scrollbar), look (whole names), travel (the map open, folded
  and remembered, folded on a data-saving phone and after you hid it). The test stand-in answers the fare question.

## v143

Less above the plan on a phone: the banner carries the day, and shrinks to one row as you scroll.
- Before, on a 390 × 844 phone, the banner, the day strip, two rows of switches, the city's title and the Google Maps
  button all came before the first stop, which began 738 px down: under the tab bar's edge, none in view. It now
  begins about 576 px down, with one to two stops in view, and the logo is where it was, the size it was.
- The banner's last line is the day (phones, the Trip tab's Day view): the city, the date, how full a day, and the
  whole route in Google Maps as a 40 px button. The greeting and the time give way to it there and stay on every
  other screen (All days, Explore, Plan, Today, Prepare) and on a big screen. The day's title block and the wide
  "Open the whole route in Google Maps" button under it are gone from a phone; the heading stays in the page for
  a screen reader, and a day with a photo keeps its photo title.
- One row of switches, on every screen size: Day, All days, Explore. It was two tabs with a second switch (One day /
  All days) under the first; each view is now one tap from any other.
- Scroll, and one slim row stays at the top (44 px): the logo, the city and where in the trip you are ("Rome · Day 2
  of 10"), with the day strip pinned under it. A tap on it goes back to the top. Nothing in the page moves when it
  comes or goes: the banner scrolls away as it always did, and the row is drawn over the page once it has. The
  small logo is the same drawing as the big one (the stylesheet's <use>, not a second copy).
- Where: lib/warm.js (W.topLine writes both lines, the stylesheet shows one; W.pinBar), screens/trip.js
  (W.viewSwitch, W.bannerDay), screens/travel.js (the switch's handler lost its "remember All days" state, which
  one row has no need of).
- Tests: look (the banner's day, the route button, the heading kept for a screen reader, the pinned row, its logo,
  the tap back to the top, the other views), flow (one row of three, each one tap away), desktop (a big screen keeps
  the title and the greeting; nothing pinned). The layout check now treats text hidden for a screen reader by a
  stylesheet rule (a clipped 1 px box) as off screen, as it already did for the .vh class.

## v142

One clock: everything live goes by the time where the trip is.
- The problem. The banner's greeting went by the phone's clock, the time beside it was the destination's, and Today
  ("Now", "Next", "Leave in 25 min", which day is today, "running late") went by the phone's again. On a phone that
  is on the trip's time they agree. On any other they did not: someone following a shared trip from home, a phone
  left on home time, a laptop. From Los Angeles, a family's 10:30 in Rome showed "Good evening", "10:30 AM in Rome",
  and a Today worked out for 1:30 at night on what was, half the day, the wrong date.
- The clock now lives in one place (lib/times.js, moved out of screens/today.js). W.instant() is the moment it is.
  W.now() is the trip's clock: the time of day where the trip is today, which every live reading already used through
  W.now() and W.nowMin(). W.tripShift() is the minutes between the trip's clock and the phone's: 0 for a phone on the
  trip's time, so nothing changes for travellers. Before the trip and after it the clock is the phone's own.
- Where it shows. The banner on the trip: greeting and time from the same clock ("Good morning · 10:30 AM in Rome").
  Before the trip the greeting is yours and the banner adds the time where you are going, as before. When the trip's
  clock is not the phone's, Today and the Today card say whose time it is ("10:30 AM · Rome time").
- Which zone. A country with one zone keeps it. A country with several (the United States, Canada, Mexico, Brazil,
  Australia, Indonesia) had one zone for all of it, so a Los Angeles trip was on New York's; the zone now goes by the
  place's longitude (Hawaii and Alaska told apart by latitude). That is right to within the hour, so a phone within
  the hour of it is taken to be there and its own clock stands. Known limit: someone one zone away from such a
  trip sees their own time, as before.
- The last few readings of the phone's date ("today" for countdowns, booking deadlines, the price watch) go by the
  trip's clock too.
- Tests: a new suite, clock (19 checks): a phone in Rome, the same moment from Los Angeles (same Now and Next word
  for word, "Rome time" shown), the date turning over there first, before and after the trip, and the zones of
  multi-zone countries. A test's pinned time without a zone is the trip's own clock, so the existing suites read
  as before. 47 suites.

## v141

Seven things you asked for, and one structural change they led to.
- Prepare no longer jumps. "Prices in" sat in the header above the tabs on Budget, To book and Booked only, so the
  whole screen moved up when you tapped Pack or Take along (82 px on a phone). It is now the first line of the Budget
  section itself (screens/book.js) and stays in Settings; the header above the tabs is the readiness ring alone and is
  the same height on every tab. The empty stand-in that used to hold its place (.cur-none) is gone, with its styles.
- No sideways shift on a desktop. A long tab has a scrollbar and a short one (Booked, Budget) has none, so the page
  was 15 px wider on some tabs and everything moved left and right as you changed tab. The page now always keeps
  the scrollbar's gutter (html{scrollbar-gutter:stable}, with a mouse only: a phone's scrollbar floats over the
  page and takes no room; browsers without the property show the scrollbar track always). This holds for every screen, not only Prepare.
- Changing how you travel and changing it back gives you the day you had (lib/plan.js). A slower way of getting
  there leaves less of the arrival day, so the planner takes stops off it; the old code then forgot them, the place
  became free for any other day, and choosing the first way again planned the day afresh from what was left. The
  planner now remembers a pick of its own that it had to take off (S.under: the pick, what stands in its place, the
  day), keeps the place reserved, and puts it back the moment the day has room again. It forgets after three days, when
  you or anyone else changed that stop in between, when the place has closed, and it never touches a stop you chose.
- Explore: a place to eat's menu link shows the menu picture the One day view uses (W.menuLink in lib/links.js now
  draws W.icon("menu"), the same as W.menuBtn), not a second magnifying glass.
- Plan, "Where to": the number of days sits midway between − and +. On a desktop the browser drew its own little up
  and down arrows inside the box when the mouse was over it, which pushed the digits about 7 px to the left; the
  arrows and the browser's own padding are off (.stepper input).
- Today's map and the Day tab's map show the lettered pins only (lib/vtmap.js). The dashed line from pin to pin is
  gone: it was a straight line, which is how a plane goes, not how you walk or ride. The order is the letters; each
  hop's real way and time are in the list beside the map.
- Enough places to eat for the days (new: mealGaps in lib/plan.js, W.mealIdeas in lib/ideas.js). A town could list
  twenty places to eat and still leave a dinner as free time. The reason, found while doing this: a meal is only ever
  put near the stop before it (never across town), and nothing asked for places near that day's stops. After each
  planning the app now counts the meals left without a place in every town (a breakfast, a lunch, a dinner; never one
  the clock leaves out, one you freed, or a rest day's), and brings places in for exactly those: first the ones the
  town had set aside that serve such a meal, then one question to Claude that names each meal and the stop it should
  be near ("2 for dinner near Castel Sant'Angelo, no more than about 4 km from it"), with the children's dinner time
  when they eat earlier than the locals, one place to spare per meal, twelve places at most. At most three such
  questions per town for a given stay and lodging; a meal still empty after that says so on its day ("Find more
  ideas", as before). While it is asking, the day says "Finding more…".
- Structure: the question for a list of places to eat was written inside W.loadCity; it is now one function
  (foodAsk) that the first list, "Find more", a longer stay and the meal fill all use, with the names not to repeat
  and the lodging to stay near as shared helpers (namesOf, nearStay). "Is this part of the day unfilled?" was written
  out on the Day screen; it is W.slotShort, used by the screen's note and the planner's count alike.
- Tests: a new suite, meals (22 checks: the question, the fill, places set aside first, three tries and stop, a freed
  meal, a new lodging, a read-only trip); tickets gains the travel change and back (7 checks); desktop measures the
  digits between − and + from a picture, the Prepare tabs' position on all five tabs and the page width with and
  without a scrollbar; money checks the tabs on a phone; look checks the menu picture; travel checks the map draws no
  line. 46 suites.

## v140

Google Maps, through the viewer's own Google Maps connection in Claude (lib/gmaps.js, in the second script). The page
holds no key and cannot reach the internet itself; without the connection every screen works as it did.
- Real times between stops. W.leg (lib/core.js) used to work every hop out from the straight-line distance. It now
  returns Google's walking, transit or driving time when one is known, and W.legEst is the old estimate (the planner
  keeps using it, so the same places still give the same picks; what moves is the day's clock). A hop with no real
  time is asked for only while its day is on show (W.legWant: Today, and the Trip screen's day), plus today and the
  next two days once a trip is two days away or under way; about a dozen requests a day, once. Where Google has no
  transit, or only a connection far slower than the estimate, a close stop is walked and a far one driven ("drive or
  taxi"). Real times are saved with the trip (S.rl), so everyone it is shared with sees the same clock, connection or
  not; they are asked for again after 60 days. Under a day that shows them: whose they are, and Google's own caution
  that its walking routes are in beta.
- The forecast. Today and the Trip screen's day show Google's forecast when the day is inside its ten days (W.wxLine):
  the weather, the chance of rain, the temperature range (°F for a US phone, else °C). With rain likely and the day
  under way, "Rain likely · go indoors" is on the line itself (the same rescue as before, one tap closer). Forecasts
  stay on the device, for 3 hours (today and tomorrow) or 8.
- Explore's search shows Google's listings (five, the basic kind of request) in place of Mapbox's when the connection
  is there, each with its place ID, so its Google Maps link opens that exact listing. Google's line about a place
  and its rating are shown while you search and not kept. An added place keeps its place ID for good and Google's pin
  for 30 days (lib/import.js; never drawn on the app's own street map); after that Claude is asked where it is, as
  for any place without a pin. If Google does not answer, the search is Mapbox's as before.
- A Google Maps link pasted into the search becomes its one place: a long link says the name and pin by itself (no
  connection needed); a short one (maps.app.goo.gl) is read in three requests (the place, its name, its pin).
- "Make a Google Maps list of these places", under "Open the whole route in Google Maps" (Trip's day, Today's route):
  the day's places by name, and the button becomes the link to that list in Google Maps, to save there. A place
  Google only half-recognises is left off and named.
- Settings > Google Maps: how the connection stands, how many requests this device has made today, and a switch.
  Limits: 300 requests a day from a device, 120 by the app itself in one visit; no live-traffic routing, no more than
  five results, no extended details (the kinds Google bills higher). A "no" to Claude's question is remembered for
  a week ("Ask me again" is in Settings).
- The nightly place check no longer needs a Google API key. tools/place_check.py has two new commands: gtodo lists
  what to ask (Google pins due for renewal, then the weakest pins), the task's session asks the Google Maps
  connector and copies the answers into a file, and gapply matches them with the same rules as before. The connector
  gives no types, so what a place is comes from Google's written line about it; a place ID copied by hand is used
  only when it agrees with the feature id in the place's own link (the ID is those two numbers, encoded), which
  catches a miscopied character. The key-based commands (google, refresh) are still in the file.
- Tests: test/suites/gmaps.js (46 checks, with a stand-in for the connector shaped like its real answers);
  tools/test_tools.py covers the new commands. The artifact declares the connector's five tools (compute_routes,
  lookup_weather, search_places, resolve_names, resolve_maps_urls).
Screens: Settings gains the Google Maps card. With the connection off nothing else looks different.

## v139

The one-time speed measurement can save its result. Since v130 it wrote to data/users/<you>/diag/effort, which is not
a document's path (an odd number of parts names a collection): the database refused it, the phone marked the
measurement "failed", and nothing was kept, so low effort was never measured. lib/speedtest.js now saves to
data/users/<you>/diag/d/effort, keeps pins as text (a list inside a list is not something every store keeps), uses a
new key so a phone that had given up tries again, waits for the owner check whether it answers at once or later, and
sends a failure to the error log. It can now run in a test browser when the test asks (window.__WP_SPEEDTEST), and
test/suites/claude.js checks that it measures both settings and saves at a path the database accepts; the first
version never ran under test, which is how the path went unnoticed.

## v138

A tap that a redraw lands on is no longer lost, more types, shorter test waits, three named colours (the audit's T3,
Q3, T2, Q5). No screen looks different.
The test runner named a suite that had passed only on its second run (eat: a tick on Plan went missing when the
machine was busy). Two causes, both real for a person too, if rare. Plan and Prepare were thrown away and rebuilt on
every redraw (innerHTML), so when data arrived between finger down and finger up the chip under the finger was a new
one and the tap went nowhere: screens/setup.js and screens/book.js now draw in place with W.draw (lib/patch.js), as
the trip's screens have since v117. And with motion reduced, a folding section's open or closed state was remembered
only when the browser reported it a moment later, so a redraw in between put the section back as it was: lib/fx.js
now remembers it at the tap, as it already did when sliding. test/suites/eat.js presses a chip, redraws, and
releases (it fails on the old drawing).
Types: 55 more of W's members have real types (329 of 467). The checker compares each with the function it
describes, and turned down four of the first guesses.
Tests: the cloud suite's long fixed waits wait for the thing itself (44 seconds to 22). Fixed waits in all suites
are down from 254 seconds to about 135; what is left is short pauses after a tap.
Colours: the three hand-written colours used most are palette names now, with the same values in both themes
(--on-color for text on a coloured surface, --ok-ink and --ok-bg for the "good / booked / free" pair): 51 uses. 62
other hand-written colours remain (109 uses), most used once or twice.
W.dayTimes was looked at again and left whole: its core is one routine over shared state (the clock moving through
the day), and splitting it would mean passing that state around.

## v137

jsPDF brought up to date, Nunito as one file, and a search card that keeps to its card (the audit's T5 follow-up and P5).
The PDF export loads jsPDF 4.2.1 from cdnjs (2.5.1 before), with its integrity hash (the same file on cdnjs and
jsDelivr); 2.5.1 had a dozen published advisories, 4.2.1 has none, and the dompurify that comes with its package went
from 2.5.9 to 3.4.17 (none either). test/suites/pdf.js runs against it; the two waivers in tools/audit-waivers.json
are gone. MapLibre's stays (its one advisory is in the attribution control, which the map does not use).
Nunito is one variable file for every weight in use (fonts/nunito-latin-wght-normal.woff2, 39 KB, in place of four
files of 16 KB; the extended Latin letters likewise): the first screen makes 7 requests instead of 10, and on the
slow-phone test the last font is in at 1.2 seconds instead of 2.1. The face is declared for weights 400 to 800, so a
heavier weight asked for still draws at 800 as before. The screens are pixel for pixel the same except Explore's
search card: a search box's own width follows the font's measurements, and the card's column could not shrink, so the
box pushed its row to the card's edge (.psearch now has a column that may shrink).
tools/test_tools.py checks the nightly tools' own rules on fixed examples (which place on the map is the one meant,
opening hours, distances, map tiles); the tools suite runs it.

## v136

The database rule for the installable app's nightly paths (the audit's S4); the app itself is unchanged. A signed-in
person may write their own data (data/users/<them>/...), shared trips (shared/...) and photo requests (wanted/...),
and nothing else: photos, places, menus, morefood, links, maps and fx are written only by the nightly copy
(public.docs_write_ok in the insert and update rules; supabase/migrations/20261111035806). Before, anyone invited could
create a document on one of those paths ahead of the copy, and the copy never overwrites a document someone owns. The
test stand-in (test/lib/fake-supabase.js) has the same rule, and test/suites/cloud.js checks it.

## v135

A copy of your trips, a trace for swallowed errors, stricter types, and this changelog (the audit's O3, R3, Q3, Q6).
Settings > "A copy of your trips": Save a copy writes every trip on the device to one file (W.tripsExport in
lib/sync.js: each plan's settings, picks, bookings, checklist and journal notes; photos stay in the app, the file
carries their ids), and Open a saved copy brings trips back from such a file (W.tripsImport: a trip the device already
has is left alone, nothing is overwritten; each trip is checked like a shared one, V.shared, and arrives unshared).
The installable app's database is on Supabase's Free plan, which keeps no automatic backups, so this file is the
backup. test/suites/copy.js.
Errors the app carries on from: eight handlers in app code that swallowed an error now send it to the error log first
(W.caught in lib/errlog.js: ideas as they are written, an answer as it is written, the day bag's times, after a
redraw, sending and listening for a shared trip's changes, the street map's bounds and reload). The other 65 empty
handlers guard storage and optional features, where failing quietly is the point.
Types: 40 more of W's most used members have real types (274 of 467; clock, fmtMin, money, draw, gmapsDir and the
rest), and 12 more files pass the strict null checks (33 of 55). The stricter types found one call that could be made
without a plan (lib/watch.js: a fare needs the plan), now guarded.
The version notes moved from README.md to this file, newest first; README.md keeps how the code is laid out.

## v134

v134: the three largest screen functions split by the part of the screen they draw (the audit's Q1); nothing the app
shows has changed (all suites, and every screen compared with v133 at phone and desktop size). screens/trip.js:
W.renderTrip (920 lines) keeps the frame, the day's header and the map, and calls dayStops (the stops in order, with the
ways between them) and dayIdeas (the ideas list: the Day tab's fold and all of Explore). screens/travel.js: W.renderGo
(392 lines) calls goRoute, goTickets and goTonight. screens/book.js: W.renderBook (415 lines) calls bookedSeg and
budgetSeg. Each new function takes what it needs as arguments and returns HTML. W.dayTimes (lib/times.js, 232 lines)
was left as it is. The island towns were checked against OpenStreetMap (tools/check_towns.js): 236 of 253 within 4 km;
the other 17 (14 further off, 3 not found) were looked at one by one (the search had matched a street, a school or a district's centre) and the app's
coordinates are right, so the table is unchanged.

## v133

v133: the formatter, and nothing else (the audit's Q2). trip/lib and trip/screens were run through Prettier 3.8.1
(.prettierrc.json: 140 columns, double quotes, no trailing commas; npm run format). Lines over 200 characters went from
629 to 93 (what is left is long text in quotes), and the files from 11,370 to 28,306 lines. The built scripts are
byte for byte the same as before (checked with the build stamp fixed), so nothing the app does has changed. Line
numbers quoted in older notes refer to the files before this.

## v132

v132: tests and tools only; the app is unchanged (the audit's T1, T2, T3, T5, R4).
What the tests run: node test/run.js --cov (npm run coverage) collects the browser's own coverage from every suite that
opens the app through test/lib/page.js (test/lib/cov.js), maps the built scripts back to the source files through
their source maps and writes test/out/coverage.md: each file with the share of its built code that ran, and the
longest stretches no test runs. First measurement: 76% (least: the street map engine, the speed measurement, the
install card, the itinerary import, live prices). .github/workflows/coverage.yml runs it every Sunday.
Waits: test/lib/page.js has calm(pg) (an action's work has started and everything is quiet again), started(pg) (a page
just opened has its plan) and until(fn) (an async check is true); they replace the "wait N seconds, then settle" pairs
and the longest fixed waits (about 100 of 254 seconds). The shorter fixed waits remain.
The runner's last line names every suite that passed only on its second run, alone.
Advisories: tools/audit-waivers.json now also waives dompurify (it only comes with jsPDF's package) and maplibre-gl
(GHSA-jrc7-96c5-q579 is in the attribution control, which the app's map does not use: tools/lib_audit.js --self checks
that lib/vtmap.js still draws the map without it).
Island towns: tools/check_towns.js asks OpenStreetMap where each town in window.TI is and lists those more than 4 km
off (.github/workflows/towns.yml, run on demand).

## v131

v131: shared trips locked to their code, and where ideas are kept (the audit's S1 and R1).
A shared trip: everyone admitted to the app's database can read and list its shared documents, so the code alone
protected nothing. lib/sharebox.js stretches the code (PBKDF2, SHA-256, 150,000 rounds) into the document's name, the
names of the documents under it and an AES-GCM key: W.shareBox(code) gives { id, name(label), seal(obj), open(doc) }.
The trip (shared/<id>), its ideas lists (pools/<name>), family's changes (edits/<their id>) and hearts
(hearts/<their id>) are all sealed ({ v: 1, iv, ct, at }; a long list is packed first where the browser can, z: 1); a
listing shows no code, name, traveler, date or place. New codes have 12 characters. A trip shared before v131 sat in the
open under its code: it still opens (W.sharePlain), its owner's app replaces it with the locked copy as soon as it is
open (lockShare, retire in lib/sync.js) and deletes the open one, and whoever has it on screen follows (openShared's
moved). An old short code still works and says it is short. What this does not change: anyone who may write to the
database can still delete a document. test/suites/share.js.
Ideas on the device: lib/ideastore.js keeps every city and country in IndexedDB ("waypoint-ideas", one record each,
written only when that one changed), and the storage entry (waypoint-cache-v2) holds only what the trip on screen uses
(W.cacheSlim), so it no longer grows with every trip. A city or country that is not in memory is looked for there before
Claude is asked (W.kept, from W.loadCity and W.loadCountry). An entry the phone refuses is written again with only this
trip's places, and a trip that does not fit is saved after the ideas are cut down (writeCache in lib/core.js): saving
recovers by itself. With no IndexedDB (some private windows, the offline copy) everything stays in the entry, as
before. Not done: records are never pruned from IndexedDB (it has room; a later clean-up could drop cities unused for
a year). test/suites/kept.js.
Library advisories (the audit's T5): tools/lib_audit.js asks npm about the packages in package.json and OSV about the two
libraries that reach the browser (jsPDF from cdnjs, MapLibre in trip/vt); .github/workflows/audit.yml runs it every
Monday and when a library changes. A finding fails the run unless tools/audit-waivers.json waives that package until a
date (jsPDF 2.5.1 is waived until 15 December 2026: it has published advisories and needs upgrading).

## v130

v130: the first ideas come sooner (the audit's P1 to P3). A city's first lists are taken in as Claude writes them:
W.run(key, prompt, tier, onOk, stream) passes onText to the request, and W.partialList (lib/core.js) reads the places
already complete in the unfinished answer, so a day fills from the first three instead of waiting for the whole list.
The day says "More ideas for <city> are on the way" until both lists are whole; the picks are settled once then
(W.freshPicks), and the follow-up questions (pins, links, eat-fit, fame, indoor) wait for that (W.cityBusy). A stay
whose share is 18 or more asks for 12 of each first and the rest in the background (W.growIdeas). The first lists no
longer ask for booking and menu links: a place from such a list has no bookV (V.spot) and its book and menu stay
undefined (V.food), so the later link check fills them. A country's places are asked for best known first, and the plan
starts on the first eight (each marked top, the record marked part) while the rest is written; they stay first in the
planner's order, and a record still marked part is asked for again. The installable app's server
(supabase/functions/claude, version 5) sends its answer as it is written when asked (stream: true, lines of
"data: {...}": t = more text, then done) and takes an effort setting; lib/cloud.js reads that, and asks once more,
whole, if a streamed answer breaks off. W.EFFORT (effort by kind of request, read by W.askOpts) is empty on purpose:
lib/speedtest.js measures it first, once, on the owner's own device and trip (never under test, never in the
installable app): the same list asked with the usual effort and with low, timed and compared with the ideas already
checked, written to data/users/<id>/diag/effort. The quick starter list (the audit's option 4) is not built.

## v129

v129: data someone else wrote is checked before it is used (the audit's S3, R2, S6, S8). Every link drawn from data
goes through W.safeUrl (lib/validate.js V.web: http or https, nothing else), whoever wrote the data. A shared trip's
plan and ideas, and the nightly links and place lists in the shared database, pass V.shared (plain data only, links
web links or empty, long text and deep nesting cut) and V.pool (lists of named places, pins on Earth or none) before
the app uses them. Share codes are 10 characters from the browser's secure random source (codes of 6 still open). The
PDF library is loaded with an integrity hash, so only the expected file can run. tools/release.sh does a release's
mechanical steps; package.json's version follows the release (0.<N>.0).

## v128

v128: a clean-up, with nothing new to see. lib/core.js (1,030 lines) is now five files: core.js keeps the trip's
state, the helpers and the queue to Claude; towns.js has the destinations and the islands, ideas.js what is asked
about a place and how many ideas are on show, stays.js how long and where to stay, asks.js the smaller questions (the
code moved as it was). Today's route and the route beside the day on a big screen share one set of rows (W.routeHome,
W.routeLeg, W.routeStop in screens/travel.js). Gone: nineteen functions nothing called (among them the loaders for
hidden gems, trip-style ideas and extra breakfast places, without a caller since v122 ended background top-ups) and
the styles of the old Today timeline. The check of the trip's shape (lib/route.js) and the maker of the offline copy
(lib/offcopy.js) come with the second script; the shortest order of places it shared with the planner is in
lib/shape.js. The first script is 381 KB (was 402). The tests run three suites at a time (test/run.js --jobs; the
ones that time things run alone afterwards): a full run takes under 7 minutes instead of 17. The readable sources
published with the app are one file, src/waypoint-source.txt (tools/src_pack.py packs and unpacks it), instead of 108.

## v127

v127: stops by letter, and towns instead of islands. A stop's marker is a small picture of what it is (a cup, a fork,
a temple, a beach: W.kindIcon, lib/icons.js) with a letter tag, on the Day tab, in Today's route and on the map's
pins. Letters go the way Google Maps letters a route: A is where you're staying, the first stop is B (W.stopTag), so
the route opened in Google Maps matches the app. On the Day tab the marker sits at the left, centred in its card, the
photo at the right with the swap button under it in the corner; "Menu" is an icon button.
A destination is a town, never a whole island: you stay somewhere on Crete, not "in Crete". data/data2.js has
window.TI, the well-known islands (about 80, in 35 countries) with their towns and where they are. lib/core.js:
W.countryCities gives towns only (an island in the built-in list or in a list Claude gave gives way to its towns,
which carry the island's built-in ideas); W.isleOf says whether a name is an island; W.isleChoice gives the towns to
choose between; W.findCity still knows an island, marked whole, so a trip made before this keeps working. Claude is
now asked never to list an island, only its towns, each naming the island it is on (isl); areas that are not islands
(the Amalfi Coast, the Algarve) stay as they were. A list cached before this is asked again once:
the new answer only swaps the islands it names for their towns (W.islesInto), so nothing else on a planned trip
shifts. On Plan, typing an island offers its towns and adds nothing until one is chosen; an older stop that is an
island shows its towns, and choosing one puts it in the island's place with its days and lodging (W.isleSwap). Quick
start turns an island back and names its towns. Suggested places keep to one base on an island unless the list would
run short, and then only a town a real journey away (lib/plan.js).

## v126

v126: today's map moves to Today too. Where the city has a street map, the route's header on Today has a Map button
(screens/travel.js, data-gomap): closed at first, it opens the map in place above the stops, with the zoom buttons,
and stays open or closed while the app is open. Explore no longer shows a map. On a big screen the Day view still
has it beside the day.

## v125

v125: where the route lives. The Day tab has one button under its header, at the right: "Open the whole route in
Google Maps" (screens/trip.js, class day-gm). Today's route (from where you're staying to each stop and back, with the
way between each and its directions) moved from Explore to the Today tab, where it takes the place of the plain
timeline (screens/travel.js, class go-route): the nap and the day's travel sit in their places, what has passed is
dimmed and now and next are marked, a stop opens its sheet, and one with no pin links to Google Maps by name. Explore
keeps the search, the street map where the city has one, the free time and the ideas. In the tab bar Today comes
before Prepare.

## v123

v123: one scale, motion, and the kids' corner drawn. app.css has one scale for corners (--r-xs 6, --r-sm 10, --r-md 14,
--r-lg 20, --r-pill), shadows (--sh-1 resting, --lift a card's own, --sh-3 raised, --sh-4 over the page, --sh-brand under
the gradient) and text sizes (--t-micro 11 up to --t-h2 24); every rule uses them (the map library's own rules are left
alone; spacing is not on a scale). Motion, all off under "reduce motion": page and day changes are a short slide (the
3D page turn is gone; a modest phone gets a lighter slide instead of nothing: lib/fx.js fxFlip), controls settle under
the finger, a ticked row glows once, and for a moment after a screen opens (W.fxEnter, class "view-enter" on the page)
the readiness ring fills from empty and a day's photo eases into place; later redraws don't replay it. The kids'
corner (screens/kids.js) is drawn: the logo's night sky behind the greeting, a passport page whose stamps are inked
drawings (the place's name around the rim, the date below, a sign in the middle: a temple for Greece, a dome for Italy,
a boat or the sea for the seaside; the words stay in the button for screen readers), and a treasure map where each
find turns from a numbered spot into a gold coin and the chest opens when all six are found.
Header photos at full size: the photo behind a day's name and each place in All days is shown large, so it needs a
large picture. Stored photos are 720 px (right for lists). A photo record may carry "big", a 1920 px copy of the same
Commons picture (tools/big_photos.py: only for the city itself and the places a trip has on its days, a record with a
large copy is never fetched again, and Commons' "busy" answer means the rest waits for the next run); the installable
app has no stored photos and asks Commons for the size the screen needs (srcset 960/1280/1920; tools/copy_to_cloud.js
drops "big" from its copy). W.cityPhoto prefers a place whose photo can be shown large, and W.heroImg marks one that
can't as "lowres": on a wide screen (761 px up) that photo sits at the right at its own size, fading into the
header's night colours, and is never stretched (app.css). On a phone 720 px fills the header as it is.
A phone is offered the small picture and a wide screen the large one ("sizes" on the header's srcset), and headers
further down All days load as they come near.
No more ideas on show than the stay calls for (W.fitIdeas, lib/core.js): v122 limited what a new city is asked for,
but a city listed before that (60 things to do, 40 places to eat, plus up to 80 nightly restaurants) still showed all
of it. After every planning, each city of the trip keeps W.firstIdeas(days there) of each on show (15, more for a
longer stay), plus what you asked for (pool.showN: "Find more", hidden gems, rainy-day ideas); the rest is set aside in
pool.rest, kept and synced with the list but not shown or planned with. Never set aside: a place on one of the
trip's days (S.picks), a place you added yourself; breakfast keeps its share of the places to eat and the evening
its share of the things to do. "Find more" and a longer stay bring the set-aside ones out first, at once, and ask
Claude only for what is still missing; a pick of another trip found set aside comes back (W.fromRest).
Small things: "Back to…" and "See my trip" use a drawn arrow (W.arrow) that sits on the middle of the capital letters
(the font's own arrow sat low on phones); the dot between the greeting and the place's time is "tl-sep" (as "tl-dot"
it took the booking timeline's styles and showed as a stray blob beside the logo); W.clock and W.sky keep their time
formatters (making one was the slowest part of drawing a day); the phone tab bar is more solid, so the page no longer
reads through it.
v124 (a fix): the page redrew without end. For a place that has closed, the nightly check names a replacement, and
lib/places.js adds it to the list whenever it is not there; v123's limit (W.fitIdeas) then set it aside, the list was
one short again, and the two took turns, each turn a redraw. A replacement is now marked (rp) and never set aside, one
already set aside comes back, and W.fitIdeas stops asking for a redraw after six in a minute for one city, whatever
the cause.

## v122

v122: what Claude is asked first. W.run's queue (lib/core.js) no longer goes in the order things were asked: the city on
screen (the selected day, and today's on a trip) comes first, its main lists (sights, places to eat, breakfast) before
its second lists, then other cities' main lists, then the extras (hidden gems, rainy-day ideas, links, events, costs);
anything you asked for yourself (a search, a replan, the plan check, an address) and the small plan-shaping answers
(time zone, days per place, travel between places) go straight to the front (W.loadPrio). Three at a time inside
Claude, six in the installable app (W.cloud). Each answer takes 20–75 seconds on the server, so a new city's first ideas
now show after the first round instead of waiting behind another city's extras.
Each city starts with 15 things to do and 15 places to eat (W.FIRST_IDEAS; more for a longer stay in this trip, about
four for each day of it up to 30: W.firstIdeas, by the days the trip spends there, never a recommended length; a stay
made longer later fetches only the difference, once: W.growIdeas, pool.askedN), one question each, asked with the group's
interests and food needs; nothing more is fetched in the background (no second lists, hidden gems, style lists,
breakfast or food-needs top-ups, no planner top-ups). More comes only from "Find more" (10 things to do and 8 places to
eat a time, up to W.IDEA_CAP), from asking for another suggestion when none are left, or from "It's raining" (indoor
ideas). A day with a meal, morning or afternoon the first ideas don't fill says so, with a "Find more ideas" button.
Prepare's To book list: with no start date the rows go under how far ahead to book them (Months ahead, Weeks ahead, A few
days ahead) instead of each carrying a "3 mo ahead" tag; same-day rows follow the trip (getting there, where you sleep,
tickets, tables); the day isn't repeated in the line when the row has its "Day N" button, and that button sits with the
others (its class was "go", the Today screen's container, which centred it; now "goto").
The look (v122): the selected tab and day switch, and the main button, wear the header's gradient (--grad); small labels
are the body font in spaced capitals (the handwritten label font is gone); a day and each place in All days open with
the city's photo behind its name (W.cityPhoto: the city's own photo, else the day's first stop with one, else its
best-known sight; W.heroImg); the phone's tab bar is frosted; the journal's moods are drawn faces; ticking, rating and
switching give a light tap on phones that vibrate. The icons are one set, lib/icons.js (W.icon(name, weight, cls), 24
grid): a line in the header's sunset gradient (#wpIg, defined in index.html, its colours --ig-1..3 per theme) with one
small shape filled with it; on colour (the header's sun and moon, a selected tab or switch, a main button, a photo) they
take the text colour and a moon-gold shape. On a phone the tab you are on wears a sunset tile, its icon in cream.

## v121

v121: accounts for the installable version, on Supabase (project "waypoint", fbgubkesrlvtcnbaxuef). lib/cloud.js (copied
into dist/ as cloud.js, not part of the app bundle) gives the same window.claude.use("db" | "user" | "sample") the app
has inside Claude: documents in public.docs (path, parent, owner, data; data/users/<id>/ private, everything else shared
among signed-in people, each person changes only what they wrote), Claude through the Edge Function "claude"
(supabase/functions/claude: checks the sign-in and a daily limit per person, holds the Anthropic key as a secret) and a
sign-in gate (email and password; only emails in public.allowed_emails can make an account; "Use without an account"
keeps the phone-only version). Settings shows the account (W.accountCard). The database is in supabase/migrations.
The nightly copy: the scheduled tasks fill the Claude version's database; a later task copies photos, places, menus,
morefood, links and fx into public.docs with no owner (nobody can change them from the app). It has no secret: through
the Supabase connector it opens a ten-minute window (select public.import_begin(10)), tools/copy_to_cloud.js sends the
exported documents to public.import_staging with the public key (photos re-pointed from the Claude file store to the same
picture on Wikimedia Commons) and prints a fingerprint, and select public.import_finish('<fingerprint>', <count>) copies
them in only if what arrived matches, new or changed documents only. test/suites/cloud.js runs the app against a stand-in
Supabase (test/lib/fake-supabase.js).

## v120

v120: Waypoint on its own, as an installable web app (outside Claude). build/standalone.js turns the same build into
dist/: a full HTML document, the manifest and icons (build/icon/make-icons.js: the wordmark's W with its night scene),
a service worker (sw.js: every file kept at install, the page fresh when online, all of it with no connection) and the
host's settings and headers (vercel.json in the top folder, where Vercel reads it: build commands, a strict content
policy). Live at https://waypoint-livid-three.vercel.app (Vercel project "waypoint", rebuilt from main on every push). window.__WP_STANDALONE switches lib/pwa.js on: the Install card
in Settings, asking the phone to keep its data, and W.needsClaude for the wording of what only the Claude version does.
On its own there is no Claude and no shared database: trips live on the phone, ideas are the ones built into the app
(the country list and the Plan screen say which countries; a day says where they run out), and Gmail, live prices,
sharing, imports, price watches, photo uploads, the plan check and replanning are not offered. test/suites/standalone.js
serves dist/ like the host and checks it installs, works offline and never points to Claude.

## v119

v119: the offline copy, walked through in airplane mode (test/suites/airplane.js). It keeps its own storage (a small
shim at the top of the file: everything in memory under "waypoint-copy|<saved at>", written to the phone only if the
phone allows), so it always opens on the trip inside it, even where a downloaded file gets no storage (it used to open
on the example trip and say "storage full"), and two copies on one phone never mix. Its second script counts as ready
only once it has run (a copy reopened on Prepare used to stop at start-up). In the copy, nothing that needs the network
is offered: no Plan tab or Settings, no New trip or shared trips, no place search, calendar, PDF, live prices or new copy;
Explore and Take along say what needs the live app; the notice says plainly whether changes are kept on this phone.

## v118

v118: two tabs on the trip, Day and Explore; Day holds a One day / All days switch (.dsw, data-vsw "days"/"all"; the
tab remembers All days across a visit to Explore in S.allPref). The storybook is gone (a trip saved on it opens on the
day). Links and marks as pictures (lib/links.js): W.iconLink (photos, map: a plain map sign, not a company's logo);
an idea's row in Explore is just its links (no "checked" mark, no kids mark, no "Not for us": that lives on a stop's
panel, with a red border, and on the swap cards). Photo credits are plain text (the licences ask for the name; a tap never leaves the app).
The street map cannot zoom out past the town it was made for plus the day's stops (vtmap.js area, MapLibre maxBounds).
Prepare on a wide screen keeps the tabs in one place on every tab (an empty .cur-none holds the currency picker's cell).

## v117

v117: a screen is no longer thrown away and rebuilt on every change. lib/patch.js W.draw(el, html, sig): the same HTML
as last time touches nothing; the same screen (the same day, All days, Today) with different HTML is edited in place,
node by node, so pictures, the street map inside .vt-slot, the focus, a row's scroll position and what is being typed
all stay; another day or view is drawn afresh as before. The page afterwards is exactly the new HTML (test/suites/draw.js
compares it with a full rebuild after each change). A listener put on a drawn node must be put once (see _edges in
screens/trip.js), since the node now outlives the redraw.
Two things ask Claude about the plan, both in the second script and both only when you press the button.
"Check my plan" (lib/review.js; All days and the trip menu): W.reviewFacts is the whole plan as Claude is shown it (each
day's stops with times, indoor or not, effort, distance from the lodging, opening hours and closing days from the plan's
own data, naps, tickets, travel days; ages, no names, nothing else personal); the answer is checked (a day outside the
trip, an entry with no text, an unknown kind are dropped or defused; everything is shown as text) and kept on this phone
with a fingerprint of the plan (localStorage "waypoint-review|<trip>"), so the card says when the plan has changed since.
It only reads: nothing in the plan changes. "Replan from a sentence" (lib/replan.js; Today, under the one-tap rescues):
Claude gets the sentence, the time, and the stops still to come, each with the same other options "Swap" would show, and
answers keep, free or use per stop; W.rescueApply (lib/plan.js) checks every action again (nothing started or booked, only
a place on that stop's own list, not one planned elsewhere) and shares the rescues' Undo.
The itinerary import (lib/import.js) moved to the second script: the first script
went from 371 to 357 KB. The built-in destination data, the planner and Travel mode stay: the first screen needs them.

## v116

v116: the blank boxes on the street map came from one shared empty buffer in vtmap.js (the engine hands every answer to
its worker, which empties it on this side; the second "nothing here" then failed, and a tile whose names needed such a
letter range failed with it): every "nothing here" is now a new buffer. Two of your devices changing one trip are joined
setting by setting and slot by slot (sync.js merge3, against the state the two last agreed on); the same one changed on
both goes to the later save. In the week before a trip the app says to save an offline copy until one of this plan exists
(offline.js copyNote; the app itself cannot open without a connection, it lives inside Claude). lib/eat.js (food needs)
and lib/links.js (menu, ticket, flight and ferry links) were split out of core.js and trip.js; both are null-safe.

## Earlier notes (v115 and before)

Keeping your changes (v115): leaving the page sends what's waiting (sync.js flush; the pause before a write is 1.5 s);
another device's version never replaces journal changes this one hasn't sent (mergeJournal: photos from both, both
notes); a save this device refuses (storage full) shows "Phone storage full" in the banner and goes to the error log,
and nothing is cleared; an offline copy says it is for reading. Street maps: a pack is framed on its town (build.py
NEAR_KM; day trips get a little detail but don't stretch it), packs framed wider than about 25 km are rebuilt by the
nightly helper and don't serve other cities meanwhile (vtindex.js W.vtFor), and only the latest request makes a map.
Simple view (core.js: W.simple, localStorage "waypoint-simple", so this phone only and in shared trips too; the switch is
in the trip menu and Settings) draws no place photo (W.picture) and no street map, and html.simple hides descriptions,
the greeting, the kids' banner and photo tips; times, places, walks, directions, what to book and warnings stay.
The first render happens while app.js is still running (the end of screens/trip.js), so lib/later.js comes right after
the error log: any screen may ask for the second script on that very first draw (v108 fixed Explore and Prepare, which
broke on first open when it came last). Each module starts inside its own try (build/bundle.js): one that throws while
starting is logged ([boot] in the console, the phone's error log) and the rest of the app still starts.
test/suites/firstview.js opens the app on every screen.
