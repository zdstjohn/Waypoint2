/* Waypoint trip settings, under the trip name: importing a plan, a copy of your trips and the Google Maps connection.
   Calendar, PDF and the offline copy live on Prepare (Take along); price watches next to the prices they affect
   (Prepare, To book). */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    S = W.S;
  var BACK = { go: "Today", setup: "Plan", trip: "Trip", explore: "Trip", book: "Prepare", recap: "Trip recap" };
  function card(title, sub, body, id) {
    return (
      '<section class="bk-card sk set-c"' +
      (id ? ' id="' + id + '"' : "") +
      '><div class="bk-h"><h2>' +
      title +
      "</h2>" +
      (sub ? '<p class="small muted">' + sub + "</p>" : "") +
      "</div>" +
      body +
      "</section>"
    );
  }
  W.renderSettings = function (P) {
    var el = W.$("viewSettings");
    if (!el) return;
    var host = el;
    var back = W.prevView ? W.prevView() : "trip";
    var h =
      '<div class="settings"><button type="button" class="linkish back" data-view="' +
      back +
      '" aria-label="Back to ' +
      esc(BACK[back] || "the trip") +
      '">' +
      W.arrow() +
      esc(BACK[back] || "Back") +
      "</button>" +
      '<header class="set-h"><h2>Settings</h2><p class="muted">' +
      esc(W.tripName ? W.tripName() : "This trip") +
      "</p></header>";
    /* what is new (data/data2.js WHATS_NEW) */
    var news = window.WHATS_NEW;
    if (news && news.items && news.items.length)
      h += card(
        "What's new",
        "",
        '<ul class="small whatsnew">' +
          news.items
            .map(function (t) {
              return "<li>" + esc(t) + "</li>";
            })
            .join("") +
          "</ul>",
        "set-new"
      );
    if (W.accountCard) h += W.accountCard(card);
    if (W.installCard) h += W.installCard(card);
    if (!W.standalone || W.cloud)
      h += card(
        "Paste an itinerary",
        "Paste an itinerary from Wanderlog, a document or an email. It becomes a new trip, with the places you'd already chosen pinned to their days.",
        W.importBlock ? W.importBlock(true) : "",
        "set-import"
      );
    h += card(
      "Simple view",
      "Hide the photos, the maps and the extra lines, and keep what you need: times, places, walks, directions, what to book and warnings.",
      W.simpleSwitch(),
      "set-simple"
    );
    h += card("Light or dark", "Auto follows your phone's own setting. This is for this phone only.", W.themeSwitch(true), "set-theme");
    if (W.curPicker)
      h += card("Prices", "Show every cost in one currency, or each as listed. This is for this phone only.", W.curPicker(P), "set-cur");
    /* a copy of your trips, as a file you keep (lib/sync.js W.tripsExport); and trips back from such a file */
    if (!W.readOnly)
      h += card(
        "A copy of your trips",
        "Every trip on this device in one file: the plans, bookings and checklists. Keep it somewhere safe; it is a backup that does not depend on this app.",
        '<div class="row"><button type="button" class="btn quiet" data-trips="save">Save a copy</button>' +
          '<button type="button" class="btn quiet" data-trips="open">Open a saved copy</button>' +
          '<input type="file" id="tripsFile" accept=".json,application/json" hidden aria-label="A saved copy of your trips"></div>' +
          '<p class="small muted" id="tripsMsg" role="status">' +
          esc(tripsMsg) +
          "</p>",
        "set-copy"
      );
    if (W.gmCard) h += W.gmCard(card); /* the viewer's Google Maps connection: what it adds, and its switch (lib/gmaps.js) */
    /* the shared city library: how much is ready (counted each night, lib/citylib.js) */
    if (W.libStats)
      h += card(
        "City library",
        "Towns and places Waypoint has ready for everyone, so a city opens in seconds.",
        '<p class="small muted" id="libMsg" role="status">Counting…</p>',
        "set-lib"
      );
    /* the photos' and street maps' file store (owner only: storage, below) */
    if (!W.readOnly && !W.standalone && window.claude)
      h += card(
        "Storage",
        "Photos and street maps the nightly tasks keep for the app. Files nothing uses any more can be removed to make room.",
        '<div id="storeBox" class="st-box" role="status">' + storeBody() + "</div>",
        "set-store"
      );
    W.keepInputs(host, function () {
      var t = W.$("importText"),
        keep = t && t.value;
      host.innerHTML = h + "</div>";
      if (keep) {
        var t2 = W.$("importText");
        if (t2) t2.value = keep;
      }
    });
    storeLook();
    if (W.libStats)
      W.libStats(function (st) {
        var m = W.$("libMsg");
        if (m)
          m.textContent = st
            ? st.countries +
              (st.countries === 1 ? " country" : " countries") +
              " and " +
              st.cities +
              (st.cities === 1 ? " city" : " cities") +
              " ready."
            : "Filled in a little more each night.";
      });
  };
  /* ---------- a copy of your trips ---------- */
  var tripsMsg = "";
  function say(t) {
    tripsMsg = t;
    var m = W.$("tripsMsg");
    if (m) m.textContent = t;
  }
  function saveTrips() {
    var doc = W.tripsExport();
    if (!doc || !doc.trips.length) return say("There is no trip of your own to save yet.");
    var blob = new Blob([JSON.stringify(doc)], { type: "application/json" }),
      file = "Waypoint trips " + doc.saved.slice(0, 10) + ".json",
      n = doc.trips.length;
    W.saveFile(file, blob).then(
      function () {
        say("Saved " + n + (n === 1 ? " trip" : " trips") + " as " + file + ".");
      },
      function () {
        say("The file was not saved.");
      }
    );
  }
  function openTrips(file) {
    var read = new FileReader();
    read.onerror = function () {
      say("That file could not be read.");
    };
    read.onload = function () {
      var doc = null;
      try {
        doc = JSON.parse(String(read.result || ""));
      } catch (e) {}
      var n = W.tripsImport(doc);
      say(
        n < 0
          ? "That file is not a copy of Waypoint trips."
          : n === 0
            ? "Every trip in that file is already on this device."
            : "Added " + n + (n === 1 ? " trip" : " trips") + ". Tap the trip name at the top to open one."
      );
    };
    read.readAsText(file);
  }
  document.addEventListener("change", function (e) {
    var t = /** @type {any} */ (e.target);
    if (t && t.id === "tripsFile" && t.files && t.files[0]) {
      openTrips(t.files[0]);
      t.value = "";
    }
  });
  /* ---------- storage (v195) ----------
     The artifact's file store (the assets capability: only someone who can edit the artifact gets it) holds the photos
     and street-map packs the nightly tasks upload; it takes 5,000 files. Nothing removed the files that stopped being
     used (photos the nightly photo look turned down, copies replaced by better ones, the parts of map packs built again),
     and once it was full the nightly photos had nowhere to go (the owner, v195: "it says file storage is full").
     Here: how full it is; the files no database document points at ("/_blob/<id>" anywhere in the collections the
     nightly tasks write); and, after a confirmation on the page, removing them. Never a file from the last two days
     (a nightly run uploads first and writes the document after), never on a read that failed or looks short. */
  var STORE_COLS = ["photos", "maps", "places", "menus", "morefood", "links", "wanted", "citylib", "fx"],
    STORE_KEEP_DAYS = 2,
    BLOB = /\/_blob\/([0-9a-f]{32})/g;
  var store = /** @type {{ st: string, usage: any, unused: any[], bytes: number, done: number, freed: number, msg: string }} */ ({
    st: "idle",
    usage: null,
    unused: [],
    bytes: 0,
    done: 0,
    freed: 0,
    msg: ""
  });
  var assetsP = /** @type {Promise<any> | null} */ (null);
  function assetsApi() {
    if (!assetsP)
      assetsP = (window.claude ? window.claude.use("assets") : Promise.resolve(null)).then(
        function (a) {
          return a || null;
        },
        function () {
          return null;
        }
      );
    return assetsP;
  }
  /** a size in the units a phone's storage shows (1 GB = 1,024 MB) */
  function mb(/** @type {number} */ b) {
    var M = 1048576;
    return b >= 1024 * M ? +(b / (1024 * M)).toFixed(2) + " GB" : Math.max(1, Math.round(b / M)) + " MB";
  }
  function n0(/** @type {number} */ n) {
    return n.toLocaleString();
  }
  function storeBody() {
    var u = store.usage,
      meter = u
        ? '<p class="small"><b>' +
          n0(u.files) +
          "</b> of " +
          n0(u.maxFiles) +
          " files · " +
          mb(u.bytes) +
          " of " +
          mb(u.maxBytes) +
          "</p>" +
          '<div class="st-bar' +
          (u.files >= 0.95 * u.maxFiles ? " full" : "") +
          '" aria-hidden="true"><i style="width:' +
          Math.min(100, Math.round((100 * u.files) / Math.max(1, u.maxFiles))) +
          '%"></i></div>'
        : "";
    var B = function (/** @type {string} */ act, /** @type {string} */ label, /** @type {boolean} */ quiet) {
      return '<button type="button" class="btn' + (quiet ? " quiet" : "") + '" data-store="' + act + '">' + label + "</button>";
    };
    switch (store.st) {
      case "idle":
      case "look":
        return '<p class="small muted">Checking…</p>';
      case "ready":
        return (
          meter +
          (u && u.files >= u.maxFiles ? '<p class="small warn">The store is full: new photos can\'t be added.</p>' : "") +
          '<div class="row">' +
          B("scan", "Find unused files", true) +
          "</div>"
        );
      case "scan":
        return meter + '<p class="small muted">Looking through the photos and maps in use…</p>';
      case "found":
        return store.unused.length
          ? meter +
              '<p class="small"><b>' +
              n0(store.unused.length) +
              " files</b> (" +
              mb(store.bytes) +
              ") aren't used by anything in the app.</p>" +
              '<div class="row">' +
              B("ask", "Remove them", false) +
              "</div>"
          : meter + '<p class="small muted">Every file is in use.</p>';
      case "ask":
        return (
          meter +
          '<p class="small"><b>Remove ' +
          n0(store.unused.length) +
          " files for good?</b> They can't be brought back. The photos and maps the app uses stay.</p>" +
          '<div class="row">' +
          B("go", "Remove for good", false) +
          B("cancel", "Cancel", true) +
          "</div>"
        );
      case "del":
        return meter + '<p class="small muted">Removed ' + n0(store.done) + " of " + n0(store.unused.length) + "…</p>";
      case "done":
        return (
          meter +
          '<p class="small">Removed ' +
          n0(store.done) +
          " files and freed " +
          mb(store.freed) +
          "." +
          (store.msg ? " " + W.esc(store.msg) : "") +
          "</p>" +
          '<div class="row">' +
          B("scan", "Look again", true) +
          "</div>"
        );
      default:
        return meter + '<p class="small warn">' + W.esc(store.msg || "Couldn't check the store.") + "</p>";
    }
  }
  function storeDraw() {
    var el = W.$("storeBox");
    if (el) el.innerHTML = storeBody();
    var c = W.$("set-store");
    if (c) c.hidden = store.st === "none";
  }
  /** how full the store is (when Settings opens; the card hides where the store is not this viewer's to tidy) */
  function storeLook() {
    if (store.st !== "idle" || W.readOnly || W.standalone || !window.claude) return storeDraw();
    store.st = "look";
    assetsApi()
      .then(function (a) {
        if (!a) {
          store.st = "none";
          return;
        }
        return a.list().then(function (/** @type {any} */ r) {
          store.usage = r.usage;
          store.st = "ready";
        });
      })
      .then(null, function (/** @type {any} */ e) {
        store.st = "err";
        store.msg = "Couldn't read the store" + (e && e.code ? " (" + e.code + ")" : "") + ".";
      })
      .then(storeDraw);
  }
  /** the files no document points at, older than two days */
  function storeScan() {
    store.st = "scan";
    storeDraw();
    var used = /** @type {Record<string, number>} */ ({});
    Promise.all([assetsApi(), window.claude ? window.claude.use("db") : null])
      .then(function (r) {
        var a = r[0],
          d = r[1];
        if (!a || !d) throw { code: "unavailable" };
        return Promise.all(
          STORE_COLS.map(function (c) {
            return d
              .collection(c)
              .get()
              .then(function (/** @type {any} */ snap) {
                (snap.docs || []).forEach(function (/** @type {any} */ doc) {
                  var t = JSON.stringify(doc.data() || {}),
                    m;
                  BLOB.lastIndex = 0;
                  while ((m = BLOB.exec(t))) used[m[1]] = 1;
                });
              });
          })
        ).then(function () {
          return a.list();
        });
      })
      .then(function (/** @type {any} */ r) {
        var all = r.assets || [],
          cut = Date.now() - STORE_KEEP_DAYS * 864e5,
          nUsed = Object.keys(used).length;
        store.usage = r.usage;
        /* a read that found almost nothing in use is a read that went wrong: remove nothing */
        if (all.length > 200 && nUsed < all.length / 20) throw { code: "short", n: nUsed };
        store.unused = all.filter(function (/** @type {any} */ x) {
          return !used[x.id] && Date.parse(x.createdAt) < cut;
        });
        store.bytes = store.unused.reduce(function (/** @type {number} */ s, /** @type {any} */ x) {
          return s + (x.sizeBytes || 0);
        }, 0);
        store.st = "found";
      })
      .then(null, function (/** @type {any} */ e) {
        store.st = "err";
        store.msg =
          e && e.code === "short"
            ? "Only " + e.n + " files looked in use, which can't be right, so nothing will be removed. Try again later."
            : "Couldn't check which files are in use" + (e && e.code ? " (" + e.code + ")" : "") + ". Nothing was removed.";
      })
      .then(storeDraw);
  }
  /** remove the unused files, a few at a time; stops at the first refusal */
  function storeRemove() {
    store.st = "del";
    store.done = 0;
    store.freed = 0;
    store.msg = "";
    storeDraw();
    var list = store.unused.slice(),
      stop = false;
    assetsApi().then(function (a) {
      if (!a) {
        store.st = "err";
        store.msg = "The store isn't open to this view.";
        return storeDraw();
      }
      function one() {
        var x = list.shift();
        if (!x || stop) return Promise.resolve();
        var del = function () {
          return a.delete(x.id);
        };
        return del()
          .then(null, function (/** @type {any} */ e) {
            if (e && e.code === "store_unavailable") return del();
            throw e;
          })
          .then(
            function () {
              store.done++;
              store.freed += x.sizeBytes || 0;
              if (store.done % 20 === 0) storeDraw();
            },
            function (/** @type {any} */ e) {
              stop = true;
              store.msg = "It stopped" + (e && e.code ? " (" + e.code + ")" : "") + "; the rest are still there.";
            }
          )
          .then(one);
      }
      Promise.all([one(), one(), one(), one()])
        .then(function () {
          return a.list().then(
            function (/** @type {any} */ r) {
              store.usage = r.usage;
            },
            function () {}
          );
        })
        .then(function () {
          store.st = "done";
          store.unused = [];
          storeDraw();
        });
    });
  }
  /** the card's buttons; true when handled @param {DOMStringMap} d */
  function storeClick(d) {
    if (!d.store) return false;
    if (d.store === "scan") storeScan();
    else if (d.store === "ask" && store.unused.length) {
      store.st = "ask";
      storeDraw();
    } else if (d.store === "cancel") {
      store.st = "found";
      storeDraw();
    } else if (d.store === "go" && store.st === "ask") storeRemove();
    return true;
  }
  W.storeTest = { cols: STORE_COLS }; /* (for the tests) */
  W.settingsClick = function (b, d, P) {
    if (d.sync) return; /* sharing buttons are handled by sync.js */
    if (storeClick(d)) return;
    if (d.trips === "save") return saveTrips();
    if (d.trips === "open") {
      var f = W.$("tripsFile");
      if (f) f.click();
      return;
    }
    if (W.importClick && W.importClick(d)) return;
    if (W.takeItClick && W.takeItClick(d, P)) return;
    if (W.liveClick && W.liveClick(d, P)) {
      W.render();
      return;
    }
    if (W.watchClick && W.watchClick(d, P)) {
      W.render();
      return;
    }
  };
})();
