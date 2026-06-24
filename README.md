# SelfHeal QA: the test agent that knows when *not* to heal

> **UiPath AgentHack · Test Cloud track · first-time UiPath builder · built solo, end to end, with Claude Code.**

Brittle UI tests are the #1 reason teams abandon test automation. Self-healing fixes broken locators automatically, but it has a dangerous blind spot: **it can heal right past a real bug and ship the regression.**

**SelfHeal QA is a UiPath coded agent that heals brittle locators *and knows when not to*.** Give it a URL and a plain-English spec. It generates the test, runs it, and on failure it **triages the root cause**: `BRITTLE_SELECTOR` vs `REAL_BUG`. Brittle? It rewrites the locator from the live DOM and re-runs. Real bug? It **refuses to heal** and **files a defect in UiPath Test Manager** instead of masking it.

```
spec ─▶ generate ─▶ run ─▶ pass ✅
                      │
                    fail ❌ ─▶ triage (LLM)
                                 ├─ BRITTLE_SELECTOR ─▶ rewrite locator ─▶ re-run ↺
                                 └─ REAL_BUG ─────────▶ file defect in Test Manager 🐞
```

## See it in action
| Heal a brittle locator → green | Refuse a real bug → file a defect |
|---|---|
| ![Self-heals a flaky locator and passes](submission/screenshots/01-self-heal-pass.png) | ![Refuses to heal a real regression](submission/screenshots/02-refuse-to-heal-defect.png) |
| **Self-documenting runs in Test Manager** | **Source: Third Party + filed Defect** |
| ![Test Manager run history with self-documenting names](submission/screenshots/03-test-manager-runs.png) | ![Failed run, Third Party source, defect filed](submission/screenshots/04-defect-third-party.png) |
| **Adversarial benchmark: 0% false-negative, 16/16** | **Runs as a UiPath coded agent** |
| ![Benchmark: 0% false-negative rate, 16/16 triage accuracy](submission/screenshots/05-benchmark-16of16.png) | ![UiPath coded agent in the repo](submission/screenshots/06-coded-agent-repo.png) |

**Verified on the platform.** The published package ran as a **serverless Orchestrator job** (`Successful`), showing the agent's live timeline: self-heal the brittle locator, then refuse the real bug and file a defect.

![Orchestrator serverless job: Successful, with the agent's heal-and-refuse timeline](submission/screenshots/07-orchestrator-job.png)

## Why it's different from UiPath Autopilot
Autopilot for Testers self-heals. SelfHeal QA's novelty is **restraint**: it withholds healing when the failure is a genuine regression and turns that judgment into an auto-filed Test Manager defect. That goes straight at the biggest risk of autonomous QA: **silent regressions masked by over-eager healing.**

## Runs through the UiPath Platform
The orchestration is a **UiPath coded agent** (`uipath-agent/`, Python, scaffolded, run, and published with the `uipath` CLI; it calls UiPath **Identity** and **Test Manager v2** REST APIs directly): `select → generate → run → triage → heal/file-defect → report`. It runs via the UiPath runtime and is **published to the Orchestrator tenant feed** (`uipath pack` + `uipath publish --tenant`).

```bash
cd uipath-agent
.venv/bin/uipath run main '{"url":"https://demo.local/login","spec":"login and see Welcome back","inject_bug":true}'
# → self-heals the selector, catches the real bug, files a defect in Test Manager
```

## UiPath components used
- **Coded Agents** (Automation Cloud / Orchestrator): orchestration and agent logic on the platform
- **Test Manager** v2: test cases, test sets, executions, test-case logs, **defects**
- **Identity**: external-application client-credentials auth
- **UiPath for Coding Agents**: built entirely with **Claude Code**

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

**Verified on-platform run:** the published package was executed as a job on Orchestrator's **Default Serverless** runtime and completed **`Successful`** in 10.2s (job `d5d3c7f6-bd39-4417-ad2c-aa9bc78e7b28`), captured in [`submission/orchestrator-job.json`](submission/orchestrator-job.json).

Key-free demo (no API keys, mock execution): `npm run demo`.

## How it works
| Piece | Where | Job |
|---|---|---|
| Coded agent | `uipath-agent/main.py` | orchestration brain on UiPath: generate → run → triage → report |
| LLM triage | Claude (Anthropic) | bug-vs-brittleness and selector rewrite, with deterministic fallback |
| Test Manager client | `uipath-agent/main.py`, `src/executor/uipath.ts` | cases / sets / executions / logs / **defects** |
| Playwright executor | `src/executor/playwright.ts` | real-browser execution for the live demo |
| Agent loop / healer | `src/agent.ts`, `src/heal.ts` | self-heal loop + triage |

## License
MIT © 2026 Anthony Yanza
