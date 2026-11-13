# Waypoint — how the code is laid out

One page. `index.html` is the markup; the code is plain files under data/, lib/ and screens/, joined and minified into
`app.js` (and app.css into `app.min.css` and `app2.css`, and with desk.css into `app.desk.css` for wide windows) by `build/bundle.js`. All code shares one namespace, `window.W`; the order in
`build/bundle.js` is the dependency order. `node test/run.js` builds first. The screens a first open never needs (Plan,
drawing the street map, the Prepare screen, live prices and price watch, the booking autopilot, planning together, place search in Explore, the
the day bag, family, settings, the kids' corner, the recap, the packing list: LATER in build/bundle.js) go into a second script, `app2.js`, which lib/later.js loads once the first screen has painted (on idle time, or at once when you open one
of them, with "Loading…" for the moment it takes); W.needLater() says whether it has arrived. Their styles go into
`app2.css`, which comes with it (a rule moves only when it sits in one of those screens' sections of app.css and none of
its class names appears in the first script or index.html; build/bundle.js splitCss), and the screens count as ready when
both have come. The street map is in two: lib/vtindex.js (first script: which cities have a pack, the map's state, so
the first screen holds the map's place) and lib/vtmap.js (second: packs, the engine, the look, pins). The one map moves
into each redrawn screen, and a WebGL picture that moves is blank (black) until it draws again, so it is asked to redraw
when moved, resized (a ResizeObserver) or shown again. Touch-first phones use two fingers on the map (the page scrolls
with one); with a mouse or trackpad the wheel zooms and dragging moves it. The postcards and
greetings (lib/warm.js) stay in the first script: they are on the first screen, and arriving later would move it.
How ready you are and the trip's memories (lib/memories.js), Near you on Today (screens/near.js) and the questions
for a new trip (screens/quickstart.js) come with the second: none is on a first screen before the second script is
in (W.whenLater runs a step once it is: the very first open asks its three questions that way).
The offline copy carries both scripts and both stylesheets.

**The desktop workspace (v153).** On a window 1024px wide or more the app is panes: a rail (screens/rail.js), the
screen you are on, and the street map beside the days (lib/deskmap.js); lib/desk.js holds the workspace's own state
(which panes, how wide: per device, localStorage "waypoint-ws") and its shell. Three layers stay apart: the trip's
state is W.S as ever (the workspace keeps none of it, so a window made narrow and wide again loses nothing); the
screens draw into the middle pane exactly as they draw on a phone or a tablet, asking only W.desk() (is the workspace
on) and W.paneW() (how wide is my pane) where a phone would ask the window; the map pane shows what the screens
publish (W.deskPts, W.deskIdeas) and ties a card to its pin by the slot's key; there each stop keeps its own pin on its
own spot at every zoom (lib/vtmap.js spotGroups; a phone's small map still lets close stops share a pin), and nothing
eases a pin's position (the map moves it every frame). Plan stands in two columns that stack on their own (setup.js
.su-cols), Prepare in a wide column for To book and Pack, whose lists flow into columns of their own, beside a side
column (book.js .bv-main, .bv-aside). The styles: a wide window loads
`app.desk.css` in place of the two phone stylesheets (lib/later.js). It is the whole of app.css with every @media
width rule written again as a container query on the pane, `.wrap` (build/bundle.js deskCss: the original, stopped at
1023px when it is a min-width rule, then `@media (min-width:1024px){@container ws (...){...}}`; rules for the header
and the sheets, which sit outside the pane, are left as they are), then `desk.css`. So one set of rules lays a screen
out in a 440px pane, a 1200px pane or a phone, and a new width rule in app.css needs nothing more to work on the
desktop. The middle pane scrolls with the window (the rail and the map are fixed), so everything that scrolls the
page works unchanged. A stop's sheet, the stay and the day trip are inspectors there (the same elements, docked by
desk.css; aria-modal false). screens/palette.js is the keyboard (Ctrl/Cmd+K, [ and ]). Below 1024px none of it runs
and app.desk.css is never fetched.
Travel mode stays in the first script on purpose: on the trip it is the first screen, often on a weak signal. What the
first screen reads from Prepare (the book-by checklist, which booking belongs to a stop) is lib/bookcore.js (the budget
itself and the "Prices in" picker, which only Prepare and Settings draw, are lib/budget.js, in the second script),
with W.money and "Prices in": each phone shows costs as listed or all in one currency (localStorage "waypoint-cur"),
converted at the European Central Bank's rates in fx/latest (refreshed nightly) and marked "≈" (W.priceText converts
prices written in text, like "€15, book ahead"; a currency with no rate stays as listed); Prepare's Budget and Settings offer it.
What changed in each version is in CHANGELOG.md (newest first); this file says how the code is laid out.

```
index.html        markup (header, tabs, one <main> per view); loads app.js and app.min.css (built; app2.js and app2.css follow)
app.css           the stylesheet, grouped by screen: fonts, foundations, header, Setup, My trip, a stop, storybook,
                  Explore, Bookings, Today, settings, motion
fonts/            Plus Jakarta Sans (the text and headings), Instrument Serif (place names and the biggest titles),
                  JetBrains Mono (the budget's amounts) and Dela Gothic One (the logo) as woff2, served by the app itself
                  (Latin; extended Latin letters in a separate file the browser fetches only when a label needs them).
                  Colours are tokens at the top of app.css: one per kind of thing (food, sights, getting around, pace),
                  and --primary / --on-primary for the main colour (main buttons, the tab and the day you're on)
data/             built-in destinations (data1: Europe, data2: the rest, plus airports)
lib/              the shared library
  core.js         state, caches, helpers and the queue to Claude. Three ways to say something happened: W.changed
                  (the trip or its data changed: re-plan, save, redraw now), W.arrived (an answer came: re-plan,
                  redrawn once per burst of answers) and W.redraw (only how a screen looks changed, as photos and the
                  street map coming or going: no re-plan, redrawn once per burst). What is asked lives in towns.js (destinations, always
                  towns, never whole islands), ideas.js (things to do, places to eat, how many are on show), stays.js
                  (how long, and Claude's picks of where to stay; Booking.com's real places for your nights come first when
                  the connection answers: prices.js W.liveLodge) and asks.js (beaches, getting between stops, food needs, events, costs,
                  the time zone, addresses). In ideas.js: "Find more" asks for 10 more things to do (at
                  least 3 for the evening) and 8 more places to eat, and stops offering once a city has 60 things to do
                  and 40 places to eat (W.IDEA_CAP, W.ideasFull): past that the planner has plenty and the nightly checks
                  and photos keep up. A city's list keeps a fixed order whichever answer comes in first (the planner
                  favors a list's first places): the headline half, the other half, "more" pages, trip-style ideas,
                  hidden gems, rainy-day places (RANK in merge)
  errlog.js       what goes wrong on a real phone: uncaught errors and unhandled promise failures (not a connection you
                  didn't allow), at most 40 different ones a day, a repeat only counted, written every 15 seconds to your
                  own private corner of the database, data/users/<you>/errlog/d/<YYYY-MM-DD> ({items: [{msg, at, stack,
                  view, tv, build, ua, w, on, n}], updated}). Nothing personal: the message, where in the code, which
                  screen, the build, the browser and the screen width. Read it with ArtifactData get on that path.
  later.js        loads app2.js (above); loaded right after errlog.js. Keeps the taps that land before it has come
                  and hands them to its click handlers (W.onClickLater). Also: whether the desktop workspace is on
                  (W.desk, W.paneW) and its stylesheet, app.desk.css, fetched only by a wide window
  desk.js         (second script) the desktop workspace's state and shell: panes, the handle, the pane's scroll bar,
                  its buttons (data-ws), what a card carries there (quick actions, the day's line)
  deskmap.js      (second script) the workspace's map pane: pins (no lines between them), Explore's ideas, the tie
                  between a card and its pin (a way in the list lights the two pins it joins), the route as a list
                  where there is no street map
  csv.js          (second script) W.saveFile, the one way a file leaves the app, and the itinerary as CSV
  typeahead.js    (second script) a country, city or airport box: a short list of matches under the box once you
                  type, the best known first (W.countryRank, W.builtIn); part of the page, never over the keyboard
  back.js         the Back button in the installed app: what opens on top of the screen is one entry in the browser's
                  history (W.backOpen; closing it yourself takes the entry out, W.backShut), a screen reached by a link is
                  one too (W.navTo with step) and tabs replace the current one, so Back closes, then steps back, then
                  leaves. Off inside Claude (W.navTo only keeps the address in step there)
  classify.js     what a place is (kind, how long, how tiring, indoors, which parts of the day) — read by the planner,
                  the clock and the pictures
  validate.js     the one door for everything Claude sends back (W.V): names, pins near the city they were asked for
                  (a pin on another continent or at 0,0 is cleared, the place kept), tags, ratings, kid scores, times of
                  day, meals, hours, beach facts, money, time zones; links through the own-site rule. Loaded first.
                  (The fields and the checks on data someone else wrote are here; the shapes of Claude's answers are
                  in answers.js.)
  answers.js      the rest of that door, in the second script: the shapes the lists are made of (a thing to do, a
                  place to eat, a city, a stay, a journey), the own-site rule for links (W.bookUrl) and reading a list
                  out of an answer still being written. In the "ask" piece and in the second script, both.
  photos.js       real photos (from the nightly finder) and the credit line; a place with no photo shows no picture.
                  A city's photo fills its header band at every width (the large copy where there is one)
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
  times.js        the clock for each day: starts, ends, the nap, travel days; how tiring a day is. A travel day with a
                  booked ticket that has a time (from Gmail, or added by hand under Prepare > Booked with its times)
                  follows it: you leave in time for it (a flight's check-in, a ferry's boarding), lunch is in the town
                  you leave when it goes after lunchtime, the morning is free there before a late departure, and the
                  day picks up from the arrival. Without a ticket, the journey's length is Rome2Rio's real time for the
                  way you go once you've tapped "Check real journey times" on the journey card (W.checkRoutes, your
                  Rome2Rio connector, get-routes), else Claude's estimate, else a guess from the distance ("rough")
  daybag.js       (second script) Today's day bag: what to take out for the day, read off its stops (a beach:
                  swimsuits and sunscreen; a church: shoulders and knees covered; a market: cash; a boat: a layer and
                  something for seasickness; a hike: shoes and water; a travel day: tickets in one pocket and snacks),
                  each line naming the stop that asked; ticks in S.bag by day. While the trip is on and Today is open
                  the screen is kept on (the screen wake lock, asked for again when the page comes back, let go on any
                  other view within 5 s); the switch under the bag is per phone (localStorage "waypoint-awake"), and
                  a browser that refuses says so there
  nightfood.js    nightly restaurants and menus: a scheduled task (3:37 AM Pacific) finds a few more real places to eat
                  for the trip cities (web-checked, fitting the trip's food needs, read from the owner's own trips) into
                  morefood/<city>, which join the city's list (validated, never twice); it reads the planned restaurants'
                  menus from their own websites into menus/<city> (dishes and prices as written, kids' dishes, a note,
                  the page and date), shown in a meal's panel ("Menu" on a planned meal opens it there), with a link to
                  its menu photos on Google Maps (Google's photos can't be stored or shown without its key, which never
                  goes in the page); it also refreshes the exchange rates (fx/latest, the ECB's)
  holidays.js     public holidays and festivals on the trip's days. National holidays are worked out in the app for
                  Spain, Italy, Greece, France, Portugal, the UK, Ireland, Germany, Austria, the Netherlands, Croatia,
                  Iceland, Mexico, Costa Rica, Japan, Thailand and the US (Easter and Orthodox Easter, "the last Monday
                  of May", Japan's equinoxes and substitute days); regional ones, national ones elsewhere and festivals
                  come from Claude per city for the dates of the stay (W.loadEvents, cached in W.C.events, answers
                  outside the stay dropped) and say so. On a public holiday a place that closes on Sundays is planned
                  as closed (where that holds: not in Japan, Thailand or the US); the day's heading says what the
                  holiday or festival is
  shape.js        the trip as a whole: nights per base, day trips instead of hotel moves, the way between bases,
                  what the group (toddlers, grandparents) can take
  rules.js        (second script) the planner's promises as code: W.checkPlan(P) reads a finished plan and returns
                  every place it breaks one of the owner's nine rules (a full day or a stated reason, days that fit the
                  clock, a real place once, one area a day, no train rides, open when you are there, naps and
                  grandparents, real names only, what you chose by hand stays), each with its day, slot and rule.
                  W.checkPlan.table() in the console checks the trip on screen. The planner (plan.js) keeps the rules
                  by construction: what you chose or booked is put back first on the whole trip; stops that share a
                  town or lie close share one map of what is planned; one check of a day (dayBads) is what every
                  pass repairs against; and each empty slot says why (slot.why: journey, light, late, yours, none;
                  W.WHY has the sentences). test/suites/fuzz.js plans seeded random trips and reads each with it.
  planacts.js     (second script) what changes a plan on request: "not for us", another suggestion, an idea put
                  on the day, the rescues of the rest of today and their undo (it uses the planner through W.planX)
  plan.js         which cities, how many days each, what to do each day (the chooser and its shape rules; a country
                  suggested from v151 on starts from the best known places, bestScore, and never stays in a park or on
                  a coast, W.dayTrip). A city keeps
                  its first ideas until you tap "Find more"; two things grow them unasked: a stay made longer
                  (W.growIdeas) and a meal the finished plan leaves without a place (mealGaps counts them per town on
                  P.gaps, each with the stop it should be near; W.mealIdeas in ideas.js brings places in for exactly
                  those: the ones set aside first, then one question to Claude, three per town at most for a stay and
                  lodging). A pick of the planner's own that a day had to give up (a slower way there leaves less of
                  the day) is remembered in S.under and put back when the day has room again, so changing how you
                  travel and changing it back gives the day you had; forgotten after three days or once anyone
                  changed that stop. Above the
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
                  "Not for us" (a thumbs-down on the swap panel, each swap card and list row, Explore's ideas and the
                  stop's menu: W.sayNo) puts the place in S.nope ("<country>|<city>|<place key>": name, the city being
                  the one whose list it came from, so a day trip's town). The planner counts those as taken ("~no",
                  like an earlier stop's place: a place you then put on a day yourself still stays, and W.useIdea
                  takes it off the list), the slot that had it gets a new suggestion, the options and Explore leave it
                  out, and Explore lists them at the end with "Bring back". Undo works as for any change.
                  Food needs (Plan, step 3 "What do you eat?", before Where to?): S.eat = {al: allergies, di: diets, love,
                  avoid, note}. The allergy and diet lists fold to one line each showing what's picked (folded unless
                  you left one open: S.eatOpen). Every request for places to eat carries them and asks how each place fits (fit good /
                  ok / poor and a line on what they can have); places already listed are checked once per set of needs
                  (W.loadEatFit, tied to them by W.eatSig) and a few that fit are added; a poor fit is never planned
                  (one you chose stays), a good one is a little ahead; a meal's notes say what you can have and which
                  allergy to tell the staff about; Explore marks good and poor fits.
  sync.js         saved and shared trips. Your own devices' copies of a trip are joined by the time of each change:
                  the trip carries S.ct, a stamp (time + device) for each setting and each entry of the per-slot and
                  per-place maps that a person changed; taking something away keeps its stamp. Two copies are joined
                  path by path, newer stamp first (join), so any number of devices end with the same trip whatever
                  order their saves arrive in. Stamps are written at the save that made the change and kept with the
                  trip on the phone, so offline changes survive the app closing. The planner's own picks are never
                  stamped (W.planWrote says which it wrote). A document from before v177 (no sv: 2) is read as
                  "changed when it was written". test/suites/devices.js runs 2-4 simulated devices against it.
  together.js     planning together: when you share a trip and tick "They can change the plan too", the person you
                  shared with can swap stops, set rest days, leave time free, change how you travel between places and
                  say "not for us" to a place.
                  Each of them writes their own list of changes (shared/<code>/edits/<their id>), one entry per thing
                  changed with its time; your app takes every change newer than the last it took from them (unless you
                  changed the same thing after them), logs who changed what (the share box, their bar), saves it and
                  shares it back (shared/<code> carries what was taken, coSeen, and the log). Only what a person does
                  counts (not the planner filling a day on its own), and everything read from their list is checked
                  first. Places to stay, dates, bookings and the route stay yours. They need edit access to the page.
                  The shared copy says which picks a person made (S.mine), so a place someone chose stands on every
                  phone, also where the planner wouldn't have picked it.
  route.js        (second script) trip shape check (and its one-tap fixes)   import.js  paste an itinerary   prices.js  live prices (Where to stay's Booking.com places, v175; no other-site links since v177)
  watch.js        price watches   sync.js  saved and shared trips   fx.js  motion   vtindex.js/vtmap.js  the street map (cities with a map pack)
  gmaps.js        (second script) Google Maps through the viewer's own connection: real times between stops (kept
                  with the trip as S.rl and read by W.leg in core.js; asked only for the day on show, W.legWant),
                  the forecast (W.wxLine), Google's listings for the search (W.gmSearch), a place from a pasted link
                  (W.gmFromLink), a day's places as a Google Maps list (W.gmListHtml), the Settings card (W.gmCard).
                  Basic requests only; 300 a day from a device. Without the connection nothing changes.
  search.js       find any place and put it on the day: the city's own ideas, Google's listings when the viewer has a
                  Google Maps connection (without it, a line says how to add it; Mapbox was taken out in v177) and
                  Claude (marked "Suggested by Claude" until the nightly
                  check confirms it), merged into one list; a Google Maps search for the same words is one link away.
                  An added place joins the city's list as your own (S.imported, with the trip) and goes in the part of
                  the day you pick. The page can't reach the internet itself: the map comes through the connection.
  sharebox.js     a shared trip's documents, named and sealed from its code (W.shareBox, W.sharePlain)
  ideastore.js    ideas in IndexedDB, one record a place; the storage entry keeps this trip's only (W.kept, W.cacheSlim)
  speedtest.js    one measurement, once, for the artifact's owner: is a list asked with low effort faster and as good?
                  (second script; writes data/users/<id>/diag/effort; W.EFFORT stays empty until that is read)
  offline.js      the trip without a signal: the photo index and photos kept on the phone (IndexedDB), map packs
                  warmed into the worker's cache, the offline note in Travel mode, and the "offline copy" (one HTML
                  file with the app, the trip and its photos inside, opened from the phone's files; made by
                  offcopy.js, in the second script with Prepare's Take along blocks). Both keep the photo
                  of every idea in the trip's cities, not only the planned stops (Explore, the swap choices and a stop's
                  panel show them): planned stops first, six at a time, up to 60 MB in the copy. Street
                  maps need a connection in the copy. Prepare > Take
                  along has "Before you leave": one button that saves the whole trip, with a row per place (street map
                  saved or not, photos for how many of its stops) and the size to expect, so it can be done on Wi-Fi
  packing.js      the packing list and the before-you-go list, read off the plan (who is going, how you travel, what
                  the days hold, the season, the plugs); ticks, removals and your own items stay with the trip
  warm.js         the warm touches: the family by name (typed in Plan; "Great for Mila & Leo", "Easy for Joe", a kid's
                  pick), the banner's greeting and the time where you're going (one gradient at every hour),
                  milestones that cheer once (with confetti, never under reduced motion), friendlier ticks, and the
                  back-to-top button
  memories.js     (second script) how ready you are on Prepare, the recap (the whole trip on one page) and its highlight
                  reel and "one year ago today"
  autopilot.js    the book-by list kept for the morning helper (reads your inbox, writes calendar reminders, never books),
                  what it found, and the deadline timeline on Bookings. Both live in your private corner of the database:
                  data/users/<you>/bookby/t/<trip> and data/users/<you>/autopilot/t/<trip> (a document's path has an
                  even number of parts; the test database refuses any other path, as the real one does)
  The header is one banner: the wordmark, and the trip (its name opens your trips; under it a countdown that
  becomes "Day 4 of 20" on the trip), drawn by sync.js (W.countdown); on wide screens the tabs sit in it too.
  On a phone's Trip screen (Day and Explore) the day's photo is behind that banner (lib/photos.js W.topPhoto, v174):
  the day has no header of its own and starts right under Day · Explore. A wide screen keeps the day's photo header.
screens/          one file per screen. The tabs are Plan (setup.js), Trip (trip.js, also the app controller: a labelled
                  switch for Day · Explore. Explore: search any place, today's route (each stop with the
                  walk, transit or drive between them and its directions, and one button that opens the whole day in
                  Google Maps, unpinned stops by name), the street map from the city's map pack (every city in a trip has one; the nightly helper builds packs for
                  new ones, a few a night; tapping a pin opens it in Google Maps; never a sketch or a map picture), the free parts of the day with three picks
                  each, and every idea under the stop of today it is nearest to. On a big screen the Day view shows the
                  street map beside the day where there is one, otherwise today's route. Explore on a big screen puts
                  the search across the top, the route and map on the right below. The
                  Day · Explore switch runs the full width in two equal parts. A Google map can't be shown
                  in the page (it may only load from its own server, and Google's terms don't allow keeping its map
                  pictures), so Google Maps is always one tap away instead. The storybook opens from the trip menu; "Check my plan" sits at
                  the end of Plan and in the trip menu), Prepare (book.js: To book · Booked · Budget ·
                  Pack · Take along) and Today (travel.js: Travel mode, also the storybook; near.js: Near you, the
                  closest ideas to your phone's location or to where the plan has you, with Go and Add; travel.js also
                  draws the Google Maps row, W.gmRow: Maps, Save as list, About times, shared with the Day tab). On the
                  Day tab the way to each stop is a "Navigate" line between the cards ("Navigate" is always from one
                  stop to the next, "Directions" to one place from where you are). On the day itself the Day tab has
                  one line for what is on now (today.js, W.todayRow), dims what is over and opens at the stop you are
                  at; Today shows Now and Next in one card with the way to what is next as its one main button, the
                  route under it, and the day bag folded to a line outside its time of day. flow.js has
                  the next-step bar and the day buttons (what is drawn); flowacts.js (second script) what a tap then does:
                  the next step's buttons, undo, drag or lift to reorder. trip.js draws a day and changes day or view;
                  tripacts.js (second script) has the swap under a stop, a place's details and the screen's other
                  buttons (the halves share W.tripX). A tap made before the second script is kept and done when it
                  arrives (W.onClickLater, lib/later.js; test/suites/early.js); sheet.js (second script) is a stop's sheet (Directions,
                  tickets and Swap first, then the facts, then the rarer changes; W.moveStop, the one way a stop goes to another
                  day); dayline.js (second script) is a day in a line (its headline and effort bars, for the rail); rail.js and
                  palette.js (second script) are the desktop workspace's rail and keyboard; daytrip.js (second script) is "Make it a day
                  trip": the places an easy day out from a day's town, or any other, and the day planned again there
                  (S.dayTrip); setup.js also draws where to stay as a sheet over any
                  screen (W.staySheet); quickstart.js (second script) the three questions for a
                  new trip (shown on the very first open; a stop's sheet keeps
                  "Leave free" and "Not for us" at its end, and "Not for us" asks once); family;
                  settings.js is "Import a plan", the backup copy and Google Maps (sharing lives in the trip menu); kids.js is "For the kids"
                  (from the trip menu and Today): today's outings in big photo cards with a heart per kid, a passport
                  that stamps each place, and a treasure hunt per town (ticks kept by the find's words, the list kept from the first tick)
vt/              street-map data: the detailed packs live in the asset store (maps/<city> in the
                  database lists them), built nightly by tools/build.py and pack2json.py. A pack stays under 4 MB
                  (PACK_MAX_MB): the closest zoom levels are dropped farthest from the town first, never within 0.8 km
                  of it or of a place on its list; a city's wider area is still drawn from the coarser levels. Where a
                  detailed tile is drawn, a land-coloured cover hides the coarse map under it; the cover follows the
                  detailed tiles that actually loaded (a tile that fails leaves the coarse map, never a blank box), a
                  failed tile is decoded up to three times and asked for again, and map errors go to the error log. vt/ keeps the engine, the
                  pack worker (packworker.js: downloads and decodes packs off the main thread, caches them in IndexedDB)
                  and the glyphs (glyphs.wasm: everyday letters; glyphs-ext.wasm: extended Latin, Greek, Cyrillic, on
                  demand; split by tools/glyphsplit.py). A pack is laid out town centre first ("lay": 2, tools/pack2json.py: the
                  tiles of the screen the map opens at, then the streets around where you stay, then the rest) and cut
                  into parts, the first small; the worker reads the parts in order as they stream, so the map draws
                  after the first part and the rest arrives behind it (lib/vtmap.js `ready`: a tile waits for its bytes).
                  Parts carry the bytes in basE91 inside JSON (23% over the bytes, base64 33%); older base64 parts and
                  packs still read as before, and the nightly task rebuilds a few older ones a night (RELAY_MAX). The installable app has the same engine (build/standalone.js
                  copies vt/); its packs are in the Supabase project's file storage (the public "maps" folder) and its
                  list in the maps/<city> documents there, both copied nightly by tools/copy_to_cloud.js
```

Tests: `node test/run.js` (see test/run.js for the suites; `perf` records startup requests and render times). The nightly photo finder and its judge live in `tools/`.

Error watch: a scheduled task every evening (9:41 PM Pacific) reads the phone's error log (data/users/me/errlog/d) and
  sends a phone notification listing any error from the last 24 hours (screen, message, count, build, phone); read only.

Checks (node test/run.js, from the folder above trip/)
  types         TypeScript reads the plain JavaScript (checkJs, noEmit) against types/waypoint.d.ts, the shapes that
                travel between files (Spot, Food, Pool, TripState, Plan, Day, PlaceRecord, the W object ...). Every file
                passes the base check; the files in tsconfig.strict.json also pass strictNullChecks, and a file that
                becomes null-safe is added there and never removed. A new member on W must be declared.
  a11y          axe-core (WCAG 2.0/2.1 A and AA) over every screen in light and dark: no violations. Text colors have
                their own tokens (--muted, --note-text, --food-text) so a fill color can stay bright while text passes.
  validate      the door above, fed the kinds of answers a model can return.
  nokids        a phone card's "more" button and its menu; with only adults no nap, no children's hours, no kids' corner,
                packing or diet, and Claude isn't told about children; with a toddler it all comes back.
  phoneday      a phone's Trip day (v174): the first stop right under Day · Explore, the time on one line, whole names,
                Menu and Swap in words behind one "more" button (v178); Simple view keeps only what runs the day (no descriptions, no nice-to-know
                notes, no tags but the booking ones, no photo behind the top card).
  simple        Simple view: the trip menu's switch takes away photos, descriptions and the greeting on the day,
                photos and the street map in Explore (the route and its directions stay), photos and the kids' banner
                on Today and the photo in a stop's panel; kept after a reload; Settings' switch turns it off.
  nope          "Not for us" from the swap panel, a swap card, a list row and the stop's menu (at the panel's foot,
                apart from its links; one tap asks, "Keep it" takes it back, "Yes, not for us" acts): a new suggestion fills
                the slot, the place is nowhere on the plan in that city nor among the options, Explore lists it with
                "Bring back", Undo and choosing it yourself take it off the list. The day bag: a beach, a cathedral, a
                market and a travel day ask for the right things, each naming its stop; a tick is kept; the screen
                wake lock is asked for on a live Today and let go when switched off or when you leave Today.
  pdf           the Take along PDF (jsPDF, from the local copy in the test): each stop measured and kept whole on one page,
                a day's heading kept with its travel line and whole first stop (never alone at a page's foot), and a page
                ending early only by what the next page's first block needed (a stop split over a page break used to
                leave a blank sheet), "Open in Google Maps" under each stop.
  eat           food needs: asked before Where to?, the allergy and diet lists folding (and staying open while you
                tick), carried by every restaurant request, places checked, poor fits never
                planned, the meal's notes, Explore's tags, a new city's lists asked for with them.
  money         Prices in: as listed by default; dollars converted with "≈"; text prices ("€15, book ahead", "£8–12");
                no rate stays as listed; the choice in Prepare's Budget and in Settings, kept on the phone, not in the
                trip; Prepare's tabs stay in one place whichever tab is open.
  daytrip       a day trip day: the choice at the end of a full day, a typed place, the day planned there, the
                planner's own day trips keeping off it, Undo and "Undo day trip", none on a rest day.
  workspace     the desktop workspace (1024px and wider): the three panes and their sizes, the rail's views and days,
                the day drawn for its pane, the map pane's list where there is no street map, a card and its pin
                (a stand-in pin: the tests have no map pack), the inspector beside the plan, the keyboard, moving a
                stop by its quick action and by dropping it on a day in the rail, what to show, folding the rail, the
                handle, hiding the map, Plan and Prepare taking the width, the CSV, two panes at 1100px, and at
                800px the phone layout with the same day and open stop; a phone never fetches app.desk.css.
  clock         one clock: a phone in Rome and one in Los Angeles see the same Now and Next at the same moment; "Rome
                time" shown when the trip's clock is not the phone's; the date turns over there first; before and
                after the trip the phone's own clock; the zones of countries with several.
  meals         enough places to eat for the days: a meal the plan leaves without a place is asked for by name, near
                the stop before it (one question, a place to spare, the children's dinner time); places set aside come
                out first; three questions per town and no more; never for a meal you freed or a trip you only read.
  menus         the nightly places join Rome's list once (no name or markup: dropped); a planned meal's Menu opens its
                panel at the menu (dishes, prices in the chosen currency, kids', source and date, Google Maps photos).
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
                taps a traveler makes most (next day, a day pill, open and close a stop, Explore, Prepare, Pack, a tick,
                the trip menu) must each paint within 200 ms (the INP "good" line) without moving the layout. Numbers go
                into the report so a slowdown shows. What it found and fixed: the test server now gzips (the real host
                already does; a 448 KB script over slow 4G was the whole FCP); page flips (View Transitions) turn off on
                slow devices and after a slow flip; answers arriving right after a tap are drawn once, on idle time,
                after the tap's own frame has painted (they used to redraw and replan five times before it); Prepare
                builds only the open segment's markup; norm() and findCity() are memoized.
  desktop       the app with a mouse, from a 600 px side panel (the phone layout, as in the Claude app's artifact panel)
                to a 1920 px monitor (from 1024 px the desktop workspace: there the rail's days and the trip menu in
                the rail take the place of the page's day arrows, view switch and tabs), on a seven-place trip: every screen passes the phone's clipping checks and never
                scrolls sideways, and what a phone lets you swipe is reachable without swiping: stays shrink to fit and
                then wrap to an even second row, the Prepare tabs wrap, the previous/next day arrows stay at every width,
                the trip menu opens under the trip's name wherever the banner puts it, and the kids' corner stays
                picture-book sized and centred on a big screen. At 1440 px: the day count between − and + is
                measured from a picture (centred, also under the mouse), Prepare's tabs sit in one place on all five
                tabs, and the page is as wide with a scrollbar as without.

Version control
  The code lives at github.com/zdstjohn/Waypoint2: trip/, test/, tools/, types/, build/, the test server, package.json.
  `npm install` then `npm test` runs everything; `npm run types` only the type check. GitHub Actions
  (.github/workflows/ci.yml) runs the full suite on every push and pull request in three groups side by side (test/run.js
  --shard=k/3 balances them by time; about 6 minutes), and a second job, "screens", takes every screen for this commit
  and the one before, one run per size side by side (phone, large text, dark, tablet, desktop; SHOT_SIZES), both
  photographed by this commit's test/shots.js, so two runs of the same code give the same pictures: it turns off the
  background top-ups (test/mocks/steady.js), waits for every answer and a few quiet seconds, asks for no more ideas,
  fetches every idea's details, and plans afresh until the plan stops changing; the mocks answer by what was asked
  (lists numbered by kind, places placed and described by name), never by the order or batch the requests came in. A commit that means to change screens lists them
  in test/screens-expected.txt (names or patterns like "swap-*"; read only when that commit changed the file); any other
  screen that changed fails the check, and the run's summary lists both, with the pictures attached. Every night .github/workflows/fuzz.yml plans 2000 random trips (pushes run 300) and lists any failing seed
  in its summary, ready to replay with FUZZ_SEED=<n>. Every published version of the artifact becomes a release: pushing a branch release/v<N> (or a tag v<N>)
  makes release.yml create the tag v<N>, build, and attach app.js, app2.js, app.min.css, app2.css, index.html and README.md, so
  any version can be restored by republishing those files.

Source
  src/            waypoint-source.txt: every source file behind the app in one file (the page, the styles, data/, lib/,
                  screens/, the type declarations, both tsconfig files, the test suites, the bundler and the workflows):
                  everything needed to rebuild and check the app, published with it so the code is never only in one
                  place. Each file starts at a line "=====8<===== <path>"; python3 tools/src_pack.py --unpack
                  waypoint-source.txt writes them back out (src_pack.py is the last file in it).
