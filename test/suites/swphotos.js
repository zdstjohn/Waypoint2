/* Photos on the phone (the installable version's service worker, build/standalone.js): a picture from Wikimedia
   Commons is kept the first time it is shown and then comes from the phone (also with no connection), kept pictures are
   capped (oldest out first), nothing else from another site is kept (not a picture from a site that refuses CORS, not
   a file that is not an <img>), and an app update keeps the photos while it drops the old app files.
   The photo sites are stood in for by a local https server: the browser is told to send upload.wikimedia.org and
   commons.wikimedia.org there. */
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http'); const https = require('https'); const os = require('os');
const { started, until } = require('../lib/page');
const PORT = 8815, SECURE = 8816, URL = `http://127.0.0.1:${PORT}/`;
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
exports.run = async t => {
  const dist = path.join(__dirname, '..', '..', 'dist');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-swphotos-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '2', '-subj', '/CN=upload.wikimedia.org',
    '-addext', 'subjectAltName=DNS:upload.wikimedia.org,DNS:commons.wikimedia.org,DNS:photos.example.org'], { stdio: 'ignore' });
  const hits = {};   /* requests the photo sites saw, by host + path */
  const photoSite = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) }, (req, res) => {
    const host = (req.headers.host || '').split(':')[0], p = req.url.split('?')[0]; hits[host + p] = (hits[host + p] || 0) + 1;
    const cors = /nocors/.test(p) ? {} : { 'Access-Control-Allow-Origin': '*' };
    if (host === 'commons.wikimedia.org' && p.startsWith('/wiki/Special:FilePath/')) { res.writeHead(302, Object.assign({ Location: 'https://upload.wikimedia.org/thumb/' + p.split('/').pop() }, cors)); return res.end(); }
    if (/missing/.test(p)) { res.writeHead(404, cors); return res.end('no'); }
    res.writeHead(200, Object.assign({ 'Content-Type': 'image/gif', 'Content-Length': GIF.length, 'Cache-Control': 'no-store' }, cors)); res.end(GIF);
  }).listen(SECURE, '127.0.0.1');
  const srv = spawn('node', [path.join(__dirname, '..', 'lib', 'sa-server.js'), String(PORT), dist], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); if (await new Promise(r => http.get(URL, res => r(res.statusCode === 200)).on('error', () => r(false)))) break; }
  const b = await chromium.launch({ args: [`--host-resolver-rules=MAP upload.wikimedia.org 127.0.0.1:${SECURE},MAP commons.wikimedia.org 127.0.0.1:${SECURE},MAP photos.example.org 127.0.0.1:${SECURE}`, '--ignore-certificate-errors', '--no-proxy-server'], env: Object.assign({}, process.env, { HTTPS_PROXY: '', https_proxy: '', HTTP_PROXY: '', http_proxy: '', ALL_PROXY: '', all_proxy: '', NO_PROXY: '*' }) });
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); if (process.env.DBG) pg.on('requestfailed', r => console.log('FAILED', r.url(), r.failure() && r.failure().errorText));
    await pg.goto(URL); await started(pg); await pg.waitForTimeout(700);
    t.ok(await pg.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker is in charge of the page');
    /* load a picture the way the app does (an <img>); resolves to whether it drew */
    const show = (u) => pg.evaluate(u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; }), u);
    const keys = () => pg.evaluate(async () => (await (await caches.open('waypoint-photos-v1')).keys()).map(r => r.url));
    const UP = 'https://upload.wikimedia.org/', CM = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

    /* kept after the first showing, and then served from the phone */
    t.ok(await show(UP + 'thumb/a.gif'), 'a photo from upload.wikimedia.org shows');
    t.ok(await show(CM + 'B.gif?width=960'), 'a Special:FilePath photo (it is redirected to the picture) shows');
    t.eq((await keys()).sort(), [UP + 'thumb/a.gif', CM + 'B.gif?width=960'].sort(), 'both are kept on the phone, under the address the app asked for');
    t.eq(hits['upload.wikimedia.org/thumb/a.gif'], 1, 'and each was fetched once');
    await pg.reload(); await started(pg); await pg.waitForTimeout(400);
    t.ok(await show(UP + 'thumb/a.gif') && await show(CM + 'B.gif?width=960'), 'in a new visit they show again');
    t.eq([hits['upload.wikimedia.org/thumb/a.gif'], hits['commons.wikimedia.org/wiki/Special:FilePath/B.gif']], [1, 1], 'without asking the photo sites again');
    await ctx.setOffline(true);
    t.ok(await show(UP + 'thumb/a.gif'), 'with no connection a kept photo still shows');
    t.ok(!(await show(UP + 'thumb/never-seen.gif')), 'and one never seen shows as missing (not a page error)');
    await ctx.setOffline(false);

    /* what is not kept */
    t.ok(await show(UP + 'nocors-1.gif'), 'a photo from a site that refuses CORS still shows (passed through as before)');
    t.ok(await show(UP + 'missing-1.gif') === false, 'a missing photo shows as missing');
    const other = await pg.evaluate(async () => { try { const r = await fetch('https://upload.wikimedia.org/thumb/fetched.gif', { mode: 'cors' }); return r.ok; } catch (e) { return false; } });
    t.ok(other, 'a request that is not for an <img> goes through');
    const ks = (await keys()).map(u => u.replace(UP, ''));
    t.ok(!ks.some(u => /nocors|missing|fetched/.test(u)), 'none of those three is kept: ' + ks.join(', '));
    t.ok(await show('https://photos.example.org/x.gif'), 'a picture from any other site shows');
    t.ok(!(await keys()).some(u => /photos\.example\.org/.test(u)), 'and is not kept');

    /* a new app version keeps the photos and drops the old app files: the worker installed again runs its clean-up */
    await pg.evaluate(async () => { await caches.open('waypoint-zzold'); const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); });
    await pg.reload(); await pg.waitForTimeout(1500); await started(pg);
    const after = await until(async () => { const k = await pg.evaluate(() => caches.keys()); return k.includes('waypoint-zzold') ? null : k; }, 8000);
    t.ok(after && !after.includes('waypoint-zzold') && after.includes('waypoint-photos-v1'), 'an app update clears an old app cache but keeps the photo cache: ' + JSON.stringify(after));
    t.ok((await keys()).length >= 2, 'with its photos in it');

    /* the cap: oldest out first */
    const MAX = 300;
    await pg.evaluate(async n => { for (let i = 0; i < n; i++) await new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = 'https://upload.wikimedia.org/thumb/many-' + i + '.gif'; }); }, MAX + 12);
    const capped = await until(async () => { const k = await keys(); return k.length <= MAX ? k : null; }, 15000, 300);
    t.ok(capped && capped.length <= MAX && capped.length > MAX - 5, 'after 312 more photos the cache holds the cap (' + (capped && capped.length) + ')');
    t.ok(capped && !capped.some(u => /thumb\/a\.gif$/.test(u)) && capped.some(u => /many-311\.gif$/.test(u)), 'the oldest are out, the newest in');
    t.eq(errs, [], 'no page errors');
    await ctx.close();
  } finally { await b.close(); srv.kill(); photoSite.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
};
