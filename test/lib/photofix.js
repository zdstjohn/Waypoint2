/* Picture files and photo records for the tests that look at how photos load (test/suites/photoset.js, and the byte
   counts): the files come from test/py/make_fixtures.py (the copies the nightly tools make), served by the browser
   context at /_blob/<id>, counting the bytes each request carried. */
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
const idOf = f => crypto.createHash('md5').update(f).digest('hex');
const TYPES = { '.jpg': 'image/jpeg', '.webp': 'image/webp' };
/** makes <count> pictures with all their copies in <dir> (drawn ones, or the JPEGs in <real>); returns the manifest */
function make(dir, count, real) {
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) execFileSync('python3', ['-I', path.join(ROOT, 'test/py/make_fixtures.py'), dir, String(count)].concat(real ? [real] : []), { stdio: 'inherit' });
  return JSON.parse(fs.readFileSync(mf, 'utf8'));
}
/** one photo record for picture <e>: "old" is what every record was before (url only, and big when there is one), "new" has all the copies */
function record(e, mode, extra) {
  const u = f => '/_blob/' + idOf(f);
  const r = Object.assign({ url: u(e.jpg), credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Test' + idOf(e.jpg).slice(0, 6) + '.jpg' }, extra || {});
  if (e.big) r.big = u(e.big);
  if (mode === 'new') {
    r.sm = u(e.sm); r.webp = { sm: u(e.smwebp), url: u(e.webp) }; r.lq = e.lq;
    if (e.bigwebp) r.webp.big = u(e.bigwebp);
    if (e.w !== 720) r.w = e.w; if (e.smw !== 320) r.smw = e.smw;
  }
  return r;
}
/** serve every file of the manifest at /_blob/<id>; stats counts requests and bytes (images only), by file kind */
async function serve(ctx, man, opts) {
  const files = {}; for (const e of man) for (const k of Object.keys(e)) if (typeof e[k] === 'string' && TYPES[path.extname(e[k])]) files[idOf(e[k])] = e[k];
  const stats = { n: 0, bytes: 0, by: {}, urls: [] };
  await ctx.route(/\/_blob\/[0-9a-f]{32}/, async route => {
    const id = /\/_blob\/([0-9a-f]{32})/.exec(route.request().url())[1], f = files[id];
    if (!f) return route.fulfill({ status: 404, body: '' });
    if (opts && opts.delay) await new Promise(r => setTimeout(r, opts.delay));
    const body = fs.readFileSync(f); stats.n++; stats.bytes += body.length; stats.urls.push(path.basename(f));
    const k = f.replace(/^.*?p\d+/, ''); stats.by[k] = (stats.by[k] || 0) + body.length;
    await route.fulfill({ status: 200, body, contentType: TYPES[path.extname(f)] });
  });
  return stats;
}
module.exports = { make, record, serve, idOf };
