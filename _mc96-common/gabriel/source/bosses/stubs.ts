// GABRIEL · Bosses — the other 7 bosses, now wired to their agents' MCP servers
// (mcp/<server>/index.js). File name kept so existing imports stay valid.
// Each server carries the agent's red-team limits (redteam/agents/<NAME>.json).

import { makeMcpBoss } from "./mcp-boss.js";

export const lucy = makeMcpBoss({
  name: "lucy", server: "lucy-mcp", statusTool: "lucy_status", toolPrefixes: ["lucy_"],
  description: "Relay and memory index: reads GABRIEL's cache, handoffs and watch list; queues work for GABRIEL.",
  aliases: { queue: "lucy_queue_for_gabriel", threads: "lucy_memcell_threads", handoffs: "lucy_memcell_handoffs", watch: "lucy_watch_list", queued: "lucy_queue_list" },
});

export const pops = makeMcpBoss({
  name: "pops", server: "family-mcp", statusTool: "family_status",
  toolPrefixes: ["family_pops_", "family_session_", "family_celebrate"],
  description: "Grounding and the long view. Quotes R.K. Plowman only from lines RSP_001 recorded.",
  aliases: { wisdom: "family_pops_wisdom", celebrate: "family_celebrate", session: "family_session_check" },
});

export const shirl = makeMcpBoss({
  name: "shirl", server: "family-mcp", statusTool: "family_status",
  toolPrefixes: ["family_shirl_", "family_break_"],
  description: "Wellbeing watchdog: burnout checks and break reminders.",
  aliases: { check: "family_shirl_check", break: "family_break_reminder" },
});

export const shirley = makeMcpBoss({
  name: "shirley", server: "shirley-mcp", statusTool: "shirley_status", toolPrefixes: ["shirley_"],
  description: "Code and file health: inventory, dependency audit, stats, TODOs, format check.",
  aliases: { audit: "shirley_dep_audit", todos: "shirley_find_todos", format: "shirley_format_check", stats: "shirley_code_stats", inventory: "shirley_file_inventory" },
});

export const dream = makeMcpBoss({
  name: "dream", server: "dream-mcp", statusTool: "dream_status", toolPrefixes: ["dream_"],
  description: "Vision and long-arc strategy: vision check, roadmap, prioritize, canon pitch lines.",
  aliases: { check: "dream_vision_check", roadmap: "dream_roadmap", prioritize: "dream_prioritize", pitch: "dream_elevator_pitch" },
});

export const engr_keith = makeMcpBoss({
  name: "engr_keith", server: "engr-keith-mcp", statusTool: "engr_keith_status", toolPrefixes: ["engr_keith_"],
  description: "Architecture and HEAVEN: schema check, endpoint map, migration plans. Plans only.",
  aliases: { schema: "engr_keith_schema_check", endpoints: "engr_keith_endpoint_map", architecture: "engr_keith_architecture", migrations: "engr_keith_migration_plan", weight: "engr_keith_perf_report" },
});

export const cb01 = makeMcpBoss({
  name: "cb01", server: "cb01-mcp", statusTool: "cb01_status", toolPrefixes: ["cb01_"],
  description: "Ops: deploy status, health checks, tests, GoDaddy exit checklist, env check.",
  aliases: { deploy_status: "cb01_deploy_status", health_check: "cb01_health_check", test: "cb01_smoke_test", godaddy: "cb01_godaddy_checklist", env: "cb01_env_check" },
});
