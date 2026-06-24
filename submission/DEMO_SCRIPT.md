# Demo video — foolproof word-for-word script (~4–4.5 min, hard cap 5:00)

## Your recording setup
- **Terminal** in `~/Desktop/selfheal-qa/uipath-agent`, big font (Cmd-+ a few times).
- **Chrome window**, 2 tabs → Tab 1: UiPath YAN dashboard · Tab 2: GitHub repo.
- **Script on your PHONE** (AirDrop `RECORD-THIS.rtf`), so it never appears in the recording. Close TextEdit on the Mac before you record.
- Dry-run both `uipath run` commands once, then `Cmd-K` to clear the terminal.

This script deliberately covers the four things the rules ask the video to show: the solution **running**, the **architecture**, the **agent orchestration**, and **where humans fit**.

**Legend:** ▶ = paste into terminal · 👀 = watch for · 🎙️ = say this.

---

### 1) HOOK — *[Terminal on screen]*
🎙️ "Every QA team has the same nightmare: a test passes, the build ships, and a real bug reaches production anyway. And the irony is that self-healing — the thing meant to make automation reliable — can cause exactly that. A test that blindly patches itself can heal right past a real bug, turn green, and hide the regression. This is SelfHeal QA: an autonomous testing agent, built on UiPath, that heals the tests that are merely brittle — and refuses to heal the ones hiding a real bug. Let me show you both."

### 2) THE HAPPY PATH — heal a flaky locator
▶ Command 1 (`inject_bug: false`)
🎙️ "I give it a code change and a plain-English spec — no test scripts. First, on its own, it runs only the suites my change affects — one of four, not the whole suite — so you're not re-running everything on every commit. It writes the test, runs it in a real browser, and a step fails: the login button's id changed. It reads the live page, finds the same button under its new name, rewrites the locator, and re-runs. A flaky locator, not a bug — so it fixes it and moves on. Green. That's the maintenance that normally eats a QA engineer's whole morning, just gone."

### 3) THE DIFFERENTIATOR — refuse to heal a real bug
▶ Command 2 (`inject_bug: true`)
🎙️ "Now the same test, but this time login is genuinely broken. On the surface, the identical failure. A blind self-healer would just patch around it and ship the bug. Watch mine do the opposite. It refuses to heal — it recognizes a real regression, not a cosmetic change — and instead of masking it, files a defect straight into UiPath Test Manager, with its reasoning attached. That restraint, knowing when *not* to act, is the entire idea."

### 4) PROOF IN THE PLATFORM + WHERE HUMANS FIT — *[Chrome Tab 1: dashboard]*
👉 Open the failed run, then the defect.
🎙️ "And this is real, inside UiPath Test Manager — not a mockup. The passing run, the failing run, and the defect the agent filed, with the evidence: why it's a real bug, and the regression it refused to heal past. This is exactly where the human fits — you review the real bugs the agent surfaces, instead of hunting through a sea of false failures. The routine work is automated; the judgment stays human."

### 5) TRUST IT — the benchmark
▶ Command 3 (`benchmark.py`)
🎙️ "The obvious question: how do I trust it not to heal past a real bug? So I benchmarked it — sixteen labeled failures, including adversarial cases I built specifically to fool it: a real bug where the button still exists, a locator drift dressed up to look like an error. It never healed a real bug away. A zero-percent false-negative rate, and a hundred percent triage accuracy."

### 6) ARCHITECTURE — *[Chrome Tab 2: repo, scroll README]*
🎙️ "Under the hood, the whole thing runs as a UiPath coded agent — select, generate, run, triage, heal-or-file, report — deployed to Orchestrator, so the orchestration lives on the platform, not in a script on the side. It writes test cases, test sets, executions, and defects through the Test Manager API, with Claude making the bug-versus-brittleness call. And I built every line of it with Claude Code, through UiPath for Coding Agents."

### 7) CLOSE
🎙️ "Autopilot heals tests. SelfHeal QA heals them and knows when to stop — because the most dangerous bug is the one your tests quietly fixed for you. Thanks for watching."

---
**Timing:** ~3.3 min of narration + ~40s of command runtime + tab switches ≈ **4–4.5 min**, comfortably under the 5:00 cap. If you stumble, just re-say the line and trim.
