# Demo video script — SelfHeal QA (≤5 min)

Record screen + voiceover. Show it RUNNING (not slides). Platform: YouTube/Vimeo, unlisted is fine.
Rules require: show the solution running, the architecture, the agent orchestration, and where humans fit.

---

### 0:00–0:25 — The hook (problem)
> "Brittle UI tests are why teams give up on test automation. Self-healing fixes broken locators automatically — but it has a dangerous blind spot: it can heal *right past a real bug* and ship the regression. Meet SelfHeal QA — the test agent that knows when **not** to heal."

*(On screen: the demo login app.)*

### 0:25–1:40 — Self-heal in action (the happy path)
- Show the spec in plain English.
- Run the agent. Step fails on `#login-btn` (the app renamed it to `#sign-in-btn`).
- Voiceover as the triage prints: *"It diagnoses this as a brittle selector — the feature works, the locator drifted — rewrites it from the live DOM, and re-runs."*
- Show it go **green**.
- Command: `npm run run -- --url <demo> --spec "..." --executor playwright --headed` (live browser) or the coded agent run.

### 1:40–3:00 — The differentiator (real-bug path)
- Re-run against the buggy variant (`?bug=1`) where login genuinely breaks.
- Voiceover: *"Same failure shape — but this time the agent refuses to heal. It recognizes a real regression and files a defect in UiPath Test Manager instead of masking it."*
- Show terminal: `Self-healed …` then `REAL_BUG …` then `Filed defect …`.

### 3:00–3:50 — Through the UiPath Platform
- Switch to the **UiPath coded agent**: `uipath run main '{"url":"…","spec":"…","inject_bug":true}'`.
- Voiceover: *"The orchestration runs as a UiPath coded agent — generate, run, triage, heal, report — all through the platform."*
- Cut to **Test Manager → project YAN**: show the **Results Overview** with the pass + fail, the test cases/sets, and the **filed defect** linked to the failed execution.

### 3:50–4:30 — Architecture + where humans fit
- One architecture slide: Coded Agent (brain) → Claude triage → Test Manager (cases/sets/executions/**defects**) → Playwright (real-browser execution).
- Voiceover: *"Humans stay in the loop exactly where judgment matters: they review the auto-filed defects — the agent surfaces the real bugs instead of hiding them. Routine locator maintenance is fully automated away."*

### 4:30–4:55 — Close
- Voiceover: *"Built entirely with Claude Code on UiPath for Coding Agents. SelfHeal QA: autonomous testing you can actually trust, because it knows when to heal — and when to raise the alarm."*
- Show repo URL.

---
**Filming tips:** rehearse once so the live runs land cleanly; keep the terminal font large; pre-open the Test Manager dashboard tab so the cut is instant; total under 5:00.
