# sovereign-git: every repo and every Notion page, home on M2Ultra

**Why:** the public NOIZYLAB repo is a fork, and GitHub keeps forks of public repos public.
Private material (Notion vault, board packs, NOIZYKIDZ) needs a private home. **Forgejo on M2Ultra** is that home:
it is already in `infra/m2ultra/docker-compose.yml` at `git.noizylab.ca`.

## What is here

| File | What it does |
|---|---|
| `forgejo_mirror.mjs` | Makes a **private pull mirror** in Forgejo for each repo in `repos.json`. Forgejo keeps them up to date. |
| `notion_export.mjs` | Exports every Notion page to Markdown (uses `notion-to-md`, ISC). Fixes NOIZY names in the copies only. Skips unchanged pages. |
| `sync.sh` | Daily runner: Notion export, then commit and push to `NOIZY/NOIZY-NOTION` on Forgejo. |

Both tools: **HALT first** (unset or unreachable = stop) and **dry run by default** (`--apply` to write).

## Set it up (once, at M2Ultra, in Warp)

1. Start the stack: `infra/m2ultra/README.md`. Check `http://127.0.0.1:3300` opens Forgejo.
2. In Forgejo, create an organisation **NOIZY** and a **private** repo **NOIZY-NOTION**.
3. In Forgejo: **Settings → Applications → Generate token**, scope `write:repository`. Save it in Proton Pass (VAULT-OPS).
4. In Notion: **Settings → Connections → Develop or manage integrations → New integration**, read-only. Share the top pages with it. Save its token in Proton Pass.
5. Make the env file without typing tokens on a command line:
   1. `mkdir -p ~/.noizy && touch ~/.noizy/sovereign-git.env && chmod 600 ~/.noizy/sovereign-git.env`
   2. Open it in a text editor and paste from Proton Pass:
      `FORGEJO_URL=http://127.0.0.1:3300`, `FORGEJO_TOKEN=…`, `GITHUB_TOKEN=…` (read-only), `NOTION_TOKEN=…`, `HALT_URL=…`
6. `cd ~/NOIZYLAB/scripts/sovereign-git && npm ci`
7. Mirrors, dry run: `set -a; . ~/.noizy/sovereign-git.env; set +a; node forgejo_mirror.mjs`
8. Then for real: `node forgejo_mirror.mjs --apply`
9. Clone the Notion repo: `git clone http://127.0.0.1:3300/NOIZY/NOIZY-NOTION.git ~/NOIZY-NOTION`
10. First Notion sync: `bash sync.sh`

## The rest of the git toolkit

| Tool | Role for NOIZY | Note |
|---|---|---|
| **Forgejo** (v17, Oct 2026; v15 is LTS) | The private, sovereign git home. Actions run GitHub-style workflows. | Pick **v15 LTS** for `FORGEJO_TAG` unless a v17 feature is needed. |
| **n8n** | Schedules and glue: run the daily sync, back up n8n's own workflows to Forgejo (community template 2820), react to Forgejo webhooks. | Forgejo node: `n8n-nodes-gitea-forgejo` (community, unofficial). Red-team it before use. |
| **GitLens** (VS Code) | See who changed what, inline. Ships the **GitKraken MCP server** (v17.5+). | Fine for RSP_001's own editor. |
| **GitKraken CLI `gk`** | `gk mcp --readonly` gives GABRIEL read-only repo, PR and issue tools. | Start **read-only**. Write tools need a red-team profile in `redteam/agents/` first. |
| **GitKraken Kepler** | Agentic workspace (public preview, free): runs several Claude Code agents across repos, with an agent graph and a commit composer. | Useful for big multi-repo jobs. Agents still go through branches and pull requests. |

## Tests

`npm test`: HALT fails closed, name repairs, safe file names, mirror plan, Notion export (dry run, apply, skip unchanged).
