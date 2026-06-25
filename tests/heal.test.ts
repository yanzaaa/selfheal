import { describe, it, expect } from "vitest";
import { attemptHeal, snapshotLooksLikeError, HEAL_RESTRAINT } from "../src/heal";
import { runAgent } from "../src/agent";
import { MockLLM } from "../src/llm";
import { MockExecutor } from "../src/executor/mock";
import type { LLM, DiagnoseContext } from "../src/llm";
import type { TestCase, TestResult, Diagnosis } from "../src/types";

// A stub LLM that returns a fixed diagnosis (and reuses MockLLM's test generation).
class DiagLLM extends MockLLM {
  constructor(private diag: Diagnosis) {
    super();
    this.name = "diag-stub";
  }
  async diagnose(_ctx: DiagnoseContext): Promise<Diagnosis> {
    return this.diag;
  }
}

function freshTest(): TestCase {
  return {
    name: "Login",
    url: "http://app",
    steps: [{ id: "s4", action: "click", description: "Click login", selector: "#login-btn" }],
  };
}

function failResult(snapshot: string): TestResult {
  return {
    testName: "Login",
    status: "fail",
    steps: [],
    firstFailure: { stepId: "s4", action: "click", status: "fail", error: "not found", failedSelector: "#login-btn" },
    pageSnapshot: snapshot,
  };
}

const cleanSnapshot = "button#sign-in-btn (role: button, text: 'Sign in')";
const errorSnapshot = "div.banner (text: 'Payment declined')\nbutton#pay-now-v2 (role: button)";
const brittle = (confidence: number): Diagnosis => ({
  verdict: "BRITTLE_SELECTOR",
  confidence,
  reasoning: "renamed control",
  suggestedSelector: "#sign-in-btn",
});

describe("snapshotLooksLikeError", () => {
  it("flags an error/alert page state", () => {
    expect(snapshotLooksLikeError(errorSnapshot)).toBe(true); // 'declined'
    expect(snapshotLooksLikeError("a div [role=alert] is shown")).toBe(true);
  });
  it("does not flag a clean interactive snapshot", () => {
    expect(snapshotLooksLikeError(cleanSnapshot)).toBe(false);
  });
});

describe("attemptHeal — restraint guardrail (enforced in code)", () => {
  it("applies a confident heal on a clean page (selector rewritten in place)", async () => {
    const test = freshTest();
    const out = await attemptHeal(new DiagLLM(brittle(0.92)), test, failResult(cleanSnapshot));
    expect(out.healed).toBe(true);
    expect(out.heldBack).toBeFalsy();
    expect(out.attempt?.suggestedSelector).toBe("#sign-in-btn");
    expect(test.steps[0].selector).toBe("#sign-in-btn"); // actually mutated
  });

  it("WITHHOLDS a low-confidence heal and does NOT rewrite the locator", async () => {
    const test = freshTest();
    const out = await attemptHeal(new DiagLLM(brittle(HEAL_RESTRAINT.minConfidence - 0.05)), test, failResult(cleanSnapshot));
    expect(out.healed).toBe(false);
    expect(out.heldBack).toBe(true);
    expect(test.steps[0].selector).toBe("#login-btn"); // unchanged
  });

  it("WITHHOLDS even a confident heal when the page is in an error state", async () => {
    const test = freshTest();
    const out = await attemptHeal(new DiagLLM(brittle(0.97)), test, failResult(errorSnapshot));
    expect(out.healed).toBe(false);
    expect(out.heldBack).toBe(true);
    expect(test.steps[0].selector).toBe("#login-btn"); // never healed over a real error
  });

  it("files a real bug (no heal) on a REAL_BUG verdict", async () => {
    const test = freshTest();
    const out = await attemptHeal(
      new DiagLLM({ verdict: "REAL_BUG", confidence: 0.8, reasoning: "control absent, page errored" }),
      test,
      failResult(errorSnapshot),
    );
    expect(out.healed).toBe(false);
    expect(out.bug).toBeTruthy();
    expect(test.steps[0].selector).toBe("#login-btn");
  });

  it("treats confidence exactly at the floor as acceptable (gate is strictly-less-than)", async () => {
    const test = freshTest();
    const out = await attemptHeal(new DiagLLM(brittle(HEAL_RESTRAINT.minConfidence)), test, failResult(cleanSnapshot));
    expect(out.healed).toBe(true);
  });
});

describe("runAgent — full loop", () => {
  it("heals a renamed locator and the test then passes", async () => {
    const report = await runAgent({ llm: new MockLLM(), executor: new MockExecutor(), spec: "login", url: "http://app" });
    expect(report.finalStatus).toBe("pass");
    expect(report.heals.length).toBe(1);
    expect(report.heals[0].suggestedSelector).toBe("#sign-in-btn");
  });

  it("refuses a low-confidence heal: no heal applied, flagged for human review", async () => {
    const report = await runAgent({
      llm: new DiagLLM(brittle(0.5)),
      executor: new MockExecutor(),
      spec: "login",
      url: "http://app",
    });
    expect(report.finalStatus).toBe("fail");
    expect(report.heals.length).toBe(0);
    expect(report.timeline.some((t) => t.toLowerCase().includes("restraint"))).toBe(true);
  });

  it("files a bug when the diagnosis is a real bug", async () => {
    const report = await runAgent({
      llm: new DiagLLM({ verdict: "REAL_BUG", confidence: 0.85, reasoning: "feature broken" }),
      executor: new MockExecutor(),
      spec: "login",
      url: "http://app",
    });
    expect(report.finalStatus).toBe("fail");
    expect(report.bugs.length).toBe(1);
    expect(report.heals.length).toBe(0);
  });
});
