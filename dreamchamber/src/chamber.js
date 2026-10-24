// DreamChamber engine: sessions, seats, mute/solo, ask, close + receipts.
// Every event is appended to <dir>/sessions/<id>.jsonl (never rewritten). Closing a session
// writes a receipt with the SHA-256 of that log to <dir>/receipts.jsonl: the provenance chain.
// HALT is checked (fail closed) before opening a session and before every ask.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { appendFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { participants, RITUALS, NEVER_AI } from "./roster.js";
import { claudeComplete } from "./llm.js";

export async function haltClear() {
  const url = process.env.HALT_URL;
  if (!url) return { clear: false, reason: "HALT_URL is not set (treated as halted)" };
  try {
    const body = await (await fetch(`${url.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(10_000) })).text();
    if (body.includes('"halted":false')) return { clear: true };
    return { clear: false, reason: body.includes('"halted":true') ? "HALTED" : "unreadable HALT status (treated as halted)" };
  } catch (e) { return { clear: false, reason: `HALT unreachable (treated as halted): ${e.message}` }; }
}

export class Chamber {
  constructor({ dir = process.env.DREAMCHAMBER_DIR || join(homedir(), "NOIZYBEAST", "dreamchamber"), complete = claudeComplete, halt = haltClear } = {}) {
    this.dir = dir; this.complete = complete; this.halt = halt;
    this.sessions = new Map();
    this.minds = new Map(participants().map((p) => [p.name, p]));
    mkdirSync(join(dir, "sessions"), { recursive: true });
  }

  #log(s, event) {
    const e = { at: new Date().toISOString(), ...event };
    appendFileSync(join(this.dir, "sessions", `${s.id}.jsonl`), JSON.stringify(e) + "\n");
    s.events.push(e);
    return e;
  }
  #get(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`No open session ${id}`);
    if (s.closed) throw new Error(`Session ${id} is closed`);
    return s;
  }
  #agent(name) {
    const n = String(name || "").toUpperCase();
    if (NEVER_AI.has(n)) throw new Error(`${n} is a real person and is never voiced by AI in DreamChamber`);
    if (!this.minds.has(n)) throw new Error(`Unknown agent ${n}. Seats: ${[...this.minds.keys()].join(", ")}`);
    return n;
  }
  #view(s) {
    return { id: s.id, title: s.title, ritual: s.ritual, intent: RITUALS[s.ritual].intent, opened: s.opened, closed: s.closed || null,
      seats: [...s.seats].map((n) => ({ agent: n, seat: this.minds.get(n).seat, model: this.minds.get(n).model,
        muted: s.muted.has(n), solo: s.solo.has(n), active: this.#active(s).includes(n) })),
      turns: s.events.filter((e) => e.type === "answer").length };
  }
  #active(s) {
    const seats = [...s.seats].filter((n) => !s.muted.has(n));
    return s.solo.size ? seats.filter((n) => s.solo.has(n)) : seats;
  }

  rituals() { return Object.entries(RITUALS).map(([name, r]) => ({ ritual: name, ...r })); }
  agents() { return [...this.minds.values()].map(({ name, seat, model, effort, role }) => ({ agent: name, seat, model, effort, role })); }
  list() { return [...this.sessions.values()].map((s) => this.#view(s)); }
  session(id) { const s = this.sessions.get(id); if (!s) throw new Error(`No session ${id}`); return { ...this.#view(s), transcript: s.events }; }

  async open({ ritual = "open", title } = {}) {
    if (!RITUALS[ritual]) throw new Error(`Unknown ritual ${ritual}. Rituals: ${Object.keys(RITUALS).join(", ")}`);
    const h = await this.halt(); if (!h.clear) throw new Error(`Not opened: ${h.reason}`);
    const id = `dc_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${randomBytes(3).toString("hex")}`;
    const s = { id, title: title || RITUALS[ritual].intent, ritual, opened: new Date().toISOString(), closed: null,
      seats: new Set(), muted: new Set(), solo: new Set(), events: [] };
    this.sessions.set(id, s);
    this.#log(s, { type: "open", ritual, title: s.title, by: "RSP_001" });
    for (const a of RITUALS[ritual].agents) if (this.minds.has(a)) { s.seats.add(a); this.#log(s, { type: "bring_in", agent: a }); }
    return this.#view(s);
  }

  bringIn(id, agent) { const s = this.#get(id), a = this.#agent(agent); s.seats.add(a); this.#log(s, { type: "bring_in", agent: a }); return this.#view(s); }
  remove(id, agent) { const s = this.#get(id), a = this.#agent(agent); s.seats.delete(a); s.muted.delete(a); s.solo.delete(a); this.#log(s, { type: "remove", agent: a }); return this.#view(s); }
  mute(id, agent) { const s = this.#get(id), a = this.#seated(s, agent); s.muted.add(a); this.#log(s, { type: "mute", agent: a }); return this.#view(s); }
  unmute(id, agent) { const s = this.#get(id), a = this.#seated(s, agent); s.muted.delete(a); this.#log(s, { type: "unmute", agent: a }); return this.#view(s); }
  solo(id, agent) { const s = this.#get(id), a = this.#seated(s, agent); s.solo.add(a); this.#log(s, { type: "solo", agent: a }); return this.#view(s); }
  unsolo(id, agent) { const s = this.#get(id); if (agent) s.solo.delete(this.#seated(s, agent)); else s.solo.clear(); this.#log(s, { type: "unsolo", agent: agent || "ALL" }); return this.#view(s); }
  #seated(s, agent) { const a = this.#agent(agent); if (!s.seats.has(a)) throw new Error(`${a} is not in the room. bring_in first.`); return a; }

  #transcript(s) {
    return s.events.filter((e) => e.type === "ask" || e.type === "answer").map((e) =>
      e.type === "ask" ? `RSP_001: ${e.prompt}` : `${e.agent}: ${e.text || (e.refused ? "[declined]" : `[no answer: ${e.error}]`)}`).join("\n\n");
  }

  async ask(id, prompt) {
    const s = this.#get(id);
    if (!String(prompt || "").trim()) throw new Error("Empty prompt");
    const h = await this.halt(); if (!h.clear) throw new Error(`Not asked: ${h.reason}`);
    const active = this.#active(s);
    if (!active.length) throw new Error("Nobody active: everyone is muted or removed");
    const before = this.#transcript(s);
    this.#log(s, { type: "ask", prompt, to: active });
    const room = `DreamChamber session "${s.title}" (ritual: ${s.ritual}). In the room: ${[...s.seats].join(", ")}.`;
    const answers = await Promise.all(active.map(async (agent) => {
      const m = this.minds.get(agent);
      const promptText = `${room}\n\n<transcript>\n${before || "(start of session)"}\n</transcript>\n\nRSP_001 now asks the room:\n${prompt}\n\nAnswer as ${agent}.`;
      const r = await this.complete({ model: m.model, effort: m.effort, system: m.system, prompt: promptText });
      return this.#log(s, { type: "answer", agent, model: m.model, ...r });
    }));
    return { session: s.id, asked: active, answers: answers.map(({ agent, text, served_by, fell_back, refused, error }) =>
      ({ agent, text, served_by, ...(fell_back ? { fell_back } : {}), ...(refused ? { refused } : {}), ...(error ? { error } : {}) })) };
  }

  close(id, note = "") {
    const s = this.#get(id);
    this.#log(s, { type: "close", note, by: "RSP_001" });
    s.closed = new Date().toISOString();
    const file = join(this.dir, "sessions", `${s.id}.jsonl`);
    const receipt = { session: s.id, title: s.title, ritual: s.ritual, opened: s.opened, closed: s.closed,
      agents: [...new Set(s.events.filter((e) => e.type === "answer").map((e) => e.agent))],
      turns: s.events.filter((e) => e.type === "ask").length,
      log: file, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") };
    appendFileSync(join(this.dir, "receipts.jsonl"), JSON.stringify(receipt) + "\n");
    return receipt;
  }

  receipts() {
    const f = join(this.dir, "receipts.jsonl");
    return existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  }

  /** Re-hash every closed session log and compare with its receipt. */
  verify() {
    return this.receipts().map((r) => {
      const ok = existsSync(r.log) && createHash("sha256").update(readFileSync(r.log)).digest("hex") === r.sha256;
      return { session: r.session, ok };
    });
  }
}
