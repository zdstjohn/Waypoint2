/* The installable version signed in to its own server (lib/cloud.js), against a stand-in Supabase
   (test/lib/fake-supabase.js) and Claude answered in the page by the usual test answers:
   only invited emails get an account; a signed-in person gets Claude's ideas for anywhere, trips saved to the account
   and opened on a second device, and sharing; one person can't read another's trips; an expired sign-in renews by
   itself; signing out, or going without an account, leaves the phone-only app as it was. */
const { chromium } = require('playwright'); const { spawn, spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.join(__dirname, '..', '..'), SB = 8775, WEB = 8776, URL = `http://127.0.0.1:${WEB}/`;
const up = u => new Promise(r => http.get(u, res => { res.resume(); r(true); }).on('error', () => r(false)));
const state = () => new Promise(r => http.get({ host: '127.0.0.1', port: SB, path: '/__state', headers: { apikey: 'pk_test' } }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => r(JSON.parse(b))); }));
const expire = () => new Promise(r => http.get({ host: '127.0.0.1', port: SB, path: '/__expire', headers: { apikey: 'pk_test' } }, res => { res.resume(); res.on('end', r); }));
exports.run = async t => {
  const out = path.join(t.out, 'dist-cloud');
  const bld = spawnSync('node', [path.join(ROOT, 'build', 'standalone.js')], { env: Object.assign({}, process.env, { WP_DIST: out, WP_CLOUD_URL: `http://127.0.0.1:${SB}`, WP_CLOUD_KEY: 'pk_test' }), encoding: 'utf8' });
  t.ok(bld.status === 0 && fs.existsSync(path.join(out, 'cloud.js')), 'built against the stand-in server ' + (bld.stderr || '').slice(0, 200));
  t.ok(!/fbgubkesrlvtcnbaxuef/.test(fs.readFileSync(path.join(out, 'standalone.js'), 'utf8')) && /fbgubkesrlvtcnbaxuef/.test(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')), 'the test build points at the stand-in, and the real hosting rules are untouched');
  const sb = spawn('node', [path.join(ROOT, 'test', 'lib', 'fake-supabase.js'), String(SB), 'ann@example.com,bob@example.com'], { stdio: 'ignore' });
  const web = spawn('node', [path.join(ROOT, 'test', 'lib', 'sa-server.js'), String(WEB), out, out + '.vercel.json'], { stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await up(URL) && await up(`http://127.0.0.1:${SB}/`)); i++) await new Promise(r => setTimeout(r, 150));
  const b = await chromium.launch();
  /* a phone: the usual test answers stand in for Claude, behind the real request to the "claude" function */
  const phone = async (label, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(), errs = [], asked = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    await pg.exposeFunction('__dbOp', () => null);
    for (const m of ['test/mocks/mockdur.js', 'test/mocks/mock2.js']) await pg.addInitScript(fs.readFileSync(path.join(ROOT, m), 'utf8'));
    await pg.addInitScript(() => { window.__mockSample = window.claude.use('sample'); try { localStorage.setItem('waypoint-welcome', '1'); } catch (e) {} });
    await pg.route('**/functions/v1/claude', async route => {
      const rq = route.request(), auth = rq.headers().authorization || '', body = JSON.parse(rq.postData() || '{}');
      asked.push({ tier: body.tier, head: String(body.prompt).slice(0, 40), auth: /^Bearer [0-9a-f]{32}$/.test(auth) });
      if (opts.limitAfter != null && asked.length > opts.limitAfter) return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: "That's today's 200 questions to Claude. More tomorrow.", code: 'rate_limited' }) });
      const res = await pg.evaluate(([p, tier]) => window.__mockSample.then(s => s.json(p, { modelTier: tier })), [body.prompt, body.tier]).catch(() => ({}));
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ text: '```json\n' + JSON.stringify(res) + '\n```', model: 'test' }) });
    });
    await pg.goto(URL + '#trip'); await pg.waitForTimeout(1500);
    return { ctx, pg, errs, asked };
  };
  const signIn = async (pg, email, pw, newAcct) => {
    if (newAcct) await pg.click('.auth-gate [data-auth="up"]');
    await pg.fill('#authEmail', email); await pg.fill('#authPw', pw);
    await Promise.all([pg.waitForNavigation({ timeout: 8000 }).catch(() => null), pg.click('.auth-go')]);
    await pg.waitForTimeout(1500);
  };
  try {
    /* 1. the gate; an email that wasn't invited; then Ann makes her account */
    const A = await phone('A');
    t.ok(await A.pg.isVisible('.auth-gate .auth-card'), 'the first open asks you to sign in (or go without an account)');
    await A.pg.click('.auth-gate [data-auth="up"]'); await A.pg.fill('#authEmail', 'stranger@example.com'); await A.pg.fill('#authPw', 'longenough1'); await A.pg.click('.auth-go'); await A.pg.waitForTimeout(600);
    t.ok(/hasn't been invited/.test(await A.pg.textContent('.auth-err')), 'an email that was not invited cannot make an account');
    await A.pg.fill('#authPw', 'short'); await A.pg.click('.auth-go');
    t.ok(/at least 8 characters/.test(await A.pg.textContent('.auth-err')), 'a short password is caught before it is sent');
    await A.pg.fill('#authEmail', 'Ann@Example.com'); await A.pg.fill('#authPw', 'ann-pass-123');
    await Promise.all([A.pg.waitForNavigation({ timeout: 8000 }).catch(() => null), A.pg.click('.auth-go')]); await A.pg.waitForTimeout(2500);
    const a1 = await A.pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), cloud: W.cloud, sample: W.sampleState, cls: document.documentElement.classList.contains('cloud') }));
    t.ok(!a1.gate && a1.cloud && a1.sample === 'on' && a1.cls, 'Ann is signed in: no gate, Claude is on: ' + JSON.stringify(a1));
    /* 2. Claude's ideas for a city with none built in, through the function, with her sign-in */
    await A.pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture', 'food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Madrid', 'Málaga'] }], days: 5, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [41, 40, 8], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Spain with Claude' }); });
    await A.pg.waitForFunction(() => W.P && W.P.days.length === 5 && W.P.days[4].slots.filter(x => x.item).length >= 4, null, { timeout: 30000 }).catch(() => {});
    const a2 = await A.pg.evaluate(() => ({ malaga: W.P.days[4].city, filled: W.P.days[4].slots.filter(x => x.item).length, note: !!document.querySelector('.sa-info'), countries: document.querySelectorAll('#countryList option').length }));
    t.ok(a2.malaga === 'Málaga' && a2.filled >= 4 && !a2.note, `Málaga (no built-in ideas) is planned from Claude's answers (${a2.filled} stops), with no "few ideas" note: ` + JSON.stringify(a2) + ' ' + JSON.stringify(A.asked.map(x => x.head)).slice(0, 600));
    t.ok(A.asked.length > 5 && A.asked.every(x => x.auth) && A.asked.some(x => x.tier === 'quick') && A.asked.some(x => x.tier === 'default'), `each question goes to the function with her sign-in (${A.asked.length} questions)`);
    /* 3. saved to her account */
    await A.pg.waitForTimeout(3500);
    let s = await state();
    const tripDocs = s.docs.filter(p => /\/trips\/t\//.test(p));
    t.ok(tripDocs.length >= 1 && tripDocs.every(p => s.owners[p] === 'ann@example.com'), 'her trip is saved to her account: ' + tripDocs.length);
    /* 4. the menu offers sharing and importing again, and Settings shows the account */
    const a4 = await A.pg.evaluate(async () => { W.goView('settings'); await new Promise(r => setTimeout(r, 600)); const acct = (document.querySelector('#set-acct') || {}).textContent || ''; const imp = !!document.querySelector('#set-import'); W.goView('trip'); return { acct, imp }; });
    t.ok(/Signed in as ann@example\.com/.test(a4.acct) && a4.imp, 'Settings shows who is signed in, and pasting an itinerary is back');
    /* 5. her second device */
    const A2 = await phone('A2'); await signIn(A2.pg, 'ann@example.com', 'ann-pass-123');
    await A2.pg.waitForFunction(() => W.tripName && /Spain with Claude/.test(document.body.innerText + ' ' + JSON.stringify(Object.values(JSON.parse(localStorage.getItem('waypoint-trips-v1') || localStorage.getItem('waypoint-trips') || '{}')))), null, { timeout: 15000 }).catch(() => {});
    const a5 = await A2.pg.evaluate(async () => { document.querySelector('[data-sync="menu"]').click(); await new Promise(r => setTimeout(r, 500)); const t = document.body.innerText; document.querySelector('[data-sync="menu"]').click(); return /Spain with Claude/.test(t) || W.tripName() === 'Spain with Claude'; });
    t.ok(a5, 'on her second device, after signing in, the trip is there');
    /* 6. Bob can't see Ann's trips; the server refuses a write into her space */
    const B = await phone('B'); await signIn(B.pg, 'bob@example.com', 'bob-pass-123', true);
    const annId = await A.pg.evaluate(async () => (await window.claude.use('user')).id());
    const b6 = await B.pg.evaluate(async (ann) => {
      const db = await window.claude.use('db');
      const mine = await db.collection('data/users/' + ann + '/trips/t').get();
      let refused = '';
      try { await db.doc('data/users/someone-else/trips/t/x').set({ hi: 1 }); } catch (e) { refused = e.code; }
      return { mine: mine.size, refused };
    }, annId);
    s = await state();
    t.ok(b6.mine === 0 && b6.refused === 'not_granted' && !s.docs.includes('data/users/someone-else/trips/t/x'), "Bob sees none of Ann's trips, and can't write into anyone else's space: " + JSON.stringify(b6));
    /* 7. sharing: Ann shares, Bob opens it with the code */
    const code = await A.pg.evaluate(async () => {
      document.querySelector('[data-sync="menu"]').click(); await new Promise(r => setTimeout(r, 400));
      const sh = document.querySelector('[data-sync="share"]'); if (!sh) return 'no share button';
      sh.click(); await new Promise(r => setTimeout(r, 3000)); const c = W.S.share || 'no code'; document.querySelector('[data-sync="menu"]').click(); return c;
    });
    t.ok(/^[a-z0-9]{4,10}$/i.test(code), 'Ann can share her trip: ' + code);
    if (/^[a-z0-9]{4,10}$/i.test(code)) {
      await B.pg.evaluate(c => { document.querySelector('[data-sync="menu"]').click(); }); await B.pg.waitForTimeout(400);
      await B.pg.fill('#openCode', code); await B.pg.click('[data-sync="openshare"]');
      await B.pg.waitForFunction(() => W.readOnly && W.P && W.P.stops.length === 2, null, { timeout: 15000 }).catch(() => {});
      t.ok(await B.pg.evaluate(() => !!W.readOnly && W.P.stops.map(s => s.name).join() === 'Madrid,Málaga'), 'Bob opens it with the code and sees her plan, read-only');
    }
    /* 8. an expired sign-in renews by itself */
    await expire();
    const r8 = await A.pg.evaluate(async () => { const db = await window.claude.use('db'), me = await (await window.claude.use('user')).id(); try { const s = await db.collection('data/users/' + me + '/trips/t').get(); return 'ok ' + s.size; } catch (e) { return 'failed ' + e.code; } });
    t.ok(/^ok [1-9]/.test(r8) || /^failed/.test(r8) === false, 'after the access token expires, the next request renews it and carries on: ' + r8);
    /* 9. Claude's daily limit says so plainly */
    const L = await phone('L', { limitAfter: 0 }); await signIn(L.pg, 'bob@example.com', 'bob-pass-123');
    await L.pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Málaga'] }], days: 2, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [40], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Limit' }); });
    await L.pg.waitForTimeout(3000);
    t.ok(await L.pg.evaluate(() => Object.values(W.status).some(v => /Busy right now/.test(String(v)))), 'over the daily limit, a request says to try later instead of failing silently');
    /* 10. signing out leaves the phone-only app; going without an account too */
    await A.pg.evaluate(() => { W.goView('settings'); }); await A.pg.waitForTimeout(800);
    await Promise.all([A.pg.waitForNavigation({ timeout: 8000 }).catch(() => null), A.pg.click('[data-acct="out"]')]); await A.pg.waitForTimeout(1500);
    const a10 = await A.pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), cloud: W.cloud, sample: W.sampleState }));
    t.ok(a10.gate && !a10.cloud, 'signing out brings back the sign-in screen');
    await A.pg.click('.auth-gate [data-auth="skip"]'); await A.pg.waitForTimeout(800);
    const a11 = await A.pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), view: W.view(), text: document.querySelector('main:not([hidden])').innerText.length }));
    t.ok(!a11.gate && a11.text > 100, '"Use without an account" goes straight to the app on this phone');
    await A.pg.reload(); await A.pg.waitForTimeout(1500);
    t.ok(await A.pg.evaluate(() => !document.querySelector('.auth-gate')), 'and it remembers that choice next time');
    t.eq([].concat(A.errs, A2.errs, B.errs, L.errs), [], 'no errors');
  } finally { await b.close(); sb.kill(); web.kill(); }
};
