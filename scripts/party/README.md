# NOIZY PARTY: everything in one run

**One command brings every NOIZY tool to the same party, in the safe order.** Read only toward the drives.

| Step | Tool | Result |
|---|---|---|
| 1 | HALT | Unset or unreachable: nothing runs. |
| 2 | Drives | Every mounted drive, minus the skip-volumes (the clicking 12 TB drive) and system volumes. |
| 3 | `library_finder.py` | Original, mixed, unknown, commercial (with where to download again). |
| 4 | `talespin_finder.py` | TaleSpin narration and project files. |
| 5 | `catalog.py --push` | One file list in the private Forgejo repo NOIZY-CATALOG. n8n re-indexes it with local Ollama into Qdrant. |
| 6 | `workspace_plan.py` | Google Workspace shared-drive plan, original and mixed libraries only. |
| 7 | `allgreen.sh` | Every service on M2Ultra, HEAVEN included. |

Then **GABRIEL and LUCY** answer "where is …?" with `gabriel_files_ask` and `lucy_files_ask`
(set `NOIZY_ASK_KEY` in the env file; see `scripts/catalog/README.md`).

## Run it (on M2Ultra, in Warp or Ghostty)

1. Check `~/.noizy/skip-volumes.txt` lists the clicking 12 TB drive.
2. Load your env file (it holds `HALT_URL`).
3. `bash scripts/party/party.sh`
4. Or only some drives: `bash scripts/party/party.sh "/Volumes/EW" "/Volumes/MAG 4TB"`

Nothing is moved, renamed, uploaded or deleted. The only write outside `~/.noizy` is the catalog push to Forgejo.
Fully automated runs belong in Google Cloud Shell or CI, not on M2Ultra; this one reads M2Ultra's own drives, so it runs there.
