# SelfHeal QA — Devpost submission content

**Paste these into your Devpost project page. Track: UiPath Test Cloud.**

---

## Project name
**SelfHeal QA — the test agent that knows when *not* to heal**

## Elevator pitch (one line)
A UiPath coded agent that generates UI tests from plain English, self-heals brittle locators, and — unlike blind self-healing — recognizes real regressions and files them as defects in UiPath Test Manager.

## The problem (Business Impact)
Brittle UI tests are the #1 reason teams abandon test automation. A renamed `id`, a moved button, and a green suite turns red overnight — even though the product works. Self-healing fixes that… but it introduces a *more dangerous* failure mode: **blind self-healing can "heal" right past a real bug**, silently masking a genuine regression and shipping it to production. QA leaders don't just want tests that fix themselves — they want tests that know the difference between "the locator drifted" and "the product is broken."

## What it does
Give it a target app and a plain-English acceptance spec. SelfHeal QA:
0. **(Proactive)** Given a code changeset, it first makes a **risk-based selection** — reasoning about which tests the change can affect and running only the relevant slice (e.g. *1 of 4 suites*, not the whole suite).
1. **Generates** a runnable UI test from the spec.
2. **Runs** it and, on failure, **triages** the root cause with an LLM: `BRITTLE_SELECTOR` vs `REAL_BUG`.
3. If it's a brittle locator → **rewrites the selector from the live DOM and re-runs** until green.
4. If it's a real regression → **does NOT heal**. It reports a failed execution and **auto-files a linked defect in UiPath Test Manager.**

The whole loop runs as a **UiPath coded agent** (orchestration on the UiPath Platform), writing test cases, test sets, executions, results, and defects into Test Manager.

## How it works (architecture)
- **UiPath Coded Agent (Python, `uipath` SDK)** — the orchestration brain. `select → generate → run → triage → heal/file-defect → report`. Runs via the UiPath runtime (`uipath run`) and is **published to the Orchestrator tenant feed** (`uipath pack` + `uipath publish --tenant`) — deployed, not just runnable.
- **LLM triage** — Anthropic Claude decides bug-vs-brittleness and proposes the corrected selector from the page's live elements (with a deterministic fallback).
- **UiPath Test Manager (v2 API)** — system of record: creates test cases, test sets, executions, test-case logs (pass/fail), and **defects** (`CreateDefectFromTestCaseLog`).
- **Companion Playwright executor (TypeScript)** — drives a real browser for the live demo, showing the heal happening on an actual page.
- **Built end-to-end with Claude Code** (UiPath for Coding Agents) — qualifies for the coding-agents bonus.

## UiPath platform usage
- **Coded Agents** on Automation Cloud / Orchestrator (the orchestration + agent logic runs through the platform).
- **Test Manager**: Test Cases, Test Sets, Test Executions, Test Case Logs, **Defects**.
- **Identity** client-credentials (external application) auth.
- Built with **Claude Code** via the UiPath coding-agents workflow.

## Why it wins the Test Cloud track (differentiation)
UiPath Autopilot for Testers already self-heals. SelfHeal QA's novelty is the **triage + restraint**: it's the agent that *withholds* healing when the failure is a real defect, and turns that judgment into an auto-filed Test Manager defect. It directly attacks the biggest risk of autonomous testing — **silent regressions masked by over-eager healing.**

## Proof it doesn't mask bugs (benchmark)
The one question that kills a self-healing pitch is *"how do we know it doesn't heal past a real bug?"* We answer it with a seeded benchmark (`uipath-agent/benchmark.py`): 10 labeled failures — 5 cosmetic locator drifts and 5 genuine regressions. Result: **100% triage accuracy and a 0% false-heal rate** (zero real bugs healed away; industry credibility bar is <5%). Every heal also carries a **confidence score**, and low-confidence heals are **flagged for human review** rather than applied silently — a full, auditable "what was healed and why" trail.

## How each judging criterion is met
| Criterion | How we hit it |
|---|---|
| Business Impact & Adoption | Prevents masked regressions (a real, expensive QA failure mode); plugs into existing Test Manager workflows |
| Platform Usage | Coded agent + Test Manager (cases/sets/executions/logs/defects) + Identity; built with Claude Code |
| Technical Execution | Clean agent loop, deterministic + LLM triage, robust API integration, exception-safe reporting |
| Completeness | End-to-end working prototype, public MIT repo + README, demo video, verified executions + defects |
| Creativity & Innovation | "Knows when *not* to heal" — restraint-as-a-feature; auto-defect-on-real-bug |
| Presentation | Tight 5-min demo showing heal + real-bug-catch live, plus dashboard evidence |
| Bonus: Coding Agents | Entire agent built with Claude Code via UiPath for Coding Agents |

## Challenges we ran into
- UiPath Test Manager v2 is RBAC/scope-gated; we mapped the exact application scopes empirically (incl. `TM.TestExecutions`, and that `invalid_scope` fails the whole token if any one scope name is wrong).
- A test execution must reference a **test set** (not loose test cases) — discovered via the API.
- Python's default `urllib` User-Agent is Cloudflare-blocked (403 error 1010) on the token endpoint; fixed with a real UA.

## Accomplishments
A working coded agent that, in one run, self-heals a brittle locator **and** files a real defect — verified live in Test Manager (executions + defects created by the agent).

## What's next
Schedule the deployed Orchestrator process as a pre-merge CI/CD gate; wire Playwright execution as a UiPath UI-automation tool; expand triage to a flaky-vs-environmental class.

## Links
- Repo: https://github.com/yanzaaa/selfheal
- Demo video: _[add link]_
- Presentation deck: _[add link]_
