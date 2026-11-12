// NOIZYBOTS core: one command line in, one short plain answer out. Shared by Slack and Discord.
//
//   /noizy brief            what is red, what waits on RSP_001, the one thing to ship
//   /noizy drives           NOIZYTEK drive grades
//   /noizy find <words>     where is a file (the catalog)
//   /noizy run allgreen|scan|party     opens that fixed Warp job on M2Ultra (HALT is checked by the bridge)
//   /noizy help
//
// Rules: only allowlisted user ids get an answer (everyone else gets one fixed refusal, and nothing is called).
// The bot can do nothing the bridge cannot: no shell, no paths, no free-form commands. Tokens come from the env file.

const JOBS = { allgreen: "allgreen", scan: "noizytek-scan", party: "party" };
export const HELP = "NOIZY commands: brief · drives · find <words> · run allgreen | scan | party";

export function allowed(userId, list = process.env.NOIZY_BOT_USERS || "") {
  return list.split(",").map((s) => s.trim()).filter(Boolean).includes(String(userId));
}

export function makeBridge({ url = process.env.NOIZY_BRIDGE_URL || "http://127.0.0.1:9795", key = process.env.NOIZY_BRIDGE_KEY, fetchFn = fetch } = {}) {
  return async (path, body) => {
    if (!key) throw new Error("NOIZY_BRIDGE_KEY is not set in the env file");
    const res = await fetchFn(url.replace(/\/+$/, "") + path, { method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", "X-NOIZY-Key": key }, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 423) throw new Error("HALT is on. M2Ultra is not taking actions.");
    if (!res.ok) throw new Error(data.error || `M2Ultra answered ${res.status}`);
    return data;
  };
}

const clip = (s, n = 1500) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Run one command for one user. Never throws: errors come back as a plain sentence. */
export async function handle(text, userId, bridge, allowList) {
  if (!allowed(userId, allowList)) return "This NOIZY bot answers RSP_001 only.";
  const [cmd = "help", ...rest] = String(text || "").trim().split(/\s+/);
  const arg = rest.join(" ").slice(0, 300);
  try {
    switch (cmd.toLowerCase()) {
      case "brief": {
        const b = await bridge("/brief");
        return clip(`RED: ${b.red.join(" ")}\nWAITING ON YOU: ${b.waiting.join(" · ")}\nSHIP TODAY: ${b.ship}`);
      }
      case "drives": {
        const d = await bridge("/drives");
        if (!d.cards?.length) return "No drive scan yet. Say: run scan";
        return clip(d.cards.map((c) => `${c.grade}: ${c.name || c.disk}${c.grade === "OK" ? "" : " (" + (c.why || []).join("; ") + ")"}`).join("\n"));
      }
      case "find": {
        if (!arg) return "Find what? Example: find TaleSpin narration";
        const r = await bridge("/files/ask", { q: arg });
        const hits = (r.results || []).slice(0, 5);
        return hits.length ? clip(hits.map((h) => `${h.name}: ${h.path}`).join("\n")) : `Nothing found for "${arg}".`;
      }
      case "run": {
        const job = JOBS[(rest[0] || "").toLowerCase()];
        if (!job) return "Run what? allgreen, scan or party.";
        await bridge("/warp", { job });
        return `Started ${rest[0].toLowerCase()} on M2Ultra in Warp.`;
      }
      default: return HELP;
    }
  } catch (e) {
    return clip(`Could not do that: ${e.message}`, 300);
  }
}
