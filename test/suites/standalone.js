/* The installable version (dist/, from build/standalone.js), served the way its host will serve it: a phone can
   install it (manifest, icons, service worker; Chrome's own installability check), it opens with no connection after
   the first visit, it never points people to Claude for something it can't do and offers nothing that needs Claude or
   the shared database, and it says plainly what it can plan. */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http');
const PORT = 8774, URL = `http://127.0.0.1:${PORT}/`;
exports.run = async t => {
  const dist = path.join(__dirname, '..', '..', 'dist');
  t.ok(fs.existsSync(path.join(dist, 'index.html')) && fs.existsSync(path.join(dist, 'sw.js')), 'dist/ is built');
  const srv = spawn('node', [path.join(__dirname, '..', 'lib', 'sa-server.js'), String(PORT), dist], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); if (await new Promise(r => http.get(URL, res => r(res.statusCode === 200)).on('error', () => r(false)))) break; }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(); const errs = [], bad = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    pg.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await pg.addInitScript(() => { try { if (!localStorage.getItem('waypoint-now')) localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); } catch (e) {} });
    await pg.goto(URL); await pg.waitForTimeout(3500);
    /* installable */
    const man = await pg.evaluate(async () => { const m = await (await fetch('manifest.webmanifest')).json(); const sizes = [];
      for (const i of m.icons) { const im = new Image(); im.src = i.src; await im.decode(); sizes.push(i.sizes === im.naturalWidth + 'x' + im.naturalHeight); } return { name: m.name, display: m.display, start: m.start_url, maskable: m.icons.some(i => i.purpose === 'maskable'), sizes }; });
    t.ok(man.name === 'Waypoint' && man.display === 'standalone' && man.maskable && man.sizes.every(Boolean), 'the manifest names the app, opens it on its own, and its icons are the sizes it says: ' + JSON.stringify(man));
    const cdp = await ctx.newCDPSession(pg);
    const inst = await cdp.send('Page.getInstallabilityErrors');
    t.eq(inst.installabilityErrors.map(e => e.errorId), [], 'Chrome finds nothing stopping it from being installed');
    const st = await pg.evaluate(async () => ({ standalone: W.standalone, sw: W.pwa.sw, ctl: !!navigator.serviceWorker.controller, caches: (await caches.keys()).filter(k => /^waypoint-[0-9a-f]+$/.test(k)).length, claude: !!window.claude }));
    t.ok(st.standalone && st.sw === 'on' && st.ctl && st.caches === 1 && !st.claude, 'it runs on its own, with its service worker in charge and its files kept: ' + JSON.stringify(st));
    /* the first visit's Plan-a-trip form says what this version can plan, and only lists those countries */
    await pg.waitForFunction(() => document.querySelectorAll('#countryList option').length > 0, null, { timeout: 8000 }).catch(() => {});
    const qs = await pg.evaluate(() => ({ note: (document.querySelector('.sheet .sa-note, #sheethost .sa-note') || {}).textContent || '', list: [...document.querySelectorAll('#countryList option')].map(o => o.value).sort(), built: Object.keys(window.TD).sort() }));
    t.ok(/plans trips to Italy, Spain/.test(qs.note), 'the first screen says which countries it can plan: ' + qs.note.slice(0, 80));
    t.eq(qs.list, qs.built, 'and the country list offers only those');
    /* every screen: nothing points to Claude, nothing needs it */
    const scan = await pg.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), m = () => document.querySelector('main:not([hidden])'), out = { claude: [], ctl: [], empty: [] };
      const x = document.querySelector('[data-qs="close"]'); if (x) x.click(); await wait(200);
      const look = name => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        [...m().querySelectorAll('*')].filter(e => !e.children.length && vis(e) && /Claude/.test(e.textContent) && !/full Waypoint, in Claude/.test(e.textContent)).forEach(e => out.claude.push(name + ': ' + e.textContent.trim().slice(0, 80)));
        [...document.querySelectorAll('[data-gmail],[data-live],[data-watch],[data-cal],[data-jadd],[data-replan],[data-review],[data-import],[data-offcopy],[data-sync="share"],[data-sync="openshare"],[data-sync="settings"],[data-sync="review"]')].filter(vis).forEach(e => out.ctl.push(name + ': ' + Object.keys(e.dataset).join(',')));
        if (m().innerText.trim().length < 60) out.empty.push(name);
      };
      W.goView('go'); await wait(500); look('Today');
      W.setAppMode && W.setAppMode('plan'); W.S.tview = 'days'; W.S.glanceOpen = false; W.S.day = 2; W.goView('trip'); await wait(400); look('Day');
      W.S.glanceOpen = true; W.render(); await wait(200); look('All days');
      W.S.glanceOpen = false; W.S.tview = 'map'; W.render(); await wait(400); look('Explore');
      W.S.tview = 'days';
      for (const tab of ['tobook', 'booked', 'budget', 'pack', 'take']) { W.S.prepTab = tab; W.goView('book'); await wait(tab === 'pack' ? 700 : 250); look('Prepare ' + tab); }
      W.goView('setup'); await wait(500); look('Plan'); W.goView('settings'); await wait(300); look('Settings');
      out.install = !!document.querySelector('#set-install') && /Install on this phone/.test(document.querySelector('#set-install').textContent);
      W.goView('trip'); document.querySelector('[data-sync="menu"]').click(); await wait(300); look('Trip menu'); document.querySelector('[data-sync="menu"]').click();
      return out;
    });
    t.eq(scan.claude, [], 'no screen sends people to Claude for something this version can\'t do');
    t.eq(scan.ctl, [], 'nothing is offered that needs Claude or the shared database (Gmail, live prices, sharing, imports, the plan check…)');
    t.ok(!scan.empty.length && scan.install, 'every screen draws, and Settings has "Install on this phone": ' + scan.empty.join(','));
    /* a trip from scratch: built-in ideas, and an honest note where they run out */
    const plan = await pg.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      W.newTripFrom({ v: 2, algo: 2, styles: ['culture', 'food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Madrid', 'Barcelona'] }], days: 6, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [41, 40, 8, 6], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: '' });
      await wait(1500); W.setAppMode && W.setAppMode('plan'); W.S.tview = 'days'; W.S.glanceOpen = false; W.S.day = 1; W.goView('trip'); await wait(400);
      const filled = W.P.days.reduce((a, d) => a + d.slots.filter(x => x.item).length, 0);
      let note = ''; for (let n = 1; n <= W.P.N && !note; n++) { W.S.day = n; W.render(); note = (document.querySelector('#viewTrip .sa-note') || {}).textContent || ''; }
      return { name: W.tripName(), filled, note };
    });
    t.ok(plan.name === 'Spain trip' && plan.filled > 3, `a new Spain trip is planned from the built-in ideas (${plan.filled} stops)`);
    t.ok(/only a few ideas built in for (Madrid|Barcelona)/.test(plan.note), 'where they run out, the day says why: ' + plan.note.slice(0, 120));
    /* offline: reload with no connection, then a new tab */
    await pg.reload(); await pg.waitForTimeout(1500);
    await ctx.setOffline(true);
    await pg.reload(); await pg.waitForTimeout(2500);
    const off = await pg.evaluate(() => ({ name: W.tripName(), ok: document.querySelector('main:not([hidden])').innerText.length > 100, later: W.laterReady, fonts: [...document.fonts].some(f => f.family === 'Dela Gothic One' && f.status === 'loaded') }));
    t.ok(off.name === 'Spain trip' && off.ok && off.later && off.fonts, 'with no connection it opens on your trip, with everything (both scripts, the fonts): ' + JSON.stringify(off));
    const p2 = await ctx.newPage(); await p2.goto(URL + '#today'); await p2.waitForTimeout(2500);
    t.ok(await p2.evaluate(() => W.tripName() === 'Spain trip' && W.view() === 'go'), 'opened from the home screen (start page #today) with no connection, it shows Today');
    await ctx.setOffline(false);
    t.eq(bad.filter(u => !/favicon\.ico/.test(u)), [], 'every file it asks for is there');
    t.eq(errs, [], 'no errors');
    /* the hosting headers: a strict content policy, and the service worker never cached by the browser */
    const hd = await new Promise(r => http.get(URL + 'sw.js', res => r(res.headers)));
    const ih = await new Promise(r => http.get(URL, res => r(res.headers)));
    t.ok(/no-cache/.test(hd['cache-control'] || '') && /default-src 'self'/.test(ih['content-security-policy'] || '') && /frame-ancestors 'none'/.test(ih['content-security-policy'] || ''), 'the host sends a strict content policy and never lets the browser hold an old service worker');
    await ctx.close();
  } finally { await b.close(); srv.kill(); }
};
