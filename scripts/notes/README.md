# Notes export (iPhone → Mac → rebuild)

iPhone notes and files sync to the Mac through iCloud. Export them on the Mac, then hand them over for the rebuild.

## Steps

1. On the iPhone: **Settings → your name → iCloud → Notes** is ON. Same for **iCloud Drive**.
2. On the Mac, open **Notes** once and wait for it to finish syncing.
3. Run the export: `osascript scripts/notes/export_all_notes.applescript`
4. If macOS asks to let Terminal control Notes, click **Allow**.
5. The notes land in `~/NOIZYBEAST/notes-export/`.
6. iPhone files are already on the Mac in **iCloud Drive**: `~/Library/Mobile Documents/com~apple~CloudDocs/`
7. Zip both: `cd ~/NOIZYBEAST && zip -r notes-export.zip notes-export`
8. Upload `notes-export.zip` to the Claude session.

## Rules

- **Read-only.** The script never edits or deletes a note.
- **Locked notes are skipped** and listed in `_skipped.txt`.
- **Never commit the export.** It stays private. Only the rebuilt, scrubbed output goes in the repo.
- Passwords, keys and personal data found during the rebuild go to Proton Pass (VAULT-OPS), not the repo.
