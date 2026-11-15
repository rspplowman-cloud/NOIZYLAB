#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "node:readline";
import { stdin, stdout, argv, env, exit } from "node:process";
import { runTurn, type GabrielTurnResult } from "./gabriel.js";
import { speak, prepareForSpeech, SpeechStream } from "./voice.js";
import { startDaemon } from "./daemon.js";
import { runDoctor, formatChecks, checkReceipts } from "./doctor.js";
import { budget } from "./state.js";
import chalk from "chalk";

const args = argv.slice(2);
const mode = args.includes("--daemon") ? "daemon"
  : args.includes("--doctor") ? "doctor"
  : args.includes("--verify") ? "verify"
  : args.includes("--status") ? "status"
  : "chat";

function preflight(): void {
  if (!env.ANTHROPIC_API_KEY) {
    console.error(
      chalk.red("✗ ANTHROPIC_API_KEY not set. Copy .env.example → .env, fill in, retry."),
    );
    exit(1);
  }
}

function banner(): void {
  const date = new Date().toISOString().slice(0, 10);
  const target = env.GABRIEL_TARGET_DATE ? new Date(env.GABRIEL_TARGET_DATE) : null;
  const days = target && !Number.isNaN(target.getTime()) ? Math.ceil((target.getTime() - Date.now()) / 86400000) : null;
  console.log(chalk.bold.cyan("═══════════════════════════════════════════"));
  console.log(chalk.bold.cyan("  GABRIEL ONLINE — NOIZYWORLD"));
  // A target date that has passed is not shown as "0 days": it is left out.
  console.log(chalk.cyan(days !== null && days >= 0 ? `  ${date} | ${days} days to ${env.GABRIEL_TARGET_LABEL || "next milestone"}` : `  ${date}`));
  console.log(chalk.bold.cyan("═══════════════════════════════════════════"));
  console.log();
}

/** The small grey line under a reply: tier, model, time, cost, and anything that went wrong with the receipt. */
function footer(r: GabrielTurnResult): string {
  const parts = [r.tier, r.model, `${(r.durationMs / 1000).toFixed(1)}s`];
  if (r.costUsd > 0) parts.push(`$${r.costUsd.toFixed(4)}`);
  let line = chalk.dim(`[${parts.join(" · ")}]`);
  if (r.receiptError) line += "\n" + chalk.red(`✗ No receipt for this turn: ${r.receiptError}`);
  return line;
}

async function runStatus(): Promise<void> {
  const result = await runTurn({
    input:
      "Give me the boot greeting: date, days remaining if a target date is set, top critical-path blocker. Under 8 lines.",
    tier: "FAST",
  });
  if (!result.ok) {
    console.error(chalk.red(`✗ ${result.error}`));
    exit(1);
  }
  console.log(result.output);
  console.log("\n" + footer(result));
  await speak(prepareForSpeech(result.output), "gabriel");
}

async function runChat(): Promise<void> {
  banner();
  console.log(chalk.dim("Type your message. Ctrl-D or /exit to quit. /new forgets this conversation. /cost shows today's spend. /doctor checks GABRIEL.\n"));

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const prompt = chalk.bold.green("rsp_001 › ");
  /** The conversation so far. Passed back on every turn so GABRIEL remembers what was just said. */
  let sessionId: string | undefined;
  /** One turn at a time: a line typed while GABRIEL is answering waits its turn. */
  let turn: Promise<void> = Promise.resolve();

  rl.setPrompt(prompt);
  rl.prompt();

  async function handle(input: string): Promise<void> {
    if (input === "/new") {
      sessionId = undefined;
      console.log(chalk.dim("New conversation. GABRIEL has let go of the last one.\n"));
      return;
    }
    if (input === "/cost") {
      const b = budget();
      console.log(chalk.dim(b.cap === null ? `Spent today: $${b.spent.toFixed(2)} (no daily cap).\n` : `Spent today: $${b.spent.toFixed(2)} of $${b.cap.toFixed(2)}.\n`));
      return;
    }
    if (input === "/doctor") {
      console.log(formatChecks(await runDoctor()) + "\n");
      return;
    }
    stdout.write(chalk.bold.magenta("\ngabriel › "));
    // Speak each sentence as it arrives. Set GABRIEL_VOICE=off in env to silence.
    const voice = new SpeechStream("gabriel");
    const result = await runTurn({
      input,
      resume: sessionId,
      onChunk: (text) => {
        stdout.write(text);
        voice.push(text);
      },
    });
    void voice.end();
    if (result.sessionId) sessionId = result.sessionId;
    if (!result.ok) {
      console.log(chalk.red(`\n✗ ${result.error}`));
      void speak(prepareForSpeech(result.error ?? "Something went wrong."), "gabriel");
    }
    console.log("\n\n" + footer(result) + "\n");
  }

  rl.on("line", (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();
    if (input === "/exit" || input === "/quit") {
      rl.close();
      return;
    }
    turn = turn
      .then(() => handle(input))
      .catch((err) => console.log(chalk.red(`\n✗ ${(err as Error).message}\n`)))
      .finally(() => rl.prompt());
  });

  rl.on("close", () => {
    console.log(chalk.dim("\n—gabriel out—"));
    exit(0);
  });
}

async function runDaemon(): Promise<void> {
  banner();
  startDaemon();
  // startDaemon registers SIGTERM/SIGINT handlers; node keeps the event loop
  // alive because the HTTP server is holding a listen handle.
}

// Daemon mode is an intent router: it does not need ANTHROPIC_API_KEY up front.
// The doctor and the receipt check must run with nothing set, to say what is missing.
// Chat and status modes call Claude directly, so they do need the key.
if (mode === "doctor") {
  const checks = await runDoctor();
  console.log(formatChecks(checks));
  exit(checks.some((c) => c.level === "fail") ? 1 : 0);
} else if (mode === "verify") {
  const check = checkReceipts();
  console.log(`${check.level === "ok" ? "OK" : "FAIL"} ${check.name}: ${check.detail}`);
  exit(check.level === "fail" ? 1 : 0);
} else {
  if (mode !== "daemon") preflight();
  if (mode === "status") await runStatus();
  else if (mode === "daemon") await runDaemon();
  else await runChat();
}
