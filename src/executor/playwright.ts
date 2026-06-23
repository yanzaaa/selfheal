import type { Executor } from "./index";
import type { TestCase, TestResult, StepResult } from "../types";

/**
 * Real browser executor. Playwright is imported lazily so mock-mode runs need
 * no browser install. Run `npm run pw:install` once before using this.
 */
export class PlaywrightExecutor implements Executor {
  private browser: any;
  private page: any;
  private readonly stepTimeoutMs: number;

  constructor(opts: { headless?: boolean; stepTimeoutMs?: number } = {}) {
    this.stepTimeoutMs = opts.stepTimeoutMs ?? 8000;
    this.headless = opts.headless ?? true;
  }
  private headless: boolean;

  private async ensure(): Promise<void> {
    if (this.page) return;
    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({ headless: this.headless });
    this.page = await this.browser.newPage();
  }

  async run(test: TestCase): Promise<TestResult> {
    await this.ensure();
    const steps: StepResult[] = [];
    let firstFailure: StepResult | undefined;

    for (const step of test.steps) {
      if (firstFailure) {
        steps.push({ stepId: step.id, action: step.action, status: "skipped" });
        continue;
      }
      try {
        await this.runStep(test, step);
        steps.push({ stepId: step.id, action: step.action, status: "pass" });
      } catch (err: any) {
        const r: StepResult = {
          stepId: step.id,
          action: step.action,
          status: "fail",
          error: String(err?.message ?? err).split("\n")[0],
          failedSelector: step.selector,
        };
        firstFailure = r;
        steps.push(r);
      }
    }

    return {
      testName: test.name,
      status: firstFailure ? "fail" : "pass",
      steps,
      firstFailure,
      pageSnapshot: firstFailure ? await this.snapshot() : undefined,
    };
  }

  private async runStep(test: TestCase, step: { action: string; selector?: string; value?: string }): Promise<void> {
    const t = this.stepTimeoutMs;
    switch (step.action) {
      case "goto":
        await this.page.goto(step.value || test.url, { timeout: t, waitUntil: "domcontentloaded" });
        return;
      case "type":
        await this.page.fill(step.selector!, step.value ?? "", { timeout: t });
        return;
      case "click":
        await this.page.click(step.selector!, { timeout: t });
        return;
      case "expectVisible":
        await this.page.waitForSelector(step.selector!, { state: "visible", timeout: t });
        return;
      case "expectText":
        await this.page.waitForFunction(
          (txt: string) => document.body.innerText.includes(txt),
          step.value ?? "",
          { timeout: t },
        );
        return;
      default:
        throw new Error(`unknown action: ${step.action}`);
    }
  }

  /** Compact, healer-friendly list of clickable/inputtable elements. */
  private async snapshot(): Promise<string> {
    return await this.page.evaluate(() => {
      const out: string[] = [];
      const els = document.querySelectorAll("button, a, input, [role=button], [data-testid]");
      els.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
        const testid = el.getAttribute("data-testid");
        const role = el.getAttribute("role");
        const text = (el.textContent || "").trim().slice(0, 40);
        out.push(
          `${tag}${id}` +
            (testid ? ` [data-testid=${testid}]` : "") +
            (role ? ` (role: ${role})` : "") +
            (text ? ` text: "${text}"` : ""),
        );
      });
      return out.slice(0, 40).join("\n");
    });
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
  }
}
