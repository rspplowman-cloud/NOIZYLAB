# Claude's new tools (released 10 Nov 2026) and how NOIZY uses them

For RSP_001. Checked 2026-11-12. Short lines, most important first.

## The four tools

| Tool | What it is | NOIZY use | Made |
|---|---|---|---|
| **Claude Sheets** | A live spreadsheet Claude can read and edit | **NOIZY Master Tracker**: every open item, its state, who it waits on, the next step | Yes, 24 rows |
| **Claude Whiteboards** (beta) | A shared board for drawing how things fit | **NOIZY Nervous System**: you speak, HALT is checked, M2Ultra does the work | Yes |
| **Claude Data** (was Dashboards) | A page of numbers, each with its source | **NOIZY Status Board**: blocked / ready / in review, and sessions by month | Yes |
| **Interactive connectors** | Connector results you can click and edit inside the chat | Used through the connectors already on the account | Nothing to build |

- The three pages are **private**. Find them in Claude: `/artifacts`, or claude.ai/code/artifacts.
- Links are not written here on purpose. This repo is still public.

## Rules for these pages (same as everywhere in NOIZY)

- **No secrets, no keys, no personal emails, no open-vulnerability details** on any page.
- **Never-to-AI material stays out:** consent records, NOIZYKIDZ, family, the vault.
- **Do not share a page** until the repos are private and RSP_001 says so.
- Anyone who can open the Data page can read its two attached files. They hold only item names and counts.

## How each one stays true

- **Sheet is the one list.** Change a row's State there. Ask Claude: "update the tracker".
- **Data page reads a copy.** Its numbers are a file made on 12 Nov 2026. Ask Claude: "refresh the status board".
- **Whiteboard is the map.** When a service is added to NOIZYBRIDGE, ask Claude: "add it to the board".

## What they cannot do

- They **cannot reach M2Ultra**. They show state; they do not run jobs. NOIZYBRIDGE does that.
- They **do not check HALT**. Nothing automated runs from them.
- The Data page's numbers are **not live** yet. Live needs a connector that holds the list (for example Linear or Notion).

## Next step that would make them stronger

1. Move the tracker rows into one connector (Linear is already connected).
2. Point the Data page at that connector, so it is live.
3. Have the morning brief (n8n) post the blocked count to Slack and Discord.
