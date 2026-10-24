// The one place DreamChamber calls Claude. Same proven pattern as the red-team harness:
// beta messages + server-side refusal fallbacks ("default"), cached system prompt.
// Each ask is ONE single-turn request carrying the room's transcript, so no earlier turn is
// ever edited (Opus 5.5 / Sonnet 5.5 preserved-thinking rules).
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import Anthropic from "@anthropic-ai/sdk";

let client;
export async function claudeComplete({ model, effort, system, prompt }) {
  client ||= new Anthropic();
  try {
    const r = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      output_config: { effort },
      messages: [{ role: "user", content: prompt }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const fellBack = (r.usage?.iterations ?? []).some((e) => e.type === "fallback_message");
    if (r.stop_reason === "refusal") {
      return { text: "", refused: true, category: r.stop_details?.category ?? null, served_by: r.model };
    }
    return { text, served_by: r.model, fell_back: fellBack, stop_reason: r.stop_reason,
      usage: { input: r.usage?.input_tokens, output: r.usage?.output_tokens, cache_read: r.usage?.cache_read_input_tokens } };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { text: "", error: "No valid Claude credentials (set ANTHROPIC_API_KEY or run `ant auth login`)." };
    if (e instanceof Anthropic.RateLimitError) return { text: "", error: "Rate limited. Try again shortly." };
    if (e instanceof Anthropic.APIError) return { text: "", error: `Claude API error ${e.status}: ${e.message}` };
    return { text: "", error: e.message };
  }
}
