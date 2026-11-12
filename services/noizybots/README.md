# NOIZYBOTS: Slack and Discord into M2Ultra

**Type `/noizy brief` in Slack or Discord, and M2Ultra answers.** Only you see the answer.

| You type | M2Ultra does |
|---|---|
| `/noizy brief` | What's red, what waits on you, the one thing to ship |
| `/noizy drives` | NOIZYTEK drive grades |
| `/noizy find TaleSpin narration` | Where a file is (the catalog) |
| `/noizy run allgreen` (or `scan`, `party`) | Opens that Warp job on M2Ultra (HALT first) |

## Why it is safe

- **Outbound only.** M2Ultra connects out to Slack (Socket Mode) and Discord (Gateway). No public address, no open port.
- **Only RSP_001.** `NOIZY_BOT_USERS` lists your Slack and Discord user ids. Everyone else gets one refusal; nothing runs.
- **Fixed commands.** The bots can only call NOIZYBRIDGE's fixed verbs. No shell, no file paths.
- **Private answers.** Slack replies are ephemeral; Discord replies are ephemeral (only you see them).
- **The Discord bot reads no messages.** It asks for no message intents; it only receives its own slash command.
- **No dependencies.** Node 22's built-in WebSocket and fetch. Red team: `redteam/agents/NOIZYBOTS.json`.
- **Remember:** drive names and file paths in an answer pass through Slack's or Discord's servers. Sealed catalog
  records (consent, kidz, family, vault, voice models) are never in the index, so they can never appear.

## Set up Slack (about 5 minutes, at api.slack.com/apps)

1. **Create New App** → From scratch → name **NOIZY** → workspace **THE-GATHERING**.
2. **Socket Mode** → turn it **on**. Make an app-level token with scope `connections:write`. It starts with `xapp-`.
3. **Slash Commands** → Create → command `/noizy`, description "Ask M2Ultra".
4. **Install App** to the workspace.
5. Your user id: in Slack, your profile → ⋯ → **Copy member ID** (starts with U).

## Set up Discord (about 5 minutes, at discord.com/developers/applications)

1. **New Application** → name **NOIZY**. Copy the **Application ID**.
2. **Bot** → Reset Token → copy it. Leave every "Privileged Gateway Intent" **off**.
3. **Installation** → scopes `applications.commands` and `bot` → open the install link → add it to your server.
4. Your user id: Discord Settings → Advanced → Developer Mode on → right-click your name → **Copy User ID**.

## Run on M2Ultra (Warp or Ghostty)

1. Put these in `~/.noizy/bridge.env` (values from Proton Pass; `chmod 600`):
   `SLACK_APP_TOKEN`, `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID`, `NOIZY_BOT_USERS` (your two ids, comma-separated),
   next to `NOIZY_BRIDGE_KEY`.
2. Start NOIZYBRIDGE (`services/noizybridge/README.md`).
3. `set -a; source ~/.noizy/bridge.env; set +a; node services/noizybots/src/main.mjs`
4. In Slack or Discord, type `/noizy brief`.

A bot whose token is missing just stays off; the other one still runs.
