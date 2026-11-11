// Pure helpers for the talk service. No network, no SDK: easy to test.

export type Agent = "GABRIEL" | "LUCY";
export const AGENTS: readonly Agent[] = ["GABRIEL", "LUCY"];

export function agentOf(raw: unknown): Agent | null {
  const a = String(raw ?? "").trim().toUpperCase();
  return (AGENTS as readonly string[]).includes(a) ? (a as Agent) : null;
}

// Same never-to-AI list as services/gabriel-voice (speak.py). Matching text never reaches Claude.
export const MAX_CHARS = 2000;
export const NEVER =
  /\b(consent record|consent token|noizykidz|password|recovery (phrase|code)|seed phrase|private key|vault-(root|ops|family))\b/i;

export type Check = { ok: true } | { ok: false; say: string };

export function checkText(text: string): Check {
  if (!text.trim()) return { ok: false, say: "I didn't catch that. Say it again?" };
  if (text.length > MAX_CHARS) return { ok: false, say: "That was too long for me. Try a shorter version." };
  if (NEVER.test(text)) return { ok: false, say: "That one stays off AI. Let's do it at M2Ultra." };
  return { ok: true };
}

// "Note ..." / "Remember ..." is captured, not sent to Claude (LUCY relays, GABRIEL triages later).
export function noteOf(text: string): string | null {
  const m = /^\s*(note|remember)\b[\s,:.-]*(.+)$/is.exec(text);
  return m ? m[2].trim() : null;
}

// Turn a model reply into something Kate can read aloud: no markdown, no lists, not too long.
export const MAX_SPOKEN = 900;
export function toSpeech(text: string): string {
  let s = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*([-*•]|\d+[.)])\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > MAX_SPOKEN) {
    const cut = s.slice(0, MAX_SPOKEN);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    s = (end > 200 ? cut.slice(0, end + 1) : cut) + " Ask me for more if you want it.";
  }
  return s;
}

// Constant-time compare for the phone key.
export function sameKey(given: string, want: string | undefined): boolean {
  if (!want || want.length < 24) return false; // unset or weak key = locked
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(want);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export type Turn = { role: "user" | "assistant"; content: string };
export const MAX_TURNS = 12;
export function remember(history: Turn[], user: string, reply: string): Turn[] {
  return [...history, { role: "user" as const, content: user }, { role: "assistant" as const, content: reply }].slice(-MAX_TURNS);
}
