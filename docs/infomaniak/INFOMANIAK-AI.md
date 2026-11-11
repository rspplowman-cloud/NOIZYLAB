# Infomaniak AI: Swiss-hosted models for NOIZY

**Owner:** Robert Stephen Plowman (RSP_001)
**Checked:** 2026-11-11, from web search. Infomaniak's own pages and third-party listings; nothing here is an independent audit.

## What Infomaniak offers

| Product | What it is | Can NOIZY code use it? |
|---|---|---|
| **AI Tools** | Open models (Mistral, Gemma, Apertus, Kimi and others) behind an **OpenAI-compatible API**: model list, chat, embeddings, streaming | **Yes.** Wired in as `infomaniak-mcp` |
| **Euria** | Infomaniak's chat assistant for people, part of kSuite | No API found. Use it in the app |
| **kMeet** | Video meetings, built on Jitsi Meet | No public API found |
| **Manager API** | Domains, DNS, mail, kDrive, hosting | Official REST API with tokens. Only community MCP servers exist (unofficial) |

- **Hosting:** Infomaniak says data is hosted and processed only in Switzerland, and prompts are not stored.
- **GitHub:** no official Infomaniak MCP server or AI SDK was found. Community projects (for example `Mogacode-ma/infomaniak-mcp-agent`) are unofficial, and some read browser session cookies. **Do not use those with NOIZY accounts.**

## How it fits beside Lumo

| | Lumo (Proton) | Infomaniak AI Tools |
|---|---|---|
| Role | The private room | A Swiss model provider for agents |
| API | None yet | Yes (OpenAI-compatible) |
| Allowed material | Consent records, family, contracts, NOIZYKIDZ | **Public and work material only** |

Consent records, NOIZYKIDZ, family and vault material never go to an AI service. `infomaniak-mcp` refuses them.

## The `infomaniak-mcp` server

Location: `_mc96-common/gabriel/mcp/infomaniak-mcp/`. Tools:

- `infomaniak_status`: set or missing for each setting (never the values).
- `infomaniak_models`: models enabled on your product.
- `infomaniak_ask`: one question to one model. Needs `content_class` = `public` or `work`.

Rules it enforces:

1. **HALT first.** Every outbound call checks HALT. Unset or unreachable = refused.
2. **Never-to-AI material is refused** before anything leaves the machine.
3. **The token is never shown.**

## Steps for RSP_001

1. Sign in to the Infomaniak Manager.
2. Order or open **AI Tools**. Note its **product ID**.
3. Create an **API token** with the AI scope.
4. Save both in **Proton Pass, VAULT-OPS**.
5. On M2Ultra, put them in `_mc96-common/gabriel/.env` as `INFOMANIAK_TOKEN` and `INFOMANIAK_AI_PRODUCT_ID`.
6. Ask Claude to run `infomaniak_status`, then `infomaniak_models`.

The endpoint used is `https://api.infomaniak.com/2/ai/<product id>/openai/v1` (from a 2026 developer guide). If Infomaniak's docs show a different one, set `INFOMANIAK_AI_BASE_URL`.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
