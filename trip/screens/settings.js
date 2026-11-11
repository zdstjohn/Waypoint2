/* Waypoint trip settings, under the trip name: importing a plan, and the app's stored files (lib/storage.js). Calendar, PDF and the offline
   copy live on Prepare (Take along); booking sites and price watches next to the prices they affect (Prepare, To book). */
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
      '">' +
      W.arrow() +
      esc(BACK[back] || "Back") +
      "</button>" +
      '<header class="set-h"><h2>Settings</h2><p class="muted">' +
      esc(W.tripName ? W.tripName() : "This trip") +
      "</p></header>";
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
    if (W.curPicker)
      h += card("Prices", "Show every cost in one currency, or each as listed. This is for this phone only.", W.curPicker(P), "set-cur");
    /* a copy of your trips, as a file you keep (lib/sync.js W.tripsExport); and trips back from such a file */
    if (!W.readOnly)
      h += card(
        "A copy of your trips",
        "Every trip on this device in one file: the plans, bookings, checklists and journal notes (photos stay in the app). Keep it somewhere safe; it is a backup that does not depend on this app.",
        '<div class="row"><button type="button" class="btn quiet" data-trips="save">Save a copy</button>' +
          '<button type="button" class="btn quiet" data-trips="open">Open a saved copy</button>' +
          '<input type="file" id="tripsFile" accept=".json,application/json" hidden aria-label="A saved copy of your trips"></div>' +
          '<p class="small muted" id="tripsMsg" role="status">' +
          esc(tripsMsg) +
          "</p>",
        "set-copy"
      );
    if (W.storageCard) h += W.storageCard(card); /* the app's stored files, for people who can edit it (lib/storage.js) */
    W.keepInputs(host, function () {
      var t = W.$("importText"),
        keep = t && t.value;
      host.innerHTML = h + "</div>";
      if (keep) {
        var t2 = W.$("importText");
        if (t2) t2.value = keep;
      }
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
    (window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null))
      .then(function (dl) {
        if (dl) return dl.save({ filename: file, data: blob });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .then(
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
  W.settingsClick = function (b, d, P) {
    if (d.sync) return; /* sharing buttons are handled by sync.js */
    if (d.trips === "save") return saveTrips();
    if (d.trips === "open") {
      var f = W.$("tripsFile");
      if (f) f.click();
      return;
    }
    if (W.storageClick && W.storageClick(d)) return;
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
