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
  styleAsked?: Record<string, 1>; indoorAsked?: 1; gemsAsked?: 0 | 1; fameAsked?: 0 | 1; cityLow?: string }
/** a destination in a country list (built in, or from Claude) */
interface BuiltCity extends LatLng { name: string; region?: string; w?: number; pop?: number; t?: string[]; d?: string; spots?: Spot[] }
interface Country { name: string; mode: "manual" | "suggest"; picked: string[] }
interface Stay { label: string; lat?: number | null; lng?: number | null; live?: { total: number; cur: string; url: string; at: number; in: string; out: string; src: string } }
/** the trip, as saved (localStorage "waypoint-v2" and the account) */
interface TripState { v: 2; algo?: number; tripId?: string; tripName?: string; styles: string[]; focus?: Focus; countries: Country[]; days: number; start: string; depart: string; travelers: (number | "")[]; names?: string[];
  stays: Record<string, Stay>; picks: Record<string, string>; seen: Record<string, string[]>; mine?: Record<string, 1>; free?: Record<string, 1>; rest?: Record<string, 1>; fold?: Record<string, unknown>; legPick?: Record<string, unknown>; nope?: Record<string, string>; eat?: { al?: string[]; di?: string[]; love?: string; avoid?: string; note?: string }; eatNone?: 1; bag?: Record<string, Record<string, 1>>;
  cityDays: Record<string, number>; day: number; tview?: "days" | "map" | "story"; glanceOpen?: boolean; stepClosed?: Record<string, boolean>; prepTab?: string; transitOpen?: unknown; jetOpen?: unknown; nextHide?: unknown; tripFolded?: any; mapZoom?: number; late?: any;
  appMode?: string; appModeAt?: string; exF?: unknown; exSort?: unknown; pack?: Record<string, unknown>; packHide?: Record<string, 1>; packOwn?: PackItem[]; journal?: Record<string, { mood?: number; note?: string; photos?: { id: string; [k: string]: any }[] }>;
  kidPicks?: Record<string, string[]>; hunt?: Record<string, Record<string, 1>>; stamps?: Record<string, string>; celebrated?: Record<string, string>; warmSeen?: string; lodge?: Record<string, string>; lodgeSeen?: Record<string, string[]>;
  share?: any; imported?: any; bookings?: Booking[]; booked?: Record<string, any>; [k: string]: any }
interface Booking { key?: string; kind: string; title?: string; day?: number; [k: string]: any }
interface Costs { ages: string; cur?: string; breakfast?: number | null; lunch?: number | null; dinner?: number | null; transit?: number | null; lodge?: number | null; tickets: Record<string, number | null> }
interface Cache { country: Record<string, { blurb: string; cities: BuiltCity[] }>; city: Record<string, Pool>; geo: Record<string, LatLng & { area?: string }>;
  range: Record<string, { s?: number; r?: number; sig: string }>; legs?: Record<string, any>; cost: Record<string, Costs>; tz: Record<string, string>; live?: any; area: Record<string, any>;
  /** holidays and festivals from Claude per city, for the dates asked about (lib/holidays.js) */
  events: Record<string, { v: number; from: string; to: string; items: CityEvent[] }> }
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
interface Plan { stops: Stop[]; days: Day[]; N: number; p: Party; ap: Airport | null }
interface Homebase extends LatLng { label: string; set: boolean; pending?: boolean }
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
interface Photo { url: string; credit?: string; page?: string; near?: string | boolean }
/** a checked place record (places/<city> in the database) */
/** g: Google's place ID (kept for good); gpin/gat: the pin came from Google on that day (kept 30 days, never on the free map) */
interface PlaceRecord { lat?: number | null; lng?: number | null; g?: string; gpin?: 1; gat?: string; [k: string]: any; checked?: string; osm?: string; name?: string; st?: Spot["st"]; site?: string; hours?: Hours; k?: Kid; note?: string; place?: string; replace?: Partial<Food & Spot> & { n: string }; approx?: 1; nopin?: 1; ashore?: 1; stay?: 1; pin_tried?: string; area?: 1; was?: [number, number] }
interface OfflineState { cities?: Record<string, { photos: number; of: number; map: boolean }>; tripBlock(P: Plan): string; state: string; n: number; total: number; at: number; maps: any[]; err: string; off: boolean; copy: boolean; trip: any; copyState: string; copyErr: string; why: string; save(P: Plan, why?: string): void; tick(P: Plan): void; src(url: string): string; block(P: Plan): string; takeBlock(P: Plan): string; exportCopy(P: Plan): Promise<void>; click(d: DOMStringMap, P: Plan): boolean; [k: string]: any }
interface ReadOnly { code: string; [k: string]: any }
interface Milestone { key: string; title: string; text: string; also?: string[]; go?: View }
interface Readiness { pct: number; [k: string]: any }
/** the one door for Claude's answers (lib/validate.js) */
interface Validators { stats: { dropped: number; cleared: number; farPins: number }; str(x: unknown, max?: number): string; name(x: unknown): string | null; num(x: unknown): number | null; clamp(x: unknown, lo: number, hi: number, dflt: number): number;
  oneOf<T extends string>(x: unknown, list: readonly T[], dflt: T): T; intOf<T extends number>(x: unknown, set: readonly T[], dflt: T | undefined): T | undefined; fame(x: unknown): Fame | undefined; rating(x: unknown): number | undefined; tags(t: unknown): string[]; url(x: unknown): string;
  pin(lat: unknown, lng: unknown): { lat: number; lng: number } | null; pinNear(lat: unknown, lng: unknown, center: LatLng | null | undefined, km?: number): { lat: number; lng: number } | null;
  spot(x: unknown, center: LatLng | null): Spot | null; food(x: unknown, center: LatLng | null, dflt?: { meal?: Meal; pic?: string }): Food | null; city(c: unknown): BuiltCity | null; stayArea(x: unknown, center: LatLng | null): StayArea | null;
  lodging(x: unknown, center: LatLng | null, tiers: readonly Tier[], tier?: Tier): Lodging | null; transit(t: unknown): Transit | null; hours(h: unknown): Hours | null; beach(b: unknown): BeachFacts; status(x: unknown): "open" | "closed" | "unsure"; lead(x: unknown): number;
  tz(x: unknown): string; money(x: unknown): number | null; currency(x: unknown, dflt?: string): string; range(y: unknown): { s: number; r: number } | null; list<T extends { n?: string; name?: string }>(arr: unknown, fn: (x: any) => T | null): T[] }

/** the shared object every file adds to */
interface Waypoint {
  placeSearch: (q: string, country: string, city: string) => void;
  searchBlock: (day: Day, P: Plan) => string;
  searchClick: (d: DOMStringMap, day: Day, P: Plan) => boolean;
  searchState: () => { q: string; n: number; busy: boolean };
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
  ago: any;
  airport: any;
  altLinksFor: any;
  altUrls: any;
  anniversary: any;
  applyPlaces: (country: string, city: string, pool: Pool | null) => Pool | null;
  autoFound: any;
  autoLine: any;
  autoTick: any;
  autopilot: any;
  badForDay: any;
  beachFit: any;
  bestOrder: any;
  betweenCities: any;
  bookClick: any;
  bookEnter: any;
  bookEntryFor: any;
  bookReveal: any;
  bookTimeline: any;
  bookUrl: (u: unknown) => string;
  airport: () => Airport | null;
  bookedRow: any;
  bookingFor: any;
  budget: any;
  calEvents: any;
  callTool: any;
  changed: () => void;
  checkGroups: any;
  checklist: (P: Plan) => CheckItem[];
  cheer: (title: string, text?: string, opts?: { big?: boolean; go?: View }) => void;
  cityBusy: any;
  cityKey: (country: string, city: string) => string;
  classify: (it: Spot | Food, food: boolean) => Classification;
  clock: any;
  closeStop: any;
  closeTripMenu: any;
  confetti: any;
  countdown: (P: Plan) => Countdown;
  countryBlurb: (name: string) => string;
  countryCities: (name: string) => BuiltCity[];
  countryName: any;
  dataV: number;
  dateOf: (n: number) => Date | null;
  dayEnergy: (day: Day, P: Plan, T: DayTimes | null) => Energy | null;
  dayNav: any;
  dayOfDate: (iso: string) => number;
  dayPool: any;
  dayTimes: (day: Day, P: Plan) => DayTimes | null;
  dayTripMax: any;
  daysUntil: any;
  durText: (raw: unknown) => string;
  elderNames: () => string[];
  esc: (s: unknown) => string;
  extLink: any;
  fameOf: (it: Spot | Food, idx?: number) => 0 | 1 | 2;
  family: () => Traveler[];
  familyActs: any;
  familyClick: any;
  familyLine: () => string;
  familyTick: any;
  fareChip: any;
  fareInput: any;
  fareMin: any;
  ferrySearch: any;
  findCity: (country: string, name: string) => BuiltCity | null;
  flightHrs: any;
  flightsUrl: any;
  fmtKm: any;
  fmtMin: any;
  focus: () => Focus;
  focusAsk: () => string;
  foldKey: any;
  freshAll: () => void;
  freshPicks: (country: string, city: string) => void;
  fxAfter: any;
  fxCollapse: any;
  fxExpand: any;
  fxFlip: (kind: string, dir: number, update: () => void, after?: (() => void) | null) => void;
  fxFlipsOff: () => boolean;
  fxOff: any;
  fxPulse: any;
  fxRunAfter: any;
  fxStagger: any;
  geocode: any;
  getMcp: any;
  /** helpers lib/bookcore.js shares with screens/book.js */
  _bk: any;
  glance: any;
  gmapsDir: any;
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
  importClick: any;
  isBeach: any;
  isExample: boolean;
  isFerry: any;
  isFood: (slot: string) => boolean;
  isPaid: (it: Spot | Food) => boolean;
  isRest: any;
  isToday: any;
  iso: any;
  isoDay: (d: Date) => string;
  jetlag: any;
  joinNames: any;
  journalCard: any;
  journalClick: any;
  journalHas: any;
  jumpToToday: any;
  keepInputs: any;
  kidDinner: any;
  kidNames: (under?: number) => string[];
  kidPicks: any;
  km: (a: LatLng | null | undefined, b: LatLng | null | undefined) => number | null;
  lateClick: any;
  lateDinner: any;
  lateFor: any;
  lateShift: any;
  leg: (a: LatLng | null | undefined, b: LatLng | null | undefined) => Leg | null;
  legBusy: any;
  legFor: any;
  legTicket: (P: Plan, si: number) => Ticket | null;
  loadEvents: (country: string, city: string, from: string, to: string) => void;
  easter: (y: number) => string;
  orthodoxEaster: (y: number) => string;
  holidayCountries: string[];
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
  markTouched: () => void;
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
  awakeRefused: () => boolean;
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
  journalPick: (k: string) => void;
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
  legKey: any;
  legMinutes: any;
  legSig: any;
  liveClick: any;
  liveFares: any;
  liveStays: any;
  loadBookLinks: any;
  loadBreakfast: any;
  loadCity: any;
  loadCosts: any;
  loadCountry: any;
  loadFame: any;
  loadGems: any;
  loadIndoor: any;
  loadLeg: any;
  loadLodging: any;
  loadScript: any;
  loadStayRanges: any;
  loadStyleIdeas: any;
  loadTz: any;
  lodgeList: any;
  lodgeReroll: any;
  lodgeShown: any;
  lodgeSig: any;
  mcpMsg: any;
  me: any;
  mealLike: any;
  mealsFor: any;
  milestone: (P: Plan) => Milestone | null;
  minNights: any;
  modeName: any;
  modeOf: any;
  modeSeg: any;
  money: any;
  moodRow: any;
  moveEvery: any;
  needsBooking: (it: Spot | Food) => boolean;
  newTripBlank: any;
  newTripFrom: any;
  nextStep: any;
  norm: (s: unknown) => string;
  normBeach: any;
  normHours: any;
  notForLine: any;
  now: () => Date;
  nowMin: any;
  officialLink: any;
  officialUrl: any;
  offline: OfflineState;
  onData: any;
  openStay: any;
  openStop: any;
  packBlock: any;
  packClick: any;
  packFacts: any;
  packReset: any;
  packing: (P: Plan) => PackLists;
  parseDur: (s: string) => number | null;
  party: () => Party;
  photoFor: (it: { n: string; place?: string }, food: boolean, country: string, city: string) => Photo | null;
  photosSeed: any;
  photosSnapshot: any;
  photosUrl: any;
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
  quickStart: any;
  readOnly: ReadOnly | false | null;
  readiness: (P: Plan) => Readiness;
  readyRing: any;
  releaseLoads: any;
  render: () => void;
  renderBar: any;
  renderBook: any;
  renderGo: any;
  renderKids: any;
  renderNext: any;
  renderRecap: any;
  renderSettings: any;
  renderSetup: any;
  renderTrip: any;
  replan: () => void;
  reroll: any;
  rescue: any;
  resetPicks: () => void;
  restKey: any;
  reviewsUrl: any;
  routeBody: any;
  routeCheck: any;
  routeClick: any;
  run: (key: string, prompt: string, tier: "quick" | "default" | "complex", onOk: (r: any) => void) => void;
  sampleState: "waiting" | "on" | "off";
  save: () => void;
  saveFold: any;
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
  shortNote: any;
  shutBy: any;
  sitesRow: any;
  sky: any;
  slotOptions: any;
  slug: (s: string) => string;
  smallNextToBig: any;
  status: Record<string, string>;
  stayBar: any;
  stayInput: any;
  stayRange: any;
  stayText: (it: Spot | Food, food: boolean, slot: string) => string;
  stayTrack: any;
  stopAt: (s: Stop) => LatLng & { label?: string };
  stopDetails: any;
  storyFit: any;
  storyHtml: any;
  storyMount: any;
  sumText: any;
  suppressClick: any;
  syncable: any;
  takeItBlock: any;
  takeItClick: any;
  tickLabel: any;
  todayCard: any;
  todayN: (P?: Plan | null) => number | null;
  topLine: any;
  travelNudge: any;
  travelOn: any;
  tripName: () => string;
  tripStats: any;
  tripTop: any;
  tzFor: (country: string) => string;
  undoPoint: any;
  unrescue: any;
  useIdea: any;
  view: () => View;
  viewSwitch: any;
  vt: any;
  vtActive: any;
  pinGroups: <T>(pts: T[], project: (p: T) => { x: number; y: number }, minPx?: number) => { x: number; y: number; items: T[] }[];
  vtFor: any;
  vtLoadTest: any;
  vtMount: any;
  vtPending: any;
  vtReadParts: any;
  vtState: any;
  vtWarm: any;
  vtWorkerUsed: any;
  vtZoom: any;
  wantPhotos: (country: string, city: string, pool: Pool | null, P?: Plan) => void;
  IDEA_CAP: { spots: number; food: number };
  tripPhotoCoverage: (P: Plan) => { stops: number; withPhoto: number; pct: number; rows: { key: string; country: string; city: string; stops: number; urls: string[]; map: string | null; items: Record<string, string> }[] };
  vtSize: (slug: string) => number;
  logError: (msg: any, where: string, stack?: any) => void;
  currentView: () => string;
  flushErrors: () => void;
  errBuild: string;
  placeKey: (it: { n: string; cuisine?: string; meal?: string; [k: string]: any } | null | undefined) => string;
  laterReady: boolean;
  laterLoading?: boolean;
  loadLater: () => void;
  needLater: () => boolean;
  ideasFull: (pool: Pool | null | undefined) => boolean;
  warmTick: any;
  watchBanner: any;
  watchChip: any;
  watchClick: any;
  watchDrop: any;
  watchDrops: any;
  watchList: any;
  weekday: (n: number) => number;
  who: () => string;
  whoTags: (it: Spot | Food, food: boolean, cls: Classification | null) => string;
  withImported: any;
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
