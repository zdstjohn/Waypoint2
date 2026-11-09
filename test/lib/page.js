/* One place that opens the app the way every suite needs it: the Claude runtime mocked (mockdur.js + mock2.js), a seeded
   Math.random so two runs draw the same plan, an example trip loaded and the day list rendered. */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SEED = `(() => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();`;
async function launch() { return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
async function open(browser, { width = 360, height = 800, dark = false, scale = 1, uid = 'u-test', hash = '#trip', mocks = ['test/mocks/mockdur.js', 'test/mocks/mock2.js'], seeded = true, db = null, tz = null, firstRun = false, touch = true } = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', hasTouch: touch, reducedMotion: 'reduce' }, tz ? { timezoneId: tz } : {}));
  const pg = await ctx.newPage(); const errors = []; pg.on('pageerror', e => errors.push(e.message));
  /* a database path the real store would refuse counts as a page error even when the app catches it */
  pg.on('console', m => { if (m.type() === 'error' && /^\[(db path|boot)\]/.test(m.text())) errors.push(m.text()); });
  await pg.exposeFunction('__dbOp', db || (() => null));
  if (seeded) await pg.addInitScript(SEED);
  for (const m of mocks) await pg.addInitScript(fs.readFileSync(path.join(ROOT, m), 'utf8'));
  await pg.addInitScript(`window.__uid=${JSON.stringify(uid)};`);
  if (!firstRun) await pg.addInitScript(() => { try { localStorage.setItem('waypoint-welcome', '1'); } catch (e) {} });   /* the welcome sheet only in the test that checks it */
  await pg.goto('http://127.0.0.1:8771/index.html' + hash); await pg.waitForTimeout(2000);
  if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
  return { pg, ctx, errors: () => errors.slice() };
}
async function exampleTrip(pg) {
  await pg.evaluate(() => { W.S.start = '2027-06-07'; W.isExample = false; W.S.day = 2; W.S.tview = 'days'; W.render(); });
  await pg.waitForFunction(() => document.querySelectorAll('#viewTrip .slot').length > 4, null, { timeout: 30000 });
  await settle(pg);
}
/* background work (prices, transit, photos) changes what a screen shows; wait for it to finish so two runs agree */
/* quiet means: nothing loading, and still nothing loading half a second later (an answer's follow-up requests are made
   on idle time after the redraw, so a single quiet moment can sit between two batches) */
async function settle(pg, ms = 2500) {
  const quiet = () => pg.evaluate(() => !document.querySelector('.loading:not(.map-note .loading)') && !(window.W && W.status && Object.values(W.status).some(v => v === 'loading')));
  await pg.waitForTimeout(600);
  const end = Date.now() + ms;
  do {
    await pg.waitForFunction(() => !document.querySelector('.loading:not(.map-note .loading)') && !(W.status && Object.values(W.status).some(v => v === 'loading')), null, { timeout: Math.max(100, end - Date.now()) }).catch(() => {});
    await pg.waitForTimeout(500);
  } while (!(await quiet()) && Date.now() < end);
  await pg.waitForTimeout(200);
}
module.exports = { launch, open, exampleTrip, settle, ROOT };
