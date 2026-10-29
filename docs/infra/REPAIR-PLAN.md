# M2Ultra repair plan: gates, evidence, manifest

> Agreed by RSP_001, 2026-10-24. **Nothing is marked fixed without evidence:** a passing health check, a restore test, or a signed receipt.

## Run order (read-only first)

1. `bash noizy_litellm_audit.sh`: LiteLLM exposure. Read-only.
2. `bash noizy_estate_audit.sh`: estate audit. Read-only.
3. `bash install-stack.sh --dry-run`: **only if** it supports `--dry-run`. If it doesn't, read it first:
   - `sed -n '1,260p' install-stack.sh`
   - `grep -nE 'docker (compose|run)|docker volume|docker network|launchctl|rm |mv |git (push|reset)|curl.*\| *(ba)?sh' install-stack.sh`
4. **`noizy_rescue.sh` does not run** until its contents have been reviewed.

Attach the three reports. **Leave out:** API keys, bearer and OAuth tokens, private keys, `.env` contents, and daemon responses that contain user data.

## LiteLLM

- Malicious PyPI releases: **1.82.7** and **1.82.8**, published 24 March 2026 and live about 3 hours before PyPI quarantined them.
- If either was ever installed: **treat every credential reachable from that machine as stolen** and rotate it. That includes indirect installs through DSPy, CrewAI and similar.
- The Docker image did not carry the bad wheels. Still **pin it by digest** and check its provenance.
- No LiteLLM code is in this repo. It's mentioned once, as a proxy option, in `AGENT_SDK.md`.

## Approval gates (in this order only)

| Gate | Action | NOIZYLAB tool that fits |
|---|---|---|
| 1 | Read-only health checks | `hive-inhale.sh` (inhale), `inventory.py`, `hive.py`, `inhale_inventory.sh` |
| 2 | Backup creation | none yet |
| 3 | Backup restore rehearsal | none yet |
| 4 | MCP config quarantine | none yet |
| 5 | n8n workflow import, **disabled** | none yet |
| 6 | Forgejo repository creation | `infra/m2ultra` (Forgejo on 3300) |
| 7 | One low-risk Gitea → Forgejo API migration | none yet |
| 8 | Explicitly approved external integrations | `hive-inhale.sh --rescue --push` |

- `hive-inhale.sh --rescue` (without `--push`) writes only new git branches. It belongs **after gate 3**.
- `--apply` moves files. It belongs **after gate 3** as well.
- `--push` and the Cloudflare Tunnel are external, so they are **gate 8**.

## n8n guardrail (before any activation)

- [ ] The existing `~/.n8n/config` is preserved. `infra/m2ultra` mounts the **existing** data folder and does **not** set `N8N_ENCRYPTION_KEY`, so n8n keeps reading the key from that file.
- [ ] If `N8N_ENCRYPTION_KEY` is set anywhere, it **matches** the existing config.
- [ ] **Database matches.** `infra/m2ultra` uses n8n's built-in database (SQLite, in the data folder). **If today's n8n uses PostgreSQL**, add its `DB_TYPE=postgresdb` and `DB_POSTGRESDB_*` settings first. Otherwise n8n starts **empty**.
- [ ] The PostgreSQL database (if used) is backed up.
- [ ] Workflow exports are stored in Forgejo.
- [ ] The restore rehearsal is completed.
- [ ] An error workflow is attached.
- [ ] Every Google Drive, Gmail, Slack and Discord node is **disabled**.
- `n8n export --backup` covers workflows and credentials. A full backup also needs the whole `~/.n8n` folder and the database.
- **Never export decrypted credentials** outside an approved migration.

## Secrets policy

- **Now** (single person): **SOPS + age**, plus the macOS Keychain for local signing. Proton Pass (VAULT-OPS) stays the human vault.
- **Later** (multi-node or a team): OpenBao or Infisical, Prometheus + Grafana, Langfuse.

## Repair manifest (filled in from the reports)

```yaml
schemaVersion: "1.0"
owner: RSP_001
mode: staged_repair
broken:      [{ id, evidence, severity, repair }]
uncommitted: [{ repository, paths, recommendedCommit }]
recoverable: [{ artifact, source, checksum, restorePlan }]
atRisk:      [{ asset, reason, requiredBackup }]
blocked:     [{ action, reason, unblockCondition }]
```

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
