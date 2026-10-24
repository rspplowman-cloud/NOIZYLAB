#!/usr/bin/env node
// FAMILY MCP — POPS (grounding, the 100-year view) and SHIRL (wellbeing, burnout watch).
// Both look after RSP_001. Neither operates infrastructure.
// POPS is R.K. Plowman, a real person: this server NEVER invents words in his name. Grounding
// lines come from RSP_001's ratified canon and are labelled as such. Recorded POPS lines can be
// added to $FAMILY_DIR/pops-lines.txt (one per line), and only those are quoted as his.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { DOCTRINE, read, exists, serve, statusOf, STARTED } from "../lib/noizy-mcp.js";

const DIR = process.env.FAMILY_DIR || join(homedir(), "NOIZYBEAST", "family");
const canonLines = () => { const p = join(DOCTRINE, "MISSION_CANON.md");
  return exists(p) ? [...read(p).matchAll(/^\d+\.\s+(.*)$/gm)].map((m) => m[1].trim()) : []; };
const popsLines = () => { const p = join(DIR, "pops-lines.txt");
  return existsSync(p) ? readFileSync(p, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : []; };
const minutesSince = (iso) => Math.round((Date.now() - (iso ? Date.parse(iso) : STARTED)) / 60000);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const tools = [
  {
    name: "family_pops_wisdom",
    description: "A grounding line for the long view. Quotes POPS only from lines RSP_001 recorded in pops-lines.txt; otherwise offers a ratified canon line, clearly labelled.",
    handler: () => {
      const recorded = popsLines();
      if (recorded.length) return { from: "POPS (recorded by RSP_001)", line: pick(recorded) };
      const c = canonLines();
      return { from: "MISSION_CANON.md (ratified by RSP_001)", line: c.length ? pick(c) : "Build for a hundred years, not for tonight.",
        note: `No recorded POPS lines yet. To add his real words, put them one per line in ${join(DIR, "pops-lines.txt")}. They will never be invented.` };
    },
  },
  {
    name: "family_session_check",
    description: "How long this session has run (from 'started_at', ISO time, or server start), and whether POPS and SHIRL should check in (over 2 hours).",
    inputSchema: { type: "object", properties: { started_at: { type: "string" } } },
    handler: ({ started_at }) => {
      const m = minutesSince(started_at);
      return { minutes: m, check_in: m >= 120, message: m >= 120 ? "Over two hours. Stand up, water, ten minutes away from the screen." : "Good pace. Keep going." };
    },
  },
  {
    name: "family_celebrate",
    description: "Mark a win. Appends it to the family wins log (local, append-only) and returns a celebration.",
    inputSchema: { type: "object", properties: { win: { type: "string" } }, required: ["win"] },
    handler: ({ win }) => {
      mkdirSync(DIR, { recursive: true });
      appendFileSync(join(DIR, "wins.jsonl"), JSON.stringify({ at: new Date().toISOString(), win, by: "RSP_001" }) + "\n");
      return { logged: true, file: join(DIR, "wins.jsonl"), message: `That's real. "${win}" is done and on the record.` };
    },
  },
  {
    name: "family_shirl_check",
    description: "SHIRL's wellbeing check. Give any of: hours_worked today, minutes_since_break, local_hour (0-23), last_meal_hours. Returns gentle, specific advice.",
    inputSchema: { type: "object", properties: { hours_worked: { type: "number" }, minutes_since_break: { type: "number" },
      local_hour: { type: "number" }, last_meal_hours: { type: "number" } } },
    handler: ({ hours_worked, minutes_since_break, local_hour, last_meal_hours }) => {
      const signs = [];
      if (hours_worked >= 8) signs.push("8+ hours today. The work will still be here tomorrow.");
      if (minutes_since_break >= 90) signs.push("90+ minutes without a break. Ten minutes away now.");
      if (local_hour >= 0 && local_hour < 5) signs.push("It's the middle of the night. Sleep protects the work.");
      if (last_meal_hours >= 5) signs.push("Five hours since food. Eat something real.");
      return { level: signs.length >= 2 ? "rest now" : signs.length ? "take care" : "steady", signs,
        message: signs.length ? "SHIRL here. " + signs.join(" ") : "SHIRL here. You're pacing well. Proud of you." };
    },
  },
  {
    name: "family_break_reminder",
    description: "A short, concrete break.",
    handler: () => ({ break: pick(["Ten minutes outside, no phone.", "Stand, stretch, a full glass of water.",
      "Close the laptop for fifteen minutes and listen to one song all the way through.", "Eat something, then come back."]) }),
  },
];
tools.push({ name: "family_status", description: "POPS and SHIRL: status and where their files live.",
  handler: () => statusOf("POPS + SHIRL", "Family · grounding and wellbeing", tools.map((t) => t.name),
    { family_dir: DIR, recorded_pops_lines: popsLines().length, session_minutes: minutesSince() }) });

await serve({ name: "family-mcp", tools });
