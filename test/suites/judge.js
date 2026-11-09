/* The photo finder's judge against the photos labelled by eye (judge/labeled.json): at least 85% of bad photos turned down
   and at least 60% of good ones kept. */
const { spawnSync } = require('child_process'); const path = require('path');
exports.run = async t => {
  const r = spawnSync('python3', ['judge/validate.py'], { cwd: t.root, encoding: 'utf8' });
  const m = (r.stdout || '').match(/rejects caught (\d+)\/(\d+) \((\d+)%\), keeps kept (\d+)\/(\d+) \((\d+)%\)/);
  if (!t.ok(!!m, 'validate.py ran: ' + (r.stdout || r.stderr).slice(-200))) return;
  t.ok(+m[3] >= 85, `rejects caught ${m[3]}% (${m[1]}/${m[2]}), need 85%`);
  t.ok(+m[6] >= 60, `keeps kept ${m[6]}% (${m[4]}/${m[5]}), need 60%`);
  const u = spawnSync('python3', ['-c', 'import sys; sys.path.insert(0,"tools"); import photo_judge, photos2'], { cwd: t.root, encoding: 'utf8' });
  t.ok(u.status === 0, 'photos2.py and photo_judge.py import cleanly ' + (u.stderr || '').slice(-200));
};
