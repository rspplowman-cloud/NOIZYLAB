// Slack, Socket Mode: an OUTBOUND WebSocket from M2Ultra to Slack. No public URL, no open port.
// Needs only the app-level token (xapp-…, scope connections:write) and one slash command, /noizy.
// The answer goes back in the acknowledgement, so it is visible only to the person who typed it.
import { handle } from "./core.mjs";

export async function onEnvelope(env, bridge, send, allowList) {
  if (env.type === "hello") return;
  if (env.type !== "slash_commands") { if (env.envelope_id) send({ envelope_id: env.envelope_id }); return; }
  const text = await handle(env.payload?.text, env.payload?.user_id, bridge, allowList);
  send({ envelope_id: env.envelope_id, payload: { response_type: "ephemeral", text } });
}

export async function runSlack({ token = process.env.SLACK_APP_TOKEN, bridge, fetchFn = fetch, WS = WebSocket, log = console.error } = {}) {
  if (!token) return log("Slack: SLACK_APP_TOKEN not set, Slack bot is off.");
  for (let wait = 1000; ; wait = Math.min(wait * 2, 60_000)) {
    try {
      const r = await (await fetchFn("https://slack.com/api/apps.connections.open", { method: "POST", headers: { authorization: `Bearer ${token}` } })).json();
      if (!r.ok) throw new Error(r.error || "connections.open failed");
      await new Promise((done) => {
        const ws = new WS(r.url);
        ws.onopen = () => { wait = 1000; log("Slack: connected."); };
        ws.onmessage = (m) => { let env; try { env = JSON.parse(m.data); } catch { return; }
          if (env.type === "disconnect") return ws.close();
          onEnvelope(env, bridge, (o) => ws.send(JSON.stringify(o))).catch((e) => log("Slack:", e.message)); };
        ws.onclose = done; ws.onerror = () => ws.close();
      });
    } catch (e) { log("Slack:", e.message); }
    await new Promise((r) => setTimeout(r, wait));
  }
}
