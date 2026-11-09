/* Type checking without a rewrite: TypeScript reads the plain JavaScript (checkJs, noEmit) against the shapes declared
   in types/waypoint.d.ts. Every file must pass the base check (misspelled fields, wrong argument counts, mismatched
   shapes); the files listed in tsconfig.strict.json must also pass strictNullChecks (a value that may be empty is
   never used as if it were there). A file that becomes null-safe is added to the strict list and never removed. */
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
exports.run = async t => {
  const tsc = path.join(t.root, 'build', 'node_modules', '.bin', 'tsc');
  t.ok(fs.existsSync(tsc), 'TypeScript is installed in build/');
  const run = cfg => { const r = spawnSync(tsc, ['-p', cfg], { cwd: t.root, encoding: 'utf8' }); const errs = (r.stdout + r.stderr).split('\n').filter(l => /error TS/.test(l)); return { ok: r.status === 0, errs }; };
  const base = run('tsconfig.json');
  t.ok(base.ok, `every source file passes the base check (${base.errs.length} errors)` + (base.errs.length ? ':\n      ' + base.errs.slice(0, 8).join('\n      ') : ''));
  const strict = run('tsconfig.strict.json');
  t.ok(strict.ok, `the null-safe files pass strictNullChecks (${strict.errs.length} errors)` + (strict.errs.length ? ':\n      ' + strict.errs.slice(0, 8).join('\n      ') : ''));
  const cfg = JSON.parse(fs.readFileSync(path.join(t.root, 'tsconfig.strict.json'), 'utf8'));
  const strictFiles = cfg.include.filter(f => /^trip\/(lib|screens)\//.test(f)).length;
  const all = fs.readdirSync(path.join(t.root, 'trip', 'lib')).length + fs.readdirSync(path.join(t.root, 'trip', 'screens')).length;
  t.note(`${strictFiles} of ${all} source files are null-safe`);
  /* the declarations name every member the sources put on W, so a new one is a conscious addition */
  const src = ['lib', 'screens'].flatMap(d => fs.readdirSync(path.join(t.root, 'trip', d)).map(f => fs.readFileSync(path.join(t.root, 'trip', d, f), 'utf8'))).join('\n');
  const used = new Set([...src.matchAll(/\bW\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map(m => m[1]));
  const dts = fs.readFileSync(path.join(t.root, 'types', 'waypoint.d.ts'), 'utf8');
  const declared = new Set([...dts.slice(dts.indexOf('interface Waypoint {')).matchAll(/^\s{2}([A-Za-z_$][A-Za-z0-9_$]*)\??:/gm)].map(m => m[1]));
  const missing = [...used].filter(m => !declared.has(m)), stale = [...declared].filter(m => !used.has(m));
  t.eq(missing, [], 'every W member the sources use is declared');
  t.eq(stale, [], 'no declared W member is unused');
  const anyCount = [...dts.slice(dts.indexOf('interface Waypoint {')).matchAll(/^\s{2}[A-Za-z_$][A-Za-z0-9_$]*: any;/gm)].length;
  t.note(`${declared.size - anyCount} of ${declared.size} W members have a precise type`);
};
