// Discord, Gateway: an OUTBOUND WebSocket from M2Ultra to Discord. No public URL, no open port.
// Slash command /noizy with one text option. No message-reading intents: the bot never reads channel messages.
// Replies are ephemeral (flags 64): visible only to the person who typed the command.
import { handle } from "./core.mjs";
const API = "https://discord.com/api/v10";

export const COMMAND = { name: "noizy", description: "Ask M2Ultra: brief, drives, find <words>, run allgreen|scan|party", type: 1,
  options: [{ name: "command", description: "brief · drives · find <words> · run allgreen|scan|party", type: 3, required: true }] };

export async function registerCommand({ appId, token, fetchFn = fetch }) {
  const r = await fetchFn(`${API}/applications/${appId}/commands`, { method: "PUT",
    headers: { authorization: `Bot ${token}`, "content-type": "application/json" }, body: JSON.stringify([COMMAND]) });
  if (!r.ok) throw new Error(`Discord command registration failed (${r.status})`);
}

export async function onInteraction(i, bridge, fetchFn = fetch, allowList) {
  if (i.type !== 2 || i.data?.name !== "noizy") return;
  const user = i.member?.user?.id || i.user?.id;
  const text = i.data.options?.find((o) => o.name === "command")?.value || "help";
  const content = await handle(text, user, bridge, allowList);
  await fetchFn(`${API}/interactions/${i.id}/${i.token}/callback`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: 4, data: { content, flags: 64 } }) });
}

export async function runDiscord({ token = process.env.DISCORD_BOT_TOKEN, appId = process.env.DISCORD_APP_ID, bridge, fetchFn = fetch, WS = WebSocket, log = console.error } = {}) {
  if (!token || !appId) return log("Discord: DISCORD_BOT_TOKEN or DISCORD_APP_ID not set, Discord bot is off.");
  try { await registerCommand({ appId, token, fetchFn }); } catch (e) { log("Discord:", e.message); }
  for (let wait = 1000; ; wait = Math.min(wait * 2, 60_000)) {
    await new Promise((done) => {
      const ws = new WS("wss://gateway.discord.gg/?v=10&encoding=json");
      let beat, seq = null;
      ws.onmessage = (m) => { let p; try { p = JSON.parse(m.data); } catch { return; }
        if (p.s != null) seq = p.s;
        if (p.op === 10) {                                   // hello: start heartbeats, then identify with NO intents
          beat = setInterval(() => ws.send(JSON.stringify({ op: 1, d: seq })), p.d.heartbeat_interval);
          ws.send(JSON.stringify({ op: 2, d: { token, intents: 0, properties: { os: "macos", browser: "noizybots", device: "noizybots" } } }));
        } else if (p.op === 0 && p.t === "READY") { wait = 1000; log("Discord: connected."); }
        else if (p.op === 0 && p.t === "INTERACTION_CREATE") onInteraction(p.d, bridge, fetchFn).catch((e) => log("Discord:", e.message));
        else if (p.op === 7 || p.op === 9) ws.close(); };
      ws.onclose = () => { clearInterval(beat); done(); }; ws.onerror = () => ws.close();
    });
    await new Promise((r) => setTimeout(r, wait));
  }
}
