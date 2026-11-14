/* Waypoint on its own: the installable web app (outside Claude), from the same files as the Claude version.
     node build/bundle.js && node build/standalone.js   ->  dist/ (a static site: deploy the folder as it is)
   What it adds around the app: a full HTML document (the Claude page is a fragment its host wraps), the web app
   manifest and icons (build/icon/out, made by build/icon/make-icons.js), a service worker so the app opens with no
   connection after the first visit, and the host's settings and headers (vercel.json, in the top folder). window.__WP_STANDALONE tells the app it is
   on its own (lib/pwa.js): no Claude, no shared database; trips live on the phone. */
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), TRIP = path.join(ROOT, 'trip'), ICONS = path.join(__dirname, 'icon', 'out');
/* WP_DIST builds somewhere else (the tests' stand-in server build), with its hosting rules next to it, not in the top folder */
const DIST = process.env.WP_DIST ? path.resolve(process.env.WP_DIST) : path.join(ROOT, 'dist'), HOSTING = process.env.WP_DIST ? DIST + '.vercel.json' : path.join(ROOT, 'vercel.json');
/* (the pieces of the second script, app.<name>.js, are fetched by name with the version from window.__WP_STANDALONE: lib/later.js) */
const ASSETS = ['app.js', 'app2.js'].concat(require('./bundle.js').pieceFiles(), ['app.min.css', 'app2.css', 'app.desk.css']);
/* Waypoint's own server (Supabase project "waypoint"): its address and its publishable key. Both are public by design
   (every visitor's browser gets them); what a signed-in person may read or write is decided by the database's
   row-level security, and Claude's API key stays in the server's secrets. WP_CLOUD_URL / WP_CLOUD_KEY override them
   (the tests point them at a stand-in server). */
const CLOUD = { url: process.env.WP_CLOUD_URL || 'https://fbgubkesrlvtcnbaxuef.supabase.co', key: process.env.WP_CLOUD_KEY || 'sb_publishable_oPm5lh5CA7zbkLH-xxlhMQ_k1ZSN-xj' };
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true }); fs.mkdirSync(path.join(DIST, 'vt'), { recursive: true });
const copy = (from, to) => fs.copyFileSync(from, path.join(DIST, to));
/* one version for everything, from the content: a new build is a new version, the same build the same one */
const h = crypto.createHash('sha256');
ASSETS.forEach(f => h.update(fs.readFileSync(path.join(TRIP, f))));
fs.readdirSync(path.join(TRIP, 'fonts')).sort().forEach(f => h.update(f));
h.update(fs.readFileSync(path.join(TRIP, 'index.html'))); h.update(fs.readFileSync(__filename)); h.update(fs.readFileSync(path.join(TRIP, 'lib', 'cloud.js'))); h.update(JSON.stringify(CLOUD));
const V = h.digest('hex').slice(0, 10);

ASSETS.forEach(f => {
  let s = fs.readFileSync(path.join(TRIP, f), 'utf8').replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
  /* the second script and its styles are fetched by name from the first one: the same version on those names */
  if (f === 'app.js') s = s.replace(/(["'])app2\.js\1/g, '$1app2.js?v=' + V + '$1').replace(/(["'])app2\.css\1/g, '$1app2.css?v=' + V + '$1').replace(/(["'])app\.desk\.css\1/g, '$1app.desk.css?v=' + V + '$1');
  fs.writeFileSync(path.join(DIST, f), s);
});
const fonts = fs.readdirSync(path.join(TRIP, 'fonts')).filter(f => f.endsWith('.woff2')).sort();
fonts.forEach(f => copy(path.join(TRIP, 'fonts', f), 'fonts/' + f));
/* the street map: the same engine as the Claude version (MapLibre, its worker, the pack reader, the letters). The list
   of packs comes from the server (maps/<slug> documents, copied nightly from the Claude version) and the packs from
   its file storage; each pack is kept on the phone once seen (vt/packworker.js), so a city's map works offline after.
   The engine files are fetched the first time a map is shown, then kept by the service worker. */
fs.writeFileSync(path.join(DIST, 'vt', 'index.json'), '{}\n');
['maplibre-gl-csp.js', 'maplibre-gl-csp-worker.js', 'packworker.js', 'ping.js', 'glyphs.wasm', 'glyphs-ext.wasm'].forEach(f => copy(path.join(TRIP, 'vt', f), 'vt/' + f));
const icons = fs.readdirSync(ICONS).filter(f => f.endsWith('.png')).sort();
icons.forEach(f => copy(path.join(ICONS, f), f));
/* the picture a shared link shows (build/icon/og.js); not kept on the phone, so not in the list of icons above */
copy(path.join(ICONS, '..', 'og-image.png'), 'og-image.png');

/* the page: the Claude page's body, in a document of its own */
let body = fs.readFileSync(path.join(TRIP, 'index.html'), 'utf8')
  .replace(/<title>[^<]*<\/title>\s*/, '').replace(/<meta name="claude:[^>]*>\s*/g, '')
  .replace(/(href|src)="(app\.min\.css|app\.js)"/g, (m, a, f) => `${a}="${f}?v=${V}"`);
if (!body.includes(`app.js?v=${V}`) || !body.includes(`app.min.css?v=${V}`)) throw new Error('index.html: the script or stylesheet tag was not found');
const SITE = 'https://waypoint-livid-three.vercel.app';   /* (a shared link's picture needs a full address) */
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Waypoint</title>
<meta name="description" content="Plan a family trip day by day: where to go, what to eat, when to rest, and what to book.">
<meta name="theme-color" content="#F6F1E6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C1F37" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Waypoint">
<meta property="og:title" content="Waypoint: plan a family trip, day by day">
<meta property="og:description" content="Where to go, what to eat, when to rest, and what to book, with kids in mind.">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Waypoint W, a night sky with a moon and a cat, and the words Plan a family trip, day by day.">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Waypoint">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="preconnect" href="${CLOUD.url}" crossorigin>
<script src="standalone.js?v=${V}"></script>
<script src="cloud.js?v=${V}"></script>
</head>
<body>
`;
fs.writeFileSync(path.join(DIST, 'index.html'), head + body.trim() + '\n</body>\n</html>\n');
fs.writeFileSync(path.join(DIST, 'standalone.js'), '/* Waypoint, installable version ' + V + ': the app is on its own here (lib/pwa.js), with its own server (lib/cloud.js) */\nwindow.__WP_STANDALONE = ' + JSON.stringify({ v: V, cloud: CLOUD }) + ';\n');
fs.copyFileSync(path.join(TRIP, 'lib', 'cloud.js'), path.join(DIST, 'cloud.js'));

const manifest = {
  id: './', name: 'Waypoint', short_name: 'Waypoint', description: 'Family trip planner: each day planned around naps, meals and the kids, with what to book.',
  start_url: './#today', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#F6F1E6', theme_color: '#F6F1E6', lang: 'en', categories: ['travel'],
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
};
fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

/* the service worker: everything above, kept on the phone at install; the page itself is asked for fresh first (a
   new version shows on the next open) and comes from the phone when there is no connection or it is too slow */
const PRE = ['./', 'index.html', `standalone.js?v=${V}`, `cloud.js?v=${V}`, 'manifest.webmanifest', 'vt/index.json'].concat(ASSETS.filter(f => f !== 'app.desk.css').map(f => `${f}?v=${V}`) /* (the desktop stylesheet is kept when a wide window first asks for it: a phone never fetches it) */, fonts.map(f => 'fonts/' + f), icons);
fs.writeFileSync(path.join(DIST, 'sw.js'), `/* Waypoint service worker, version ${V} (made by build/standalone.js) */
const V = ${JSON.stringify(V)}, CACHE = "waypoint-" + V, PRE = ${JSON.stringify(PRE)};
/* photos: pictures from Wikimedia Commons (and public storage images) are kept on the phone, so a trip's photos show again
   with no connection and without another download. One cache for all versions (a new app version keeps the photos). */
const PHOTOS = "waypoint-photos-v1", PHOTO_MAX = 300, PHOTO_BYTES = 60 * 1048576, PHOTO_DAYS = 30;
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRE)).then(() => self.skipWaiting())); });
/* keep this version and the one before it (a page opened before the update may still ask for the old files) */
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => {
    const ours = keys.filter(k => k.startsWith("waypoint-") && k !== CACHE && k !== PHOTOS);
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
/* a picture the app shows (an <img>), from where its photos come from: nothing else from another site is kept */
function isPhoto(req, url) {
  if (req.method !== "GET" || req.destination !== "image" || url.protocol !== "https:") return false;
  const h = url.hostname, p = url.pathname;
  if (h === "upload.wikimedia.org") return true;
  if (h === "commons.wikimedia.org") return p.startsWith("/wiki/Special:FilePath/");
  return h.endsWith(".supabase.co") && p.startsWith("/storage/v1/object/public/") && !p.startsWith("/storage/v1/object/public/maps/");
}
const noCors = new Set(), failed = {}; let puts = 0;   /* (sites that did not allow CORS three times running are not asked again until the worker restarts) */
/* oldest out first, past 300 pictures or about 60 MB (sizes are read every tenth picture: it needs each one's headers) */
async function trim(c) {
  const keys = await c.keys();
  if (keys.length <= PHOTO_MAX && puts % 10) return;
  let total = 0; const sizes = [];
  for (const k of keys) { const r = await c.match(k); const n = r ? Number(r.headers.get("x-wp-size")) || 0 : 0; sizes.push(n); total += n; }
  for (let i = 0; i < keys.length - 1 && (keys.length - i > PHOTO_MAX || total > PHOTO_BYTES); i++) { total -= sizes[i]; await c.delete(keys[i]); }
}
/* From the phone first (a photo's address names one picture: one that is over a month old is asked for again). It is asked
   for with CORS, so the answer can be checked (a real picture, status 200) before it is kept; a site that does not allow
   that is passed through as before, and an answer that cannot be looked into (opaque) is never kept: it could be an error
   page, and would count for megabytes against the phone's storage. */
async function photo(req) {
  try {
    const c = await caches.open(PHOTOS), hit = await c.match(req.url);
    const age = hit ? Date.now() - (Number(hit.headers.get("x-wp-at")) || 0) : 0;
    if (hit && age < PHOTO_DAYS * 864e5) return hit;
    const host = new URL(req.url).hostname;
    if (!noCors.has(host)) {
      try {
        const r = await fetch(new Request(req.url, { mode: "cors", credentials: "omit" })), type = r.headers.get("content-type") || "";
        if (r.ok && r.status === 200 && type.startsWith("image/")) {
          failed[host] = 0;
          const b = await r.blob();
          await c.put(req.url, new Response(b, { status: 200, headers: { "content-type": type, "x-wp-at": String(Date.now()), "x-wp-size": String(b.size) } }));
          puts++; trim(c).catch(() => {});
          return new Response(b, { status: 200, headers: { "content-type": type } });
        }
        if (hit) return hit;
        if (r.ok) return fetch(req);
        return r;   /* (a missing picture is shown as missing, as it would be without this) */
      } catch (err) {
        if (hit) return hit;
        const o = await fetch(req);   /* (this one answers when only CORS was refused: offline it throws, and nothing is concluded) */
        if ((failed[host] = (failed[host] || 0) + 1) >= 3) noCors.add(host);
        return o;
      }
    }
    return hit || fetch(req);
  } catch (err) { return fetch(req); }
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (url.origin !== location.origin) { if (isPhoto(req, url)) e.respondWith(photo(req)); return; }   /* (other sites, the PDF library: straight to the network) */
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fresh(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("index.html", c)); return r; },
      () => caches.match("index.html", { ignoreSearch: true }).then(r => r || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok && url.pathname.match(/\\.(js|css|woff2|png|json|webmanifest|wasm)$/)) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return res;
  })));
});
`);

/* hosting: who may load what (the same rules the Claude page runs under, plus this site's own), and no stale worker.
   Vercel reads vercel.json from the repository's top folder (not from dist/), so it is written there and committed;
   a build that changes it shows up in git. */
const CSP = ["default-src 'self'", "script-src 'self' https://cdnjs.cloudflare.com", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:",
  "img-src 'self' data: blob: https:", "connect-src 'self' " + new URL(CLOUD.url).origin + " https: data: blob:", "worker-src 'self' blob:", "manifest-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'none'"].join('; ');
fs.writeFileSync(HOSTING, JSON.stringify({
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
