# organize: apps, tags and videos on M2Ultra

Three tools for NOI-113 (apps manifest), NOI-195 (app audit), NOI-91 (extensions) and NOI-122 (video).
Standard library only. **Run in Warp or Ghostty on M2Ultra.** Put the clicking 12 TB drive in `~/.noizy/skip-volumes.txt` first.

| Tool | Does | Writes? |
|---|---|---|
| `app_map.py` | Lists every app and editor extension, its category, and what it plugs into: **App Intents** (Siri, Shortcuts, Spotlight, Apple Intelligence), older Siri intents, Claude/Anthropic/MCP. Reads MCP configs (server **names** only). | Report only, to `~/.noizy/app-map/` |
| `app_tags.py` | Gives each app a Finder/Spotlight tag: `NOIZY Music`, `NOIZY Video`, `NOIZY Developer`… | Tags only with `--apply`; never removes your tags; skips /System |
| `video_sort.py` | Puts videos into `<dest>/YYYY/YYYY-MM/` by when they were **made** (video metadata, then Spotlight, then file name, then file date). | Moves only with `--apply`; same drive only; never overwrites or deletes; writes an undo list |

## Steps

1. `cd ~/NOIZYLAB/scripts/organize`
2. Map the apps: `python3 app_map.py`
3. Open the report it names (`~/.noizy/app-map/<time>.md`).
4. See the tag plan: `python3 app_tags.py ~/.noizy/app-map/<time>.json`
5. Tag them: `python3 app_tags.py ~/.noizy/app-map/<time>.json --apply`
6. In Finder or Spotlight, search `tag:NOIZY Music` to check.
7. See the video plan: `python3 video_sort.py ~/Movies/NOIZY-Sorted ~/Movies ~/Desktop`
8. Open the plan CSV. Check the dates. Rows marked `guess` used the file date.
9. Move them: add `--apply` to the same command.
10. To undo: the undo CSV lists every move (`moved_to`, `put_back_at`).

For better dates, install `ffprobe` once: `brew install ffmpeg`.

## Matching apps to Claude and Apple Intelligence

The app map sorts every app into one of four lanes:

| Lane | What the app has | How GABRIEL and LUCY reach it |
|---|---|---|
| **1. App Intents** | `Metadata.appintents` | Shortcuts and Siri now; Apple Intelligence; a Shortcut can call `services/talk`. |
| **2. MCP** | an MCP server (its own, or configured) | Claude Desktop, Claude Code and GABRIEL's MCP servers, directly. |
| **3. Both** | App Intents **and** MCP | Best case: voice through Siri, depth through Claude. |
| **4. Neither** | no hooks | AppleScript/Shortcuts UI only, or replace with a tool from lanes 1–3. |

Rules: read-only MCP first; a write tool needs a red-team profile in `redteam/agents/` first (CLAUDE.md).
Background: `docs/apple/APPLE-INTELLIGENCE-AND-LUNA.md`.

## Tests

`python3 -m unittest discover -s test -v`: categories, App Intents detection, MCP names never values,
tag plan (adds one, skips system and already-tagged), HALT fails closed, video dates (name, guess, bad 1970 clocks),
never overwrites, undo list, skip-volumes respected.
