/* Waypoint offline, the parts only Prepare needs (second script): "Take along" (download the trip before you leave, and
   the offline-copy button) and the maker of the offline copy itself: one HTML file with the app, this trip and its
   cities' photos inside. The rest of offline (what is saved, the block on Today) is lib/offline.js. */
(function () {
  "use strict";
  var W = window.W,
    O = W.offline,
    photoUrls = O.photoUrls,
    planSig = O.planSig;
  /* Prepare, Take along: download the whole trip (each city's street map and photos) before you leave, with what is on
     the phone city by city, how many stops have a photo, and about how big it is (best on Wi-Fi) */
  O.tripBlock = function (P) {
    if (O.copy || W.readOnly || !P || !P.stops.length) return "";
    var cov = W.tripPhotoCoverage(P),
      mine = O.at && O.trip === (W.S.tripId || "") ? O.cities || {} : {};
    var mb = 0;
    cov.rows.forEach(function (r) {
      if (r.map && !(mine[r.key] && mine[r.key].map)) mb += (W.vtSize ? W.vtSize(r.map) : 0) || 4e6;
      mb += (r.urls.length - (mine[r.key] ? mine[r.key].photos : 0)) * 160e3;
    });
    var conn = /** @type {any} */ (navigator).connection,
      cell = conn && (conn.type === "cellular" || conn.saveData);
    var rows = cov.rows
      .map(function (r) {
        var m = mine[r.key],
          mapTxt = !r.map ? "no street map yet" : m && m.map ? "street map saved" : "street map";
        var phTxt = r.stops
          ? "photos for " + r.urls.length + " of " + r.stops + " stops" + (m && m.photos < r.urls.length ? " (" + m.photos + " saved)" : "")
          : "no stops yet";
        var done = m && (!r.map || m.map) && m.photos >= r.urls.length;
        return (
          '<li class="dl-row' +
          (done ? " done" : "") +
          '"><b>' +
          W.esc(r.city) +
          '</b><span class="small muted">' +
          W.esc(mapTxt + " · " + phTxt) +
          "</span></li>"
        );
      })
      .join("");
    var all = cov.rows.every(function (r) {
      var m = mine[r.key];
      return m && (!r.map || m.map) && m.photos >= r.urls.length;
    });
    var btn =
      O.state === "saving"
        ? '<span class="loading">Saving… ' + O.n + " of " + O.total + " photos</span>"
        : O.off
          ? '<span class="small muted">Connect to download.</span>'
          : '<button type="button" class="btn' +
            (all ? " quiet" : "") +
            '" data-offsave="1">' +
            (all ? "Download again" : "Download the trip") +
            "</button>" +
            (mb > 0 && !all
              ? '<span class="small muted">About ' +
                Math.max(1, Math.round(mb / 1e6)) +
                " MB" +
                (cell ? ": you're on mobile data, Wi-Fi is better" : ", best on Wi-Fi") +
                "</span>"
              : "");
    return (
      '<div class="dl-trip"><span class="k">Before you leave</span><p class="small">' +
      (all
        ? "Everything for this trip is on this phone."
        : "Save each city's street map and the trip's photos on this phone, for ferries, museums and no-signal days.") +
      " Photos for " +
      cov.pct +
      "% of stops (" +
      cov.withPhoto +
      " of " +
      cov.stops +
      ').</p><ul class="dl-list">' +
      rows +
      '</ul><div class="row">' +
      btn +
      "</div></div>"
    );
  };
  /* the offline-copy button for the Prepare screen's Take along segment */
  O.takeBlock = function (P) {
    if (O.copy) return "";
    /* installed on its own, the app itself opens with no connection: no copy needed */
    if (W.standalone)
      return (
        '<div class="take-off"><span class="k">Offline</span><p class="small">' +
        (W.pwa && W.pwa.installed
          ? "Waypoint is installed on this phone and opens with no connection."
          : "Install Waypoint on this phone (Settings, Install) and it opens with no connection.") +
        "</p></div>"
      );
    return (
      '<div class="take-off"><span class="k">Offline copy</span>' +
      O.copyNote(P) +
      '<div class="row"><button type="button" class="btn quiet" data-offcopy="1"' +
      (O.copyState === "making" ? " disabled" : "") +
      ">" +
      (O.copyState === "making" ? "Making the file…" : "Save an offline copy") +
      "</button>" +
      '<span class="small muted">' +
      (O.copyState === "making" && O.copyOf
        ? "Adding photos: " + (O.copyN || 0) + " of " + O.copyOf
        : O.copyState === "done"
          ? "Saved. Open it from your phone's files; it works with no connection."
          : O.copyState === "error"
            ? W.esc(O.copyErr || "Couldn't make the file.")
            : "One file with the app, this trip and the photos of every place in it (street maps need a connection).") +
      "</span></div></div>"
    );
  };

  /* The copy's own storage. A file opened from a phone's downloads shares its storage with every other file there, or is
     given none at all. So the copy keeps everything in memory, under its own name, and writes that to the phone only if
     the phone lets it (window.__WP_COPY_KEPT says whether it did): one copy never shows another copy's trip, and a
     phone that refuses storage still shows this one. (Runs first, before the app, inside the copy.) */
  var SHIM =
    "(function(){var at=(window.__WP_OFFLINE||{}).at,KEY='waypoint-copy|'+at,real=null,mem={},t=null;" +
    "try{real=window.localStorage;var j=real.getItem(KEY);if(j)mem=JSON.parse(j)||{};}catch(e){real=null;mem={};}" +
    "function flush(){t=null;if(!real){window.__WP_COPY_KEPT=false;return;}try{var o={};for(var k in mem)if(k!=='waypoint-cache-v2')o[k]=mem[k];real.setItem(KEY,JSON.stringify(o));window.__WP_COPY_KEPT=true;}catch(e){window.__WP_COPY_KEPT=false;}}" +
    "function soon(){if(!t)t=setTimeout(flush,400);}" +
    "var S={getItem:function(k){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null;},setItem:function(k,v){mem[k]=String(v);soon();},removeItem:function(k){delete mem[k];soon();},clear:function(){mem={};soon();},key:function(i){return Object.keys(mem)[i]||null;}};" +
    "Object.defineProperty(S,'length',{get:function(){return Object.keys(mem).length;}});" +
    "try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return S;}});}catch(e){}" +
    "window.__WP_COPY_KEPT=!!real;window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush();});})();";
  /* ---------- the offline copy: one HTML file with the app, this trip and its cities' photos inside ---------- */
  function text(u) {
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error("missing " + u);
      return r.text();
    });
  }
  function dataUri(u) {
    return fetch(u)
      .then(function (r) {
        if (!r.ok) throw new Error("missing " + u);
        return r.blob();
      })
      .then(function (b) {
        return new Promise(function (ok, no) {
          var fr = new FileReader();
          fr.onload = function () {
            ok(fr.result);
          };
          fr.onerror = function () {
            no(fr.error);
          };
          fr.readAsDataURL(b);
        });
      });
  }
  O.exportCopy = function (P) {
    if (P && W.plan) P = W.plan();
    if (O.copyState === "making" || !P || !P.stops.length) return Promise.resolve();
    O.copyState = "making";
    O.copyErr = "";
    W.changed();
    var seed = { at: Date.now(), S: null, C: null, photos: W.photosSnapshot ? W.photosSnapshot() : null, blobs: {} };
    return Promise.all([text("index.html"), text("app.min.css"), text("app.js"), text("app2.js"), text("app2.css")])
      .then(function (r) {
        var html = r[0],
          css = r[1] + "\n" + r[4],
          js = r[2],
          js2 = r[3]; /* both stylesheets in one */
        /* fonts become data URIs inside the stylesheet */
        var fonts = [];
        css.replace(/url\((fonts\/[^)]+)\)/g, function (m, u) {
          if (fonts.indexOf(u) < 0) fonts.push(u);
          return m;
        });
        return Promise.all(fonts.map(dataUri))
          .then(function (ds) {
            fonts.forEach(function (u, i) {
              css = css.split("url(" + u + ")").join("url(" + ds[i] + ")");
            });
            /* the photos the trip shows */
            /* a few at a time, in order of need, up to 60 MB of photos (a phone opens a file that size; past it, the rest of
           the ideas show without a picture, as they would anyway with no signal) */
            var list = photoUrls(P),
              i = 0,
              bytes = 0,
              MAX = 60e6;
            O.copyN = 0;
            O.copyOf = list.length;
            function worker() {
              if (i >= list.length || bytes > MAX) return Promise.resolve();
              var u = list[i++];
              return dataUri(u)
                .then(
                  function (d) {
                    if (bytes + d.length <= MAX) {
                      seed.blobs[u] = d;
                      bytes += d.length;
                    }
                  },
                  function () {}
                )
                .then(function () {
                  O.copyN++;
                  if (O.copyN % 10 === 0) W.changed();
                  return worker();
                });
            }
            return Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
          })
          .then(function () {
            seed.S = JSON.parse(JSON.stringify(W.S));
            seed.C = JSON.parse(JSON.stringify(W.C));
            /* (replacement text goes in as a function: code and JSON are full of "$" sequences String.replace would expand) */
            var styleTag = "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
            var safe = function (code) {
              return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
            };
            /* both scripts inline (the second one too: a file opened from the phone can't fetch it), in order */
            var scriptTags =
              "<script>window.__WP_LATER=1;window.__WP_OFFLINE=" +
              safe(JSON.stringify(seed)) +
              ";" +
              SHIM +
              "</script>\n<script>" +
              safe(js) +
              "</script>\n<script>" +
              safe(js2) +
              "</script>";
            var page = html
              .replace(/<link rel="preload"[^>]*>\s*/g, "")
              .replace(/<link rel="stylesheet" href="app.min.css"[^>]*>/, function () {
                return styleTag;
              })
              .replace(/<script src="app.js"[^>]*><\/script>/, function () {
                return scriptTags;
              });
            if (page.indexOf(scriptTags) < 0 || page.indexOf(styleTag) < 0) throw new Error("the page's script or style tag was not found");
            /* the live page is wrapped in a document by its host; the file needs its own (and its charset, or the browser guesses) */
            page =
              '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' +
              page +
              "</body></html>";
            var name = (W.tripName ? W.tripName() : "Trip").replace(/[^\w\- ]+/g, "").trim() || "Trip";
            var blob = new Blob([page], { type: "text/html" }),
              file = name + " (offline copy).html";
            return (window.claude && window.claude.use ? window.claude.use("downloads") : Promise.resolve(null)).then(function (dl) {
              if (!dl) {
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = file;
                document.body.appendChild(a);
                a.click();
                a.remove();
                return;
              }
              return dl.save({ filename: file, data: blob });
            });
          });
      })
      .then(
        function () {
          O.copyState = "done";
          try {
            localStorage.setItem("waypoint-copy", JSON.stringify({ trip: W.S.tripId || "", at: Date.now(), sig: planSig(P) }));
          } catch (x) {}
          W.changed();
        },
        function (e) {
          O.copyState = e && e.code === "declined" ? "idle" : "error";
          O.copyErr =
            e && e.code === "unavailable"
              ? "Downloads aren't available in this view."
              : "Couldn't make the file: " + String((e && e.message) || e);
          W.changed();
        }
      );
  };
})();
