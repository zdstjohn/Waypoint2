/* The nightly city library helper (tools/citylib.js) on a made-up database: what a night asks for, what goes into a
   question, what is checked before it is written. Used by test/suites/tools.js. */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
module.exports = ROOT => {
  const out = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-citylib-')), db = path.join(tmp, 'db'), work = path.join(tmp, 'w');
  const w = (p, o) => { fs.mkdirSync(path.dirname(path.join(db, p)), { recursive: true }); fs.writeFileSync(path.join(db, p), JSON.stringify(o)); };
  const now = Date.now();
  w('data/users/u1/libq/q/C.json', { kind: 'cities', t: 'List the cities, towns and areas that travelers visit in {COUNTRY}.', at: now });
  w('data/users/u1/libq/q/S.json', { kind: 'spots', t: 'List the 15 best things to do in and around {CITY}, {COUNTRY}.', at: now });
  w('data/users/u1/libq/q/F.json', { kind: 'food', t: 'List 15 places to eat in {CITY}, {COUNTRY}.', at: now });
  w('data/users/u1/libq/q/OLD.json', { kind: 'spots', t: 'an old way of asking {CITY}', at: now - 40 * 864e5 });
  const towns = Array.from({ length: 12 }, (_, i) => ({ name: i === 1 ? 'Šibenik' : 'Town ' + i, pop: i === 3 ? 1 : 5, base: i === 0 ? 0 : 1 }));
  w('citylib/croatia.json', { id: 'croatia', version: 3, data: { country: 'Croatia', q: { C: { r: { cities: towns }, at: now } } } });
  w('citylib/croatia-town-2.json', { id: 'croatia-town-2', version: 7, data: { country: 'Croatia', city: 'Town 2', q: { S: { r: { spots: [] }, at: now }, F: { r: { food: [] }, at: now } } } });
  const r = spawnSync('node', ['tools/citylib.js', 'plan', db, work, '3', '2'], { cwd: ROOT, encoding: 'utf8' });
  const tasks = JSON.parse(fs.readFileSync(path.join(work, 'tasks.json'), 'utf8'));
  const lists = tasks.filter(t => t.kind !== 'cities');
  out.push([tasks.filter(t => t.kind === 'cities').map(t => t.country).join(',') === 'France,Spain', 'a night asks for the next countries\' towns, most visited first: ' + tasks.filter(t => t.kind === 'cities').map(t => t.country)]);
  out.push([lists.map(t => t.city + ':' + t.kind).join(',') === 'Šibenik:spots,Šibenik:food,Town 4:spots,Town 4:food,Town 5:spots,Town 5:food',
    'and the two lists of a country\'s most popular towns to stay in (never a day trip, never one kept already, never an old way of asking): ' + lists.map(t => t.city + ':' + t.kind)]);
  out.push([lists[0].slug === 'croatia-sibenik' && lists[0].prompt === 'List the 15 best things to do in and around Šibenik, Croatia.', 'the place goes into the question, and the id is the app\'s: ' + lists[0].slug]);
  fs.writeFileSync(path.join(work, lists[0].id + '.json'), '```json\n' + JSON.stringify({ d: 'x', spots: Array.from({ length: 9 }, (_, i) => ({ n: 'S' + i })) }) + '\n```');
  fs.writeFileSync(path.join(work, lists[1].id + '.json'), JSON.stringify({ food: [{ n: 'only one' }] }));
  fs.writeFileSync(path.join(work, tasks[0].id + '.json'), JSON.stringify({ blurb: 'b', cities: Array.from({ length: 11 }, (_, i) => ({ name: 'Ville ' + i })) }));
  const c = spawnSync('node', ['tools/citylib.js', 'check', db, work], { cwd: ROOT, encoding: 'utf8' });
  const rep = JSON.parse(c.stdout.trim().split('\n').pop()), writes = JSON.parse(fs.readFileSync(path.join(work, 'writes.json'), 'utf8'));
  out.push([rep.kept === 2 && rep.refused.length === 1 && writes.length === 2 && writes.every(x => x.op === 'set'), 'answers are checked before they are written (a short list is refused): ' + JSON.stringify(rep)]);
  const pk = spawnSync('node', ['tools/citylib.js', 'pack'], { cwd: ROOT, encoding: 'utf8' });
  out.push([/const EMBED_TOP = \["FR","ES"/.test(pk.stdout), 'the packed copy carries the country list']);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { out, err: (r.stderr || '') + (c.stderr || '') };
};
if (require.main === module) { const x = module.exports(process.argv[2] || process.cwd()); x.out.forEach(([ok, m]) => console.log(ok ? 'ok  ' : 'BAD ', m)); if (x.err) console.log(x.err); }
