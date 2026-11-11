import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { halted, repairNames, slug } from "../lib.mjs";
import { plan, create } from "../forgejo_mirror.mjs";
import { exportAll, titleOf, fileFor } from "../notion_export.mjs";

test("HALT fails closed", async () => {
  assert.equal(await halted(""), true);
  assert.equal(await halted("http://h", async () => { throw new Error("down"); }), true);
  assert.equal(await halted("http://h", async () => new Response('{"halted":true}')), true);
  assert.equal(await halted("http://h", async () => new Response('{"halted":false}')), false);
});

test("name repairs touch only the wrong forms", () => {
  const r = repairNames("Noisy.ai and the Noisy Beast on M2ULTRA in the NOIZY Empire. A noisy room stays.");
  assert.equal(r.text, "NOIZY.AI and the NOIZYBEAST on M2Ultra in the NOIZYWORLD. A noisy room stays.");
  assert.equal(r.fixes, 4);
  assert.equal(repairNames("MACHINE_TOKEN_M2ULTRA").fixes, 0); // constant names keep caps
});

test("slugs are safe file names", () => {
  assert.equal(slug("NOIZY MCP & API Stack Map"), "NOIZY-MCP-API-Stack-Map");
  assert.equal(slug(""), "untitled");
  assert.equal(slug("../../etc/passwd"), "etc-passwd");
});

test("mirror plan skips repos that exist and creates private mirrors", async () => {
  const calls = [];
  const fetchFn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.endsWith("/NOIZY/NOIZYLAB")) return new Response("{}", { status: 200 });
    if (url.endsWith("/repos/migrate")) return new Response("{}", { status: 201 });
    return new Response("{}", { status: 404 });
  };
  const items = await plan({ repos: ["RSPNOIZY/NOIZYLAB", "RSPNOIZY/THE-GATHERING"], owner: "NOIZY", base: "http://f", token: "t", fetchFn });
  assert.deepEqual(items.map((i) => i.action), ["exists", "create"]);
  const s = await create({ item: items[1], owner: "NOIZY", base: "http://f", token: "t", githubToken: "g", fetchFn });
  assert.equal(s, 201);
  const body = JSON.parse(calls.at(-1).opts.body);
  assert.equal(body.private, true);
  assert.equal(body.mirror, true);
  assert.equal(body.clone_addr, "https://github.com/RSPNOIZY/THE-GATHERING.git");
});

const page = (id, title, edited) => ({
  id, url: `https://notion.so/${id}`, last_edited_time: edited,
  properties: { Name: { type: "title", title: [{ plain_text: title }] } },
});

test("Notion export: dry run writes nothing; apply writes, repairs, and skips unchanged", async () => {
  const pages = [page("aaaaaaaa-1111", "Noisy Beast plan", "2026-11-01"), page("bbbbbbbb-2222", "THE NOIZY TREE", "2026-11-02")];
  let searches = 0;
  const notion = { search: async () => (searches++, { results: pages, has_more: false }) };
  const n2m = { pageToMarkdown: async (id) => id, toMarkdownString: (id) => ({ parent: `Body of ${id} on M2ULTRA.` }) };
  const out = mkdtempSync(join(tmpdir(), "notion-"));
  const logs = [];
  const dry = await exportAll({ notion, n2m, outDir: join(out, "x"), apply: false, log: (l) => logs.push(l) });
  assert.equal(dry.written, 0);
  const first = await exportAll({ notion, n2m, outDir: out, apply: true, log: () => {} });
  assert.equal(first.written, 2);
  assert.equal(first.fixes, 2);
  const f = readFileSync(join(out, fileFor(pages[0])), "utf8");
  assert.match(f, /^---\nnotion_id: aaaaaaaa-1111/);
  assert.match(f, /# NOIZYBEAST plan/);
  assert.match(f, /on M2Ultra\./);
  const again = await exportAll({ notion, n2m, outDir: out, apply: true, log: () => {} });
  assert.equal(again.skipped, 2);
  assert.equal(readdirSync(out).length, 3); // 2 pages + index.json
  assert.equal(titleOf({ properties: {} }), "Untitled");
});
