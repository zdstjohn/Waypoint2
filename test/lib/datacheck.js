/* The places built into the app (data/data1.js, data/data2.js TD): every city has a name, a pin inside its country, a
   description and known tags; no city or place appears twice; every place has a name, a description, known tags and a
   time of day the app knows. Used by test/suites/tools.js (no browser). */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
module.exports = ROOT => {
  const out = [],
    win = {};
  const ctx = vm.createContext({ window: win });
  for (const f of ["data1.js", "data2.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "trip/data", f), "utf8"), ctx);
  const TD = win.TD,
    STYLES = new Set(win.STYLES.map(x => x[0])),
    WHEN = new Set(["am", "pm", "eve", "any"]);
  /* a generous box for each country, islands included: [south, north, west, east] */
  const BOX = {
    Italy: [35.4, 47.2, 6.5, 18.8],
    Spain: [27.5, 43.9, -18.3, 4.5],
    Greece: [34.7, 41.8, 19.3, 29.7],
    France: [41.2, 51.2, -5.3, 9.7],
    Portugal: [32.3, 42.2, -31.5, -6.1],
    Japan: [24, 45.6, 122.9, 146],
    Mexico: [14.5, 32.8, -118.5, -86.7],
    "United Kingdom": [49.8, 60.9, -8.7, 1.8],
    "Costa Rica": [8, 11.3, -86, -82.5],
    Thailand: [5.5, 20.5, 97.3, 105.7],
    Iceland: [63.2, 66.6, -24.6, -13.4]
  };
  /* (the app's name rule: ł ø ß đ æ þ ı made Latin first; a name in another script is "u" and its code points' hex) */
  const FOLD = { ł: "l", ø: "o", ß: "ss", đ: "d", æ: "ae", þ: "th", ı: "i" };
  const norm = s => {
    const t = String(s || "").toLowerCase().replace(/[łøßđæþı]/g, c => FOLD[c]).normalize("NFD").replace(/[\u0300-\u036f]/g, ""), a = t.replace(/[^a-z0-9]+/g, " ").trim();
    return a || (t.match(/[\p{L}\p{N}]/gu) || []).map(c => "u" + c.codePointAt(0).toString(16)).join(" ");
  };
  const bad = [],
    seenC = {};
  let nCity = 0,
    nSpot = 0;
  Object.keys(TD).forEach(country => {
    const box = BOX[country];
    if (!box) bad.push(country + ": no box to check its pins against");
    const names = {};
    (TD[country].cities || []).forEach(c => {
      nCity++;
      const id = country + "/" + c.name;
      if (typeof c.name !== "string" || !c.name.trim()) return bad.push(country + ": a city has no name");
      if (names[norm(c.name)]) bad.push(id + ": the city is listed twice");
      names[norm(c.name)] = 1;
      if (typeof c.lat !== "number" || typeof c.lng !== "number") bad.push(id + ": no pin");
      else if (box && (c.lat < box[0] || c.lat > box[1] || c.lng < box[2] || c.lng > box[3]))
        bad.push(id + ": the pin (" + c.lat + ", " + c.lng + ") is outside " + country);
      if (!c.d || typeof c.d !== "string") bad.push(id + ": no description");
      (c.t || []).forEach(x => {
        if (!STYLES.has(x)) bad.push(id + ': unknown tag "' + x + '"');
      });
      const sp = {};
      (c.spots || []).forEach(s => {
        nSpot++;
        const sid = id + " / " + s.n;
        if (typeof s.n !== "string" || !s.n.trim()) return bad.push(id + ": a place has no name");
        if (sp[norm(s.n)]) bad.push(sid + ": listed twice");
        sp[norm(s.n)] = 1;
        if (!s.d || typeof s.d !== "string") bad.push(sid + ": no description");
        (s.t || []).forEach(x => {
          if (!STYLES.has(x)) bad.push(sid + ': unknown tag "' + x + '"');
        });
        if (s.s !== undefined && !WHEN.has(s.s)) bad.push(sid + ': unknown time of day "' + s.s + '"');
        if (s.lat !== undefined && box && (s.lat < box[0] || s.lat > box[1] || s.lng < box[2] || s.lng > box[3]))
          bad.push(sid + ": the pin is outside " + country);
      });
    });
  });
  out.push([
    bad.length === 0,
    "the built-in places are sound (" +
      nCity +
      " cities, " +
      nSpot +
      " places in " +
      Object.keys(TD).length +
      " countries)" +
      (bad.length ? ": " + bad.slice(0, 8).join("; ") + (bad.length > 8 ? " (+" + (bad.length - 8) + " more)" : "") : "")
  ]);
  return { out, bad };
};
if (require.main === module) {
  const x = module.exports(process.argv[2] || process.cwd());
  x.out.forEach(([ok, m]) => console.log(ok ? "ok  " : "BAD ", m));
  x.bad.forEach(b => console.log("   " + b));
}
