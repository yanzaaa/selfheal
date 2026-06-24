# Demo video — foolproof word-for-word script (~4 min, hard cap 5:00)

## Your recording setup (I just opened these for you)
- A **Chrome window** with 2 tabs → **Tab 1:** UiPath YAN dashboard · **Tab 2:** your GitHub repo.
- A **Terminal** window already in `~/Desktop/selfheal-qa/uipath-agent`.

Before you record: make the terminal font big (**Cmd-+** a few times), start the screen recorder (**Cmd-Shift-5**), and **dry-run both commands once** so they're warm and you've seen them land clean.

**Legend:** ▶ = paste into terminal · 👀 = what to watch for · 🎙️ = say this (read it natural, not stiff).

---

### 1) HOOK — *[Terminal on screen]*
🎙️ "Brittle UI tests are the number one reason teams give up on test automation. Self-healing was supposed to fix that — but it's got a blind spot nobody talks about. A test that blindly heals itself can heal right past a real bug, turn green, and ship the regression to production. This is SelfHeal QA — a UiPath agent that knows the difference between a test that's broken and a product that's broken. Let me show you."

### 2) THE HAPPY PATH — heal a flaky locator
▶ Paste and hit Enter:
```
.venv/bin/uipath run main '{"url":"https://acme.app/login","spec":"A returning user logs in and sees the welcome message","changed_files":["src/auth/login.ts","src/session/token.ts"],"inject_bug":false}'
```
🎙️ *(as you paste)* "So here I'm running the agent on a code change that touches the login flow, and telling it in plain English what should work. Nothing's actually broken in this one."
👀 Wait ~15 seconds for it to finish. Look for: **`selection: 1/4`** → a **`Self-healed … -> …`** line → **`status: pass`**.
🎙️ *(point at `selection`)* "First thing it does on its own — it looks at what I changed and runs only the suite that change can affect. One of four, not all of them."
🎙️ *(point at the heal line)* "Then a step fails — the login button's id changed. It reads the live page, finds the same button under a new name, rewrites the selector, and re-runs. That's a flaky locator, not a bug — so it heals it and moves on. Green."

### 3) THE DIFFERENTIATOR — refuse to heal a real bug
▶ Paste and hit Enter:
```
.venv/bin/uipath run main '{"url":"https://acme.app/login","spec":"A returning user logs in and sees the welcome message","changed_files":["src/auth/login.ts","src/session/token.ts"],"inject_bug":true}'
```
🎙️ *(as you paste)* "Now the exact same test — except this time the login is genuinely broken. Same failure on the surface. Watch what it does differently."
👀 Wait ~15 seconds. Look for: **`Real bug … refusing to heal`** → **`Filed defect …`**.
🎙️ "It refuses to heal. It recognizes this is a real regression, not a cosmetic change — so instead of masking it, it files a defect straight into UiPath Test Manager. Knowing when *not* to heal: that's the whole point."

### 4) PROOF IN THE PLATFORM — *[Chrome → Tab 1: dashboard]*
👉 Click the Chrome window, **Tab 1** (the dashboard). Refresh if it's stale, then click into the failed execution and open the defect.
🎙️ "Here's the agent's work inside UiPath Test Manager — a passing run, a failing run, and the defect it filed, with its reasoning attached: why it's a real bug, and the regression it refused to heal past. A human just reviews this, instead of going hunting for it."

### 5) TRUST IT — the benchmark
👉 Click back to the **Terminal**.
▶ Paste and hit Enter:
```
.venv/bin/python benchmark.py
```
🎙️ *(as you paste)* "Now the question that kills every self-healing demo: how do I know it won't heal past a real bug? So I benchmarked it on sixteen labeled failures — including adversarial cases built specifically to fool it."
👀 Wait for the summary line (false-negative rate / accuracy).
🎙️ "Zero real bugs healed away — a zero-percent false-negative rate, and a hundred percent triage accuracy across all sixteen."

### 6) HOW IT'S BUILT — *[Chrome → Tab 2: GitHub]*
👉 Click the Chrome window, **Tab 2** (the repo). Scroll the README slowly.
🎙️ "The whole thing runs as a UiPath coded agent — select, generate, run, triage, heal or file, report — deployed to Orchestrator, with Claude making the triage call. And I built all of it with Claude Code, through UiPath for Coding Agents."

### 7) CLOSE
🎙️ "Autopilot heals tests. SelfHeal QA heals them and knows when to stop — because the most dangerous bug is the one your tests quietly fixed for you. Thanks for watching."

---
**Foolproof checklist:** ✅ both tabs in one Chrome window ✅ Terminal in `uipath-agent`, big font ✅ dry-ran both commands ✅ screen recorder rolling ✅ under 5:00. If a live run ever stalls, just stop, re-run it, or screen-record `submission/sample-run-*.json` as the backup.
