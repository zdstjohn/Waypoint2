/* Taps that land before the second script (v157). What a tap DOES on the Trip screen (swap, undo, reorder, a stop's
   sheet) comes with app2.js, a moment after the first screen. On a slow connection that moment can be seconds: a tap
   in it must not be lost. Here app2.js is held back for 7 s; changing day works at once (it stays in the first
   script), and a Swap and a tap on a stop made meanwhile are both done when the script arrives. */
const { launch, open } = require('../lib/page');
exports.run = async t => {
  const b = await launch();
  const HOLD = 7000;
  const init = new Function(`const add = HTMLHeadElement.prototype.appendChild; HTMLHeadElement.prototype.appendChild = function (n) {
    if (n && n.tagName === 'SCRIPT' && /app2\\.js/.test(n.src || '')) { const self = this; window.__held = Date.now(); setTimeout(function () { add.call(self, n); }, ${HOLD}); return n; }
    return add.call(this, n); };`);
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844, init });
  await pg.evaluate(() => { W.S.start = '2027-06-07'; W.isExample = false; W.S.day = 2; W.S.tview = 'days'; W.render(); });
  await pg.waitForFunction(() => document.querySelectorAll('#viewTrip .slot').length > 4, null, { timeout: 15000 });
  const s0 = await pg.evaluate(() => ({ later: !!W.laterReady, held: !!window.__held, act: typeof W.tripX.act, day: W.S.day, cards: document.querySelectorAll('#viewTrip .slots .slot[data-slotkey]').length }));
  t.ok(!s0.later && s0.held && s0.act === 'undefined' && s0.cards > 2, 'the first screen is up and the second script has not arrived: ' + JSON.stringify(s0));

  /* changing day: at once */
  await pg.click('#viewTrip .dpill[data-day="3"]'); await pg.waitForTimeout(400);
  t.eq(await pg.evaluate(() => W.S.day), 3, 'a tap on another day changes the day at once, before the second script');
  await pg.click('#viewTrip .dpill[data-day="2"]'); await pg.waitForTimeout(400);

  /* Swap on a stop, then a tap on another stop's card: kept */
  const key = await pg.evaluate(() => { const r = document.querySelector('#viewTrip .slots .slot:not(.free) [data-reroll]'); return r ? r.dataset.reroll : null; });
  t.ok(!!key, 'a stop has a Swap button');
  await pg.click(`#viewTrip [data-reroll="${key}"]`); await pg.waitForTimeout(300);
  const mid = await pg.evaluate(() => ({ later: !!W.laterReady, swap: !!document.querySelector('.swap') }));
  t.ok(!mid.later && !mid.swap, 'before the second script the swap is not open yet: ' + JSON.stringify(mid));
  await pg.waitForFunction(() => W.laterReady, null, { timeout: HOLD + 8000 });
  await pg.waitForTimeout(600);
  const end = await pg.evaluate(k => ({ swap: !!document.querySelector('.swap'), open: W.tripX.swapOpen === k, act: typeof W.tripX.act }), key);
  t.ok(end.swap && end.open && end.act === 'function', 'when it arrives, the Swap that was tapped is open: ' + JSON.stringify(end));
  t.eq(errors(), [], 'no errors');
  await ctx.close();

  /* a tap on a stop's card (handled by the second script's own click handler): replayed to it */
  const r2 = await open(b, { width: 390, height: 844, init });
  await r2.pg.evaluate(() => { W.S.start = '2027-06-07'; W.isExample = false; W.S.day = 2; W.S.tview = 'days'; W.render(); });
  await r2.pg.waitForFunction(() => document.querySelectorAll('#viewTrip .slot').length > 4, null, { timeout: 15000 });
  const name = await r2.pg.evaluate(() => { const c = document.querySelector('#viewTrip .slots .slot[data-slotkey]:not(.free):not(.skel) .slot-toggle b, #viewTrip .slots .slot[data-slotkey]:not(.free):not(.skel) h4'); return c ? c.textContent.trim() : ''; });
  await r2.pg.evaluate(() => { const c = document.querySelector('#viewTrip .slots .slot[data-slotkey]:not(.free):not(.skel) .when, #viewTrip .slots .slot[data-slotkey]:not(.free):not(.skel)'); c.click(); });
  await r2.pg.waitForTimeout(300);
  t.ok(await r2.pg.evaluate(() => !W.laterReady && !document.querySelector('#sheethost .sheet')), 'a stop tapped before the second script: its sheet is not open yet');
  await r2.pg.waitForFunction(() => W.laterReady, null, { timeout: HOLD + 8000 });
  await r2.pg.waitForTimeout(800);
  const sh = await r2.pg.evaluate(() => { const s = document.querySelector('#sheethost .sheet'); return s ? (s.querySelector('h2, h3') || s).textContent.trim().slice(0, 60) : null; });
  t.ok(!!sh, `when it arrives, the stop's sheet opens (${sh}${name ? ', tapped: ' + name : ''})`);
  t.eq(r2.errors(), [], 'no errors');
  await b.close();
};
