// Core domain types shared across the agent, executors, and healer.

export type Action = "goto" | "click" | "type" | "expectText" | "expectVisible";

export interface Step {
  id: string;
  action: Action;
  description: string;
  /** CSS selector for click / type / expectVisible */
  selector?: string;
  /** text to type, expected text, or URL for goto */
  value?: string;
}

export interface TestCase {
  name: string;
  url: string;
  steps: Step[];
}

export type StepStatus = "pass" | "fail" | "skipped";

export interface StepResult {
  stepId: string;
  action: Action;
  status: StepStatus;
  error?: string;
  failedSelector?: string;
}

export interface TestResult {
  testName: string;
  status: "pass" | "fail";
  steps: StepResult[];
  firstFailure?: StepResult;
  /** Compact list of interactive elements present when a step failed. */
  pageSnapshot?: string;
}

export type Verdict = "REAL_BUG" | "BRITTLE_SELECTOR" | "UNKNOWN";

export interface Diagnosis {
  verdict: Verdict;
  confidence: number; // 0..1
  reasoning: string;
  suggestedSelector?: string;
}

export interface HealAttempt {
  stepId: string;
  originalSelector: string;
  suggestedSelector: string;
  applied: boolean;
  healed: boolean;
}

export interface FoundBug {
  stepId: string;
  description: string;
  reasoning: string;
  confidence: number;
}

export interface RunReport {
  testName: string;
  url: string;
  finalStatus: "pass" | "fail";
  attempts: number;
  heals: HealAttempt[];
  bugs: FoundBug[];
  timeline: string[];
}
