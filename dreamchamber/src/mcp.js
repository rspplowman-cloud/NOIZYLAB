#!/usr/bin/env node
// DreamChamber MCP — the same chamber as the API, as 13 MCP tools.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Chamber } from "./chamber.js";

const chamber = new Chamber();
const S = (props, required = []) => ({ type: "object", properties: props, required });
const sid = { session_id: { type: "string" } }, ag = { agent: { type: "string", description: "GABRIEL, DREAM, ENGR_KEITH, LUCY, SHIRLEY or CB01" } };

const TOOLS = [
  ["dreamchamber_rituals", "The rituals that open the room, and who each one seats.", S({}), () => chamber.rituals()],
  ["dreamchamber_agents", "Every agent who can be seated: seat, model, effort, role.", S({}), () => chamber.agents()],
  ["dreamchamber_open", "Open a session with a ritual (composition, narration, strategy, build, ops, open). Checks HALT first.",
    S({ ritual: { type: "string" }, title: { type: "string" } }), (a) => chamber.open(a)],
  ["dreamchamber_bring_in", "Seat an agent in the room.", S({ ...sid, ...ag }, ["session_id", "agent"]), (a) => chamber.bringIn(a.session_id, a.agent)],
  ["dreamchamber_remove", "Remove an agent from the room.", S({ ...sid, ...ag }, ["session_id", "agent"]), (a) => chamber.remove(a.session_id, a.agent)],
  ["dreamchamber_mute", "Mute a seated agent (stays in the room, does not answer).", S({ ...sid, ...ag }, ["session_id", "agent"]), (a) => chamber.mute(a.session_id, a.agent)],
  ["dreamchamber_unmute", "Unmute a seated agent.", S({ ...sid, ...ag }, ["session_id", "agent"]), (a) => chamber.unmute(a.session_id, a.agent)],
  ["dreamchamber_solo", "Solo an agent: only soloed agents answer.", S({ ...sid, ...ag }, ["session_id", "agent"]), (a) => chamber.solo(a.session_id, a.agent)],
  ["dreamchamber_unsolo", "Clear solo for one agent, or for everyone if no agent is given.", S({ ...sid, ...ag }, ["session_id"]), (a) => chamber.unsolo(a.session_id, a.agent)],
  ["dreamchamber_ask", "Ask the room once; every active agent answers in role, in parallel. Checks HALT first.",
    S({ ...sid, prompt: { type: "string" } }, ["session_id", "prompt"]), (a) => chamber.ask(a.session_id, a.prompt)],
  ["dreamchamber_session", "A session's seats and full transcript.", S(sid, ["session_id"]), (a) => chamber.session(a.session_id)],
  ["dreamchamber_close", "Close a session and write its receipt (SHA-256 of the session log).",
    S({ ...sid, note: { type: "string" } }, ["session_id"]), (a) => chamber.close(a.session_id, a.note)],
  ["dreamchamber_status", "Open sessions, receipts, and a re-check of every receipt's hash.", S({}),
    () => ({ sessions: chamber.list(), receipts: chamber.receipts().length, verify: chamber.verify(), dir: chamber.dir })],
];

const server = new Server({ name: "dreamchamber-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS.map(([name, description, inputSchema]) => ({ name, description, inputSchema })) }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const t = TOOLS.find(([n]) => n === req.params.name);
  if (!t) return { isError: true, content: [{ type: "text", text: `Unknown tool ${req.params.name}` }] };
  try { return { content: [{ type: "text", text: JSON.stringify(await t[3](req.params.arguments || {}), null, 2) }] }; }
  catch (e) { return { isError: true, content: [{ type: "text", text: `${t[0]} failed: ${e.message}` }] }; }
});
await server.connect(new StdioServerTransport());
