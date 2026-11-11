/* Waypoint storage (second script): housekeeping for the app's stored files (place photos, street-map parts, journal
   photos), on the Settings screen, for people who can edit the app. "Find unused files" lists every stored file
   (assets.list) and every id anything points at: the app's own lists (photos, maps, links, places, wanted), your saved
   trips, the shared trips, what this phone keeps, and the app's own scripts; a 32-character id appearing anywhere in
   them counts as in use. Files uploaded in the last two days are kept (the nightly photo run uploads first and records
   them after). It shows what nothing uses, with thumbnails, and deletes them only when you confirm, checking everything
   once more first. It deletes nothing when a list can't be read in full, or when more than half the files would go
   (that would mean something wasn't read). Photos kept only in someone else's private trip can't be seen from here. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var A = null,
    DB = null,
    U = null,
    st = { phase: "idle" };
  var KEEP_MS = 2 * 864e5,
    MAX = 1000,
    LISTS = ["photos", "maps", "links", "places", "wanted", "shared"];
  function use(n) {
    try {
      return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }
  Promise.all([use("assets"), use("db"), use("user")]).then(
    function (r) {
      A = r[0];
      DB = r[1];
      U = r[2];
      if (A && W.view && W.view() === "settings") W.render();
    },
    function () {}
  );
  function draw() {
    if (W.view && W.view() === "settings") W.render();
  }
  function mb(b) {
    return b >= 1e9 ? (b / 1e9).toFixed(2) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
  }
  function n0(x) {
    return Number(x).toLocaleString();
  }

  /* everything anything points at */
  function refsNow() {
    var refs = {};
    function take(o) {
      try {
        (typeof o === "string" ? o : JSON.stringify(o) || "").replace(/[0-9a-f]{32}/g, function (m) {
          refs[m] = 1;
          return m;
        });
      } catch (e) {}
    }
    function col(path) {
      return DB.collection(path)
        .limit(MAX)
        .get()
        .then(function (s) {
          var d = s.docs || [];
          if (d.length >= MAX) throw new Error("the list " + path + " is too long to read in full");
          d.forEach(function (x) {
            take(x.data ? x.data() : x);
          });
          return d.length;
        });
    }
    take(W.S);
    try {
      for (var i = 0; i < localStorage.length; i++) take(localStorage.getItem(localStorage.key(i) || ""));
    } catch (e) {}
    /* what the page shows (less this card, whose thumbnails are the unused files themselves) */
    var page = document.documentElement.innerHTML,
      me = document.getElementById("set-storage");
    take(me ? page.split(me.outerHTML).join("") : page);
    var scripts = [].slice
      .call(document.scripts)
      .map(function (s) {
        return s.src;
      })
      .filter(Boolean);
    return U.id()
      .then(function (uid) {
        return Promise.all(
          LISTS.map(col)
            .concat([col("data/users/" + uid + "/trips/t")])
            .concat(
              scripts.map(function (u) {
                return fetch(u)
                  .then(function (r) {
                    if (!r.ok) throw new Error("couldn't read the app's own code");
                    return r.text();
                  })
                  .then(take);
              })
            )
        );
      })
      .then(function (counts) {
        if (!counts[0]) throw new Error("the photo list came back empty");
        return refs;
      });
  }
  function scan() {
    if (!A || !DB || !U) return Promise.reject(new Error("storage isn't available here"));
    return Promise.all([refsNow(), A.list()]).then(function (r) {
      var refs = r[0],
        all = r[1].assets || [],
        now = Date.now();
      var unused = all.filter(function (a) {
        return a && a.id && !refs[a.id] && now - Date.parse(a.createdAt || 0) > KEEP_MS;
      });
      if (all.length && unused.length > all.length / 2)
        throw new Error(n0(unused.length) + " of " + n0(all.length) + " files looked unused, which can't be right");
      return {
        all: all,
        usage: r[1].usage || {},
        unused: unused,
        bytes: unused.reduce(function (a, x) {
          return a + (x.sizeBytes || 0);
        }, 0)
      };
    });
  }
  function find() {
    st = { phase: "scan" };
    draw();
    scan().then(
      function (r) {
        st = { phase: "list", r: r };
        draw();
      },
      function (e) {
        st = { phase: "err", msg: (e && e.message) || String(e) };
        draw();
      }
    );
  }
  function del() {
    var shown = {};
    (st.r.unused || []).forEach(function (a) {
      shown[a.id] = a;
    });
    st = { phase: "del", done: 0, total: st.r.unused.length, freed: 0 };
    draw();
    /* check once more: only what is still unused now, and was on the list you saw */
    scan().then(
      function (r) {
        var go = r.unused.filter(function (a) {
            return shown[a.id];
          }),
          i = 0;
        st.total = go.length;
        draw();
        function next() {
          if (i >= go.length) {
            st = { phase: "done", n: st.done, freed: st.freed };
            draw();
            return;
          }
          var a = go[i++];
          A.delete(a.id).then(
            function (x) {
              if (x && x.deleted !== false) {
                st.done++;
                st.freed += a.sizeBytes || 0;
              }
              if (st.done % 10 === 0) draw();
              next();
            },
            function (e) {
              st = { phase: "err", msg: "Stopped after " + n0(st.done) + " files: " + ((e && (e.code || e.message)) || e) };
              draw();
            }
          );
        }
        next();
      },
      function (e) {
        st = { phase: "err", msg: ((e && e.message) || String(e)) + ". Nothing was deleted." };
        draw();
      }
    );
  }

  W.storageCard = function (card) {
    if (!A || W.readOnly) return "";
    var u = st.r && st.r.usage,
      sub =
        u && u.files != null
          ? n0(u.files) + " files · " + mb(u.bytes) + " of " + mb(u.maxBytes)
          : "Photos, street maps and journal photos the app keeps";
    var h = "";
    if (st.phase === "idle")
      h =
        '<p class="small muted">Find stored files that nothing in the app uses any more (old copies of photos, replaced maps). You see them before anything is deleted.</p><div><button type="button" class="btn quiet" data-store="find">Find unused files</button></div>';
    else if (st.phase === "scan") h = '<p class="loading">Checking every list and trip…</p>';
    else if (st.phase === "list") {
      var r = st.r,
        un = r.unused,
        pics = un.filter(function (a) {
          return /^image\//.test(a.contentType);
        }),
        other = un.length - pics.length;
      h = !un.length
        ? '<p>Nothing to clear: every stored file is in use.</p><div><button type="button" class="btn quiet" data-store="find">Check again</button></div>'
        : "<p><b>" +
          n0(un.length) +
          " files nothing uses</b> (" +
          mb(r.bytes) +
          ")" +
          (other ? ": " + n0(pics.length) + " photos and " + n0(other) + " other files" : "") +
          ". Files added in the last two days are kept.</p>" +
          (pics.length
            ? '<div class="st-grid">' +
              pics
                .slice(0, 60)
                .map(function (a) {
                  return '<img src="' + esc(a.url) + '" alt="" loading="lazy" width="64" height="64">';
                })
                .join("") +
              "</div>" +
              (pics.length > 60 ? '<p class="small muted">and ' + n0(pics.length - 60) + " more photos</p>" : "")
            : "") +
          (st.confirm
            ? '<div class="st-conf" role="alert"><p><b>Delete ' +
              n0(un.length) +
              " files for good?</b> This can't be undone.</p>" +
              '<div class="st-acts"><button type="button" class="btn danger" data-store="delete">Delete ' +
              n0(un.length) +
              ' files</button><button type="button" class="btn quiet" data-store="cancel">Cancel</button></div></div>'
            : '<div class="st-acts"><button type="button" class="btn" data-store="ask">Delete these ' +
              n0(un.length) +
              ' files</button><button type="button" class="btn quiet" data-store="cancel">Not now</button></div>');
    } else if (st.phase === "del") h = '<p class="loading">Deleting… ' + n0(st.done) + " of " + n0(st.total) + "</p>";
    else if (st.phase === "done")
      h =
        "<p><b>Deleted " +
        n0(st.n) +
        " files</b>, " +
        mb(st.freed) +
        ' freed.</p><div><button type="button" class="btn quiet" data-store="find">Check again</button></div>';
    else if (st.phase === "err")
      h =
        '<p class="warn-t">' + esc(st.msg) + '</p><div><button type="button" class="btn quiet" data-store="find">Try again</button></div>';
    return card(
      "Storage",
      esc(sub),
      '<div class="st-body">' +
        h +
        "<p class=\"small muted\">Photos kept only in someone else's private trip can't be seen from here.</p></div>",
      "set-storage"
    );
  };
  W.storageClick = function (d) {
    var a = d.store;
    if (!a) return false;
    if (a === "find") find();
    else if (a === "ask" && st.phase === "list") {
      st.confirm = true;
      draw();
    } else if (a === "cancel") {
      st = st.phase === "list" && st.confirm ? ((st.confirm = false), st) : { phase: "idle" };
      draw();
    } else if (a === "delete" && st.phase === "list" && st.confirm) del();
    return true;
  };
})();
