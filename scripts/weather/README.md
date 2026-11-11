# Weather: the rain never blocks the lightning

Doctrine: `_mc96-common/gabriel/doctrine/LIGHTNING_AND_RAIN.md`. Picture: https://claude.ai/artifact/XEJN3zHK3RL6XRMfTKbsJv

- **Lightning:** RSP_001's voice command, switch press or key. It always comes first.
- **Thunder:** the live answer to it: a voice reply, a DreamChamber ask. It runs at normal priority.
- **Rain:** batch AI work (indexing, scans, embeddings). It runs in the background and steps aside instantly.

## Check and fix (on the Mac)

1. Check, read-only: `scripts/weather/weather.sh audit`
   - `STORM` means a rain job is running above background priority.
2. Fix every rain job now: `scripts/weather/weather.sh rain`
3. Start any batch job as rain: `scripts/weather/weather.sh run python3 scripts/noizyhive/hive.py ~`

- It only touches your own processes, and never kills anything.
- **Which jobs are rain:** `rain.list`, one pattern per line. Keep each pattern **specific**. A broad word like `index` would also catch the agent MCP servers (`index.js`), which answer live.

## Make it permanent (launchd)

| Template | Use for | Settings |
|---|---|---|
| `launchd/ai.noizy.rain.example.plist` | Scheduled or always-on batch jobs | `ProcessType Background`, `Nice 15`, low-priority disk |
| `launchd/ai.noizy.thunder.model-server.example.plist` | The local model server that answers live | `ProcessType Standard`, `Nice 5` |

1. Copy a template to `~/Library/LaunchAgents/`, and change `Label` and `ProgramArguments`.
2. Load it: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<file>.plist`
3. Remove it: `launchctl bootout gui/$(id -u)/<Label>`

**Don't put the model server in Background.** macOS would move inference to the efficiency cores, and every answer would slow down. Run its batch work (indexing, embeddings) as a separate rain job.

## Containers

`infra/m2ultra/docker-compose.yml` caps each container's CPUs and memory:

| Container | CPUs | Memory |
|---|---|---|
| n8n | 4 | 6 GB |
| Qdrant | 4 | 16 GB |
| Forgejo | 2 | 4 GB |
| cloudflared | 1 | 512 MB |

The M2 Ultra keeps most of its 24 cores and 192 GB for the voice and the models.

## Tested

- In the cloud session (Linux, so `nice` only, without macOS `taskpolicy`):
  - `audit` flagged a running NOIZYHIVE scan as STORM.
  - `rain` moved it to nice 15.
  - A live `lucy-mcp/index.js` was left at nice 0.
  - `run` started a job at nice 15.
- `taskpolicy` and the launchd templates need the Mac. **Not yet run on macOS.**
