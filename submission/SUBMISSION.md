# SelfHeal QA — Devpost description (Test Cloud track)

Paste the block between the markers into Devpost → "About the project". (Name & tagline are separate copy boxes in the guide.)

<!--PASTE-START-->
## The problem nobody admits about self-healing tests

Brittle UI tests are the #1 reason teams give up on test automation. Someone renames a button, the whole suite goes red overnight, and an engineer loses a morning figuring out whether anything's actually broken.

Self-healing was supposed to fix this. And it does — until you hit the worse problem it creates. A test that blindly heals itself can heal *right past a real bug*: it sees a failing step, patches around it, turns green, and quietly ships the regression. You find out when a customer does.

So the real bar isn't "tests that fix themselves." It's tests that know the difference between *the locator moved* and *the product is broken*.

## What it does

You hand it a code change and a plain-English description of what should work. From there it's on its own:

- It maps your changed files to the suites they touch — a changed-file → affected-suite heuristic — and runs only that slice (e.g. the login suite, not all four), instead of re-running everything on every change.
- It writes the test, runs it in a real browser, and the moment a step fails it stops and asks the real question: flaky locator, or genuine bug?
- Flaky locator → it reads the live page, rewrites the selector, and re-runs until it's green. Nobody touches it.
- Real bug → it refuses to heal. It logs the failure and files a defect in UiPath Test Manager with its reasoning attached, so a human sees the regression instead of it getting buried.

The whole loop runs as a UiPath coded agent, deployed to Orchestrator — the orchestration lives on the platform, not in a script off to the side.

## Why it's not just "Autopilot again"

UiPath already self-heals tests in Autopilot, so I didn't try to out-heal it — I went after its blind spot. The dangerous part of autonomous testing isn't the healing, it's the *over*-healing: the silent regression nobody catches. SelfHeal QA's entire personality is restraint. It heals when it's safe and pulls the alarm when it isn't.

## How do you know it doesn't heal past real bugs?

It's the question that kills every self-healing demo, so I answered it with a benchmark — and made it adversarial on purpose: **16 labeled failures, including look-alike cases built specifically to fool the triage** (a real bug where the button still exists but payment was declined; a locator drift dressed up with a scary-looking banner). The agent never healed a real bug away: a **0% false-negative rate** across 8 real regressions, and **100% triage accuracy** across all 16. Every heal also carries a confidence score, and anything it's unsure about gets flagged for a human instead of applied silently.

## How it's built

- A **UiPath coded agent** (Python, the `uipath` SDK) is the brain: select → generate → run → triage → heal or file → report. It runs through the UiPath runtime and is published to the Orchestrator tenant feed.
- **Claude** makes the triage call — bug vs. brittleness — and proposes the new selector from the page's live elements, with a deterministic fallback if the model's down.
- **UiPath Test Manager** is the system of record: test cases, sets, executions, pass/fail logs, and the filed defects.
- A **Playwright** executor drives a real browser for the demo, so you can watch a heal happen on an actual page.
- Built end to end with **Claude Code** through UiPath for Coding Agents.

## What's next

Run it as a pre-merge check on every pull request, move the browser execution onto UiPath's own UI automation, and teach triage a third category for flaky-vs-environmental failures.

Built **solo** for the **UiPath Test Cloud** track — and this is my **first time building on the UiPath platform**, start to finish with Claude Code through UiPath for Coding Agents.
<!--PASTE-END-->
