# NOIZY core stack on M2ULTRA

Forgejo + n8n (queue mode), ready to run. Linear: **NOI-174** (Forgejo), **NOI-175** (n8n), **NOI-171** (LUCY).

## Safety

- **All ports are bound to `127.0.0.1`.** Nothing is open to the network.
- The iPhone reaches it through **Cloudflare Tunnel + Access** (NOI-179). Never an open port.
- **Secrets live in `.env`** (gitignored), filled from Proton Pass. Never committed.
- `preflight.sh` checks **HALT first**. Unreachable means halted.

## Run it (on M2ULTRA, one line per step)

1. `cd infrastructure/m2ultra`
2. `cp .env.example .env`
3. Fill `.env` from Proton Pass. Make secrets with `openssl rand -hex 32`.
4. `bash preflight.sh` (must print ✅ clear)
5. `docker compose up -d`
6. `bash stack-health.sh` (writes a receipt to `receipts/`)
7. Open `http://localhost:3300` and create the **RSP_001** admin account.
8. Open `http://localhost:5678` and create the n8n owner account.

## What's in it

| Service | Port (localhost only) | Notes |
|---|---|---|
| Forgejo 15 (LTS, supported to Jul 2027) | 3300 web, 2222 SSH | Registration off. Actions on. Webhooks may only reach n8n |
| n8n main | 5678 | Queue mode, Postgres, Valkey |
| n8n workers | — | 4 to start (`N8N_WORKERS`), 10 jobs each |
| Postgres 16 | internal | n8n database |
| Valkey 8 | internal | Queue (BSD-licensed Redis fork) |

`stack-health.sh` also checks **LUCY** (MCP, port 9778) and **GABRIEL** (daemon, port 9777).

## Next steps (not in this PR)

- **Forgejo runner:** register it with a token from Forgejo → Site Administration → Actions → Runners. Then move `cf-watch` and the red team smoke test here.
- **Push mirror:** Forgejo → GitHub for every repo (GitHub becomes the backup).
- **n8n:** import the April 2026 workflow set, then add the Forgejo webhook → Linear flow.
- **LUCY on iPhone (NOI-171):** after the Tunnel is up.

## Licences

- Forgejo: GPL-3.0-or-later (free software).
- n8n: Sustainable Use Licence (fair-code, not OSI). Fine for internal use. FOSS exits: Windmill, Node-RED.
- Valkey: BSD-3. Postgres: PostgreSQL Licence.
