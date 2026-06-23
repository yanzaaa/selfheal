# Demo video — word-for-word script (target 4:00, hard cap 5:00)

## Pull these up BEFORE you hit record
- **Terminal window**, big font (Cmd-+ a few times), already here:
  `cd ~/Desktop/selfheal-qa/uipath-agent`
- **Chrome Tab 1** — UiPath Test Manager (YAN dashboard):
  https://cloud.uipath.com/yanza/DefaultTenant/testmanager_/YAN/dashboard
- **Chrome Tab 2** — your repo: https://github.com/yanzaaa/selfheal
- Do ONE dry run of both commands first so they're warm and you know they're clean. If a live run ever hiccups while filming, the captured outputs in `submission/sample-run-*.json` are your backup to screen-record.

Read the **SAY** lines out loud, naturally — don't read them stiff. Brackets are what's on screen.

---

### 0:00 · [TERMINAL]
**SAY:** "Brittle UI tests are the number one reason teams give up on test automation. Self-healing was supposed to fix that — but it's got a blind spot nobody talks about. A test that blindly heals itself can heal right past a real bug, turn green, and ship the regression to production. This is SelfHeal QA — a UiPath agent that knows the difference between a test that's broken and a product that's broken."

### 0:25 · [TERMINAL — paste this, hit Enter]
```
.venv/bin/uipath run main '{"url":"https://acme.app/login","spec":"A returning user logs in and sees the welcome message","changed_files":["src/auth/login.ts","src/session/token.ts"],"inject_bug":false}'
```
**SAY (while it runs):** "I'm handing it a code change and a plain-English spec. First thing it does on its own — look at what I changed and run only the tests that change can touch. One suite out of four, not the whole thing. Then it writes the test and runs it in a real browser."
**SAY (when the heal line prints):** "A step just failed — the login button's id changed. It checks the live page, finds the same button under a new name, rewrites the selector, and re-runs. That's a flaky locator, not a bug — so it heals it and carries on. Green."

### 1:30 · [TERMINAL — paste this, hit Enter]
```
.venv/bin/uipath run main '{"url":"https://acme.app/login","spec":"A returning user logs in and sees the welcome message","changed_files":["src/auth/login.ts","src/session/token.ts"],"inject_bug":true}'
```
**SAY:** "Same test — but this time the login is actually broken. Watch what it does differently."
**SAY (when 'refusing to heal / Filed defect' prints):** "It refuses to heal. It recognizes this is a real regression, not a cosmetic change, so instead of masking it, it files a defect straight into UiPath Test Manager. That restraint — knowing when not to heal — is the whole point."

### 2:20 · [CHROME TAB 1 — UiPath dashboard]
*(Switch tabs. Show the Results Overview: a pass and a fail. Click into the failed execution / the defect.)*
**SAY:** "Here's the agent's work inside UiPath Test Manager — a passing run, a failing run, and the defect it filed, with its reasoning attached: why it's a real bug and the regression it refused to heal past. A human reviews this instead of going hunting for it."

### 3:00 · [TERMINAL — paste this, hit Enter]
```
.venv/bin/python benchmark.py
```
**SAY:** "Now the obvious question — how do I trust it not to heal past a real bug? So I benchmarked it. Ten labeled failures, five cosmetic, five real regressions. It got all ten right. A hundred percent triage accuracy, and zero real bugs healed away."

### 3:35 · [CHROME TAB 2 — GitHub repo]
*(Switch tabs, scroll the README slowly.)*
**SAY:** "The whole thing runs as a UiPath coded agent — select, generate, run, triage, heal or file, report — deployed to Orchestrator, with Claude making the triage call. And I built all of it with Claude Code, through UiPath for Coding Agents."

### 4:00 · [anywhere — your face cam or the repo]
**SAY:** "Autopilot heals tests. SelfHeal QA heals them and knows when to stop — because the most dangerous bug is the one your tests quietly fixed for you. Thanks for watching."

---
**Filming tips:** rehearse once end-to-end; keep the terminal font large; pre-open both Chrome tabs so the cuts are instant; if you stumble, just re-say the line — you can trim. Keep it under 5:00.
