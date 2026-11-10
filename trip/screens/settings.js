/* Waypoint trip settings, under the trip name: importing a plan, and the app's stored files (lib/storage.js). Calendar, PDF and the offline
   copy live on Prepare (Take along); booking sites and price watches next to the prices they affect (Prepare, To book). */
(function () {
  "use strict";
  var W = window.W, esc = W.esc, S = W.S;
  var BACK = { go: "Today", setup: "Plan", trip: "Trip", explore: "Trip", book: "Prepare", recap: "Trip recap" };
  function card(title, sub, body, id) {
    return '<section class="bk-card sk set-c"' + (id ? ' id="' + id + '"' : "") + '><div class="bk-h"><h2>' + title + "</h2>" + (sub ? '<p class="small muted">' + sub + "</p>" : "") + "</div>" + body + "</section>";
  }
  W.renderSettings = function (P) {
    var el = W.$("viewSettings"); if (!el) return;
    var host = el;
    var back = W.prevView ? W.prevView() : "trip";
    var h = '<div class="settings"><button type="button" class="linkish back" data-view="' + back + '">← ' + esc(BACK[back] || "Back") + "</button>" +
      '<header class="set-h"><h2>Settings</h2><p class="muted">' + esc(W.tripName ? W.tripName() : "This trip") + "</p></header>";
    if (W.accountCard) h += W.accountCard(card);
    if (W.installCard) h += W.installCard(card);
    if (!W.standalone || W.cloud) h += card("Paste an itinerary", "Paste an itinerary from Wanderlog, a document or an email. It becomes a new trip, with the places you'd already chosen pinned to their days.", W.importBlock ? W.importBlock(true) : "", "set-import");
    h += card("Simple view", "Hide the photos, the maps and the extra lines, and keep what you need: times, places, walks, directions, what to book and warnings.", W.simpleSwitch(), "set-simple");
    if (W.curPicker) h += card("Prices", "Show every cost in one currency, or each as listed. This is for this phone only.", W.curPicker(P), "set-cur");
    if (W.storageCard) h += W.storageCard(card);   /* the app's stored files, for people who can edit it (lib/storage.js) */
    W.keepInputs(host, function () {
      var t = W.$("importText"), keep = t && t.value;
      host.innerHTML = h + "</div>";
      if (keep) { var t2 = W.$("importText"); if (t2) t2.value = keep; }
    });
  };
  W.settingsClick = function (b, d, P) {
    if (d.sync) return;   /* sharing buttons are handled by sync.js */
    if (W.storageClick && W.storageClick(d)) return;
    if (W.importClick && W.importClick(d)) return;
    if (W.takeItClick && W.takeItClick(d, P)) return;
    if (W.liveClick && W.liveClick(d, P)) { W.render(); return; }
    if (W.watchClick && W.watchClick(d, P)) { W.render(); return; }
  };
})();
