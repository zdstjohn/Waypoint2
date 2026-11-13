/* (Written by the v151 bug review; kept as the test of accounts on a shared phone: test/suites/accounts.js.)
   One shared phone (installable app), the REAL trip/lib/cloud.js and trip/lib/sync.js, loaded in
   a fresh vm context per page load. The account database is an in-memory Map (as in v149's syncsim.js); cloud.js's
   own REST layer is bypassed (window.claude is replaced by the in-memory db for the signed-in uid), but its sign-in,
   sign-out, putAway / bringBack / claim run as written. Stand-ins written here (not snapshot code): core.js's load of
   the saved trip and the example flag, W.save's "write when changed" and its stop while signing out (core.js; keep
   them in step). Prints "-> what: value" lines for the suite to read.
   node test/lib/acctsim.js <root>
   Also a library (v177): require() it for Phone, the account's store and a clock shared by several phones
   (test/lib/devsim.js: several devices on one trip). Each phone has its own listeners, can lose and regain its signal
   (ph.signal(false): its reads and writes fail as they do with no network, and nothing reaches it), may run on a
   clock that is wrong (ph.skew, ms), and draws its random numbers from a seed (ph.seed), so a run can be replayed. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const MAIN = require.main === module;
const SNAP = MAIN ? process.argv[2] : path.resolve(__dirname, "..", "..");
const CLOUD = new vm.Script(fs.readFileSync(path.join(SNAP, "trip/lib/cloud.js"), "utf8"), { filename: "cloud.js" });
const SYNC = new vm.Script(fs.readFileSync(path.join(SNAP, "trip/lib/sync.js"), "utf8"), { filename: "sync.js" });
const clock = { t: Date.UTC(2027, 5, 7, 8, 0, 0) };
const flush = async () => { for (let i = 0; i < 15; i++) await new Promise(r => setImmediate(r)); };

const store = new Map(), listeners = [];
function notify(colPath) { listeners.filter(l => l.path === colPath && l.alive).forEach(l => setImmediate(l.emit)); }
const noNet = () => Promise.reject(new Error("no network"));   /* (no code: what a request that reached nobody looks like) */
function makeDb(ph) {
  const snapDoc = (p, data) => ({ id: p.slice(p.lastIndexOf("/") + 1), exists: data != null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))), metadata: { fromCache: false, hasPendingWrites: false } });
  const parent = p => p.replace(/\/[^/]*$/, "");
  const docRef = p => ({ id: p.slice(p.lastIndexOf("/") + 1),
    get: () => ph.off ? noNet() : Promise.resolve(snapDoc(p, store.get(p))),
    set: d => { if (ph.off) return noNet(); store.set(p, JSON.parse(JSON.stringify(d))); notify(parent(p)); return Promise.resolve(); },
    delete: () => { if (ph.off) return noNet(); store.delete(p); notify(parent(p)); return Promise.resolve(); },
    collection: sub => colRef(p + "/" + sub), onSnapshot: () => () => {} });
  const colRef = p => ({ doc: id => docRef(p + "/" + id),
    get: () => ph.off ? noNet() : Promise.resolve({ docs: [...store.keys()].filter(k => parent(k) === p).map(k => snapDoc(k, store.get(k))) }),
    onSnapshot: next => { const have = {};
      const l = { path: p, alive: true, ph, emit: () => { if (!l.alive || ph.off) return;
        const now = {}; [...store.keys()].filter(k => parent(k) === p).forEach(k => (now[k] = JSON.stringify(store.get(k))));
        const changes = [];
        Object.keys(have).filter(k => !(k in now)).forEach(k => { changes.push({ type: "removed", doc: snapDoc(k, JSON.parse(have[k])) }); delete have[k]; });
        Object.keys(now).forEach(k => { if (have[k] !== now[k]) { changes.push({ type: have[k] ? "modified" : "added", doc: snapDoc(k, store.get(k)) }); have[k] = now[k]; } });
        next({ docs: Object.keys(now).sort().map(k => snapDoc(k, store.get(k))), docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } }); } };
      listeners.push(l); setImmediate(l.emit); return () => { l.alive = false; }; } });
  return { doc: docRef, collection: colRef };
}
const EXAMPLE = { v: 2, algo: 2, styles: [], countries: [{ name: "Italy", mode: "manual", picked: ["Rome", "Florence"] }], days: 7, start: "", depart: "Los Angeles (LAX)", travelers: [38, 36, 6, 3], stays: {}, picks: {}, seen: {}, day: 1, cityDays: {} };

function Phone(seed) { this.ls = {}; this.sess = null; this.off = false; this.skew = 0; this.seed = seed || 0; }
Phone.prototype.open = async function (noWait) {
  if (this.sess) this.close();
  const ph = this, timers = [], evs = {};
  let reloaded = false, logoutResolve = null;
  const ls = { getItem: k => (k in ph.ls ? ph.ls[k] : null), setItem: (k, v) => { ph.ls[k] = String(v); }, removeItem: k => { delete ph.ls[k]; },
    key: i => Object.keys(ph.ls)[i] || null, get length() { return Object.keys(ph.ls).length; } };
  const doc = { addEventListener: (ev, fn) => (evs[ev] = evs[ev] || []).push(fn), visibilityState: "visible", body: null, querySelector: () => null,
    documentElement: { classList: { toggle() {}, add() {}, remove() {} } } };
  /* (a seeded phone draws its ids and its waits from its seed) */
  let rs = (ph.seed * 2654435761 + 97) >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; ph.seed = rs; return rs / 4294967296; };
  const cryp = ph.seed ? { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(rnd() * 256); return a; } } : globalThis.crypto;
  const ctx = { document: doc, localStorage: ls, crypto: cryp, console, navigator: { onLine: !ph.off }, JSON,
    location: { hash: "", reload: () => { reloaded = true; } },
    setTimeout: (fn, ms) => { const id = timers.length + 1; timers.push({ id, at: clock.t + (ms || 0), fn, on: true }); return id; },
    clearTimeout: id => { const t = timers.filter(x => x.id === id)[0]; if (t) t.on = false; },
    fetch: (url, o) => {
      if (/token\?grant_type=password/.test(url)) { const b = JSON.parse(o.body), id = b.email.split("@")[0];
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ access_token: "tok-" + id, refresh_token: "r", expires_in: 3600, user: { id, email: b.email } }) }); }
      if (/logout/.test(url)) return new Promise(r => { logoutResolve = () => r({ ok: true, status: 204 }); });
      return Promise.reject(new Error("no network in this harness: " + url));
    } };
  ctx.window = ctx; ctx.addEventListener = (ev, fn) => (evs["w:" + ev] = evs["w:" + ev] || []).push(fn);
  ctx.__WP_STANDALONE = { cloud: { url: "https://example.invalid", key: "anon" } };
  vm.createContext(ctx);
  vm.runInContext("Date.now = function () { return __clk.t + __ph.skew; };" + (ph.seed ? "Math.random = __rnd;" : ""), Object.assign(ctx, { __clk: clock, __ph: ph, __rnd: rnd }));
  CLOUD.runInContext(ctx);
  const C = ctx.__WP_CLOUD;
  const uid = C.session ? C.session.user.id : null;
  if (uid) { const db = makeDb(ph); ctx.claude = { use: n => Promise.resolve(n === "db" ? db : n === "user" ? { id: () => Promise.resolve(uid), can: () => Promise.resolve(true) } : null) }; }
  else delete ctx.claude;
  /* core.js:155-168 and 222-266 (stand-in) */
  const W = { $: () => null, esc: s => String(s), ago: () => "", C: { country: {}, city: {}, legs: {} }, P: null, readOnly: null,
    cityKey: (c, n) => c + "|" + n, slug: s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"), norm: s => String(s).toLowerCase(),
    replan() {}, releaseLoads() {}, render() {}, setView() {}, fxAfter() {}, fxFlip: (a, b, fn) => fn(), backOpen() {}, backShut() {}, caught() {}, V: { shared: x => x } };
  ctx.W = W;
  let s = null; try { s = JSON.parse(ls.getItem("waypoint-v2")); } catch (e) {}
  W.S = s && s.v === 2 ? s : JSON.parse(JSON.stringify(EXAMPLE));
  if (!s) W.S.example = 1;
  W.isExample = !s || !!W.S.example;
  const planSig = st => JSON.stringify([st.countries, st.days, st.start, st.depart, st.travelers, st.styles, st.stays, st.cityDays]);
  const exampleSig = W.S.example ? planSig(W.S) : "";
  let lastS = null;
  W.save = () => { if (ctx.__WP_AWAY) return; if (W.S.example && planSig(W.S) !== exampleSig) { delete W.S.example; W.isExample = false; }
    const js = JSON.stringify(W.S); if (js !== lastS) { ls.setItem("waypoint-v2", js); lastS = js; } if (W.afterSave) W.afterSave(); };
  W.changed = () => W.save();
  SYNC.runInContext(ctx);
  this.sess = { W, C, timers, evs, uid, ctx, reloaded: () => reloaded, logout: () => logoutResolve && logoutResolve() };
  W.save();
  if (noWait) return this;
  await flush(); await this.wait(3500);
  return this;
};
Phone.prototype.wait = async function (ms) {
  const end = clock.t + ms, s = this.sess;
  for (;;) { const due = s.timers.filter(t => t.on && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; clock.t = Math.max(clock.t, due.at); due.on = false; due.fn(); await flush(); }
  clock.t = end; await flush();
};
Phone.prototype.tap = function (target) { (this.sess.evs.click || []).forEach(f => f({ isTrusted: true, target: target || { closest: () => null }, preventDefault() {} })); };
Phone.prototype.edit = async function (fn) { this.tap(); fn(this.sess.W.S); this.sess.W.save(); await this.wait(2000); };
Phone.prototype.menu = function (sync, id) { this.tap({ closest: s => (s === "[data-sync]" ? { dataset: { sync, id } } : null) }); };
Phone.prototype.close = function () { if (this.sess) { this.sess.timers.forEach(t => (t.on = false)); listeners.forEach(l => { if (l.ph === this) l.alive = false; }); this.sess = null; } };
/* the signal goes, or comes back (the listeners then hear how the account stands now, as a real one does on reconnecting) */
Phone.prototype.signal = function (on) {
  this.off = !on; if (!this.sess) return;
  this.sess.ctx.navigator.onLine = !!on;
  if (on) { (this.sess.evs["w:online"] || []).forEach(f => f()); listeners.filter(l => l.ph === this && l.alive).forEach(l => setImmediate(l.emit)); }
};
/* time passes for several phones at once: every open phone's timers run in the order they fall due */
async function waitAll(phones, ms) {
  const end = clock.t + ms;
  for (;;) {
    let due = null;
    phones.forEach(p => { if (p.sess) p.sess.timers.forEach(t => { if (t.on && t.at <= end && (!due || t.at < due.at)) due = t; }); });
    if (!due) break;
    clock.t = Math.max(clock.t, due.at); due.on = false; due.fn(); await flush();
  }
  clock.t = end; await flush();
}
Phone.prototype.idx = function () { return JSON.parse(this.ls["waypoint-trips-v1"] || "{}"); };
Phone.prototype.pagehide = function () { (this.sess.evs["w:pagehide"] || []).forEach(f => f()); };
const acct = uid => [...store.keys()].filter(k => k.indexOf("data/users/" + uid + "/trips/t/") === 0).map(k => ({ id: k.split("/").pop(), name: store.get(k).name, bookings: store.get(k).state.bookings }));
const say = (k, v) => console.log("   -> " + k + ": " + JSON.stringify(v));
const rome = (extra) => Object.assign({}, EXAMPLE, { countries: [{ name: "Italy", mode: "manual", picked: ["Rome"] }], tripId: "trome", tripName: "Rome 2027", start: "2027-06-07", packOwn: [], bookings: [{ kind: "lodging", title: "Hotel Artemide", ref: "ANN-12345" }] }, extra || {});

async function signIn(ph, who) { await ph.sess.C.signIn(who + "@example.com", "pw"); await flush(); if (!ph.sess.reloaded()) throw new Error("no reload"); ph.close(); await ph.open(); }
async function signOut(ph, during) { ph.sess.C.signOut(); await flush(); if (during) await during(); ph.sess.logout(); await flush(); ph.pagehide(); if (!ph.sess.reloaded()) throw new Error("no reload"); ph.close(); await ph.open(); }
async function annSetup() {
  store.clear(); listeners.length = 0;
  const ph = new Phone(); await ph.open();                         /* new phone, signed out: the example */
  await signIn(ph, "ann");
  /* Ann makes "Rome 2027" (open) and has "Lisbon" in her list, both saved to her account */
  ph.sess.W.S.countries = [{ name: "Portugal", mode: "manual", picked: ["Lisbon"] }]; ph.sess.W.S.tripName = "Lisbon"; await ph.edit(() => {});
  ph.sess.ctx.W.newTripFrom && ph.sess.ctx.W.newTripFrom(rome({ tripId: undefined })); await ph.wait(2500);
  await ph.edit(S => { S.bookings = [{ kind: "lodging", title: "Hotel Artemide", ref: "ANN-12345" }]; });
  return ph;
}

module.exports = { Phone, store, listeners, clock, flush, waitAll, signIn, EXAMPLE };
if (MAIN) (async () => {
  console.log("\n=== 1. control: Ann signs out, Ann signs in again (the example in between) ===");
  let ph = await annSetup();
  say("Ann's account", acct("ann").map(x => x.name)); const annOpen = ph.sess.W.S.tripId; say("open on the phone", ph.sess.W.S.tripName);
  await signOut(ph); say("signed out, trip on screen", ph.sess.W.S.tripName || "(example) " + !!ph.sess.W.S.example);
  await signIn(ph, "ann"); say("Ann back: on screen", ph.sess.W.S.tripName); say("index", Object.values(ph.idx()).map(x => x.name + (x.state ? "" : " [no state]")));

  console.log("\n=== 2. Ann signs out; Grandpa uses the tablet without an account and changes the plan; Ann signs in again ===");
  ph = await annSetup(); const annOpen2 = ph.sess.W.S.tripId;
  await ph.edit(S => { S.packOwn = [{ key: "own-offline", text: "typed offline, not yet sent", who: "all", todo: false }]; });   /* (sent: no network blocking in this harness) */
  await signOut(ph);
  await ph.edit(S => { S.countries = [{ name: "France", mode: "manual", picked: ["Paris"] }]; S.tripName = "Grandpa's Paris"; });
  say("Grandpa's trip on screen", ph.sess.W.S.tripName + " example? " + !!ph.sess.W.S.example);
  await signIn(ph, "ann");
  say("on screen after Ann signs in", ph.sess.W.S.tripName);
  const ix = ph.idx(); say("index", Object.keys(ix).map(id => ix[id].name + (ix[id].state || id === ph.sess.W.S.tripId ? "" : " [no state]")));
  ph.menu("open", annOpen2); await ph.wait(1000);
  say("after tapping 'Rome 2027' in Your trips, on screen", ph.sess.W.S.tripName + " own packing: " + JSON.stringify(ph.sess.W.S.packOwn));
  await ph.wait(30000); say("30 s later, Rome in index has state?", !!(ph.idx()[annOpen2] || {}).state);
  say("Ann's account", acct("ann").map(x => x.name));

  console.log("\n=== 3. Ann taps Sign out; the logout request is slow; she taps a day meanwhile (W.save); Ben signs in ===");
  ph = await annSetup();
  await signOut(ph, async () => { ph.sess.W.S.day = 3; ph.sess.W.save(); await flush(); });
  say("signed out, no account: on screen", (ph.sess.W.S.tripName || "?") + " bookings " + JSON.stringify(ph.sess.W.S.bookings || null));
  await signIn(ph, "ben");
  say("Ben signs in: on screen", ph.sess.W.S.tripName);
  say("Ben's account", acct("ben"));

  console.log("\n=== 4. the same, but Ann changed something a moment before tapping Sign out (pending write flushed on pagehide) ===");
  ph = await annSetup();
  ph.tap(); ph.sess.W.S.picks["Italy|Rome|2|am"] = "Villa Borghese"; ph.sess.W.save(); await flush();   /* < 1.5 s before Sign out */
  await signOut(ph);
  say("after reload, waypoint-trips-v1 on the phone", Object.values(ph.idx()).map(x => x.name));
  say("on screen", ph.sess.W.S.tripName || "(example)");
  await signIn(ph, "ben");
  say("Ben: on screen", ph.sess.W.S.tripName || "(example)"); say("Ben's index", Object.values(ph.idx()).map(x => x.name + (x.gone ? " [gone]" : "")));
  say("Ben's account", acct("ben").map(x => x.name));

  console.log("\n=== 5. a first-time user (empty account) signs in on a new phone and answers the quick start ===");
  store.clear(); listeners.length = 0;
  ph = new Phone(); await ph.open(); await signIn(ph, "zoe");
  ph.tap(); ph.sess.W.newTripFrom({ v: 2, algo: 2, styles: [], countries: [{ name: "Greece", mode: "suggest", picked: [], rank: 2 }], days: 10, start: "2027-07-01", depart: "", travelers: [35, 35, 4], stays: {}, picks: {}, seen: {}, mine: {}, cityDays: {}, tripName: "Greece trip" });
  await ph.wait(3000);
  say("Zoe's account right after", acct("zoe").map(x => x.name));
  ph.close(); await ph.open(); await ph.wait(3000);
  say("Zoe's account after the app is opened again", acct("zoe").map(x => x.name));
})().catch(e => { console.error(e); process.exit(1); });
