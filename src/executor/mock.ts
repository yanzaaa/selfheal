import type { Executor } from "./index";
import type { TestCase, TestResult, StepResult } from "../types";

/**
 * Deterministic in-memory executor. Simulates an app whose login button id was
 * renamed from #login-btn → #sign-in-btn, so a test written against the old id
 * fails — until the healer rewrites it. No browser, no network.
 */
export class MockExecutor implements Executor {
  /** Selectors that actually exist in the (renamed) app right now. */
  private actual = new Set(["#username", "#password", "#sign-in-btn"]);

  async run(test: TestCase): Promise<TestResult> {
    const steps: StepResult[] = [];
    let firstFailure: StepResult | undefined;

    // Did the test successfully click a real submit control? (gates the welcome text)
    const clickedValidSubmit = test.steps.some(
      (s) => s.action === "click" && s.selector !== undefined && this.actual.has(s.selector),
    );

    for (const step of test.steps) {
      if (firstFailure) {
        steps.push({ stepId: step.id, action: step.action, status: "skipped" });
        continue;
      }

      let r: StepResult = { stepId: step.id, action: step.action, status: "pass" };

      const needsEl = step.action === "click" || step.action === "type" || step.action === "expectVisible";
      if (needsEl && step.selector && !this.actual.has(step.selector)) {
        r = {
          stepId: step.id,
          action: step.action,
          status: "fail",
          error: `selector "${step.selector}" not found on page`,
          failedSelector: step.selector,
        };
      }

      if (step.action === "expectText" && !clickedValidSubmit) {
        r = {
          stepId: step.id,
          action: step.action,
          status: "fail",
          error: `expected text "${step.value}" not present (login did not complete)`,
        };
      }

      if (r.status === "fail") firstFailure = r;
      steps.push(r);
    }

    return {
      testName: test.name,
      status: firstFailure ? "fail" : "pass",
      steps,
      firstFailure,
      pageSnapshot: firstFailure ? this.snapshot() : undefined,
    };
  }

  private snapshot(): string {
    return [
      "input#username (placeholder: 'Email')",
      "input#password (placeholder: 'Password')",
      "button#sign-in-btn (role: button, text: 'Sign in')",
    ].join("\n");
  }

  async close(): Promise<void> {}
}
