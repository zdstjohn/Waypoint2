/* Waypoint journal: a photo or two and a line for each day, and a recap of the whole trip to share with family. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    S = W.S;
  var assets = null,
    uploading = {},
    err = {};
  try {
    if (window.claude && window.claude.use)
      window.claude.use("assets").then(
        function (a) {
          assets = a;
          W.arrived(); /* (drawn with whatever else arrives as the app starts, not one redraw each) */
        },
        function () {}
      );
  } catch (e) {
    W.caught(e, "journal: photo store");
  }
  function J() {
    return S.journal || (S.journal = {});
  }
  function src(id) {
    var u = "/_blob/" + encodeURIComponent(id);
    return W.offline ? W.offline.src(u) : u;
  }
  function started(day) {
    var d = W.dateOf(day.n);
    return !d || d <= W.now();
  }
  W.journalHas = function () {
    var j = S.journal || {};
    return Object.keys(j).some(function (k) {
      var e = j[k];
      return e && ((e.photos || []).length || (e.note || "").trim());
    });
  };

  /* a day's journal card (in My trip, under the day's stops) */
  W.journalCard = function (day) {
    var k = W.restKey(day),
      e = J()[k] || {},
      photos = e.photos || [],
      note = e.note || "",
      has = photos.length || note.trim();
    if (W.readOnly && !has) return "";
    if (!has && !started(day) && !W.isToday(day)) return "";
    var pics = photos
      .map(function (p, i) {
        return (
          '<figure class="jp"><img src="' +
          esc(src(p.id)) +
          '" alt="Photo from day ' +
          day.n +
          '" loading="lazy">' +
          (W.readOnly
            ? ""
            : '<button type="button" class="icon-btn jx" data-jdel="' +
              esc(k) +
              '" data-ji="' +
              i +
              '" aria-label="Remove this photo">×</button>') +
          "</figure>"
        );
      })
      .join("");
    var h =
      '<section class="journal sk"><div class="j-h"><h3>Journal</h3>' +
      (W.journalHas() ? '<button type="button" class="linkish" data-view="recap">Trip recap</button>' : "") +
      "</div>";
    if (W.moodRow) h += W.moodRow(k, e.mood || 0);
    if (pics) h += '<div class="jgrid">' + pics + "</div>";
    if (W.readOnly) return h + (note ? '<p class="jnote">' + esc(note) + "</p>" : "") + "</section>";
    h +=
      '<textarea class="field jn" id="jn-' +
      esc(k) +
      '" data-jnote="' +
      esc(k) +
      '" rows="2" placeholder="What was the best bit today?">' +
      esc(note) +
      "</textarea>";
    h +=
      '<div class="lo-act">' +
      (assets
        ? uploading[k]
          ? '<span class="loading">Adding photos…</span>'
          : '<button type="button" class="btn quiet sm jadd" data-jadd="' + esc(k) + '">Add photos</button>'
        : W.standalone
          ? ""
          : '<span class="small muted">Photos can be added by the trip\'s owner in the Claude app.</span>') +
      "</div>";
    if (err[k]) h += '<p class="warn">' + esc(err[k]) + "</p>";
    return h + "</section>";
  };

  /* phone photos are big: shrink to 1600 px before uploading */
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file),
        img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)),
          c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        var g2 = c.getContext("2d");
        if (g2) g2.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(
          function (b) {
            b ? ok(b) : bad(new Error("encode"));
          },
          "image/jpeg",
          0.82
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        bad(new Error("decode"));
      };
      img.src = url;
    });
  }
  function addPhotos(k, files) {
    if (!assets || !files.length) return;
    uploading[k] = true;
    err[k] = "";
    W.render();
    var list = Array.prototype.slice.call(files, 0, 8),
      i = 0;
    function next() {
      if (i >= list.length) {
        uploading[k] = false;
        W.save();
        W.changed();
        return;
      }
      var f = list[i++];
      shrink(f)
        .then(function (b) {
          return assets.upload(b);
        })
        .then(
          function (r) {
            var e = J()[k] || (J()[k] = {});
            (e.photos || (e.photos = [])).push({ id: r.id, at: Date.now() });
            /* (each photo is sent as it lands: on a slow signal the last one can come minutes after your tap) */
            W.realChange();
            W.save();
          },
          function (e) {
            err[k] =
              e && e.code === "quota_exceeded"
                ? "This page's photo storage is full."
                : e && e.code === "too_large"
                  ? "That photo is too big."
                  : "A photo couldn't be added. Try again.";
          }
        )
        .then(next);
    }
    next();
  }
  /* the photo picker lives outside the screen: Today redraws while you're choosing (the clock, new data, coming back to
     the page), and a picker inside the card would be gone by the time the photos are chosen */
  /** @type {HTMLInputElement | null} */ var picker = null;
  function pick(/** @type {string} */ k) {
    if (!assets) return;
    if (picker && picker.parentNode) picker.parentNode.removeChild(picker);
    var p = document.createElement("input");
    picker = p;
    p.type = "file";
    p.accept = "image/*";
    p.multiple = true;
    p.setAttribute("aria-hidden", "true");
    p.tabIndex = -1;
    p.setAttribute("style", "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0");
    p.addEventListener("change", function () {
      var f = p.files;
      if (f && f.length) addPhotos(k, f);
      if (p.parentNode) p.parentNode.removeChild(p);
    });
    document.body.appendChild(p);
    p.click();
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-jadd]");
    if (b && !W.readOnly) {
      e.preventDefault();
      pick(b.getAttribute("data-jadd") || "");
    }
  });
  /* the line is kept as you type (a moment after you stop), and at once when the app goes to the background with the
     keyboard still up: it used to be kept only when you tapped out of the box */
  /** @type {any} */ var noteT = null;
  function keepNote(/** @type {any} */ t) {
    clearTimeout(noteT);
    noteT = null;
    if (!t || !t.dataset || t.dataset.jnote == null || W.readOnly) return;
    var en = J()[t.dataset.jnote] || (J()[t.dataset.jnote] = {}),
      v = (t.value || "").slice(0, 2000);
    if ((en.note || "") === v) return;
    en.note = v;
    W.realChange();
    W.save();
  }
  document.addEventListener("change", function (e) {
    keepNote(e.target);
  });
  document.addEventListener("input", function (e) {
    var t = /** @type {any} */ (e.target);
    if (!t || !t.dataset || t.dataset.jnote == null) return;
    clearTimeout(noteT);
    noteT = setTimeout(function () {
      keepNote(t);
    }, 700);
  });
  /* (before sync.js sends what is waiting as the page is hidden: this listener is added first, in capture) */
  function keepFocused() {
    var a = /** @type {any} */ (document.activeElement);
    if (a && a.dataset && a.dataset.jnote != null) keepNote(a);
  }
  document.addEventListener(
    "visibilitychange",
    function () {
      if (document.visibilityState === "hidden") keepFocused();
    },
    true
  );
  window.addEventListener("pagehide", keepFocused, true);
  W.journalClick = function (d) {
    if (d.jdel == null) return false;
    var e = J()[d.jdel];
    if (e && e.photos) e.photos.splice(+d.ji, 1); /* the file stays in storage; it's simply no longer shown */
    return true;
  };

  /* ---------- the recap: the whole trip on one page ---------- */
  W.renderRecap = function (P) {
    var el = W.$("viewRecap");
    if (!el) return;
    var d1 = W.dateOf(1),
      dn = W.dateOf(P.N),
      fmt = function (d, o) {
        return d ? d.toLocaleDateString(undefined, o) : "";
      };
    var h =
      '<div class="recap"><button type="button" class="linkish back" data-view="trip">' +
      W.arrow() +
      "Back to the trip</button>" +
      '<header class="rc-hero sk"><h2>' +
      esc(W.tripName ? W.tripName() : "Our trip") +
      "</h2>" +
      '<p class="muted">' +
      esc(
        [
          d1
            ? fmt(d1, { month: "long", day: "numeric" }) + " – " + fmt(dn, { month: "long", day: "numeric", year: "numeric" })
            : P.N + " days",
          P.stops
            .map(function (s) {
              return s.name;
            })
            .join(" → ")
        ]
          .filter(Boolean)
          .join(" · ")
      ) +
      "</p></header>";
    if (W.highlights) h += W.highlights(P);
    var any = false;
    P.days.forEach(function (day) {
      var e = J()[W.restKey(day)] || {},
        photos = e.photos || [],
        note = (e.note || "").trim();
      var seen = (day.slots || [])
        .filter(function (x) {
          return x.item && !W.isFood(x.slot);
        })
        .map(function (x) {
          return x.item.n;
        });
      if (!photos.length && !note && !started(day)) return;
      any = any || photos.length > 0 || !!note;
      var mood = e.mood ? " " + W.moodFace(e.mood) : "";
      h +=
        '<article class="rc-day sk"><div class="rc-h"><b>Day ' +
        day.n +
        " · " +
        esc(day.city) +
        mood +
        '</b><span class="muted">' +
        esc(fmt(W.dateOf(day.n), { weekday: "long", month: "short", day: "numeric" })) +
        "</span></div>" +
        (photos.length
          ? '<div class="jgrid rc">' +
            photos
              .map(function (p) {
                return '<img src="' + esc(src(p.id)) + '" alt="Photo from day ' + day.n + '" loading="lazy">';
              })
              .join("") +
            "</div>"
          : "") +
        (note ? '<p class="jnote">' + esc(note) + "</p>" : "") +
        (seen.length ? '<p class="small muted">' + esc(seen.join(" · ")) + "</p>" : "") +
        "</article>";
    });
    if (!any) h += "<div class=\"empty sk\">Add photos and a line or two to each day's journal on Trip, and they'll gather here.</div>";
    else if (!W.readOnly)
      h +=
        '<p class="small muted rc-share">' +
        (W.S.share
          ? "Family with your share code see this recap too."
          : "To show family, share the trip view-only from the trip menu (tap the trip name); the recap comes with it.") +
        "</p>";
    el.innerHTML = h + "</div>";
  };
})();
