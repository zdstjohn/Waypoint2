/* The nightly city library helper (tools/citylib.js) on a made-up database: what a night asks for, what goes into a
   question, what is checked before it is written. Used by test/suites/tools.js. */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
module.exports = ROOT => {
  const out = [];
  const CL = require(path.join(ROOT, 'tools/citylib.js'));
  const Q = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/citylib-questions.json'), 'utf8'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-citylib-')), db = path.join(tmp, 'db'), work = path.join(tmp, 'w');
  const w = (p, o) => { fs.mkdirSync(path.dirname(path.join(db, p)), { recursive: true }); fs.writeFileSync(path.join(db, p), JSON.stringify(o)); };
  const now = Date.now();
  /* Croatia has its towns (Town 0 a day trip, Town 3 little visited); Town 2 has both lists already */
  const towns = Array.from({ length: 12 }, (_, i) => ({ name: i === 1 ? 'Šibenik' : 'Town ' + i, pop: i === 3 ? 1 : 5, base: i === 0 ? 0 : 1 }));
  w('citylib/croatia.json', { id: 'croatia', version: 3, data: { country: 'Croatia', q: { [Q.cities.h]: { r: { cities: towns }, at: now } } } });
  w('citylib/croatia-town-2.json', { id: 'croatia-town-2', version: 7, data: { country: 'Croatia', city: 'Town 2', q: { [Q.spots.h]: { r: { spots: [] }, at: now }, [Q.food.h]: { r: { food: [] }, at: now } } } });
  const plan = seed => { fs.rmSync(work, { recursive: true, force: true }); spawnSync('node', ['tools/citylib.js', 'plan', db, work, '3', '2'], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { CITYLIB_SEED: String(seed) }) });
    return JSON.parse(fs.readFileSync(path.join(work, 'tasks.json'), 'utf8')); };
  const c = plan(8), b = plan(7), a = plan(7);   /* (the work folder is the last plan's: a's) */
  const lists = a.filter(t => t.kind === 'cities'), byTown = a.filter(t => t.kind !== 'cities');
  const allowed = ['Šibenik', 'Town 4', 'Town 5', 'Town 6', 'Town 7', 'Town 8', 'Town 9'];
  const picked = [...new Set(byTown.map(t => t.city))];
  out.push([lists.length === 2 && !lists.some(t => t.country === 'Croatia'), 'a night asks for two countries\' towns, never one it has: ' + lists.map(t => t.country)]);
  out.push([picked.length === 3 && picked.every(x => allowed.includes(x)) && byTown.length === 6, 'and both lists of three of a country\'s most popular towns to stay in (never a day trip, never one kept already): ' + picked]);
  out.push([JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), 'which ones is random (the same seed, the same night)']);
  const sp = byTown.find(t => t.kind === 'spots');
  out.push([sp.prompt === Q.spots.t.split('{CITY}').join(sp.city).split('{COUNTRY}').join('Croatia') && sp.h === Q.spots.h && sp.slug === CL.citySlug('Croatia', sp.city), 'the place goes into the app\'s own question, under the app\'s id: ' + sp.slug]);
  out.push([CL.citySlug('Croatia', 'Šibenik') === 'croatia-sibenik' && CL.textHash(Q.food.t) === Q.food.h, 'ids and fingerprints are the app\'s (croatia-sibenik)']);
  fs.writeFileSync(path.join(work, byTown[0].id + '.json'), '```json\n' + JSON.stringify({ d: 'x', spots: Array.from({ length: 9 }, (_, i) => ({ n: 'S' + i })), food: Array.from({ length: 9 }, (_, i) => ({ n: 'F' + i })) }) + '\n```');
  fs.writeFileSync(path.join(work, byTown[1].id + '.json'), JSON.stringify({ food: [{ n: 'only one' }], spots: [] }));
  fs.writeFileSync(path.join(work, lists[0].id + '.json'), JSON.stringify({ blurb: 'b', cities: Array.from({ length: 11 }, (_, i) => ({ name: 'Ville ' + i })) }));
  const ch = spawnSync('node', ['tools/citylib.js', 'check', db, work], { cwd: ROOT, encoding: 'utf8' });
  const rep = JSON.parse(ch.stdout.trim().split('\n').pop()), writes = JSON.parse(fs.readFileSync(path.join(work, 'writes.json'), 'utf8'));
  out.push([rep.kept === 2 && rep.refused.length === 1 && writes.length === 2 && writes.every(x => x.op === 'set'), 'answers are checked before they are written (a short list is refused): ' + JSON.stringify(rep)]);
  const pk = spawnSync('node', ['tools/citylib.js', 'pack'], { cwd: ROOT, encoding: 'utf8' });
  out.push([/const EMBED_TOP = \["FR","ES"/.test(pk.stdout) && pk.stdout.includes('const EMBED_Q = {"cities"'), 'the packed copy carries the country list and the questions']);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { out, err: ch.stderr || '' };
};
if (require.main === module) { const x = module.exports(process.argv[2] || process.cwd()); x.out.forEach(([ok, m]) => console.log(ok ? 'ok  ' : 'BAD ', m)); if (x.err) console.log(x.err); }
