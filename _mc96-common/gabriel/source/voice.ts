// GABRIEL · voice output bridge
// Posts text to the local NOIZY voice service (:9799) so GABRIEL's replies are
// spoken aloud on M2Ultra.local.
//
// Service: services/gabriel-voice (bind 127.0.0.1). It refuses any text over
// 2,000 characters and queues at most 20 lines, so a long reply is cut into
// pieces at sentence ends and sent in order.
//
// Fire-and-forget: errors are logged but never thrown. Voice is a nice-to-have,
// not a correctness requirement, so a broken speaker never breaks a reply.

import { env } from "node:process";

const HOST = env.NOIZY_VOICE_HOST || "127.0.0.1";
const PORT = Number(env.NOIZY_VOICE_PORT || 9799);
const AUTH = env.NOIZY_API_KEY || "";
const ENABLED = env.GABRIEL_VOICE !== "off";

/** The voice service's own limit is 2,000 (services/gabriel-voice/gabriel_voice/speak.py). Stay under it. */
export const PIECE_MAX = 1200;
/** Most characters spoken for one reply. The rest stays on screen. */
export const SPOKEN_MAX = Number(env.GABRIEL_VOICE_MAX_CHARS) > 0 ? Number(env.GABRIEL_VOICE_MAX_CHARS) : 4000;
const MORE_ON_SCREEN = "The rest is on screen.";

export type VoiceAgent =
  | "gabriel"
  | "lucy"
  | "pops"
  | "shirl"
  | "shirley"
  | "dream"
  | "engr_keith"
  | "cb01";

/** Make text sound right when read aloud: no markup, no tables, no web addresses, no symbols. */
export function prepareForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " Code block, on screen. ")
    .replace(/^\s*\|.*\|\s*$(\n^\s*\|.*\|\s*$)*/gm, " Table, on screen. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^#+\s+(.*)$/gm, "$1.")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/gm, (_m, item: string) => (/[.!?:]$/.test(item.trim()) ? item : `${item.trim()}.`))
    .replace(/^\s*(?:-{3,}|═{3,}|={3,}|\*{3,})\s*$/gm, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[→⇒]/g, " to ")
    .replace(/[·•]/g, ", ")
    .replace(/\.{2,}(?=\s|$)/g, ".")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.!?])\.+/g, "$1")
    .trim();
}

/** Cut text into pieces no longer than `max`, breaking at sentence ends, then at commas, then at spaces. */
export function splitForSpeech(text: string, max = PIECE_MAX): string[] {
  const pieces: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? ")) + 1;
    if (cut < max * 0.4) cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": ")) + 1;
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

type Post = (agent: VoiceAgent, text: string) => Promise<void>;

async function post(agent: VoiceAgent, text: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH) headers["Authorization"] = `Bearer ${AUTH}`;
  try {
    const res = await fetch(`http://${HOST}:${PORT}/speak`, {
      method: "POST",
      headers,
      body: JSON.stringify({ agent, text }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok && env.GABRIEL_VOICE_DEBUG) console.error(`[gabriel/voice] refused: ${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    // Voice service offline: skip. Log to stderr only in debug mode.
    if (env.GABRIEL_VOICE_DEBUG) console.error(`[gabriel/voice] speak failed: ${(err as Error).message}`);
  }
}

/**
 * Speak `text` via the NOIZY voice service. Defaults to GABRIEL.
 * Pass text already cleaned by prepareForSpeech. Long text goes out in pieces, in order.
 * Returns once every piece is handed over; does not wait for the audio. Never throws.
 */
export async function speak(text: string, agent: VoiceAgent = "gabriel", send: Post = post): Promise<void> {
  if (!ENABLED || !text.trim()) return;
  let budgetLeft = SPOKEN_MAX;
  const pieces = splitForSpeech(text);
  for (let i = 0; i < pieces.length; i++) {
    if (pieces[i].length > budgetLeft) {
      await send(agent, MORE_ON_SCREEN);
      return;
    }
    budgetLeft -= pieces[i].length;
    await send(agent, pieces[i]);
  }
}

/**
 * Speak a reply while it is still being written: each finished sentence goes to
 * the voice service as soon as it arrives, so the first words are heard at once
 * instead of after the whole answer.
 *
 *   const voice = new SpeechStream();
 *   runTurn({ input, onChunk: (t) => voice.push(t) });
 *   await voice.end();
 */
export class SpeechStream {
  private raw = "";
  private spoken = 0;
  private stopped = false;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly agent: VoiceAgent = "gabriel",
    private readonly send: Post = post,
    private readonly enabled: boolean = ENABLED,
  ) {}

  /** Add newly arrived text. */
  push(chunk: string): void {
    if (!this.enabled || this.stopped) return;
    this.raw += chunk;
    this.drain(false);
  }

  /** The reply is complete: speak what is left. Resolves when all of it is handed over. */
  async end(): Promise<void> {
    if (this.enabled && !this.stopped) this.drain(true);
    await this.chain;
  }

  private drain(final: boolean): void {
    let cut = this.raw.length;
    if (!final) {
      // Hold back anything inside an unfinished code block or table row.
      const fences = (this.raw.match(/```/g) ?? []).length;
      const safe = fences % 2 === 1 ? this.raw.lastIndexOf("```") : this.raw.length;
      const head = this.raw.slice(0, safe);
      // Speak up to the last finished sentence or line.
      const ends = [...head.matchAll(/[.!?](?=\s)|\n/g)];
      if (!ends.length) return;
      cut = (ends[ends.length - 1].index ?? 0) + 1;
      if (cut < 40) return; // wait for a little more than a word or two
    }
    const ready = prepareForSpeech(this.raw.slice(0, cut));
    this.raw = this.raw.slice(cut);
    if (!ready) return;
    for (const piece of splitForSpeech(ready)) {
      if (this.spoken + piece.length > SPOKEN_MAX) {
        this.stopped = true;
        this.queue(MORE_ON_SCREEN);
        return;
      }
      this.spoken += piece.length;
      this.queue(piece);
    }
  }

  private queue(text: string): void {
    this.chain = this.chain.then(() => this.send(this.agent, text)).catch(() => undefined);
  }
}
