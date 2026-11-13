/* A phone with no signal, for the flight-day test (test/suites/flight.js): while the page is offline, whatever would
   have gone to Claude or to a connected service fails the way a request with no network does, and each try is counted
   (window.__netTried). The database's writes fail in the runner (the suite's own __dbOp), where the writes are kept. */
(() => {
  const off = () => navigator.onLine === false;
  window.__netTried = [];
  const down = what => { window.__netTried.push(what); return Promise.reject(new TypeError('Failed to fetch')); };
  const real = window.claude.use;
  window.claude.use = n => real(n).then(x => {
    if (n === 'sample' && x) {
      const w = (...a) => off() ? down('claude') : x(...a);
      Object.assign(w, x); w.json = (...a) => off() ? down('claude') : x.json(...a);
      return w;
    }
    if (n === 'mcp' && x) return Object.assign({}, x, { callTool: (s, tool, ...a) => off() ? down('mcp:' + tool) : x.callTool(s, tool, ...a), listTools: (...a) => off() ? down('mcp:list') : x.listTools(...a) });
    return x;
  });
})();
