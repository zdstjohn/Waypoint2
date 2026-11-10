/* the test server for the installable version (dist/): serves it with the headers the host will add (vercel.json in the top folder)
     node test/lib/sa-server.js <port> [dir] [hosting rules] */
const http = require('http'), fs = require('fs'), path = require('path'); const ROOT = path.resolve(process.argv[3] || path.join(__dirname, '..', '..', 'dist')), PORT = +process.argv[2] || 8773;
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[4] || path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  const hd = { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' };
  cfg.headers.forEach(r => { const re = new RegExp('^' + r.source.replace('(.*)', '.*') + '$'); if (re.test(p)) r.headers.forEach(x => hd[x.key] = x.value); });
  res.writeHead(200, hd); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1');
