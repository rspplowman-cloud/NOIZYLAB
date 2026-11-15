# GABRIEL 4.0: ten levels up

**For:** Robert Stephen Plowman (RSP_001) · **Date:** 2026-11-15 · **Version:** 3.0.0 → 4.0.0

- **Tests:** 14 before, **48 now**, all pass (`npm test`).
- **Live check:** four real turns ran through the Agent SDK. Memory, tools and receipts worked. Cost: about 4 cents.
- **Not run here:** the red-team smoke (`npm run smoke`) needs the Anthropic key. Run it on M2Ultra before any deploy.

## The ten levels

| # | Level | Before | Now |
|---|---|---|---|
| 1 | **Memory** | Every line in chat started a new conversation. GABRIEL forgot what you said one line ago. | Each turn resumes the last. `/new` starts fresh. |
| 2 | **Tools** | No tool config existed, so in chat GABRIEL had no knowledge search and no HEAVEN. His doctrine told him to use tools he did not have. | His own two servers are wired in: `gabriel` (knowledge, status, watch list) and `heaven` (read-only). |
| 3 | **Limits on tools** | Nothing said what he may not touch. | No shell. No file access. No web. Every tool call is checked; anything else is refused. The machine's own Claude settings cannot widen it. |
| 4 | **Budget** | `GABRIEL_DAILY_BUDGET_USD=20` was in the env file with the note "NOT ENFORCED YET". | Enforced. At the cap he stops calling Claude and says so. A typo in the value stops spending; it does not unlock it. |
| 5 | **Receipts** | No record of a turn. | One receipt per turn in a hash chain, same format as the NOIZY Ledger. Fingerprints and sizes only, **never the words**. `gabriel --verify` proves no line was changed. |
| 6 | **Failing well** | A failed run gave an empty reply, or crashed the chat. | One plain sentence: bad key, unknown model, overloaded, no network, out of budget, too slow. A silent turn is stopped after 5 minutes. |
| 7 | **Voice** | Replies over 2,000 characters were refused whole by the voice service (GABRIEL sent up to 3,500). He spoke only after the full answer was written, and read out bullets, tables and web addresses. | Sentences are spoken **as they arrive**. Long replies go out in pieces. Markup, tables, code and links are not read out. After 4,000 characters he says "The rest is on screen." |
| 8 | **Speed** | Every turn re-read 12 doctrine files and the title of every Markdown file in the repo. The greeting counted down to 17 May 2026, a date long past. | Doctrine is re-read only when a file changes. The knowledge map refreshes every 5 minutes. A passed target date is said plainly, never "0 days". |
| 9 | **Router** | Any sentence with "quick" or "fast" went to the smallest model, even "quick, design the architecture". | Deep-work words win. Long requests are never treated as lookups. Each choice has a reason and a fallback model. Voice stays on the fast model. |
| 10 | **Self-check** | No way to ask "is GABRIEL healthy?" | `gabriel --doctor`: one line per check, problems first, short enough to read aloud. Keys are shown as "set" or "missing", never the value. |

## Also hardened in the daemon

- A request body over 1 MB is refused (413).
- The key check no longer leaks the key's length through timing.
- **HALT is read as JSON.** Before, `{"halted": false}` with a space counted as halted, and the text `"halted":false` inside another field could count as clear.
- New `GET /status` (needs the key): models, today's spend, receipt chain, HALT.
- The brand-sync endpoint says "script not found" instead of hanging when its script is not on the machine.

## How to use it (in Warp or Ghostty)

1. `cd ~/NOIZYLAB/_mc96-common/gabriel`
2. `npm ci`
3. `cd mcp && npm ci && cd ..`
4. `npm run build`
5. `npm run doctor`
6. `npm run chat`

In chat: `/new` forgets the conversation · `/cost` shows today's spend · `/doctor` runs the checks · `/exit` leaves.

## What RSP_001 decides

- **The budget.** $20 a day is the old template value. Change `GABRIEL_DAILY_BUDGET_USD` in `.env`.
- **The target date.** `GABRIEL_TARGET_DATE` is now empty. Set a new one or leave it.
- **Whether GABRIEL gets more tools in chat.** Today he reads and explains only. Anything that acts stays behind the daemon's verbs and your go.

## Not done

- The receipts are a local file. They are not yet anchored in HEAVEN or the D1 ledger.
- LUCY and the other bosses still use the old path. Only GABRIEL's chat turn was rebuilt.
- GABRIEL still says "Rob" in his greeting. That comes from `doctrine/CHARACTER.md`, which was not edited.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
