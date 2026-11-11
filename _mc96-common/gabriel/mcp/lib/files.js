// NOIZY files: GABRIEL and LUCY ask the file catalog "where is this?" (n8n workflow "NOIZY Catalog: ask").
// Read only. The catalog lives in Forgejo (NOIZY-CATALOG), is embedded by local Ollama and searched in Qdrant,
// all on M2Ultra. Sealed records (consent, kidz, family, vault, voice models) are never in the index.
// The n8n workflow checks HALT itself and fails closed. The key comes from the env file, never from a tool call.

const url = () => process.env.NOIZY_FILES_ASK_URL || "http://127.0.0.1:5678/webhook/noizy-files-ask";

export async function ask(q) {
  const query = String(q || "").trim().slice(0, 500);
  if (!query) throw new Error("ask needs a question, for example: TaleSpin narration takes");
  const key = process.env.NOIZY_ASK_KEY;
  if (!key) throw new Error("NOIZY_ASK_KEY is not set in the env file (the 'NOIZY ask key' from Proton Pass). See scripts/catalog/README.md.");
  let res;
  try {
    res = await fetch(url(), { method: "POST", headers: { "content-type": "application/json", "X-NOIZY-Key": key },
      body: JSON.stringify({ q: query }), signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new Error(`file catalog unreachable at ${url()} (is n8n running, and the ask workflow on?)`);
  }
  if (!res.ok) throw new Error(`file catalog answered ${res.status} (HALT set, wrong key, or workflow off)`);
  const data = await res.json();
  return { query, results: Array.isArray(data.results) ? data.results : [], source: "NOIZY-CATALOG via n8n, local only" };
}

/** MCP tool definitions for an agent (prefix = "gabriel" or "lucy"). */
export function filesTools(prefix) {
  return [{
    name: `${prefix}_files_ask`,
    description: "Ask the NOIZY file catalog where something is (libraries, takes, sessions, videos). Returns the closest catalog records with paths, copies and, for bought libraries, where to download them again. Read only; local only.",
    inputSchema: { type: "object", required: ["q"], properties: { q: { type: "string", description: "What you are looking for, in plain words" } } },
    handler: ({ q }) => ask(q),
  }];
}
