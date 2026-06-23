import type { LLM } from "./llm";
import type { Executor } from "./executor/index";
import type { RunReport, HealAttempt, FoundBug } from "./types";
import { generateTest } from "./testgen";
import { attemptHeal } from "./heal";

export interface AgentOptions {
  llm: LLM;
  executor: Executor;
  spec: string;
  url: string;
  maxHeals?: number;
  onEvent?: (msg: string) => void;
}

/**
 * The self-healing test agent loop:
 *   generate → run → (fail?) diagnose → heal & re-run | report bug → repeat
 */
export async function runAgent(opts: AgentOptions): Promise<RunReport> {
  const { llm, executor, spec, url } = opts;
  const maxHeals = opts.maxHeals ?? 3;
  const log = (m: string) => opts.onEvent?.(m);

  const timeline: string[] = [];
  const heals: HealAttempt[] = [];
  const bugs: FoundBug[] = [];

  const push = (m: string) => {
    timeline.push(m);
    log(m);
  };

  push(`🧠 Generating test from spec via ${llm.name} LLM…`);
  const test = await generateTest(llm, spec, url);
  push(`📝 Test "${test.name}" — ${test.steps.length} steps.`);

  let attempts = 0;
  let healCount = 0;

  while (true) {
    attempts++;
    push(`▶️  Run #${attempts}…`);
    const result = await executor.run(test);

    if (result.status === "pass") {
      push(`✅ All steps passed on run #${attempts}.`);
      return { testName: test.name, url: test.url, finalStatus: "pass", attempts, heals, bugs, timeline };
    }

    const f = result.firstFailure!;
    push(`❌ Step "${f.stepId}" failed: ${f.error}`);

    if (healCount >= maxHeals) {
      push(`🛑 Heal budget exhausted (${maxHeals}). Stopping.`);
      return { testName: test.name, url: test.url, finalStatus: "fail", attempts, heals, bugs, timeline };
    }

    push(`🔎 Diagnosing (real bug vs. brittle selector)…`);
    const outcome = await attemptHeal(llm, test, result);
    push(`   ↳ ${outcome.diagnosisText}`);

    if (outcome.healed && outcome.attempt) {
      healCount++;
      heals.push(outcome.attempt);
      push(`🔧 Self-healed: "${outcome.attempt.originalSelector}" → "${outcome.attempt.suggestedSelector}". Re-running.`);
      continue;
    }

    if (outcome.bug) {
      bugs.push(outcome.bug);
      push(`🐞 Real bug filed: ${outcome.bug.description} — ${outcome.bug.reasoning}`);
      return { testName: test.name, url: test.url, finalStatus: "fail", attempts, heals, bugs, timeline };
    }

    push(`🤷 Inconclusive diagnosis — stopping for human review.`);
    return { testName: test.name, url: test.url, finalStatus: "fail", attempts, heals, bugs, timeline };
  }
}
