/* Waypoint on its own: the installable web app (outside Claude), from the same files as the Claude version.
     node build/bundle.js && node build/standalone.js   ->  dist/ (a static site: deploy the folder as it is)
   What it adds around the app: a full HTML document (the Claude page is a fragment its host wraps), the web app
   manifest and icons (build/icon/out, made by build/icon/make-icons.js), a service worker so the app opens with no
   connection after the first visit, and the host's settings and headers (vercel.json, in the top folder). window.__WP_STANDALONE tells the app it is
   on its own (lib/pwa.js): no Claude, no shared database; trips live on the phone. */
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), TRIP = path.join(ROOT, 'trip'), ICONS = path.join(__dirname, 'icon', 'out'), DIST = path.join(ROOT, 'dist');
const ASSETS = ['app.js', 'app2.js', 'app.min.css', 'app2.css'];
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true }); fs.mkdirSync(path.join(DIST, 'vt'), { recursive: true });
const copy = (from, to) => fs.copyFileSync(from, path.join(DIST, to));
/* one version for everything, from the content: a new build is a new version, the same build the same one */
const h = crypto.createHash('sha256');
ASSETS.forEach(f => h.update(fs.readFileSync(path.join(TRIP, f))));
fs.readdirSync(path.join(TRIP, 'fonts')).sort().forEach(f => h.update(f));
h.update(fs.readFileSync(path.join(TRIP, 'index.html'))); h.update(fs.readFileSync(__filename));
const V = h.digest('hex').slice(0, 10);

ASSETS.forEach(f => {
  let s = fs.readFileSync(path.join(TRIP, f), 'utf8').replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
  /* the second script and its styles are fetched by name from the first one: the same version on those names */
  if (f === 'app.js') s = s.replace(/(["'])app2\.js\1/g, '$1app2.js?v=' + V + '$1').replace(/(["'])app2\.css\1/g, '$1app2.css?v=' + V + '$1');
  fs.writeFileSync(path.join(DIST, f), s);
});
const fonts = fs.readdirSync(path.join(TRIP, 'fonts')).filter(f => f.endsWith('.woff2')).sort();
fonts.forEach(f => copy(path.join(TRIP, 'fonts', f), 'fonts/' + f));
fs.writeFileSync(path.join(DIST, 'vt', 'index.json'), '{}\n');   /* no street-map packs in this version */
const icons = fs.readdirSync(ICONS).filter(f => f.endsWith('.png')).sort();
icons.forEach(f => copy(path.join(ICONS, f), f));

/* the page: the Claude page's body, in a document of its own */
let body = fs.readFileSync(path.join(TRIP, 'index.html'), 'utf8')
  .replace(/<title>[^<]*<\/title>\s*/, '').replace(/<meta name="claude:[^>]*>\s*/g, '')
  .replace(/(href|src)="(app\.min\.css|app\.js)"/g, (m, a, f) => `${a}="${f}?v=${V}"`);
if (!body.includes(`app.js?v=${V}`) || !body.includes(`app.min.css?v=${V}`)) throw new Error('index.html: the script or stylesheet tag was not found');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Waypoint</title>
<meta name="description" content="Plan a family trip day by day: where to go, what to eat, when to rest, and what to book.">
<meta name="theme-color" content="#F6F1E6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C1F37" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Waypoint">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script src="standalone.js?v=${V}"></script>
</head>
<body>
`;
fs.writeFileSync(path.join(DIST, 'index.html'), head + body.trim() + '\n</body>\n</html>\n');
fs.writeFileSync(path.join(DIST, 'standalone.js'), '/* Waypoint, installable version ' + V + ': the app is on its own here (lib/pwa.js) */\nwindow.__WP_STANDALONE = ' + JSON.stringify({ v: V }) + ';\n');

const manifest = {
  id: './', name: 'Waypoint', short_name: 'Waypoint', description: 'Family trip planner: each day planned around naps, meals and the kids, with what to book.',
  start_url: './#today', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#F6F1E6', theme_color: '#F6F1E6', lang: 'en', categories: ['travel'],
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
};
fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

/* the service worker: everything above, kept on the phone at install; the page itself is asked for fresh first (a
   new version shows on the next open) and comes from the phone when there is no connection or it is too slow */
const PRE = ['./', 'index.html', `standalone.js?v=${V}`, 'manifest.webmanifest', 'vt/index.json'].concat(ASSETS.map(f => `${f}?v=${V}`), fonts.map(f => 'fonts/' + f), icons);
fs.writeFileSync(path.join(DIST, 'sw.js'), `/* Waypoint service worker, version ${V} (made by build/standalone.js) */
const V = ${JSON.stringify(V)}, CACHE = "waypoint-" + V, PRE = ${JSON.stringify(PRE)};
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRE)).then(() => self.skipWaiting())); });
/* keep this version and the one before it (a page opened before the update may still ask for the old files) */
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => {
    const ours = keys.filter(k => k.startsWith("waypoint-") && k !== CACHE);
    return caches.open("waypoint-meta").then(m => m.match("prev").then(r => r ? r.text() : "").then(prev => {
      const drop = ours.filter(k => k !== prev && k !== "waypoint-meta");
      return Promise.all(drop.map(k => caches.delete(k))).then(() => m.put("prev", new Response(CACHE)));
    }));
  }).then(() => self.clients.claim()));
});
function fresh(req) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error("slow")), 3500);
    fetch(req).then(r => { clearTimeout(t); r.ok ? ok(r) : no(new Error(String(r.status))); }, e => { clearTimeout(t); no(e); });
  });
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   /* photos, the PDF library: straight to the network */
  if (req.mode === "navigate") {
    e.respondWith(fresh(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("index.html", c)); return r; },
      () => caches.match("index.html", { ignoreSearch: true }).then(r => r || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok && url.pathname.match(/\\.(js|css|woff2|png|json|webmanifest)$/)) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return res;
  })));
});
`);

/* hosting: who may load what (the same rules the Claude page runs under, plus this site's own), and no stale worker.
   Vercel reads vercel.json from the repository's top folder (not from dist/), so it is written there and committed;
   a build that changes it shows up in git. */
const CSP = ["default-src 'self'", "script-src 'self' https://cdnjs.cloudflare.com", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:",
  "img-src 'self' data: blob: https:", "connect-src 'self' https: data: blob:", "worker-src 'self' blob:", "manifest-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'none'"].join('; ');
fs.writeFileSync(path.join(ROOT, 'vercel.json'), JSON.stringify({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  installCommand: 'npm install --no-save --no-package-lock --ignore-scripts esbuild@0.24.2', buildCommand: 'node build/bundle.js && node build/standalone.js', outputDirectory: 'dist', framework: null,
  cleanUrls: false, trailingSlash: false,
  headers: [
    { source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: CSP }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }] },
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    { source: '/index.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    { source: '/manifest.webmanifest', headers: [{ key: 'Content-Type', value: 'application/manifest+json' }] }
  ]
}, null, 2) + '\n');
const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`dist/: Waypoint ${V}, ${Math.round(size(DIST) / 1024)} KB, ${PRE.length} files kept for offline`);
