// GABRIEL · Boss — the warrior executor and lead orchestrator.
//
// GABRIEL is the default boss for the NOIZY.AI Discord bot and the Slack
// master identity. Most intents that arrive from the Worker land here first.
// GABRIEL reasons via the Claude Agent SDK when a decision is open-ended;
// for well-defined verbs it dispatches directly (consent check, army task,
// delegation to another boss).

import type { Boss, Intent, BossResult, BossContext, BossName } from "./types.js";
import { callTool, DREAMCHAMBER_MCP } from "./mcp-boss.js";

const NAME = "gabriel" as const;

async function handle(intent: Intent, ctx: BossContext): Promise<BossResult> {
  const corr = intent.correlation_id;

  // 1. Always write the intent to the ledger first.
  const ledger_id = await ctx.appendLedger({
    actor_id: intent.from,
    event_kind: `intent.received.${intent.verb}`,
    subject: intent.target,
    correlation_id: corr,
    payload: {
      boss: NAME,
      verb: intent.verb,
      args: intent.args ?? {},
      source: intent.source,
      priority: intent.priority ?? "normal",
    },
  });

  // 2. Route by verb. Each branch returns a BossResult with a human-readable
  //    ack_message that is safe to post to Discord/Slack verbatim.
  try {
    switch (intent.verb) {
      case "ping":
      case "health": {
        return {
          ok: true,
          correlation_id: corr,
          boss: NAME,
          verb: intent.verb,
          ack_message: "GABRIEL online. Warrior executor standing by.",
          ledger_id,
        };
      }

      case "speak": {
        const text = (intent.args?.text as string) ?? "";
        const agent = (intent.args?.agent as string) ?? "gabriel";
        if (!text) {
          return {
            ok: false,
            correlation_id: corr,
            boss: NAME,
            verb: intent.verb,
            error: "args.text required",
            ledger_id,
          };
        }
        await ctx.speak(text, agent);
        return {
          ok: true,
          correlation_id: corr,
          boss: NAME,
          verb: intent.verb,
          ack_message: `Spoken as ${agent}.`,
          ledger_id,
        };
      }

      case "army.dispatch": {
        const verb = intent.args?.verb as string | undefined;
        const target = intent.args?.target as string | undefined;
        if (!verb || !target) {
          return {
            ok: false,
            correlation_id: corr,
            boss: NAME,
            verb: intent.verb,
            error: "args.verb and args.target required",
            ledger_id,
          };
        }
        const army_task_id = await ctx.dispatchArmy({
          verb,
          target,
          args: (intent.args?.args as Record<string, unknown>) ?? {},
          correlation_id: corr,
        });
        if (!army_task_id) {
          return {
            ok: false,
            correlation_id: corr,
            boss: NAME,
            verb: intent.verb,
            error: "NOIZYARMY orchestrator unreachable",
            ledger_id,
          };
        }
        return {
          ok: true,
          correlation_id: corr,
          boss: NAME,
          verb: intent.verb,
          ack_message: `Dispatched to NOIZYARMY. task_id=${army_task_id}.`,
          army_task_id,
          ledger_id,
        };
      }

      case "bosses": {
        const { listBosses } = await import("./index.js");
        return { ok: true, correlation_id: corr, boss: NAME, verb: intent.verb,
          ack_message: "The bosses GABRIEL can delegate to.", data: { bosses: listBosses() }, ledger_id };
      }

      case "delegate": {
        // Hand a verb to another boss: args = { boss, verb, args? }. That boss ledgers it too.
        const to = intent.args?.boss as BossName | undefined;
        const verb = intent.args?.verb as string | undefined;
        if (!to || !verb || to === NAME) {
          return { ok: false, correlation_id: corr, boss: NAME, verb: intent.verb, ledger_id,
            error: "args.boss (not gabriel) and args.verb required" };
        }
        const { dispatch } = await import("./index.js");
        const result = await dispatch({ ...intent, boss: to, verb, args: (intent.args?.args as Record<string, unknown>) ?? {} });
        return { ...result, ack_message: result.ok ? `GABRIEL → ${to}: ${result.ack_message ?? "done"}` : result.ack_message, data: { delegated_to: to, ...(result.data ?? {}) } };
      }

      case "ask": {
        // Think a question through in DreamChamber (agents have no tools there; nothing executes).
        // args = { prompt, ritual? }. Opens, asks once, closes with a receipt.
        const prompt = intent.args?.prompt as string | undefined;
        if (!prompt) {
          return { ok: false, correlation_id: corr, boss: NAME, verb: intent.verb, error: "args.prompt required", ledger_id };
        }
        const ritual = (intent.args?.ritual as string | undefined) ?? "strategy";
        const session = (await callTool(DREAMCHAMBER_MCP, "dreamchamber_open", { ritual, title: `GABRIEL ask (${corr})` })) as { id: string };
        try {
          const answers = await callTool(DREAMCHAMBER_MCP, "dreamchamber_ask", { session_id: session.id, prompt });
          const receipt = await callTool(DREAMCHAMBER_MCP, "dreamchamber_close", { session_id: session.id, note: `intent ${corr} from ${intent.from}` });
          return { ok: true, correlation_id: corr, boss: NAME, verb: intent.verb,
            ack_message: `DreamChamber (${ritual}) answered.`, data: { answers, receipt }, ledger_id };
        } catch (err) {
          await callTool(DREAMCHAMBER_MCP, "dreamchamber_close", { session_id: session.id, note: "closed after error" }).catch(() => undefined);
          throw err;
        }
      }

      default: {
        // Unknown verb: refuse cleanly so nothing silent happens. Open-ended
        // thinking goes through verb "ask" (DreamChamber); other bosses through "delegate".
        return {
          ok: false,
          correlation_id: corr,
          boss: NAME,
          verb: intent.verb,
          error: `unknown verb for boss=${NAME}: ${intent.verb}. Verbs: ping, health, speak, army.dispatch, bosses, delegate, ask.`,
          ledger_id,
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      correlation_id: corr,
      boss: NAME,
      verb: intent.verb,
      error: (err as Error).message,
      ledger_id,
    };
  }
}

export const gabriel: Boss = {
  name: NAME,
  description: "Warrior executor + lead orchestrator. Default boss for NOIZY.AI bot.",
  handle,
};
