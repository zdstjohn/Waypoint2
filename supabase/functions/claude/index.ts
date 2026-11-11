// Waypoint's door to Claude (Supabase Edge Function "claude"). The installable app sends a question here; this checks
// who is asking (a signed-in, invited person), counts it against their daily limit, and asks Claude with the API key
// that only this function can see (the ANTHROPIC_API_KEY secret). The app never holds the key.
//   POST { prompt: string, tier?: "quick" | "default" | "complex", effort?: "low" | "medium" | "high", stream?: boolean }
//     ->  { text, model, truncated }   (or { error, code })
//   With stream: true the answer comes as it is written, as lines of "data: {...}\n\n":
//     { t: "more text" } any number of times, then { done: true, truncated, model } (or { error, code } if it broke off).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MODELS: Record<string, string> = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-sonnet-5-5" };
const MAX_OUT: Record<string, number> = { quick: 4096, default: 8192, complex: 8192 };
const EFFORTS = ["low", "medium", "high"];
const DAILY = Number(Deno.env.get("DAILY_LIMIT") || "200");
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "https://waypoint-livid-three.vercel.app,https://waypoint-waypoint-4fb2.vercel.app,https://waypoint-git-main-waypoint-4fb2.vercel.app").split(",").map((s) => s.trim());

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ORIGINS.includes(origin) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "Use POST.", code: "method" }, 405, origin);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return reply({ error: "Claude isn't set up yet (no API key on the server).", code: "not_configured" }, 503, origin);

  // who is asking
  const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
  if (whoErr || !who?.user) return reply({ error: "Sign in again.", code: "not_signed_in" }, 401, origin);

  let body: { prompt?: unknown; tier?: unknown; effort?: unknown; stream?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "Bad request.", code: "invalid_argument" }, 400, origin); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const tier = typeof body.tier === "string" && MODELS[body.tier] ? body.tier : "default";
  const effort = typeof body.effort === "string" && EFFORTS.includes(body.effort) ? body.effort : "";
  const stream = body.stream === true;
  if (!prompt || prompt.length > 80000) return reply({ error: "Bad request.", code: "invalid_argument" }, 400, origin);

  // today's limit
  const { data: n, error: nErr } = await admin.rpc("bump_usage", { uid: who.user.id, lim: DAILY });
  if (nErr) return reply({ error: "Couldn't check today's use.", code: "unavailable" }, 503, origin);
  if (n === -1) return reply({ error: `That's today's ${DAILY} questions to Claude. More tomorrow.`, code: "rate_limited" }, 429, origin);

  // ask Claude
  const model = MODELS[tier];
  const ask: Record<string, unknown> = {
    model, max_tokens: MAX_OUT[tier],
    system: "You answer for a family trip-planning app. Reply with the JSON the request asks for and nothing else: no prose, no code fences.",
    messages: [{ role: "user", content: prompt }],
  };
  if (effort) ask.output_config = { effort };   // how much Claude thinks before it writes (left out: the model's own setting)
  if (stream) ask.stream = true;
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(ask),
    });
  } catch {
    return reply({ error: "Claude didn't answer this time.", code: "unavailable" }, 503, origin);
  }
  if (!r.ok) {
    // what Claude's API said (never the key): kept in the function's logs so a failure can be explained
    let type = "", detail = "";
    try { const e = await r.json(); type = String(e?.error?.type || ""); detail = String(e?.error?.message || "").slice(0, 300); } catch { /* not JSON */ }
    console.error(`anthropic ${r.status} ${type} (${model}): ${detail}`);
    const billing = /credit balance|billing|purchase credits/i.test(detail);
    const code = billing || r.status === 401 || r.status === 403 ? "not_configured" : r.status === 429 || r.status === 529 ? "rate_limited" : "unavailable";
    const msg = billing ? "The Claude account behind Waypoint is out of credit. Add credit in the Anthropic Console (Plans & Billing)."
      : r.status === 401 || r.status === 403 ? "The server's Claude key isn't working."
      : code === "rate_limited" ? "Claude is busy. Try again in a minute." : "Claude didn't answer this time.";
    return reply({ error: msg, code, status: r.status, type }, code === "not_configured" ? 503 : 502, origin);
  }
  if (!stream || !r.body) {
    const j = await r.json();
    const text = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return reply({ text, model, truncated: j.stop_reason === "max_tokens" }, 200, origin);
  }

  // the answer as it is written: only the text is passed on, a piece at a time
  const enc = new TextEncoder(), dec = new TextDecoder(), reader = r.body.getReader();
  const out = new ReadableStream<Uint8Array>({
    async start(ctl) {
      const send = (o: unknown) => ctl.enqueue(enc.encode("data: " + JSON.stringify(o) + "\n\n"));
      let buf = "", stop = "", ended = false;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const ev = buf.slice(0, i); buf = buf.slice(i + 2);
            const dl = ev.split("\n").find((l) => l.startsWith("data: ")); if (!dl) continue;
            let d: any; try { d = JSON.parse(dl.slice(6)); } catch { continue; }
            if (d.type === "content_block_delta" && d.delta?.type === "text_delta" && d.delta.text) send({ t: d.delta.text });
            else if (d.type === "message_delta" && d.delta?.stop_reason) stop = d.delta.stop_reason;
            else if (d.type === "error") { console.error(`anthropic stream error (${model}): ${String(d.error?.message || "").slice(0, 300)}`); send({ error: "Claude didn't finish this answer.", code: "unavailable" }); ended = true; }
          }
        }
        if (!ended) send({ done: true, truncated: stop === "max_tokens", model });
      } catch {
        try { send({ error: "Claude didn't finish this answer.", code: "unavailable" }); } catch { /* the reader has gone */ }
      }
      ctl.close();
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
  return new Response(out, { status: 200, headers: { ...cors(origin), "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
});
