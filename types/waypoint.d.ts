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
interface Food extends LatLng { n: string; d: string; cuisine: string; price: string; meal: Meal; k: Kid; fame?: Fame; rating?: number; reserve: boolean; book: string; menu: string; dur: string; fav: boolean; pic: string; place?: string;
  st?: Spot["st"]; hours?: Hours | null; lead?: number; love?: string; gripe?: string; note?: string; durAsked?: 1; s?: TimeOfDay; ticket?: string; t?: string[]; bookV?: number; bch?: BeachFacts; indoor?: boolean; mine?: boolean; fit?: string; fitw?: string; eat?: { f: string; w: string; sig: string }; night?: string }
interface Hours { o: number; c: number; closed: number[] }
interface BeachFacts { calm?: "calm" | "some waves" | "often rough"; shallow?: boolean; shade?: string; lifeguard?: boolean; sand?: string; walk?: number; facilities?: boolean; note?: string }
interface StayArea extends LatLng { n: string; d: string }
interface Lodging extends LatLng { n: string; tier: Tier; type: string; area: string; d: string; price: string; site: string }
interface Transit { system: string; pass: string; airport: string; tip: string }
/** everything the app knows about one city: Claude's lists plus what the checks laid over them */
interface Pool extends LatLng { d?: string; spots: Spot[]; food: Food[]; stay?: StayArea[]; lodging?: Lodging[]; lodgeFor?: string; lodgeAsked?: 1; transit?: Transit | null; fallback?: boolean;
  rest?: { spots: Spot[]; food: Food[] }; showN?: { spots?: number; food?: number }; askedN?: number; mealAsks?: number; mealFor?: string;
  indoorAsked?: 1; fameAsked?: 0 | 1; cityLow?: string }
/** a destination in a country list (built in, or from Claude) */
/** isl = the island a town is on; whole = the entry is an island itself (kept only so an older trip that has one as a stop still works) */
interface BuiltCity extends LatLng { name: string; region?: string; isl?: string; whole?: number; top?: number; w?: number; pop?: number; t?: string[]; d?: string; spots?: Spot[] }
interface Country { name: string; mode: "manual" | "suggest"; picked: string[] }
interface Stay { label: string; lat?: number | null; lng?: number | null; live?: { total: number; cur: string; url: string; at: number; in: string; out: string; src: string } }
/** the trip, as saved (localStorage "waypoint-v2" and the account) */
interface TripState { v: 2; algo?: number; tripId?: string; tripName?: string; styles: string[]; focus?: Focus; countries: Country[]; days: number; start: string; depart: string; travelers: (number | "")[]; names?: string[];
  stays: Record<string, Stay>; picks: Record<string, string>; seen: Record<string, string[]>; mine?: Record<string, 1>; free?: Record<string, 1>; rest?: Record<string, 1>; fold?: Record<string, unknown>; legPick?: Record<string, unknown>; nope?: Record<string, string>; eat?: { al?: string[]; di?: string[]; love?: string; avoid?: string; note?: string }; eatNone?: 1; eatOpen?: { al?: boolean; di?: boolean }; bag?: Record<string, Record<string, 1>>;
  cityDays: Record<string, number>; day: number; tview?: "days" | "map"; glanceOpen?: boolean; allPref?: boolean; stepClosed?: Record<string, boolean>; prepTab?: string; transitOpen?: unknown; jetOpen?: unknown; nextHide?: unknown; tripFolded?: any; mapZoom?: number; late?: any;
  appMode?: string; appModeAt?: string; exF?: unknown; exSort?: unknown; pack?: Record<string, unknown>; packHide?: Record<string, 1>; packOwn?: PackItem[]; journal?: Record<string, { mood?: number; note?: string; photos?: { id: string; [k: string]: any }[] }>;
  kidPicks?: Record<string, string[]>; hunt?: Record<string, Record<string, 1>>; stamps?: Record<string, string>; celebrated?: Record<string, string>; warmSeen?: string; lodge?: Record<string, string>; lodgeSeen?: Record<string, string[]>;
  share?: any; imported?: any; bookings?: Booking[]; booked?: Record<string, any>; rl?: Record<string, number[]>; under?: Record<string, [string, string, number]>; [k: string]: any }
interface Booking { key?: string; kind: string; title?: string; day?: number; [k: string]: any }
interface Costs { ages: string; cur?: string; breakfast?: number | null; lunch?: number | null; dinner?: number | null; transit?: number | null; lodge?: number | null; tickets: Record<string, number | null> }
interface Cache { country: Record<string, { blurb: string; cities: BuiltCity[]; v?: number; part?: number }>; city: Record<string, Pool>; geo: Record<string, LatLng & { area?: string }>;
  range: Record<string, { s?: number; r?: number; sig: string }>; legs?: Record<string, any>; cost: Record<string, Costs>; tz: Record<string, string>; live?: any; area: Record<string, any>;
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
interface TimeRow { start?: number; end?: number; skip?: boolean; late?: boolean; free?: boolean; label?: string; warn: string[]; info: string[] }
/** a booked journey with a time (lib/bookcore.js W.legTicket): minutes from midnight; an arrival the next day is past 1440 */
interface Ticket { kind: string; title: string; provider: string; ref: string; dep: number; arr: number | null }
/** one way of going, as Rome2Rio measured it (minutes door to door) */
interface R2RRoute { name: string; min: number; carriers: string[] }
interface DayTimes { rows: Partial<Record<Slot, TimeRow>>; nap?: { start: number; end: number; away?: boolean } | null;
  travel?: { start: number; end: number; leg?: Leg | null; ticket?: Ticket; dep?: number; arr?: number } | null;
  /** a free morning in the town you're leaving before a booked late departure */
  before?: { start: number; end: number; city: string } | null; [k: string]: any }
interface Leg { min: number; mode: string; km?: number; [k: string]: any }
interface Energy { level: number; label: string; walk: number; act: number; travel: number; score: number; big: number }
interface Countdown { big: string; small: string; line: string }
interface CheckItem { key: string; title?: string; short?: string; done: boolean; [k: string]: any }
interface PackItem { key: string; text: string; who?: string; why?: string; own?: boolean; group?: string; [k: string]: any }
interface PackLists { pack: PackItem[]; todo: PackItem[]; facts: Record<string, any>; hidden?: number }
interface Photo { url: string; credit?: string; page?: string; near?: string | boolean; /** a large copy of the same picture (stored by the nightly helper), for wide headers */ big?: string }
/** a checked place record (places/<city> in the database) */
/** g: Google's place ID (kept for good); gpin/gat: the pin came from Google on that day (kept 30 days, never on the free map) */
interface PlaceRecord { lat?: number | null; lng?: number | null; g?: string; gpin?: 1; gat?: string; [k: string]: any; checked?: string; osm?: string; name?: string; st?: Spot["st"]; site?: string; hours?: Hours; k?: Kid; note?: string; place?: string; replace?: Partial<Food & Spot> & { n: string }; approx?: 1; nopin?: 1; ashore?: 1; stay?: 1; pin_tried?: string; area?: 1; was?: [number, number] }
interface OfflineState { planSig(P: Plan): string; takeBlock?(P: Plan): string; exportCopy?(P: Plan): Promise<any>; photoUrls(P: Plan): string[]; copyNote(P: Plan): string; cities?: Record<string, { photos: number; of: number; map: boolean }>; tripBlock(P: Plan): string; state: string; n: number; total: number; at: number; maps: any[]; err: string; off: boolean; copy: boolean; trip: any; copyState: string; copyErr: string; why: string; save(P: Plan, why?: string): void; tick(P: Plan): void; src(url: string): string; block(P: Plan): string; takeBlock(P: Plan): string; exportCopy(P: Plan): Promise<void>; click(d: DOMStringMap, P: Plan): boolean; [k: string]: any }
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
  spot(x: unknown, center: LatLng | null): Spot | null; food(x: unknown, center: LatLng | null, dflt?: { meal?: Meal; pic?: string }): Food | null; city(c: unknown): BuiltCity | null; stayArea(x: unknown, center: LatLng | null): StayArea | null;
  lodging(x: unknown, center: LatLng | null, tiers: readonly Tier[], tier?: Tier): Lodging | null; transit(t: unknown): Transit | null; hours(h: unknown): Hours | null; beach(b: unknown): BeachFacts; status(x: unknown): "open" | "closed" | "unsure"; lead(x: unknown): number;
  tz(x: unknown): string; money(x: unknown): number | null; currency(x: unknown, dflt?: string): string; range(y: unknown): { s: number; r: number } | null; list<T extends { n?: string; name?: string }>(arr: unknown, fn: (x: any) => T | null): T[] }

/** the shared object every file adds to */
interface Waypoint {
  placeSearch: (q: string, country: string, city: string) => void;
  searchBlock: (day: Day, P: Plan) => string;
  searchClick: (d: DOMStringMap, day: Day, P: Plan) => boolean;
  dayRouteUrl: (day: Day, stops: { n: string; lat: number | null; lng: number | null; gid?: string }[], home: { label?: string; n?: string; lat: number | null; lng: number | null }) => string;
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
  altLinksFor: (kind: string, c: any) => any;
  altUrls: (kind: string, c: any) => any;
  anniversary: any;
  applyPlaces: (country: string, city: string, pool: Pool | null) => Pool | null;
  autoFound: any;
  autoLine: any;
  autoTick: any;
  autopilot: any;
  badForDay: (it: any, wd: any, slot?: any, kd?: any) => any;
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
  checkGroups: any;
  checklist: (P: Plan) => CheckItem[];
  cheer: (title: string, text?: string, opts?: { big?: boolean; go?: View }) => void;
  cityBusy: (ck: string) => boolean;
  cityKey: (country: string, city: string) => string;
  classify: (it: Spot | Food, food: boolean) => Classification;
  clock: (m: number) => string;
  closeStop: any;
  closeTripMenu: () => void;
  confetti: any;
  countdown: (P: Plan) => Countdown;
  countryCities: (name: string) => BuiltCity[];
  countryName: any;
  dataV: number;
  dateOf: (n: number) => Date | null;
  dayEnergy: (day: Day, P: Plan, T: DayTimes | null) => Energy | null;
  dayNav: any;
  dayOfDate: (iso: string) => number;
  dayPool: any;
  dayTimes: (day: Day, P: Plan) => DayTimes | null;
  dayTripMax: (p: any) => number;
  daysUntil: any;
  durText: (raw: unknown) => string;
  elderNames: () => string[];
  esc: (s: unknown) => string;
  extLink: (url: string, txt: string, cls?: string) => string;
  fameOf: (it: Spot | Food, idx?: number) => 0 | 1 | 2;
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
  glance: any;
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
  journalCard: (day: Day) => string;
  journalClick: any;
  journalHas: () => boolean;
  jumpToToday: ((P: Plan) => void) & { done?: any };
  keepInputs: (el: any, draw: () => void) => void;
  kidDinner: () => number | null;
  kidNames: (under?: number) => string[];
  kidPicks: any;
  km: (a: LatLng | null | undefined, b: LatLng | null | undefined) => number | null;
  lateClick: any;
  lateDinner: (country: string) => boolean;
  lateFor: (day: Day) => number;
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
  /** open the photo picker for a day's journal (screens/journal.js) */
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
  menuBlock: (it: any, day: Day) => string;
  /** the Settings screen's Storage card and its buttons (lib/storage.js) */
  storageCard: (card: (title: string, sub: string, body: string, id?: string) => string) => string;
  storageClick: (d: DOMStringMap) => boolean;
  /** asks Rome2Rio (your connector) for real journey times between two stops, on a tap */
  checkRoutes: (a: any, b: any) => void;
  r2rMsg: string;
  r2rMode: (name: string) => string;
  r2rFor: (routes: R2RRoute[] | undefined, mode: string) => R2RRoute | null;
  legKey: (a: { country: string; name: string }, b: { country: string; name: string }) => string;
  legMinutes: (a: any, b: any) => any;
  legSig: (o: any) => string;
  liveClick: (d: any, P: Plan) => any;
  liveFares: any;
  liveStays: any;
  bookingSearchUrl: (s: Stop, P: Plan, F?: { q: string; f: Record<string, number> }) => string;
  loadBookLinks: any;
  loadCity: (country: string, city: string, more?: any, stayDays?: number, nMore?: number) => void;
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
  lodgeSig: any;
  mcpMsg: (e: any, s?: any) => string;
  me: any;
  mealsFor: any;
  milestone: (P: Plan) => Milestone | null;
  minNights: (p: any) => number;
  modeName: (m: any) => string;
  modeOf: any;
  money: (n: number, cur?: string | null, raw?: any) => string;
  moodRow: any;
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
  openStop: any;
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
  picture: (it: Spot | Food, food: boolean, country: string, city: string, opts?: { credit?: boolean }) => string;
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
  /** join this device's unsent journal changes with another device's journal (photos by id, both notes) */
  mergeJournal: (mine: any, theirs: any) => { journal: any; changed: boolean };
  renderBook: any;
  renderGo: any;
  renderKids: any;
  renderNext: any;
  renderRecap: any;
  renderSettings: any;
  renderSetup: any;
  renderTrip: ((P: Plan, target?: string) => void) & { waiting?: any };
  replan: () => void;
  reroll: any;
  rescue: any;
  resetPicks: () => void;
  restKey: (d: { country: string; city: string; dayInCity: number }) => string;
  reviewsUrl: any;
  routeBody: any;
  routeCheck: any;
  routeClick: any;
  run: (key: string, prompt: string, tier: "quick" | "default" | "complex", onOk: (r: any) => void, stream?: { list: string; take: (items: any[], head: any) => void; min?: number }) => void;
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
  shortNote: any;
  shutBy: any;
  sitesRow: any;
  sky: any;
  slotOptions: (day: Day, slot: string, P: Plan) => any[];
  slug: (s: string) => string;
  smallNextToBig: (st: any[], i: number, p: any) => any;
  status: Record<string, string>;
  stayBar: any;
  stayInput: (ck: string, P: Plan, hotel?: any) => any;
  stayRange: (country: string, city: string) => any;
  stayText: (it: Spot | Food, food: boolean, slot: string) => string;
  stayTrack: any;
  stopAt: (s: Stop) => LatLng & { label?: string };
  stopDetails: (P: Plan, day: Day, x: any) => string;
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
  draw: (el: any, html: string, sig?: string) => void;
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
  sumText: any;
  suppressClick: any;
  syncable: any;
  takeItBlock: any;
  takeItClick: (d: any, P: Plan) => any;
  tickLabel: (key: string) => string;
  todayCard: any;
  todayN: (P?: Plan | null) => number | null;
  topLine: (P: Plan) => string;
  travelNudge: (P: Plan) => { key: string; k: string; text: string; sub: string; go: any } | null;
  travelOn: (P: Plan) => any;
  tripName: () => string;
  tripStats: any;
  tzFor: (country: string) => string;
  undoPoint: (before: any, label?: string) => void;
  unrescue: (day: any) => void;
  useIdea: (day: any, slot: string, name: string, P: Plan) => any;
  view: () => View;
  viewSwitch: () => string;
  vt: any;
  vtActive: () => boolean;
  pinGroups: <T>(pts: T[], project: (p: T) => { x: number; y: number }, minPx?: number) => { x: number; y: number; items: T[] }[];
  vtFor?: (country: string, city: string, lat?: number | null, lng?: number | null) => string | null;   /* (lib/vtindex.js; guarded where it is used) */
  vtLoadTest: any;
  vtMount: (slot: any, o: any) => boolean;
  /** Simple view (this phone only): no photos, no street map, fewer words */
  simple: () => boolean;
  /** turn Simple view on or off (saved on this phone) and redraw */
  setSimple: (on: boolean) => void;
  /** the Simple view switch, as drawn in the trip menu and Settings */
  simpleSwitch: () => string;
  /** the street map's cover over the detailed tiles that loaded: tile keys "z/x/y" -> GeoJSON boxes at one zoom (for the tests) */
  vtState: () => string;
  vtWarm: (slug: string) => any;
  vtWorkerUsed: any;
  vtZoom: (how: any) => void;
  wantPhotos: (country: string, city: string, pool: Pool | null, P?: Plan) => void;
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
  routeStop: (p: { it?: any; n: string; lat?: number | null; food?: boolean; slot: string; num: number }, city: string, when: string, cls?: string, key?: string) => string;
  kindIcon: (it: any, food: boolean, slot?: string) => string;
  stopTag: (n: number) => string;
  stopMark: (it: any, food: boolean, slot: string | undefined, n: number) => string;
  homeMark: () => string;
  /** a city's own photo for its header: the city, else the first of these places with one, else its best-known sight */
  cityPhoto: (country: string, city: string, prefer?: (Spot | Food)[]) => Photo | null;
  /** the photo filling a header, with its credit */
  heroImg: (ph: Photo, alt: string, lazy?: boolean) => string;
  /** a drawn face for a day's mood (3 great, 2 good, 1 tough) */
  moodFace: (m: number) => string;
  /** which Claude request goes next: 0 first (things you asked for), higher later */
  loadPrio: (key: string) => number;
  warmTick: (P: Plan) => void;
  watchBanner: () => string;
  watchChip?: (kind: string, key: string, P?: Plan | null) => string;   /* (second script) */
  watchClick: (d: any, P: Plan) => any;
  watchDrop: any;
  watchDrops: () => any;
  watchList: () => any;
  weekday: (n: number) => number;
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
interface Element { value?: string; dataset?: DOMStringMap; click?(): void; focus(opts?: FocusOptions): void; blur?(): void; select?(): void; type?: string; checked?: boolean; files?: FileList | null;
  readOnly?: boolean; selectionStart?: number | null; selectionEnd?: number | null; setSelectionRange?(a: number, b: number): void; showPicker?(): void; offsetLeft?: number; offsetTop?: number; offsetWidth?: number; offsetHeight?: number; style?: CSSStyleDeclaration; hidden?: boolean; disabled?: boolean; __step?: any }

/* marks lib/patch.js and the day screen leave on elements they draw into */
interface Window { __WP_COPY_KEPT?: boolean }
interface HTMLElement { _sig?: string | null; _html?: string | null; _edges?: number }
