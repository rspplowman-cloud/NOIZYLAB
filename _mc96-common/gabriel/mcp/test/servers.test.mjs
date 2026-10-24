// Starts each agent MCP server over stdio and checks its tools and its safety rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = () => mkdtempSync(join(tmpdir(), "noizy-mcp-"));

async function open(server, env = {}) {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(MCP, server, "index.js")],
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, stderr: "ignore" }));
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const text = r.content[0].text; let json; try { json = JSON.parse(text); } catch { json = text; }
    return { error: !!r.isError, text, json };
  };
  const names = (await client.listTools()).tools.map((t) => t.name);
  return { client, call, names };
}

test("engr-keith-mcp: schema check, endpoint map, architecture, migration plan", async () => {
  const { client, call, names } = await open("engr-keith-mcp");
  try {
    assert.deepEqual(names.sort(), ["engr_keith_architecture", "engr_keith_endpoint_map", "engr_keith_migration_plan",
      "engr_keith_perf_report", "engr_keith_schema_check", "engr_keith_status"]);
    const schema = (await call("engr_keith_schema_check")).json;
    assert.equal(schema.ok, true, JSON.stringify(schema.issues));
    const paths = (await call("engr_keith_endpoint_map")).json.endpoints.map((e) => e.path);
    assert.ok(paths.includes("/status") && paths.includes("/tasks"), paths.join(","));
    const arch = (await call("engr_keith_architecture")).json;
    assert.ok(arch.mcp_servers.some((p) => p.includes("dream-mcp")));
    const plan = (await call("engr_keith_migration_plan")).json;
    assert.ok(plan[0].steps.some((s) => s.includes("RSP_001 approval")));
  } finally { await client.close(); }
});

test("dream-mcp: flags broken covenant, passes aligned, quotes only the canon", async () => {
  const { client, call } = await open("dream-mcp");
  try {
    const bad = (await call("dream_vision_check", { proposal: "Clone the artist voice and split revenue 50/50 forever, irrevocable." })).json;
    assert.equal(bad.aligned, false);
    assert.deepEqual(bad.flags.map((f) => f.invariant).sort(), ["75/25", "consent", "revocation"]);
    const good = (await call("dream_vision_check", { proposal: "Creators keep 75/25 and every voice use needs consent they can revoke." })).json;
    assert.equal(good.aligned, true, JSON.stringify(good.flags));
    const canon = readFileSync(join(MCP, "..", "doctrine", "MISSION_CANON.md"), "utf8");
    for (const l of (await call("dream_elevator_pitch", { count: 3 })).json.lines) assert.ok(canon.includes(l.line));
    const ranked = (await call("dream_prioritize", { items: [{ title: "low", impact: 1, mission: 1, effort: 5 }, { title: "high", impact: 5, mission: 5, effort: 1 }] })).json;
    assert.equal(ranked[0].title, "high");
  } finally { await client.close(); }
});

test("cb01-mcp: env check never prints a value; deploy status lists Workers", async () => {
  const { client, call } = await open("cb01-mcp", { NOIZY_API_KEY: "sk-super-secret-123" });
  try {
    const env = await call("cb01_env_check");
    assert.equal(env.json.result.NOIZY_API_KEY, "set");
    assert.ok(!env.text.includes("sk-super-secret-123"));
    const ws = (await call("cb01_deploy_status")).json.workers.map((w) => w.name);
    assert.ok(ws.includes("noizybkz"), ws.join(","));
    const status = (await call("cb01_status")).json;
    assert.equal(status.halt.clear, false, "HALT_URL unset must count as halted");
    assert.ok((await call("cb01_godaddy_checklist")).json.section.includes("GoDaddy"));
  } finally { await client.close(); }
});

test("shirley-mcp: catches known-bad LiteLLM, staircase indentation and stray */", async () => {
  const root = tmp();
  writeFileSync(join(root, "requirements.txt"), "litellm==1.82.8\nrequests==2.32.0\n");
  writeFileSync(join(root, "stair.js"), Array.from({ length: 20 }, (_, i) => " ".repeat(i) + "const a" + i + " = 1;").join("\n") + "\n");
  writeFileSync(join(root, "stray.ts"), "/** ok */\nexport const x = 1;\n*/\n");
  writeFileSync(join(root, "todo.js"), "// TODO: wire HALT\n");
  const { client, call } = await open("shirley-mcp", { NOIZYLAB_ROOT: root });
  try {
    const deps = (await call("shirley_dep_audit")).json;
    assert.ok(deps.findings.some((f) => f.issue.includes("KNOWN-BAD litellm 1.82.8")));
    const fmt = (await call("shirley_format_check")).json.issues.map((i) => `${i.file}: ${i.issue}`).join("\n");
    assert.match(fmt, /stair\.js: staircase/);
    assert.match(fmt, /stray\.ts: stray/);
    assert.equal((await call("shirley_find_todos")).json.count, 1);
  } finally { await client.close(); }
});

test("family-mcp: never invents POPS quotes; quotes recorded lines; logs wins", async () => {
  const dir = tmp();
  let f = await open("family-mcp", { FAMILY_DIR: dir });
  try {
    const w = (await f.call("family_pops_wisdom")).json;
    assert.match(w.from, /MISSION_CANON/);
    assert.ok(!/^POPS/.test(w.from));
    await f.call("family_celebrate", { win: "GABRIEL back online" });
    assert.match(readFileSync(join(dir, "wins.jsonl"), "utf8"), /GABRIEL back online/);
    assert.equal((await f.call("family_shirl_check", { minutes_since_break: 120, local_hour: 3 })).json.level, "rest now");
  } finally { await f.client.close(); }
  writeFileSync(join(dir, "pops-lines.txt"), "A recorded line.\n");
  f = await open("family-mcp", { FAMILY_DIR: dir });
  try { assert.deepEqual((await f.call("family_pops_wisdom")).json, { from: "POPS (recorded by RSP_001)", line: "A recorded line." }); }
  finally { await f.client.close(); }
});

test("heaven-mcp: read-only, sends the key header, rejects bad ids, never echoes the key", async () => {
  const seen = [];
  const srv = createServer((req, res) => { seen.push({ m: req.method, u: req.url, k: req.headers["x-noizy-key"] });
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, path: req.url })); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  const { client, call, names } = await open("heaven-mcp", { HEAVEN_URL: url, HEAVEN_KEY: "hv-secret-key" });
  try {
    assert.ok(!names.some((n) => /issue|revoke|license|synth|write|post/i.test(n)), names.join(","));
    assert.equal((await call("h17_actors")).json.path, "/api/v1/actors");
    assert.equal(seen.at(-1).k, "hv-secret-key");
    assert.ok(seen.every((s) => s.m === "GET"));
    assert.equal((await call("h17_actor", { actor_id: "../../admin" })).error, true);
    const st = await call("h17_status");
    assert.equal(st.json.key, "set"); assert.equal(st.json.reachable, true);
    assert.ok(!st.text.includes("hv-secret-key"));
  } finally { await client.close(); srv.close(); }
});

test("lucy-mcp: reads GABRIEL's cache, queues without executing", async () => {
  const state = tmp(); mkdirSync(join(state, "cache"));
  writeFileSync(join(state, "cache", "CONV_1.json"), JSON.stringify({ id: "CONV_1", title: "Hive plan", tags: ["noizyhive"], status: "active", started_at: "2026-10-24T20:00:00Z", messages: [{}, {}] }));
  const { client, call } = await open("lucy-mcp", { GABRIEL_STATE_DIR: state });
  try {
    const t = (await call("lucy_memcell_threads", { search: "hive" })).json;
    assert.deepEqual([t[0].id, t[0].messages], ["CONV_1", 2]);
    const q = (await call("lucy_queue_for_gabriel", { request: "Run NOIZYHIVE inhale", priority: "high" })).json;
    assert.equal(q.queued.status, "queued");
    assert.equal((await call("lucy_queue_list")).json.length, 1);
    assert.ok(existsSync(join(state, "queue", "for-gabriel.jsonl")));
  } finally { await client.close(); }
});

test("gabriel-mcp alias starts GABRIEL's server", async () => {
  const { client, names } = await open("gabriel-mcp", { HOME: tmp() });
  try { assert.ok(names.includes("gabriel_speak") && names.includes("gabriel_cache_start")); }
  finally { await client.close(); }
});
