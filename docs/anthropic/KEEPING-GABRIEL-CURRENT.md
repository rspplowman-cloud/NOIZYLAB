# Keeping GABRIEL current: SDKs, models, Claude Code, plugins, connectors

**Owner:** Robert Stephen Plowman (RSP_001) · **Written:** 2026-11-11

**The rule:** GABRIEL **watches and prepares**; RSP_001 **decides**. The rain prepares, it does not decide (`doctrine/LIGHTNING_AND_RAIN.md`).

## The five things to keep current

| What | Where it lives | Who updates it | How |
|---|---|---|---|
| **Anthropic SDKs** (`@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `@modelcontextprotocol/sdk`) | `package.json` files in this repo | A pull request, approved by RSP_001 | The weekly **anthropic-watch** flags them |
| **Model IDs** (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`) | `gabriel/source/router.ts`, `dreamchamber/src/roster.js`, `redteam/harness` | A pull request, approved by RSP_001 | anthropic-watch checks them against the live model list; **red if a model is retired** |
| **Claude Code** (the CLI on M2Ultra) | M2Ultra | GABRIEL, with `--apply`, HALT clear | `m2ultra-tune-up.sh` runs `claude update` |
| **Claude Code plugins and marketplaces** | M2Ultra (`claude plugin ...`) | GABRIEL, with `--apply`, HALT clear | `m2ultra-tune-up.sh`; plugins **synced from claude.ai** are updated by the account, not the script |
| **Claude.ai connectors** (Notion, Slack, Gmail, Drive ...) | Your claude.ai account | **Nobody needs to:** they update on Anthropic's side | If one breaks: claude.ai → Settings → Connectors → reconnect |

## The two tools

### 1. anthropic-watch (cloud, weekly, read-only)

- Runs every Monday in GitHub Actions (`.github/workflows/anthropic-watch.yml`).
- Report goes to the job summary. Nothing is changed.
- With the `ANTHROPIC_API_KEY` repository secret it also checks every model ID in code against the live list.
- Run it yourself: `cd scripts/anthropic-watch && npm ci && node anthropic_watch.mjs`

**First report (2026-11-11):**

- `@anthropic-ai/sdk` **1.8.0** is out; DreamChamber and the red-team harness use **0.134**. Breaking upgrade: plan it as its own pull request.
- `@anthropic-ai/claude-agent-sdk` **0.3.x** is out; GABRIEL uses **0.2.x**. Breaking (0.x minor).
- `@modelcontextprotocol/sdk`: current (1.32.2). The agent MCP servers declare `^1.0.0`; tighten to `^1.32.2`.
- Models in code: all three are current-generation IDs.

### 2. m2ultra-tune-up.sh (M2Ultra, on demand)

1. `bash scripts/anthropic-watch/m2ultra-tune-up.sh` → report only: Claude Code version, MCP servers, marketplaces, plugins.
2. `bash scripts/anthropic-watch/m2ultra-tune-up.sh --apply` → updates, only if HALT is clear.
   - Runs at background priority.
   - Never auto-accepts a new install command from a marketplace. Those are listed for RSP_001.
   - Leaves a receipt in `~/.noizy/receipts/<date>/`.
3. Restart Claude Code to load updated plugins.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
