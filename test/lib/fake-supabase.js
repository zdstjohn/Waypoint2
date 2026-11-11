/* A stand-in for Waypoint's Supabase server, for the tests: sign-up (invited emails only), sign-in, token refresh and
   sign-out (GoTrue), and the documents table (PostgREST) with the same row-level rules as the real one (supabase/:
   data/users/<id>/... only for that person; other paths read by every signed-in person; a row changed only by whoever
   wrote it; and a person writes only their own data, shared trips (shared/...) and photo requests (wanted/...): the
   nightly paths (photos, places, menus, links, maps, fx) are the nightly copy's alone, public.docs_write_ok). Claude's function is not here: the test answers it in the page.
     node test/lib/fake-supabase.js <port> <comma-separated invited emails> */
const http = require('http'), crypto = require('crypto');
const PORT = +process.argv[2] || 8775, INVITED = new Set((process.argv[3] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const KEY = 'pk_test';
const users = {}, tokens = {}, refresh = {}, docs = {};   /* docs: path -> { owner, data, updated_at } */
let clock = 0; const now = () => new Date(Date.now() + clock++).toISOString();
const json = (res, status, body, extra) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }, extra || {})); res.end(body === undefined ? '' : JSON.stringify(body)); };
function session(u) {
  const at = crypto.randomBytes(16).toString('hex'), rt = crypto.randomBytes(16).toString('hex');
  tokens[at] = { uid: u.id, exp: Date.now() + (+process.env.FAKE_TTL || 3600) * 1000 }; refresh[rt] = u.id;
  return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: +process.env.FAKE_TTL || 3600, expires_at: Math.floor(tokens[at].exp / 1000), user: { id: u.id, email: u.email } };
}
function who(req) { const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const s = tokens[t]; return s && s.exp > Date.now() ? s.uid : null; }
const pathOk = (p, uid) => !p.startsWith('data/users/') || p.split('/')[2] === uid;
const writeOk = (p, uid) => p.startsWith('data/users/') ? p.split('/')[2] === uid : (p.startsWith('shared/') || p.startsWith('wanted/'));
function filters(u) {
  const f = []; for (const [k, v] of u.searchParams) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    const m = v.match(/^(eq|in)\.(.*)$/s); if (!m) continue;
    const vals = m[1] === 'eq' ? [m[2]] : (m[2].replace(/^\(|\)$/g, '').match(/"((?:[^"\\]|\\.)*)"|[^,]+/g) || []).map(s => s.startsWith('"') ? s.slice(1, -1).replace(/\\"/g, '"') : s);
    f.push(row => vals.includes(k === 'parent' ? row.path.replace(/\/[^/]*$/, '') : row[k]));
  }
  return f;
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let body = '';
  req.on('data', c => body += c); req.on('end', () => {
    if (req.method === 'OPTIONS') return json(res, 204);
    if (req.headers.apikey !== KEY) return json(res, 401, { message: 'No API key found in request' });
    const b = body ? (() => { try { return JSON.parse(body); } catch (e) { return null; } })() : null;
    if (u.pathname === '/auth/v1/signup') {
      const email = String(b && b.email || '').toLowerCase();
      if (!INVITED.has(email)) return json(res, 500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' });
      if (Object.values(users).some(x => x.email === email)) return json(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      if (String(b.password || '').length < 6) return json(res, 422, { msg: 'Password should be at least 6 characters.' });
      const user = { id: crypto.randomUUID(), email, pw: b.password }; users[user.id] = user; return json(res, 200, session(user));
    }
    if (u.pathname === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        const user = Object.values(users).find(x => x.email === String(b && b.email || '').toLowerCase() && x.pw === b.password);
        return user ? json(res, 200, session(user)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      const uid = refresh[b && b.refresh_token]; if (!uid) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      delete refresh[b.refresh_token]; return json(res, 200, session(users[uid]));
    }
    if (u.pathname === '/auth/v1/logout') { delete tokens[(req.headers.authorization || '').replace(/^Bearer\s+/i, '')]; return json(res, 204); }
    if (u.pathname === '/__state') return json(res, 200, { users: Object.values(users).map(x => x.email), docs: Object.keys(docs).sort(), owners: Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, users[v.owner] && users[v.owner].email])) });
    if (u.pathname === '/__expire') { Object.values(tokens).forEach(t => t.exp = Date.now() - 1); return json(res, 200, {}); }
    if (u.pathname !== '/rest/v1/docs') return json(res, 404, { message: 'not here' });
    const uid = who(req); if (!uid) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
    if (req.method === 'GET') {
      const fs = filters(u); let rows = Object.entries(docs).map(([path, d]) => ({ path, data: d.data, updated_at: d.updated_at, owner: d.owner })).filter(r => pathOk(r.path, uid) && fs.every(f => f(r)));
      rows.sort((a, c) => a.updated_at < c.updated_at ? -1 : 1);
      if (u.searchParams.get('limit')) rows = rows.slice(0, +u.searchParams.get('limit'));
      const sel = (u.searchParams.get('select') || 'path,data,updated_at').split(',');
      return json(res, 200, rows.map(r => Object.fromEntries(sel.map(k => [k, r[k]]))));
    }
    if (req.method === 'POST') {
      const list = Array.isArray(b) ? b : [b];
      for (const r of list) {
        if (!r || typeof r.path !== 'string' || !pathOk(r.path, uid) || !writeOk(r.path, uid)) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "docs"' });
        const cur = docs[r.path]; if (cur && cur.owner !== uid) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy (USING expression) for table "docs"' });
      }
      list.forEach(r => { docs[r.path] = { owner: uid, data: r.data, updated_at: now() }; });
      return json(res, 201);
    }
    if (req.method === 'DELETE') {
      const fs = filters(u); Object.keys(docs).forEach(p => { const r = { path: p }; if (docs[p].owner === uid && pathOk(p, uid) && fs.every(f => f(r))) delete docs[p]; });
      return json(res, 204);
    }
    json(res, 405, {});
  });
}).listen(PORT, '127.0.0.1');
