// talk: hands-free voice conversation with GABRIEL and LUCY from the iPhone.
// iPhone Shortcut -> POST /talk (phone key) -> HALT -> text check -> Claude -> plain text -> Siri speaks it (Kate).
// Read-only by design: no tools, no writes except short-lived conversation memory and the "note" inbox.
import Anthropic from "@anthropic-ai/sdk";
import { halted } from "./halt";
import { agentOf, checkText, noteOf, remember, sameKey, toSpeech, type Turn } from "./core";
import { SYSTEM } from "./prompts";

export interface Env {
  ANTHROPIC_API_KEY: string; // secret
  TALK_KEY: string; // secret: the iPhone's key (revocable; never the Anthropic key)
  HALT_URL: string;
  MODEL: string;
  EFFORT: string;
  TALK_KV?: KVNamespace; // conversation memory (30 min) + note inbox
}

const say = (text: string, status = 200) =>
  new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

const HISTORY_TTL = 1800; // 30 minutes of conversation memory
const NOTE_TTL = 60 * 60 * 24 * 30; // notes wait 30 days for GABRIEL

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "talk" });

    const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!sameKey(key, env.TALK_KEY)) return say("Not allowed.", 401);

    if (url.pathname === "/notes" && req.method === "GET") {
      if (!env.TALK_KV) return Response.json({ notes: [] });
      const list = await env.TALK_KV.list({ prefix: "note:" });
      const notes = await Promise.all(list.keys.map(async (k) => ({ id: k.name, ...(await env.TALK_KV!.get(k.name, "json")) as object })));
      return Response.json({ notes });
    }
    if (url.pathname !== "/talk" || req.method !== "POST") return say("Not found.", 404);

    let body: { agent?: unknown; text?: unknown; device?: unknown };
    try {
      body = await req.json();
    } catch {
      return say("I didn't get that. Try again.", 400);
    }
    const agent = agentOf(body.agent);
    if (!agent) return say("Ask for GABRIEL or LUCY.", 400);
    const text = String(body.text ?? "");
    const device = String(body.device ?? "iphone").replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "iphone";

    // HALT first, fail closed. Spoken, so RSP_001 hears why.
    if (await halted(env.HALT_URL)) return say("HALT is on, so I'm staying quiet. Clear HALT at M2Ultra to talk.");

    const check = checkText(text);
    if (!check.ok) return say(check.say);

    const note = noteOf(text);
    if (note) {
      if (!env.TALK_KV) return say("I can't save notes yet. My memory isn't set up.");
      await env.TALK_KV.put(`note:${Date.now()}`, JSON.stringify({ agent, device, note, at: new Date().toISOString() }), { expirationTtl: NOTE_TTL });
      return say("Noted. It'll be waiting for GABRIEL at M2Ultra.");
    }

    const memKey = `history:${agent}:${device}`;
    const history: Turn[] = (env.TALK_KV ? await env.TALK_KV.get<Turn[]>(memKey, "json") : null) ?? [];

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
    let reply: string;
    try {
      const res = await client.beta.messages.create({
        model: env.MODEL || "claude-opus-5-5",
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: (env.EFFORT as "low" | "medium" | "high") || "low" },
        system: SYSTEM[agent],
        messages: [...history, { role: "user", content: text }],
      });
      if (res.stop_reason === "refusal") return say("I can't help with that one. Let's pick it up at M2Ultra.");
      reply = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return say("I'm being rate limited. Give me a minute.");
      if (e instanceof Anthropic.AuthenticationError) return say("My Claude key isn't working. Check it at M2Ultra.");
      if (e instanceof Anthropic.APIConnectionError) return say("I can't reach Claude right now. Try again in a moment.");
      return say("Something went wrong on my side. Try again.");
    }

    const spoken = toSpeech(reply) || "I don't have an answer for that.";
    if (env.TALK_KV) await env.TALK_KV.put(memKey, JSON.stringify(remember(history, text, spoken)), { expirationTtl: HISTORY_TTL });
    return say(spoken);
  },
};
