/* Waypoint on its own, connected: accounts, saved trips and Claude through Supabase (installable version only; the
   Claude version never loads this file). It runs before the app and gives it the same three things it gets inside
   Claude, under the same names, so the app itself doesn't change:
     claude.use("db")     -> the documents (Supabase table public.docs, row-level security per person)
     claude.use("user")   -> who is signed in
     claude.use("sample") -> Claude, through the Supabase function "claude" (it holds the API key; the app never does)
   Not signed in (or choosing to go without an account): none of the three, and the app works on this phone alone with
   its built-in ideas, as before. Signing in or out reloads the page so every part starts with the right account. */
(function () {
  "use strict";
  var CFG = (window.__WP_STANDALONE || {}).cloud;
  if (!CFG || !CFG.url || !CFG.key) return;
  var URL0 = CFG.url.replace(/\/$/, ""),
    KEY = CFG.key,
    SK = "waypoint-auth",
    SKIP = "waypoint-auth-skip";
  function lget(k) {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch (e) {
      return null;
    }
  }
  function lset(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
  var session = lget(SK);
  if (session && (!session.access_token || !session.user || !session.user.id)) session = null;
  /** @type {any} */ var C = { session: session, email: session ? session.user.email || "" : "", skipped: !!lget(SKIP) };
  /** @type {any} */ (window).__WP_CLOUD = C;

  /* ---------- auth (Supabase GoTrue, plain requests) ---------- */
  function authCall(path, body) {
    return fetch(URL0 + "/auth/v1/" + path, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
    });
  }
  function keep(j) {
    if (!j || !j.access_token || !j.user) return false;
    session = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      user: { id: j.user.id, email: j.user.email }
    };
    lset(SK, session);
    lset(SKIP, null);
    C.session = session;
    C.email = session.user.email || "";
    return true;
  }
  function why(res) {
    var m = (res.j && (res.j.msg || res.j.error_description || res.j.message || res.j.error)) || "";
    if (/invalid login|invalid_grant|credentials/i.test(m)) return "That email and password don't match.";
    if (/database error|not been invited|saving new user/i.test(m)) return "That email hasn't been invited to Waypoint yet.";
    if (/already registered|already exists/i.test(m)) return "There's already an account for that email. Sign in instead.";
    if (/password/i.test(m) && /6|short|weak|characters/i.test(m)) return "Choose a password of at least 8 characters.";
    if (/email not confirmed/i.test(m)) return "This account still needs its email confirmed.";
    if (res.status === 0 || (res.status >= 500 && !m)) return "Couldn't reach the server. Check the connection and try again.";
    return m ? String(m).slice(0, 160) : "That didn't work. Try again.";
  }
  C.signIn = function (email, pw) {
    return authCall("token?grant_type=password", { email: email, password: pw }).then(
      function (res) {
        if (res.ok && keep(res.j)) {
          location.reload();
          return null;
        }
        return why(res);
      },
      function () {
        return "Couldn't reach the server. Check the connection and try again.";
      }
    );
  };
  C.signUp = function (email, pw) {
    return authCall("signup", { email: email, password: pw }).then(
      function (res) {
        if (res.ok && keep(res.j)) {
          location.reload();
          return null;
        }
        if (res.ok && res.j && res.j.id && !res.j.access_token) return "Account made. It needs its email confirmed before it can sign in.";
        return why(res);
      },
      function () {
        return "Couldn't reach the server. Check the connection and try again.";
      }
    );
  };
  C.signOut = function () {
    var t = session && session.access_token;
    lset(SK, null);
    session = null;
    var done = function () {
      location.reload();
    };
    if (t) fetch(URL0 + "/auth/v1/logout", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + t } }).then(done, done);
    else done();
  };
  C.skip = function () {
    lset(SKIP, 1);
    C.skipped = true;
    gate(false);
  };
  C.showSignIn = function () {
    lset(SKIP, null);
    C.skipped = false;
    gate(true);
  };
  /* a fresh access token: the one we have if it lasts another minute, else a refreshed one */
  var refreshing = null;
  function token(force) {
    if (!session) return Promise.reject({ code: "not_granted", message: "Not signed in." });
    if (!force && session.expires_at * 1000 - Date.now() > 60000) return Promise.resolve(session.access_token);
    if (!refreshing)
      refreshing = authCall("token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(
        function (res) {
          refreshing = null;
          if (res.ok && keep(res.j)) return session.access_token;
          if (res.status === 400 || res.status === 401) {
            lset(SK, null);
            session = null;
            C.session = null;
            gate(true);
          }
          throw { code: res.status === 400 || res.status === 401 ? "not_granted" : "unavailable", message: "Sign in again." };
        },
        function (e) {
          refreshing = null;
          throw { code: "unavailable", message: "No connection." };
        }
      );
    return refreshing;
  }

  /* ---------- the documents: the same calls the app makes inside Claude ---------- */
  /* a request with a fresh token; refused as signed out (the token ran out early, or the clock is off): renew once, ask again */
  function authed(make) {
    return token()
      .then(make)
      .then(function (r) {
        return r.status === 401 && session ? token(true).then(make) : r;
      });
  }
  function rest(method, query, body, prefer) {
    return authed(function (t) {
      var h = { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" };
      if (prefer) h.Prefer = prefer;
      return fetch(URL0 + "/rest/v1/docs" + (query ? "?" + query : ""), {
        method: method,
        headers: h,
        body: body ? JSON.stringify(body) : undefined
      });
    }).then(
      function (r) {
        if (r.status === 204) return null;
        return r
          .json()
          .catch(function () {
            return null;
          })
          .then(function (j) {
            if (r.ok) return j;
            throw {
              code:
                r.status === 401 || r.status === 403
                  ? "not_granted"
                  : r.status === 413
                    ? "invalid_argument"
                    : r.status === 429
                      ? "resource_exhausted"
                      : r.status >= 500
                        ? "unavailable"
                        : "invalid_argument",
              message: (j && j.message) || "HTTP " + r.status
            };
          });
      },
      function (e) {
        throw e && e.code ? e : { code: "unavailable", message: "No connection." };
      }
    );
  }
  function q(v) {
    return encodeURIComponent(v);
  }
  function parentOf(p) {
    return p.replace(/\/[^/]*$/, "");
  }
  function idOf(p) {
    return p.slice(p.lastIndexOf("/") + 1);
  }
  function clean(p) {
    return String(p)
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/{2,}/g, "/");
  }
  function rid() {
    var a = "abcdefghijkmnpqrstuvwxyz23456789",
      s = "";
    for (var i = 0; i < 20; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function snap(path, data) {
    return {
      id: idOf(path),
      exists: data != null,
      data: function () {
        return data == null ? undefined : JSON.parse(JSON.stringify(data));
      },
      metadata: { fromCache: false, hasPendingWrites: false }
    };
  }
  /* listeners: each polls while the page is visible; a write here tells the listeners on that place at once */
  var subs = [];
  function nudge(path) {
    var par = parentOf(path);
    subs.forEach(function (s) {
      if (s.path === path || s.path === par) s.poll();
    });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible")
      subs.forEach(function (s) {
        s.poll();
      });
  });
  window.addEventListener("online", function () {
    subs.forEach(function (s) {
      s.poll();
    });
  });
  function listen(path, every, fetchFn, deliver, onErr) {
    var s = {
      path: path,
      alive: true,
      busy: false,
      again: false,
      t: null,
      poll: function () {
        if (!s.alive) return;
        if (s.busy) {
          s.again = true;
          return;
        }
        s.busy = true;
        clearTimeout(s.t);
        fetchFn()
          .then(deliver, function (e) {
            if (onErr && !s.errd) {
              s.errd = true;
              onErr(e);
            }
          })
          .then(function () {
            s.busy = false;
            if (s.again) {
              s.again = false;
              s.poll();
            } else s.t = setTimeout(s.poll, document.visibilityState === "hidden" ? every * 4 : every);
          });
      }
    };
    subs.push(s);
    setTimeout(s.poll, 0);
    return function () {
      s.alive = false;
      clearTimeout(s.t);
      subs = subs.filter(function (x) {
        return x !== s;
      });
    };
  }
  function docRef(path) {
    path = clean(path);
    var ref = {
      id: idOf(path),
      path: path,
      get: function () {
        return rest("GET", "select=data&path=eq." + q(path)).then(function (rows) {
          return snap(path, rows && rows[0] ? rows[0].data : null);
        });
      },
      set: function (data) {
        return rest("POST", "on_conflict=path", { path: path, data: data || {} }, "resolution=merge-duplicates,return=minimal").then(
          function () {
            nudge(path);
          }
        );
      },
      update: function (data) {
        return ref.get().then(function (s) {
          if (!s.exists) throw { code: "invalid_argument", message: "No such document." };
          return ref.set(Object.assign(s.data() || {}, data || {}));
        });
      },
      delete: function () {
        return rest("DELETE", "path=eq." + q(path), null, "return=minimal").then(function () {
          nudge(path);
        });
      },
      acquire: function () {
        return Promise.resolve({ acquired: true });
      },
      onSnapshot: function (next, err) {
        var last = undefined;
        return listen(
          path,
          20000,
          function () {
            return rest("GET", "select=data,updated_at&path=eq." + q(path));
          },
          function (rows) {
            var row = rows && rows[0],
              sig = row ? row.updated_at : null;
            if (sig === last) return;
            last = sig;
            next(snap(path, row ? row.data : null));
          },
          err
        );
      },
      collection: function (sub) {
        return colRef(path + "/" + clean(sub));
      }
    };
    return ref;
  }
  function colRef(path, lim) {
    path = clean(path);
    function list() {
      /* what is there (paths and times), then the documents that are new or changed since last time */
      return rest("GET", "select=path,updated_at&parent=eq." + q(path) + "&order=updated_at.asc" + (lim ? "&limit=" + lim : "&limit=2000"));
    }
    function fetchData(paths) {
      var out = [],
        i = 0,
        n = 40;
      function next() {
        if (i >= paths.length) return Promise.resolve(out);
        var part = paths.slice(i, (i += n));
        return rest(
          "GET",
          "select=path,data,updated_at&path=in.(" +
            part
              .map(function (p) {
                return q('"' + p.replace(/"/g, '\\"') + '"');
              })
              .join(",") +
            ")"
        ).then(function (rows) {
          out = out.concat(rows || []);
          return next();
        });
      }
      return next();
    }
    function asSnap(map, changes) {
      var docs = Object.keys(map)
        .sort(function (a, b) {
          return map[a].at < map[b].at ? -1 : 1;
        })
        .map(function (p) {
          return snap(p, map[p].data);
        });
      return {
        docs: docs,
        size: docs.length,
        empty: !docs.length,
        docChanges: function () {
          return changes;
        },
        metadata: { fromCache: false, hasPendingWrites: false }
      };
    }
    var ref = {
      path: path,
      id: idOf(path),
      doc: function (id) {
        return docRef(path + "/" + (id || rid()));
      },
      add: function (data) {
        var d = docRef(path + "/" + rid());
        return d.set(data).then(function () {
          return d;
        });
      },
      where: function () {
        return ref;
      },
      orderBy: function () {
        return ref;
      },
      limit: function (n) {
        return colRef(path, Math.max(1, Math.min(1000, n | 0)));
      },
      get: function () {
        return list()
          .then(function (rows) {
            return fetchData(
              (rows || []).map(function (r) {
                return r.path;
              })
            );
          })
          .then(function (rows) {
            var map = {};
            rows.forEach(function (r) {
              map[r.path] = { at: r.updated_at, data: r.data };
            });
            return asSnap(map, []);
          });
      },
      onSnapshot: function (next, err) {
        var have = {},
          first = true;
        return listen(
          path,
          25000,
          function () {
            return list().then(function (rows) {
              var now = {};
              (rows || []).forEach(function (r) {
                now[r.path] = r.updated_at;
              });
              var changed = Object.keys(now).filter(function (p) {
                return !have[p] || have[p].at !== now[p];
              });
              var gone = Object.keys(have).filter(function (p) {
                return !(p in now);
              });
              if (!first && !changed.length && !gone.length) return null;
              return fetchData(changed).then(function (got) {
                return { got: got, gone: gone };
              });
            });
          },
          function (res) {
            if (!res) return;
            var changes = [];
            res.gone.forEach(function (p) {
              changes.push({ type: "removed", doc: snap(p, have[p].data), oldIndex: -1, newIndex: -1 });
              delete have[p];
            });
            res.got.forEach(function (r) {
              changes.push({ type: have[r.path] ? "modified" : "added", doc: snap(r.path, r.data), oldIndex: -1, newIndex: -1 });
              have[r.path] = { at: r.updated_at, data: r.data };
            });
            first = false;
            next(asSnap(have, changes));
          },
          err
        );
      }
    };
    return ref;
  }
  var DB = { doc: docRef, collection: colRef };

  /* ---------- who is signed in ---------- */
  var USER = session && {
    id: function () {
      return Promise.resolve(session ? session.user.id : null);
    },
    me: function () {
      return Promise.resolve({ id: session ? session.user.id : "", name: session ? (session.user.email || "").split("@")[0] : "" });
    },
    profiles: function (ids) {
      var o = {};
      (ids || []).forEach(function (i) {
        o[i] = { id: i, name: session && i === session.user.id ? (session.user.email || "").split("@")[0] : "" };
      });
      return Promise.resolve(o);
    },
    isOwner: function () {
      return true;
    },
    canEdit: function () {
      return true;
    },
    can: function () {
      return Promise.resolve(true);
    }
  };

  /* ---------- Claude, through the "claude" function ---------- */
  function parseJson(text) {
    var t = String(text || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      return JSON.parse(t);
    } catch (e) {}
    var a = t.search(/[[{]/),
      b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a > -1 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch (e) {}
    }
    throw { code: "transform_error", message: "Claude's answer wasn't in the expected form.", text: t.slice(0, 400) };
  }
  function ask(prompt, opts, whole) {
    var input =
      typeof prompt === "string"
        ? prompt
        : (prompt || [])
            .map(function (m) {
              return (m.role === "assistant" ? "Assistant: " : "") + m.content;
            })
            .join("\n\n");
    return authed(function (t) {
      return fetch(URL0 + "/functions/v1/claude", {
        method: "POST",
        headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input,
          tier: (opts && opts.modelTier) || "default",
          effort: (opts && opts.effort) || undefined,
          stream: (!whole && !!(opts && opts.onText)) || undefined
        }),
        signal: opts && opts.signal
      });
    }).then(
      function (r) {
        /* a server that can send the answer as it is written does so (lines of "data: {...}": t = more text, then done);
         one that cannot answers whole, as before. An answer that breaks off part-way is asked for once more, whole:
         what had arrived is already on the page, and the whole answer completes it. */
        if (r.ok && r.body && /text\/event-stream/.test(r.headers.get("Content-Type") || ""))
          return readStream(r, opts).catch(function (e) {
            if (whole || (e && e.code === "rate_limited") || (opts && opts.signal && opts.signal.aborted))
              throw e && e.code ? e : { code: "unavailable", message: "No connection." };
            return ask(prompt, opts, 1);
          });
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            if (r.ok && typeof j.text === "string") return { text: j.text, truncated: !!j.truncated, model: j.model };
            throw {
              code: j.code || (r.status === 429 ? "rate_limited" : r.status === 401 ? "not_granted" : "unavailable"),
              message: j.error || "Claude didn't answer this time."
            };
          });
      },
      function (e) {
        throw e && e.code ? e : { code: "unavailable", message: "No connection." };
      }
    );
  }
  function readStream(r, opts) {
    var reader = r.body.getReader(),
      dec = new TextDecoder(),
      buf = "",
      text = "",
      end = /** @type {any} */ (null);
    function pump() {
      return reader.read().then(function (x) {
        if (x.done) {
          if (end && end.error) throw { code: end.code || "unavailable", message: end.error, text: text };
          if (!end || !text) throw { code: "unavailable", message: "Claude's answer was cut off.", text: text };
          return { text: text, truncated: !!end.truncated, model: end.model };
        }
        buf += dec.decode(x.value, { stream: true });
        var i,
          delta = "";
        while ((i = buf.indexOf("\n\n")) >= 0) {
          var line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (line.indexOf("data: ") !== 0) continue;
          var d = null;
          try {
            d = JSON.parse(line.slice(6));
          } catch (e) {
            continue;
          }
          if (typeof d.t === "string") delta += d.t;
          else if (d.done || d.error) end = d;
        }
        if (delta) {
          text += delta;
          if (opts && opts.onText) {
            try {
              opts.onText({ text: text, delta: delta });
            } catch (e) {
              if (window.W && window.W.caught) window.W.caught(e, "an answer as it is written");
            }
          }
        }
        return pump();
      });
    }
    return pump();
  }
  var SAMPLE =
    session &&
    Object.assign(
      function (prompt, opts) {
        return ask(prompt, opts);
      },
      {
        json: function (prompt, opts) {
          return ask(prompt, opts).then(function (r) {
            return parseJson(r.text);
          });
        },
        limits: function () {
          return Promise.resolve({ images: false });
        }
      }
    );

  /* signed out, there is no window.claude at all: the app is the phone-only version, exactly as without an account */
  if (session)
    window.claude = {
      use: function (name) {
        return Promise.resolve(name === "db" ? DB : name === "user" ? USER : name === "sample" ? SAMPLE : null);
      }
    };

  /* ---------- the sign-in screen (over the app, the first time and after signing out) ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var gateEl = null,
    mode = "in";
  function gate(show) {
    if (!show) {
      if (gateEl) {
        gateEl.remove();
        gateEl = null;
      }
      return;
    }
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", function () {
        gate(true);
      });
      return;
    }
    if (!gateEl) {
      gateEl = document.createElement("div");
      gateEl.className = "auth-gate";
      gateEl.setAttribute("role", "dialog");
      gateEl.setAttribute("aria-modal", "true");
      gateEl.setAttribute("aria-labelledby", "authT");
      document.body.appendChild(gateEl);
    }
    var off = !navigator.onLine;
    gateEl.innerHTML =
      '<form class="auth-card" novalidate>' +
      '<h2 id="authT">' +
      (mode === "in" ? "Sign in to Waypoint" : "Create your account") +
      "</h2>" +
      '<p class="auth-sub">' +
      (mode === "in"
        ? "Your trips, on every device, with Claude's ideas for anywhere."
        : "Use the email you were invited with, and choose a password.") +
      "</p>" +
      '<div class="auth-seg" role="tablist"><button type="button" role="tab" aria-selected="' +
      (mode === "in") +
      '" data-auth="in">Sign in</button><button type="button" role="tab" aria-selected="' +
      (mode === "up") +
      '" data-auth="up">New account</button></div>' +
      '<label class="auth-f"><span>Email</span><input class="field" id="authEmail" type="email" autocomplete="email" inputmode="email" required></label>' +
      '<label class="auth-f"><span>Password</span><input class="field" id="authPw" type="password" autocomplete="' +
      (mode === "in" ? "current-password" : "new-password") +
      '" minlength="8" required></label>' +
      '<p class="auth-err" role="alert" aria-live="polite"></p>' +
      '<button type="submit" class="btn auth-go"' +
      (off ? " disabled" : "") +
      ">" +
      (mode === "in" ? "Sign in" : "Create account") +
      "</button>" +
      (off ? '<p class="auth-note">You\'re offline. Sign in when you have a connection.</p>' : "") +
      '<button type="button" class="linkish auth-skip" data-auth="skip">Use without an account</button>' +
      '<p class="auth-note">Without an account, trips stay on this phone and ideas are the ones built into the app.</p></form>';
    var em = /** @type {HTMLInputElement} */ (gateEl.querySelector("#authEmail"));
    if (em && !off)
      setTimeout(function () {
        try {
          em.focus();
        } catch (e) {}
      }, 50);
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-auth]") : null;
    if (!b || !gateEl || !gateEl.contains(b)) return;
    var a = b.getAttribute("data-auth");
    if (a === "skip") {
      C.skip();
      if (window.W && window.W.changed) window.W.changed();
      return;
    }
    var keepEmail = (gateEl.querySelector("#authEmail") || {}).value || "";
    mode = a === "up" ? "up" : "in";
    gate(true);
    gateEl.querySelector("#authEmail").value = keepEmail;
  });
  document.addEventListener("submit", function (e) {
    if (!gateEl || !gateEl.contains(e.target)) return;
    e.preventDefault();
    var email = String(gateEl.querySelector("#authEmail").value || "")
        .trim()
        .toLowerCase(),
      pw = String(gateEl.querySelector("#authPw").value || ""),
      err = gateEl.querySelector(".auth-err"),
      go = gateEl.querySelector(".auth-go");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      err.textContent = "Enter your email address.";
      return;
    }
    if (pw.length < (mode === "up" ? 8 : 1)) {
      err.textContent = mode === "up" ? "Choose a password of at least 8 characters." : "Enter your password.";
      return;
    }
    err.textContent = "";
    go.disabled = true;
    go.textContent = mode === "in" ? "Signing in…" : "Creating…";
    (mode === "in" ? C.signIn(email, pw) : C.signUp(email, pw)).then(function (msg) {
      if (!msg) return;
      err.textContent = msg;
      go.disabled = false;
      go.textContent = mode === "in" ? "Sign in" : "Create account";
    });
  });
  if (!session && !C.skipped) gate(true);
})();
