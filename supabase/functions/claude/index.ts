// Waypoint's door to Claude (Supabase Edge Function "claude"). The installable app sends a question here; this checks
// who is asking (a signed-in, invited person), counts it against their daily limit, and asks Claude with the API key
// that only this function can see (the ANTHROPIC_API_KEY secret). The app never holds the key.
//   POST { prompt: string, tier?: "quick" | "default" | "complex" }  ->  { text, model }   (or { error, code })
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MODELS: Record<string, string> = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-sonnet-5-5" };
const MAX_OUT: Record<string, number> = { quick: 4096, default: 8192, complex: 8192 };
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

  let body: { prompt?: unknown; tier?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "Bad request.", code: "invalid_argument" }, 400, origin); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const tier = typeof body.tier === "string" && MODELS[body.tier] ? body.tier : "default";
  if (!prompt || prompt.length > 80000) return reply({ error: "Bad request.", code: "invalid_argument" }, 400, origin);

  // today's limit
  const { data: n, error: nErr } = await admin.rpc("bump_usage", { uid: who.user.id, lim: DAILY });
  if (nErr) return reply({ error: "Couldn't check today's use.", code: "unavailable" }, 503, origin);
  if (n === -1) return reply({ error: `That's today's ${DAILY} questions to Claude. More tomorrow.`, code: "rate_limited" }, 429, origin);

  // ask Claude
  const model = MODELS[tier];
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: MAX_OUT[tier],
        system: "You answer for a family trip-planning app. Reply with the JSON the request asks for and nothing else: no prose, no code fences.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return reply({ error: "Claude didn't answer this time.", code: "unavailable" }, 503, origin);
  }
  if (!r.ok) {
    const code = r.status === 429 || r.status === 529 ? "rate_limited" : r.status === 401 || r.status === 403 ? "not_configured" : "unavailable";
    const msg = code === "not_configured" ? "The server's Claude key isn't working." : code === "rate_limited" ? "Claude is busy. Try again in a minute." : "Claude didn't answer this time.";
    return reply({ error: msg, code }, r.status === 401 || r.status === 403 ? 503 : 502, origin);
  }
  const j = await r.json();
  const text = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return reply({ text, model, truncated: j.stop_reason === "max_tokens" }, 200, origin);
});
