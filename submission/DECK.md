# Deck — SelfHeal QA (one section per slide; keep it visual, short)

**Slide 1 — Title**
SelfHeal QA
The testing agent that knows when *not* to heal.
UiPath Test Cloud track · built with Claude Code · github.com/yanzaaa/selfheal

**Slide 2 — The problem**
Brittle tests kill automation programs.
Self-healing fixes that — but blind healing hides real bugs and ships them.
Teams don't need tests that fix themselves. They need tests with judgment.

**Slide 3 — The idea**
An autonomous UiPath agent that makes two calls on its own:
1. Which tests a code change actually puts at risk.
2. When a failure is a flaky locator (heal it) vs. a real bug (file it).
Heal where it's safe. Raise the alarm where it counts.

**Slide 4 — See it**
Brittle locator → healed from the live page → green.
Real bug → not healed → defect filed in UiPath Test Manager.

**Slide 5 — The trust question**
"How do I know it won't heal past a real bug?"
Adversarial benchmark: 16 cases, incl. look-alikes built to fool it.
**0% false-negative rate** (real bugs healed away). 100% triage accuracy.
(Industry bar: under 5%.) Low-confidence heals flagged for a human.

**Slide 6 — How it's built**
Coded agent on UiPath (the orchestration) · Claude triage · Test Manager (cases, sets, executions, defects) · Playwright for real-browser runs. Deployed to Orchestrator.

**Slide 7 — Why it's different**
Autopilot heals. SelfHeal QA heals *and* refuses to heal real bugs — turning that restraint into auto-filed defects. It goes straight at the #1 risk of autonomous QA: silent regressions.

**Slide 8 — Impact**
Routine locator maintenance disappears.
Humans only look at the real bugs the agent surfaces.
Drops into existing Test Manager workflows.

**Slide 9 — Close**
The most dangerous bug is the one your tests quietly fixed for you.
SelfHeal QA knows when to stop.
Repo + demo links.
