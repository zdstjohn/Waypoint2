/* Screenshots of every screen against the baseline in test/base. Text anti-aliasing wobbles a little between runs, so a
   screen fails only when more than 2,000 pixels changed; failures get a before|after|difference image in test/out/visual/.
   --update-baseline rewrites test/base from this run. */
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
exports.run = async t => {
  const base = path.join(t.root, 'test', 'base'), cur = path.join(t.root, 'test', 'out', 'shots');
  fs.rmSync(cur, { recursive: true, force: true });
  const r = spawnSync('node', ['test/shots.js', cur], { cwd: t.root, encoding: 'utf8', timeout: 900000 });
  if (!t.ok(r.status === 0, 'screenshots taken ' + (r.stderr || '').slice(-200))) return;
  if (t.flags.has('--update-baseline') || !fs.existsSync(base)) { fs.rmSync(base, { recursive: true, force: true }); fs.cpSync(cur, base, { recursive: true }); t.note('baseline written to test/base'); return; }
  const d = spawnSync('python3', ['test/lib/diff.py', base, cur, path.join(t.root, 'test', 'out', 'visual')], { cwd: t.root, encoding: 'utf8' });
  const lines = (d.stdout || '').split('\n');
  for (const l of lines) { const m = l.match(/^differs: (\S+)\s+(\d+) px/); if (m && +m[2] > 2000) t.ok(false, `${m[1]} changed (${m[2]} px)`); const mm = l.match(/^(missing after|size differs): (\S+)/); if (mm) t.ok(false, l); }
  t.ok(true, lines.filter(l => /^same/.test(l)).join(''));
};
