import type { LLM, DiagnoseContext } from "./llm";
import type { TestCase, TestResult, HealAttempt, FoundBug } from "./types";

export interface HealOutcome {
  healed: boolean;
  attempt?: HealAttempt;
  bug?: FoundBug;
  diagnosisText: string;
}

/**
 * Triage a failed run: ask the LLM whether it's a brittle selector or a real
 * bug. If brittle, patch the offending step IN PLACE and report a heal; if a
 * real bug, surface it. The agent decides whether to re-run.
 */
export async function attemptHeal(llm: LLM, test: TestCase, result: TestResult): Promise<HealOutcome> {
  const f = result.firstFailure;
  if (!f) return { healed: false, diagnosisText: "no failure to heal" };

  const ctx: DiagnoseContext = {
    test,
    failedStepId: f.stepId,
    failedSelector: f.failedSelector,
    errorMessage: f.error,
    pageSnapshot: result.pageSnapshot || "(no snapshot)",
  };

  const d = await llm.diagnose(ctx);
  const text = `${d.verdict} (${Math.round(d.confidence * 100)}%): ${d.reasoning}`;

  if (d.verdict === "BRITTLE_SELECTOR" && d.suggestedSelector && f.failedSelector) {
    const step = test.steps.find((s) => s.id === f.stepId)!;
    const original = step.selector!;
    step.selector = d.suggestedSelector; // self-heal: rewrite the locator
    return {
      healed: true,
      diagnosisText: text,
      attempt: {
        stepId: f.stepId,
        originalSelector: original,
        suggestedSelector: d.suggestedSelector,
        applied: true,
        healed: true,
      },
    };
  }

  if (d.verdict === "REAL_BUG") {
    const step = test.steps.find((s) => s.id === f.stepId);
    return {
      healed: false,
      diagnosisText: text,
      bug: { stepId: f.stepId, description: step?.description ?? "", reasoning: d.reasoning, confidence: d.confidence },
    };
  }

  return { healed: false, diagnosisText: text };
}
