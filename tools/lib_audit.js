#!/usr/bin/env node
/* Are the libraries this app uses named in a published security advisory? (the audit's T5)
     node tools/lib_audit.js            asks npm (the packages in package.json) and OSV (the libraries shipped with the app)
     node tools/lib_audit.js --self     checks this script's own logic on canned answers (no network)
   A finding fails the check unless tools/audit-waivers.json waives that package until a date, with a reason: a waiver is
   a deadline, not a pass (once the date has gone the check fails again). Only "high" and "critical" count for npm's
   list; every OSV entry for a shipped library counts. If a source cannot be reached, the check fails rather than
   passing unseen. The summary goes to the GitHub run's page when there is one. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
/* libraries that reach the browser: [name on npm, version, where it comes from] */
const SHIPPED = [
  ['jspdf', (fs.readFileSync(path.join(ROOT, 'trip/screens/book.js'), 'utf8').match(/ajax\/libs\/jspdf\/([\d.]+)\//) || [])[1], 'loaded from cdnjs by screens/book.js (the PDF export)'],
  ['maplibre-gl', '4.7.1', 'trip/vt/maplibre-gl-csp.js (the street map)'],
];
function judge(findings, waivers, today) {
  /* findings: [{ pkg, id, severity, title }]  ->  { fail: [...], waived: [...] } */
  const out = { fail: [], waived: [] };
  findings.forEach(f => {
    const w = (waivers || []).find(x => x.pkg === f.pkg);
    if (w && w.until >= today) out.waived.push(Object.assign({ until: w.until, reason: w.reason }, f)); else out.fail.push(Object.assign(w ? { expired: w.until } : {}, f));
  });
  return out;
}
function fromNpm(json) {
  const out = [];
  Object.values((json && json.vulnerabilities) || {}).forEach(v => {
    if (!/^(high|critical)$/.test(v.severity)) return;
    const via = (v.via || []).filter(x => x && typeof x === 'object');
    if (!via.length) out.push({ pkg: v.name, id: 'via ' + (v.via || []).join(', '), severity: v.severity, title: 'depends on a package with an advisory' });
    via.filter(x => /^(high|critical)$/.test(x.severity || v.severity)).forEach(x => out.push({ pkg: v.name, id: (String(x.url || '').match(/GHSA-[\w-]+/) || [x.source])[0], severity: x.severity || v.severity, title: x.title || '' }));
  });
  return out;
}
function fromOsv(name, json) { return ((json && json.vulns) || []).map(v => ({ pkg: name, id: v.id, severity: 'listed', title: v.summary || '' })); }
function report(res, notes) {
  const L = ['### Library advisories', ''];
  if (!res.fail.length && !res.waived.length) L.push('None found.');
  if (res.fail.length) { L.push('**To fix (' + res.fail.length + '):**', ''); res.fail.forEach(f => L.push(`- ${f.pkg}: ${f.id} (${f.severity}) ${f.title}` + (f.expired ? ` (its waiver ended ${f.expired})` : ''))); L.push(''); }
  if (res.waived.length) { L.push('**Waived for now (' + res.waived.length + '):**', ''); res.waived.forEach(f => L.push(`- ${f.pkg}: ${f.id} (${f.severity}) ${f.title} (until ${f.until}: ${f.reason})`)); L.push(''); }
  (notes || []).forEach(n => L.push(n));
  return L.join('\n');
}
async function main() {
  const waivers = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-waivers.json'), 'utf8')).waivers, today = new Date().toISOString().slice(0, 10);
  const findings = [], notes = []; let blind = false;
  try {
    let raw; try { raw = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { raw = e.stdout; }   /* (npm exits 1 when it finds something) */
    const j = JSON.parse(raw); if (j.error) throw new Error(j.error.summary || 'npm audit failed'); fromNpm(j).forEach(f => findings.push(f));
  } catch (e) { blind = true; notes.push('npm could not be asked: ' + (e && e.message)); }
  for (const [name, version, where] of SHIPPED) {
    if (!version) { blind = true; notes.push(`${name}: its version could not be read (${where})`); continue; }
    try {
      const r = await fetch('https://api.osv.dev/v1/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version, package: { name, ecosystem: 'npm' } }) });
      if (!r.ok) throw new Error('OSV answered ' + r.status);
      fromOsv(name, await r.json()).forEach(f => { if (!findings.some(x => x.pkg === f.pkg && x.id === f.id)) findings.push(f); });
      notes.push(`Checked ${name} ${version}: ${where}.`);
    } catch (e) { blind = true; notes.push(`${name} ${version} could not be checked with OSV: ` + (e && e.message)); }
  }
  const res = judge(findings, waivers, today), text = report(res, notes);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  process.exit(res.fail.length || blind ? 1 : 0);
}
function self() {
  const assert = require('assert');
  const npm = { vulnerabilities: { jspdf: { name: 'jspdf', severity: 'high', via: [{ source: 1, title: 'DoS in addImage', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high' }] },
    canvg: { name: 'canvg', severity: 'moderate', via: [{ title: 'x', url: 'https://github.com/advisories/GHSA-1111-2222-3333' }] },
    dompurify: { name: 'dompurify', severity: 'high', via: [{ title: 'low one', severity: 'low', url: 'https://github.com/advisories/GHSA-llll-llll-llll' }, { title: 'high one', severity: 'high', url: 'https://github.com/advisories/GHSA-hhhh-hhhh-hhhh' }] }, wrap: { name: 'wrap', severity: 'critical', via: ['jspdf'] } } };
  const f = fromNpm(npm).concat(fromOsv('maplibre-gl', { vulns: [{ id: 'GHSA-zzzz', summary: 'tile parsing' }] }), fromOsv('ok', {}));
  assert.deepStrictEqual(f.map(x => x.pkg + ' ' + x.id), ['jspdf GHSA-aaaa-bbbb-cccc', 'dompurify GHSA-hhhh-hhhh-hhhh', 'wrap via jspdf', 'maplibre-gl GHSA-zzzz']);
  const w = [{ pkg: 'jspdf', until: '2026-12-15', reason: 'upgrade planned' }];
  const a = judge(f, w, '2026-11-10'), b = judge(f, w, '2026-12-16');
  assert.deepStrictEqual([a.waived.map(x => x.pkg), a.fail.map(x => x.pkg)], [['jspdf'], ['dompurify', 'wrap', 'maplibre-gl']]);
  assert.deepStrictEqual([b.waived.length, b.fail.map(x => x.pkg + (x.expired ? ' expired' : ''))], [0, ['jspdf expired', 'dompurify', 'wrap', 'maplibre-gl']]);
  assert.ok(/Waived for now \(1\)/.test(report(a)) && /its waiver ended 2026-12-15/.test(report(b)) && /None found/.test(report(judge([], w, '2026-11-10'))));
  assert.ok(SHIPPED[0][1] && /^\d+\.\d+\.\d+$/.test(SHIPPED[0][1]), 'the jsPDF version is read from the app');
  /* the MapLibre waiver rests on this: the app's map has no attribution control and no popups (the code the advisory is about) */
  const vt = fs.readFileSync(path.join(ROOT, 'trip/lib/vtmap.js'), 'utf8');
  assert.ok(/attributionControl: false/.test(vt) && !/AttributionControl|addControl\(|setHTML|\.Popup\b/.test(vt), 'lib/vtmap.js draws the map without MapLibre\'s attribution control or popups (if that changes, review the maplibre-gl waiver)');
  console.log('lib_audit: its own checks pass (jsPDF in the app: ' + SHIPPED[0][1] + ')');
}
if (process.argv.includes('--self')) self(); else main();
