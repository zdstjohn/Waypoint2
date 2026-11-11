/* Waypoint as an app on its own (outside Claude): the installable version built by build/standalone.js and hosted on
   its own site. The same scripts run in both places; window.__WP_STANDALONE (set by the standalone page) says which.
   Here: the service worker (the app opens with no connection after the first visit), the "Install" card in Settings,
   asking the phone to keep the app's data, and one wording for what only the Claude version can do. */
(function () {
  "use strict";
  var W = window.W;
  var SA = (W.standalone = !!window.__WP_STANDALONE);
  /** what to say where a feature needs Claude: in Claude, how to allow it; outside it, that it comes with the full version @param {string} what @param {string} [inClaude] */
  W.needsClaude = function (what, inClaude) {
    return SA ? what + " comes with the full Waypoint, in Claude." : inClaude || what + " needs Claude. Open this page in the Claude app.";
  };
  /** the cities with ideas built into the app (all this version can plan with), as "Rome, Florence and Venice in Italy; …" */
  W.builtInCities = function () {
    var TD = /** @type {any} */ (window).TD || {};
    return Object.keys(TD)
      .map(function (c) {
        /* an island shows as its usual base (Fira for Santorini): W.countryCities gives towns only */
        var isl = {},
          n = (W.countryCities ? W.countryCities(c) : TD[c].cities || [])
            .filter(function (x) {
              if (!(x.spots && x.spots.length)) return false;
              if (!x.isl) return true;
              if (isl[x.isl]) return false;
              return (isl[x.isl] = true);
            })
            .map(function (x) {
              return x.name;
            });
        return n.length ? (n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n[n.length - 1] : n[0]) + " in " + c : "";
      })
      .filter(Boolean)
      .join("; ");
  };
  W.builtInCountries = function () {
    var n = Object.keys(/** @type {any} */ (window).TD || {});
    return n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n[n.length - 1] : n.join("");
  };
  if (!SA) return;
  document.documentElement.classList.add("standalone");
  /* signed in to Waypoint's own server (lib/cloud.js): Claude, saved trips and sharing work as they do inside Claude */
  var CL = /** @type {any} */ (window).__WP_CLOUD || null;
  W.cloud = !!(CL && CL.session);
  if (W.cloud) document.documentElement.classList.add("cloud");
  /** the account card in Settings @param {(title: string, sub: string, body: string, id?: string) => string} card */
  W.accountCard = function (card) {
    if (!CL) return "";
    return W.cloud
      ? card(
          "Account",
          "Your trips are saved to your account and open on any device you sign in on.",
          '<p class="small">Signed in as <b>' +
            W.esc(CL.email) +
            '</b></p><button type="button" class="btn quiet" data-acct="out">Sign out</button>',
          "set-acct"
        )
      : card(
          "Account",
          "Sign in to save trips to your account, open them on any device, share them with family, and get fresh ideas for any city.",
          '<button type="button" class="btn" data-acct="in">Sign in</button>',
          "set-acct"
        );
  };
  var installed = false;
  try {
    installed = window.matchMedia("(display-mode: standalone)").matches || /** @type {any} */ (navigator).standalone === true;
  } catch (e) {}
  W.pwa = { prompt: null, installed: installed, sw: "", persisted: null };
  /* the service worker (sw.js): keeps the app's files so it opens offline; a new version is picked up on the next open */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(
      function () {
        W.pwa.sw = "on";
      },
      function () {
        W.pwa.sw = "failed";
      }
    );
  }
  /* Android (Chrome): the phone offers to install; keep that offer for the button */
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    W.pwa.prompt = e;
    W.changed();
  });
  window.addEventListener("appinstalled", function () {
    W.pwa.installed = true;
    W.pwa.prompt = null;
    W.changed();
  });
  /* ask the phone to keep what's saved (trips live on this phone in this version) */
  function persist() {
    try {
      if (navigator.storage && navigator.storage.persist)
        navigator.storage.persist().then(function (ok) {
          W.pwa.persisted = ok;
        });
    } catch (e) {}
  }
  if (installed) persist();
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  /** the card in Settings @param {(title: string, sub: string, body: string, id?: string) => string} card */
  W.installCard = function (card) {
    var P = W.pwa,
      body;
    if (P.installed)
      body =
        '<p class="small">Waypoint is installed on this device.' +
        (P.persisted === false ? " This phone may clear its saved trips if it runs short of space." : "") +
        "</p>";
    else if (P.prompt) body = '<button type="button" class="btn" data-install="1">Install Waypoint</button>';
    else if (ios) body = '<p class="small">In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>';
    else body = '<p class="small">In your browser\'s menu, choose <b>Install app</b> or <b>Add to Home screen</b>.</p>';
    return card(
      "Install on this phone",
      "Waypoint opens from your home screen like any app, and works with no connection once installed. Trips are saved on this phone.",
      body,
      "set-install"
    );
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement} */ (e.target),
      a = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-acct]")) : null;
    if (a && CL) {
      if (a.dataset.acct === "out") CL.signOut();
      else CL.showSignIn();
      return;
    }
    var b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-install]")) : null;
    if (!b) return;
    var pr = W.pwa.prompt;
    if (!pr) return;
    pr.prompt();
    pr.userChoice.then(function (c) {
      if (c && c.outcome === "accepted") {
        W.pwa.installed = true;
        persist();
      }
      W.pwa.prompt = null;
      W.changed();
    });
  });
})();
