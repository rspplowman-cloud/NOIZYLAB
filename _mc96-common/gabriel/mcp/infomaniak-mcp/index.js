#!/usr/bin/env node
// INFOMANIAK MCP — Swiss-hosted open models (Infomaniak AI Tools) for GABRIEL.
// The API is OpenAI-compatible: <base>/models and <base>/chat/completions, Bearer token.
// Infomaniak says data stays in Switzerland and prompts are not stored (company claim).
//
// Rules:
//   - HALT first: every outbound call checks HALT and fails closed.
//   - Content that must never reach an AI (NOIZY-MAIL-AND-IDENTITY.md, Spark rules):
//     consent records, NOIZYKIDZ / children, family, the vault. ask() refuses them.
//   - The token is never echoed. Status reports set/unset only.
//
// Env:
//   INFOMANIAK_TOKEN          API token (Proton Pass, VAULT-OPS). Required.
//   INFOMANIAK_AI_PRODUCT_ID  AI Tools product ID from the Infomaniak manager. Required.
//   INFOMANIAK_AI_BASE_URL    Optional override of https://api.infomaniak.com/2/ai/<id>/openai/v1
//   INFOMANIAK_MODEL          Optional default model (else the first from /models).
//
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { serve, statusOf, isSet, haltClear } from "../lib/noizy-mcp.js";

const base = () => (process.env.INFOMANIAK_AI_BASE_URL ||
  `https://api.infomaniak.com/2/ai/${process.env.INFOMANIAK_AI_PRODUCT_ID}/openai/v1`).replace(/\/+$/, "");

/** Classes of content the caller may send. Anything else is refused. */
const ALLOWED_CLASSES = ["public", "work"];
/** Words that mark content as never-to-AI, whatever class the caller claims. */
const NEVER_TO_AI = /\b(consent record|consent token|noizykidz|child(ren)?'s|minor|parents@|recovery (phrase|code)|password|vault-(root|ops|family)|seed phrase|private key)\b/i;

function configured() {
  const missing = ["INFOMANIAK_TOKEN", "INFOMANIAK_AI_PRODUCT_ID"].filter((k) => !isSet(k));
  if (process.env.INFOMANIAK_AI_BASE_URL) return missing.filter((k) => k !== "INFOMANIAK_AI_PRODUCT_ID");
  return missing;
}

async function api(path, init = {}) {
  const missing = configured();
  if (missing.length) throw new Error(`not configured: set ${missing.join(" and ")} (values live in Proton Pass, VAULT-OPS)`);
  const halt = await haltClear();
  if (!halt.clear) throw new Error(`refused: ${halt.reason}`);
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INFOMANIAK_TOKEN}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Infomaniak ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const tools = [
  {
    name: "infomaniak_status",
    description: "Is the Swiss model provider configured? Reports which settings are set (never their values) and the rules this server enforces.",
    handler: () => statusOf("INFOMANIAK", "Swiss-hosted open models (Infomaniak AI Tools), OpenAI-compatible", tools.map((t) => t.name), {
      configured: configured().length === 0,
      missing: configured(),
      base_url_override: isSet("INFOMANIAK_AI_BASE_URL"),
      default_model: process.env.INFOMANIAK_MODEL || "(first model from /models)",
      rules: ["HALT checked before every call; unset or unreachable = refused",
        `content_class must be one of: ${ALLOWED_CLASSES.join(", ")}`,
        "consent records, NOIZYKIDZ, family and vault material are refused"],
    }),
  },
  {
    name: "infomaniak_models",
    description: "List the models enabled on the Infomaniak AI Tools product.",
    handler: async () => {
      const r = await api("/models");
      return { models: (r.data || []).map((m) => m.id) };
    },
  },
  {
    name: "infomaniak_ask",
    description: "Ask a Swiss-hosted open model. For public or work material only: consent records, NOIZYKIDZ, family and vault material are refused. Checks HALT first.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        content_class: { type: "string", enum: ALLOWED_CLASSES, description: "What kind of material this is. Only public or work is allowed." },
        model: { type: "string", description: "Model ID from infomaniak_models. Optional." },
        system: { type: "string" },
        max_tokens: { type: "integer", minimum: 1, maximum: 8192 },
      },
      required: ["prompt", "content_class"],
    },
    handler: async ({ prompt, content_class, model, system, max_tokens = 1024 }) => {
      if (!ALLOWED_CLASSES.includes(content_class)) throw new Error(`refused: content_class "${content_class}" may not go to an AI`);
      if (NEVER_TO_AI.test(`${system || ""}\n${prompt}`)) throw new Error("refused: this looks like consent, children's, family or vault material, which never goes to an AI");
      let use = model || process.env.INFOMANIAK_MODEL;
      if (!use) use = (await api("/models")).data?.[0]?.id;
      if (!use) throw new Error("no model enabled on the Infomaniak product");
      const r = await api("/chat/completions", {
        method: "POST",
        body: JSON.stringify({ model: use, max_tokens,
          messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }] }),
      });
      return { model: r.model || use, answer: r.choices?.[0]?.message?.content ?? "", usage: r.usage || null,
        hosted: "Infomaniak, Switzerland" };
    },
  },
];

await serve({ name: "infomaniak-mcp", tools });
