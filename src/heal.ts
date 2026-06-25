import type { LLM, DiagnoseContext } from "./llm";
import type { TestCase, TestResult, HealAttempt, FoundBug } from "./types";

export interface HealOutcome {
  healed: boolean;
  /** True when the deterministic guardrail refused to apply a heal and escalated to a human. */
  heldBack?: boolean;
  attempt?: HealAttempt;
  bug?: FoundBug;
  diagnosisText: string;
}

/**
 * The restraint guardrail — enforced in CODE, not just asked of the model.
 * A heal is APPLIED only when the model is confident AND the page does not look like a
 * real error/regression. Below the confidence floor, or when the snapshot shows an
 * error/alert state, the heal is withheld and the case is escalated to a human — because
 * a real bug frequently masquerades as a "drifted selector," and silently rewriting the
 * locator would heal right over the regression.
 */
export const HEAL_RESTRAINT = {
  minConfidence: 0.7,
  // Substrings in the page snapshot that signal a real error/regression state.
  errorSignals: ["error", "alert", "role=alert", "declined", "denied", "failure", "exception"],
};

export function snapshotLooksLikeError(snapshot: string): boolean {
  const s = (snapshot || "").toLowerCase();
  return HEAL_RESTRAINT.errorSignals.some((sig) => s.includes(sig));
}

/**
 * Triage a failed run: ask the LLM whether it's a brittle selector or a real bug.
 * If brittle AND the guardrail allows it, patch the offending step IN PLACE and report a
 * heal; if a real bug, surface it; if the guardrail blocks a low-confidence/error-state
 * heal, hold back and flag for human review. The agent decides whether to re-run.
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
    // RESTRAINT GUARDRAIL: never silently rewrite a locator on a shaky call.
    const lowConfidence = d.confidence < HEAL_RESTRAINT.minConfidence;
    const errorState = snapshotLooksLikeError(ctx.pageSnapshot);
    if (lowConfidence || errorState) {
      const why = lowConfidence
        ? `confidence ${Math.round(d.confidence * 100)}% is below the ${Math.round(HEAL_RESTRAINT.minConfidence * 100)}% floor`
        : "the page is in an error/alert state, which often signals a real regression, not a drifted selector";
      return {
        healed: false,
        heldBack: true,
        diagnosisText: `${text} — heal WITHHELD (${why}); escalated to a human instead of rewriting the locator.`,
      };
    }

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
