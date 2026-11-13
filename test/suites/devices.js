/* Several devices on one trip (test/lib/devsim.js): seeded random runs of edits, undos, lost signals, the app closed
   and opened again, and saves arriving in any order, against the real lib/sync.js. After each run every device and
   the account hold the same trip, each thing holds its latest change, and nothing taken away has come back.
   Also: the join itself is the same in any order, grouping and repetition; and a trip kept by v176 (no times for
   its changes, one change not yet sent) loads and is joined with what another device left in the account.
   SYNC=2000 node test/run.js devices runs more; a failure prints its seed and its steps, and SYNC_SEED=<n> replays it. */
const N = +process.env.SYNC || 500, ONLY = process.env.SYNC_SEED ? +process.env.SYNC_SEED : null;
exports.run = async t => {
  const sim = require('../lib/devsim');
  const bad = await sim.laws(1500);
  t.eq(bad.slice(0, 5), [], 'joining two copies of a trip gives the same trip in any order, in any grouping, however often (1,500 random triples)');
  const lg = await sim.legacy();
  t.ok(lg.sv === 2 && lg.free === 1 && lg.gone && lg.stay === 'Hotel B' && lg.start === '2027-07-01' && lg.same && !/base/.test(lg.flags) && lg.opens,
    'a trip kept by v176 loads and joins: the change not yet sent from this phone and the other device\'s later ones are all in the account: ' + JSON.stringify(lg));
  t.eq(lg.days, 9, 'where both changed the same thing before v177, the later save has it, as it did then');
  const seeds = ONLY != null ? [ONLY] : Array.from({ length: N }, (_, i) => 1 + i), fails = []; let ops = 0, skew = 0; const by = { 2: 0, 3: 0, 4: 0 }; const t0 = Date.now();
  for (const s of seeds) {
    let r; try { r = await sim.run(s); } catch (e) { r = { ok: false, why: 'crashed: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | '), ops: [] }; }
    ops += r.ops.length; if (r.ok) { by[r.n]++; if (r.skewed) skew++; } else fails.push({ seed: s, why: r.why, ops: r.ops });
  }
  t.note(`${seeds.length} runs (${by[2]} with two devices, ${by[3]} with three, ${by[4]} with four; ${skew} with clocks hours apart), ${ops} steps, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  t.eq(fails.map(f => f.seed), [], 'every run ends with every device and the account holding the same trip, each thing at its latest change' +
    (fails.length ? ` — ${fails.length} of ${seeds.length} did not:\n      ` + fails.slice(0, 5).map(f => `seed ${f.seed}: ${f.why}` + (ONLY != null || fails.length < 3 ? '\n        ' + f.ops.join('\n        ') : '')).join('\n      ') : ''));
};
