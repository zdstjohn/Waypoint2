/* Photo packs (v198): a city's photos in one file (tools/photopack.js makes one, lib/photopack.js reads it). A pack is
   read back exactly, and anything that is not one is refused; a photo with no file of its own (pk) shows from its
   city's pack, fetched once and then kept on the phone; saving a trip for offline takes a city's photos from its pack
   in one request; and a library city is saved to the phone before any trip goes there (Settings, World library).
   Pictures are drawn by test/py/make_fixtures.py and served by test/lib/photofix.js. */
const path = require('path'); const fs = require('fs'); const os = require('os');
const { launch, open, exampleTrip, settle, until } = require('../lib/page'); const mkdb = require('../lib/db'); const fx = require('../lib/photofix');
const ROOT = path.resolve(__dirname, '..', '..');
const PK = require('../../tools/photopack.js');
const REC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mocks', 'world-spain-granada.json'), 'utf8'));
exports.run = async t => {
  const man = fx.make(path.join(ROOT, '.photoset-fx'), 4);
  const u = f => '/_blob/' + fx.idOf(f);
  t.ok(fs.readFileSync(path.join(ROOT, 'trip', 'tools', 'photopack.js.txt'), 'utf8') === fs.readFileSync(path.join(ROOT, 'tools', 'photopack.js'), 'utf8'),
    "the tool's published copy (trip/tools/photopack.js.txt), which a nightly task reads, is the same as tools/photopack.js");
  /* ---- the tool: a pack reads back, and what is not a pack is refused ---- */
  const pics = man.map(e => ({ url: u(e.jpg), type: 'image/webp', bytes: fs.readFileSync(e.webp) }));
  const txt = PK.pack('italy-rome', '2026-11-14', pics), back = PK.read(txt);
  t.ok(typeof txt === 'string' && back && back.slug === 'italy-rome' && back.items.length === 4 && back.items.every((it, i) => it.url === pics[i].url && it.bytes.equals(pics[i].bytes)),
    'a pack (text, which the app\'s file store takes) reads back: every picture, byte for byte, under its photo\'s own address');
  const cut = txt.slice(0, txt.length - 10), twice = PK.pack('x', '2026-11-14', [pics[0], pics[0]]);
  const odd = txt.replace('image/webp', 'image/jpeg'), page = PK.pack('x', '2026-11-14', [{ url: '/_blob/x', type: 'image/webp', bytes: Buffer.from('<html>sign in</html>') }]);
  t.ok(PK.read(cut) === null && PK.read(twice) === null && PK.read(odd) === null && PK.read(page) === null && PK.read('{"wppk":1}') === null && PK.read('<html>not a pack</html>') === null,
    'a pack cut short, one naming a picture twice, one whose picture is not what it says, one holding a web page, and a file that is not a pack are all refused');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-photopack-')), files = path.join(tmp, 'files'); fs.mkdirSync(files);
  /* the city's files as the nightly run has them: by id. Photo 0 has a WebP twin (it goes in), photo 1 only its JPEG,
     photo 2 is a "nearby" stand-in (left out), photo 3's file is missing, and one "picture" is a web page */
  fs.copyFileSync(man[0].webp, path.join(files, fx.idOf(man[0].webp) + '.webp')); fs.copyFileSync(man[0].jpg, path.join(files, fx.idOf(man[0].jpg) + '.jpg'));
  fs.copyFileSync(man[1].jpg, path.join(files, fx.idOf(man[1].jpg)));
  fs.copyFileSync(man[2].jpg, path.join(files, fx.idOf(man[2].jpg) + '.jpg'));
  fs.writeFileSync(path.join(files, 'e'.repeat(32) + '.jpg'), '<html>sign in</html>');
  fs.writeFileSync(path.join(tmp, 'italy-rome.json'), JSON.stringify({ data: { city: 'Rome', items: {
    colosseum: fx.record(man[0], 'new'), pantheon: fx.record(man[1], 'old'), 'near the forum': fx.record(man[2], 'old', { near: 'Roman Forum' }),
    'trevi fountain': fx.record(man[3], 'old'), 'a page': { url: '/_blob/' + 'e'.repeat(32) } } } }));
  const built = PK.build(path.join(tmp, 'italy-rome.json'), files, path.join(tmp, 'out.js')), chk = PK.check(path.join(tmp, 'out.js'), path.join(tmp, 'italy-rome.json'));
  const made = PK.read(fs.readFileSync(path.join(tmp, 'out.js'), 'utf8'));
  t.ok(built.n === 2 && built.slug === 'italy-rome' && built.missing.join() === 'trevi fountain' && built.skipped.join() === 'a page' && chk && chk.n === 2 && chk.lacks === 2,
    'built from a city\'s files: its own photos go in, a stand-in from nearby does not, a missing file and a page that is not a picture are named: ' + JSON.stringify(built));
  t.ok(made && made.items[0].url === u(man[0].jpg) && made.items[0].type === 'image/webp' && made.items[1].type === 'image/jpeg',
    'a photo goes in as its WebP when it has one (the smallest good copy), named by its own address; else as its JPEG');
  /* moving the stored photos into packs (v199): a city in a trip keeps its files; another city is packed, and the files
     its photos had of their own are free, unless something else still points at one */
  const db = path.join(tmp, 'db'); for (const c of ['photos', 'wanted', 'places']) fs.mkdirSync(path.join(db, c), { recursive: true });
  const romeDoc = JSON.parse(fs.readFileSync(path.join(tmp, 'italy-rome.json'), 'utf8'));
  fs.writeFileSync(path.join(db, 'photos', 'italy-rome.json'), JSON.stringify(romeDoc));
  fs.writeFileSync(path.join(db, 'photos', 'spain-granada.json'), JSON.stringify({ data: { city: 'Granada', items: { alhambra: fx.record(man[3], 'new') } } }));
  fs.writeFileSync(path.join(db, 'wanted', 'spain-granada.json'), JSON.stringify({ data: { city: 'Granada' } }));
  /* (a place record that happens to point at Rome's Pantheon file keeps that file) */
  fs.writeFileSync(path.join(db, 'places', 'x.json'), JSON.stringify({ data: { items: { p: { pic: u(man[1].jpg) } } } }));
  const pl = PK.plan(db, path.join(tmp, 'plan')), P = JSON.parse(fs.readFileSync(path.join(tmp, 'plan', 'plan.json'), 'utf8'));
  const rome = P.cities['italy-rome'] || {}, copies = r => [r.url, r.sm, r.big, r.webp && r.webp.url, r.webp && r.webp.sm, r.webp && r.webp.big].filter(Boolean).map(x => x.slice(7));
  const colo = romeDoc.data.items.colosseum;
  t.ok(pl.cities === 1 && !P.cities['spain-granada'] && rome.fetch.includes(colo.webp.url.slice(7)) && copies(colo).every(id => rome.free.includes(id)) && !rome.free.includes(u(man[1].jpg).slice(7)) && !rome.free.includes(u(man[2].jpg).slice(7)),
    'the plan: Granada (in a trip) keeps its files; Rome is packed from each photo\'s WebP copy, and every copy the Colosseum had is freed, but not a file a place record points at, nor a stand-in\'s: ' + JSON.stringify(pl));
  const mk = PK.mark(path.join(db, 'photos', 'italy-rome.json'), '/_blob/' + 'a'.repeat(32), path.join(tmp, 'out.js'), path.join(tmp, 'marked.json'));
  const mdoc = JSON.parse(fs.readFileSync(path.join(tmp, 'marked.json'), 'utf8')), mc = mdoc.items.colosseum;
  t.ok(mk.marked === 2 && mdoc.pack.url === '/_blob/' + 'a'.repeat(32) && mdoc.pack.n === 2 && mc.pk === 1 && mc.url === colo.url && mc.lq === colo.lq && !('sm' in mc) && !('webp' in mc) && !('big' in mc) && !mdoc.items['near the forum'].pk && !mdoc.items['trevi fountain'].pk,
    'marked: the photos in the pack are pk (same address, same preview, no copies of their own); a stand-in and a photo the pack lacks are as they were');

  /* ---- the app ---- */
  /* Granada, from the library's record: four of its places have a photo. Two have no file of their own (pk: only the
     pack has them), two have files as before. The pack holds all four. */
  const names = ['alhambra and nasrid palaces', 'granada cathedral and royal chapel', 'parque de las ciencias', 'mirador de san nicolas'];
  const gpics = man.map(e => ({ url: u(e.jpg), type: 'image/webp', bytes: fs.readFileSync(e.webp) }));
  const PACK_ID = 'f'.repeat(32), gpack = PK.pack('spain-granada', '2026-11-14', gpics);
  const items = pk => Object.fromEntries(names.map((n, i) => [n, pk && i < 2 ? Object.assign(fx.record(man[i], 'old'), { pk: 1, lq: man[i].lq }) : fx.record(man[i], 'old')]));
  const INDEX = { v: 1, at: '2026-11-14', cities: { 'spain-granada': { n: 'Granada', c: 'Spain', p: 30, at: '2026-11-13' } } };
  const seed = pk => ({ 'world/spain-granada': REC, 'world/_index': INDEX, 'photos/spain-granada': { city: 'Granada', country: 'Spain', items: items(pk), pack: { url: '/_blob/' + PACK_ID, n: 4, bytes: gpack.length, at: '2026-11-14' } } });
  const b = await launch();
  /* pk: the first two photos have no file of their own (their addresses answer "not found": only the pack has them) */
  const start = async pk => {
    const store = mkdb(seed(pk)), A = await open(b, { width: 390, height: 844, db: store });
    /* (hold: the pack's answer waits until the test lets it go, to look at the page while it is on its way) */
    const stats = await fx.serve(A.ctx, man); const packs = { n: 0, hold: null };
    await A.ctx.route(/\/_blob\/[0-9a-f]{32}/, async route => {
      const id = /\/_blob\/([0-9a-f]{32})/.exec(route.request().url())[1];
      if (id === PACK_ID) { packs.n++; if (packs.hold) await packs.hold; return route.fulfill({ status: 200, body: gpack, contentType: 'text/javascript' }); }
      if (pk && (id === fx.idOf(man[0].jpg) || id === fx.idOf(man[1].jpg))) return route.fulfill({ status: 404, body: '' });
      return route.fallback();
    });
    return Object.assign(A, { stats, packs, store });
  };
  const granada = pg => pg.evaluate(() => {
    W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Granada'] }], days: 3, start: '2027-06-13', depart: 'Seattle (SEA)', travelers: [41, 40, 6, 3] });
  });
  let A = await start(true);
  let letGo = () => {}; A.packs.hold = new Promise(r => { letGo = r; });
  await granada(A.pg); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
  await until(() => A.pg.evaluate(() => !!(W.photoPack && W.photoFor({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada'))), 15000);
  const first = await A.pg.evaluate(() => W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {}));
  t.ok(/<span class="lq"/.test(first) && /src="data:image\/gif;base64,/.test(first) && !/ lqi"/.test(first) && !/srcset=/.test(first),
    'a photo with no file of its own: its blurred preview stands until its pack is here (no address that cannot load is asked for): ' + first.replace(/base64,[A-Za-z0-9+\/=]{30,}/g, 'base64,…').slice(0, 300));
  await A.pg.evaluate(() => W.picture({ n: 'Granada Cathedral and Royal Chapel' }, false, 'Spain', 'Granada', {}));   /* (wanted too, while the pack is on its way) */
  await A.pg.waitForTimeout(300);
  letGo(); A.packs.hold = null;
  const shown = await until(() => A.pg.evaluate(() => /src="blob:/.test(W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {}))), 8000);
  await until(() => A.pg.evaluate(() => /src="blob:/.test(W.picture({ n: 'Granada Cathedral and Royal Chapel' }, false, 'Spain', 'Granada', {}))), 8000);
  const loaded = await A.pg.evaluate(() => new Promise(res => {
    const m = /src="(blob:[^"]+)"/.exec(W.picture({ n: 'Granada Cathedral and Royal Chapel' }, false, 'Spain', 'Granada', {})), im = new Image();
    if (!m) return res(0); im.onload = () => res(im.naturalWidth); im.onerror = () => res(-1); im.src = m[1];
  }));
  t.ok(shown && loaded > 0 && A.packs.n === 1, 'then it shows from the pack: one request for the city\'s pack, and the picture is a real one (' + loaded + ' px wide; pack requests: ' + A.packs.n + ')');
  const own = await A.pg.evaluate(() => W.picture({ n: 'Parque de las Ciencias' }, false, 'Spain', 'Granada', {}));
  t.ok(own.indexOf('src="' + u(man[2].jpg) + '"') > 0, 'a photo with a file of its own is shown from it, as before');
  /* saving the trip for offline: the city's photos come from the pack already kept, or from it in one request */
  const before = A.stats.n;
  await A.pg.evaluate(() => W.offline.save(W.P, 'test'));
  await until(() => A.pg.evaluate(() => W.offline.state === 'done' || W.offline.state === 'error'), 15000);
  const sv = await A.pg.evaluate(() => ({ st: W.offline.state, n: W.offline.n, total: W.offline.total }));
  t.ok(sv.st === 'done' && sv.n === sv.total && sv.total >= 4 && A.stats.n === before && A.packs.n === 1,
    'saving the trip for offline: every photo is on the phone, none fetched one by one (' + sv.n + ' of ' + sv.total + '; single requests: ' + (A.stats.n - before) + ', pack requests: ' + A.packs.n + ')');
  /* the next visit: the pictures come from the phone, the pack is not fetched again */
  await A.pg.reload(); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => W.needLater());
  const again = await until(() => A.pg.evaluate(() => !!W.photoPack && /src="blob:/.test(W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {}))), 10000);
  t.ok(again && A.packs.n === 1, 'on the next visit its pictures come from the phone: the pack is not fetched again');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();

  /* every photo with a file of its own, and a pack beside them (a city on its way to one file): the page shows the
     files as before and never asks for the pack; saving the trip takes the pack, once, for the lot */
  A = await start(false);
  await granada(A.pg); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
  await until(() => A.pg.evaluate(() => !!(W.photoPack && W.photoFor({ n: 'Mirador de San Nicolas' }, false, 'Spain', 'Granada'))), 15000);
  await settle(A.pg);
  const s0 = A.stats.n, p0 = A.packs.n;
  await A.pg.evaluate(() => W.offline.save(W.P, 'test'));
  await until(() => A.pg.evaluate(() => W.offline.state === 'done' || W.offline.state === 'error'), 15000);
  const sv2 = await A.pg.evaluate(() => ({ st: W.offline.state, n: W.offline.n, total: W.offline.total }));
  t.ok(p0 === 0 && sv2.st === 'done' && sv2.n === sv2.total && sv2.total >= 4 && A.packs.n === 1 && A.stats.n === s0,
    'photos that have files too: the page never asks for the pack; saving the trip fetches it once and no photo on its own (' + sv2.n + ' of ' + sv2.total + '; pack requests ' + p0 + ' then ' + A.packs.n + ', single requests ' + (A.stats.n - s0) + ')');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();

  /* ---- Settings, World library: a city saved before any trip goes there ---- */
  A = await start(true);
  await exampleTrip(A.pg);   /* (a trip to Italy: nothing of it is in Granada) */
  await A.pg.evaluate(() => { W.needLater(); });
  await until(() => A.pg.evaluate(() => !!(W.photoPack && W.worldCities && W.worldCities().length)), 12000);
  await A.pg.evaluate(() => { location.hash = '#settings'; }); await A.pg.waitForTimeout(800);
  const row = () => A.pg.evaluate(() => { const r = document.querySelector('#set-world .wl-row'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const r0 = await row();
  t.ok(/^Granada ?Spain · 30 places ?Save for offline$/.test(r0), 'Settings lists the library\'s cities, each with "Save for offline": ' + r0);
  await A.pg.click('#set-world [data-wl="save"]');
  const savedRow = await until(async () => { const x = await row(); return /saved/.test(x) ? x : ''; }, 15000);
  const kept = await A.pg.evaluate(() => new Promise(res => {
    const out = { rec: !!localStorage.getItem('waypoint-world-spain-granada'), reg: JSON.parse(localStorage.getItem('waypoint-offline-cities-v1') || '{}') };
    const r = indexedDB.open('waypoint-offline', 1);
    r.onsuccess = () => { const q = r.result.transaction('blobs').objectStore('blobs').getAllKeys(); q.onsuccess = () => { out.blobs = q.result.length; res(out); }; };
    r.onerror = () => res(out);
  }));
  t.ok(/Granada ?Spain · saved .* · 4 photos/.test(savedRow) && /Remove$/.test(savedRow) && kept.rec && kept.blobs === 4 && kept.reg['spain-granada'] && kept.reg['spain-granada'].photos === 4 && A.packs.n === 1,
    'tapped: its record, and its four photos from one pack, are on the phone, and the row says so: ' + savedRow + ' (pack requests: ' + A.packs.n + ')');
  /* Granada has no street-map pack, so the save asks the nightly task for one: a small shared document, nothing private */
  const want = await until(() => { const v = A.store('get', 'mapwant/spain-granada'); return v ? JSON.parse(v) : null; }, 5000).catch(() => null);
  t.ok(want && want.country === 'Spain' && want.city === 'Granada' && Array.isArray(want.center) && want.center.length === 2 && want.center.every(Number.isFinite) && want.at > 1e12 && Object.keys(want).sort().join() === 'at,center,city,country',
    'saving a city with no street-map pack writes mapwant/spain-granada = { country, city, center, at }: ' + JSON.stringify(want));
  /* a trip to Granada made with no signal: its lists come from the saved record, its photo from the phone */
  await A.ctx.setOffline(true);
  await A.pg.evaluate(() => window.dispatchEvent(new Event('offline')));
  await granada(A.pg); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); });
  /* (a saved photo is read from the phone the first time it is asked for, then drawn: v202, lib/offline.js; so this waits for it) */
  let offl = null;
  await until(async () => { offl = await A.pg.evaluate(() => {
    const pool = W.pool('Spain', 'Granada');
    return pool && pool.spots && pool.spots.length >= 8 ? { spots: pool.spots.length, food: pool.food.length, lib: pool.lib || 0, pic: /src="blob:/.test(W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {})), days: W.P.days.filter(d => d.slots.some(x => x.item)).length } : null;
  }); return offl && offl.pic ? offl : null; }, 12000);
  t.ok(offl && offl.lib === 1 && offl.spots >= 8 && offl.food >= 6 && offl.pic && offl.days >= 1,
    'with no signal, a new trip to the saved city has its lists (from the record), its days and its photos (from the phone): ' + JSON.stringify(offl));
  await A.ctx.setOffline(false);
  await A.pg.evaluate(() => window.dispatchEvent(new Event('online')));
  /* removing it: off the list of saved cities; its photos stay while the open trip goes there */
  await A.pg.evaluate(() => { location.hash = '#settings'; }); await A.pg.waitForTimeout(800);
  await A.pg.click('#set-world [data-wl="drop"]');
  const gone = await until(async () => /Save for offline$/.test(await row()), 8000);
  const after = await A.pg.evaluate(() => JSON.parse(localStorage.getItem('waypoint-offline-cities-v1') || '{}'));
  t.ok(gone && !after['spain-granada'], '"Remove" takes it off the saved cities, and it can be saved again');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();
  /* ---- a pack in parts (v202): a trip city's photos in parts of about 1.5 MB; a day asks only for the part its
     photos are in, and saving the city for offline takes every part ---- */
  {
    /* (the tool: parts in the trip's order, each under the size; each photo marked with its part) */
    const tdir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-parts-')), fdir = path.join(tdir, 'files'); fs.mkdirSync(fdir);
    man.forEach(e => fs.copyFileSync(e.webp, path.join(fdir, fx.idOf(e.jpg) + '.webp')));
    const recs = Object.fromEntries(names.map((n, i) => [n, fx.record(man[i], 'old')]));
    fs.writeFileSync(path.join(tdir, 'spain-granada.json'), JSON.stringify({ city: 'Granada', country: 'Spain', items: recs }));
    fs.writeFileSync(path.join(tdir, 'wanted.json'), JSON.stringify({ city: 'Granada', used: [['Mirador de San Nicolas'], ['Parque de las Ciencias']] }));
    const one = man.reduce((m, e) => Math.max(m, fs.statSync(e.webp).size), 0);
    const saved = PK.PART_MAX; /* (two pictures a part, whatever their size here) */
    const bp = PK.buildParts.length;
    const r = PK.buildParts(path.join(tdir, 'spain-granada.json'), fdir, path.join(tdir, 'g'), path.join(tdir, 'wanted.json'));
    const sizes = r.parts.map(x => x.bytes), first = PK.read(fs.readFileSync(r.parts[0].file, 'utf8'));
    t.ok(r.n === 4 && sizes.every(x => x <= PK.PART_MAX) && first && first.items[0].url === u(man[3].jpg) && bp === 4,
      'built in parts: every part under ' + PK.PART_MAX + ' bytes, the trip\'s first stop first: ' + JSON.stringify(sizes) + ' (one picture ' + one + ' B; limit kept ' + saved + ')');
    /* two parts by hand (two photos each), uploaded as P1 and P2 */
    const P1 = '1'.repeat(32), P2 = '2'.repeat(32);
    const pa = PK.pack('spain-granada', '2026-11-14', gpics.slice(0, 2)), pb = PK.pack('spain-granada', '2026-11-14', gpics.slice(2));
    fs.writeFileSync(path.join(tdir, 'a.js'), pa); fs.writeFileSync(path.join(tdir, 'b.js'), pb);
    fs.writeFileSync(path.join(tdir, 'parts.json'), JSON.stringify([{ url: '/_blob/' + P1, file: path.join(tdir, 'a.js') }, { url: '/_blob/' + P2, file: path.join(tdir, 'b.js') }]));
    const mp = PK.markParts(path.join(tdir, 'spain-granada.json'), path.join(tdir, 'parts.json'), path.join(tdir, 'm.json'));
    const md = JSON.parse(fs.readFileSync(path.join(tdir, 'm.json'), 'utf8'));
    t.ok(mp.parts === 2 && mp.marked === 4 && md.items[names[0]].pk === 1 && md.items[names[2]].pk === 2 && md.pack.url === '/_blob/' + P1 && JSON.stringify(md.pack.parts) === JSON.stringify(['/_blob/' + P1, '/_blob/' + P2]),
      'marked in parts: each photo says its part, the index names every part: ' + JSON.stringify(md.pack));
    /* the app */
    const store = mkdb({ 'world/spain-granada': REC, 'world/_index': INDEX, 'photos/spain-granada': md }), C = await open(b, { width: 390, height: 844, db: store });
    const hits = { [P1]: 0, [P2]: 0 };
    await fx.serve(C.ctx, man);
    await C.ctx.route(/\/_blob\/[0-9a-f]{32}/, async route => {
      const id = /\/_blob\/([0-9a-f]{32})/.exec(route.request().url())[1];
      if (id === P1 || id === P2) { hits[id]++; return route.fulfill({ status: 200, body: id === P1 ? pa : pb, contentType: 'text/javascript' }); }
      return route.fulfill({ status: 404, body: '' });   /* (no photo has a file of its own any more) */
    });
    await granada(C.pg); await C.pg.waitForTimeout(2500);
    await C.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
    await until(() => C.pg.evaluate(() => !!(W.photoPack && W.photoFor({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada'))), 15000);
    await C.pg.waitForTimeout(1500);
    const drawn = { a: hits[P1], b: hits[P2] };   /* (the day on show: its photos' parts only) */
    const s3 = await C.pg.evaluate(() => { const ph = W.photoFor({ n: 'Mirador de San Nicolas' }, false, 'Spain', 'Granada'); return W.offline.src(ph.url, ph.pk); });
    await until(() => C.pg.evaluate(() => { const ph = W.photoFor({ n: 'Mirador de San Nicolas' }, false, 'Spain', 'Granada'); return /^blob:/.test(W.offline.src(ph.url, ph.pk)); }), 8000);
    await until(() => C.pg.evaluate(() => { const ph = W.photoFor({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada'); return /^blob:/.test(W.offline.src(ph.url, ph.pk)); }), 8000);
    const after = { a: hits[P1], b: hits[P2] };
    t.ok(/^data:image\/gif/.test(s3) && drawn.b === 0 && after.b === 1 && after.a <= 1,
      'a part is fetched only when one of its photos is wanted, and once: part 2 waited until its photo was asked for (on show ' + JSON.stringify(drawn) + ', then ' + JSON.stringify(after) + ')');
    t.ok(JSON.stringify(await C.pg.evaluate(() => W.photoPack.partsOf({ url: '/_blob/' + '1'.repeat(32), parts: ['/_blob/' + '1'.repeat(32), 'javascript:alert(1)'] }))) === JSON.stringify(['/_blob/' + '1'.repeat(32)]),
      'a part that is not one of the app\'s own files is never fetched (the city falls back to its first part)');
    t.eq(C.errors(), [], 'no page errors');
    await C.ctx.close();
  }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
};
