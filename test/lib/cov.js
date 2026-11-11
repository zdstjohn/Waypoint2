/* Which code do the tests run? (the audit's T1)        node test/run.js --cov
   The browser's own coverage is collected from every page the suites open through test/lib/page.js, added up per suite
   (test/out/cov/<suite>.json) and joined by the runner. The built scripts (trip/app.js, trip/app2.js) are mapped back to
   the source files through their source maps, so nothing about what the tests load changes. The report
   (test/out/coverage.md) gives, per file, how much of its built code ran, and the longest stretches that never did.
   Not measured: suites that open the installable build or the offline copy themselves (other copies of the scripts),
   and the two that time things (perf, vitals), which a coverage run leaves out. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), DIR = path.join(ROOT, 'test', 'out', 'cov'), SCRIPTS = ['app.js', 'app2.js'];
const acc = {}, pages = new Set();
exports.on = !!process.env.WP_COV;
exports.start = async pg => { if (!exports.on) return; try { await pg.coverage.startJSCoverage({ resetOnNavigation: false }); pages.add(pg); } catch (e) { } };
async function take(pg) {
  pages.delete(pg); let cov; try { cov = await pg.coverage.stopJSCoverage(); } catch (e) { return; }
  for (const e of cov) {
    const name = SCRIPTS.find(s => e.url.split('?')[0].endsWith('/' + s)); if (!name || !e.source) continue;
    const a = acc[name] || (acc[name] = { len: e.source.length, ran: new Uint8Array(e.source.length) });
    if (a.len !== e.source.length) continue;   /* another build of the script: not the one being measured */
    /* V8 gives nested ranges with counts: the innermost range covering a position decides whether it ran */
    const one = new Uint8Array(a.len), ranges = [];
    e.functions.forEach(fn => fn.ranges.forEach(r => ranges.push(r)));
    ranges.sort((x, y) => (y.endOffset - y.startOffset) - (x.endOffset - x.startOffset)).forEach(r => one.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset));
    for (let i = 0; i < a.len; i++) if (one[i]) a.ran[i] = 1;
  }
}
exports.takeAll = async only => { for (const pg of [...pages]) if (!only || only(pg)) await take(pg); };
exports.save = suite => {
  if (!exports.on) return; fs.mkdirSync(DIR, { recursive: true });
  const out = {}; for (const k in acc) out[k] = { len: acc[k].len, ran: Buffer.from(acc[k].ran).toString('base64') };
  fs.writeFileSync(path.join(DIR, suite + '.json'), JSON.stringify(out));
};
exports.clear = () => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { } };

/* ---- the report ---- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode(mappings) {   /* source-map mappings -> per generated line, [generated column, source line] */
  const lines = []; let srcLine = 0, srcCol = 0, src = 0, name = 0;
  mappings.split(';').forEach(line => {
    const segs = []; let col = 0;
    line.split(',').forEach(seg => {
      if (!seg) return; const v = []; let shift = 0, val = 0;
      for (const ch of seg) { const d = B64.indexOf(ch); val += (d & 31) << shift; if (d & 32) shift += 5; else { v.push(val & 1 ? -(val >> 1) : val >> 1); shift = 0; val = 0; } }
      col += v[0]; if (v.length >= 4) { src += v[1]; srcLine += v[2]; srcCol += v[3]; if (v.length >= 5) name += v[4]; segs.push([col, srcLine]); } else segs.push([col, -1]);
    });
    lines.push(segs);
  });
  return lines;
}
exports.report = () => {
  const suites = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')) : [], measured = [], files = {}, idle = [];
  const ran = {};
  suites.forEach(f => { const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); let any = false;
    for (const k in j) { const b = Buffer.from(j[k].ran, 'base64'); const a = ran[k] || (ran[k] = new Uint8Array(j[k].len)); if (a.length !== b.length) continue; any = true; for (let i = 0; i < b.length; i++) if (b[i]) a[i] = 1; }
    if (any) measured.push(f.replace(/\.json$/, '')); });
  SCRIPTS.forEach(s => {
    const built = fs.readFileSync(path.join(ROOT, 'trip', s), 'utf8'), map = JSON.parse(fs.readFileSync(path.join(ROOT, 'trip', s + '.map'), 'utf8')), r = ran[s];
    if (!r || r.length !== built.length) return;
    const src = map.sourcesContent[0].split('\n'), per = src.map(() => [0, 0]);   /* per source line: built characters, of which ran */
    let off = 0; const glines = built.split('\n'), dec = decode(map.mappings);
    glines.forEach((gl, li) => {
      const segs = dec[li] || [];
      segs.forEach((sg, i) => { if (sg[1] < 0 || !per[sg[1]]) return; const a = off + sg[0], b = off + (i + 1 < segs.length ? segs[i + 1][0] : gl.length); let n = 0; for (let k = a; k < b; k++) n += r[k]; per[sg[1]][0] += b - a; per[sg[1]][1] += n; });
      off += gl.length + 1;
    });
    /* which file a source line belongs to: the build marks each with a comment line */
    let cur = null, start = 0, run = null;
    const flush = () => { if (run && run.size >= 600) idle.push(run); run = null; };
    src.forEach((line, i) => {
      const m = /^\/\* --- (.+) --- \*\/$/.exec(line); if (m) { flush(); cur = m[1]; start = i + 1; files[cur] = files[cur] || { size: 0, ran: 0, script: s }; return; }
      if (!cur || !per[i][0]) return;
      files[cur].size += per[i][0]; files[cur].ran += per[i][1];
      if (per[i][1] === 0) { if (!run) run = { file: cur, line: i - start, size: 0, text: line.trim().slice(0, 90) }; run.size += per[i][0]; } else flush();
    });
    flush();
  });
  const rows = Object.keys(files).map(f => ({ f, kb: files[f].size / 1024, pct: files[f].size ? files[f].ran / files[f].size : 0, script: files[f].script })).sort((a, b) => a.pct - b.pct);
  const tot = rows.reduce((n, x) => n + x.kb, 0), got = rows.reduce((n, x) => n + x.kb * x.pct, 0), all = tot ? got / tot : 0;
  const L = ['# What the tests run', '', `Measured with \`node test/run.js --cov\` on ${new Date().toISOString().slice(0, 10)}: ${measured.length} suites that open the app through test/lib/page.js (${measured.sort().join(', ')}).`,
    'Not measured: suites that open the installable build or the offline copy themselves, and the two that time things (perf, vitals).', '',
    `**${Math.round(all * 100)}% of the app's built code ran** (${got.toFixed(0)} of ${tot.toFixed(0)} KB). By file, least covered first:`, '', '| file | script | KB built | ran |', '|---|---|---:|---:|'];
  rows.forEach(x => L.push(`| ${x.f} | ${x.script} | ${x.kb.toFixed(1)} | ${Math.round(x.pct * 100)}% |`));
  L.push('', '## The longest stretches no test runs', '', 'Each is a run of source lines whose built code never ran (line numbers are within the file).', '');
  idle.sort((a, b) => b.size - a.size).slice(0, 40).forEach(x => L.push(`- ${x.file} line ${x.line} (${(x.size / 1024).toFixed(1)} KB): \`${x.text.replace(/`/g, "'")}\``));
  fs.mkdirSync(path.join(ROOT, 'test', 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'test', 'out', 'coverage.md'), L.join('\n') + '\n');
  return { all, tot, rows, measured, idle: idle.length };
};
