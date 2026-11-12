# NOIZYVOX voice-bank page (draft, NOT live)

One page with a waiting list. No scripts, no trackers, works by keyboard and Voice Control, light and dark.

- **Not deployed.** RSP_001 decides when and where (noizyvox.com is on Netlify, project `precious-cajeta-72c49a`).
- The form uses **Netlify Forms** (`data-netlify`), so sign-ups land in the Netlify dashboard. No database.
- **Every promise on the page must be true on the day it goes live:** consent for every use, the off switch,
  75%, no AI training without written consent. HEAVEN (v18.1) already does consent tokens and revocation.
- It says plainly that NOIZYVOX is not open yet and is not a medical service.
- Before going live: red-team smoke (`npm run smoke` in `redteam/harness`) and RSP_001's OK on the wording.
