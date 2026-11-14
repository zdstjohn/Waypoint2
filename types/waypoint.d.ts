/* Waypoint: the shapes that travel between files. Hand-written; checked against the sources by tsc (checkJs, noEmit) in
   test/suites/types.js. W is one shared object every file adds to; everything typed `any` below has not been described yet. */

type LatLng = { lat: number | null; lng: number | null; g?: [number, number] | null; pinAsked?: 1; gid?: string; gpin?: 1; [k: string]: any };
type Slot = "breakfast" | "am" | "lunch" | "pm" | "dinner" | "eve";
type View = "setup" | "trip" | "book" | "go" | "recap" | "settings" | "kids" | "explore";
type Focus = "icons" | "both" | "gems";
type Tier = "budget" | "mid" | "luxury";
type Fame = 0 | 1 | 2;
type Kid = -1 | 0 | 1;
type TimeOfDay = "am" | "pm" | "eve" | "any";
type Meal = "breakfast" | "lunch" | "dinner" | "both" | "all";

/** a thing to do, as a city's list keeps it. Spot and Food share one shape (the planner and the cards read either),
    the two names only say which list an item came from: a Food always has meal/cuisine/menu, a Spot always has s/ticket. */
interface Spot extends LatLng { n: string; d: string; t: string[]; k: Kid; fame?: Fame; rating?: number; s: TimeOfDay; dur: string; ticket: string; book: string; bookV?: number; pic: string; place?: string;
  st?: "open" | "closed" | "unsure" | "unverified" | "unfound" | "dup"; hours?: Hours | null; lead?: number; love?: string; gripe?: string; bch?: BeachFacts; note?: string; durAsked?: 1; mine?: boolean; indoor?: boolean;
  meal?: Meal; cuisine?: string; price?: string; menu?: string; reserve?: boolean; fav?: boolean }
/** a place to eat */
interface Food extends LatLng { n: string; d: string; cuisine: string; price: string; meal: Meal; /** the meals came from a checked record (lib/places.js) */ mealOk?: number; k: Kid; fame?: Fame; rating?: number; reserve: boolean; book: string; menu: string; dur: string; fav: boolean; pic: string; place?: string;
  st?: Spot["st"]; hours?: Hours | null; lead?: number; love?: string; gripe?: string; note?: string; durAsked?: 1; s?: TimeOfDay; ticket?: string; t?: string[]; bookV?: number; bch?: BeachFacts; indoor?: boolean; mine?: boolean; fit?: string; fitw?: string; eat?: { f: string; w: string; l?: number; sig: string }; night?: string }
interface Hours { o: number; c: number; closed: number[] }
interface BeachFacts { calm?: "calm" | "some waves" | "often rough"; shallow?: boolean; shade?: string; lifeguard?: boolean; sand?: string; walk?: number; facilities?: boolean; note?: string }
interface StayArea extends LatLng { n: string; d: string }
interface Lodging extends LatLng { n: string; tier: Tier; type: string; area: string; d: string; price: string; site: string }
/** a place to stay from Booking.com's search (lib/prices.js, v175): total = for the whole stay, night = a night; tier by price */
interface LiveLodging extends LatLng { n: string; url: string; total: number; night: number; cur: string; type: string; area: string; score: number; reviews: number; stars: number; tier?: Tier }
/** what Where to stay can show from Booking.com for a town (W.liveLodge) */
interface LiveLodge { st: "off" | "nodates" | "idle" | "loading" | "error" | "ok"; items?: LiveLodging[]; at?: number; nights?: number; busy?: boolean; msg?: string }
interface Transit { system: string; pass: string; airport: string; tip: string }
/** everything the app knows about one city: Claude's lists plus what the checks laid over them */
interface Pool extends LatLng { d?: string; spots: Spot[]; food: Food[]; stay?: StayArea[]; lodging?: Lodging[]; lodgeFor?: string; lodgeAsked?: 1; transit?: Transit | null; fallback?: boolean;
  rest?: { spots: Spot[]; food: Food[] }; showN?: { spots?: number; food?: number }; askedN?: number; mealAsks?: number; mealFor?: string;
  indoorAsked?: 1; fameAsked?: 0 | 1; cityLow?: string }
/** a destination in a country list (built in, or from Claude) */
/** isl = the island a town is on; whole = the entry is an island itself (kept only so an older trip that has one as a stop still works) */
interface BuiltCity extends LatLng { name: string; region?: string; isl?: string; whole?: number; top?: number; day?: number; stay?: number; w?: number; pop?: number; t?: string[]; d?: string; spots?: Spot[] }
interface Country { name: string; mode: "manual" | "suggest"; picked: string[]; rank?: number }
interface Stay { label: string; lat?: number | null; lng?: number | null; live?: { total: number; cur: string; url: string; at: number; in: string; out: string; src: string } }
/** the trip, as saved (localStorage "waypoint-v2" and the account) */
interface TripState { v: 2; algo?: number; tripId?: string; tripName?: string; styles: string[]; focus?: Focus; countries: Country[]; days: number; start: string; depart: string; travelers: (number | "")[]; names?: string[];
  stays: Record<string, Stay>; picks: Record<string, string>; seen: Record<string, string[]>; mine?: Record<string, 1>; free?: Record<string, 1>; rest?: Record<string, 1>; dayTrip?: Record<string, { country: string; name: string; lat: number | null; lng: number | null; min: number | null }>; fold?: Record<string, unknown>; legPick?: Record<string, unknown>; nope?: Record<string, string>; eat?: { al?: string[]; di?: string[]; love?: string; avoid?: string; note?: string }; eatNone?: 1; eatOpen?: { al?: boolean; di?: boolean }; bag?: Record<string, Record<string, 1>>;
  cityDays: Record<string, number>; day: number; example?: number; tview?: "days" | "map"; allPref?: boolean; stepClosed?: Record<string, boolean>; prepTab?: string; transitOpen?: unknown; jetOpen?: unknown; legClosed?: Record<string, boolean>; nextHide?: unknown; tripFolded?: any; mapZoom?: number; late?: any;
  appMode?: string; appModeAt?: string; exF?: unknown; exSort?: unknown; pack?: Record<string, unknown>; packHide?: Record<string, 1>; packOwn?: PackItem[]; journal?: Record<string, { mood?: number; note?: string; photos?: { id: string; [k: string]: any }[] }>;
  kidPicks?: Record<string, string[]>; hunt?: Record<string, Record<string, 1>>; stamps?: Record<string, string>; celebrated?: Record<string, string>; warmSeen?: string; lodge?: Record<string, string>; lodgeSeen?: Record<string, string[]>;
  share?: any; imported?: any; bookings?: Booking[]; booked?: Record<string, any>; rl?: Record<string, number[]>; under?: Record<string, [string, string, number]>; [k: string]: any }
interface Booking { key?: string; kind: string; title?: string; day?: number; [k: string]: any }
interface Costs { ages: string; cur?: string; breakfast?: number | null; lunch?: number | null; dinner?: number | null; transit?: number | null; lodge?: number | null; tickets: Record<string, number | null> }
interface Cache { country: Record<string, { blurb: string; cities: BuiltCity[]; v?: number; part?: number }>; city: Record<string, Pool>; geo: Record<string, LatLng & { area?: string }>;
  range: Record<string, { s?: number; r?: number; sig: string }>; /** journeys between towns (always there: lib/core.js makes it with the cache) */ legs: Record<string, any>; cost: Record<string, Costs>; tz: Record<string, string>; live?: any; area: Record<string, any>;
  /** holidays and festivals from Claude per city, for the dates asked about (lib/holidays.js) */
  events: Record<string, { v: number; from: string; to: string; items: CityEvent[] }>;
  /** typical fares from Claude for a flight from home, one way, the whole group (lib/prices.js W.fareGuess) */
  fare?: Record<string, { cur: string; total: number }> }
interface CityEvent { n: string; from: string; to: string; kind: string; closes: boolean; crowds: boolean; note: string }
interface Holiday { n: string; big: number; src: string; note?: string; custom?: boolean }
interface Party { toddler: boolean; kid: boolean; senior: boolean; adults: number; kids: number[] }
interface Traveler { name: string; age: number | null; i: number }
/** a base of the trip */
interface Stop { country: string; name: string; c: BuiltCity | { name: string }; manual?: boolean; days: number; set?: boolean; trips?: { name: string; [k: string]: any }[]; [k: string]: any }
interface SlotEntry { slot: Slot; key: string; item: Spot | Food | null; rest?: boolean; free?: boolean; trip?: boolean; [k: string]: any }
interface Day { n: number; country: string; city: string; dayInCity: number; stop: number; tripFirst: boolean; tripLast: boolean; moveFrom: string | null; jet: boolean; rest?: boolean; loading?: boolean; slots: SlotEntry[]; trip?: { name: string; [k: string]: any } | null; fullDay?: boolean; [k: string]: any }
/** the plan the planner returns (memoized until the trip or the data changes) */
interface Airport { code: string; name: string; lat: number; lng: number }
/** the meals a town's ideas leave without a place, as the plan stands (lib/plan.js mealGaps) */
interface MealGap { country: string; city: string; breakfast: number; lunch: number; dinner: number;
  /** each empty meal: its day, and the stop it should be near (n: "" when there is none), within about km of it */
  at: { meal: string; day: number; n: string; lat: number | null; lng: number | null; km: number }[] }
interface Plan { stops: Stop[]; days: Day[]; N: number; p: Party; ap: Airport | null; gaps?: Record<string, MealGap> }
/** where the day starts and ends: your stay, or (none: no stay picked yet) the city centre, never shown as an address */
interface Homebase extends LatLng { label: string; set: boolean; pending?: boolean; none?: boolean; city?: string }
interface Profile { act?: string; min: number; intensity: number; indoor?: boolean; weather?: boolean; adults?: boolean; slots: string[] }
interface Classification { kind: string; act: string | null; min: number; intensity: number; indoor: boolean; weather: boolean; adults: boolean; slots: string[]; stroller?: boolean }
interface TimeRow { start?: number; end?: number; skip?: boolean; late?: boolean; free?: boolean; label?: string; warn: string[]; info: string[]; /** the notes among info that are nice to know, not needed to run the day (Simple view leaves them out) */ more?: string[] }
/** a booked journey with a time (lib/bookcore.js W.legTicket): minutes from midnight; an arrival the next day is past 1440 */
interface Ticket { kind: string; title: string; provider: string; ref: string; dep: number; arr: number | null; /** the two ends are on different clocks: the times stand as booked, no length is worked out */ zone?: boolean }
/** one way of going, as Rome2Rio measured it (minutes door to door) */
interface R2RRoute { name: string; min: number; carriers: string[] }
interface DayTimes { rows: Partial<Record<Slot, TimeRow>>; nap?: { start: number; end: number; away?: boolean } | null;
  /** a moving day's journey; leg: the way between the two towns (W.legFor, always there for a stop after the first) */
  travel?: { start: number; end: number; leg: TownLeg; ticket?: Ticket; dep?: number; arr?: number; zone?: boolean } | null;
  /** a free morning in the town you're leaving before a booked late departure */
  before?: { start: number; end: number; city: string } | null; [k: string]: any }
interface Leg { min: number; mode: string; km?: number; [k: string]: any }
/** the journey between two bases (lib/times.js W.legFor): best is the way chosen (Claude's options, opts), min its minutes */
interface TownLeg { a: Stop; b: Stop; key: string; opts: any[] | null; best: any; pick: number; min: number; km: number | null; guessed: boolean; r2r: R2RRoute | null; [k: string]: any }
/** one row of a day on the Today screen (screens/travel.js entries), in time order: the journey, a place, a rest, the
    nap, the way back; i is its place in the day before sorting */
type GoEntry = { start: number; end: number; i?: number } & (
  | { k: "travel"; leg: TownLeg; tk: Ticket | null; dep?: number; arr?: number }
  | { k: "stop"; x: SlotEntry & { item: Spot | Food }; R: TimeRow; food: boolean }
  | { k: "rest"; x: SlotEntry }
  | { k: "nap"; away: boolean }
  | { k: "back" }
);
interface Energy { planScore?: number; level: number; label: string; walk: number; act: number; travel: number; score: number; big: number }
interface Countdown { big: string; small: string; line: string }
interface CheckItem { key: string; title?: string; short?: string; done: boolean; [k: string]: any }
interface PackItem { key: string; text: string; who?: string; why?: string; own?: boolean; group?: string; [k: string]: any }
interface PackLists { pack: PackItem[]; todo: PackItem[]; facts: Record<string, any>; hidden?: number }
interface Photo { url: string; credit?: string; page?: string; near?: string | boolean; /** a large copy of the same picture (stored by the nightly helper), for wide headers */ big?: string; /** the small copy (320 px wide, or smw), the WebP twins, the normal copy's width when not 720, and a 16 px blurred preview (base64 WebP) */ sm?: string; smw?: number; w?: number; webp?: { sm?: string; url?: string; big?: string }; lq?: string }
/** a checked place record (places/<city> in the database) */
/** g: Google's place ID (kept for good); gpin/gat: the pin came from Google on that day (kept 30 days, never on the free map) */
interface PlaceRecord { lat?: number | null; lng?: number | null; g?: string; gpin?: 1; gat?: string; [k: string]: any; checked?: string; osm?: string; name?: string; st?: Spot["st"]; site?: string; hours?: Hours; k?: Kid; note?: string; place?: string; replace?: Partial<Food & Spot> & { n: string }; approx?: 1; nopin?: 1; ashore?: 1; stay?: 1; pin_tried?: string; area?: 1; was?: [number, number] }
/** takeBlock, tripBlock and exportCopy come with lib/offcopy.js, in the second script */
interface OfflineState { planSig(P: Plan): string; takeBlock?(P: Plan): string; exportCopy?(P: Plan): Promise<any>; photoUrls(P: Plan): string[]; copyNote(P: Plan): string; cities?: Record<string, { photos: number; of: number; map: boolean }>; tripBlock?(P: Plan): string; state: string; n: number; total: number; at: number; maps: any[]; err: string; off: boolean; copy: boolean; trip: any; copyState: string; copyErr: string; why: string; save(P: Plan, why?: string): void; tick(P: Plan): void; src(url: string): string; block(P: Plan): string; click(d: DOMStringMap, P: Plan): boolean; [k: string]: any }
/** a shared trip's documents, named and sealed from its code (lib/sharebox.js) */
interface ShareBox { id: string; plain?: number; name: (label: string) => Promise<string>; seal: (obj: any) => Promise<any>; open: (doc: any) => Promise<any> }
interface ReadOnly { code: string; box?: ShareBox; [k: string]: any }
interface Milestone { key: string; title: string; text: string; also?: string[]; go?: View }
interface Readiness { pct: number; [k: string]: any }
/** the one door for Claude's answers (lib/validate.js) */
interface Validators { stats: { dropped: number; cleared: number; farPins: number }; str(x: unknown, max?: number): string; name(x: unknown): string | null; num(x: unknown): number | null; clamp(x: unknown, lo: number, hi: number, dflt: number): number;
  web(x: unknown): string; shared(x: unknown, depth?: number): any; pool(p: unknown): Pool | null;
  oneOf<T extends string>(x: unknown, list: readonly T[], dflt: T): T; intOf<T extends number>(x: unknown, set: readonly T[], dflt: T | undefined): T | undefined; fame(x: unknown): Fame | undefined; rating(x: unknown): number | undefined; tags(t: unknown): string[]; url(x: unknown): string;
  oneEach<T>(list: T[], key: string): T[];
  pin(lat: unknown, lng: unknown): { lat: number; lng: number } | null; pinNear(lat: unknown, lng: unknown, center: LatLng | null | undefined, km?: number): { lat: number; lng: number } | null;
  /** a name that is not one real place (a group of places, two in one, a meal as a thing to do) */
  vague(n: string, food: boolean): boolean;
  trainRide(n: string): boolean;
  spot(x: unknown, center: LatLng | null): Spot | null; food(x: unknown, center: LatLng | null, dflt?: { meal?: Meal; pic?: string }): Food | null; city(c: unknown): BuiltCity | null; stayArea(x: unknown, center: LatLng | null): StayArea | null;
  lodging(x: unknown, center: LatLng | null, tiers: readonly Tier[], tier?: Tier): Lodging | null; bkStay(a: unknown, center: LatLng | null, nights: number): LiveLodging | null; transit(t: unknown): Transit | null; hours(h: unknown): Hours | null; beach(b: unknown): BeachFacts; status(x: unknown): "open" | "closed" | "unsure"; lead(x: unknown): number;
  tz(x: unknown): string; money(x: unknown): number | null; currency(x: unknown, dflt?: string): string; range(y: unknown): { s: number; r: number } | null; list<T extends { n?: string; name?: string }>(arr: unknown, fn: (x: any) => T | null): T[] }

/** the shared object every file adds to */
interface Waypoint {
  placeSearch: (q: string, country: string, city: string) => void;
  searchBlock: (day: Day, P: Plan) => string;
  searchClick: (d: DOMStringMap, day: Day, P: Plan) => boolean;
  dayRouteUrl: (day: Day, stops: { n: string; lat: number | null; lng: number | null; gid?: string }[], home: { label?: string; n?: string; lat: number | null; lng: number | null; none?: boolean; pending?: boolean }) => string;
  loadPins: (country: string, city: string, names: string[]) => void;
  $: (id: string) => HTMLElement | null;
  C: Cache;
  FOCUS: Record<Focus, string>;
  FOOD_PICS: string[];
  P: Plan;
  S: TripState;
  SAMPLE: any;
  SLOT_NAME: Record<Slot, string>;
  SPOT_PICS: string[];
  STYLE_NAME: Record<string, string>;
  TAGS: string[];
  TIERS: Tier[];
  TIER_NAME: Record<Tier, string>;
  V: Validators;
  VIEW_KEYS: string[];
  _clCache: any;
  afterRender: any;
  afterSave: any;
  ages: () => number[];
  ago: (t: any) => string;
  airport: any;
  anniversary: any;
  applyPlaces: (country: string, city: string, pool: Pool | null) => Pool | null;
  autoFound: any;
  autoLine: any;
  autoTick: any;
  badForDay: (it: any, wd: any, slot?: any, kd?: any, n?: number) => any;
  beachFit: (x: any) => any;
  bestOrder: any;
  routeDist: (order: any[]) => number;
  betweenCities: any;
  bookClick: any;
  bookEnter: any;
  bookEntryFor: (P: Plan, day: Day, it: any) => any;
  bookReveal: any;
  bookTimeline: any;
  bookUrl: (u: unknown) => string;
  airport: () => Airport | null;
  bookedRow: any;
  bookingFor: (it: any, day?: any) => any;
  budget: any;
  calEvents: any;
  callTool: any;
  changed: () => void;
  /** W.changed in steps: planned in the next task, drawn in the one after (lib/core.js) */
  changedApart: () => void;
  checkGroups: any;
  checklist: (P: Plan) => CheckItem[];
  cheer: (title: string, text?: string, opts?: { big?: boolean; go?: View }) => void;
  cityBusy: (ck: string) => boolean;
  cityKey: (country: string, city: string) => string;
  classify: (it: Spot | Food, food: boolean) => Classification;
  clock: (m: number) => string;
  closeStop: () => boolean;
  closeTripMenu: () => boolean;
  /** null without a plan with stops */
  countdown: (P: Plan) => Countdown | null;
  countryCities: (name: string) => BuiltCity[];
  countryName: any;
  dataV: number;
  dateOf: (n: number) => Date | null;
  fmtDate: (d: Date | null | undefined, style?: string | Intl.DateTimeFormatOptions) => string;
  sunTimes: (country: string, lat: number, lng: number, d: Date) => { rise: string; set: string; mins: number } | null;
  dayEnergy: (day: Day, P: Plan, T: DayTimes | null) => Energy | null;
  dayNav: any;
  /** null without a start date that reads as one (a date outside the trip gives a day before 1 or after the last) */
  dayOfDate: (iso: string) => number | null;
  dayPool: any;
  dayTimes: (day: Day, P: Plan) => DayTimes | null;
  dayTripMax: (p: any) => number;
  dayTripOpen: (n: number) => void;
  /* the desktop workspace (v153): lib/later.js, lib/desk.js, lib/deskmap.js, screens/rail.js, screens/palette.js */
  desk: () => boolean;
  paneW: () => number;
  /** a redraw starting: the window's width read once for the rest of it (lib/later.js) */
  holdPaneW: () => void;
  deskOn: boolean;
  wsPrefs: { rail: number | null; map: number; list: number; center: number; hide: Record<string, number> };
  wsSet: (k: string, v: any) => void;
  wsHide: (kind: string) => void;
  wsEl: (id: string) => HTMLElement | null;
  wsKey: (k: string) => string;
  wsDay: (n: number) => void;
  wsDo: (what: string, which?: string) => boolean;
  deskLayout: (P: Plan) => boolean;
  deskAfter: (P: Plan) => void;
  deskSplit: () => boolean;
  deskSheet: () => void;
  deskSum: (sm: { stops: number; move: number; first: number | null; last: number | null; booked: number }, day?: Day) => string;
  deskMap: (P: Plan) => void;
  deskPts: { n: number; country: string; city: string; pts: any[]; home: any; slug: string | null; xp: boolean; go?: boolean; gm?: string } | null;
  deskIdeas: { n: string; lat: number | null; lng: number | null; food: boolean }[];
  railRender: (P: Plan) => void;
  palOpen: () => void;
  palClose: () => boolean;
  redraw: () => void;
  vtIdeas: (list: { n: string; lat: number | null; lng: number | null; food?: boolean }[]) => boolean;
  vtSee: (lng: number, lat: number, pad?: number) => void;
  sheetKey: () => string;
  moveStop: (key: string, n: number) => boolean;
  dayHeadline: (d: Day, P: Plan) => string;
  dayBars: (d: Day, P: Plan) => string;
  stopRange: (P: Plan, si: number) => string;
  saveFile: (filename: string, blob: Blob) => Promise<any>;
  csvRows: (P: Plan) => string[][];
  csvExport: (P: Plan) => Promise<boolean>;
  daysUntil: any;
  durText: (raw: unknown) => string;
  elderNames: () => string[];
  esc: (s: unknown) => string;
  extLink: (url: string, txt: string, cls?: string) => string;
  family: () => Traveler[];
  familyActs: (it: any, day?: any, x?: any) => string;
  familyClick: (b: any, d: any) => any;
  familyLine: () => string;
  familyTick: any;
  fareChip: any;
  fareInput: any;
  fareMin: (dir: any, P: Plan) => any;
  ferrySearch: (o: any, a: any, b: any) => any;
  findCity: (country: string, name: string) => BuiltCity | null;
  isleOf: (country: string, name: string) => { name: string; group: boolean; towns: { name: string; lat: number; lng: number }[] } | null;
  isleChoice: (country: string, name: string) => { isle: string; group: boolean; towns: BuiltCity[] } | null;
  townsOnly: (list: BuiltCity[]) => BuiltCity[];
  islesInto: (old: BuiltCity[], fresh: BuiltCity[]) => BuiltCity[];
  isleSwap: (country: string, from: string, to: string) => void;
  COUNTRY_V: number;
  flightHrs: any;
  flightsUrl: (from: any, to: any, d?: any) => string;
  fmtKm: (d: number) => string;
  fmtMin: (m: number) => string;
  focus: () => Focus;
  focusAsk: () => string;
  foldKey: (country: string, city: string) => string;
  freshAll: () => void;
  freshPicks: (country: string, city: string) => void;
  fxAfter: (fn: () => void) => void;
  fxCollapse: (sel: any, done?: any, opts?: any) => void;
  fxExpand: (sel: any, opts?: any) => void;
  fxFlip: (kind: string, dir: number, update: () => void, after?: (() => void) | null) => void;
  fxOff: any;
  /** a screen just opened: for a moment the page carries "view-enter" so what arrives moves in once */
  fxEnter: () => void;
  fxPulse: (sel: any) => void;
  fxRunAfter: any;
  fxStagger: (els: any, opts?: any) => void;
  geocode: any;
  getMcp: () => any;
  /** helpers lib/bookcore.js shares with screens/book.js */
  _bk: any;
  gmapsDir: (a: any, b: any, mode?: string) => string;
  gmapsPlace: (place: string | { n?: string; label?: string; gid?: string }, city: string, gid?: string) => string;
  goView: (to: View, anchor?: string) => void;
  gone: (it: Spot | Food | null | undefined) => boolean;
  greeting: any;
  guessLeg: any;
  heartBadge: any;
  heartsFor: any;
  highlights: any;
  holdLoads: boolean;
  homeTz: any;
  homebase: (country: string, city: string) => Homebase;
  hostOf: any;
  huntFinds: any;
  importBlock: any;
  importClick: (d: any) => any;
  isBeach: (x: any) => boolean;
  isExample: boolean;
  isFerry: (m: any) => boolean;
  isFood: (slot: string) => boolean;
  isPaid: (it: Spot | Food) => boolean;
  isRest: any;
  isToday: any;
  iso: any;
  isoDay: (d: Date) => string;
  jetlag: (P: { stops: any[]; ap: any }) => any;   /* (the plan, or just its stops and airports while it is being made) */
  joinNames: any;
  jumpToToday: ((P: Plan) => void) & { done?: any };
  keepInputs: (el: HTMLElement, draw: () => void) => void;
  kidDinner: () => number | null;
  kidNames: (under?: number) => string[];
  kidPicks: any;
  km: (a: LatLng | null | undefined, b: LatLng | null | undefined) => number | null;
  lateClick: any;
  lateDinner: (country: string) => boolean;
  lateFor: (day: Day) => number;
  /** every country Plan can take (screens/setup.js) */
  countryNames: () => string[];
  /** how well a place matches "Food you love": 2, 1 or 0 (lib/eat.js) */
  eatLike: (it: any) => number;
  /** the "like" part of a question about places to eat, when there is something they love */
  eatLikeAsk: () => string;
  eatLikeOf: (v: any) => number;
  /** a city's meals chosen again, keeping the ones you chose (lib/plan.js) */
  freshMeals: (country: string, city: string) => void;
  /** a few places for what you love in a city, asked once (lib/ideas.js) */
  loadLoved: (country: string, city: string) => void;
  /** a city's places that are a place for what you love (and fine to eat at) */
  lovedCount: (country: string, city: string) => number;
  /** a To book item still to book: not booked, its day not gone by (lib/bookcore.js) */
  leftToBook: (c: any) => boolean;
  /** where a booking stands by the trip's clock: "Booked", "Did you book it?", "Book now", "Book by Mar 9" */
  bookByText: (c: any, short?: boolean) => string;
  /** 2 with ideas built in, about 1 for the most visited, 0 for the rest */
  countryRank: (n: string) => number;
  /** one of the places with ideas built in (or an island's main town that has them) */
  builtIn: (country: string, c: { name: string; isl?: string; pop?: number }) => boolean;
  /** a park, a reserve, mountains, a coast: a day trip, never somewhere to stay */
  dayTrip: (c: { name?: string; day?: number; stay?: number }) => boolean;
  /** typeahead lists follow a redraw (lib/typeahead.js) */
  taRedraw: () => void;
  /** the planner's workings, for its half in the second script (lib/plan.js, lib/planacts.js) */
  planX: any;
  /** what the two halves of the Trip screen share (screens/trip.js, screens/tripacts.js) */
  tripX: any;
  /** " next day" or " two days later" for a time counted on past midnight (lib/core.js) */
  dayAfter: (m: number) => string;
  /** what "Tonight" says on a night spent on the way, "" otherwise (screens/travel.js) */
  nightOut: (T: any) => string;
  /** a lifted stop keeps its marks after a redraw (screens/flowacts.js) */
  liftRedraw: () => void;
  /** a click handler that comes with the second script: it also gets the taps that landed before it arrived (lib/later.js) */
  onClickLater: (fn: (e: any) => void, capture?: boolean) => void;
  /** a stay named but not yet found is asked for again (lib/plan.js) */
  stayRetry: (country: string, city: string) => void;
  /** a place as Google Maps directions take it (lib/core.js) */
  dirPoint: (p: any) => string;
  /** a change the app made for you, sent like one of your own (lib/sync.js) */
  realChange: () => void;
  /** a link led to one day: the Trip tab opens on it, not on today */
  keepDay: () => void;
  /** running late: move what has not started `min` minutes later (0: back on time) */
  lateAdd: (day: Day, min: number) => void;
  lateShift: any;
  leg: (a: LatLng | null | undefined, b: LatLng | null | undefined, quiet?: boolean) => Leg | null;
  legAsk?: (k: string, a: LatLng, b: LatLng, e: Leg) => void;
  legEst: (a: LatLng | null | undefined, b: LatLng | null | undefined) => Leg | null;
  legNote: (n0: number) => string;
  legReal: number;
  legWant: number;
  rlKey: (a: LatLng, b: LatLng) => string;
  rlOwn?: Record<string, number[]>;
  gmCard: (card: (title: string, sub: string, body: string, id?: string) => string) => string;
  gmFromLink: (u: string, c: LatLng, city: string, country: string) => Promise<any>;
  gmIsLink: (q: string) => string;
  gmListCell: (day: Day) => { cell: string; label: string; msg: string } | null;
  gmRow: (day: Day, gm: string, n0: number, lean?: boolean) => string;
  nearCard: (day: Day, P: Plan, ctx: { from: any; nm: number; live: boolean }) => string;
  nearIdeas: (day: Day, P: Plan, at: LatLng, food: boolean, nm: number) => { it: any; km: number; open: boolean | null; city: string; country: string }[];
  gmOn: () => boolean;
  gmSearch: (q: string, c: LatLng, city: string, country: string) => Promise<any[]>;
  gmState: () => { state: string; why: string; left: number };
  needNet: (what: string) => void;
  wxLine: (day: Day, live?: boolean, rescue?: boolean) => string;
  legBusy: any;
  legFor: (P: Plan, si: number) => any;
  legTicket: (P: Plan, si: number) => Ticket | null;
  loadEvents: (country: string, city: string, from: string, to: string) => void;
  easter: (y: number) => string;
  orthodoxEaster: (y: number) => string;
  holidaysKnown: (country: string) => boolean;
  holidaySunday: (country: string) => boolean;
  holidaysOn: (country: string, iso: string) => Holiday[];
  holidaysBetween: (country: string, from: string, to: string) => { iso: string; n: string; big: number }[];
  dayHolidays: (day: Day) => Holiday[];
  dayEvents: (day: Day) => CityEvent[];
  holidayShut: (it: any, day: Day, hol?: Holiday[]) => boolean;
  holidayLine: (day: Day) => string;
  eventsTick: (P: Plan) => void;
  /** your own trip, or a shared one whose owner lets you plan together */
  canEdit: () => boolean;
  /* planning together (lib/together.js) */
  coPush: () => void;
  coReapply: (body: any) => void;
  coWho: (code?: string) => string;
  coSetWho: (name: string) => void;
  coDescribe: (f: string, key: string, v: any) => string;
  coLogHtml: (list: { who: string; at: number; t: string }[], n?: number) => string;
  coTick: () => void;
  /** open Today on a given day (screens/travel.js) */
  goToDay: (n: number) => void;
  nopeKey: (country: string, city: string, it: Spot | Food) => string;
  isNope: (country: string, city: string, it: Spot | Food) => boolean;
  nopeList: (country: string, city: string) => { k: string; n: string }[];
  sayNo: (country: string, city: string, it: Spot | Food, P?: Plan) => void;
  unNope: (k: string) => void;
  dayBag: (day: Day, P: Plan) => { id: string; t: string; why: string }[];
  dayBagCard: (day: Day, P: Plan, live: boolean) => string;
  bagClick: (d: DOMStringMap) => boolean;
  awakeOn: () => boolean;
  awakeCan: () => boolean;
  awakeTick: (live: boolean) => void;
  /** the group's food needs (Plan, step 3; lib/core.js) */
  EAT_AL: string[][];
  EAT_DI: string[][];
  eatNeeds: () => { al: string[]; di: string[]; love: string; avoid: string; note: string } | null;
  eatText: () => string;
  eatSig: () => string;
  eatFit: (it: any) => string;
  eatWhy: (it: any) => string;
  loadEatFit: (country: string, city: string) => void;
  /** Prices in: the currency costs are shown in (lib/bookcore.js) */
  fxDate: () => string;
  fxRate: (from: string, to: string) => number | null;
  curOf: (country: string) => string;
  CURS: string[];
  homeCur: () => string;
  curView: () => string;
  setCurView: (c: string) => void;
  curPicker: (P: Plan) => string;
  priceText: (s: any, local?: string) => string;
  /** nightly restaurants and menus (lib/nightfood.js) */
  withNightFood: (country: string, city: string, pool: any) => void;
  menuFor: (it: any, country: string, city: string) => { src: string; at: string; sections: { h: string; items: { n: string; p: string; d: string }[] }[]; kids: { n: string; p: string }[]; note: string } | null;
  menuBlock: (it: any, day: Day, key?: string) => string;
  /** lib/menuread.js: a menu read from a photo, for this family */
  /** lib/bookcheck.js: your bookings against the plan */
  bookCheck: (P: Plan) => { day: number; slot: string; kind: string; text: string; fix: string }[];
  bookedOn: (n: number) => Record<string, any>[];
  /** lib/bookcore.js: a place's name against a booking's words */
  nameRank: (name: string, text: string) => number;
  nameMatch: (name: string, text: string) => boolean;
  /** lib/brief.js: the night-before briefing for a new town */
  briefBlock: (day: Day) => string;
  briefStart: (day: Day) => void;
  briefClean: (r: any) => any;
  /** lib/places.js: closures for a stretch, from the nightly "still open" check */
  cleanShut: (v: any) => { f: string; t: string; why: string }[] | undefined;
  shutOn: (it: any, n: number) => { f: string; t: string; why: string } | null;
  shutText: (s: { f: string; t: string; why: string }) => string;
  menuCanRead: () => boolean;
  menuClean: (r: any) => { lang: string; dishes: { n: string; en: string; d: string; p: string; fit: string; why: string }[]; ask: { local: string; en: string }[]; note: string };
  menuRead: (key: string, files: FileList | File[]) => void;
  menuPick: (key: string) => void;
  menuReadBlock: (key: string) => string;
  menuState: (key: string) => { state: string; res?: any; err?: string; n: number } | null;
  /** asks Rome2Rio (your connector) for real journey times between two stops, on a tap */
  checkRoutes: (a: any, b: any) => void;
  r2rMsg: string;
  r2rFor: (routes: R2RRoute[] | undefined, mode: string) => R2RRoute | null;
  legKey: (a: { country: string; name: string }, b: { country: string; name: string }) => string;
  legMinutes: (a: any, b: any) => any;
  legSig: (o: any) => string;
  liveClick: (d: any, P: Plan) => any;
  liveFares: any;
  loadBookLinks: any;
  loadCity: (country: string, city: string, more?: any, stayDays?: number, nMore?: number, low?: boolean) => void;
  loadCosts: any;
  loadCountry: (name: string) => void;
  loadFame: any;
  loadIndoor: any;
  loadLeg: any;
  loadLodging: (country: string, city: string, tier?: any) => void;
  loadScript: (src: string, integrity?: string) => Promise<any>;
  safeUrl: (x: unknown) => string;
  loadStayRanges: any;
  loadTz: any;
  lodgeList: any;
  lodgeReroll: any;
  lodgeShown: (country: string, city: string, tier?: any) => any;
  pickShown: <T extends { n: string }>(k: string, list: T[]) => T | null;
  pickNext: (k: string, list: { n: string }[]) => number;
  liveLodge: (ck: string, P: Plan, mode: "open" | "warm") => LiveLodge;
  liveLodgeRetry: (ck: string) => void;
  liveShown: (ck: string, tier: Tier) => LiveLodging | null;
  liveReroll: (ck: string, tier: Tier) => void;
  liveTierSize: (ck: string, tier: Tier) => number;
  liveStay: (ck: string, x: LiveLodging) => Stay;
  stayDates: (s: Stop, P: Plan) => { in: string; out: string; nights: number } | null;
  /** a chosen stay's Booking.com price while it is still for these nights (lib/bookcore.js) */
  stayLive: (st: Stay | undefined, s: Stop, P: Plan) => Stay["live"] | null;
  /** the latest a stop in this part of the day may start for this group (lib/times.js) */
  slotCap: (slot: string, p: Party) => number | undefined;
  isDayOut: (it: any, slot?: string) => boolean;
  RULES: Record<number, string>;
  WHY?: Record<string, string>;
  checkPlan: { (P?: Plan, opts?: { deep?: boolean; held?: { key: string; name: string }[] }): { day: number; slot: string; rule: number; what: string }[]; table: () => string };
  /** the day's photo, picked with its own places in mind (lib/photos.js) */
  /** (lib/ahead.js, second script) where the day's photo sits in the slim bar: the strip the top card's bottom edge showed */
  pinPhotoFit?: () => void;
  dayPhoto: (day: Day) => Photo | null;
  lodgeSig: any;
  mcpMsg: (e: any, s?: any) => string;
  me: any;
  mealsFor: any;
  milestone: (P: Plan) => Milestone | null;
  minNights: (p: any) => number;
  modeName: (m: any) => string;
  modeOf: any;
  money: (n: number, cur?: string | null, raw?: any) => string;
  moveEvery: (p: any) => number;
  needsBooking: (it: Spot | Food) => boolean;
  newTripBlank: any;
  newTripFrom: any;
  nextStep: any;
  norm: (s: unknown) => string;
  notForLine: any;
  /** the trip's clock: a Date whose own fields read the time of day where the trip is today (lib/times.js) */
  now: () => Date;
  /** the moment it is, the same everywhere */
  instant: () => Date;
  /** minutes the trip's clock is ahead of the phone's (0 for a phone on the trip's time, and off the trip) */
  tripShift: () => number;
  tripZone: (country: string, lng?: number | null, lat?: number | null) => { tz: string | null; rough: boolean };
  tripTimeNote: (city: string) => string;
  /** the day the banner shows on a phone: the Day view's own, or null on any other screen (screens/trip.js) */
  bannerDay: (P: Plan) => { city: string; date: string; level: string } | null;
  bannerRoute: (url: string) => void;
  pinBar: (P: Plan) => void;
  clip: (s: string, n: number) => string;
  goDayN: (P: Plan) => number;
  dayBagState: (day: Day, P: Plan) => { n: number; total: number } | null;
  upCheck: () => void;
  nightsAt: (P: Plan, si: number) => number;
  nightsText: (P: Plan, si: number) => string;
  /** a typical fare for a flight from home (one way, the whole group), from Claude; null until known (lib/prices.js) */
  fareGuess: (dir: "out" | "home", P: Plan) => { cur: string; total: number } | null;
  fareGuessBusy: () => boolean;
  nowMin: () => number;
  officialLink: any;
  officialUrl: (it: any, food?: any, country?: string, city?: string) => any;
  offline: OfflineState;
  onData: (fn: () => void) => void;
  openStay: any;
  openStop: (key: string) => void;
  packBlock: any;
  packClick: any;
  packReset: () => void;
  packing: (P: Plan) => PackLists;
  parseDur: (s: string) => number | null;
  party: () => Party;
  photoFor: (it: { n: string; place?: string }, food: boolean, country: string, city: string) => Photo | null;
  photosSeed: (v: any) => void;
  photosSnapshot: () => any;
  photosUrl: (name: string, city?: string) => string;
  picKind: (it: Spot | Food, food: boolean) => string;
  pickLeg: any;
  picture: (it: Spot | Food, food: boolean, country: string, city: string, opts?: { credit?: boolean; size?: "thumb" }) => string;
  placeInfo: (it: { n: string }, country: string, city: string) => PlaceRecord | null;
  placeTrips: any;
  plan: () => Plan;
  planMin: any;
  pool: (country: string, city: string) => Pool | null;
  prevView: any;
  priceUrl: any;
  pump: any;
  pushBookBy: any;
  quickStart: (first?: any) => any;
  readOnly: ReadOnly | false | null;
  readiness: (P: Plan) => Readiness;
  readyRing: any;
  releaseLoads: any;
  render: () => void;
  renderBar: (P?: any) => void;
  /** join this device's changes since the two last agreed (base) with another device's version of the trip */
  merge3: (base: any, mine: any, theirs: any) => { state: any; changed: boolean };
  syncJoin: (a: any, b: any) => any;
  syncPrune: (st: any, days: number) => number;
  planWrote?: Record<string, string | null>;
  syncCanon: (st: any) => string;
  /** how restaurant requests state the group's food needs ("" when there are none) */
  eatAsk: () => string;
  /** mark a list of places with how each fits the food needs (from the answer's fit / fitw) */
  eatMark: (list: any[]) => void;
  /** a planned meal's "Menu" button: opens its panel at the menu */
  menuBtn: (key: string) => string;
  /** a link to a place's own menu page, or a search for it */
  menuLink: (it: any, city: string) => string;
  /** the "Tickets" / "Reserve" link to a place's official site ("" when there is none) */
  bookLink: (it: any, city: string, food: boolean, country: string) => string;
  /** this device refused a save (its storage for the app is full); shown in the banner until a save succeeds */
  localFull?: boolean;
  /** note a refused save: sets localFull and logs it once */
  storeFailed: (e: any) => void;
  renderBook: any;
  renderGo: any;
  renderKids: any;
  renderNext: any;
  renderRecap: any;
  renderSettings: any;
  renderSetup: any;
  renderTrip: ((P: Plan, target?: string) => void) & { waiting?: any };
  replan: () => void;
  /** whether W.plan() would hand back the plan it has (lib/plan.js) */
  planFresh: () => boolean;
  reroll: any;
  rescue: any;
  resetPicks: () => void;
  restKey: (d: { country: string; city: string; dayInCity: number }) => string;
  reviewsUrl: any;
  routeBody: any;
  routeCheck: any;
  routeClick: any;
  /** prompt: the question, or the name of one in W.ASKS with what its words and its answer need (the "ask" piece) */
  run: (key: string, prompt: string | { ask: string; a: any[]; lib?: { place: string[]; kind: string; own?: boolean } }, tier: "quick" | "default" | "complex", onOk?: (r: any) => void, stream?: { list: string; take: (items: any[], head: any) => void; min?: number }) => void;
  /** the questions to Claude and their answers' handlers, by name (lib/ideasask.js, lib/staysask.js, lib/asksask.js) */
  ASKS: Record<string, { q: (...a: any[]) => string; ok: (...a: any[]) => (r: any) => void; stream?: (...a: any[]) => any }>;
  /** what those files use from the loaders' own files */
  ASK_X: Record<string, any>;
  /** the "ask" piece is in: send what waited for it */
  asksIn: () => void;
  partialList: (text: string, key: string, from?: number) => { items: any[]; next: number; head: any };
  askOpts: (key: string, tier?: string) => any;
  spotsAsk: (country: string, city: string, n: number) => string;
  EFFORT: Record<string, string>;
  sampleState: "waiting" | "on" | "off";
  save: () => void;
  saveFold: (el: any, open: any) => void;
  scrollToStop: number | null;
  setAppMode: any;
  setView: (v: View) => void;
  settingsClick: any;
  setupChange: any;
  setupClick: any;
  setupEnter: any;
  shapeNotes: any;
  shapeTrip: any;
  shareBlock: any;
  /** an error the app carries on from: kept in the error log so it leaves a trace (lib/errlog.js) */
  caught: (e: any, where: string) => void;
  /** a copy of every trip on this device, to keep as a file; and trips back from one (lib/sync.js, Settings) */
  tripsExport: () => { app: string; kind: string; v: number; saved: string; trips: { id: string; name: string; updated: number; state: any }[] } | null;
  tripsImport: (doc: any) => number;
  /** lib/ideastore.js: ideas kept in IndexedDB, the storage entry holding only this trip's */
  kept: (kind: "city" | "country", key: string, again: () => void) => boolean;
  cacheSlim: (force: boolean) => Cache;
  cacheDirty: () => void;
  cacheCut?: boolean;
  ideaStore: { ready: Promise<boolean>; keep: () => void; isOn: () => boolean; keptAll: () => boolean };
  shareBox: (code: any) => Promise<ShareBox>;
  sharePlain: (code: any) => ShareBox;
  shareCode: (code: any) => string;
  sharePacks: boolean;
  shutBy: any;
  sky: any;
  slotOptions: (day: Day, slot: string, P: Plan) => any[];
  slug: (s: string) => string;
  citySlug: (country: string, city: string) => string;
  textHash: (s: string) => string;
  /* the city library (lib/citylib.js, in the "ask" piece) */
  libFor?: (lib: { place: string[]; kind: string; own?: boolean }, text: string) => any;
  countryAliases: () => [string, string][];
  libFrom?: Record<string, number>;
  libStats?: (cb: (s: { countries: number; cities: number; at: number } | null) => void) => void;
  libGet?: (q: any, cb: (r: any, general?: boolean) => void) => void;
  sunInline?: (day: Day) => string;
  vtEngineWarm?: () => void;
  tourOpen: () => void;
  tourClose: () => boolean;
  tourMaybe: () => void;
  libGeneral?: (kind: string) => string;
  libSave?: (q: any, r: any) => void;
  loadLow: (keys: string[]) => void;
  loadNow: (keys: string[]) => void;
  warmCity: (country: string, city: string) => void;
  smallNextToBig: (st: any[], i: number, p: any) => any;
  status: Record<string, string>;
  stayInput: (ck: string, P: Plan, hotel?: any) => any;
  stayRange: (country: string, city: string) => any;
  stayText: (it: Spot | Food, food: boolean, slot: string) => string;
  stopAt: (s: Stop) => LatLng & { label?: string };
  stopDetails: (P: Plan, day: Day, x: any, opt?: { noMain?: boolean }) => string;
  vtArea: any;
  standalone: boolean;
  needsClaude: (what: string, inClaude?: string) => string;
  builtInCities: () => string;
  builtInCountries: () => string;
  pwa: any;
  installCard: any;
  cloud: boolean;
  accountCard: any;
  iconLink: (url: string, kind: string, label?: string) => string;
  patch: any;
  draw: (el: HTMLElement, html: string, sig?: string) => void;
  drawn: any;
  typingHeld: () => boolean;
  rescueApply: any;
  replanFacts: any;
  replanBlock: any;
  replanAsk: any;
  reviewFacts: any;
  reviewSig: any;
  reviewStart: (P: Plan) => void;
  reviewBlock: any;
  suppressClick: any;
  syncable: any;
  takeItBlock: any;
  takeItClick: (d: any, P: Plan) => any;
  tickLabel: (key: string) => string;
  todayRow: (day: Day, P: Plan, T: any) => string;
  todayN: (P?: Plan | null) => number | null;
  topLine: (P: Plan) => string;
  travelNudge: (P: Plan) => { key: string; k: string; text: string; sub: string; go: any } | null;
  travelOn: (P: Plan) => any;
  tripName: () => string;
  tripStats: any;
  tzFor: (country: string) => string;
  undoPoint: (before: string | null, label?: string, seeDay?: number) => void;
  unrescue: (day: any) => void;
  useIdea: (day: any, slot: string, name: string, P: Plan) => any;
  view: () => View;
  viewSwitch: () => string;
  vt: any;
  vtActive: () => boolean;
  pinGroups: <T>(pts: T[], project: (p: T) => { x: number; y: number }, minPx?: number) => { x: number; y: number; items: T[] }[];
  vtFor?: (country: string, city: string, lat?: number | null, lng?: number | null) => string | null;   /* (lib/vtindex.js; guarded where it is used) */
  vtLoadTest: any;
  vtPieceTest: any;
  vtReadyTest: any;
  vtMount: (slot: any, o: any) => boolean;
  /** Simple view (this phone only): no photos, no street map, fewer words */
  simple: () => boolean;
  /** turn Simple view on or off (saved on this phone) and redraw */
  setSimple: (on: boolean) => void;
  /** the Simple view switch, as drawn in the trip menu and Settings */
  simpleSwitch: () => string;
  /** light or dark chosen on this phone: "light", "dark", or "" (match the phone) */
  theme: () => string;
  /** choose light, dark or "" (match the phone), saved on this phone, and redraw */
  setTheme: (v: string) => void;
  /** the three-way light / dark choice, as drawn in the trip menu and Settings */
  themeSwitch: (bare?: boolean) => string;
  /** the street map's cover over the detailed tiles that loaded: tile keys "z/x/y" -> GeoJSON boxes at one zoom (for the tests) */
  vtState: () => string;
  vtWarm: (slug: string) => any;
  vtWorkerUsed: any;
  vtZoom: (how: any) => void;
  wantPhotos?: (country: string, city: string, pool: Pool | null, P?: Plan) => void;
  IDEA_CAP: { spots: number; food: number };
  tripPhotoCoverage: (P: Plan) => { stops: number; withPhoto: number; pct: number; rows: { key: string; country: string; city: string; stops: number; urls: string[]; map: string | null; items: Record<string, string> }[] };
  vtSize: (slug: string) => number;
  logError: (msg: any, where: string, stack?: any) => void;
  currentView: () => string;
  flushErrors: () => void;
  placeKey: (it: { n: string; cuisine?: string; meal?: string; [k: string]: any } | null | undefined) => string;
  laterReady: boolean;
  laterLoading?: boolean;
  loadLater: () => void;
  needLater: () => boolean;
  /** where to stay, as a sheet over the screen you are on (screens/setup.js, second script) */
  staySheet: (si: number) => void;
  staySheetRedraw: () => void;
  /** a stop's sheet (screens/sheet.js, second script) and what it borrows from screens/flow.js */
  sheetOpen: (key: string) => void;
  sheetClose: () => boolean;
  sheetRedraw: () => void;
  exchangeStops: (a: string, b: string) => void;
  liftStart: (key: string) => void;
  snapState: () => string | null;
  /** the one link that matters for a stop: a table or menu for a meal, the tickets for a sight */
  stopLink: (it: any, food: boolean, day: Day, P: Plan) => { url: string; t: string } | null;
  /** "smooth", or "auto" for someone who asked for less motion */
  smooth: () => ScrollBehavior;
  /** the Back button (lib/back.js): something opened on top of the screen / was closed by its own control */
  backOpen: (key: string, close: () => any) => void;
  backShut: (key: string) => void;
  /** a short message a screen reader reads out, from the one live region that is always there (lib/a11y.js) */
  say: (text: string) => void;
  /** the address follows the screen; step: reached by a link, so Back returns from it */
  navTo: (hash: string, step?: boolean) => void;
  /** run this once the second script is here (asks for it when it is not) */
  whenLater: (fn: () => void) => void;
  laterDone: () => void;
  /** pieces of the second script in files of their own (lib/later.js; build/bundle.js PIECES): a piece's file hands
      its code over; is it here; are all that were asked for here; ask for one */
  piece: (name: string, run: () => void) => void;
  pieceIn: (name: string) => boolean;
  piecesIn: () => boolean;
  loadPiece: (name: string) => void;
  /** quick start (screens/quickstart.js, second script) */
  qsOpen: (first?: boolean) => void;
  qsIsOpen: () => boolean;
  qsClose: () => boolean;
  ideasFull: (pool: Pool | null | undefined) => boolean;
  /** how many things to do and places to eat a city starts with at least; more only on "Find more" */
  FIRST_IDEAS: number;
  /** how many of each for a stay of this many days in this trip (15 to 30) */
  firstIdeas: (stayDays?: number) => number;
  /** the days this trip spends in a place, as the plan stands */
  stayDays: (country: string, city: string) => number;
  /** a stay made longer: fetch the difference */
  growIdeas: (country: string, city: string, stayDays: number) => void;
  fitIdeas: (country: string, city: string, stayDays: number, quiet?: boolean) => boolean;
  /** brings in places to eat for the meals a town's days have no place for; returns "out", "ask" or "" (lib/ideas.js) */
  mealIdeas: (country: string, city: string, short: MealGap) => string;
  mealFits: (item: Food, meal: string) => boolean;
  slotShort: (x: SlotEntry) => boolean;
  ideaLimit: (c: Pool | null | undefined, list: "spots" | "food", stayDays: number) => number;
  fromRest: (pool: Pool, name: string, food: boolean) => Spot | Food | null;
  /** the icon set (lib/icons.js): name to its drawing on a 24 grid */
  ICONS: Record<string, string>;
  /** an icon as an svg; weight is the line's width on the 24 grid */
  icon: (name: string, weight?: number, cls?: string) => string;
  arrow: (dir?: string) => string;
  legIcon: (mode: string) => string;
  routeHome: (home: { label: string }) => string;
  routeLeg: (a: any, b: any, city: string, last?: boolean, note?: string) => string;
  routeStop: (p: { it?: any; n: string; lat?: number | null; food?: boolean; slot: string; num: number }, city: string, when: string, cls?: string, key?: string, from?: any) => string;
  kindIcon: (it: any, food: boolean, slot?: string) => string;
  stopTag: (n: number) => string;
  /** the stop keys a map pin stands for (one per line in its data-keys) */
  pinKeys: (el: Element | null) => string[];
  stopMark: (it: any, food: boolean, slot: string | undefined, n: number) => string;
  homeMark: () => string;
  /** a city's own photo for its header: the city, else the first of these places with one, else its best-known sight */
  cityPhoto: (country: string, city: string, prefer?: (Spot | Food)[]) => Photo | null;
  /** the photo filling a header, with its credit */
  heroImg: (ph: Photo, alt: string, lazy?: boolean) => string;
  /** a phone's Trip day: the day's photo goes behind the top card (no header of its own) */
  phoneTop: () => boolean;
  /** the photo behind the top card, or none */
  topPhoto: (ph: Photo | null) => void;
  /** a drawn face for a day's mood (3 great, 2 good, 1 tough) */
  /** which Claude request goes next: 0 first (things you asked for), higher later */
  loadPrio: (key: string) => number;
  warmTick: (P: Plan) => void;
  /** (lib/ahead.js, second script) fetch the next and previous day's photos when idle; tomorrow's street map the evening before */
  aheadTick?: (P: Plan) => void;
  /** (for the tests) what a photo's markup would ask for: the WebP copy's srcset when it has one */
  aheadReqOf?: (html: string) => { src: string; srcset: string | null; sizes: string | null } | null;
  watchBanner: () => string;
  watchChip?: (kind: string, key: string, P?: Plan | null) => string;   /* (second script) */
  watchClick: (d: any, P: Plan) => any;
  watchDrop: any;
  watchDrops: () => any;
  watchList: () => any;
  /** 0 (Sunday) to 6; null without a start date */
  weekday: (n: number) => number | null;
  who: () => string;
  /** shared by the files that ask Claude (lib/ideas.js, lib/stays.js, lib/asks.js) */
  arrived: () => void;
  newPool: () => Pool;
  centerOf: (cityKey: string) => LatLng | null;
  whoTags: (it: Spot | Food, food: boolean, cls: Classification | null) => string;
  withImported: (country: string, city: string, pool: any) => any;
}

interface Window { W: Waypoint; STYLES: [string, string][]; TD: Record<string, { blurb?: string; cities: BuiltCity[] }>; AIRPORTS?: [string, string, number, number][]; claude?: { use(name: string): Promise<any> }; __WP_OFFLINE?: any; __uid?: string; [k: string]: any }
declare var W: Waypoint;
declare var STYLES: [string, string][];
declare var TD: Record<string, { blurb?: string; cities: BuiltCity[] }>;
declare var ML: any;
declare var maplibregl: any;

/* Browser shapes as this app uses them. Event targets here are always elements (the handlers run on clicks and inputs),
   and ids looked up with W.$ are often inputs: these say so once, instead of a cast at every site. */
/** Device Memory API: Chrome only, absent in the standard lib */
interface Navigator { deviceMemory?: number }
interface EventTarget { files?: FileList | null; closest?(sel: string): Element | null; matches?(sel: string): boolean; getAttribute?(name: string): string | null; dataset?: DOMStringMap; tagName?: string; value?: string; id?: string; classList?: DOMTokenList; open?: boolean }
/* dataset and style are always there: every element the app draws or finds is an HTML or SVG element (it makes none in
   another namespace), and both kinds carry them. click and the rest stay optional: an SVG element has no click(). */
interface Element { value?: string; dataset: DOMStringMap; click?(): void; focus(opts?: FocusOptions): void; blur?(): void; select?(): void; type?: string; checked?: boolean; files?: FileList | null;
  readOnly?: boolean; selectionStart?: number | null; selectionEnd?: number | null; setSelectionRange?(a: number, b: number): void; showPicker?(): void; offsetLeft?: number; offsetTop?: number; offsetWidth?: number; offsetHeight?: number; style: CSSStyleDeclaration; hidden?: boolean; disabled?: boolean; __step?: any }

/* marks lib/patch.js and the day screen leave on elements they draw into */
interface Window { __WP_COPY_KEPT?: boolean }
interface HTMLElement { _sig?: string | null; _html?: string | null; _edges?: number }
