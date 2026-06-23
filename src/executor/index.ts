import type { TestCase, TestResult, RunReport } from "../types";

/**
 * An Executor runs a TestCase and reports per-step results. On failure it
 * captures a compact snapshot of the page's interactive elements so the
 * healer can propose a replacement selector.
 *
 * Swap implementations without touching the agent:
 *   - MockExecutor      → deterministic, no browser (demo / CI)
 *   - PlaywrightExecutor → real browser execution
 *   - UiPathExecutor     → routes execution through UiPath Test Cloud (hackathon)
 */
export interface Executor {
  run(test: TestCase): Promise<TestResult>;
  close(): Promise<void>;
  /** Optional: report the final agent outcome to an external system (e.g. UiPath Test Manager). */
  reportRun?(report: RunReport): Promise<void>;
}
