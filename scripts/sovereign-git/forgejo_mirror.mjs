#!/usr/bin/env node
// Mirror every NOIZY GitHub repo into Forgejo on M2Ultra, as PRIVATE pull mirrors.
// Forgejo then keeps each copy up to date by itself.
//
//   node forgejo_mirror.mjs                 dry run: shows what it would do
//   node forgejo_mirror.mjs --apply         creates the missing mirrors
//
// Settings come from the environment (load them from a chmod 600 env file, never type a token):
//   FORGEJO_URL   default http://127.0.0.1:3300
//   FORGEJO_TOKEN Forgejo access token (scope: write:repository)
//   FORGEJO_OWNER Forgejo user or org that will own the mirrors (default: NOIZY)
//   GITHUB_TOKEN  read-only GitHub token, needed for private GitHub repos
//   HALT_URL      HALT worker; unset or unreachable = stop
//   REPOS_FILE    default repos.json (list of "owner/name")
import { readFileSync } from "node:fs";
import { halted } from "./lib.mjs";

export async function plan({ repos, owner, base, token, fetchFn = fetch }) {
  const out = [];
  for (const full of repos) {
    const name = full.split("/")[1];
    const r = await fetchFn(`${base}/api/v1/repos/${owner}/${name}`, { headers: { authorization: `token ${token}` } });
    out.push({ full, name, action: r.status === 200 ? "exists" : "create" });
  }
  return out;
}

export async function create({ item, owner, base, token, githubToken, fetchFn = fetch }) {
  const body = {
    clone_addr: `https://github.com/${item.full}.git`,
    repo_name: item.name, repo_owner: owner,
    mirror: true, private: true, service: "github",
    ...(githubToken ? { auth_token: githubToken } : {}),
  };
  const r = await fetchFn(`${base}/api/v1/repos/migrate`, {
    method: "POST",
    headers: { authorization: `token ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.status;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const base = (process.env.FORGEJO_URL || "http://127.0.0.1:3300").replace(/\/+$/, "");
  const owner = process.env.FORGEJO_OWNER || "NOIZY";
  const token = process.env.FORGEJO_TOKEN;
  if (await halted(process.env.HALT_URL)) { console.error("HALT is set or unreachable. Stopping."); process.exit(2); }
  if (!token) { console.error("FORGEJO_TOKEN is not set. Load your env file first."); process.exit(2); }
  const repos = JSON.parse(readFileSync(process.env.REPOS_FILE || new URL("./repos.json", import.meta.url), "utf8"));
  const items = await plan({ repos, owner, base, token });
  for (const i of items) console.log(`${i.action.padEnd(7)} ${i.full} -> ${owner}/${i.name} (private mirror)`);
  if (!apply) { console.log("\nDry run. Add --apply to create the missing mirrors."); return; }
  for (const i of items.filter((x) => x.action === "create")) {
    const s = await create({ item: i, owner, base, token, githubToken: process.env.GITHUB_TOKEN });
    console.log(`${s === 201 ? "created" : `failed (${s})`} ${owner}/${i.name}`);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
