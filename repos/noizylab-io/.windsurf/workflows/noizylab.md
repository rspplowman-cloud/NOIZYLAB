---
description: NOIZYLAB
auto_execution_mode: 1
---

## Goal
NOIZYLAB workspace ready: rules active, agents loaded, storage split configured.

## Steps
1. Open workspace: `/Users/m2ultra/NOIZYLAB/AG_HOME.code-workspace`
2. Confirm `.windsurfrules` active (GORUNFREE protocol)
3. Sanity checks:
// turbo
   - `git status`
   - `python3 --version`
   - `./AGENTS/launch.sh list`

## Storage
- **Code** → GitHub: `NOIZYLAB-io/NOIZYLAB`
- **Media** → Google Drive: `NOIZYLAB_MEDIA/`

## Agents
- `./AGENTS/launch.sh gabriel` - Voice + Control
- `./AGENTS/launch.sh mc96` - Core Engine
- `./AGENTS/sync-media.sh push` - Media → Google Drive
