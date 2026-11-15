// What GABRIEL says aloud: clean, in pieces the voice service accepts, sentence by sentence.
import { test } from "node:test";
import assert from "node:assert/strict";

delete process.env.GABRIEL_VOICE;
delete process.env.GABRIEL_VOICE_MAX_CHARS;
const { prepareForSpeech, splitForSpeech, speak, SpeechStream, PIECE_MAX, SPOKEN_MAX } = await import("../dist/voice.js");

test("markup, links, tables, code and symbols are not read out", () => {
  const said = prepareForSpeech([
    "## Plan",
    "- **First** rotate the keys",
    "- Then see [the runbook](https://example.com/run) or https://example.com/x",
    "",
    "| a | b |",
    "|---|---|",
    "| 1 | 2 |",
    "",
    "```bash",
    "rm -rf /",
    "```",
    "Done ✅ → ship it…",
  ].join("\n"));
  assert.equal(said, "Plan. First rotate the keys. Then see the runbook or a link. Table, on screen. Code block, on screen. Done to ship it…");
  for (const bad of ["*", "#", "|", "http", "rm -rf", "`", "✅"]) assert.ok(!said.includes(bad), `still says ${bad}`);
});

test("long text is cut at sentence ends into pieces the voice service accepts (limit 2,000)", () => {
  const text = "This is one sentence of the reply. ".repeat(120).trim();
  const pieces = splitForSpeech(text);
  assert.ok(pieces.length > 1);
  for (const p of pieces) {
    assert.ok(p.length <= PIECE_MAX && PIECE_MAX < 2000);
    assert.match(p, /\.$/, "each piece ends on a full sentence");
  }
  assert.equal(pieces.join(" "), text, "nothing lost, nothing repeated");
  assert.deepEqual(splitForSpeech("x".repeat(PIECE_MAX * 2 + 5)).map((p) => p.length), [PIECE_MAX, PIECE_MAX, 5], "no spaces at all still splits");
});

test("speak() sends pieces in order and stops at the spoken limit with 'The rest is on screen.'", async () => {
  const sent = [];
  const send = async (agent, text) => { sent.push([agent, text]); };
  await speak("Short line.", "lucy", send);
  assert.deepEqual(sent, [["lucy", "Short line."]]);
  sent.length = 0;
  await speak("A sentence that is spoken aloud. ".repeat(400), "gabriel", send);
  assert.equal(sent.at(-1)[1], "The rest is on screen.");
  assert.ok(sent.slice(0, -1).reduce((n, [, t]) => n + t.length, 0) <= SPOKEN_MAX);
  sent.length = 0;
  await speak("   ", "gabriel", send);
  assert.equal(sent.length, 0, "nothing to say, nothing sent");
});

test("SpeechStream speaks each sentence as soon as it is complete, before the reply ends", async () => {
  const sent = [];
  const voice = new SpeechStream("gabriel", async (_a, text) => { sent.push(text); }, true);
  voice.push("The keys are rotated and the repo is priv");
  await Promise.resolve();
  assert.equal(sent.length, 0, "no half sentences");
  voice.push("ate. Next comes the purge of the old");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, ["The keys are rotated and the repo is private."], "first sentence is out while the rest is still arriving");
  voice.push(" history.");
  await voice.end();
  assert.deepEqual(sent, ["The keys are rotated and the repo is private.", "Next comes the purge of the old history."]);
});

test("SpeechStream never reads out a code block, even one that arrives in parts", async () => {
  const sent = [];
  const voice = new SpeechStream("gabriel", async (_a, text) => { sent.push(text); }, true);
  for (const chunk of ["Run this on M2Ultra, in Warp.\n```bash\ngit push --mir", "ror --force\n```\nThen tell me when it is done.\n"]) voice.push(chunk);
  await voice.end();
  const all = sent.join(" ");
  assert.ok(!all.includes("git push"), all);
  assert.match(all, /Run this on M2Ultra, in Warp\./);
  assert.match(all, /Code block, on screen\./);
  assert.match(all, /Then tell me when it is done\./);
});

test("a SpeechStream that is switched off sends nothing", async () => {
  const sent = [];
  const voice = new SpeechStream("gabriel", async (_a, t) => { sent.push(t); }, false);
  voice.push("Hello there. This is a full sentence.\n");
  await voice.end();
  assert.equal(sent.length, 0);
});
