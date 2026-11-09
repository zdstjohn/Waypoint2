/* The Take along PDF: every day's stops in order, each stop kept whole on one page, and no half-empty pages. (A stop that
   ran over a page break used to push everything after it to the bottom of the next page, leaving a blank sheet with only
   its "Map" link.) The PDF library is served from the local copy instead of the CDN. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db'); const fs = require('fs'); const path = require('path');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() });
  const lib = path.join(t.root, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
  if (!t.ok(fs.existsSync(lib), 'the PDF library is installed for the test (npm ci)')) { await ctx.close(); await b.close(); return; }
  await pg.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\//, r => r.fulfill({ body: fs.readFileSync(lib), contentType: 'text/javascript' }));
  await exampleTrip(pg); await pg.evaluate(() => { W.S.days = 12; W.changed(); }); await settle(pg, 8000);
  const out = await pg.evaluate(async () => {
    const dl = await window.claude.use('downloads'); const real = dl.save; let bytes = null, name = '';
    dl.save = async ({ filename, data }) => { name = filename; bytes = Array.from(new Uint8Array(await data.arrayBuffer())); return { status: 'saved' }; };
    W.needLater(); for (let i = 0; i < 50 && !W.takeItClick; i++) await new Promise(r => setTimeout(r, 100));
    W.takeItClick({ pdf: '1' }, W.P);
    for (let i = 0; i < 150 && !bytes; i++) await new Promise(r => setTimeout(r, 100));
    dl.save = real; return { name, bytes, days: W.P.N };
  });
  t.ok(out.bytes && /\.pdf$/.test(out.name), `a PDF is made (${out.name}, ${out.bytes ? Math.round(out.bytes.length / 1024) : 0} KB)`);
  if (!out.bytes) { await ctx.close(); await b.close(); return; }
  fs.writeFileSync(path.join(t.out, 'take-along.pdf'), Buffer.from(out.bytes));   /* to look at */
  const pdf = Buffer.from(out.bytes).toString('latin1');
  /* the pages' text lines, in order, with where each sits (PDF y counts up from the bottom; letter is 792 pt tall, with
     48 pt margins, so a page's text runs from 733.5 down to about 52) */
  const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(m => m[1]).filter(s => /\bBT\b/.test(s));
  const pages = streams.map(s => {
    const lines = [...s.matchAll(/([\d.]+) ([\d.]+) Td\s*\((.*?)\) Tj/g)].map(m => ({ y: +m[2], s: m[3] })).filter(l => l.y > 40);   /* not the footer */
    const texts = lines.map(l => l.s), ys = lines.map(l => l.y);
    return { lines, low: ys.length ? Math.min(...ys) : 792, n: texts.length, book: texts.some(x => /^Book ahead$/.test(x)), text: texts.join(' ') };
  });
  const firstList = pages.findIndex(p => p.book), plan = pages.slice(0, firstList < 0 ? pages.length : firstList);
  t.ok(plan.length >= 3, `the plan runs over several pages (${plan.length}) for a ${out.days}-day trip`);
  /* a page ends early only because what starts the next page didn't fit: the room left at its foot is less than the
     next page's first block (a stop, ending with its "Open in Google Maps" line, or a day heading with its first stop) */
  const TOP = 744, FOOT = 48;
  const early = plan.slice(0, -1).map((p, i) => {
    const next = plan[i + 1], end = next.lines.find(l => /^(Open in Google Maps|Free time)$/.test(l.s));
    const block = end ? TOP - end.y + 8 : TOP - FOOT;
    return { page: i + 1, left: Math.round(p.low - FOOT - 8), next: Math.round(block) };
  });
  t.eq(early.filter(p => p.left > p.next + 6), [], 'no page ends sooner than it must (no blank sheets): ' + early.map(p => p.left + '<' + p.next).join(' '));
  const lone = plan.map((p, i) => { const h = p.lines.map(l => l.s).lastIndexOf(p.lines.map(l => l.s).filter(x => /^Day \d+ · /.test(x)).pop()); return h >= 0 && !p.lines.slice(h).some(l => /^(Open in Google Maps|Free time)$/.test(l.s)) ? i + 1 : 0; }).filter(Boolean);
  t.eq(lone, [], 'a day heading is never alone at the foot of a page');
  t.ok(/Open in Google Maps/.test(pdf) && !/\(Map\) Tj/.test(pdf), 'each stop links "Open in Google Maps"');
  t.ok(plan.every(p => p.n > 3), 'no page holds only a stray line');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
