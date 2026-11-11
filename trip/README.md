# Waypoint — how the code is laid out

One page. `index.html` is the markup; the code is plain files under data/, lib/ and screens/, joined and minified into
`app.js` (and app.css into `app.min.css` and `app2.css`) by `build/bundle.js`. All code shares one namespace, `window.W`; the order in
`build/bundle.js` is the dependency order. `node test/run.js` builds first. The screens a first open never needs (Plan,
drawing the street map, the Prepare screen, live prices and price watch, the booking autopilot, planning together, place search in Explore, the
journal, the day bag, family, settings, the kids' corner, the recap, the packing list: LATER in build/bundle.js) go into a second script, `app2.js`, which lib/later.js loads once the first screen has painted (on idle time, or at once when you open one
of them, with "Loading…" for the moment it takes); W.needLater() says whether it has arrived. Their styles go into
`app2.css`, which comes with it (a rule moves only when it sits in one of those screens' sections of app.css and none of
its class names appears in the first script or index.html; build/bundle.js splitCss), and the screens count as ready when
both have come. The street map is in two: lib/vtindex.js (first script: which cities have a pack, the map's state, so
the first screen holds the map's place) and lib/vtmap.js (second: packs, the engine, the look, pins). The one map moves
into each redrawn screen, and a WebGL picture that moves is blank (black) until it draws again, so it is asked to redraw
when moved, resized (a ResizeObserver) or shown again. Touch-first phones use two fingers on the map (the page scrolls
with one); with a mouse or trackpad the wheel zooms and dragging moves it. The postcards and
greetings (lib/warm.js) stay in the first script: they are on the first screen, and arriving later would move it.
The offline copy carries both scripts and both stylesheets.
Travel mode stays in the first script on purpose: on the trip it is the first screen, often on a weak signal. What the
first screen reads from Prepare (the book-by checklist, the budget, which booking belongs to a stop) is lib/bookcore.js,
with W.money and "Prices in": each phone shows costs as listed or all in one currency (localStorage "waypoint-cur"),
converted at the European Central Bank's rates in fx/latest (refreshed nightly) and marked "≈" (W.priceText converts
prices written in text, like "€15, book ahead"; a currency with no rate stays as listed); Prepare and Settings offer it.
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
v125: where the route lives. The Day tab has one button under its header, at the right: "Open the whole route in
Google Maps" (screens/trip.js, class day-gm). Today's route (from where you're staying to each stop and back, with the
way between each and its directions) moved from Explore to the Today tab, where it takes the place of the plain
timeline (screens/travel.js, class go-route): the nap and the day's travel sit in their places, what has passed is
dimmed and now and next are marked, a stop opens its sheet, and one with no pin links to Google Maps by name. Explore
keeps the search, the street map where the city has one, the free time and the ideas. In the tab bar Today comes
before Prepare.
v126: today's map moves to Today too. Where the city has a street map, the route's header on Today has a Map button
(screens/travel.js, data-gomap): closed at first, it opens the map in place above the stops, with the zoom buttons,
and stays open or closed while the app is open. Explore no longer shows a map. On a big screen the Day view still
has it beside the day.
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
v129: data someone else wrote is checked before it is used (the audit's S3, R2, S6, S8). Every link drawn from data
goes through W.safeUrl (lib/validate.js V.web: http or https, nothing else), whoever wrote the data. A shared trip's
plan and ideas, and the nightly links and place lists in the shared database, pass V.shared (plain data only, links
web links or empty, long text and deep nesting cut) and V.pool (lists of named places, pins on Earth or none) before
the app uses them. Share codes are 10 characters from the browser's secure random source (codes of 6 still open). The
PDF library is loaded with an integrity hash, so only the expected file can run. tools/release.sh does a release's
mechanical steps; package.json's version follows the release (0.<N>.0).
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
v119: the offline copy, walked through in airplane mode (test/suites/airplane.js). It keeps its own storage (a small
shim at the top of the file: everything in memory under "waypoint-copy|<saved at>", written to the phone only if the
phone allows), so it always opens on the trip inside it, even where a downloaded file gets no storage (it used to open
on the example trip and say "storage full"), and two copies on one phone never mix. Its second script counts as ready
only once it has run (a copy reopened on Prepare used to stop at start-up). In the copy, nothing that needs the network
is offered: no Plan tab or Settings, no New trip or shared trips, no place search, calendar, PDF, live prices or new copy;
Explore and Take along say what needs the live app; the notice says plainly whether changes are kept on this phone.
v118: two tabs on the trip, Day and Explore; Day holds a One day / All days switch (.dsw, data-vsw "days"/"all"; the
tab remembers All days across a visit to Explore in S.allPref). The storybook is gone (a trip saved on it opens on the
day). Links and marks as pictures (lib/links.js): W.iconLink (photos, map: a plain map sign, not a company's logo);
an idea's row in Explore is just its links (no "checked" mark, no kids mark, no "Not for us": that lives on a stop's
panel, with a red border, and on the swap cards). Photo credits are plain text (the licences ask for the name; a tap never leaves the app).
The street map cannot zoom out past the town it was made for plus the day's stops (vtmap.js area, MapLibre maxBounds).
Prepare on a wide screen keeps the tabs in one place on every tab (an empty .cur-none holds the currency picker's cell).
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
v116: the blank boxes on the street map came from one shared empty buffer in vtmap.js (the engine hands every answer to
its worker, which empties it on this side; the second "nothing here" then failed, and a tile whose names needed such a
letter range failed with it): every "nothing here" is now a new buffer. Two of your devices changing one trip are joined
setting by setting and slot by slot (sync.js merge3, against the state the two last agreed on); the same one changed on
both goes to the later save. In the week before a trip the app says to save an offline copy until one of this plan exists
(offline.js copyNote; the app itself cannot open without a connection, it lives inside Claude). lib/eat.js (food needs)
and lib/links.js (menu, ticket, flight and ferry links) were split out of core.js and trip.js; both are null-safe.
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

```
index.html        markup (header, tabs, one <main> per view); loads app.js and app.min.css (built; app2.js and app2.css follow)
app.css           the stylesheet, grouped by screen: fonts, foundations, header, Setup, My trip, a stop, storybook,
                  Explore, Bookings, Today, journal, settings, motion
fonts/            Nunito, Dela Gothic One and Patrick Hand SC as woff2, served by the app itself (Latin; extended Latin
                  letters in separate files the browser fetches only when a label needs them)
data/             built-in destinations (data1: Europe, data2: the rest, plus airports)
lib/              the shared library
  core.js         state, caches, helpers and the queue to Claude. What is asked lives in towns.js (destinations, always
                  towns, never whole islands), ideas.js (things to do, places to eat, how many are on show), stays.js
                  (how long, and where to stay) and asks.js (beaches, getting between stops, food needs, events, costs,
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
  later.js        loads app2.js (above); loaded right after errlog.js
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
  plan.js         which cities, how many days each, what to do each day (the chooser and its shape rules). A city
                  short of ideas for its days is topped up in the background (up to three times, and breakfast places
                  once), judged only once its first lists are all in and counted only when actually asked for. Above the
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
  route.js        (second script) trip shape check (and its one-tap fixes)   import.js  paste an itinerary   prices.js  live prices and booking sites
  watch.js        price watches   sync.js  saved and shared trips   fx.js  motion   vtindex.js/vtmap.js  the street map (cities with a map pack)
  storage.js      (second script) Settings > Storage, for people who can edit the app: finds stored files nothing points
                  at (every 32-character id in the app's lists photos, maps, links, places, wanted, shared, your saved
                  trips, this phone's storage, the page and its scripts counts as in use; files from the last two days
                  are kept, as the nightly photo run records its uploads after making them), shows them with thumbnails,
                  and deletes them only after you confirm, checking again first. It deletes nothing when a list can't be
                  read in full (1000 documents) or when more than half the files would go.
  search.js       find any place and put it on the day: the city's own ideas, Mapbox (real places with exact pins,
                  through the viewer's Mapbox connection) and Claude (marked "Suggested by Claude" until the nightly
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
                  panel show them): planned stops and the journal first, six at a time, up to 60 MB in the copy. Street
                  maps need a connection in the copy. Prepare > Take
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
                  bar, undo, the stop sheet and the quick start (shown on the very first open; a stop's sheet keeps
                  "Leave free" and "Not for us" at its foot, apart from its links, and "Not for us" asks once); journal, family;
                  settings.js is "Import a plan" and Storage (sharing lives in the trip menu); kids.js is "For the kids"
                  (from the trip menu and Today): today's outings in big photo cards with a heart per kid, a passport
                  that stamps each place, and a treasure hunt per town
vt/              street-map data: the detailed packs live in the asset store (maps/<city> in the
                  database lists them), built nightly by tools/build.py and pack2json.py. A pack stays under 4 MB
                  (PACK_MAX_MB): the closest zoom levels are dropped farthest from the town first, never within 0.8 km
                  of it or of a place on its list; a city's wider area is still drawn from the coarser levels. Where a
                  detailed tile is drawn, a land-coloured cover hides the coarse map under it; the cover follows the
                  detailed tiles that actually loaded (a tile that fails leaves the coarse map, never a blank box), a
                  failed tile is decoded up to three times and asked for again, and map errors go to the error log. vt/ keeps the engine, the
                  pack worker (packworker.js: downloads and decodes packs off the main thread, caches them in IndexedDB)
                  and the glyphs (glyphs.wasm: everyday letters; glyphs-ext.wasm: extended Latin, Greek, Cyrillic, on
                  demand; split by tools/glyphsplit.py)
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
                no rate stays as listed; the choice on Prepare and Settings, kept on the phone, not in the trip.
  menus         the nightly places join Rome's list once (no name or markup: dropped); a planned meal's Menu opens its
                panel at the menu (dishes, prices in the chosen currency, kids', source and date, Google Maps photos).
  storage       Settings > Storage: of ten stored files it finds only the three old ones nothing points at (a place
                photo, a map part, a journal photo and today's uploads are never listed), deletes nothing by looking,
                asks once more, keeps one that came into use in between, and refuses when most files would go.
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
