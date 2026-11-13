/* Waypoint map-pack worker: fetches a city's street-map pack (JSON parts of base64 or basE91 from the asset store, or one
   file), decodes it off the main thread, and keeps the decoded pack in IndexedDB so the next visit needs no download.
   Messages in:  { id, key, ver, urls: [...], lay }  (parts, joined in order)  or  { id, key, ver, url }  (one file)
   Messages out: { id, hdr, body }  (body: an ArrayBuffer, transferred)  or  { id, error, cached }
   A pack laid out town centre first (lay 2: the first part holds the header and the tiles of the opening screen) is read
   as it arrives, part by part in order, and handed over in pieces so the map can draw its first screen long before the
   rest is in:  { id, part: 1, hdr?, len?, at, add }  (the first has hdr and len, the body's size; `add` is the body's
   bytes from offset `at`)  then  { id, end: 1 }  once the whole pack is read and stored. Older packs: one message, as above.
   The cache entry is keyed by `key` and kept only while `ver` matches (parts have unique asset urls, so a rebuilt pack
   gets a new version on its own). Nothing here is ever deleted except a stale entry being replaced. */
"use strict";
var DB = "waypoint-vt", STORE = "packs", dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(function (ok, no) {
    try {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: "key" }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; r.onblocked = function () { no(new Error("blocked")); };
    } catch (e) { no(e); }
  });
  dbp.then(null, function () { dbp = null; });
  return dbp;
}
function get(key) {
  return db().then(function (d) { return new Promise(function (ok) { try { var t = d.transaction(STORE, "readonly").objectStore(STORE).get(key); t.onsuccess = function () { ok(t.result || null); }; t.onerror = function () { ok(null); }; } catch (e) { ok(null); } }); }, function () { return null; });
}
function put(rec) {
  return db().then(function (d) { return new Promise(function (ok) { try { var t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(rec); t.oncomplete = function () { ok(true); }; t.onerror = function () { ok(false); }; } catch (e) { ok(false); } }); }, function () { return false; });
}
function b64(s) {
  var bin = atob(s), a = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function b91(text, len) {
  /* a whole part's text at once (a part read the old way), `len` bytes */
  var dec = dectab(), out = new Uint8Array(len), v = -1, b = 0, n = 0, p = 0;
  for (var i = 0; i < text.length; i++) {
    var c = dec[text.charCodeAt(i) & 255];
    if (v < 0) v = c;
    else {
      v += c * 91; b |= v << n; n += (v & 8191) > 88 ? 13 : 14;
      do { out[p++] = b & 255; b >>= 8; n -= 8; } while (n > 7);
      v = -1;
    }
  }
  if (v >= 0) out[p++] = (b | (v << n)) & 255;
  return out;
}
function unwrap(u8) {
  /* a pack inside a WebAssembly file's custom section (older packs and the glyph files) -> the bare pack */
  if (u8[0] === 0 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d) {
    var i = 9, leb = function () { var v = 0, sh = 0, c; do { c = u8[i++]; v += (c & 0x7f) * Math.pow(2, sh); sh += 7; } while (c & 0x80); return v; };
    leb(); var nl = leb(); i += nl; u8 = u8.subarray(i);
  }
  return u8;
}
function parse(u8) {
  u8 = unwrap(u8);
  if (new TextDecoder().decode(u8.subarray(0, 6)) !== "WPVT1\n") throw new Error("bad pack");
  var n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(6);
  var hdr = JSON.parse(new TextDecoder().decode(u8.subarray(10, 10 + n)));
  var body = u8.slice(10 + n);   /* its own buffer, so it can be stored and transferred */
  return { hdr: hdr, body: body.buffer };
}
function fetchParts(urls) {
  return Promise.all(urls.map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing part " + u); return r.json(); }); })).then(function (parts) {
    var bufs = parts.map(function (p) { return p.d !== undefined ? b91(p.d, p.n) : b64(p.b64 || ""); }), n = 0;
    bufs.forEach(function (b) { n += b.length; });
    var all = new Uint8Array(n), o = 0;
    bufs.forEach(function (b) { all.set(b, o); o += b.length; });
    return all;
  });
}
/* ---------- parts in basE91 (see tools/pack2json.py), read as they stream in ---------- */
var B91 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~'", DEC = null;
function dectab() {
  if (DEC) return DEC;
  DEC = new Uint8Array(256).fill(255);
  for (var i = 0; i < 91; i++) DEC[B91.charCodeAt(i)] = i;
  return DEC;
}
/* One part's reader: feed it the response's bytes in any pieces; it writes the decoded pack bytes into `st.all` (made
   from the first part's "size") at the offset the part's own facts give. A part is
   {"v":2,...,"at":N,"n":N,"size":N,"d":"<text>"} with "d" last. */
function partReader(st) {
  var head = [], meta = null, at = 0, o = 0, v = -1, b = 0, n = 0, dec = dectab(), done = false;
  return {
    end: function () { return meta ? at + o : 0; },   /* the pack offset decoded up to */
    done: function () { return done; },
    feed: function (u8) {
      var i = 0, h0 = head.length;
      if (!meta) {
        for (; i < u8.length && head.length < 4096; i++) head.push(u8[i]);
        var s = String.fromCharCode.apply(null, head), k = s.indexOf(',"d":"');
        if (k < 0) {
          if (head.length >= 4096) throw new Error("bad part");
          return;
        }
        meta = JSON.parse(s.slice(0, k) + "}");
        if (meta.v !== 2 || meta.enc !== "b91") throw new Error("part is not basE91");
        at = meta.at;
        if (!st.all) st.all = new Uint8Array(meta.size);
        i = k + 6 - h0;
      }
      if (done) return;
      var all = st.all;
      for (var p = at + o, L = u8.length; i < L; i++) {
        var c = dec[u8[i]];
        if (c === 255) {
          if (u8[i] === 34) { done = true; break; }   /* the closing quote */
          throw new Error("bad character in a part");
        }
        if (v < 0) v = c;
        else {
          v += c * 91; b |= v << n; n += (v & 8191) > 88 ? 13 : 14;
          do { all[p++] = b & 255; b >>= 8; n -= 8; } while (n > 7);
          v = -1;
        }
      }
      if (done && v >= 0) { all[p++] = (b | (v << n)) & 255; v = -1; }
      o = p - at;
    }
  };
}
/* a pack laid out town centre first: parts one after the other (the small first one gets the whole connection), each
   read as it streams; `emit(bytes, pack offset, part finished)` is called after every piece so the caller can hand over what is
   complete. Resolves with the whole pack's bytes. */
function streamParts(urls, emit) {
  var st = { all: null }, i = 0;
  function next() {
    if (i >= urls.length) return Promise.resolve(st.all);
    var url = urls[i++], rd = partReader(st);
    function piece(u8) { rd.feed(u8); if (st.all) emit(st.all, rd.end(), rd.done()); }
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("missing part " + url);
      if (!r.body || !r.body.getReader) return r.arrayBuffer().then(function (buf) { piece(new Uint8Array(buf)); });
      var reader = r.body.getReader();
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return;
          piece(x.value);
          return pump();
        });
      })();
    }).then(function () {
      if (!rd.done()) throw new Error("part cut short " + url);
      return next();
    });
  }
  return next();
}
function fetchFile(url) {
  return fetch(url).then(function (r) { if (!r.ok) throw new Error("missing " + url); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); });
}
/* the body's start inside a whole pack: "WPVT1\n", 4 bytes of header length, the header */
function bodyStart(all) { return 10 + new DataView(all.buffer, all.byteOffset, all.byteLength).getUint32(6); }
function streamJob(m) {
  var hdr = null, start = 0, sent = 0;
  return streamParts(m.urls, function (all, end, partDone) {
    if (!hdr) {
      if (end < 10) return;
      start = bodyStart(all);
      if (end < start) return;
      hdr = JSON.parse(new TextDecoder().decode(all.subarray(10, start)));
      postMessage({ id: m.id, part: 1, hdr: hdr, len: all.length - start, at: 0, add: new ArrayBuffer(0) });
      sent = start;
    }
    /* hand over what is new, in pieces of about 48 KB (and the last bit of every part) */
    if (end - sent >= 49152 || (partDone && end > sent)) {
      var add = all.slice(sent, end).buffer;
      postMessage({ id: m.id, part: 1, at: sent - start, add: add }, [add]);
      sent = end;
    }
  }).then(function (all) {
    if (!hdr) throw new Error("bad pack");
    if (sent < all.length) { var add = all.slice(sent).buffer; postMessage({ id: m.id, part: 1, at: sent - start, add: add }, [add]); }
    return put({ key: m.key, ver: m.ver, hdr: hdr, body: all.slice(start).buffer, at: Date.now() }).then(function () {
      postMessage({ id: m.id, end: 1 });
    });
  });
}
onmessage = function (ev) {
  var m = ev.data || {};
  if (m.ping) { postMessage({ pong: 1 }); return; }
  get(m.key).then(function (rec) {
    if (rec && rec.ver === m.ver && rec.body && rec.hdr) { postMessage({ id: m.id, hdr: rec.hdr, body: rec.body, cached: true }, [rec.body]); return; }
    if (m.urls && m.lay === 2) return streamJob(m);
    return (m.urls ? fetchParts(m.urls) : fetchFile(m.url)).then(parse).then(function (p) {
      return put({ key: m.key, ver: m.ver, hdr: p.hdr, body: p.body, at: Date.now() }).then(function () {
        postMessage({ id: m.id, hdr: p.hdr, body: p.body }, [p.body]);
      });
    });
  }).then(null, function (e) { postMessage({ id: m.id, error: String(e && e.message || e) }); });
};
