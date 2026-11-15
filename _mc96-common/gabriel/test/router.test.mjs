// The router sends each request to the right model, and says why.
import { test } from "node:test";
import assert from "node:assert/strict";

for (const k of ["GABRIEL_FAST_MODEL", "GABRIEL_DEFAULT_MODEL", "GABRIEL_HEAVY_MODEL"]) delete process.env[k];
const { decide, route, tierOf, MODELS } = await import("../dist/router.js");

test("the defaults are Anthropic's current models, with no date pinned", () => {
  assert.deepEqual({ ...MODELS }, { FAST: "claude-haiku-5-5", NORM: "claude-sonnet-5-5", HEAVY: "claude-opus-5-5" });
});

test("a short lookup goes FAST, ordinary work goes NORM", () => {
  assert.equal(decide("/status").tier, "FAST");
  assert.equal(decide("how many days until launch?").tier, "FAST");
  assert.equal(decide("Rename the consent table column and update the worker.").tier, "NORM");
});

test("deep work goes HEAVY even when the sentence says quick or fast", () => {
  assert.equal(decide("Quick one: design the architecture for the consent ledger").tier, "HEAVY");
  assert.equal(decide("Be fast, but give me the 10-year strategy").tier, "HEAVY");
  assert.equal(decide("Find the root cause of the failed deploy").tier, "HEAVY");
});

test("a long request is never treated as a quick lookup", () => {
  const long = "quick question. " + "Here is the whole background of the problem. ".repeat(12);
  assert.equal(decide(long).tier, "NORM");
});

test("voice always goes FAST; an explicit tier always wins", () => {
  assert.equal(decide("design the architecture", undefined, true).tier, "FAST");
  assert.equal(decide("/status", "HEAVY").tier, "HEAVY");
  assert.equal(decide("design the architecture", "FAST", false).model, MODELS.FAST);
});

test("every decision carries a plain reason and a lower model to fall back to", () => {
  const heavy = decide("think step by step about the migration plan");
  assert.match(heavy.why, /deep work/);
  assert.equal(heavy.fallback, MODELS.NORM);
  assert.equal(decide("hello there, how is the build?").fallback, MODELS.FAST);
  assert.equal(decide("/status").fallback, undefined, "nothing below FAST");
});

test("route() and tierOf() still work for older callers", () => {
  assert.equal(route("/status"), MODELS.FAST);
  assert.equal(tierOf(MODELS.HEAVY), "HEAVY");
  assert.equal(tierOf("some-unknown-model"), "NORM");
});
