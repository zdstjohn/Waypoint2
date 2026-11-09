/* Screenshots of every screen (phone, large text, dark, tablet, desktop) against the baseline in test/base. Text
   anti-aliasing wobbles a little between runs, so a screen fails only when more than 2,000 pixels changed; failures get a
   before|after|difference image in test/out/visual/, and test/out/visual/summary.md lists them (GitHub shows it on the
   run's page; there the baseline is the commit before, so the list is what this commit changed on screen).
   --update-baseline rewrites test/base from this run. */
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
exports.run = async t => {
  const base = path.join(t.root, 'test', 'base'), cur = path.join(t.root, 'test', 'out', 'shots');
  fs.rmSync(cur, { recursive: true, force: true });
  const r = spawnSync('node', ['test/shots.js', cur], { cwd: t.root, encoding: 'utf8', timeout: 900000 });
  if (!t.ok(r.status === 0, 'screenshots taken ' + (r.stderr || '').slice(-200))) return;
  if (t.flags.has('--update-baseline') || !fs.existsSync(base)) { fs.rmSync(base, { recursive: true, force: true }); fs.cpSync(cur, base, { recursive: true }); t.note('baseline written to test/base'); return; }
  const d = spawnSync('python3', ['test/lib/diff.py', base, cur, path.join(t.root, 'test', 'out', 'visual')], { cwd: t.root, encoding: 'utf8' });
  const lines = (d.stdout || '').split('\n'), changed = [];
  for (const l of lines) { const m = l.match(/^differs: (\S+)\s+(\d+) px/); if (m && +m[2] > 2000) { changed.push(`- ${m[1]}: ${m[2]} px changed`); t.ok(false, `${m[1]} changed (${m[2]} px)`); } const mm = l.match(/^(missing after|size differs): (\S+)/); if (mm) { changed.push('- ' + l); t.ok(false, l); } }
  fs.mkdirSync(path.join(t.root, 'test', 'out', 'visual'), { recursive: true });
  fs.writeFileSync(path.join(t.root, 'test', 'out', 'visual', 'summary.md'), '### Screens\n\n' + (changed.length ? `${changed.length} screenshot(s) changed (before | after | difference images in the "screens" artifact):\n\n` + changed.join('\n') : 'No screen changed.') + '\n');
  t.ok(true, lines.filter(l => /^same/.test(l)).join(''));
};
