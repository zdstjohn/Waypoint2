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
  /* the most visited countries fill first: of the 150, only the first dozen or so that are still empty can be picked */
  const firstEmpty = (() => { const src = fs.readFileSync(path.join(ROOT, 'trip/data/data2.js'), 'utf8').match(/TOP_COUNTRIES\s*=\s*"([^"]+)"/)[1].split(' ');
    return src.map(code => new Intl.DisplayNames(['en'], { type: 'region' }).of(code)).filter(n => n !== 'Croatia').slice(0, 12); })();
  out.push([lists.every(t => firstEmpty.includes(t.country)), 'a night picks among the most visited that are empty: ' + lists.map(t => t.country)]);
  out.push([JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), 'which ones is random (the same seed, the same night)']);
  const sp = byTown.find(t => t.kind === 'spots');
  out.push([sp.prompt === Q.spots.t.split('{CITY}').join(sp.city).split('{COUNTRY}').join('Croatia') && sp.h === Q.spots.h && sp.slug === CL.citySlug('Croatia', sp.city), 'the place goes into the app\'s own question, under the app\'s id: ' + sp.slug]);
  out.push([CL.citySlug('Croatia', 'Šibenik') === 'croatia-sibenik' && CL.textHash(Q.food.t) === Q.food.h, 'ids and fingerprints are the app\'s (croatia-sibenik)']);
  fs.writeFileSync(path.join(work, byTown[0].id + '.json'), '```json\n' + JSON.stringify({ d: 'x', spots: Array.from({ length: 9 }, (_, i) => ({ n: 'S' + i })), food: Array.from({ length: 9 }, (_, i) => ({ n: 'F' + i })) }) + '\n```');
  fs.writeFileSync(path.join(work, byTown[1].id + '.json'), JSON.stringify({ food: [{ n: 'only one' }], spots: [] }));
  fs.writeFileSync(path.join(work, lists[0].id + '.json'), JSON.stringify({ blurb: 'b', cities: Array.from({ length: 11 }, (_, i) => ({ name: 'Ville ' + i })) }));
  const ch = spawnSync('node', ['tools/citylib.js', 'check', db, work], { cwd: ROOT, encoding: 'utf8' });
  const rep = JSON.parse(ch.stdout.trim().split('\n').pop()), writes = JSON.parse(fs.readFileSync(path.join(work, 'writes.json'), 'utf8'));
  out.push([rep.kept === 2 && rep.refused.length === 1 && rep.documents === 2 && writes.length === 3 && writes.filter(x => x.doc_id !== '_stats').every(x => x.op === 'set'), 'answers are checked before they are written (a short list is refused): ' + JSON.stringify(rep)]);
  /* and the library's size is written for Settings: Croatia's town list is there, a new country list tonight makes two, and only Town 2 has both lists (the new town got one) */
  const st = JSON.parse(fs.readFileSync(path.join(work, 'out', '_stats.json'), 'utf8'));
  out.push([writes.some(x => x.doc_id === '_stats' && x.op === 'set') && st.countries === 2 && st.cities === 1 && st.at > 0, 'the library\'s size is kept for Settings: ' + JSON.stringify(st)]);
  /* the gap report: what is still missing (Croatia has its towns; Town 4 has no lists; Town 2 has both) */
  const gp = spawnSync('node', ['tools/citylib.js', 'gaps', db], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
  const bareLine = (gp.split('\n').find(l => /^Countries with no town list/.test(l)) || '');
  out.push([/^Countries with no town list yet \(\d+ of 150\)/.test(bareLine) && !/Croatia/.test(bareLine) && /Croatia: .*Town 4 \(spots \+ food\)/.test(gp) && !/Town 2 \(/.test(gp), 'the gap report lists what is missing: ' + gp.split('\n').slice(0, 3).join(' | ').slice(0, 160)]);
  /* the doctor: sound answers pass; a list on the wrong kind of document, a short list and a document with no answers are named */
  const sick = path.join(tmp, 'sick'); fs.mkdirSync(path.join(sick, 'citylib'), { recursive: true });
  const sw = (id, o) => fs.writeFileSync(path.join(sick, 'citylib', id + '.json'), JSON.stringify({ id, version: 1, data: o }));
  const good = n => Array.from({ length: n }, (_, i) => ({ n: 'P' + i })), t0 = Date.now();
  sw('croatia', { country: 'Croatia', city: '', q: { a: { r: { cities: Array.from({ length: 12 }, (_, i) => ({ name: 'T' + i })) }, at: t0 }, z: { drop: 1 } } });
  sw('croatia-split', { country: 'Croatia', city: 'Split', q: { b: { r: { spots: good(10) }, at: t0 }, c: { r: { food: good(3) }, at: t0 }, d: { r: { cities: Array.from({ length: 12 }, (_, i) => ({ name: 'C' + i })) }, at: t0 } } });
  sw('croatia-empty', { country: 'Croatia', city: 'Empty' });
  const dr = spawnSync('node', ['tools/citylib.js', 'doctor', sick], { cwd: ROOT, encoding: 'utf8' }), dl = dr.stdout.trim().split('\n');
  out.push([dr.status === 1 && JSON.parse(dl[0]).broken === 3 && /croatia-split c \(food\): fewer than 8/.test(dr.stdout) && /croatia-split d: a cities list on a city/.test(dr.stdout) && /croatia-empty: no answers/.test(dr.stdout) && !/croatia a /.test(dr.stdout), 'the doctor names the broken answers and passes the sound ones: ' + dl.join(' | ').slice(0, 200)]);
  const fine = path.join(tmp, 'fine'); fs.mkdirSync(path.join(fine, 'citylib'), { recursive: true }); fs.copyFileSync(path.join(sick, 'citylib', 'croatia.json'), path.join(fine, 'citylib', 'croatia.json'));
  const ok0 = spawnSync('node', ['tools/citylib.js', 'doctor', fine], { cwd: ROOT, encoding: 'utf8' });
  out.push([ok0.status === 0 && JSON.parse(ok0.stdout.trim().split('\n')[0]).broken === 0, 'and a sound library passes: ' + ok0.stdout.trim().split('\n')[0]]);
  /* at scale: a library of 150 countries and 1,000 cities (documents as big as the real ones) is planned, checked and examined fast */
  const big = path.join(tmp, 'big'), bw = path.join(tmp, 'bigw'); fs.mkdirSync(path.join(big, 'citylib'), { recursive: true });
  const codes = fs.readFileSync(path.join(ROOT, 'trip/data/data2.js'), 'utf8').match(/TOP_COUNTRIES\s*=\s*"([^"]+)"/)[1].split(' '), dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const desc = 'A short description of the place, about as long as the app asks for in its lists of things to do and places to eat.';
  const spotsOf = n => Array.from({ length: n }, (_, i) => ({ n: 'Place ' + i, d: desc, lat: 10 + i / 100, lng: 20 + i / 100, c: 'sight', t: 90 }));
  let nDocs = 0, cityN = 0;
  codes.forEach((code, i) => { const cn = dn.of(code), slug0 = CL.slug(cn);
    const towns = Array.from({ length: 90 }, (_, k) => ({ name: 'Town ' + k, pop: 90 - k, base: 1, d: desc }));
    fs.writeFileSync(path.join(big, 'citylib', slug0 + '.json'), JSON.stringify({ id: slug0, version: 1, data: { country: cn, city: '', q: { [Q.cities.h]: { r: { cities: towns }, at: now } } } })); nDocs++;
    /* a thousand towns in all: the ones plan would look at (the first of each country) have both lists, as a long-running library would */
    for (let k = 0; k < 7 && cityN < 1000; k++, cityN++) { const s1 = CL.citySlug(cn, 'Town ' + k); fs.writeFileSync(path.join(big, 'citylib', s1 + '.json'), JSON.stringify({ id: s1, version: 1, data: { country: cn, city: 'Town ' + k, q: { [Q.spots.h]: { r: { spots: spotsOf(12) }, at: now }, [Q.food.h]: { r: { food: spotsOf(12) }, at: now } } } })); nDocs++; } });
  const t1 = Date.now(); spawnSync('node', ['tools/citylib.js', 'plan', big, bw, '15', '6'], { cwd: ROOT, encoding: 'utf8' }); const tPlan = Date.now() - t1;
  const t2 = Date.now(); const bd = spawnSync('node', ['tools/citylib.js', 'doctor', big], { cwd: ROOT, encoding: 'utf8' }); const tDoc = Date.now() - t2;
  out.push([nDocs >= 1000 && tPlan < 5000 && tDoc < 5000 && JSON.parse(bd.stdout.trim().split('\n')[0]).broken === 0, nDocs + ' documents: plan in ' + tPlan + ' ms and the doctor in ' + tDoc + ' ms (each under 5 s)']);
  const pk = spawnSync('node', ['tools/citylib.js', 'pack'], { cwd: ROOT, encoding: 'utf8' });
  out.push([/const EMBED_TOP = \["FR","ES"/.test(pk.stdout) && pk.stdout.includes('const EMBED_Q = {"cities"'), 'the packed copy carries the country list and the questions']);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { out, err: ch.stderr || '' };
};
if (require.main === module) { const x = module.exports(process.argv[2] || process.cwd()); x.out.forEach(([ok, m]) => console.log(ok ? 'ok  ' : 'BAD ', m)); if (x.err) console.log(x.err); }
