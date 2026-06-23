# SelfHeal QA — the test agent that fixes its own tests

**Brittle UI tests are the #1 reason teams abandon automation.** A button id changes, a class gets renamed, and overnight your green suite turns red — even though the product works fine. Engineers then waste hours triaging "is this a real bug, or just a flaky locator?"

**SelfHeal QA is an AI agent that does that triage — and the fix — for you.** Give it a URL and a plain-English acceptance spec. It writes the test, runs it, and when a step fails it decides: **real bug** → file it, or **brittle selector** → rewrite the locator and re-run, automatically.

```
spec ─▶ [generate test] ─▶ [run] ─▶ pass ✅
                              │
                            fail ❌
                              ▼
                        [diagnose] ──▶ REAL_BUG  ─▶ file bug 🐞
                              │
                       BRITTLE_SELECTOR
                              ▼
                   [rewrite locator] ─▶ re-run ↺
```

## Why it's different

- **It heals, it doesn't just flag.** Most tools detect flakiness; this one rewrites the broken locator from the live page's elements and proves the fix by re-running.
- **Bug vs. brittleness is the hard call** — and it's exactly where an LLM agent beats a static rule. SelfHeal reasons over the failure + the current DOM to make that judgment with a confidence score.
- **Pluggable execution.** The same agent brain runs on a mock (no browser), on Playwright, or orchestrated through **UiPath Test Cloud** — swap the `Executor`, nothing else changes.

## Quickstart (30 seconds, no API key)

```bash
npm install
npm run demo
```

The demo simulates an app whose login button id was renamed `#login-btn → #sign-in-btn`. Watch the agent fail, diagnose it as a brittle selector, rewrite it, and pass on the next run.

## Run against a real app

```bash
cp .env.example .env          # set LLM_PROVIDER + your key
npm run pw:install            # one-time: install Chromium
npm run run -- \
  --url "https://your-app.com/login" \
  --spec "A returning user can log in and see the welcome message." \
  --executor playwright --headed
```

Try the bundled demo app (`demo/buggy-app/index.html`): serve it, point `--url` at it, and add `?bug=1` to see the agent correctly classify a **real bug** instead of self-healing.

## How it works

| Piece | File | Job |
|---|---|---|
| Test author | `src/testgen.ts` | spec → structured `TestCase` |
| Agent loop | `src/agent.ts` | run → diagnose → heal/report → repeat |
| Healer | `src/heal.ts` | classify failure, rewrite locator |
| LLM layer | `src/llm.ts` | mock / Anthropic / OpenAI (provider-agnostic) |
| Executors | `src/executor/*` | Mock · Playwright · (UiPath Test Cloud) |

## License

MIT © 2026 Anthony Yanza
