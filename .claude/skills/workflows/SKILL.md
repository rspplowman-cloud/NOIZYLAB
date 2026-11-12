---
name: workflows
description: The NOIZY workflow menu for RSP_001. Use when RSP_001 types /workflows, asks "what can we run", or asks to find all knowledge about his Claude history (sessions, chats, spend). Lists every NOIZY workflow with its one command, and runs the "history" workflow that gathers everything about RSP_001's months with Claude into a PRIVATE report.
---

# /workflows

Answer RSP_001 in short bullets (CLAUDE.md). First show the menu, then run what he picks. If he named one, run it.

## The menu

| Workflow | What it does | Command (Warp or Ghostty, on M2Ultra) |
|---|---|---|
| **party** | Everything in one safe run: HALT, drives, libraries, TaleSpin, catalog, Workspace plan, all green | `bash scripts/party/party.sh` |
| **allgreen** | Every service and HEAVEN, one line each | `bash infra/m2ultra/allgreen.sh` |
| **drives** | NOIZYTEK health grades for every drive (12 TB stays protected) | `python3 services/noizytek/noizytek.py scan` |
| **rescue** | Gentle copy of a COPY NOW drive (plan first, `--apply` to run) | `python3 services/noizytek/noizytek.py rescue <disk> <image> <map>` |
| **libraries** | Original vs commercial libraries, with where to re-download | `python3 scripts/archive/library_finder.py <drives>` |
| **catalog** | One file list into the private Forgejo repo; n8n re-indexes it | `python3 scripts/catalog/catalog.py --push` |
| **workspace** | Google Workspace shared-drive plan | `python3 scripts/archive/workspace_plan.py <libraries>` |
| **cloud rescue** | Encrypted, add-only upload, verified | `bash scripts/archive/cloud_rescue.sh <folder> <crypt-remote>:` |
| **bridge** | iPhone ⇄ M2Ultra door for Siri | `python3 services/noizybridge/bridge.py` |
| **sovereign git** | Mirror repos and Notion to Forgejo | `bash scripts/sovereign-git/sync.sh` |
| **history** | Everything about RSP_001's time and spend with Claude (below) | run by Claude |

Every workflow checks HALT first where it changes anything. None of them touches the clicking 12 TB drive.

## The history workflow (private)

Goal: one private report, `~/.noizy/history/CLAUDE-HISTORY.md` (or the session scratchpad), never in a repo, never in a
public place. Money, accounts and chat contents are private.

1. **Claude Code sessions:** `list_sessions` (mine: true), page with `after_id` until `has_more` is false. Count by month,
   by origin (web, desktop, iOS, CLI, Remote Control), by status. List the themes from the titles.
2. **claude.ai chats:** these are not visible to a session. RSP_001 exports them once: claude.ai → Settings → Privacy →
   **Export data**. The export arrives by email as a zip; read `conversations.json` (count by month, themes).
3. **Spend, from the source:**
   - claude.ai plan: claude.ai → Settings → **Billing** → invoices.
   - API: console.anthropic.com → **Billing** → invoices and usage.
   - Receipts by email: search every connected inbox for `from:anthropic.com OR from:mail.anthropic.com OR "Anthropic, PBC"`
     with `receipt OR invoice`. The account email may be an inbox that is not connected: say so.
   - Add only amounts read from an invoice or receipt. Never estimate a total and call it a fact.
4. **What was built:** `git log` in NOIZYLAB (and NOIZYGIT-MASTER), the merged PRs, `scripts/archive/chronology.py`,
   and the Notion page "NOIZY Chat Archive".
5. **Report:** months active, sessions and chats per month, spend per month (from invoices only), the big builds, what is
   still blocked, and what to stop paying for. Plain bullets, most important first.
