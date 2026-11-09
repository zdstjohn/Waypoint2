/* An in-memory stand-in for the artifact database, so saved trips, sharing and bookings can be tested without the real one. */
module.exports = (seed = {}) => {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  return (o, path, body) => {
    if (o === 'get') return store.has(path) ? store.get(path) : null;
    if (o === 'set') { store.set(path, body); return null; }
    if (o === 'delete') { store.delete(path); return null; }
    if (o === 'list') { const n = path.split('/').length + 1; const out = []; for (const [k, v] of store) if (k.startsWith(path + '/') && k.split('/').length === n) out.push({ id: k.split('/').pop(), body: JSON.parse(v) }); return JSON.stringify(out); }
    return null;
  };
};
