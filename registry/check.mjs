// Refuses known-wrong names anywhere in the registry. Run: node registry/check.mjs
import { readFileSync } from "node:fs";
const text = readFileSync(new URL("./noizy_canonical_registry.yaml", import.meta.url), "utf8");
const banned = [
  [/\bALEX WARD\b/i, "false name (Alex P. Graham and J. Warden McKimm are two people)"],
  [/\bGOD(\.local)?\b/, "old machine name; use M2Ultra"],
  [/\bM2ULTRA\b(?!-)/, "machine name is M2Ultra (MACHINE_TOKEN_M2ULTRA style ids aside)"],
  [/\bM2 Ultra\b(?! Mac Studio| 192| GPU)/, "machine name is M2Ultra; 'M2 Ultra' is only the chip"],
  [/NOIZY Empire/i, "use NOIZYWORLD"],
  [/\bNoisy\b/i, "NOIZY with a Z"],
  [/McKim\b/, "McKimm has two M's"],
  [/Alameda\b/, "Alameida, with the I"],
  [/engrpops@/i, "ENGR_KEITH, POPS and AVA are separate agents"],
];
const bad = banned.filter(([re]) => re.test(text.replace(/^#.*$/gm, "")));
for (const [re, why] of bad) console.error(`✗ ${re} — ${why}`);
if (bad.length) process.exit(1);
console.log("✓ registry names clean");
