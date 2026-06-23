# Presentation deck content — SelfHeal QA

Drop into the AgentHack deck template (one section per slide). Keep it visual; this is the copy.

**Slide 1 — Title**
SelfHeal QA — the test agent that knows when *not* to heal.
Track: UiPath Test Cloud · Built with Claude Code · github.com/yanzaaa/selfheal

**Slide 2 — The problem**
- Brittle UI tests kill automation programs.
- Self-healing solves brittleness… but blind healing **masks real regressions** and ships them.
- QA needs healing *with judgment*.

**Slide 3 — The solution**
An autonomous UiPath coded agent: generate test → run → **triage (bug vs. brittle)** → heal *or* file a defect → report. Healing where safe, alarms where it matters.

**Slide 4 — Live demo (GIF/screens)**
1. Brittle locator → self-healed → green.
2. Real bug → **not healed** → defect auto-filed in Test Manager.

**Slide 5 — Architecture**
Coded Agent (orchestration on UiPath) · Claude triage · Test Manager (cases/sets/executions/**defects**) · Playwright executor for real-browser runs.

**Slide 6 — UiPath platform depth**
Coded Agents · Test Manager v2 (incl. Defects API) · Identity auth · Built end-to-end with Claude Code (coding-agents bonus).

**Slide 7 — Why it's different**
Autopilot heals. SelfHeal QA heals **and refuses to heal real bugs** — turning that restraint into auto-filed defects. It attacks the #1 risk of autonomous QA: silent regressions.

**Slide 8 — Impact + where humans fit**
- Eliminates routine locator maintenance.
- Humans review only the surfaced real defects — judgment where it counts.
- Plugs into existing Test Manager workflows.

**Slide 9 — What's next**
Orchestrator scheduled deployment · UiPath UI-automation execution tool · flaky/environmental triage class.

**Slide 10 — Close**
"Autonomous testing you can trust — because it knows when to heal and when to raise the alarm." Repo + demo links.
