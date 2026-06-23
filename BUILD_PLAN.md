# Build plan — UiPath AgentHack (deadline Jun 29) → Qwen MemoryAgent (Jul 9)

## Strategy
One agent core, two hackathons. Win multiple **independent prize slots** from the UiPath build, then reuse the LLM/agent core for the Qwen MemoryAgent track.

### UiPath AgentHack — prize slots this ONE build is eligible for
- **Test Cloud track**: $5,000 / $3,000 / $2,000  ← primary (thinnest field)
- **Most Creative**: $3,000
- **Best Demo**: $3,000
- **Best Cross-Platform Integration**: $1,500  ← our MCP layer *is* the integration
- **Best First-Time Builder**: $1,500
- **Best Product Feedback**: $1,500
> Realistic target: land at least one. Six shots from one build.

## Status
- [x] Reusable agent core (generate → run → diagnose → heal → re-run)
- [x] Provider-agnostic LLM (mock / Anthropic / OpenAI)
- [x] Mock executor + key-free `npm run demo`
- [x] Playwright executor (real browser)
- [x] Demo app with renamed selector + `?bug=1` real-bug mode
- [ ] **UiPath Test Cloud executor** (`src/executor/uipath.ts`) — routes execution through UiPath (required)
- [ ] Live LLM run end-to-end against the demo app
- [ ] 3-min demo video
- [ ] Submission writeup mapped to each judging criterion
- [ ] Product-feedback writeup (for the $1,500 feedback prize)

## What YOU need to do (account-gated — I can't sign up for you)
1. Create a **UiPath Automation Cloud** account + enable **Test Cloud** → grab tenant URL, client id/secret.
2. Put LLM key + UiPath creds in `.env` (copy from `.env.example`).
3. Create a **public GitHub repo**, push this project (license already included).
4. (For submission) host the demo app somewhere public, or screen-record locally.

## UiPath integration (the required orchestration surface)
Add `src/executor/uipath.ts` implementing `Executor`:
- Auth to UiPath Orchestrator (client credentials) → bearer token.
- Map each `Step` to a UiPath Test Cloud action (or trigger a parameterized test process).
- Read results back; on failure, capture the page state and hand it to the existing `heal.ts`.
- The LLM "brain" + MCP tools stay exactly as-is — UiPath becomes the execution/orchestration layer, which satisfies the "primary orchestration = UiPath" rule.
*(I'll write this against the UiPath API docs once your tenant + creds are in `.env`.)*

## Demo video script (~3 min, this wins Best Demo)
1. `0:00` Problem: "teams abandon test automation because tests break when the UI changes, not the product." (10s)
2. `0:10` Show the spec in plain English → agent generates the test. (30s)
3. `0:40` Run it → it FAILS on the renamed button. (15s)
4. `0:55` Agent diagnoses **brittle selector**, rewrites the locator live, re-runs → **green**. (45s)
5. `1:40` Flip to `?bug=1` → same failure, but agent says **REAL_BUG** and files it (shows the judgment is real, not blind). (40s)
6. `2:20` Architecture: UiPath Test Cloud orchestration + MCP tool layer + LLM brain. (30s)
7. `2:50` Impact: hours of triage saved per sprint. (10s)

## Qwen MemoryAgent reuse (next)
Lift `src/llm.ts` + `src/agent.ts` as-is; swap the domain: build a persistent-memory MCP server (vector recall + summarize-on-write), deploy on Alibaba Cloud, demo Qwen calling the memory tools across sessions. Target: $7,000 cash track.
