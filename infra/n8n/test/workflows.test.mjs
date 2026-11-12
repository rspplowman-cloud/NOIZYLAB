// The two n8n workflows: wiring, fail-closed HALT, sealed records never reach the model, no secrets inline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../workflows/${f}`, import.meta.url)));
const wfs = { index: load("noizy-catalog-index.json"), ask: load("noizy-catalog-ask.json"), brief: load("noizy-morning-brief.json") };
const node = (wf, name) => wf.nodes.find((n) => n.name === name);
const run = (wf, name, input, refs = {}) => {
  const $input = { first: () => ({ json: input[0] }), all: () => input.map((json) => ({ json })) };
  const $ = (n) => ({ first: () => ({ json: refs[n][0] }), all: () => refs[n].map((json) => ({ json })) });
  return new Function("$input", "$", node(wf, name).parameters.jsCode)($input, $);
};
const order = (wf, from) => { const seen = []; let n = from; while (n) { seen.push(n); n = wf.connections[n]?.main?.[0]?.[0]?.node; } return seen; };

test("every connection points at a real node, and nothing is active on import", () => {
  for (const wf of Object.values(wfs)) {
    const names = new Set(wf.nodes.map((n) => n.name));
    for (const [a, c] of Object.entries(wf.connections)) {
      assert.ok(names.has(a), a);
      for (const t of c.main.flat()) assert.ok(names.has(t.node), t.node);
    }
    assert.equal(wf.active, false);
  }
});

test("HALT gate comes before any model, Forgejo or Qdrant call", () => {
  for (const [wf, start] of [[wfs.index, "Daily"], [wfs.index, "Forgejo push"], [wfs.ask, "Ask"], [wfs.brief, "Every morning"]]) {
    const path = order(wf, start);
    const gate = path.indexOf("HALT gate");
    assert.ok(gate > 0, `no HALT gate after ${start}`);
    path.slice(0, gate).forEach((n) => assert.ok(!/Embed|Qdrant|catalog|collection|brief|Post/i.test(n), `${n} runs before HALT`));
  }
});

test("HALT gate fails closed", () => {
  const cfg = { HALT_URL: "https://halt.example" };
  assert.throws(() => run(wfs.index, "HALT gate", [{ halted: true }], { Config: [cfg] }));
  assert.throws(() => run(wfs.index, "HALT gate", [{ error: { message: "ENOTFOUND" } }], { Config: [cfg] }));
  assert.throws(() => run(wfs.index, "HALT gate", [{}], { Config: [cfg] }));
  assert.throws(() => run(wfs.index, "HALT gate", [{ halted: false }], { Config: [{ HALT_URL: "https://SET-ME" }] }));
  assert.deepEqual(run(wfs.index, "HALT gate", [{ halted: false }], { Config: [cfg] })[0].json, cfg);
});

test("sealed records and records without text never reach the model", () => {
  const lines = [
    { id: "lib-00000000000000aa", type: "library", name: "Strings", text: "library | Strings", sealed: false },
    { id: "lib-00000000000000bb", type: "library", name: "Consent Records", sealed: true, text: "should never be sent" },
    { id: "file-00000000000000cc", type: "file", name: "x.wav", sealed: false },
    ...Array.from({ length: 70 }, (_, i) => ({ id: `file-${String(i).padStart(16, "0")}`, type: "file", text: `f${i}`, sealed: false })),
  ].map((r) => JSON.stringify(r)).join("\n") + "\nnot json\n";
  const out = run(wfs.index, "Parse and seal", [{ data: lines }]);
  const all = out.flatMap((o) => o.json.batch);
  assert.equal(out.length, 2);                       // 71 records -> batches of 64 + 7
  assert.equal(all.length, 71);
  assert.ok(!all.some((r) => /never be sent|Consent/.test(JSON.stringify(r))));
  assert.ok(all.every((r) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.id)));
  assert.equal(new Set(all.map((r) => r.id)).size, 71);
  assert.ok(all.every((r) => !("text" in r.payload)));
});

test("points pair vectors with records, and a short reply from Ollama is an error", () => {
  const batch = [{ id: "a", payload: { name: "A" } }, { id: "b", payload: { name: "B" } }];
  const pts = run(wfs.index, "Make points", [{ embeddings: [[1], [2]] }], { "Parse and seal": [{ batch }] });
  assert.deepEqual(pts[0].json.points.map((p) => [p.id, p.vector[0]]), [["a", 1], ["b", 2]]);
  assert.throws(() => run(wfs.index, "Make points", [{ embeddings: [[1]] }], { "Parse and seal": [{ batch }] }));
});

test("the ask answer only lists catalog records", () => {
  const out = run(wfs.ask, "Answer", [{ result: [{ score: 0.91234, payload: { type: "library", name: "Strings", path: "/Volumes/EW/Strings", kind: "commercial", vendor: "EastWest", redownload: "EastWest Installation Center" } }] }],
    { Ask: [{ body: { q: "where are my strings" } }] });
  assert.equal(out[0].json.results[0].path, "/Volumes/EW/Strings");
  assert.equal(out[0].json.results[0].score, 0.912);
});

test("webhooks need a key, the collection reset runs once, and no secret is written inline", () => {
  for (const wf of Object.values(wfs)) {
    for (const n of wf.nodes.filter((n) => n.type === "n8n-nodes-base.webhook")) assert.equal(n.parameters.authentication, "headerAuth");
    const text = JSON.stringify(wf);
    assert.ok(!/sk-ant-|ghp_|Bearer [A-Za-z0-9]|token=\w|"password"/.test(text));
    for (const n of wf.nodes) if (n.credentials) for (const c of Object.values(n.credentials)) assert.equal(c.id, "");
  }
  for (const n of wfs.index.nodes.filter((n) => n.name.startsWith("Fresh collection"))) assert.equal(n.executeOnce, true);
});

test("morning brief: posts only to the webhooks RSP_001 set, and nothing when none is set", () => {
  const b = { red: ["Nothing red."], waiting: ["Call the lab"], ship: "Record voice" };
  assert.equal(run(wfs.brief, "Format", [b], { Config: [{ SLACK_WEBHOOK: "", DISCORD_WEBHOOK: "" }] }).length, 0);
  const out = run(wfs.brief, "Format", [b], { Config: [{ SLACK_WEBHOOK: "https://hooks.slack.example/x", DISCORD_WEBHOOK: "https://discord.example/y" }] });
  assert.equal(out.length, 2);
  assert.match(out[0].json.body.text, /SHIP TODAY: Record voice/); assert.match(out[1].json.body.content, /WAITING ON YOU: Call the lab/);
});
