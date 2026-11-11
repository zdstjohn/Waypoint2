/* Waypoint family: on a shared trip, family can heart the places they're excited about and comment on stops.
   Hearts are kept beside the shared copy; the planner gives hearted places a nudge, and you see who loved what.
   Comments use claude.ai's own comment threads on this page. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc;
  var db = null, uid = null, canWrite = false, comments = null;
  try {
    if (window.claude && window.claude.use) {
      window.claude.use("db").then(function (d) { db = d; W.changed(); }, function () {});
      window.claude.use("user").then(function (u) {
        if (!u) return;
        u.id().then(function (id) { uid = id; W.changed(); }, function () {});
        u.can("data.write").then(function (v) { canWrite = v !== false; W.changed(); }, function () {});
      }, function () {});
      window.claude.use("comments").then(function (c) { comments = c; W.changed(); }, function () {});
    }
  } catch (e) {}
  function k(it) { return W.norm(it.n); }

  /* ---------- your shared trip: hearts from family ---------- */
  var counts = {}, sub = null, subCode = null;
  function watch() {
    var code = !W.readOnly && W.S.share || null;
    if (!db || code === subCode) return;   /* (waits for the database before subscribing) */
    if (sub) { sub(); sub = null; } subCode = code; counts = {};
    if (!code) return;
    /* hearts are sealed with the trip's code, like the trip itself (lib/sharebox.js) */
    W.shareBox(code).then(function (bx) {
      if (subCode !== code) return;
      sub = db.collection("shared/" + bx.id + "/hearts").onSnapshot(function (snap) {
        Promise.all((snap.docs || []).map(function (d) { return bx.open(d.data()); })).then(function (list) {
          if (subCode !== code) return;
          var c = {};
          list.forEach(function (b) { var it = b && b.items && typeof b.items === "object" ? b.items : {}; Object.keys(it).forEach(function (x) { if (it[x]) c[x] = (c[x] || 0) + 1; }); });
          counts = c; W.changed();
        });
      }, function () {});
    }, function () {});
  }
  W.heartsFor = function (it) { return !W.readOnly && counts[k(it)] || 0; };

  /* ---------- someone else's shared trip: your own hearts ---------- */
  var mine = {}, mineFor = null, writing = false, again = false;
  function loadMine() {
    var code = W.readOnly && W.readOnly.code, bx = W.readOnly && W.readOnly.box, want = code && bx && uid && db ? bx.id + "/" + uid : null;
    if (want === mineFor) return;
    mineFor = want; mine = {};
    if (!want || !bx) return;
    var open = bx.open;
    db.doc("shared/" + bx.id + "/hearts/" + uid).get().then(function (s) { return s.exists ? open(s.data()) : null; })
      .then(function (b) { if (mineFor === want && b && b.items && typeof b.items === "object") { mine = Object.assign({}, b.items); W.changed(); } }, function () {});
  }
  function saveMine() {
    if (!W.readOnly || !uid || !db) return;
    if (writing) { again = true; return; }
    writing = true;
    var items = {}; Object.keys(mine).forEach(function (x) { if (mine[x]) items[x] = 1; });
    var bx = W.readOnly.box; if (!bx) { writing = false; return; }
    var at = "shared/" + bx.id + "/hearts/" + uid;
    bx.seal({ items: items, at: Date.now() }).then(function (doc) { return db.doc(at).set(doc); }).then(null, function () {}).then(function () { writing = false; if (again) { again = false; saveMine(); } });
  }

  /* the heart and comment buttons (in a stop's details and on idea cards) */
  W.familyActs = function (it, day, x) {
    if (W.readOnly) {
      var on = !!mine[k(it)], h = "";
      if (canWrite && uid) h += '<button type="button" class="heart-btn" data-heart="' + esc(k(it)) + '" aria-pressed="' + on + '">' + (on ? "♥ Loved" : "♡ Love this") + "</button>";
      if (comments) h += '<button type="button" class="linkish" data-comment="1" data-ckey="' + esc(x && x.key || "") + '">Comment</button>';
      return h ? '<div class="fam">' + h + "</div>" : "";
    }
    var n = counts[k(it)] || 0;
    return (n || comments) ? '<div class="fam">' + (n ? '<span class="heart-n">♥ ' + n + " from family</span>" : "") + (comments ? '<button type="button" class="linkish" data-comment="1" data-ckey="' + esc(x && x.key || "") + '">Comment</button>' : "") + "</div>" : "";
  };
  /* the little heart count on a closed card */
  W.heartBadge = function (it) { var n = !W.readOnly && counts[k(it)]; return n ? '<span class="heart-n" title="Family hearts">♥ ' + n + "</span>" : ""; };

  W.familyClick = function (b, d) {
    if (d.heart) { mine[d.heart] = !mine[d.heart]; saveMine(); return true; }
    if (d.comment) {
      var el = (d.ckey && document.querySelector('.slot[data-slotkey="' + CSS.escape(d.ckey) + '"]')) || b.closest("article, .idea, .slot") || b;
      if (comments) comments.openComposer({ element: el }).then(null, function (e) { if (e && e.code === "unavailable") { comments = null; W.render(); } });
      return true;
    }
    return false;
  };
  /* keep the subscriptions in step with what you're looking at */
  W.familyTick = function () { watch(); loadMine(); };
})();
