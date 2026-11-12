# Warp, wired to Siri

**Say "All green with NOIZY" on the iPhone, and Warp opens on M2Ultra and runs the job.** Fixed jobs only.

| Job | Runs | Siri |
|---|---|---|
| `noizytek-scan` | `python3 services/noizytek/noizytek.py scan` | "Run a job in Warp with NOIZY" → Drive scan |
| `allgreen` | `bash infra/m2ultra/allgreen.sh` | "All green with NOIZY" |
| `party` | `bash scripts/party/party.sh` | "Run a job in Warp with NOIZY" → NOIZY PARTY |

How: iPhone (NOIZYIntents `WarpJobIntent`) → NOIZYBRIDGE `POST /warp` (key, tailnet, HALT) → `open warp://launch/<job>.yaml`.

## Set up once on M2Ultra (Warp)

1. `mkdir -p ~/.warp/launch_configurations`
2. `cp ~/NOIZYLAB/infra/warp/launch_configurations/*.yaml ~/.warp/launch_configurations/`
3. In Warp, open the launch configuration menu: the three NOIZY jobs should be listed.
4. Test the link by hand once: `open "warp://launch/allgreen.yaml"`.
   - Warp now calls these "Tab Configs"; old launch configurations still work.
   - If the link does nothing in your Warp version, open the job from Warp's menu instead and tell Claude: the bridge
     will switch to Warp's newer Tab Config link.

Only these three files can be opened. To add a job: add its YAML here, add its name to `WARP_JOBS` in
`services/noizybridge/bridge.py`, and a test checks that the two lists match.
