/* The tools around the app, on what can be checked without the internet (the audit's T4, a start): the source pack
   unpacks to exactly the files it was made from; the advisory check's own logic holds and its map waiver still rests
   on fact; the island towns' table reads cleanly and no town sits far from the others of its island (a slipped digit).
   The nightly helpers' own rules (which place on the map is the one meant, opening hours, map tiles) are checked on
   fixed examples by tools/test_tools.py; fetching and writing are not covered (they need the services themselves). The
   photo judge has its own suite (judge). */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
exports.run = async t => {
  const ROOT = t.root,
    run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  /* 1. the source pack */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wp-pack-")),
    packed = path.join(tmp, "pack.txt");
  const before = fs.existsSync(path.join(ROOT, "trip/src/waypoint-source.txt"))
    ? fs.readFileSync(path.join(ROOT, "trip/src/waypoint-source.txt"))
    : null;
  const p = run("python3", ["tools/src_pack.py"]);
  fs.copyFileSync(path.join(ROOT, "trip/src/waypoint-source.txt"), packed);
  if (before) fs.writeFileSync(path.join(ROOT, "trip/src/waypoint-source.txt"), before); /* (leave the working copy as it was) */
  const u = run("python3", ["tools/src_pack.py", "--unpack", packed, path.join(tmp, "out")]);
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const q = path.join(d, f);
      if (fs.statSync(q).isDirectory()) walk(q);
      else files.push(path.relative(path.join(tmp, "out"), q));
    }
  })(path.join(tmp, "out"));
  const differ = files.filter(
    f => !fs.existsSync(path.join(ROOT, f)) || !fs.readFileSync(path.join(ROOT, f)).equals(fs.readFileSync(path.join(tmp, "out", f)))
  );
  t.ok(
    p.status === 0 && u.status === 0 && files.length > 80 && files.includes("trip/lib/core.js") && files.includes("test/run.js"),
    `the source pack is written and unpacks (${files.length} files)`
  );
  t.eq(
    differ.filter(f => f !== "trip/src/waypoint-source.txt"),
    [],
    "every unpacked file is byte for byte the file it was packed from"
  );
  fs.rmSync(tmp, { recursive: true, force: true });
  /* 2. the advisory check */
  const a = run("node", ["tools/lib_audit.js", "--self"]);
  t.ok(
    a.status === 0 && /its own checks pass/.test(a.stdout),
    "the library advisory check passes its own checks (waivers by date, the map waiver's ground): " +
      (a.stdout + a.stderr).trim().split("\n").pop().slice(0, 160)
  );
  const w = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/audit-waivers.json"), "utf8")).waivers;
  t.ok(
    w.every(x => x.pkg && /^\d{4}-\d\d-\d\d$/.test(x.until) && x.reason && x.reason.length > 40),
    "every waiver names a package, an end date and a reason"
  );
  /* 2b. the nightly tools' own logic, on fixed examples (tools/test_tools.py) */
  const py = run("python3", ["tools/test_tools.py"]);
  t.ok(
    py.status === 0 && /all their own checks pass/.test(py.stdout),
    "the nightly tools match places, read opening hours and find map tiles as their rules say: " +
      (py.stdout + py.stderr).trim().split("\n").slice(-3).join(" | ").slice(0, 300)
  );
  /* 2c. (v201) the nightly copy to the website gives each request a time limit and one more try: a first request that
     never answers, then a good one, still sends everything once */
  {
    const http = require("http"),
      hits = [];
    const srv = http.createServer((req, res) => {
      let b = "";
      req.on("data", c => (b += c));
      req.on("end", () => {
        hits.push(req.method + " " + req.url);
        if (hits.length === 1) return; /* (never answers) */
        res.writeHead(201);
        res.end();
      });
    });
    await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-cc-"));
    fs.mkdirSync(path.join(dir, "fx"));
    fs.writeFileSync(path.join(dir, "fx", "latest.json"), JSON.stringify({ base: "EUR" }));
    const r = await new Promise(ok =>
      require("child_process").execFile(
        "node",
        ["tools/copy_to_cloud.js", dir],
        { cwd: ROOT, env: Object.assign({}, process.env, { WP_CLOUD_URL: "http://127.0.0.1:" + srv.address().port, WP_CLOUD_TIMEOUT_MS: "400" }), timeout: 20000 },
        (e, so, se) => ok({ code: e ? e.code : 0, out: so, err: se })
      )
    );
    srv.closeAllConnections && srv.closeAllConnections();
    srv.close();
    t.ok(r.code === 0 && /"count":1/.test(r.out) && hits.length === 2, "the copy to the website gives up on a request that never answers and tries once more: " + JSON.stringify({ hits: hits.length, out: r.out.trim(), err: r.err.slice(0, 120) }));
  }
  /* 3. the island towns */
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "trip/data/data2.js"), "utf8"), ctx);
  const TI = ctx.window.TI,
    bad = [],
    far = [];
  let n = 0;
  const km = (x, y) => {
    const r = Math.PI / 180,
      h = Math.sin(((y[0] - x[0]) * r) / 2) ** 2 + Math.cos(x[0] * r) * Math.cos(y[0] * r) * Math.sin(((y[1] - x[1]) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  Object.keys(TI).forEach(c =>
    TI[c].forEach(row => {
      const pts = row[1]
        .split(";")
        .map(s => {
          const m = /^(.+)@(-?[\d.]+),(-?[\d.]+)$/.exec(s);
          n++;
          if (!m || Math.abs(+m[2]) > 90 || Math.abs(+m[3]) > 180) {
            bad.push(c + ": " + s);
            return null;
          }
          return [+m[2], +m[3], m[1]];
        })
        .filter(Boolean);
      /* a town far from every other town of its island or group (the largest groups span a few hundred km) */
      if (pts.length > 1)
        pts.forEach(a => {
          const near = Math.min(...pts.filter(b => b !== a).map(b => km(a, b)));
          if (near > 450) far.push(`${c} / ${row[0].split(",")[0]}: ${a[2]} is ${Math.round(near)} km from the nearest other town`);
        });
    })
  );
  t.ok(
    n > 200 && !bad.length,
    `the island towns' table reads cleanly (${n} towns${bad.length ? "; unreadable: " + bad.slice(0, 3).join(" | ") : ""})`
  );
  t.eq(far, [], "no town sits far from all the others of its island");
  /* (v184) the nightly city library helper, on a made-up database */
  const cl = require("../lib/citylibcheck")(ROOT);
  cl.out.forEach(([ok, m]) => t.ok(ok, m));
  /* (v187) the places built into the app */
  require("../lib/datacheck")(ROOT).out.forEach(([ok, m]) => t.ok(ok, m));
  require("../lib/deadcheck")(ROOT).out.forEach(([ok, m]) => t.ok(ok, m));
};
