# SelfHeal QA — the test agent that knows when *not* to heal

> **UiPath AgentHack · Test Cloud track · built end-to-end with Claude Code.**

Brittle UI tests are the #1 reason teams abandon test automation. Self-healing fixes broken locators automatically — but it has a dangerous blind spot: **it can heal right past a real bug and ship the regression.**

**SelfHeal QA is a UiPath coded agent that heals brittle locators *and knows when not to*.** Give it a URL and a plain-English spec. It generates the test, runs it, and on failure **triages the root cause** — `BRITTLE_SELECTOR` vs `REAL_BUG`. Brittle? It rewrites the locator from the live DOM and re-runs. Real bug? It **refuses to heal** and **files a defect in UiPath Test Manager** instead of masking it.

```
spec ─▶ generate ─▶ run ─▶ pass ✅
                      │
                    fail ❌ ─▶ triage (LLM)
                                 ├─ BRITTLE_SELECTOR ─▶ rewrite locator ─▶ re-run ↺
                                 └─ REAL_BUG ─────────▶ file defect in Test Manager 🐞
```

## Why it's different from UiPath Autopilot
Autopilot for Testers self-heals. SelfHeal QA's novelty is **restraint**: it withholds healing when the failure is a genuine regression and turns that judgment into an auto-filed Test Manager defect — directly attacking the biggest risk of autonomous QA: **silent regressions masked by over-eager healing.**

## Runs through the UiPath Platform
The orchestration is a **UiPath coded agent** (`uipath-agent/`, Python `uipath` SDK): `select → generate → run → triage → heal/file-defect → report`. It runs via the UiPath runtime and is **published to the Orchestrator tenant feed** (`uipath pack` + `uipath publish --tenant`).

```bash
cd uipath-agent
.venv/bin/uipath run main '{"url":"https://demo.local/login","spec":"login and see Welcome back","inject_bug":true}'
# → self-heals the selector, catches the real bug, files a defect in Test Manager
```

## UiPath components used
- **Coded Agents** (Automation Cloud / Orchestrator) — orchestration + agent logic on the platform
- **Test Manager** v2 — test cases, test sets, executions, test-case logs, **defects**
- **Identity** — external-application client-credentials auth
- **UiPath for Coding Agents** — built entirely with **Claude Code**

## Live browser demo (companion Playwright executor)
A TypeScript executor drives a real Chromium so you can watch the heal happen on an actual page:

```bash
npm install && npm run pw:install
cp .env.example .env          # set ANTHROPIC + UiPath creds
npm run run -- --url "file://$PWD/demo/buggy-app/index.html" \
  --spec "A returning user logs in and sees Welcome back" \
  --executor uipath --headed   # heals live + reports to Test Manager
```
Add `?bug=1` to the URL to see the agent correctly **file a defect** instead of healing.

Key-free demo (no API keys, mock execution): `npm run demo`.

## How it works
| Piece | Where | Job |
|---|---|---|
| Coded agent | `uipath-agent/main.py` | orchestration brain on UiPath: generate → run → triage → report |
| LLM triage | Claude (Anthropic) | bug-vs-brittleness + selector rewrite, with deterministic fallback |
| Test Manager client | `uipath-agent/main.py`, `src/executor/uipath.ts` | cases / sets / executions / logs / **defects** |
| Playwright executor | `src/executor/playwright.ts` | real-browser execution for the live demo |
| Agent loop / healer | `src/agent.ts`, `src/heal.ts` | self-heal loop + triage |

## License
MIT © 2026 Anthony Yanza
