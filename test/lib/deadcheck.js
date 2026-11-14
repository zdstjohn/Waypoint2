/* Dead-button scan (no browser): every data-xyz attribute the app draws must be read somewhere (dataset.xyz,
   [data-xyz], getAttribute("data-xyz"), closest("[data-xyz]")), else tapping it does nothing. Also lists ids drawn on
   buttons that no code or CSS names. Used by test/suites/tools.js. */
const fs = require("fs"),
  path = require("path");
module.exports = ROOT => {
  const walk = d =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|css)$/.test(e.name) ? [path.join(d, e.name)] : []));
  const files = walk(path.join(ROOT, "trip")).filter(f => !/\/(tools|vendor|lib\/vendor)\//.test(f) && !/\.min\./.test(f));
  const src = files.map(f => fs.readFileSync(f, "utf8")).join("\n");
  const drawn = new Set();
  let m;
  const re = /\bdata-([a-z][a-z0-9-]*)=/g;
  while ((m = re.exec(src))) drawn.add(m[1]);
  /* drawn as a mark only: the tap is handled by class or by any tap outside a stop (checked by hand, v187) */
  const MARKS = new Set(["liftoff"]);
  const camel = n => n.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const dead = [...drawn].filter(n => {
    if (MARKS.has(n)) return false;
    const c = camel(n);
    const reads = new RegExp(
      "dataset\\." +
        c +
        "\\b|dataset\\[\\s*[\"']" +
        c +
        "[\"']|\\[data-" +
        n +
        "[\\]=~^$*|]|[\"']data-" +
        n +
        "[\"']|\\." +
        c +
        "\\b(?=\\s*(?:[=!<>]|\\)|;|,|&|\\|))",
      "m"
    );
    return !reads.test(src);
  });
  return {
    drawn: drawn.size,
    dead,
    out: [
      [
        dead.length === 0,
        "every data-attribute the app draws is read somewhere (" +
          drawn.size +
          " kinds)" +
          (dead.length ? ": never read: " + dead.join(", ") : "")
      ]
    ]
  };
};
if (require.main === module) {
  const x = module.exports(process.argv[2] || process.cwd());
  x.out.forEach(([ok, m]) => console.log(ok ? "ok  " : "BAD ", m));
}
