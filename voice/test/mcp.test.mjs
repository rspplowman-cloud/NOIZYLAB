// The voice MCP server must start and answer over stdio, with no voice service running.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const server = new URL("../mcp/voice-mcp-server.js", import.meta.url).pathname;

test("voice MCP server lists its 7 tools and answers offline ones", async () => {
  const client = new Client({ name: "voice-test", version: "1" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [server],
    // Point at a port nothing listens on, so no real voice service is touched.
    env: { ...process.env, NOIZY_VOICE_PORT: "1", GABRIEL_VOICE: "off" },
  }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(),
      ["dazeflow_log", "empire_status", "voice_health", "voice_morning", "voice_personas", "voice_route", "voice_say"]);
    const status = await client.callTool({ name: "empire_status", arguments: {} });
    assert.ok(!status.isError, "empire_status works offline");
    assert.match(status.content[0].text, /75\/25|covenant/i);
  } finally {
    await client.close();
  }
});
