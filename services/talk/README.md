# talk: GABRIEL and LUCY by voice, from the iPhone

**Owner:** Robert Stephen Plowman (RSP_001). **Built:** 2026-11-11.

- Say **"Hey Siri, Gabriel"** or **"Hey Siri, Lucy"**.
- Talk. The reply is read aloud in **Kate** (British English).
- It keeps listening after each reply. Say **"goodbye"** to stop.
- Say **"note"** and an idea, and it is saved for GABRIEL at M2Ultra. Nothing is sent to Claude.
- Hands-free only. Set it up while parked. Never touch the phone while driving.

## How it works

```
iPhone Shortcut (Siri, CarPlay)
  -> Dictate Text
  -> POST https://talk.<your-subdomain>.workers.dev/talk   (phone key)
       -> HALT first (unset or unreachable = halted, and it says so)
       -> never-to-AI check (consent records, NOIZYKIDZ, passwords, the vault)
       -> "note ..." goes to the inbox, not to Claude
       -> Claude (GABRIEL or LUCY prompt, short spoken answers)
  -> Speak Text (voice: Kate)
```

- **Read-only.** No tools. It cannot deploy, send, change or delete anything.
- **Memory:** the last 12 turns, kept for 30 minutes, per agent.
- **Notes:** kept 30 days. GABRIEL reads them at `GET /notes`.
- **Keys:** the Claude key and the phone key live only in Cloudflare secrets and Proton Pass (VAULT-OPS).
  The phone holds only its own phone key, which can be changed at any time.
- **Model:** `claude-opus-5-5` at effort `low`, for quick replies. Change `MODEL` or `EFFORT` in `wrangler.jsonc`.
  If Claude declines a request, the server falls back to another model on its own (`fallbacks: "default"`).

## Part 1: put it online (once, at M2Ultra, in Warp)

1. Open **Warp**.
2. Go to the folder: `cd ~/NOIZYLAB/services/talk`
3. Install: `npm ci`
4. Sign in to Cloudflare in the browser: `npx wrangler login`
   - Pick the home account (the one with HEAVEN).
5. Make the memory store: `npx wrangler kv namespace create TALK_KV`
6. Open `wrangler.jsonc`. Paste the id it printed over `REPLACE_WITH_KV_ID`.
7. In the same file, set `HALT_URL` to the HALT worker's address.
8. Red-team gate: `cd ../../redteam/harness && npm run smoke`
   - Exit code 1 means **stop**. Do not deploy.
9. Back to the folder: `cd ../../services/talk`
10. Deploy: `npx wrangler deploy`
    - Write down the address it prints, like `https://talk.<name>.workers.dev`.

## Part 2: add the two secrets (dashboard, no command line)

1. In **Proton Pass**, make a new password, 40 characters. Name it **TALK_KEY (iPhone)**. Save it in VAULT-OPS.
2. Open **dash.cloudflare.com** → **Workers & Pages** → **talk** → **Settings** → **Variables and Secrets**.
3. Add a **Secret** named `TALK_KEY`. Paste the new Proton Pass password.
4. Add a **Secret** named `ANTHROPIC_API_KEY`. Paste your Claude API key from Proton Pass.
5. Click **Deploy**.
6. Check it: open `https://talk.<name>.workers.dev/health` in Safari. It should say `"ok":true`.

## Part 3: get Kate on the iPhone

1. **Settings** → **Accessibility** → **Spoken Content** → **Voices**.
2. Tap **English**, then find **Kate** (United Kingdom).
3. Download **Kate (Enhanced)** if offered. It sounds better.

## Part 4: build the "Gabriel" shortcut

Open the **Shortcuts** app. Tap **+**. Name it **Gabriel**. Add these actions, in order:

1. **Speak Text**: type `Gabriel here.` Tap the arrow. Set **Voice** to **Kate**.
2. **Dictate Text**: set **Stop Listening** to **After Pause**. Language **English (United Kingdom)**.
3. **If**: *Dictated Text* **contains** `goodbye`.
   1. Inside the If: **Speak Text** `Goodbye.` (voice Kate).
   2. Inside the If: **Stop This Shortcut**.
4. **End If** (added for you).
5. **Get Contents of URL**:
   1. URL: `https://talk.<name>.workers.dev/talk`
   2. Method: **POST**.
   3. Headers: add `Authorization` with the value `Bearer ` and then the TALK_KEY from Proton Pass.
   4. Request Body: **JSON**. Add `agent` = `GABRIEL`. Add `text` = *Dictated Text*.
6. **Speak Text**: *Contents of URL*. Voice **Kate**. **Wait Until Finished** on.
7. **Run Shortcut**: **Gabriel**. This keeps the conversation going.

## Part 5: build the "Lucy" shortcut

1. Press and hold the **Gabriel** shortcut. Tap **Duplicate**.
2. Rename it **Lucy**.
3. Change the first Speak Text to `Lucy here.`
4. In Get Contents of URL, change `agent` to `LUCY`.
5. Change the last action to **Run Shortcut: Lucy**.

## Part 6: test it while parked

1. Say **"Hey Siri, Gabriel"**. You hear "Gabriel here."
2. Say **"How are you?"** You hear a short answer in Kate.
3. Say **"Note: test note from the car."** You hear "Noted."
4. Say **"Goodbye."** It stops.
5. Do the same with **"Hey Siri, Lucy"**.

If something goes wrong, it tells you out loud:

| You hear | What it means |
|---|---|
| "HALT is on…" | HALT is set, or not reachable. Clear it at M2Ultra. |
| "Not allowed." | The phone key in the shortcut doesn't match `TALK_KEY`. |
| "My Claude key isn't working…" | Check `ANTHROPIC_API_KEY` in the dashboard. |
| "That one stays off AI…" | The words touched consent, NOIZYKIDZ, passwords or the vault. |

## Lose the phone?

1. In Proton Pass, make a new TALK_KEY.
2. Replace the `TALK_KEY` secret in the dashboard.
3. The old phone stops working at once.

## Voices

- **Kate, for both GABRIEL and LUCY, on the iPhone:** RSP_001's decision, 2026-11-11.
- Each shortcut starts by saying its name, so you always know who is talking.
- GABRIEL's own consented voice (`services/gabriel-voice`) runs on M2Ultra. It is not used here.

## Tests

`npm run typecheck` and `npm test`: agent names, the never-to-AI check, note capture, speech cleanup,
the phone key and HALT failing closed.
