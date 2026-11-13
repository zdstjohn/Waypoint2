/* Several devices, one trip (v177). The real trip/lib/sync.js and cloud.js run for each device in a vm of its own
   (test/lib/acctsim.js) against one in-memory account. From a seed, 2–4 of one person's devices take a random run of
   what a family does on a trip:
     - change a setting, or one entry of a per-slot or per-place map (a pick chosen by hand, a slot left free, a rest
       day, a stay, the days for a place, a packing tick, a "not for us"), or take one away
     - undo their own last change (put the value back, or take it away again)
     - lose the signal and get it back, close the app and open it again (changes made meanwhile wait on the phone)
     - let the planner fill a slot in on its own (never a person's change)
     - let time pass
   Every change is written down with the moment it was made. At the end every device opens, gets its signal back, and
   time passes; then
     - every device and the account hold the same trip, with the same times for its changes (all but what a planner
       filled in by itself, which is each device's own and never sent as a change)
     - each thing a person changed holds that person's latest change to it (the last one made, by the clock; when a
       device's clock is wrong, a change it made after seeing another's still counts as later, so there only: the
       devices agree, and the value is one that somebody did set last on some device)
     - what was taken away stays away, what was put back stays back
   run(seed) returns { ok, why, ops }. A failure is replayed with SYNC_SEED=<n> node test/run.js devices. */
const sim = require('./acctsim');
const { Phone, store, clock, waitAll, signIn } = sim;
function rng(seed) { let s = (Math.imul(seed, 2654435761) ^ 0x9e3779b9) >>> 0 || 1; const f = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; f(); f(); f(); return f; }
const pick = (r, a) => a[Math.floor(r() * a.length)], int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const SLOTS = ['Italy|Rome|1|am', 'Italy|Rome|1|pm', 'Italy|Rome|2|lunch', 'Italy|Rome|2|eve', 'Italy|Florence|1|am', 'Italy|Florence|1|dinner'];
const TOWNS = ['Italy|Rome', 'Italy|Florence', 'Italy|Venice'];
const START = { v: 2, algo: 2, styles: ['food'], countries: [{ name: 'Italy', mode: 'manual', picked: ['Rome', 'Florence'] }], days: 7, start: '2027-06-07', depart: 'Los Angeles (LAX)', travelers: [38, 36, 6, 3],
  stays: {}, picks: { 'Italy|Rome|1|am': 'Colosseum' }, seen: {}, mine: {}, cityDays: {}, tripName: 'Italy 2027' };
/* what can change: [path, how to set it on a state, how to clear it, a new value] */
const THINGS = [];
SLOTS.forEach(k => {
  THINGS.push({ p: 'picks::' + k, also: 'mine::' + k, set: (S, v) => { (S.picks = S.picks || {})[k] = v; (S.mine = S.mine || {})[k] = 1; }, del: S => { if (S.picks) delete S.picks[k]; if (S.mine) delete S.mine[k]; }, val: r => 'Place ' + int(r, 1, 999) });
  THINGS.push({ p: 'free::' + k, set: (S, v) => { (S.free = S.free || {})[k] = v; }, del: S => { if (S.free) delete S.free[k]; }, val: () => 1 });
});
TOWNS.forEach(k => {
  THINGS.push({ p: 'stays::' + k, set: (S, v) => { (S.stays = S.stays || {})[k] = v; }, del: S => { if (S.stays) delete S.stays[k]; }, val: r => ({ label: 'Hotel ' + int(r, 1, 999), lat: 41 + r(), lng: 12 + r() }) });
  THINGS.push({ p: 'cityDays::' + k, set: (S, v) => { (S.cityDays = S.cityDays || {})[k] = v; }, del: S => { if (S.cityDays) delete S.cityDays[k]; }, val: r => int(r, 1, 9) });
  THINGS.push({ p: 'rest::' + k + '|2', set: (S, v) => { (S.rest = S.rest || {})[k + '|2'] = v; }, del: S => { if (S.rest) delete S.rest[k + '|2']; }, val: () => 1 });
  THINGS.push({ p: 'nope::' + k + '|s:fountain', set: (S, v) => { (S.nope = S.nope || {})[k + '|s:fountain'] = v; }, del: S => { if (S.nope) delete S.nope[k + '|s:fountain']; }, val: () => 'Fountain' });
});
['sun hat', 'passports', 'stroller'].forEach(k => THINGS.push({ p: 'pack::' + k, set: (S, v) => { (S.pack = S.pack || {})[k] = v; }, del: S => { if (S.pack) delete S.pack[k]; }, val: () => 1 }));
THINGS.push({ p: 'days', set: (S, v) => { S.days = v; }, val: r => int(r, 3, 21) });
THINGS.push({ p: 'start', set: (S, v) => { S.start = v; }, val: r => '2027-0' + int(r, 1, 9) + '-1' + int(r, 0, 9) });
THINGS.push({ p: 'tripName', set: (S, v) => { S.tripName = v; }, val: r => 'Italy ' + int(r, 1, 999) });
THINGS.push({ p: 'travelers', set: (S, v) => { S.travelers = v; }, val: r => [38, 36, int(r, 1, 12)] });
THINGS.push({ p: 'styles', set: (S, v) => { S.styles = v; }, val: r => [pick(r, ['food', 'beach', 'culture'])] });
const read = (S, p) => { const i = p.indexOf('::'); if (i < 0) return S[p]; const m = S[p.slice(0, i)]; return m ? m[p.slice(i + 2)] : undefined; };
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b) && (a === undefined) === (b === undefined);

async function run(seed, opts) {
  opts = opts || {};
  const r = rng(seed * 2 + 11), n = int(r, 2, 4), skewed = opts.skew != null ? opts.skew : r() < 0.2, log = [], fail = why => ({ ok: false, why, ops: log });
  store.clear(); sim.listeners.length = 0; clock.t = Date.UTC(2027, 5, 7, 8, 0, 0) + seed * 1000;
  const phones = []; for (let i = 0; i < n; i++) { const ph = new Phone(seed * 10 + i + 1); if (skewed && i) ph.skew = int(r, -3, 3) * 3600000 + int(r, -500, 500); phones.push(ph); }
  /* the first device makes the trip; the others sign in and find it */
  await phones[0].open(); await signIn(phones[0], 'ann');
  phones[0].tap(); phones[0].sess.W.newTripFrom(JSON.parse(JSON.stringify(START))); await phones[0].wait(4000);
  const id = phones[0].sess.W.S.tripId;
  for (let i = 1; i < n; i++) { await phones[i].open(); await signIn(phones[i], 'ann'); await phones[i].wait(4000); if (phones[i].sess.W.S.tripId !== id) return fail('device ' + i + ' did not open the trip after signing in'); }
  /* last[path] = the latest change a person made to it: { v (undefined: taken away), t, by, all: every value set } */
  const last = {}, mineLast = phones.map(() => []), planner = {};
  const wrote = (path, v, d) => { const e = last[path] || (last[path] = { all: [] }); e.v = v; e.t = clock.t; e.by = d; e.all.push(v); };
  const steps = int(r, 12, 40);
  for (let s = 0; s < steps; s++) {
    const d = int(r, 0, n - 1), ph = phones[d], m = r();
    if (m < 0.08) { ph.signal(!!ph.off); log.push('d' + d + (ph.off ? ' loses the signal' : ' has a signal again')); }
    else if (m < 0.14) { if (ph.sess) { if (r() < 0.5) ph.pagehide(); ph.close(); log.push('d' + d + ' closes the app'); } else { await ph.open(true); log.push('d' + d + ' opens the app'); } }
    else if (m < 0.2) { await waitAll(phones, int(r, 1000, 30000)); log.push('time passes'); }
    else if (!ph.sess) { /* (closed: nothing to do on it) */ }
    else if (m < 0.25) {
      /* the planner fills a slot nobody chose: no tap, no "mine" */
      const k = 'Italy|Venice|' + int(r, 1, 3) + '|am', S = ph.sess.W.S; (S.picks = S.picks || {})[k] = 'Planner ' + int(r, 1, 99); planner[k] = 1; ph.sess.W.planWrote = { [k]: S.picks[k] }; ph.sess.W.save();
      log.push('d' + d + ' planner fills ' + k);
    } else {
      const S = ph.sess.W.S; let th = pick(r, THINGS), act = r(), was = read(S, th.p), v;
      if (act < 0.2 && mineLast[d].length) {
        /* undo this device's own last change: back to what the thing was before it */
        const u = mineLast[d].pop(); th = u.th; v = u.was; act = 2;
      } else if (act < 0.45 && th.del && was !== undefined) v = undefined;
      else v = th.val(r);
      if (same(read(S, th.p), v) || (v === undefined && !th.del)) { await waitAll(phones, 5); continue; }   /* (nothing would change: not a change) */
      const alsoWas = th.also ? read(S, th.also) : undefined;
      ph.tap();
      if (v === undefined) th.del(S); else th.set(S, v);
      ph.sess.W.save();
      wrote(th.p, v, d); if (th.also && !same(alsoWas, read(S, th.also))) wrote(th.also, read(S, th.also), d);
      if (act !== 2) mineLast[d].push({ th, was });
      log.push('d' + d + (act === 2 ? ' undoes: ' : ' ') + th.p + ' = ' + JSON.stringify(v) + (ph.off ? ' (no signal)' : ''));
    }
    await waitAll(phones, int(r, 1, 2500));
  }
  /* the end: every device open, with a signal; time passes (twice the longest wait before a write is tried again) */
  for (const ph of phones) { if (!ph.sess) await ph.open(true); ph.signal(true); }
  await waitAll(phones, 30000);
  for (const ph of phones) ph.signal(true);
  await waitAll(phones, 90000);
  const doc = store.get('data/users/ann/trips/t/' + id);
  if (!doc || !doc.state) return fail('the account has no copy of the trip');
  /* (what a planner filled in by itself is each device's own until a person changes something: it is redone on every
     device anyway, and is not part of what must agree) */
  const own = st => { const o = JSON.parse(JSON.stringify(st)); Object.keys(planner).forEach(k => { if (o.picks) delete o.picks[k]; }); return o; };
  const W0 = phones[0].sess.W, want = W0.syncCanon(own(doc.state));
  for (let i = 0; i < n; i++) {
    const W = phones[i].sess.W;
    if (W.S.tripId !== id) return fail('device ' + i + ' is on another trip');
    const got = W.syncCanon(own(W.syncable(W.S)));
    if (got !== want) { const a = JSON.parse(got), b = JSON.parse(want), keys = [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      return fail('device ' + i + ' and the account differ in ' + keys.map(k => k + ': ' + JSON.stringify(a[k]).slice(0, 160) + ' / ' + JSON.stringify(b[k]).slice(0, 160)).join('; ')); }
  }
  if (doc.sv !== 2) return fail('the account\'s copy does not say it carries the times of its changes');
  for (const p of Object.keys(last)) {
    const e = last[p], got = read(doc.state, p);
    if (skewed ? !e.all.some(v => same(v, got)) : !same(got, e.v))
      return fail(p + ' is ' + JSON.stringify(got) + ', but the latest change to it (by device ' + e.by + ') was ' + JSON.stringify(e.v));
    if (!(doc.state.ct || {})[p]) return fail(p + ' was changed by a person and carries no time');
  }
  for (const k of Object.keys(planner)) if ((doc.state.ct || {})['picks::' + k]) return fail('the planner\'s own fill-in of ' + k + ' was sent as a person\'s change');
  phones.forEach(ph => ph.close());
  return { ok: true, why: '', ops: log, n, skewed };
}

/* a trip kept by v176: on the phone with a change not yet sent (unsent, with the version both sides had), in the
   account as another device left it, neither with any times. Opened by this version, both changes are kept. */
async function legacy() {
  store.clear(); sim.listeners.length = 0; clock.t = Date.UTC(2027, 5, 9, 8, 0, 0);
  const ph = new Phone(77); await ph.open(); await signIn(ph, 'ann');
  ph.tap(); ph.sess.W.newTripFrom(JSON.parse(JSON.stringify(START))); await ph.wait(4000);
  const id = ph.sess.W.S.tripId, path = 'data/users/ann/trips/t/' + id; ph.close();
  /* as v176 left things */
  const base = JSON.parse(ph.ls['waypoint-v2']); delete base.ct;
  const local = JSON.parse(JSON.stringify(base)); local.free = { 'Italy|Rome|1|pm': 1 }; delete local.picks['Italy|Rome|1|am']; local.days = 8;
  ph.ls['waypoint-v2'] = JSON.stringify(local);
  const ix = JSON.parse(ph.ls['waypoint-trips-v1']); ix[id] = { name: 'Italy 2027', updated: clock.t - 60000, seen: 1, unsent: 1, base: (b => { delete b.tripId; return b; })(JSON.parse(JSON.stringify(base))) };
  ph.ls['waypoint-trips-v1'] = JSON.stringify(ix);
  const theirs = JSON.parse(JSON.stringify(base)); theirs.stays = { 'Italy|Rome': { label: 'Hotel B' } }; theirs.days = 9; theirs.start = '2027-07-01';
  store.set(path, { name: 'Italy 2027', updated: clock.t - 30000, dev: 'olddevice1', state: theirs, cc: {}, legs: {} });
  await ph.open(); await ph.wait(30000);
  const doc = store.get(path), S = ph.sess.W.S, out = { sv: doc.sv, free: (doc.state.free || {})['Italy|Rome|1|pm'], gone: !('Italy|Rome|1|am' in (doc.state.picks || {})), stay: ((doc.state.stays || {})['Italy|Rome'] || {}).label, start: doc.state.start, days: doc.state.days,
    same: ph.sess.W.syncCanon(ph.sess.W.syncable(S)) === ph.sess.W.syncCanon(doc.state), flags: Object.keys(ph.idx()[id] || {}).sort().join() };
  /* and one from before, on a new phone: it simply opens */
  const p2 = new Phone(78); store.set(path, { name: 'Italy 2027', updated: clock.t, dev: 'olddevice1', state: theirs, cc: {}, legs: {} });
  await p2.open(); await signIn(p2, 'ann'); await p2.wait(8000);
  out.opens = p2.sess.W.S.tripId === id && p2.sess.W.S.start === '2027-07-01';
  ph.close(); p2.close();
  return out;
}

/* the join itself: the same whichever copy comes first, however they are grouped, however often */
async function laws(rounds) {
  store.clear(); sim.listeners.length = 0;
  const ph = new Phone(5); await ph.open(); const W = ph.sess.W, r = rng(424242), bad = [];
  const stamp = () => ('00000000' + int(r, 1, 50).toString(36)).slice(-9) + pick(r, ['devaaaaaaa', 'devbbbbbbb', 'devccccccc']);
  /* (a real stamp belongs to one change: the same stamp never comes with two different values) */
  const made = {}, st = () => { const S = { v: 2, days: 7 }, ct = {};
    THINGS.forEach(th => { const m = r(); if (m < 0.5) return; const s = stamp(), key = th.p + '@' + s;
      if (m < 0.6) { th.set(S, th.val(r)); return; }   /* (a value nobody changed: no time) */
      if (!(key in made)) made[key] = r() < 0.3 && th.del ? undefined : th.val(r);
      if (made[key] !== undefined) th.set(S, made[key]); ct[th.p] = s; });
    S.ct = ct; return S; };
  for (let i = 0; i < rounds; i++) {
    const a = st(), b = st(), c = st(), J = W.syncJoin, C = W.syncCanon;
    if (C(J(a, b)) !== C(J(b, a))) bad.push('order ' + i);
    if (C(J(J(a, b), c)) !== C(J(a, J(b, c)))) bad.push('grouping ' + i);
    if (C(J(a, a)) !== C(J(a, {})) || C(J(J(a, b), b)) !== C(J(a, b))) bad.push('again ' + i);
  }
  ph.close();
  return bad;
}
module.exports = { run, legacy, laws };
