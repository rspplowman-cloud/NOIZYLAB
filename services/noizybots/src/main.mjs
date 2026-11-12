#!/usr/bin/env node
// NOIZYBOTS: starts the Slack and Discord bots that are configured. Run on M2Ultra, next to NOIZYBRIDGE.
import { makeBridge } from "./core.mjs";
import { runSlack } from "./slack.mjs";
import { runDiscord } from "./discord.mjs";

if (!process.env.NOIZY_BRIDGE_KEY) { console.error("Set NOIZY_BRIDGE_KEY in the env file. Refusing to start."); process.exit(2); }
if (!process.env.NOIZY_BOT_USERS) { console.error("Set NOIZY_BOT_USERS (your Slack and Discord user ids). Refusing to start: the bot must know who RSP_001 is."); process.exit(2); }
const bridge = makeBridge();
runSlack({ bridge }); runDiscord({ bridge });
