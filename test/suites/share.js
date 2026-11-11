/* A shared trip is locked to its code (lib/sharebox.js): the database, which every signed-in person can read and list,
   holds it under a name and in a form only the code gives. A trip shared before v131 (in the open, under its code) still
   opens, is replaced by its locked copy the next time its owner's app saves it, and whoever has it open follows along.
   Hearts travel sealed too; stopping takes the locked copy away; a wrong code opens nothing. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const store = mkdb(), b = await launch();
  const A = await open(b, { width: 390, height: 844, db: store }); await exampleTrip(A.pg);
  const all = pg => pg.evaluate(async () => {
    const out = {}, walk = async p => { for (const d of JSON.parse(await window.__dbOp('list', p, null) || '[]')) { out[p + '/' + d.id] = d.body; for (const sub of ['pools', 'edits', 'hearts']) await walk(p + '/' + d.id + '/' + sub); } };
    await walk('shared'); return out;
  });
  const openCode = async (pg, code) => {
    await pg.evaluate(() => { if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); }); await pg.waitForTimeout(400);
    await pg.fill('#openCode', code); await pg.click('[data-sync="openshare"]'); await pg.waitForTimeout(2500);
  };

  /* 1. a trip shared before v131: in the open, under a short code, as that version wrote it */
  const OLD = 'abc234';
  await A.pg.evaluate(async code => {
    const st = JSON.parse(JSON.stringify(W.S)); ['bookings', 'booked', 'exported', 'mailSeen', 'seen', 'lodgeSeen', 'share', 'tripId'].forEach(k => delete st[k]);
    await window.__dbOp('set', 'shared/' + code, JSON.stringify({ name: 'Italy the old way', owner: 'u-test', legs: {}, state: st, cities: ['italy-rome'], edit: false, coSeen: {}, log: [], updated: 5 }));
    await window.__dbOp('set', 'shared/' + code + '/pools/italy-rome', JSON.stringify({ k: 'Italy|Rome', pool: W.C.city['Italy|Rome'] }));
    await window.__dbOp('set', 'shared/' + code + '/hearts/u-old', JSON.stringify({ items: { 'colosseum': 1 }, at: 3 }));
  }, OLD);
  const B = await open(b, { width: 390, height: 844, db: store, uid: 'u-two' }); await settle(B.pg);
  await openCode(B.pg, OLD);
  const b1 = await B.pg.evaluate(() => ({ name: W.readOnly && W.readOnly.name, plain: !!(W.readOnly && W.readOnly.box && W.readOnly.box.plain), rome: !!(W.P && W.P.days.some(d => d.city === 'Rome')), note: (document.querySelector('.ro-note') || {}).innerText || '' }));
  t.ok(b1.name === 'Italy the old way' && b1.plain && b1.rome && /view only/i.test(b1.note), 'a trip shared before v131 still opens with its code: ' + JSON.stringify(b1));

  /* 2. its owner's app saves it: the locked copy replaces the open one, and the open one's lists and hearts go */
  await A.pg.evaluate(code => { W.S.share = code; W.S.tripName = 'Italy, locked'; W.changed(); }, OLD);
  await A.pg.evaluate(async code => { for (let i = 0; i < 100 && (await window.__dbOp('get', 'shared/' + code, null)); i++) await new Promise(r => setTimeout(r, 150)); }, OLD);
  await A.pg.waitForTimeout(1500);
  const d2 = await all(A.pg), keys2 = Object.keys(d2), raw2 = JSON.stringify(d2);
  const id = await A.pg.evaluate(code => W.shareBox(code).then(bx => bx.id), OLD);
  t.ok(!keys2.some(k => k.indexOf('shared/' + OLD) === 0), 'the open copy is gone, with its ideas list and hearts: ' + JSON.stringify(keys2.map(k => k.slice(0, 40))));
  t.ok(keys2.includes('shared/' + id) && keys2.some(k => k.indexOf('shared/' + id + '/pools/x') === 0) && keys2.every(k => /^shared\/x[0-9a-f]{24}(\/(pools|edits|hearts)\/[\w-]+)?$/.test(k)),
    'the locked copy and its ideas lists are there, under names made from the code');
  t.ok(!new RegExp([OLD, 'Italy', 'Rome', 'Colosseum', 'travelers', 'picks', '"state"', 'u-test'].join('|')).test(raw2) && keys2.every(k => { const d = d2[k]; return d && d.v === 1 && typeof d.ct === 'string' && Object.keys(d).every(f => ['v', 'iv', 'ct', 'at', 'z'].includes(f)); }),
    'a listing of the database shows no code, name, traveler, place or plan: only sealed text');
  /* 3. whoever had the open copy on screen follows it to the locked one */
  await B.pg.waitForFunction(() => W.readOnly && W.readOnly.box && !W.readOnly.box.plain && W.readOnly.name === 'Italy, locked', null, { timeout: 12000 }).catch(() => {});
  const b3 = await B.pg.evaluate(() => ({ name: W.readOnly && W.readOnly.name, plain: !!(W.readOnly && W.readOnly.box && W.readOnly.box.plain), gone: !!(W.readOnly && W.readOnly.gone), view: W.S.view, rome: !!(W.P && W.P.days.some(d => d.city === 'Rome')) }));
  t.ok(b3.name === 'Italy, locked' && !b3.plain && !b3.gone && b3.rome, 'the person viewing it follows to the locked copy, without being told it stopped: ' + JSON.stringify(b3));
  /* 4. a heart from them is sealed, and its owner sees it */
  const hk = await B.pg.evaluate(async () => {
    const d = W.P.days.find(x => x.city === 'Rome'); W.S.day = d.n; W.S.tview = 'days'; W.goView('trip'); W.render(); await new Promise(r => setTimeout(r, 300));
    const stop = document.querySelector('#viewTrip [data-open], #viewTrip .stop'); if (stop) stop.click(); await new Promise(r => setTimeout(r, 500));
    const h = document.querySelector('[data-heart]'); if (!h) return null; const k = h.dataset.heart; h.click(); await new Promise(r => setTimeout(r, 1500)); return k;
  });
  const d4 = await all(A.pg), heart = Object.keys(d4).find(k => /\/hearts\/u-two$/.test(k));
  const seen = hk && await A.pg.evaluate(async k => { for (let i = 0; i < 40; i++) { const p = W.pool('Italy', 'Rome'), it = p && p.spots.concat(p.food).find(x => W.norm(x.n) === k); if (it && W.heartsFor(it)) return W.heartsFor(it); await new Promise(r => setTimeout(r, 100)); } return 0; }, hk);
  t.ok(hk && heart && d4[heart].ct && !JSON.stringify(d4[heart]).includes(hk) && seen === 1, 'their heart is sealed with the trip\'s code and the owner sees it: ' + JSON.stringify({ hk, heart: !!heart, seen }));
  /* 5. a wrong code opens nothing; stopping takes the locked copy away and tells whoever has it open */
  const C = await open(b, { width: 390, height: 844, db: store, uid: 'u-three' }); await settle(C.pg);
  await openCode(C.pg, 'abc235abc235');
  const c5 = await C.pg.evaluate(() => ({ ro: !!W.readOnly, msg: (document.querySelector('.share-msg, .trip-menu') || {}).innerText || '' }));
  t.ok(!c5.ro && /No shared trip with that code/.test(c5.msg), 'a wrong code opens nothing');
  await A.pg.evaluate(() => { if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); }); await A.pg.waitForTimeout(400);
  const hint = await A.pg.evaluate(() => /older, short code/.test(document.querySelector('.trip-menu').innerText));
  await A.pg.click('[data-sync="unshare"]'); await A.pg.waitForTimeout(2500);
  const d5 = await all(A.pg);
  await B.pg.waitForFunction(() => W.readOnly && W.readOnly.gone, null, { timeout: 8000 }).catch(() => {});
  t.ok(hint && !Object.keys(d5).some(k => k === 'shared/' + id || /\/pools\//.test(k)) && await B.pg.evaluate(() => !!(W.readOnly && W.readOnly.gone)), 'an old short code says so; stopping removes the locked copy and its lists, and the viewer is told: ' + JSON.stringify(Object.keys(d5)));
  /* 6. sharing again makes a 12-character code, never kept in the open */
  await A.pg.evaluate(() => { if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); }); await A.pg.waitForTimeout(400);
  await A.pg.click('[data-sync="share"]'); await A.pg.waitForTimeout(2500);
  const code = await A.pg.evaluate(() => W.S.share), d6 = await all(A.pg);
  t.ok(/^[a-z2-9]{12}$/.test(code) && !Object.keys(d6).some(k => k.includes(code)) && !JSON.stringify(d6).includes(code) && Object.keys(d6).some(k => /^shared\/x[0-9a-f]{24}$/.test(k)), 'a new code has 12 characters and appears nowhere in the database: ' + code.length);
  await openCode(C.pg, code.slice(0, 4) + ' ' + code.slice(4, 8).toUpperCase() + '-' + code.slice(8));
  t.ok(await C.pg.evaluate(() => !!(W.readOnly && W.readOnly.name) && !W.readOnly.box.plain), 'and opens the trip, however it is typed (spaces, capitals)');
  t.eq(A.errors().concat(B.errors(), C.errors()), [], 'no page errors');
  await A.ctx.close(); await B.ctx.close(); await C.ctx.close(); await b.close();
};
