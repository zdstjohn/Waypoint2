#!/usr/bin/env node
/* Are the island towns where the app says they are? (the audit's R4)
   The towns in window.TI (trip/data/data2.js) were written with coordinates from memory. This asks OpenStreetMap's
   search (Nominatim, one question a second, as its rules ask) where each town is and lists every one that is more than
   LIMIT km from the nearest answer, with the coordinates found, so the table can be corrected.
     node tools/check_towns.js            every town (about five minutes)
     node tools/check_towns.js Greece     one country
   Run on GitHub (Actions > "island towns" > Run workflow): this needs the open internet. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), LIMIT = 4;
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'trip/data/data2.js'), 'utf8'), ctx);
const TI = ctx.window.TI || {}, only = process.argv[2];
const km = (a, b) => { const r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ask(q) {
  for (let n = 0; n < 3; n++) {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'waypoint-town-check/1.0 (github.com/zdstjohn/Waypoint2)' } });
      if (r.ok) return (await r.json()).map(x => [+x.lat, +x.lon, x.display_name]);
    } catch (e) { }
    await sleep(3000);
  }
  return null;
}
(async () => {
  const rows = [], off = [], missing = [];
  Object.keys(TI).filter(c => !only || c === only).forEach(c => TI[c].forEach(row => {
    const isle = row[0].split(',')[0].replace(/^\*/, '');
    row[1].split(';').forEach(t => { const m = /^(.+)@(-?[\d.]+),(-?[\d.]+)$/.exec(t); if (m) rows.push({ c, isle, town: m[1], at: [+m[2], +m[3]] }); });
  }));
  console.log(`checking ${rows.length} towns` + (only ? ' in ' + only : ''));
  for (const x of rows) {
    /* with the island's name first (two islands can share a town name), then without it */
    let got = await ask(`${x.town}, ${x.isle}, ${x.c}`); await sleep(1100);
    if (got && !got.length) { got = await ask(`${x.town}, ${x.c}`); await sleep(1100); }
    if (!got || !got.length) { missing.push(x); continue; }
    const best = got.map(g => [km(x.at, g), g]).sort((a, b) => a[0] - b[0])[0];
    if (best[0] > LIMIT) off.push(Object.assign({ km: best[0], found: best[1] }, x));
  }
  const L = ['### Island towns', '', `${rows.length} towns checked against OpenStreetMap; ${off.length} are more than ${LIMIT} km from the nearest answer, ${missing.length} got no answer.`, ''];
  if (off.length) { L.push('| country | island | town | in the app | found | km | found as |', '|---|---|---|---|---|---:|---|'); off.sort((a, b) => b.km - a.km).forEach(x => L.push(`| ${x.c} | ${x.isle} | ${x.town} | ${x.at.join(', ')} | ${x.found[0].toFixed(3)}, ${x.found[1].toFixed(3)} | ${x.km.toFixed(1)} | ${String(x.found[2]).slice(0, 70)} |`)); L.push(''); }
  if (missing.length) L.push('No answer for: ' + missing.map(x => `${x.town} (${x.isle}, ${x.c})`).join('; '), '');
  console.log(L.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, L.join('\n') + '\n');
  fs.writeFileSync(path.join(ROOT, 'towns-check.json'), JSON.stringify({ off, missing }, null, 1));
})();
