# Waypoint: what changed, version by version

Newest first. Each note says what changed and where in the code. How the code is laid out is in README.md.

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
