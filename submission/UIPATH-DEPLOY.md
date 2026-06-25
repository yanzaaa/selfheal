# SelfHeal QA — publish to UiPath Automation Cloud (on-platform proof)

You're in the `hackathon26_975` tenant (staging.uipath.com). Goal: publish the **latest** agent and run it on-platform, then screenshot the proof. ~10 minutes.

The package is already rebuilt with the latest code: `uipath-agent/.uipath/selfheal-qa-agent.0.2.0.nupkg` (v0.2.0 includes the confidence-gate-BLOCKS fix). The v0.1.0 package was stale — use 0.2.0.

## 1. Authenticate to the hackathon tenant
```bash
cd ~/Desktop/selfheal-qa/uipath-agent
.venv/bin/uipath auth
```
- A browser window opens. Sign in as Anthony Yanza and **pick the `hackathon26_975` tenant** (the one from the invite). This writes the auth token locally.

## 2. Publish the latest package
```bash
# packs + publishes in one step (uses pyproject version 0.2.0):
.venv/bin/uipath deploy
# OR, if it's already packed, just publish the built package:
.venv/bin/uipath publish
```
- If it asks where to publish, choose your tenant / personal workspace (Orchestrator).
- **Manual fallback (if the CLI publish errors):** Orchestrator → Tenant → Packages → Upload → pick `uipath-agent/.uipath/selfheal-qa-agent.0.2.0.nupkg`.

## 3. Run it on-platform (this is the proof)
Sample inputs already exist in `submission/`. The agent input is `{ url, spec, inject_bug? }`.
- **From the CLI (fastest):**
  ```bash
  .venv/bin/uipath invoke main --file ../submission/input-bug.json
  .venv/bin/uipath invoke main --file ../submission/input-clean.json
  ```
- **Or in the UI:** Orchestrator → Agents (or Processes) → SelfHeal QA → Start, paste a sample input from `submission/input-bug.json`.

The **money moment** to capture: the `input-bug.json` case is a real defect — the agent **refuses to "heal" it** and files it as a defect (it doesn't paper over a real regression). The `clean` case self-heals a brittle locator and passes.

## 4. Capture the proof screenshots (for Devpost)
- The Agent/Process run in Orchestrator (job succeeded, with the agent's decision).
- A **Test Manager** run if you wire it there (you already have `03-test-manager-runs.png` from before — a fresh one on this tenant is even better).
- The published package showing **v0.2.0** in Orchestrator → Packages.

These replace the "decoupled" on-platform claim with live proof on the hackathon tenant. Add them to the Devpost gallery.

## Notes
- Everything above runs on **your** account — that's why it's yours to do, not the overnight agent's.
- If `uipath auth` / `deploy` hit a tenant-selection snag, tell me the exact message in the morning and I'll debug it with you.
