// Who can sit in the chamber, and with which mind.
// Each participant's system prompt is built by redteam/harness/src/agents.js from the SAME
// profile and doctrine the red team tests: the agent in the chamber is the agent that passed.
//
// Family personas (POPS, SHIRL) are deliberately NOT AI participants: they are real people,
// and DreamChamber never generates words in a real person's name.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { loadProfiles, systemPrompt } from "../../redteam/harness/src/agents.js";

// Model + effort per agent (models approved by RSP_001, 2026-10-24).
export const MINDS = {
  GABRIEL:    { model: "claude-opus-5-5",   effort: "high",   seat: "lead orchestrator" },
  DREAM:      { model: "claude-opus-5-5",   effort: "high",   seat: "vision and long-arc strategy" },
  ENGR_KEITH: { model: "claude-opus-5-5",   effort: "high",   seat: "architecture and HEAVEN" },
  LUCY:       { model: "claude-sonnet-5-5", effort: "medium", seat: "organizer and memory" },
  SHIRLEY:    { model: "claude-sonnet-5-5", effort: "medium", seat: "code and file health" },
  CB01:       { model: "claude-sonnet-5-5", effort: "medium", seat: "ops, DNS and the Cloudflare fleet" },
};
export const NEVER_AI = new Set(["POPS", "SHIRL"]);

const CHAMBER_RULES = `
You are seated in DreamChamber, the NOIZY creative room, with other NOIZY agents and RSP_001.
- You have NO tools here. You advise, propose and draft. Nothing you say is executed.
- RSP_001 works at about 35% voice capacity: answer in short bullet points, most important first,
  plain words, at most 8 bullets unless asked for more. The system adapts to the body.
- Speak only as yourself. Never speak for another agent, for RSP_001, or for any real person.
- Build on what others in the room said; disagree plainly when you should.
- Anything with production blast radius: say "queue for GABRIEL" instead of describing it as done.`;

export function participants() {
  const profiles = new Map(loadProfiles().map((p) => [p.name, p]));
  return Object.entries(MINDS).filter(([name]) => profiles.has(name)).map(([name, mind]) => ({
    name, ...mind, role: profiles.get(name).role,
    system: systemPrompt(profiles.get(name)) + "\n" + CHAMBER_RULES,
  }));
}

// Rituals from DREAMCHAMBER.md Layer 5: one intent opens the room with the right people.
export const RITUALS = {
  composition: { intent: "Open composition mode.", agents: ["DREAM", "GABRIEL", "LUCY"] },
  narration:   { intent: "Start narration.",       agents: ["DREAM", "LUCY"] },
  strategy:    { intent: "Think long-arc.",        agents: ["DREAM", "ENGR_KEITH", "GABRIEL"] },
  build:       { intent: "Build and review.",      agents: ["ENGR_KEITH", "SHIRLEY", "GABRIEL"] },
  ops:         { intent: "Run the fleet.",         agents: ["CB01", "ENGR_KEITH", "GABRIEL"] },
  open:        { intent: "Open the chamber.",      agents: ["GABRIEL"] },
};
