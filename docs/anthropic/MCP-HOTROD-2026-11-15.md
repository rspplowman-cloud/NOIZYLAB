# The sovereign stack and MCP: what exists, what we have, what to wire

**For:** Robert Stephen Plowman (RSP_001) · **Checked:** 2026-11-15 · **Kind:** research record

- **The short version:** four of our docs are out of date. Lumo now has an API endpoint. Infomaniak ships official MCP servers. TODAQ runs a hosted MCP server. Cloudflare has deprecated `McpAgent`.
- **monday.com** is already in RSP_001's Claude connector list, but its sign-in was never finished.

- **How it was made:** a research sweep read the vendors' own pages and this repo. Nothing was installed, deployed or changed.
- **What to trust:** tables hold only what was checked against a fetched page or file. Guesses are marked. The last section lists what could not be verified.
- **Paths** are from the repo root. `THE-GATHERING-1:` means the old archive repo.
- **Nothing here is a decision.** RSP_001 decides.

---

Four of his docs are now out of date: **Lumo has a live API endpoint**, **Infomaniak ships official MCP servers**, **TODAQ runs a hosted MCP server**, and **Cloudflare has deprecated `McpAgent`**. Nothing in either repo was edited.

## 1. What exists today (verified only)

**TODAQ / TODA**
| Item | What it is | Official? | Licence | Auth | URL | Verified how |
|---|---|---|---|---|---|---|
| TODA Core (`todajs`, `toda` CLI) | Library and CLI for TODA files: hash-linked "twists", tethered to a line server ("poptop") that proves integrity | Official (TODAQopen) | "Apache License 2.0" in package.json; **no LICENSE file on master** | None locally | github.com/TODAQopen/toda; npm `todajs` 1.4.0 (2026-08-07) | README, docs/cli.md, package.json, npm |
| Twin API v0.7.2 | Hosted TODA container (REST): import/export `.toda`, `/binder` and `/ssr` (append any JSON record), `/dq`, `/transfers`, `/config` | Official | Hosted service | `apiKey` **query parameter**, or cookie | engineering.todaq.net/twin/ (`enterprise-api.yml`) | Downloaded the OpenAPI file |
| Micropay / TAPP paywall | Pay-per-request proxy between twins (`/pay/…`, `/paywall/*`, `X-TODA-Pay` headers) | Official | Hosted service | apiKey | engineering.todaq.net/micropay/ | Fetched page |
| Qatom MCP server | Hosted MCP marketplace plus an agent wallet | Official (TODAQmicro) | Skill repo MIT | OAuth 2.0 via pay.m.todaq.net | `https://mcp.m.todaq.net/mcp`; github.com/TODAQmicro/qatom-skill | README and LICENSE; endpoint returned 401 plus OAuth metadata |

**Proton**
| Item | What it is | Official? | Licence | Auth | URL | Verified how |
|---|---|---|---|---|---|---|
| Pass CLI 2.7.0 | Vault CLI; `pass://vault/item/field` references; `run`, `inject`, SSH agent | Official | GPL-3.0 | `pass-cli login`, or `PROTON_PASS_PERSONAL_ACCESS_TOKEN` | protonpass.github.io/pass-cli | Docs, versions.json, LICENSE |
| Pass agent tokens | Access token with audit log; scoped to vaults or items; 2-hour sessions; reason required (≤300 chars) | Official | n/a | Token; any paid Pass plan | /commands/agent/; proton.me/pass/developer-features | Fetched both |
| Drive SDK | C# and JS client; **no login or session code included** | Official | MIT | Bring your own | github.com/ProtonDriveApps/sdk | Repo page, LICENSE.md |
| Drive CLI 0.9.0 (2026-10-05) | `proton-drive` binary | Official | Not stated | Browser login | proton.me/download/drive/cli/ | Download page |
| Mail Bridge | Local IMAP/SMTP; no mail API found | Official | GPL-3.0 | Proton login | github.com/ProtonMail/proton-bridge | Repo page, LICENSE |
| VPN WireGuard export | `.conf` from account → Downloads; by hand only | Official | n/a | Account | protonvpn.com/support/wireguard-configurations | Fetched |
| **Lumo API** | `/v1/models` is public: `lumo-lite`, `lumo-max`, `apertus-15` (131k context, function calling, vision). Chat returns 401 "A valid Lumo API key is required" | Official host | n/a | API key (how to get one: not found) | `https://lumo-api.proton.me/v1` | Direct probe; roadmap post 2026-10-15 says "We're releasing the Lumo API" |
| Authenticator | Free 2FA app; no CLI or API mentioned | Official | "Open source", licence not named | n/a | proton.me/authenticator | Fetched |
| Community Proton MCP servers | Mail via Bridge; some wrap pass-cli | Community | MIT (miketigerblue, bernardogv, jorgenclaw) | Your credentials | GitHub | LICENSE files only; code not reviewed |

- No official Proton MCP server found. The roadmap, Lumo, Pass and business pages never mention MCP.

**Infomaniak**
| Item | What it is | Official? | Licence | Auth | URL | Verified how |
|---|---|---|---|---|---|---|
| REST API | 1,166 paths: drive, mail, kChat, public cloud, Swiss Backup, kMeet, domains, AI | Official | n/a | Bearer token or OAuth2, with scopes | api.infomaniak.com; developer.infomaniak.com/openapi.json | Parsed the OpenAPI file |
| AI Tools, OpenAI-compatible | `/2/ai/{product_id}/openai/v1/` chat, completions, embeddings, models; `/1/…` transcription and images; Cohere-style rerank | Official | n/a | Bearer plus product ID | Same | OpenAPI; unauthenticated call returned an OpenAI-style 401 |
| AI Tools, **Anthropic-compatible** | `/2/ai/{product_id}/anthropic/v1/messages` and `/models` | Official | n/a | Same | Same | OpenAPI |
| **Official MCP servers** | `@infomaniak/mcp-server-kdrive` 1.2.0, `-mail` 2.1.0 (20 tools, sends and deletes), `-calendar` 1.3.1, `-contact` 1.0.2, `-kchat` 1.1.1; stdio via npx or Docker | Official org | MIT per npm and README; **no LICENSE file in repo** | Token in env (`KDRIVE_TOKEN`, `MAIL_TOKEN`) | github.com/Infomaniak/mcp-server-* | Org page, two READMEs, npm |
| Euria | Chat assistant in kSuite; no API or MCP mentioned (page dated 05/11/2026) | Official | n/a | n/a | infomaniak.com/en/support/faq/1369 | Fetched |
| kChat API | Mattermost-style `/api/v4/…`, incoming and outgoing webhooks | Official | n/a | `kchat` scope | OpenAPI | Parsed |
| Swiss Backup, Public Cloud, kMeet | 13, 55 and 2 paths. Public Cloud paths are account-level, not OpenStack | Official | n/a | Scoped token | OpenAPI | Parsed |
| Community MCP servers | `@henrikogard/infomaniak-mcp` 1.1.0, `infomaniak-mcp-agent` 0.15.1 | Community | MIT | Token | npm, GitHub | npm, LICENSE |

**Cloudflare**
| Item | What it is | Official? | Licence | Auth | URL | Verified how |
|---|---|---|---|---|---|---|
| Cloudflare API MCP (Code Mode) | `search`, `execute`, `docs`, `whoami`; model writes JS run in a sandbox; ~1,100 tokens vs 1.17M native; `?codemode=false` gives per-endpoint tools | Official | Apache-2.0 | OAuth or API token as Bearer | `https://mcp.cloudflare.com/mcp`; github.com/cloudflare/mcp | Docs (27 Oct 2026), repo, LICENSE |
| Product servers | docs, containers, browser, dex, casb, blog, Agents SDK docs | Official | Apache-2.0 | OAuth | github.com/cloudflare/mcp-server-cloudflare | README |
| Deprecated servers | ai-gateway, auditlogs, autorag, dns-analytics, graphql, logpush, observability, radar, workers-bindings, workers-builds (the full list in Cloudflare's README, rechecked 2026-11-15) | Official | n/a | n/a | Same | README; connector notice |
| `createMcpHandler` | Stateless remote MCP on a Worker; `agents/mcp/server` plus `@modelcontextprotocol/server` | Official | MIT (`agents` 0.33.0, 2026-11-03) | `getMcpAuthContext()` | developers.cloudflare.com/agents/api-reference/mcp-handler-api/ | Docs, npm |
| `McpAgent` | **Deprecated, feature-frozen**; cannot run a v2 SDK server | Official | MIT | `this.props` | …/mcp-agent-api/ | Docs |
| `workers-oauth-provider` 1.2.4 | OAuth authorization and resource server for Workers | Official | MIT | n/a | github.com/cloudflare/workers-oauth-provider | npm, LICENSE |
| D1 | Sessions API (`withSession`, bookmarks); read replication in 6 regions; Time Travel | Official | n/a | Binding or REST | developers.cloudflare.com/d1 | Limits, replication, time-travel pages |
| R2 | Event notifications to Queues; bucket locks; presigned URLs; **Basin Catalog** (was R2 Data Catalog) and **Basin SQL** (was R2 SQL), both GA | Official | n/a | Binding or S3 keys | developers.cloudflare.com/r2 | Each page fetched |

**monday.com**
| Item | What it is | Official? | Licence | Auth | URL | Verified how |
|---|---|---|---|---|---|---|
| Hosted Platform MCP | "60+ tools"; Streamable HTTP only, `/sse` unsupported | Official | Hosted | OAuth, own OAuth app, or personal token as Bearer; `Api-Version` header | `https://mcp.monday.com/mcp` | Developer docs (2026-10-19) |
| Local server | `@mondaydotcomorg/monday-api-mcp` 3.3.1; flags `--read-only`, `--enable-dynamic-api-tools`, `--mode apps`; Node 20+ | Official | MIT | `MONDAY_TOKEN` | github.com/mondaycom/mcp | Repo, LICENSE, npm |
| Claude directory listing | "monday.com", Anthropic verified, 33 tools, added November 2025 | Official | n/a | Sign-in | claude.com/connectors/monday | Fetched |
| GraphQL API | Limits in section 4 | Official | n/a | Token or OAuth | developer.monday.com | Rate-limits page (2026-11-05) |
| Webhooks | `create_webhook(board_id, event, url, config)`; 21 event types; challenge echo; optional JWT; retries each minute for 30 minutes | Official | n/a | `webhooks:write` | …/reference/webhooks | Fetched |

**MCP and Anthropic**
| Item | What it is | Official? | Licence | Auth | URL | Verified how |
|---|---|---|---|---|---|---|
| Spec **2026-07-28** | Stateless: no `initialize`, no `Mcp-Session-Id`; `server/discover` required; multi-round-trip requests replace server-initiated elicitation and sampling; `resultType` required; SSE resumability removed; Roots, Sampling, Logging and Dynamic Client Registration deprecated | Official | Moving MIT → Apache-2.0 | OAuth; Client ID Metadata Documents preferred | modelcontextprotocol.io/specification/2026-07-28/changelog | Fetched in full |
| Spec 2025-11-25 | Added URL elicitation, Client ID Metadata Documents, OIDC discovery, incremental scopes, experimental tasks, icons | Official | Same | n/a | …/2025-11-25/changelog | Fetched |
| TypeScript SDK | v2: `@modelcontextprotocol/server` and `/client` 2.4.0 (2026-10-23). v1: `@modelcontextprotocol/sdk` 1.32.2, fixes for at least 6 months after v2 | Official | Apache-2.0 (v2); MIT (v1) | n/a | github.com/modelcontextprotocol/typescript-sdk | npm, README, LICENSE |
| Python | `mcp` 2.3.0 (MIT); FastMCP 4.2.0 (Apache-2.0); TS `fastmcp` 4.26.2 (MIT, separate project) | Official; community | As listed | n/a | PyPI, GitHub | Registries, LICENSE |
| MCP Registry | Metadata only; **preview**; **does not support private servers** | Official | Same as spec | GitHub or DNS namespace proof | modelcontextprotocol.io/registry/about | Fetched |
| MCP Apps; Tasks | `ui://` resources in a sandboxed iframe (`ext-apps` 2.0.4); tasks now an extension (`ext-tasks` 0.2.3) | Official | MIT; Apache-2.0 | n/a | modelcontextprotocol.io/extensions/apps/overview | Fetched, npm |
| Claude connectors | Remote MCP over Streamable HTTP; callback `https://claude.ai/api/mcp/auth_callback`; auth specs up to 2025-11-25; no sampling or resource subscriptions | Official | n/a | OAuth, static header, or none | claude.com/docs/connectors/building | Fetched |
| Claude Code 2.1.325 | http, stdio, ws; tool search on by default (`alwaysLoad`, `ENABLE_TOOL_SEARCH`); elicitation; MCP tasks (beta); plugins bundle servers; 2026-07-28 on the v2 runtime | Official | Anthropic commercial terms | OAuth or headers | code.claude.com/docs/en/mcp | Fetched, npm |
| Agent SDK | `mcpServers` (stdio, http, sse, in-process); **no interactive OAuth** | Official | TS: commercial terms; Python: MIT | Headers or env | code.claude.com/docs/en/agent-sdk/mcp | Fetched, LICENSE files |
| Messages API MCP connector | `mcp_servers` plus `mcp_toolset`; beta `mcp-client-2026-09-15`; public HTTP only | Official | n/a | `authorization_token` | platform.claude.com/docs/en/agents-and-tools/mcp-connector | Fetched |

**Leads not verified**
- "TwinQ", "TODA/IP", TODAQ "playground": no page uses these names. The Twin spec shows `*.tq.biz.todaq.net` hosts.
- `docs.todaq.net/mcp` (Qatom tool list): the host did not resolve here. It has to be allowed in the session's network settings.
- Lumo API prices and key issuance come from one unofficial tracker (carlostkd.ch).
- Infomaniak general limit of 60 requests/minute: community claim only.
- monday "agent builder", "sidekick" and external-agent signup: press coverage only.
- Whether Bridge needs a paid plan; Bridge headless mode.

## 2. Already in his repos

- **TODAQ**
  - `services/ledger/src/ledger.ts`: `anchorPayload`, `recordAnchor`, `verifyAnchors`. Pure functions; **no HTTP client**. Tests not run (no `node_modules`).
  - Archive: nothing. The one "TwinQ" hit is a false match in `LUCY/src/engine/lucy-v4-engine.ts`.
- **Proton**
  - `scripts/vault/vault_push.sh`: Drive CLI upload with HALT and secret refusal. Looks working; written for CLI 0.6.0.
  - `redteam/harness/src/lumo.js`: stub; `complete()` throws.
  - `docs/identity/*`, `docs/lumo/LUMO-PROMPTS.md`: doc-only.
  - **No `pass-cli` call anywhere.** The "secrets helper" is named in docs but I found no script.
  - Archive: `NOIZYGIT-MASTER/packages/noizyvault-security/` (a manifest and a status printer) and `config/wireguard/*.template`. Doc and stub.
- **Infomaniak**
  - `_mc96-common/gabriel/mcp/infomaniak-mcp/index.js`: 3 tools; HALT first; refuses never-to-AI text. **Working**: I ran the suite, 12 of 12 pass. Its endpoint matches the official spec.
  - `docs/infomaniak/INFOMANIAK-AI.md` wrongly says no official MCP server exists.
  - Archive: nothing.
- **Cloudflare**
  - `heaven-mcp/index.js` (`h17_cf_*`, read-only REST): working per tests.
  - D1 and R2 bindings in `noizybkz/wrangler.jsonc` and `services/noizy-contact/wrangler.jsonc`, with placeholder IDs.
  - `docs/cloudflare/CF-SDKS-AND-APIS.md` is stale: `agents` 0.28.1, and a focused-server list that is now mostly deprecated.
  - Archive: `infrastructure/mcp-worker/` is a hand-rolled JSON-RPC router with D1 commented out (stub). `heaven/wrangler.toml` has a real D1 binding, R2 commented out, and an **account ID in a comment**.
- **monday**
  - No code. The archive lists only the desktop app in an inventory, plus a saved Claude connector list.
- **MCP**
  - Nine stdio servers on `@modelcontextprotocol/sdk` `^1.0.0`. Working.
  - No remote or v2 server in the master repo.

## 3. The gap and the wiring order

1. **Fix the four stale docs**, and bump the `vault_push.sh` note from Drive CLI 0.6.0 to 0.9.0. Needs PR approval.
2. **Proton Pass first.** Install pass-cli. Create one agent token per agent, scoped to VAULT-OPS only. Launch MCP servers through `pass-cli run` with `pass://` references. Needs RSP_001 to log in and create tokens.
3. **Infomaniak AI.** Token and product ID into the vault, then `infomaniak_status` and `infomaniak_models`. Needs his credentials. No code change.
4. **Cloudflare API MCP.** Add `https://mcp.cloudflare.com/mcp` to Claude Code with a read-only token in a header. Remove the deprecated Bindings connector. Needs his token and the account decision.
5. **Own remote MCP on Workers.**
   - Use `createMcpHandler` with `@modelcontextprotocol/server` 2.x, not `McpAgent`.
   - Declare `d1_databases` and `r2_buckets` in wrangler, and put `OAuthResourceServer` in front.
   - Start read-only (ledger head, receipts).
   - Red-team profile and smoke test first. Deploy needs approval.
   - Guess: tools reach D1 and R2 by closing over `env` in `fetch`; the docs do not show the pattern.
6. **TODAQ anchoring**, after the meeting.
   - Get a Twin URL and key into the vault.
   - Add a small client that posts the `anchorPayload` digest to `/binder` or `/ssr`, then stores the reference with `recordAnchor`.
   - Guess: `todajs` could anchor locally without an account; I did not test that.
   - Needs approval. Do not connect Qatom.
7. **Lumo.** Get a key and Proton's own docs, then implement `complete()` against `lumo-api.proton.me/v1`. Red-team before any real mail. Needs RSP_001.
8. **monday**, only if he accepts a fifth provider (Linear is already connected).
   - Enable the directory connector for hands-on use.
   - For agents, use the hosted URL with a token header, or the npm server with `--read-only`.
   - Send status-change webhooks to a Worker or n8n, which posts to NOIZYARMY `/task`. Approval stays on the NOIZYARMY key.
   - Needs his account, token and decision.
9. **Infomaniak official MCP servers** (kDrive, kChat, calendar), only if he uses kSuite. Skip mail.
10. **MCP SDK.** Tighten v1 to `^1.32.2` now. Plan the v2 move as its own PR.

## 4. Hard limits and traps

- **Rule conflict.** RSP_001's newer note (2026-11-14) says "Cloudflare is edge only". `docs/SOVEREIGN-STACK.md` gives Cloudflare "data", with consent records stored in D1. One of them must change.
- **Rule conflict.** `docs/anthropic/CLAUDE-NEW-TOOLS-2026-11.md` line 15 says "This repo is still public". I did not check GitHub, because that would put his account name in a URL.
- **Past key leak.** A commit titled "remove four WireGuard key files" exists. Guess: the keys remain in git history. Rotate them if not done.
- **TODAQ.**
  - The Twin API key travels in the URL, so it lands in logs and shell history.
  - Qatom is the payments product his stack doc already rules out.
  - The GitHub repo is at 1.1.33 while npm is at 1.4.0.
- **Proton.**
  - The Drive SDK says it is "not yet ready for third-party production use". A crypto change is due end of 2026 or early 2027.
  - Proton's own agent instructions tell agents to keep the token "in a secure location". That is a plaintext risk.
  - Community Proton MCP servers and `lumo-tamer` (GPL-3.0) hand mail or vault access to unreviewed code.
- **Infomaniak.**
  - Official MCP READMEs show tokens in plaintext config.
  - `mcp-server-mail` can send, delete and read local attachment paths. Any mailbox it touches goes to the AI.
  - Deprecated v1 chat, embeddings and models paths are still listed. Stay on `/2/`.
- **Cloudflare.**
  - Code Mode runs model-written code against the whole account. Use a read-only token.
  - D1: 10 GB per database, 2 MB row, 30-second query, 50 MB result (from 2026-11-04), 1,000 queries per invocation on the paid plan.
  - Time Travel: 30 days (7 on free). Restore overwrites in place.
  - Read replication only works through the Sessions API on a Worker binding.
  - R2 jurisdictions are `eu`, `us` and `fedramp` only. No Switzerland or Canada.
  - Bucket-lock rules can be removed, so this is not compliance-grade WORM.
  - Presigned URLs last 7 days at most, work only on the S3 domain, and act as bearer tokens.
- **monday.**
  - Daily calls: 200 Free, 1,000 Standard/Basic, 10,000 Pro, 25,000 Enterprise. MCP calls count.
  - 40 concurrent requests below Pro; 5M complexity per query.
  - Deletes are permanent.
  - Board content sits with monday and passes through Claude. Never put consent, children's or family material there.
- **Claude and MCP.**
  - The Registry takes public servers only, so do not publish.
  - Connectors: about 150,000 characters per tool result, and 240 seconds per call.
  - The Messages API connector is beta and not eligible for zero data retention.
  - The Agent SDK cannot run a browser OAuth flow.
  - The TypeScript Agent SDK and Claude Code are proprietary.

## 5. Could not find or verify

- Any TODAQ page for "TwinQ", "TODA/IP" or a "playground"; TODAQ pricing; the Qatom tool list.
- Official Lumo API docs, key issuance, pricing, and any Proton MCP statement.
- Pass CLI and Drive CLI release dates and changelogs; the Drive CLI licence.
- An Infomaniak global rate limit (only per-endpoint ones appear), an AI price list, any Euria API, and OpenStack endpoints in the public spec.
- Whether Claude's hosted connectors already speak 2026-07-28. The building guide lists auth specs only up to 2025-11-25.
- Which spec revision first added elicitation and structured tool output; I did not fetch the 2025-06-18 changelog.
- Ledger tests and any live HEAVEN, D1 or R2 state. No credentials were used.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
