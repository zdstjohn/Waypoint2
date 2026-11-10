/* Planning together: the owner shares a trip and lets them change the plan; the other person (a second account on
   another phone) opens it with the code, says who they are, swaps a stop; the owner's app takes the change, logs who
   made it, saves it and shares it back; a later change of the owner's to the same slot stands; switching back to
   view-only takes the controls away. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const store = mkdb(), b = await launch();
  const A = await open(b, { width: 390, height: 844, db: store }); await exampleTrip(A.pg);
  await A.pg.click('[data-sync="menu"]'); await A.pg.waitForTimeout(400);
  await A.pg.click('[data-sync="share"]'); await A.pg.waitForTimeout(600);
  await A.pg.evaluate(() => { if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); });
  await A.pg.waitForTimeout(300);
  await A.pg.click('[data-sync="shareedit"]'); await A.pg.waitForTimeout(2500);
  const code = await A.pg.evaluate(() => W.S.share);
  const shared = await A.pg.evaluate(async c => JSON.parse(await window.__dbOp('get', 'shared/' + c, null) || 'null'), code);
  t.ok(code && shared && shared.edit === true, 'the owner shares the trip and lets them change the plan: ' + JSON.stringify({ code, edit: shared && shared.edit }));
  t.ok(await A.pg.evaluate(() => /They can change the plan too/.test(document.querySelector('.trip-menu').innerText)), 'with a switch in the share box');

  /* the other person, on their own phone */
  const B = await open(b, { width: 390, height: 844, db: store, uid: 'u-two' }); await settle(B.pg);
  await B.pg.click('[data-sync="menu"]'); await B.pg.waitForTimeout(400);
  await B.pg.fill('#openCode', code); await B.pg.click('[data-sync="openshare"]'); await B.pg.waitForTimeout(2500);
  const bo = await B.pg.evaluate(() => ({ edit: !!(W.readOnly && W.readOnly.edit), note: (document.querySelector('.ro-note') || {}).innerText || '', rr: document.querySelectorAll('#viewTrip [data-reroll]').length }));
  t.ok(bo.edit && /Planning together/.test(bo.note) && bo.rr > 0, 'they open it with the code and can change the plan: ' + JSON.stringify(bo));
  await B.pg.fill('#coWhoIn', 'Sam'); await B.pg.click('.co-who [data-sync="cowho"]:not([data-name])'); await B.pg.waitForTimeout(300);
  t.ok(await B.pg.evaluate(() => /as Sam/.test(document.querySelector('.co-bar').innerText)), 'and say who they are');
  /* Sam swaps a stop */
  const before = await B.pg.evaluate(() => { const r = document.querySelector('#viewTrip [data-reroll="am"]') || document.querySelector('#viewTrip [data-reroll]'); const slot = r.dataset.reroll, day = W.P.days[W.S.day - 1], x = day.slots.find(y => y.slot === slot); return { slot, key: x.key, was: x.item && x.item.n, day: day.n }; });
  await B.pg.click(`#viewTrip [data-reroll="${before.slot}"]`); await B.pg.waitForTimeout(700);
  const pick = await B.pg.evaluate(() => { const o = document.querySelector('.swap [data-use][data-name]'); return o && o.dataset.name; });
  if (pick) await B.pg.click('.swap [data-use][data-name]', { timeout: 5000 });
  await B.pg.waitForTimeout(2000);
  const ed = await B.pg.evaluate(async c => JSON.parse(await window.__dbOp('get', 'shared/' + c + '/edits/u-two', null) || 'null'), code);
  t.ok(pick && ed && ed.who === 'Sam' && ed.ops && ed.ops['picks|' + before.key] && ed.ops['picks|' + before.key].v === pick, 'their change goes to their own list of changes: ' + JSON.stringify({ pick, was: before.was, ops: ed && Object.keys(ed.ops || {}) }));
  /* the owner's app takes it, logs it, saves it and shares it back */
  await A.pg.waitForFunction(k => W.S.picks[k] && W.S.coLog && W.S.coLog.length, before.key, { timeout: 8000 }).catch(() => {});
  const ow = await A.pg.evaluate(k => ({ pick: W.S.picks[k], mine: !!(W.S.mine || {})[k], log: (W.S.coLog || []).map(e => e.who + ' ' + e.t), seen: (W.S.coSeen || {})['u-two'] || 0 }), before.key);
  t.ok(ow.pick === pick && ow.mine, 'the owner\'s plan takes the change, as a person\'s choice: ' + JSON.stringify(ow));
  t.ok(ow.log.some(l => l === 'Sam chose ' + pick + ' for Day ' + before.day + ' ' + ({ breakfast: 'breakfast', am: 'morning', lunch: 'lunch', pm: 'afternoon', dinner: 'dinner', eve: 'evening' })[before.slot]), 'and logs who changed what: ' + JSON.stringify(ow.log));
  await A.pg.evaluate(() => { if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); }); await A.pg.waitForTimeout(400);
  t.ok(await A.pg.evaluate(() => /Recent changes/.test(document.querySelector('.trip-menu').innerText) && /Sam chose/.test(document.querySelector('.trip-menu').innerText)), 'the share box shows the recent changes');
  await A.pg.waitForTimeout(2500);
  const back = await A.pg.evaluate(async ({ c, k }) => { const s = JSON.parse(await window.__dbOp('get', 'shared/' + c, null) || 'null'); return s && { pick: s.state.picks[k], seen: (s.coSeen || {})['u-two'] || 0, log: (s.log || []).length }; }, { c: code, k: before.key });
  t.ok(back && back.pick === pick && back.seen > 0 && back.log > 0, 'and the shared copy carries it back, with what was taken: ' + JSON.stringify(back));
  await B.pg.waitForTimeout(1500);
  const bv = await B.pg.evaluate(k => ({ pick: W.S.picks[k], pending: Object.keys(JSON.parse(localStorage.getItem('waypoint-co-' + W.readOnly.code) || '{}')).length, log: /Sam chose/.test((document.querySelector('.co-bar') || {}).innerText || '') }), before.key);
  t.ok(bv.pick === pick && bv.pending === 0 && bv.log, 'Sam sees it stand, nothing left waiting, and the log: ' + JSON.stringify(bv));
  /* a person's choice stands on every phone, also where the planner wouldn't pick it (the shared copy carries which picks
     were chosen; without it, Sam's app planned that slot afresh) */
  t.ok(await B.pg.evaluate(k => !!(W.S.mine || {})[k], before.key), 'and on Sam\'s phone it is a person\'s choice too');
  /* the owner changes the same slot afterwards: theirs stands, Sam's older change is not taken again */
  await A.pg.evaluate(() => { const m = document.querySelector('.trip-menu'); if (m) document.querySelector('[data-sync="menu"]').click(); });
  await A.pg.evaluate(d => { W.S.day = d; W.render(); }, before.day); await A.pg.waitForTimeout(300);
  await A.pg.click(`#viewTrip [data-reroll="${before.slot}"]`); await A.pg.waitForTimeout(700);
  const own = await A.pg.evaluate(p => { const o = [...document.querySelectorAll('.swap [data-use][data-name]')].find(x => x.dataset.name && x.dataset.name !== p); return o && o.dataset.name; }, pick);
  if (own) await A.pg.click(`.swap [data-use][data-name="${own}"]`, { timeout: 5000 });
  await A.pg.waitForTimeout(3000);
  const st = await A.pg.evaluate(k => W.S.picks[k], before.key);
  t.ok(own && st === own, 'a later change of the owner\'s to the same slot stands: ' + JSON.stringify({ own, st }));
  /* back to view-only */
  await A.pg.evaluate(() => { if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); }); await A.pg.waitForTimeout(300);
  await A.pg.click('[data-sync="shareedit"]'); await A.pg.waitForTimeout(3000);
  await B.pg.waitForTimeout(1500);
  const vo = await B.pg.evaluate(() => ({ edit: !!(W.readOnly && W.readOnly.edit), rr: document.querySelectorAll('#viewTrip [data-reroll]').length, note: (document.querySelector('.ro-note') || {}).innerText || '' }));
  t.ok(!vo.edit && vo.rr === 0 && /view only/.test(vo.note), 'switching back to view-only takes the controls away: ' + JSON.stringify(vo));
  t.eq(A.errors().concat(B.errors()), [], 'no page errors');
  await A.ctx.close(); await B.ctx.close(); await b.close();
};
