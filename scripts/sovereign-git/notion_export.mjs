#!/usr/bin/env node
// Export every Notion page to Markdown, into a PRIVATE git repo (Forgejo on M2Ultra).
// One file per page, with its Notion id, link and last-edited time at the top.
// Name repairs (NOIZY.AI, NOIZYBEAST, NOIZYWORLD, M2Ultra) apply to the copies only, never to Notion.
//
//   node notion_export.mjs <out_dir>            dry run: lists pages
//   node notion_export.mjs <out_dir> --apply    writes the Markdown files and index.json
//
// Settings (from a chmod 600 env file): NOTION_TOKEN (read-only integration), HALT_URL.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { halted, repairNames, slug } from "./lib.mjs";

export function titleOf(page) {
  for (const p of Object.values(page.properties || {})) {
    if (p?.type === "title") return (p.title || []).map((t) => t.plain_text).join("") || "Untitled";
  }
  return "Untitled";
}

export async function listPages(notion) {
  const pages = [];
  let cursor;
  do {
    const r = await notion.search({ filter: { property: "object", value: "page" }, page_size: 100, start_cursor: cursor });
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return pages;
}

export function fileFor(page) {
  return `${slug(titleOf(page))}--${page.id.replace(/-/g, "").slice(0, 8)}.md`;
}

export function render(page, markdown) {
  const { text, fixes } = repairNames(markdown);
  const head = [
    "---",
    `notion_id: ${page.id}`,
    `notion_url: ${page.url}`,
    `last_edited: ${page.last_edited_time}`,
    `title: ${JSON.stringify(titleOf(page))}`,
    "---", "",
    `# ${repairNames(titleOf(page)).text}`, "",
  ].join("\n");
  return { body: head + text.trim() + "\n", fixes };
}

export async function exportAll({ notion, n2m, outDir, apply, log = console.log }) {
  const pages = await listPages(notion);
  const indexPath = join(outDir, "index.json");
  const old = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};
  const index = {};
  let written = 0, skipped = 0, fixes = 0;
  if (apply) mkdirSync(outDir, { recursive: true });
  for (const page of pages) {
    const file = fileFor(page);
    index[page.id] = { file, title: titleOf(page), last_edited: page.last_edited_time };
    if (old[page.id]?.last_edited === page.last_edited_time && existsSync(join(outDir, file))) { skipped++; continue; }
    if (!apply) { log(`would write ${file}`); continue; }
    const md = n2m.toMarkdownString(await n2m.pageToMarkdown(page.id)).parent || "";
    const r = render(page, md);
    writeFileSync(join(outDir, file), r.body);
    fixes += r.fixes; written++;
  }
  if (apply) writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  log(`${pages.length} pages: ${written} written, ${skipped} unchanged, ${fixes} name repairs${apply ? "" : " (dry run)"}`);
  return { pages: pages.length, written, skipped, fixes };
}

async function main() {
  const outDir = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!outDir || outDir.startsWith("--")) { console.error("Usage: node notion_export.mjs <out_dir> [--apply]"); process.exit(2); }
  if (await halted(process.env.HALT_URL)) { console.error("HALT is set or unreachable. Stopping."); process.exit(2); }
  if (!process.env.NOTION_TOKEN) { console.error("NOTION_TOKEN is not set. Load your env file first."); process.exit(2); }
  const { Client } = await import("@notionhq/client");
  const { NotionToMarkdown } = await import("notion-to-md");
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  await exportAll({ notion, n2m: new NotionToMarkdown({ notionClient: notion }), outDir, apply });
}
if (import.meta.url === `file://${process.argv[1]}`) main();
