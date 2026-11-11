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

test("infomaniak-mcp: HALT first, Bearer token, refuses never-to-AI content, never echoes the token", async () => {
  const seen = []; let halted = false;
  const srv = createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/halt/status") return res.end(JSON.stringify({ halted }));
      seen.push({ m: req.method, u: req.url, auth: req.headers.authorization, body });
      if (req.url === "/ai/models") return res.end(JSON.stringify({ data: [{ id: "swiss-model-a" }, { id: "swiss-model-b" }] }));
      if (req.url === "/ai/chat/completions") {
        const b = JSON.parse(body);
        return res.end(JSON.stringify({ model: b.model, choices: [{ message: { content: `echo: ${b.messages.at(-1).content}` } }], usage: { total_tokens: 7 } }));
      }
      res.statusCode = 404; res.end("{}");
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}`;

  // Not configured: refuses before any network call, says what is missing, no secret shown.
  const bare = await open("infomaniak-mcp", { HALT_URL: `${url}/halt` });
  try {
    const st = (await bare.call("infomaniak_status")).json;
    assert.equal(st.configured, false);
    assert.deepEqual(st.missing, ["INFOMANIAK_TOKEN", "INFOMANIAK_AI_PRODUCT_ID"]);
    const r = await bare.call("infomaniak_models");
    assert.equal(r.error, true); assert.match(r.text, /not configured/);
    assert.equal(seen.length, 0);
  } finally { await bare.client.close(); }

  const { client, call, names } = await open("infomaniak-mcp",
    { HALT_URL: `${url}/halt`, INFOMANIAK_TOKEN: "ik-secret-token", INFOMANIAK_AI_BASE_URL: `${url}/ai/` });
  try {
    assert.deepEqual(names.sort(), ["infomaniak_ask", "infomaniak_models", "infomaniak_status"]);
    const st = await call("infomaniak_status");
    assert.equal(st.json.configured, true); assert.ok(!st.text.includes("ik-secret-token"));

    assert.deepEqual((await call("infomaniak_models")).json.models, ["swiss-model-a", "swiss-model-b"]);
    assert.equal(seen.at(-1).auth, "Bearer ik-secret-token");

    const a = (await call("infomaniak_ask", { prompt: "Summarise the release notes", content_class: "work" })).json;
    assert.equal(a.model, "swiss-model-a"); assert.equal(a.answer, "echo: Summarise the release notes");

    // Never-to-AI material is refused before it leaves the machine.
    const before = seen.length;
    for (const [prompt, cls] of [["Here is the consent record for actor 12", "work"], ["Plan for NOIZYKIDZ parents", "public"],
      ["anything", "family"], ["anything", "vault"]]) {
      const r = await call("infomaniak_ask", { prompt, content_class: cls });
      assert.equal(r.error, true, `${prompt} / ${cls}`); assert.match(r.text, /refused/);
    }
    assert.equal(seen.length, before, "refused prompts must not reach the network");

    // HALT on: nothing goes out.
    halted = true;
    const h = await call("infomaniak_ask", { prompt: "hello", content_class: "public" });
    assert.equal(h.error, true); assert.match(h.text, /HALTED/);
    assert.equal(seen.length, before);
  } finally { await client.close(); srv.close(); }
});

test("heaven-mcp Cloudflare side: read only, token sent never shown, no binding values, rollback is only a plan", async () => {
  const seen = [];
  const ok = (result) => JSON.stringify({ success: true, errors: [], result });
  const srv = createServer((req, res) => {
    seen.push({ m: req.method, u: req.url, auth: req.headers.authorization });
    res.setHeader("content-type", "application/json");
    const u = req.url;
    if (u === "/accounts/acc1/workers/scripts") return res.end(ok([{ id: "heaven", created_on: "2026-04-01", modified_on: "2026-10-29" }, { id: "halt" }]));
    if (u === "/accounts/acc1/workers/scripts/heaven/deployments") return res.end(ok({ deployments: [{ id: "dep2", strategy: "percentage", versions: [{ version_id: "v2", percentage: 100 }], annotations: { "workers/message": "v18.1" } }] }));
    if (u === "/accounts/acc1/workers/scripts/heaven/versions") return res.end(ok({ items: [{ id: "v2", number: 2 }, { id: "v1", number: 1, annotations: { "workers/message": "stable" } }] }));
    if (u === "/accounts/acc1/workers/scripts/heaven/settings") return res.end(ok({ compatibility_date: "2026-04-01", bindings: [{ name: "DB", type: "d1", id: "secret-db-id" }, { name: "API_KEY", type: "secret_text", text: "super-secret" }] }));
    if (u === "/accounts/acc1/d1/database") return res.end(ok([{ name: "agent-memory", uuid: "b5b58cc9" }]));
    if (u === "/accounts/acc1/storage/kv/namespaces") return res.end(ok([{ title: "GABRIEL_KV", id: "f205b56a" }]));
    res.statusCode = 404; res.end(JSON.stringify({ success: false, errors: [{ message: "not found" }] }));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;

  const bare = await open("heaven-mcp", {});
  try { const r = await bare.call("h17_cf_worker"); assert.equal(r.error, true); assert.match(r.text, /CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID/); }
  finally { await bare.client.close(); }

  const { client, call, names } = await open("heaven-mcp", { CLOUDFLARE_API_BASE: base, CLOUDFLARE_ACCOUNT_ID: "acc1", CLOUDFLARE_API_TOKEN: "cf-secret-token" });
  try {
    for (const n of ["h17_cf_worker", "h17_cf_versions", "h17_cf_bindings", "h17_cf_data", "h17_cf_rollback_plan"]) assert.ok(names.includes(n), n);
    const w = (await call("h17_cf_worker")).json;
    assert.equal(w.found, true); assert.deepEqual(w.live_deployment.versions, [{ version_id: "v2", percentage: 100 }]);
    assert.equal(seen.at(-1).auth, "Bearer cf-secret-token");
    assert.deepEqual((await call("h17_cf_versions")).json.map((v) => v.id), ["v2", "v1"]);
    const b = await call("h17_cf_bindings");
    assert.deepEqual(b.json.bindings, [{ name: "DB", type: "d1" }, { name: "API_KEY", type: "secret_text" }]);
    assert.ok(!b.text.includes("super-secret") && !b.text.includes("secret-db-id"), "binding values never shown");
    assert.deepEqual((await call("h17_cf_data")).json.d1, [{ name: "agent-memory", id: "b5b58cc9" }]);
    const plan = (await call("h17_cf_rollback_plan", { version_id: "v1" })).json;
    assert.equal(plan.deploys, false); assert.deepEqual(plan.request.body.versions, [{ version_id: "v1", percentage: 100 }]);
    assert.equal((await call("h17_cf_rollback_plan", { version_id: "not-a-version" })).error, true);
    const st = await call("h17_status");
    assert.equal(st.json.cloudflare.token, "set"); assert.ok(!st.text.includes("cf-secret-token"));
    assert.ok(seen.every((s) => s.m === "GET"), "the Cloudflare side only ever reads");
  } finally { await client.close(); srv.close(); }
});

test("knowledge: GABRIEL and LUCY search, read and map the same NOIZY documents; nothing outside the repo", async () => {
  for (const [server, p] of [["gabriel-mcp", "gabriel"], ["lucy-mcp", "lucy"]]) {
    const { client, call, names } = await open(server);
    try {
      for (const t of ["search", "read", "map"]) assert.ok(names.includes(`${p}_knowledge_${t}`), `${server} ${t}`);
      const hits = (await call(`${p}_knowledge_search`, { query: "HALT fails closed unreachable" })).json;
      assert.ok(hits.length > 0 && hits[0].path.endsWith(".md"), JSON.stringify(hits[0]));
      const map = (await call(`${p}_knowledge_map`)).json;
      assert.ok(map.some((d) => d.path === "CLAUDE.md"));
      assert.ok(!map.some((d) => d.path.includes("node_modules")));
      assert.ok(!map.some((d) => d.path.startsWith("repos/noizylab-io/") && d.path !== "repos/noizylab-io/QUARANTINE.md"), "imported lineage stays out");
      assert.ok(!map.some((d) => /LEGACY-/.test(d.path)), "legacy agent files stay out");
      assert.ok(map.some((d) => d.path === "repos/noizylab-io/QUARANTINE.md"), "quarantine list is searchable");
      assert.ok(map.some((d) => d.path.startsWith("repos/the-old-guard/")), "curated imports are in");
      assert.equal((await call(`${p}_knowledge_read`, { path: "repos/noizylab-io/LEGACY-EKKOS-CLAUDE.md" })).error, true);
      const doc = (await call(`${p}_knowledge_read`, { path: "CLAUDE.md" })).json;
      assert.match(doc.text, /RSP_001/);
      assert.equal((await call(`${p}_knowledge_read`, { path: "../../../../../etc/passwd" })).error, true);
      assert.equal((await call(`${p}_knowledge_read`, { path: "_mc96-common/gabriel/.env.example" })).error, true, "only Markdown documents");
    } finally { await client.close(); }
  }
});
