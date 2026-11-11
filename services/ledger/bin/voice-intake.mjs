#!/usr/bin/env node
// Voice intake: give every original voice recording its fingerprint and its ledger entry.
//
//   node bin/voice-intake.mjs --dir <folder>                       dry run: list takes + fingerprints, write nothing
//   node bin/voice-intake.mjs --dir <folder> --apply --consent <ref> [--genesis]
//                                                                  record new takes in the ledger
//   node bin/voice-intake.mjs --dir <folder> --verify              re-fingerprint and check against the ledger
//
// Options: --catalog RSP_001 (default) · --purpose "GABRIEL source voice" (default) · --owner RSP_001 (default)
//
// Rules:
//   - The recordings are only ever READ. Nothing is moved, renamed, edited, copied or uploaded.
//   - --apply needs HALT clear (unset or unreachable = refused), a consent reference
//     (e.g. self:RSP_001:2026-11-11), and a Genesis Record (or --genesis to write it first).
//   - Only the file name is recorded, never the folder path.
//   - A take already in the ledger (same fingerprint) is never recorded twice.
//   - The ledger is a local hash chain: $NOIZY_LEDGER_DIR/<catalog>.jsonl (default ~/.noizy/ledger).
//     It uses the same entries and checks as services/ledger (makeEntry, verifyChain).
//
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { createReadStream, readFileSync, readdirSync, statSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename, extname, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "ledger.ts"), "utf8");
const L = await import("data:text/javascript," + encodeURIComponent(
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText));

export const AUDIO = new Set([".wav", ".aif", ".aiff", ".flac", ".caf", ".m4a", ".mp3", ".aac", ".ogg", ".opus"]);

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);

const DIR = opt("dir");
const CATALOG = opt("catalog", "RSP_001");
const PURPOSE = opt("purpose", "GABRIEL source voice");
const OWNER = opt("owner", "RSP_001");
const CONSENT = opt("consent");
const LEDGER_DIR = process.env.NOIZY_LEDGER_DIR || join(homedir(), ".noizy", "ledger");
const LEDGER = join(LEDGER_DIR, `${CATALOG}.jsonl`);

const die = (msg, code = 2) => { console.error(`✗ ${msg}`); process.exit(code); };
if (!DIR) die("--dir <folder with the recordings> is required");
if (!/^[A-Za-z0-9_]{2,40}$/.test(CATALOG)) die("--catalog must be a simple name like RSP_001");
if (!existsSync(DIR) || !statSync(DIR).isDirectory()) die(`not a folder: ${DIR}`);

/** Stream-hash a file: big WAVs never load into memory. */
const sha256 = (file) => new Promise((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
});

const readLedger = () => existsSync(LEDGER)
  ? readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

async function haltClear() {
  const url = process.env.HALT_URL;
  if (!url) return "HALT_URL is not set (treated as halted)";
  try {
    const body = await (await fetch(`${url.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(10_000) })).text();
    if (body.includes('"halted":false')) return null;
    return body.includes('"halted":true') ? "HALTED" : "unreadable HALT status (treated as halted)";
  } catch (e) { return `HALT unreachable (treated as halted): ${e.message}`; }
}

// ── Read the takes ──
const files = readdirSync(DIR).filter((f) => AUDIO.has(extname(f).toLowerCase()) && !f.startsWith(".")).sort();
if (!files.length) die(`no recordings found in ${DIR} (looked for ${[...AUDIO].join(" ")})`);
const takes = [];
for (const f of files) {
  const p = join(DIR, f), st = statSync(p);
  takes.push({ file_name: basename(f), bytes: st.size, modified: st.mtime.toISOString(), sha256: await sha256(p) });
}

const chain = readLedger();
const broken = chain.length ? await L.verifyChain(chain) : -1;
if (broken !== -1) die(`the ledger chain is broken at entry ${broken}: stop and investigate before adding anything (${LEDGER})`, 1);
const recorded = new Map(chain.filter((e) => e.kind === "asset").map((e) => [JSON.parse(e.body).sha256, e]));

// ── Verify mode: are the originals unchanged? ──
if (flag("verify")) {
  let bad = 0;
  const byName = new Map([...recorded.values()].map((e) => { const b = JSON.parse(e.body); return [b.file_name, b]; }));
  for (const t of takes) {
    const rec = byName.get(t.file_name);
    const state = !rec ? "not in ledger" : rec.sha256 === t.sha256 ? "unchanged ✓" : "CHANGED ✗";
    if (state.startsWith("CHANGED")) bad++;
    console.log(`${state.padEnd(14)} ${t.file_name}`);
  }
  for (const [name] of byName) if (!takes.some((t) => t.file_name === name)) { bad++; console.log(`MISSING ✗      ${name}`); }
  console.log(bad ? `\n✗ ${bad} recording(s) changed or missing since they were recorded.` : "\n✓ Every recorded original is unchanged.");
  process.exit(bad ? 1 : 0);
}

// ── Report ──
console.log(`Voice intake · catalog ${CATALOG} · ${takes.length} recording(s) · ${flag("apply") ? "APPLY" : "DRY RUN (add --apply to record)"}\n`);
const fresh = takes.filter((t) => !recorded.has(t.sha256));
for (const t of takes) console.log(`${recorded.has(t.sha256) ? "already recorded" : "new             "}  ${t.sha256.slice(0, 16)}…  ${(t.bytes / 1048576).toFixed(1).padStart(7)} MB  ${t.file_name}`);
const dupes = takes.length - new Set(takes.map((t) => t.sha256)).size;
if (dupes) console.log(`\nNote: ${dupes} file(s) are exact copies of another file here; each fingerprint is recorded once.`);

if (!flag("apply")) { console.log(`\nDry run: nothing written. ${fresh.length} new take(s) would be recorded.`); process.exit(0); }

// ── Apply: gates first ──
if (!fresh.length) { console.log("\nNothing new to record."); process.exit(0); }
if (!CONSENT) die("--consent <reference> is required: consent comes first (e.g. self:RSP_001:2026-11-11)");
const halt = await haltClear();
if (halt) die(`refused: ${halt}`, 3);
let head = chain.at(-1) || null;
mkdirSync(LEDGER_DIR, { recursive: true });
const write = (e) => { appendFileSync(LEDGER, JSON.stringify(e) + "\n", { mode: 0o600 }); head = e; };
if (!head) {
  if (!flag("genesis")) die("this catalog has no Genesis Record yet. Re-run with --genesis to write it first (founder = --owner, covenant 75/25).");
  write(await L.makeEntry(CATALOG, null, "genesis", L.genesisBody(CATALOG, OWNER, new Date().toISOString().slice(0, 10))));
  console.log(`\n✓ Genesis Record written for ${CATALOG} (founder ${OWNER}, covenant 75/25, not tradable).`);
}
const seen = new Set();
for (const t of fresh) {
  if (seen.has(t.sha256)) continue; seen.add(t.sha256);
  write(await L.makeEntry(CATALOG, head, "asset", {
    type: "voice_recording", purpose: PURPOSE, voice_owner: OWNER, consent_ref: CONSENT,
    file_name: t.file_name, bytes: t.bytes, file_modified: t.modified, sha256: t.sha256,
    original: true, c2pa: false, audioseal: false, recorded_into_ledger: new Date().toISOString(),
  }));
  console.log(`✓ recorded  seq ${head.seq}  ${t.file_name}`);
}
const final = readLedger();
const ok = (await L.verifyChain(final)) === -1;
console.log(`\n${ok ? "✓" : "✗"} Ledger chain ${ok ? "verifies" : "BROKEN"}: ${final.length} entries · head ${final.at(-1).hash.slice(0, 16)}… · ${LEDGER}`);
console.log("Next: keep the originals untouched; run --verify any time to prove they are unchanged.");
process.exit(ok ? 0 : 1);
