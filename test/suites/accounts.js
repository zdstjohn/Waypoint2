/* v151: accounts on one shared phone (installable app), with the real lib/cloud.js and lib/sync.js and no browser
   (test/lib/acctsim.js, from the v151 bug review): signing out and in again; someone using the phone without an account
   in between (your open trip comes back whole, with what was not yet sent); a save while the sign-out request is slow,
   and one on the way out of the page (nothing of yours is left for the next account); the example after the quick
   start (never in your account). */
const { spawnSync } = require('child_process'); const path = require('path');
exports.run = async t => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'lib', 'acctsim.js'), t.root], { encoding: 'utf8', timeout: 120000 });
  const out = r.stdout || '';
  t.ok(r.status === 0, 'the simulation ran: ' + (r.stderr || '').slice(0, 300));
  const part = n => (out.split('=== ' + n + '.')[1] || '').split('\n=== ')[0];
  const val = (n, what) => { const m = new RegExp('-> ' + what.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': (.*)').exec(part(n)); return m ? m[1] : null; };
  t.eq(val(1, 'Ann back: on screen'), '"Rome 2027"', 'Ann signs out and in again: her trip is back on screen');
  const two = val(2, "after tapping 'Rome 2027' in Your trips, on screen") || '';
  t.ok(/^"Rome 2027 own packing: .*typed offline/.test(two), 'someone used the phone without an account in between: her open trip is in her list, whole, with the packing item typed offline not yet sent: ' + two);
  t.ok(!/ANN-12345/.test(val(3, 'signed out, no account: on screen') || '') && val(3, "Ben's account") === '[]', 'a save while the sign-out request is slow leaves nothing of hers on the phone, and nothing reaches the next account: ' + part(3).trim().replace(/\s+/g, ' ').slice(0, 300));
  t.ok(!/Rome|Lisbon/.test(val(4, 'after reload, waypoint-trips-v1 on the phone') || 'x') && val(4, "Ben's account") === '[]', 'nor a save on the way out of the page: ' + part(4).trim().replace(/\s+/g, ' ').slice(0, 300));
  t.ok(val(5, "Zoe's account right after") === '["Greece trip"]' && val(5, "Zoe's account after the app is opened again") === '["Greece trip"]', 'after the quick start, only the new trip is in her account, never the example: ' + part(5).trim().replace(/\s+/g, ' ').slice(0, 300));
};
