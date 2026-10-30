// Token tests run in plain Node (WebCrypto is built in). Compiled on the fly from src/token.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const js = ts.transpileModule(readFileSync(new URL("../src/token.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { sign, verify } = await import("data:text/javascript," + encodeURIComponent(js));

const S = "test-secret";
const exp = Math.floor(Date.now() / 1000) + 60;

test("a valid token verifies", async () => {
  const t = await sign({ room: "jam1", peer: "RSP001", exp }, S);
  assert.deepEqual(await verify(t, S), { room: "jam1", peer: "RSP001", exp });
});
test("wrong secret is rejected", async () => {
  const t = await sign({ room: "jam1", peer: "RSP001", exp }, S);
  assert.equal(await verify(t, "other"), null);
});
test("tampered payload is rejected", async () => {
  const t = await sign({ room: "jam1", peer: "RSP001", exp }, S);
  const forged = (await sign({ room: "jam1", peer: "MALLORY", exp }, "x")).split(".")[0] + "." + t.split(".")[1];
  assert.equal(await verify(forged, S), null);
});
test("expired token is rejected", async () => {
  const t = await sign({ room: "jam1", peer: "RSP001", exp: 1 }, S);
  assert.equal(await verify(t, S), null);
});
test("garbage is rejected", async () => {
  assert.equal(await verify("nope", S), null);
  assert.equal(await verify("a.b", S), null);
});
