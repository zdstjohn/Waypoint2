/* Waypoint planning together: someone you share a trip with can change the plan too, when you allow it.
   Their changes never touch your saved trip directly. Each person who edits writes their own small list of changes
   (shared/<code>/edits/<their id>: {who, at, ops: {"picks|<slot>": {v, at}, …}}), one entry per thing changed, with the
   time. Your app reads those lists, takes every change newer than the last one it took from that person (unless you
   changed the same thing after them), keeps a short log of who changed what, and the shared copy (shared/<code>)
   carries the result back to them. What can change: the stop in a slot (and that it was chosen by a person), a rest
   day, a slot left free, and how you travel between two stops. Places to stay, dates, bookings and the route stay
   yours. Everything read from another person's list is checked before it is used. */
(function () {
  "use strict";
  var W = window.W, S = W.S;
  var ALLOW = ["picks", "mine", "rest", "free", "legPick"];
  var db = null, uid = null, touchedAt = 0;
  /* only what a person does counts as a change of theirs (the planner filling a new day on its own is not one) */
  ["click", "change", "input", "pointerup"].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.isTrusted !== false) touchedAt = Date.now(); }, true); });
  function byHand() { return Date.now() - touchedAt < 6000; }
  function lget(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  try {
    if (window.claude && window.claude.use) Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
      db = r[0]; var u = r[1]; if (!db || !u) return;
      return u.id().then(function (id) { uid = id; tick(); W.changed(); });
    }, function () {});
  } catch (e) {}

  /* checking what someone else wrote: a key the app makes, a value of the right kind */
  function safeKey(k) { return typeof k === "string" && k.length > 0 && k.length <= 200 && !/^(__proto__|constructor|prototype)$/.test(k) && !/[\u0000-\u001f]/.test(k); }
  function clean(f, v) {
    if (v === null) return null;
    if (f === "picks" || f === "legPick") return typeof v === "string" && v.trim() ? v.slice(0, 160) : undefined;
    return v === 1 || v === true ? 1 : v === 0 || v === false ? null : undefined;
  }
  function snap(st) { var o = {}; ALLOW.forEach(function (f) { o[f] = clone(st[f] && typeof st[f] === "object" ? st[f] : {}); }); return o; }
  function diff(a, b, at, out) {
    ALLOW.forEach(function (f) {
      var ka = Object.keys(a[f] || {}), kb = Object.keys(b[f] || {}), seen = {};
      ka.concat(kb).forEach(function (k) {
        if (seen[k]) return; seen[k] = 1;
        var va = (a[f] || {})[k], vb = (b[f] || {})[k];
        if (JSON.stringify(va) !== JSON.stringify(vb)) out[f + "|" + k] = { v: vb === undefined ? null : vb, at: at };
      });
    });
    return out;
  }

  /* ---------- what a change was, in words ---------- */
  var SLOT = { breakfast: "breakfast", am: "morning", lunch: "lunch", pm: "afternoon", dinner: "dinner", eve: "evening" };
  function dayOf(key) {
    var p = key.split("|"), P = W.P; if (!P || p.length < 3) return null;
    return P.days.filter(function (d) { return d.country === p[0] && d.city === p[1] && d.dayInCity === +p[2]; })[0] || null;
  }
  function describe(f, key, v) {
    var d = dayOf(key), slot = SLOT[key.split("|")[3]] || "", where = d ? "Day " + d.n + (slot ? " " + slot : "") : key.split("|")[1] || "a day";
    if (f === "picks") return v ? "chose " + v + " for " + where : "cleared " + where;
    if (f === "rest") return v ? "made " + where + " a rest day" : "made " + where + " a full day again";
    if (f === "free") return v ? "left " + where + " free" : "filled " + where + " again";
    if (f === "legPick") { var ab = key.split(">").map(function (x) { return x.split("|")[1] || x; }); return "changed how to get from " + ab[0] + " to " + (ab[1] || "the next stop"); }
    return "";
  }
  W.coDescribe = describe;

  /* ---------- the person you shared with ---------- */
  function opsKey(code) { return "waypoint-co-" + code; }
  function whoKey(code) { return "waypoint-co-who-" + code; }
  var last = null, pushT = null;
  W.coWho = function (code) { return lget(whoKey(code || (W.readOnly && W.readOnly.code))) || ""; };
  W.coSetWho = function (name) { var c = W.readOnly && W.readOnly.code; if (!c) return; lset(whoKey(c), String(name || "").trim().slice(0, 30)); push(); };
  /* the owner's copy just arrived: lay your changes they haven't taken yet back over it */
  W.coReapply = function (body) {
    var code = W.readOnly && W.readOnly.code; if (!code) return;
    var mine = lget(opsKey(code)) || {}, took = (body && body.coSeen || {})[uid] || 0, keep = {};
    Object.keys(mine).forEach(function (k) {
      var op = mine[k]; if (!op || op.at <= took) return;
      keep[k] = op;
      var i = k.indexOf("|"), f = k.slice(0, i), key = k.slice(i + 1), obj = S[f] || (S[f] = {});
      if (op.v === null) delete obj[key]; else obj[key] = op.v;
    });
    lset(opsKey(code), keep);
    last = snap(S);
  };
  /* you changed something: add it to your list, and send the list */
  W.coPush = function () {
    if (!W.readOnly || !W.readOnly.edit) return;
    clearTimeout(pushT); pushT = setTimeout(push, 700);
  };
  function push() {
    var code = W.readOnly && W.readOnly.edit && W.readOnly.code; if (!code || !db || !uid) return;
    var cur = snap(S), ops = lget(opsKey(code)) || {};
    if (last && byHand()) diff(last, cur, Date.now(), ops);
    last = cur;
    if (!Object.keys(ops).length) return;
    lset(opsKey(code), ops);
    try {
      db.doc("shared/" + code + "/edits/" + uid).set({ who: W.coWho(code) || "Family", at: Date.now(), ops: ops }).then(function () { if (W.readOnly) { W.readOnly.coErr = ""; } },
        function () { if (W.readOnly) { W.readOnly.coErr = "Your changes couldn't be sent. You may only be able to view this trip: ask for edit access to the app."; W.renderBar && W.renderBar(W.P); } });
    } catch (e) {}
  }

  /* ---------- you, the owner: take their changes ---------- */
  var sub = null, subCode = null, applying = false, mineSnap = null;
  function tick() {
    if (!db || !uid) return;
    var want = !W.readOnly && S.share && S.shareEdit ? S.share : null;
    if (want === subCode) return;
    if (sub) { try { sub(); } catch (e) {} sub = null; }
    subCode = want; if (!want) return;
    try { sub = db.collection("shared/" + want + "/edits").onSnapshot(function (s) { if (subCode === want) take(s.docs || []); }, function () {}); } catch (e) {}
  }
  function take(docs) {
    if (W.readOnly) return;
    var seen = S.coSeen || (S.coSeen = {}), mineAt = S.coMine || {}, log = (S.coLog || []).slice(), any = false, moved = false, now = Date.now();
    applying = true;
    docs.forEach(function (d) {
      var id = d.id, b = (d.data && d.data()) || {}, ops = b.ops && typeof b.ops === "object" ? b.ops : {}, took = seen[id] || 0, top = took;
      var who = String(b.who || "Family").replace(/[\u0000-\u001f<>]/g, "").slice(0, 30) || "Family";
      Object.keys(ops).filter(function (k) { var op = ops[k]; return op && typeof op.at === "number" && op.at > took && op.at < now + 864e5; })
        .sort(function (a, c) { return ops[a].at - ops[c].at; }).forEach(function (k) {
          var op = ops[k], i = k.indexOf("|"), f = k.slice(0, i), key = k.slice(i + 1);
          top = Math.max(top, op.at);
          if (ALLOW.indexOf(f) < 0 || !safeKey(key)) return;
          var v = clean(f, op.v); if (v === undefined) return;
          if ((mineAt[k] || 0) > op.at) return;   /* you changed this after they did: yours stands */
          var obj = S[f] && typeof S[f] === "object" ? S[f] : (S[f] = {});
          if (JSON.stringify(obj[key] === undefined ? null : obj[key]) === JSON.stringify(v)) return;
          if (v === null) delete obj[key]; else obj[key] = v;
          any = true;
          var t = describe(f, key, v); if (t) log.push({ who: who, at: op.at, t: t });
        });
      if (top > took) { seen[id] = top; moved = true; }
    });
    applying = false;
    if (any) { S.coLog = log.slice(-30); if (W.replan) W.replan(); }
    if (any || moved) { mineSnap = snap(S); W.changed(); }
  }
  /* note when you change something yourself, so an older change of theirs never undoes it */
  function noteMine() {
    if (W.readOnly || !S.share || !S.shareEdit || applying) { mineSnap = null; return; }
    var cur = snap(S);
    if (mineSnap && byHand()) { var d = diff(mineSnap, cur, Date.now(), {}), m = S.coMine || (S.coMine = {}); Object.keys(d).forEach(function (k) { m[k] = d[k].at; }); }
    mineSnap = cur;
  }
  if (W.onData) W.onData(function () { tick(); noteMine(); });

  /* ---------- who changed what ---------- */
  W.coLogHtml = function (list, n) {
    list = (list || []).slice(-(n || 6)).reverse(); if (!list.length) return "";
    return '<ul class="co-log">' + list.map(function (e) {
      return "<li><b>" + W.esc(e.who) + "</b> " + W.esc(e.t) + ' <span class="muted">· ' + W.esc(W.ago ? W.ago(e.at) : "") + "</span></li>";
    }).join("") + "</ul>";
  };
  W.coTick = tick;
})();
