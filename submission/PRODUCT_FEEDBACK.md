# UiPath product feedback — from building SelfHeal QA

Honest, specific feedback from building a coded agent end-to-end with Claude Code against
Automation Cloud, the Test Manager v2 API, and the `uipath` CLI/SDK. (For the Best Product
Feedback award — paste the relevant points into the official feedback form.)

## What worked really well
- **Coded agents are a genuinely great DX.** `uipath new` → typed `main(Input) -> Output` → `uipath run` is clean, and running the agent through the UiPath runtime locally made iteration fast.
- **`uipath auth` unattended (client-credentials)** is excellent for automation — one command, no browser, works headless.
- **UiPath for Coding Agents / Claude Code** integration is the right bet: the installed `.agent` skill docs (SDK_REFERENCE, CLI_REFERENCE) let the coding agent self-serve the API surface.
- **Test Manager v2 API is comprehensive** — once you find the right calls, the full lifecycle (test case → set → execution → log → defect) is all there.

## Friction we hit (with concrete fixes)
1. **`invalid_scope` is all-or-nothing.** Requesting a token with several scopes fails entirely if *one* scope name is wrong, with no indication which. We had to probe scopes one-by-one. *Fix: return which scope(s) were rejected, or ignore-and-warn on unknown scopes.*
2. **Scope names are hard to discover.** The valid Test Manager app scopes (`TM.TestCases`, `TM.TestSets`, `TM.TestExecutions`, `TM.Defects`, …) aren't surfaced where you create the external app or in the token error. `TM.TestExecutions` (plural) is required for executions but easy to miss. *Fix: list grantable scopes per resource in the External Applications UI and link them to API operations.*
3. **A test execution requires a test set.** Posting `testCaseIds` alone to `/testexecutions` returns a 500 (not a 400 with guidance). *Fix: validate and return a clear 400 ("testSetId required"), and document the case → set → execution → log → defect sequence in one place.*
4. **Cloudflare blocks default `urllib` User-Agent (403, error 1010)** on `identity_/connect/token`. Coded agents using stdlib HTTP hit this immediately. *Fix: allow-list the SDK/runtime UA, or document that a UA header is required.*
5. **Coded-agent publish via client-credentials 403s** on `GetCurrentUserExtended` (personal workspace), even when the tenant feed is selectable. *Fix: make `uipath publish` work with an app-scoped token to a tenant feed without needing a user/personal-workspace read, or clearly document the required OR scopes/role.*
6. **`uipath publish` is interactive-only** (prompts for feed). *Fix: add `--feed` and `--yes` flags for CI/coding-agent use.*
7. **Defect creation is log-linked only** (`CreateDefectFromTestCaseLog`) — great, but it would help to optionally pass a title/description/severity for richer auto-filed defects from agents.

## Net
The coded-agents + Test Manager combination is powerful and the right direction for agentic testing. The main gaps are **discoverability of scopes** and **non-interactive/headless publish** — both squarely in the path of the coding-agent workflows UiPath is promoting.
