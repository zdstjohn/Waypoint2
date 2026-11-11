/* Waypoint, the Back button (Android's, a browser's). In the installed app, Back does what a hand expects: it closes
   what is open on top of the screen (a stop's details, the trips menu, the questions for a new trip), then steps back
   from a screen you reached by a link (Settings, the kids' corner, Prepare from "Tickets today") to the one you came
   from, and only then leaves the app.
   How: whatever opens puts one entry in the browser's history (W.backOpen), and closing it yourself takes that entry
   out again (W.backShut); a screen reached by a link is an entry too (W.navTo with step), while the tabs take the
   place of the current entry. The app's own steps back are told from yours by counting them (own), and a history
   write that would race one of them waits for it.
   Inside Claude this is off (the page lives in Claude's frame, with Claude's history): there W.navTo only keeps the
   address in step with the screen, as before. */
(function () {
  "use strict";
  var W = window.W;
  var on = !!(W.standalone || /** @type {any} */ (window).__WP_BACK);
  /** @type {{key: string, close: () => void, pushed?: boolean, gone?: boolean}[]} */ var layers = [];
  /** @type {string[]} */ var steps = []; /* the screens stepped into, above the one the app is standing on */
  var base = location.hash; /* the address of that one */
  var own = 0,
    timer = 0;
  /** @type {(() => void)[]} */ var queue = [];
  function settle() {
    own = 0;
    clearTimeout(timer);
    var q = queue;
    queue = [];
    q.forEach(function (f) {
      try {
        f();
      } catch (e) {
        W.caught(e, "history");
      }
    });
  }
  /* a write to the history: at once, or after the app's own step back that is still on its way */
  function write(fn) {
    if (own) queue.push(fn);
    else fn();
  }
  function back() {
    own++;
    clearTimeout(timer);
    timer = window.setTimeout(settle, 800); /* (a step back that never reports must not hold the rest up) */
    try {
      history.back();
    } catch (e) {
      settle();
    }
  }
  /** something opened on top of the screen: Back closes it (close must do what its own × does) */
  W.backOpen = function (key, close) {
    if (!on) return;
    for (var i = 0; i < layers.length; i++)
      if (layers[i].key === key) {
        layers[i].close = close;
        return;
      }
    var l = { key: key, close: close, pushed: false, gone: false };
    layers.push(l);
    write(function () {
      if (l.gone) return;
      try {
        history.pushState({ wpLayer: 1 }, "");
        l.pushed = true;
      } catch (e) {}
    });
  };
  /** it was closed by its own control: its entry comes out of the history */
  W.backShut = function (key) {
    for (var i = layers.length - 1; i >= 0; i--)
      if (layers[i].key === key) {
        var l = layers.splice(i, 1)[0];
        l.gone = true;
        if (l.pushed) back();
        return;
      }
  };
  /** The address follows the screen. A tab (or the app's own choice of screen) takes the place of the current entry;
      a screen reached by a link (step) is a new one, so Back returns from it. Going to the screen you stepped in from
      is that step back, by either route. */
  W.navTo = function (hash, step) {
    if (!on) {
      try {
        history.replaceState(null, "", hash);
      } catch (e) {}
      return;
    }
    layers
      .slice()
      .reverse()
      .forEach(function (l) {
        l.close();
        W.backShut(l.key);
      });
    write(function () {
      var n = steps.length,
        now = n ? steps[n - 1] : base,
        below = n > 1 ? steps[n - 2] : base;
      try {
        if (hash === now) return;
        if (n && hash === below) {
          steps.pop();
          back();
        } else if (step) {
          history.pushState({ wpStep: 1 }, "", hash);
          steps.push(hash);
        } else {
          history.replaceState(history.state, "", hash);
          if (n) steps[n - 1] = hash;
          else base = hash;
        }
      } catch (e) {}
    });
  };
  if (!on) return;
  window.addEventListener("popstate", function () {
    if (own) {
      if (--own === 0) settle();
      return;
    }
    /* your Back: it closes what is on top; with nothing open it has left a screen you stepped into (the address
       changed with it, and the app follows the address: screens/trip.js) */
    var l = layers.pop();
    if (l) {
      l.gone = true;
      try {
        l.close();
      } catch (e) {
        W.caught(e, "back");
      }
    } else steps.pop();
  });
  /* opened again (a reload) while something was open: its entry is still there, with nothing to close */
  try {
    if (history.state && history.state.wpLayer) back();
  } catch (e) {}
})();
