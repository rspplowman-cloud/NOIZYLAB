# QUARANTINE: do not run these on M2Ultra

**Found 2026-11-11** while bringing NOIZYLAB-io/NOIZYLAB home. These scripts change system settings, delete files,
or open remote access. They are kept for history only and are **no longer executable** (`chmod -x`).
Before any of them runs again: read it, cut it down to the one thing needed, give it a dry run, check HALT, and
put it through `redteam/` like any agent tool.

| Script | Why it is dangerous |
|---|---|
| `scripts/heal_optimize_run.sh` | **Turns Spotlight indexing OFF on every drive** (`mdutil -i off /Volumes/*`) and erases the main index. Breaks Spotlight tags; touches the clicking 12 TB drive. |
| `gabriel/system-scripts/m2ultra-boot-startup.sh` | **Turns on SSH and full Remote Desktop access at every boot.** Security hole. |
| `gabriel/system-scripts/interactive-session-manager.sh` | Can turn on SSH and Remote Desktop with full access. |
| `gabriel/projects/SystemGuardian/modules/aggressive_clean.sh` | `rm -rf ~/Library/Caches/*` and `/tmp/*`. |
| `gabriel/projects/SystemGuardian/modules/aggressive_repair.sh` | Erases the Spotlight index (`mdutil -E /`). |
| `gabriel/projects/SystemGuardian/modules/ultra_boost.sh` | Changes kernel memory settings (`sysctl -w vm.compressor`). |
| `gabriel/scripts/NETWORK_OPTIMIZER.sh` | Forces jumbo frames (MTU 9000) and replaces DNS servers. Can break the network. |
| `scripts/performance_tuner.sh` | Forces MTU 9000 on Ethernet and Thunderbolt Bridge. |
| `gabriel/scripts/DISTRIBUTE_MEDIA.sh` | Suggests MTU 9000 with `sudo`. |
| `scripts/reset_system_settings.sh` | Deletes System Settings caches and preferences (`defaults delete`). |
| `scripts/switch_finalize.sh` | Removes network address aliases with `sudo`. |
| `scripts/upgrade_macos.sh` | Re-registers every app with LaunchServices (`lsregister`); has macOS update lines. |
| `scripts/backup.sh` | Deletes all but the 10 newest backups (`xargs rm -rf`). |
| `gabriel/scripts/SYSTEM_AUDIT.sh` | Read-mostly, but asks for `sudo`. |
| `gabriel/system-scripts/interactive-enterprise-v2.sh` | Asks for `sudo` inside a large menu script. |
| `gabriel/PUSH_TO_GITHUB.sh` | Prints a `git push --force` command. |

Safe replacements already in NOIZYGIT-MASTER: `infra/m2ultra/allgreen.sh` (read-only health),
`scripts/organize/` (dry-run app map, tags, video sort), `infra/m2ultra/preflight.sh`.
