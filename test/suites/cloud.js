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
  const PACKFILE = path.join(ROOT, 'vtassets', 'parts', 'greece-nafplio.p0.js');   /* (a real pack, where the machine has the map sources) */
  const sb = spawn('node', [path.join(ROOT, 'test', 'lib', 'fake-supabase.js'), String(SB), 'ann@example.com,bob@example.com'], { stdio: 'ignore', env: Object.assign({}, process.env, { FAKE_PACK: PACKFILE }) });
  const seed = (p, data) => new Promise(r => { const q = http.request({ host: '127.0.0.1', port: SB, path: '/__seed', method: 'POST', headers: { apikey: 'pk_test', 'Content-Type': 'application/json' } }, res => { res.resume(); res.on('end', r); }); q.end(JSON.stringify({ path: p, data })); });
  const web = spawn('node', [path.join(ROOT, 'test', 'lib', 'sa-server.js'), String(WEB), out, out + '.vercel.json'], { stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await up(URL) && await up(`http://127.0.0.1:${SB}/`)); i++) await new Promise(r => setTimeout(r, 150));
  const b = await chromium.launch();
  /* a phone: the usual test answers stand in for Claude, behind the real request to the "claude" function */
  const phone = async (label, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(), errs = [], asked = [], flight = { now: 0, max: 0 };
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    await pg.exposeFunction('__dbOp', () => null);
    for (const m of ['test/mocks/mockdur.js', 'test/mocks/mock2.js']) await pg.addInitScript(fs.readFileSync(path.join(ROOT, m), 'utf8'));
    await pg.addInitScript(() => { window.__mockSample = window.claude.use('sample'); try { localStorage.setItem('waypoint-welcome', '1'); } catch (e) {} });
    await pg.route('**/functions/v1/claude', async route => {
      const rq = route.request(), auth = rq.headers().authorization || '', body = JSON.parse(rq.postData() || '{}');
      asked.push({ tier: body.tier, head: String(body.prompt).slice(0, 40), auth: /^Bearer [0-9a-f]{32}$/.test(auth), stream: !!body.stream, effort: body.effort, key: String(body.prompt).slice(0, 200) });
      if (opts.limitAfter != null && asked.length > opts.limitAfter) return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: "That's today's 200 questions to Claude. More tomorrow.", code: 'rate_limited' }) });
      flight.now++; flight.max = Math.max(flight.max, flight.now);
      const res = await pg.evaluate(([p, tier]) => window.__mockSample.then(s => s.json(p, { modelTier: tier })), [body.prompt, body.tier]).catch(() => ({}));
      await new Promise(r => setTimeout(r, 150)); flight.now--;   /* a moment's thinking, so requests overlap as they do for real */
      const text = '```json\n' + JSON.stringify(res) + '\n```';
      if (body.stream) {   /* asked to send the answer as it is written: lines of "data: {...}", the text in pieces, then "done" */
        const cut = opts.cutFirst && !flight.cut; if (cut) flight.cut = 1;   /* the first such answer breaks off part-way */
        const lines = []; for (let i = 0; i < text.length; i += 90) lines.push('data: ' + JSON.stringify({ t: text.slice(i, i + 90) }) + '\n\n');
        if (cut) lines.length = Math.max(1, lines.length >> 1); else lines.push('data: ' + JSON.stringify({ done: true, truncated: false, model: 'test' }) + '\n\n');
        return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: lines.join('') });
      }
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ text, model: 'test' }) });
    });
    await pg.goto(URL + '#trip');
    await pg.waitForFunction(() => window.W && (document.querySelector('.auth-gate') || (W.P && W.P.days)), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(400);
    return { ctx, pg, errs, asked, flight };
  };
  const signIn = async (pg, email, pw, newAcct) => {
    if (newAcct) await pg.click('.auth-gate [data-auth="up"]');
    await pg.fill('#authEmail', email); await pg.fill('#authPw', pw);
    await Promise.all([pg.waitForNavigation({ timeout: 8000 }).catch(() => null), pg.click('.auth-go')]);
    /* signed in (the gate is gone and the app has its plan) or told why not */
    await pg.waitForFunction(() => window.W && ((!document.querySelector('.auth-gate') && W.P && W.P.days) || ((document.querySelector('.auth-err') || {}).textContent || '').length > 3), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(500);
  };
  try {
    /* 1. the gate; an email that wasn't invited; then Ann makes her account */
    const A = await phone('A', { cutFirst: 1 });
    t.ok(await A.pg.isVisible('.auth-gate .auth-card'), 'the first open asks you to sign in (or go without an account)');
    await A.pg.click('.auth-gate [data-auth="up"]'); await A.pg.fill('#authEmail', 'stranger@example.com'); await A.pg.fill('#authPw', 'longenough1'); await A.pg.click('.auth-go'); await A.pg.waitForTimeout(600);
    t.ok(/hasn't been invited/.test(await A.pg.textContent('.auth-err')), 'an email that was not invited cannot make an account');
    await A.pg.fill('#authPw', 'short'); await A.pg.click('.auth-go');
    t.ok(/at least 8 characters/.test(await A.pg.textContent('.auth-err')), 'a short password is caught before it is sent');
    await A.pg.fill('#authEmail', 'Ann@Example.com'); await A.pg.fill('#authPw', 'ann-pass-123');
    await Promise.all([A.pg.waitForNavigation({ timeout: 8000 }).catch(() => null), A.pg.click('.auth-go')]);
    await A.pg.waitForFunction(() => window.W && W.cloud && W.sampleState === 'on' && !document.querySelector('.auth-gate'), null, { timeout: 10000 }).catch(() => {}); await A.pg.waitForTimeout(300);
    const a1 = await A.pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), cloud: W.cloud, sample: W.sampleState, cls: document.documentElement.classList.contains('cloud') }));
    t.ok(!a1.gate && a1.cloud && a1.sample === 'on' && a1.cls, 'Ann is signed in: no gate, Claude is on: ' + JSON.stringify(a1));
    /* 2. Claude's ideas for a city with none built in, through the function, with her sign-in */
    await A.pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture', 'food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Madrid', 'Málaga'] }], days: 5, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [41, 40, 8], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Spain with Claude' }); });
    await A.pg.waitForFunction(() => W.P && W.P.days.length === 5 && W.P.days[4].slots.filter(x => x.item).length >= 4, null, { timeout: 30000 }).catch(() => {});
    const a2 = await A.pg.evaluate(() => ({ malaga: W.P.days[4].city, filled: W.P.days[4].slots.filter(x => x.item).length, note: !!document.querySelector('.sa-info'), countries: document.querySelectorAll('#countryList option').length }));
    t.ok(a2.malaga === 'Málaga' && a2.filled >= 4 && !a2.note, `Málaga (no built-in ideas) is planned from Claude's answers (${a2.filled} stops), with no "few ideas" note: ` + JSON.stringify(a2) + ' ' + JSON.stringify(A.asked.map(x => x.head)).slice(0, 600));
    /* what goes first, and how many at once */
    const pr = await A.pg.evaluate(() => { const d1 = W.P.days[0], c = d1.country + '|' + d1.city, o = W.P.days.filter(d => d.city !== d1.city)[0], oc = o.country + '|' + o.city;
      return { main: W.loadPrio('spots|' + c), second: W.loadPrio('spots|' + c + '|b'), extra: W.loadPrio('gems|' + c), other: W.loadPrio('spots|' + oc), otherExtra: W.loadPrio('gems|' + oc), mine: W.loadPrio('search|' + c + '|cafe') }; });
    t.ok(pr.mine === 0 && pr.main < pr.second && pr.second < pr.other && pr.main < pr.extra && pr.extra < pr.otherExtra, "the city on screen is asked for first: its main lists, then its second lists, then the next city; extras last, and a search you typed goes straight to the front: " + JSON.stringify(pr));
    const heads = A.asked.map(x => x.head), lists = heads.filter(h => /^List /.test(h));
    t.ok(heads.some(h => /^List the 15 best things to do/.test(h)) && heads.some(h => /^List 15 places to eat/.test(h)) && !lists.some(h => /^List (14|10 MORE|8 MORE|\d+ hidden gems|\d+ things to do in and around .* for travelers who)/.test(h)),
      'each city starts with 15 things to do and 15 places to eat, and nothing more is fetched unless asked: ' + JSON.stringify(lists));
    /* a stay made longer grows its ideas by the difference (15 for three days, 27 for six: 12 more of each), once */
    const grow = await A.pg.evaluate(async () => { const before = W.stayDays('Spain', 'Madrid'), a0 = (W.C.city['Spain|Madrid'] || {}).askedN;
      W.S.days = before + 5; W.S.cityDays['Spain|Madrid'] = before + 3; W.changed(); W.render();
      for (let i = 0; i < 80 && (W.C.city['Spain|Madrid'] || {}).askedN !== W.firstIdeas(before + 3); i++) { await new Promise(r => setTimeout(r, 100)); if (i % 10 === 9) W.render(); }
      W.render(); await new Promise(r => setTimeout(r, 700));
      return { before, a0, after: W.stayDays('Spain', 'Madrid'), asked: (W.C.city['Spain|Madrid'] || {}).askedN, want: W.firstIdeas(before + 3) }; });
    const more = A.asked.map(x => x.head).filter(h => / MORE /.test(h));
    t.ok(grow.after === grow.before + 3 && grow.asked === grow.want && grow.want > grow.a0 && more.length === 2 && more.every(h => new RegExp('^List ' + (grow.want - grow.a0) + ' MORE ').test(h)),
      'making a stay longer fetches the difference, once: ' + JSON.stringify(grow) + ' ' + JSON.stringify(more));
    /* the first lists come as they are written; one that broke off part-way was asked for again, whole */
    const st = A.asked.filter(x => x.stream), cutKey = st.length && st[0].key, again = A.asked.filter(x => x.key === cutKey).map(x => ({ head: x.head, stream: x.stream }));
    t.ok(st.length >= 4 && st.every(x => /^List /.test(x.head)) && !A.asked.some(x => x.effort), `the first lists of each city are sent as they are written (${st.length} of ${A.asked.length} questions), with no effort setting`);
    t.ok(again.length === 2 && again[0].stream && !again[1].stream, 'an answer that broke off part-way is asked for once more, whole: ' + JSON.stringify(again));
    t.ok(A.flight.max > 3 && A.flight.max <= 6, 'the installable app asks up to six things at once (three inside Claude): ' + A.flight.max);
    t.ok(A.asked.length > 5 && A.asked.every(x => x.auth) && A.asked.some(x => x.tier === 'quick') && A.asked.some(x => x.tier === 'default'), `each question goes to the function with her sign-in (${A.asked.length} questions)`);
    /* 3. saved to her account */
    let s = null; for (let i = 0; i < 60; i++) { s = await state(); if (s.docs.some(p => /\/trips\/t\//.test(p))) break; await new Promise(r => setTimeout(r, 150)); }
    await A.pg.waitForTimeout(800); s = await state();
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
    /* 5b (v151). the new phone opened on the example trip: it stays on that phone, never saved into her account */
    const tripsOf = (st, who) => st.docs.filter(p => /\/trips\/t\//.test(p) && st.owners[p] === who).length;
    await A2.pg.waitForTimeout(2500);
    t.eq(tripsOf(await state(), 'ann@example.com'), tripDocs.length, "the new phone's example trip is not saved into her account");
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
      sh.click(); for (let i = 0; i < 40 && !W.S.share; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 1800)); const c = W.S.share || 'no code';   /* (and time for the locked copy to be saved) */ document.querySelector('[data-sync="menu"]').click(); return c;
    });
    t.ok(/^[a-z0-9]{12}$/i.test(code), 'Ann can share her trip: ' + code);
    if (/^[a-z0-9]{12}$/i.test(code)) {
      await B.pg.evaluate(c => { document.querySelector('[data-sync="menu"]').click(); }); await B.pg.waitForTimeout(400);
      await B.pg.fill('#openCode', code); await B.pg.click('[data-sync="openshare"]');
      await B.pg.waitForFunction(() => W.readOnly && W.P && W.P.stops.length === 2, null, { timeout: 15000 }).catch(() => {});
      t.ok(await B.pg.evaluate(() => !!W.readOnly && W.P.stops.map(s => s.name).join() === 'Madrid,Málaga'), 'Bob opens it with the code and sees her plan, read-only');
    }
    /* 7b. the nightly paths are the nightly copy's alone: an invited person cannot put a document there (before, anyone
       could, and the copy never overwrites a document someone owns); their own data and photo requests still go in */
    const wr = await B.pg.evaluate(async () => {
      const db = await window.claude.use('db'), uid = await (await window.claude.use('user')).id(), out = {};
      for (const [k, p] of [['photos', 'photos/italy-rome'], ['places', 'places/italy-rome'], ['fx', 'fx/latest'], ['wanted', 'wanted/test-photo'], ['own', 'data/users/' + uid + '/diag/test']])
        out[k] = await db.doc(p).set({ planted: 1 }).then(() => 'written', () => 'refused');
      return out;
    });
    const after = await state();
    t.ok(wr.photos === 'refused' && wr.places === 'refused' && wr.fx === 'refused' && wr.wanted === 'written' && wr.own === 'written' && !after.docs.includes('photos/italy-rome'),
      'an invited person cannot write to the nightly paths; their own data and photo requests still save: ' + JSON.stringify(wr));
    /* 8. an expired sign-in renews by itself */
    await expire();
    const r8 = await A.pg.evaluate(async () => { const db = await window.claude.use('db'), me = await (await window.claude.use('user')).id(); try { const s = await db.collection('data/users/' + me + '/trips/t').get(); return 'ok ' + s.size; } catch (e) { return 'failed ' + e.code; } });
    t.ok(/^ok [1-9]/.test(r8) || /^failed/.test(r8) === false, 'after the access token expires, the next request renews it and carries on: ' + r8);
    /* 9. Claude's daily limit says so plainly */
    const L = await phone('L', { limitAfter: 0 }); await signIn(L.pg, 'bob@example.com', 'bob-pass-123');
    await L.pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Málaga'] }], days: 2, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [40], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Limit' }); });
    await L.pg.waitForFunction(() => Object.values(W.status).some(v => /Busy right now/.test(String(v))), null, { timeout: 10000 }).catch(() => {});
    t.ok(await L.pg.evaluate(() => Object.values(W.status).some(v => /Busy right now/.test(String(v)))), 'over the daily limit, a request says to try later instead of failing silently');
    /* 9b. the street map in the installable app: which cities have one from the server (maps/<slug>, copied nightly
       from the Claude version), the engine from the app's own files (kept by the service worker once fetched), the
       packs from the server's file storage */
    const missing = ['maplibre-gl-csp.js', 'maplibre-gl-csp-worker.js', 'packworker.js', 'ping.js', 'glyphs.wasm', 'glyphs-ext.wasm'].filter(f => !fs.existsSync(path.join(out, 'vt', f)));
    t.ok(!missing.length && /\|wasm\)\$/.test(fs.readFileSync(path.join(out, 'sw.js'), 'utf8')), 'the installable app carries the street-map engine, and keeps it once fetched' + (missing.length ? ': missing ' + missing.join(', ') : ''));
    const PACK = `http://127.0.0.1:${SB}/storage/v1/object/public/maps/greece-nafplio/p0-0123456789abcdef0123456789abcdef.json`;
    await seed('maps/greece-nafplio', { slug: 'greece-nafplio', city: 'Nafplio', country: 'Greece', b: [22.6, 37.45, 23, 37.7], places: [22.78, 37.55, 22.83, 37.58], parts: [PACK], size: 1, built: '2026-11-11' });
    const M = await phone('M'); await signIn(M.pg, 'bob@example.com', 'bob-pass-123');
    const mp = await M.pg.evaluate(async () => { for (let i = 0; i < 80 && !(W.vtFor && W.vtFor('Greece', 'Nafplio')); i++) await new Promise(r => setTimeout(r, 150)); return W.vtFor ? W.vtFor('Greece', 'Nafplio') : null; });
    t.eq(mp, 'greece-nafplio', 'a city whose pack is on the server has a street map in the installable app');
    if (fs.existsSync(PACKFILE)) {
      const dec = await M.pg.evaluate(async u => { for (let i = 0; i < 80 && !W.vtLoadTest; i++) await new Promise(r => setTimeout(r, 150)); try { const p = await W.vtLoadTest('pack|cloud-test', 'v1', { urls: [u] }); return { slug: p.hdr && p.hdr.slug, tiles: Object.keys((p.hdr && p.hdr.t) || {}).length }; } catch (e) { return { err: String(e && e.message || e) }; } }, PACK);
      t.ok(dec.slug === 'greece-nafplio' && dec.tiles > 10, 'and its pack loads from the server\'s file storage: ' + JSON.stringify(dec));
    }
    await M.ctx.close();

    /* 10. signing out leaves the phone-only app; going without an account too */
    await A.pg.evaluate(() => { W.goView('settings'); }); await A.pg.waitForTimeout(800);
    await Promise.all([A.pg.waitForNavigation({ timeout: 8000 }).catch(() => null), A.pg.click('[data-acct="out"]')]); await A.pg.waitForTimeout(1500);
    const a10 = await A.pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), cloud: W.cloud, sample: W.sampleState }));
    t.ok(a10.gate && !a10.cloud, 'signing out brings back the sign-in screen');
    /* (v151) her trips go away with her: the next person on this phone sees none of them */
    const a10b = await A.pg.evaluate(() => ({ trips: localStorage.getItem('waypoint-trips-v1') || '', open: localStorage.getItem('waypoint-v2') || '', away: Object.keys(localStorage).filter(k => /^waypoint-acct-/.test(k)).length }));
    t.ok(!/Spain with Claude/.test(a10b.trips + a10b.open) && a10b.away === 1, 'signing out puts her trips away on the phone, out of sight: ' + JSON.stringify({ away: a10b.away, trips: a10b.trips.length }));
    await A.pg.click('.auth-gate [data-auth="skip"]'); await A.pg.waitForTimeout(800);
    const a11 = await A.pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), view: W.view(), text: document.querySelector('main:not([hidden])').innerText.length }));
    t.ok(!a11.gate && a11.text > 100, '"Use without an account" goes straight to the app on this phone');
    await A.pg.reload(); await A.pg.waitForTimeout(1500);
    t.ok(await A.pg.evaluate(() => !document.querySelector('.auth-gate')), 'and it remembers that choice next time');
    /* 10b (v151). Bob signs in on Ann's phone: none of her trips go to his account; when he signs out and she signs
       in again, hers are back on the phone */
    const bobBefore = tripsOf(await state(), 'bob@example.com');
    await A.pg.evaluate(() => { localStorage.removeItem('waypoint-auth-skip'); }); await A.pg.reload(); await A.pg.waitForTimeout(800);
    await signIn(A.pg, 'bob@example.com', 'bob-pass-123'); await A.pg.waitForTimeout(2500);
    const b10 = await A.pg.evaluate(() => ({ name: W.tripName(), trips: localStorage.getItem('waypoint-trips-v1') || '' }));
    const bobAfter = tripsOf(await state(), 'bob@example.com');
    t.ok(!/Spain with Claude/.test(b10.name + b10.trips) && bobAfter === bobBefore, "Bob on Ann's phone: none of her trips, and none copied into his account: " + JSON.stringify({ name: b10.name, bobBefore, bobAfter }));
    await A.pg.evaluate(() => { W.goView('settings'); }); await A.pg.waitForTimeout(800);
    await Promise.all([A.pg.waitForNavigation({ timeout: 8000 }).catch(() => null), A.pg.click('[data-acct="out"]')]); await A.pg.waitForTimeout(1200);
    await signIn(A.pg, 'ann@example.com', 'ann-pass-123'); await A.pg.waitForTimeout(1500);
    const a10c = await A.pg.evaluate(() => ({ name: W.tripName(), trips: localStorage.getItem('waypoint-trips-v1') || '' }));
    t.ok(/Spain with Claude/.test(a10c.name + a10c.trips), 'Ann signs in again: her trips are back on the phone: ' + a10c.name);
    /* 10c (v151). a trip deleted on another device does not come back from a phone that still has it */
    const gone = await A2.pg.evaluate(() => ({ open: W.S.tripId, name: W.tripName() }));
    await A2.pg.evaluate(async id => { document.querySelector('[data-sync="menu"]').click(); await new Promise(r => setTimeout(r, 400)); const del = document.querySelector('[data-sync="del"][data-id="' + id + '"]'); if (del) del.click(); await new Promise(r => setTimeout(r, 400));
      const yes = document.querySelector('[data-sync="delyes"][data-id="' + id + '"]'); if (yes) yes.click(); await new Promise(r => setTimeout(r, 1500)); }, gone.open);
    const has = st => st.docs.some(p => p.endsWith('/trips/t/' + gone.open));
    const afterDel = has(await state());
    await A.pg.reload(); await A.pg.waitForTimeout(3500);
    const a10d = await A.pg.evaluate(() => ({ open: W.tripName(), list: Object.values(JSON.parse(localStorage.getItem('waypoint-trips-v1') || '{}')).map(x => x.name) }));
    const afterBack = has(await state());
    t.ok(gone.name === 'Spain with Claude' && !afterDel && !afterBack, 'a trip deleted on her second phone is not put back by her first phone, which still had it open: ' + JSON.stringify({ deleted: gone.name, afterDel, afterBack, first: a10d }));
    t.eq([].concat(A.errs, A2.errs, B.errs, L.errs, M.errs), [], 'no errors');
  } finally { await b.close(); sb.kill(); web.kill(); }
};
