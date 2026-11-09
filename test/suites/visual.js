/* Screenshots of every screen (phone, large text, dark, tablet, desktop) against the baseline in test/base. Text
   anti-aliasing wobbles a little between runs, so a screen fails only when more than 2,000 pixels changed; failures get a
   before|after|difference image in test/out/visual/, and test/out/visual/summary.md lists them (GitHub shows it on the
   run's page; there the baseline is the commit before, so the list is what this commit changed on screen).
   --update-baseline rewrites test/base from this run.
   A commit that means to change screens lists them in test/screens-expected.txt, one name or pattern per line (* matches
   anything: "swap-*", "today-dark-0.png"; # starts a comment). The list is used when SCREENS_EXPECT names it (GitHub does
   that only when the commit changed the file, so an old list never hides a later change) or with --expect. A screen
   that changed and is on the list is reported as expected; any other changed screen fails.
   SHOT_SIZES=n,big,dark,wide,desk takes and compares only those sizes (GitHub runs each size side by side). */
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
exports.run = async t => {
  const base = path.join(t.root, 'test', 'base'), cur = path.join(t.root, 'test', 'out', 'shots');
  fs.rmSync(cur, { recursive: true, force: true });
  const r = spawnSync('node', ['test/shots.js', cur], { cwd: t.root, encoding: 'utf8', timeout: 900000 });
  if (!t.ok(r.status === 0, 'screenshots taken ' + (r.stderr || '').slice(-200))) return;
  const only = (process.env.SHOT_SIZES || '').split(',').map(x => x.trim()).filter(Boolean), size = n => n.slice(0, -4).split('-').slice(-2)[0];
  if (t.flags.has('--update-baseline') || !fs.existsSync(base)) {
    /* with SHOT_SIZES, only those sizes' pictures are replaced; the others stay */
    if (only.length && fs.existsSync(base)) { fs.readdirSync(base).filter(n => only.includes(size(n))).forEach(n => fs.rmSync(path.join(base, n))); fs.readdirSync(cur).forEach(n => fs.copyFileSync(path.join(cur, n), path.join(base, n))); }
    else { fs.rmSync(base, { recursive: true, force: true }); fs.cpSync(cur, base, { recursive: true }); }
    t.note('baseline written to test/base' + (only.length ? ' (' + only.join(', ') + ')' : '')); return;
  }
  const d = spawnSync('python3', ['test/lib/diff.py', base, cur, path.join(t.root, 'test', 'out', 'visual')], { cwd: t.root, encoding: 'utf8' });
  const lines = (d.stdout || '').split('\n'), changed = [], expected = [];
  const ef = process.env.SCREENS_EXPECT || (t.flags.has('--expect') ? 'test/screens-expected.txt' : ''), efp = ef && path.join(t.root, ef);
  const pats = efp && fs.existsSync(efp) ? fs.readFileSync(efp, 'utf8').split('\n').map(x => x.replace(/#.*/, '').trim()).filter(Boolean) : [];
  const res = pats.map(p => ({ p, re: new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), hit: 0 }));
  const meant = name => { const r = res.find(x => x.re.test(name)); if (r) r.hit++; return !!r; };
  for (const l of lines) {
    const m = l.match(/^differs: (\S+)\s+(\d+) px/), mm = l.match(/^(missing after|size differs): (\S+)/);
    const name = m ? m[1] : mm ? mm[2] : null; if (!name || (m && +m[2] <= 2000)) continue;
    const what = m ? `${m[1]}: ${m[2]} px changed` : l;
    if (meant(name)) expected.push('- ' + what); else { changed.push('- ' + what); t.ok(false, m ? `${m[1]} changed (${m[2]} px), not listed in ${ef || 'test/screens-expected.txt'}` : l); }
  }
  if (pats.length) t.note(`${expected.length} screen(s) changed as listed in ${ef}` + (res.some(r => !r.hit) ? '; listed but unchanged: ' + res.filter(r => !r.hit).map(r => r.p).join(', ') : ''));
  fs.mkdirSync(path.join(t.root, 'test', 'out', 'visual'), { recursive: true });
  const NAMES = { n: 'phone', big: 'large text', dark: 'dark', wide: 'tablet', desk: 'desktop' };
  fs.writeFileSync(path.join(t.root, 'test', 'out', 'visual', 'summary.md'), '### Screens' + (only.length ? ' (' + only.map(x => NAMES[x] || x).join(', ') + ')' : '') + '\n\n' +
    (changed.length ? `${changed.length} screenshot(s) changed that this commit didn't list in test/screens-expected.txt (before | after | difference images in the "screens" artifact):\n\n` + changed.join('\n') : 'No unexpected screen change.') +
    (expected.length ? `\n\n${expected.length} changed as this commit said they would:\n\n` + expected.join('\n') : '') + '\n');
  t.ok(true, lines.filter(l => /^same/.test(l)).join(''));
};
