# M2Ultra stack

n8n, Qdrant and Forgejo in Docker. Cloudflare Tunnel for HTTPS. Models run natively on the Mac.

## What runs where

| Service | Where | Local address | Public address |
|---|---|---|---|
| Ollama (or LM Studio) | **Native macOS app**, for the M2 Ultra GPU | `127.0.0.1:11434` | none |
| n8n | Docker | `127.0.0.1:5678` | `https://n8n.noizylab.ca` |
| Qdrant | Docker | `127.0.0.1:6333`, `:6334` | none |
| Forgejo | Docker | `127.0.0.1:3300` | `https://git.noizylab.ca` |
| cloudflared | Docker | none | carries the two public names |

- Every port is bound to `127.0.0.1`. Nothing is open to the network.
- Containers talk by name on `noizy-mesh`, e.g. `http://qdrant:6333`.
- Containers reach the native model server at `http://host.docker.internal:11434`.

## Before you start

0. **Follow the gates in `docs/infra/REPAIR-PLAN.md`.** Clear the n8n guardrail first. If today's n8n uses **PostgreSQL**, add its database settings before the first start, or n8n comes up empty.
1. **Check HALT.** If HALT is set or unreachable, stop.
2. **Back up the data folders** your current containers use.
3. **Stop the old stack**, the one with the Ollama container and Gitea on 3000.

## Start it

1. Install and open the **Ollama Mac app** (not the Docker image).
2. Go to the folder: `cd NOIZYLAB/infra/m2ultra`
3. Make your settings file: `cp .env.example .env`
4. Open `.env` and fill in:
   - `FORGEJO_TAG`: the current stable version from forgejo.org/releases.
   - `N8N_DATA_DIR`, `QDRANT_DATA_DIR`, `FORGEJO_DATA_DIR`: your **existing** data paths.
   - `CLOUDFLARE_TUNNEL_TOKEN`: from Proton Pass (VAULT-OPS).
5. Check the file reads correctly: `docker compose config`
6. Start it: `docker compose up -d`
7. Check it is running: `docker compose ps`

## Cloudflare Tunnel

In the Cloudflare dashboard, go to Zero Trust, then Networks, then Tunnels. Add two public hostnames to the tunnel:

1. `n8n.noizylab.ca` → `http://n8n:5678`
2. `git.noizylab.ca` → `http://forgejo:3000`

Port 3000 is right here: it is Forgejo's port **inside** Docker. Port 3300 is only for the Mac itself.

## Moving from Gitea to Forgejo

- Forgejo can read a Gitea data folder, but **only from a Gitea version it supports**. Check the Forgejo upgrade notes for your Gitea version first.
- Keep a backup of the Gitea folder until Forgejo is proven.
- Point workflows that used `:3000` at `:3300` (Mac) or `http://forgejo:3000` (inside Docker).

## Not covered yet

- **Local-only rule for private data.** Nothing here stops a workflow from calling a cloud API. That needs an n8n policy, or an egress block.
- **The n8n workflows.** The three workflow definitions and their credentials must already be in `N8N_DATA_DIR`, or be imported.
