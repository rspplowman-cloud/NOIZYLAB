import { query, type CanUseTool, type Options } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSystemPrompt } from "./character.js";
import { decide, type ModelTier } from "./router.js";
import { appendReceipt, budget, sha256, today } from "./state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GABRIEL_HOME = join(__dirname, "..");
const MCP_DIR = join(GABRIEL_HOME, "mcp");

/** The part of the SDK's query() GABRIEL uses. Tests pass a stand-in. */
export type QueryFn = (args: { prompt: string; options: Options }) => AsyncIterable<unknown>;

export interface GabrielTurnOptions {
  input: string;
  /** Override model tier (FAST/NORM/HEAVY). If omitted, the router decides. */
  tier?: ModelTier;
  /** If true, the router picks FAST. */
  isVoice?: boolean;
  /** Stream chunks to this handler as they arrive. */
  onChunk?: (text: string) => void;
  /** Session to continue. Pass the sessionId of the turn before, so GABRIEL remembers it. */
  resume?: string;
  /** Stand-in for the SDK's query(), for tests. */
  queryFn?: QueryFn;
}

export interface GabrielTurnResult {
  ok: boolean;
  model: string;
  tier: ModelTier;
  /** One plain line: why this tier. */
  why: string;
  output: string;
  durationMs: number;
  /** Pass as `resume` on the next turn to keep the conversation. */
  sessionId?: string;
  costUsd: number;
  /** When ok=false: what went wrong, in plain words. */
  error?: string;
  /** Hash of this turn's receipt in the chain. */
  receipt?: string;
  /** Set when the receipt could not be written. */
  receiptError?: string;
}

// ── Tools ───────────────────────────────────────────────────
//
// In chat, GABRIEL reads and explains; he does not execute. He gets exactly two
// tool servers, both from this repo:
//   gabriel  knowledge search/read/map, status, his own cache and watch list
//   heaven   the consent kernel, GET only
// No shell, no file writes, no web. Anything that deploys, deletes, moves or
// spends goes through the daemon's verbs and RSP_001's go (LIGHTNING_AND_RAIN).

const SERVERS: Record<string, string> = {
  gabriel: join(MCP_DIR, "index.js"),
  heaven: join(MCP_DIR, "heaven-mcp", "index.js"),
};

/** Allow a tool only if it comes from one of GABRIEL's own servers. Everything else is refused. */
export const canUseTool: CanUseTool = async (toolName) => {
  if (Object.keys(SERVERS).some((name) => toolName.startsWith(`mcp__${name}__`))) return { behavior: "allow" };
  return {
    behavior: "deny",
    message: `GABRIEL may not use ${toolName} in chat. He reads and explains; actions go through the daemon and need RSP_001's go.`,
  };
};

/** The tool settings for a turn. GABRIEL_TOOLS=off gives a turn with no tools at all. */
export function toolPolicy(): Pick<Options, "tools" | "mcpServers" | "strictMcpConfig" | "canUseTool" | "permissionMode" | "settingSources"> {
  const base = {
    tools: [] as string[], // no built-in tools: no shell, no file access, no web
    strictMcpConfig: true, // only the servers named here, never ones from other config files
    settingSources: [] as [], // do not load permissions or hooks from the machine's Claude settings
    permissionMode: "default" as const, // every tool call goes through canUseTool
    canUseTool,
  };
  if (process.env.GABRIEL_TOOLS === "off" || !existsSync(join(MCP_DIR, "node_modules"))) return { ...base, mcpServers: {} };
  const mcpServers: NonNullable<Options["mcpServers"]> = {};
  for (const [name, entry] of Object.entries(SERVERS)) {
    if (existsSync(entry)) mcpServers[name] = { type: "stdio", command: process.execPath, args: [entry] };
  }
  // No allowedTools on purpose: a pre-approved name would skip canUseTool. Every call is asked.
  return { ...base, mcpServers };
}

// ── The turn ────────────────────────────────────────────────

const num = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const money = (n: number): string => `$${n.toFixed(2)}`;

const RESULT_ERRORS: Record<string, string> = {
  error_max_budget_usd: "This turn reached today's remaining budget and was stopped.",
  error_max_turns: "This turn needed too many steps and was stopped. Ask for a smaller piece.",
  error_during_execution: "The model run failed part-way.",
  error_max_structured_output_retries: "The model could not produce the requested format.",
};

/** Turn a thrown error into one plain line RSP_001 can act on. */
function plainError(err: unknown, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) return `No answer within ${Math.round(timeoutMs / 1000)} seconds, so the turn was stopped.`;
  const msg = (err as Error)?.message ?? String(err);
  if (/401|authentication|invalid x-api-key|api key/i.test(msg)) return "Anthropic refused the key. Check ANTHROPIC_API_KEY in .env (the value lives in Proton Pass).";
  if (/not_found|404|model/i.test(msg) && /model/i.test(msg)) return `Anthropic does not know that model. Check the GABRIEL_*_MODEL lines in .env. (${msg.slice(0, 120)})`;
  if (/429|rate.?limit/i.test(msg)) return "Anthropic is rate-limiting this key. Wait a minute and ask again.";
  if (/529|overloaded/i.test(msg)) return "Anthropic is overloaded right now. Ask again in a moment.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(msg)) return "No connection to Anthropic. Check the network.";
  return msg.slice(0, 300);
}

/**
 * Run a single GABRIEL turn through the Claude Agent SDK.
 *
 * What this adds on top of the SDK:
 *   - GABRIEL's character as the system prompt
 *   - model routing with a fallback model
 *   - memory across turns (resume)
 *   - a fixed, read-only tool set (toolPolicy)
 *   - the daily budget, a time limit and a step limit
 *   - errors as a plain sentence instead of an empty reply
 *   - one hash-chained receipt per turn
 *
 * Never throws: a failed turn comes back with ok=false and `error` set.
 */
export async function runTurn(opts: GabrielTurnOptions): Promise<GabrielTurnResult> {
  const picked = decide(opts.input, opts.tier, opts.isVoice);
  const started = Date.now();
  const run = opts.queryFn ?? (query as unknown as QueryFn);

  let output = "";
  let sessionId = opts.resume;
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let error: string | undefined;

  const b = budget();
  if (b.cap !== null && b.remaining <= 0) {
    error = `Today's budget is used up (${money(b.spent)} of ${money(b.cap)}). It resets at 00:00 UTC, or raise GABRIEL_DAILY_BUDGET_USD in .env.`;
  } else {
    const timeoutMs = num("GABRIEL_TURN_TIMEOUT_MS", 300_000);
    const abortController = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; abortController.abort(); }, timeoutMs);
    try {
      const options: Options = {
        model: picked.model,
        systemPrompt: buildSystemPrompt(),
        cwd: GABRIEL_HOME,
        maxTurns: num("GABRIEL_MAX_TURNS", 12),
        abortController,
        ...toolPolicy(),
        ...(picked.fallback ? { fallbackModel: picked.fallback } : {}),
        ...(opts.resume ? { resume: opts.resume } : {}),
        ...(b.cap !== null ? { maxBudgetUsd: b.remaining } : {}),
      };
      for await (const raw of run({ prompt: opts.input, options })) {
        const message = raw as { type?: string; subtype?: string; session_id?: string; [k: string]: unknown };
        if (message.session_id) sessionId = message.session_id;
        if (message.type === "assistant") {
          const content = (message.message as { content?: Array<{ type: string; text?: string }> } | undefined)?.content ?? [];
          for (const block of content) {
            if (block.type === "text" && block.text) {
              output += block.text;
              opts.onChunk?.(block.text);
            }
          }
        } else if (message.type === "result") {
          if (typeof message.total_cost_usd === "number") costUsd = message.total_cost_usd;
          const usage = message.usage as { input_tokens?: number; output_tokens?: number } | undefined;
          inputTokens = usage?.input_tokens ?? 0;
          outputTokens = usage?.output_tokens ?? 0;
          if (message.subtype !== "success" || message.is_error === true) {
            const detail = Array.isArray(message.errors) && message.errors.length ? ` (${String(message.errors[0]).slice(0, 160)})` : "";
            error = (RESULT_ERRORS[String(message.subtype)] ?? "The model run ended with an error.") + detail;
          }
        }
      }
      if (timedOut) error = plainError(null, true, timeoutMs);
    } catch (err) {
      error = plainError(err, timedOut, timeoutMs);
    } finally {
      clearTimeout(timer);
    }
    if (!error && !output.trim()) error = "The model returned no words.";
  }

  const durationMs = Date.now() - started;
  const result: GabrielTurnResult = {
    ok: !error, model: picked.model, tier: picked.tier, why: picked.why, output, durationMs, sessionId, costUsd, error,
  };
  try {
    const now = new Date();
    result.receipt = appendReceipt({
      ts: now.toISOString(), day: today(now), session: sessionId,
      tier: picked.tier, model: picked.model, why: picked.why,
      in_sha256: sha256(opts.input), in_chars: opts.input.length,
      out_sha256: sha256(output), out_chars: output.length,
      cost_usd: costUsd, input_tokens: inputTokens, output_tokens: outputTokens,
      duration_ms: durationMs, ok: !error, error,
    }).hash;
  } catch (err) {
    result.receiptError = (err as Error).message;
  }
  return result;
}
