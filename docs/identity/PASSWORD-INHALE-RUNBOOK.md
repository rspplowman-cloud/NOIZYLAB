# Password Inhale Runbook (M2Ultra → Proton Pass)

**Owner:** Robert Stephen Plowman (RSP_001)
**Asked for:** "Inhale all of the passwords on the M2Ultra" and align them with Proton Pass.
**Builds on:** `NOIZY-VAULT-SPEC.md` (secrets live in Proton Pass only).

---

## 1. The rule first

- **Passwords go into Proton Pass. Nowhere else.**
- **Not into D1 or R2.** Those are on Cloudflare. If the Cloudflare account is ever taken, every password would go with it.
- **D1 may hold an inventory.** That is a list of sites and accounts, **with no passwords** (section 6).
- **No agent ever sees a plaintext password.** Claude Code runs the inventory. Robert Stephen Plowman does the exports.
- **No deletions.** Export files are quarantined in an encrypted disk image.

## 2. Find where the passwords are (Claude Code can run this)

- Run the inventory script on the M2Ultra:
  1. `brew install gitleaks` (once).
  2. `cd NOIZYLAB`
  3. `scripts/vault/inhale_inventory.sh`
- It is **read-only**. It prints counts and file paths, never secrets.
- It writes `~/NOIZY-INHALE/inventory-<time>.md`.
- The report lists:
  - Each browser profile and how many logins it saved.
  - Password managers and authenticator apps installed.
  - How many items are in the macOS login keychain.
  - Credential files in the home folder (`.npmrc`, `.aws`, `.wrangler`, `.claude.json` and others).
  - Loose secrets in Desktop, Documents and Downloads (gitleaks, redacted).

## 3. Make the quarantine box (Robert Stephen Plowman)

- Exports are plain text. They must only ever exist inside an encrypted disk image.
  1. In Proton Pass, generate a strong password. Save it as `VAULT-OPS/inhale/disk-image`.
  2. In Terminal:
     `hdiutil create -size 500m -fs APFS -encryption AES-256 -volname NOIZY-INHALE ~/NOIZY-INHALE/inhale.dmg`
  3. Paste the password when asked.
  4. Open it: `hdiutil attach ~/NOIZY-INHALE/inhale.dmg`
  5. It appears as `/Volumes/NOIZY-INHALE`.
- **Save every export into `/Volumes/NOIZY-INHALE`.** Never the Desktop or Downloads.

## 4. Export from each source (Robert Stephen Plowman)

- Do only the sources the inventory found. One at a time.
- **Apple Passwords (iCloud Keychain):** Passwords app → File → Export All Passwords.
- **Chrome:** `chrome://password-manager/settings` → Export passwords. **Repeat for every profile.**
  - This also covers Google Password Manager, if Chrome is signed in to that Google account.
- **Edge:** Settings → Passwords → `…` menu → Export passwords.
  - This covers passwords synced to the Microsoft account.
- **Firefox:** `about:logins` → `…` menu → Export Passwords.
- **Brave, Arc, Vivaldi:** the same as Chrome, in each one's password settings.
- **Other managers (1Password, Bitwarden, LastPass and others):** use each app's export.
- **Keychain app passwords:** these do not export. Review them in Keychain Access. Copy only the ones you still use into Proton Pass by hand.

## 5. Import into Proton Pass (Robert Stephen Plowman)

1. Open `pass.proton.me` and sign in.
2. Settings → Import.
3. Pick the source type (Chrome, Safari, Firefox, Edge, 1Password and so on).
4. Choose the file from `/Volumes/NOIZY-INHALE`.
5. **Import each source into its own vault first** (for example `INHALE-chrome`). That keeps the clean-up traceable.
6. When all are in, open **Pass Monitor**. It shows weak, reused and breached passwords, and missing 2FA.
7. Merge the good entries into the real vaults. Archive the rest. Do not delete.
8. Close the box: `hdiutil detach /Volumes/NOIZY-INHALE`

## 6. After the import

- **Turn off "save passwords"** in every browser. Install the Proton Pass extension in each one instead.
- **Credential files** from the report: move each token into Proton Pass and load it through the secrets helper. Then rotate the token.
- **Authenticator codes:** move TOTP entries to Proton Authenticator. Authy cannot export, so re-enrol each site.
- **The encrypted image stays** in `~/NOIZY-INHALE/` as quarantine. Destroying it is your call, later.
- **Optional D1 inventory**, with no secret columns:

```sql
CREATE TABLE account_inventory (
  site          TEXT NOT NULL,   -- e.g. dash.cloudflare.com
  account       TEXT NOT NULL,   -- login name or email
  owner         TEXT NOT NULL,   -- icloud | rsp-noizy | other
  source        TEXT NOT NULL,   -- chrome | safari | edge | firefox | keychain | manual
  mfa           TEXT NOT NULL,   -- none | totp | passkey | sms
  pass_vault    TEXT,            -- Proton Pass vault name
  imported_at   TEXT NOT NULL,
  PRIMARY KEY (site, account)
);
```

## 7. Who does what

| Step | Who | Why |
|---|---|---|
| Inventory scan | Claude Code | Read-only, no secrets seen |
| Make the encrypted image | Robert Stephen Plowman | Needs your password |
| Exports | Robert Stephen Plowman | Each needs your Mac password or Touch ID |
| Proton Pass import | Robert Stephen Plowman | Signed in as you |
| Token moves and rotation | Claude Code, through the helper | One receipt per token |
| D1 inventory (optional) | Claude Code | No secret values |
