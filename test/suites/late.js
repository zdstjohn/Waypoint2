/* Late answers (v199): what a trip shows must not depend on when Claude's answers come or in which order. The same
   Granada trip, with the world library's record, is planned twice: once with answers as they come, once with every
   answer seconds late and their order shuffled. Once each is quiet, every stop's checked facts (hours, booking link,
   lead time, ticket, the "no entry without a ticket" mark, pin) and the To book list must be the same. (v196 shipped a
   bug of exactly this kind: Claude's guess at a ticket link replaced the official one a few seconds after it was laid.) */
const fs = require('fs'), path = require('path');
const { launch, open, settle, until, calm } = require('../lib/page');
const mkdb = require('../lib/db');
const REC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mocks', 'world-spain-granada.json'), 'utf8'));
exports.run = async t => {
  const b = await launch();
  const once = async late => {
    const A = await open(b, { width: 390, height: 844, db: mkdb({ 'world/spain-granada': REC }), init: late ? `window.__lateAsks = ${late};` : null });
    await A.pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Granada'] }], days: 3, start: '2027-06-13', depart: 'Seattle (SEA)', travelers: [41, 40, 6, 3] }); });
    await A.pg.waitForTimeout(1500);
    await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
    await until(() => A.pg.evaluate(() => W.worldHave && W.worldHave().includes('spain-granada')), 15000);
    /* the library's lists, so both runs plan from the same places (the stand-in's own lists are made up per run) */
    await A.pg.evaluate(() => { const pool = W.pool('Spain', 'Granada'), wp = W.worldPool('Spain', 'Granada'); pool.spots = wp.spots; pool.food = wp.food; W.S.picks = {}; W.S.stays['Spain|Granada'] = { label: 'Hotel Casa 1800 Granada', lat: 37.1789, lng: -3.5936 }; W.dataV = (W.dataV || 0) + 1; W.S.tview = 'days'; W.goView('trip'); W.render(); });
    /* each day drawn, as a person looks through the trip (a day on show asks for its stops' links, hours and lead times) */
    for (let n = 1; n <= 3; n++) { await A.pg.evaluate(n => { W.S.day = n; W.render(); }, n); await calm(A.pg, 20000, late ? 2500 : 800); }
    /* quiet: no answer out for a while, twice over (the late run's answers trickle in for several seconds) */
    for (let i = 0; i < 3; i++) { await calm(A.pg, 30000, late ? 4000 : 1200); await settle(A.pg, 3000); }
    const r = await A.pg.evaluate(() => {
      const P = W.plan(), pool = W.pool('Spain', 'Granada'), out = {};
      /* (the library's own places: more ideas asked for along the way are the stand-in's, made up per run) */
      const recNames = new Set(Object.keys((W.worldRecord && W.worldRecord('Spain', 'Granada') || {}).places || {}));
      pool.spots.concat(pool.food).filter(it => recNames.has(W.norm(it.n))).forEach(it => { out[it.n] = [it.hours && [it.hours.o, it.hours.c, (it.hours.closed || []).join('')].join(','), it.book || '', it.lead || 0, it.ticket || '', it.must || 0, it.lat, it.lng].join(' | '); });
      /* and against the record itself: a checked fact stands, whatever came after it */
      const rec = W.worldRecord ? W.worldRecord('Spain', 'Granada') : null, wrong = [];
      pool.spots.forEach(it => { const p = rec && rec.places[W.norm(it.n)]; if (!p || !p.entry || p.entry.unsure) return;
        if (p.entry.url && it.book !== p.entry.url) wrong.push(it.n + ' book ' + it.book);
        if (p.hours && p.hours.seasons && !it.wk) wrong.push(it.n + ' hours'); });
      return { facts: out, wrong, checked: rec ? Object.values(rec.places).filter(p => p.entry && !p.entry.unsure).length : 0, book: W.checklist(P).filter(c => !c.item || recNames.has(W.norm(c.item.n))).map(c => [c.title, c.url || '', c.must || 0, c.lead].join(' | ')).sort(), out: (window.__asks || {}).out };
    });
    t.eq(A.errors(), [], 'no page errors' + (late ? ' with late answers' : ''));
    await A.ctx.close();
    return r;
  };
  const a = await once(0), z = await once(2500);
  const diff = Object.keys(a.facts).filter(k => a.facts[k] !== z.facts[k]).map(k => k + ': ' + a.facts[k] + '  ≠  ' + z.facts[k]);
  t.ok(Object.keys(a.facts).length >= 20 && !diff.length, 'every stop\'s checked facts are the same whether answers come at once or late and out of order' + (diff.length ? ': ' + diff.slice(0, 4).join('; ') : ''));
  t.ok(a.checked >= 3 && !a.wrong.length && !z.wrong.length, "and in both, every fact the library checked stands as its record says (an answer that came after it doesn't replace it): " + JSON.stringify([a.checked, a.wrong.slice(0, 3), z.wrong.slice(0, 3)]));
  const bd = a.book.filter(x => !z.book.includes(x)).concat(z.book.filter(x => !a.book.includes(x)));
  t.ok(a.book.length > 2 && !bd.length, 'and so is the To book list' + (bd.length ? ': ' + bd.slice(0, 4).join('; ') : ''));
  await b.close();
};
