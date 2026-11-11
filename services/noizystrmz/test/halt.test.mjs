// HALT gate tests: it must fail closed in every case but an explicit {"halted":false}.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const js = ts.transpileModule(readFileSync(new URL("../src/halt.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { halted } = await import("data:text/javascript," + encodeURIComponent(js));

const reply = (status, body) => async (url) => {
  reply.last = url;
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
};

test("unset HALT_URL counts as halted", async () => {
  assert.equal(await halted(""), true);
  assert.equal(await halted(undefined), true);
});
test("clear only on an explicit halted:false, read from /status", async () => {
  const f = reply(200, { halted: false });
  assert.equal(await halted("https://halt.example/", f), false);
  assert.equal(reply.last, "https://halt.example/status");
});
test("halted:true is halted", async () => {
  assert.equal(await halted("https://halt.example", reply(200, { halted: true })), true);
});
test("old or wrong field names are halted", async () => {
  assert.equal(await halted("https://halt.example", reply(200, { halt: false })), true);
  assert.equal(await halted("https://halt.example", reply(200, {})), true);
});
test("non-200, garbage and unreachable are halted", async () => {
  assert.equal(await halted("https://halt.example", reply(500, { halted: false })), true);
  assert.equal(await halted("https://halt.example", reply(200, "not json")), true);
  assert.equal(await halted("https://halt.example", async () => { throw new Error("down"); }), true);
});
