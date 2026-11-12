# Actor Zero: RSP_001's own voice through the whole NOIZYVOX path

**Goal:** one real voice, with real consent, through every step: record → consent → use → receipt → payment.
The first person is Robert Stephen Plowman. When this works end to end, NOIZYVOX has a true story to show.

**Rule:** only RSP_001 gives consent for RSP_001's voice. Claude and the agents may prepare each step; they never
issue, change or revoke a consent token. SHIRL guards consent (`redteam/agents/SHIRL.json`).

## The six steps

| # | Step | Tool that exists today | Done when |
|---|---|---|---|
| 1 | **Record** 30 minutes of clean voice | `scripts/archive/voice_session.py` (copies takes to `~/NOIZY-VoiceSession/<date>/takes`) | Takes are on a healthy drive and in the encrypted backup |
| 2 | **Fingerprint** each take | `services/ledger` | Each take has a SHA-256 in the ledger |
| 3 | **Register** the actor | HEAVEN `POST /api/v1/actors` | `h17_actors` shows RSP_001 |
| 4 | **Consent token #1** | HEAVEN `POST /api/v1/consent-tokens`, by RSP_001 only | `h17_consent_tokens` shows one live token with its never-clauses |
| 5 | **One real use** (a short narration line) | HEAVEN `POST /api/v1/synth-requests` | The ledger (`h17_ledger`) shows the use, tied to the token |
| 6 | **Receipt and 75/25** | `services/covenant-math` | A receipt shows the split: 75% creator, 25% NOIZY |

Then **test the off switch:** revoke the token (`POST /api/v1/consent-tokens/:id/revoke`) and show that step 5 is refused.
That refusal is the most important demo NOIZYVOX has.

## Before you start

1. The HEAVEN key is in Proton Pass. It goes into the env file, never onto a command line.
2. Decide the never-clauses first, in plain words (for example: no political speech, no ads without approval,
   no AI training). They are part of the token.
3. Voice recordings are never-to-AI material unless the token says otherwise. Backups go through `cloud_rescue.sh`
   (encrypted) only.

## What is not built yet

- A simple screen to give and revoke consent by voice or one tap.
- Payment (Stripe Connect was the recommended rail; nothing is live).
- The waiting-list page is drafted, not live: `sites/noizyvox-voicebank/`.
