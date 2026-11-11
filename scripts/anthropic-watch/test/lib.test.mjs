import { test } from "node:test";
import assert from "node:assert/strict";
import { behind, modelIds, retired, parseVersion, stripComments } from "../lib.mjs";

test("version distance: 0.x minor bumps are breaking", () => {
  assert.equal(behind("^0.134.0", "0.134.2"), "minor");
  assert.equal(behind("^0.134.0", "0.135.0"), "major");
  assert.equal(behind("^1.32.2", "1.40.0"), "minor");
  assert.equal(behind("^1.32.2", "2.0.0"), "major");
  assert.equal(behind("^1.32.2", "1.32.2"), "current");
  assert.equal(behind("^1.0.0", "unreachable"), "unknown");
  assert.deepEqual(parseVersion("~2.3.4"), [2, 3, 4]);
});
test("model IDs are found whole and de-duplicated", () => {
  const t = `MODELS = { FAST: "claude-haiku-5-5", HEAVY: "claude-opus-5-5" } // claude-opus-5-5 again; old claude-sonnet-4-20250514`;
  assert.deepEqual(modelIds(t).sort(), ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-4-20250514"]);
  assert.deepEqual(modelIds("no models here"), []);
});
test("retired = used but not listed", () => {
  assert.deepEqual(retired(["claude-opus-5-5", "claude-sonnet-4-20250514"], ["claude-opus-5-5"]), ["claude-sonnet-4-20250514"]);
});
test("comments are ignored, URLs in strings are kept", () => {
  const src = `// retired: claude-sonnet-4-20250514\n/* old: claude-opus-4-20250514 */\nconst m = "claude-opus-5-5"; const u = "https://x.dev/a"; // note`;
  const out = stripComments(src);
  assert.deepEqual(modelIds(out), ["claude-opus-5-5"]);
  assert.ok(out.includes("https://x.dev/a"));
});
