/* The picture a link to the installable app shows when it is sent in a message (1200 x 630): the app's icon, its name and
   one line, on the app's paper colour. Run: node build/icon/og.js  (writes build/icon/og-image.png; build/standalone.js
   copies it as og-image.png). */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', '..');
const b64 = (p, mime) => `data:${mime};base64,` + fs.readFileSync(p).toString('base64');
const icon = b64(path.join(__dirname, 'out', 'icon-512.png'), 'image/png');
const dela = b64(path.join(root, 'trip', 'fonts', 'dela-gothic-one-latin-400-normal.woff2'), 'font/woff2');
const jak = b64(path.join(root, 'trip', 'fonts', 'plus-jakarta-sans-latin-wght-normal.woff2'), 'font/woff2');
const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:D;src:url(${dela})}@font-face{font-family:J;src:url(${jak});font-weight:200 800}
html,body{margin:0}body{width:1200px;height:630px;background:#F6F1E6;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;font-family:J,sans-serif;color:#1C1F37}
img{width:380px;height:380px;border-radius:56px;flex:none}
h1{font:400 112px/1 D,sans-serif;margin:0 0 22px;color:#3B3F86;letter-spacing:-1px}
p{font-size:42px;line-height:1.3;font-weight:600;margin:0 0 18px}
small{font-size:30px;font-weight:500;color:#5a5560}</style>
<img src="${icon}" alt=""><div><h1>Waypoint</h1><p>Plan a family trip, day by day.</p><small>Naps, meals and bookings, with kids in mind.</small></div>`;
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.setContent(html); await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: path.join(__dirname, 'og-image.png') }); await b.close();
})();
