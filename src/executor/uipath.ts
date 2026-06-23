import type { Executor } from "./index";
import type { TestCase, TestResult, RunReport } from "../types";
import { PlaywrightExecutor } from "./playwright";

/**
 * UiPath Test Cloud executor — the required "primary orchestration" surface for
 * the UiPath AgentHack submission.
 *
 * Design: real browser steps run via Playwright (the actual execution), while
 * UiPath Test Manager is the orchestration / system-of-record layer:
 *   1. authenticate to UiPath Identity (client-credentials)   ← real, works now
 *   2. verify connectivity against the Test Manager project    ← real, works now
 *   3. report each run (pass/fail + self-heals) into Test Manager so the
 *      project dashboard reflects the agent's activity         ← see report()
 *
 * Auth + connectivity are live as soon as your .env creds are filled. The exact
 * results-write payload is finalized against your tenant's Swagger
 * (`/testmanager_/swagger/index.html`) — a 5-minute step once creds exist.
 */
interface UiPathConfig {
  baseUrl: string; // https://cloud.uipath.com
  org: string; // account/org logical name, e.g. "yanza"
  tenant: string; // e.g. "DefaultTenant"
  project: string; // Test Manager project key, e.g. "YAN"
  clientId: string;
  clientSecret: string;
  scope: string; // space-separated APPLICATION scopes (must be a subset of granted)
}

function cfgFromEnv(): UiPathConfig {
  const need = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`Missing ${k} in .env — fill your UiPath external-app credentials.`);
    return v;
  };
  return {
    baseUrl: process.env.UIPATH_BASE_URL || "https://cloud.uipath.com",
    org: need("UIPATH_ACCOUNT"),
    tenant: need("UIPATH_TENANT"),
    project: process.env.UIPATH_PROJECT || "",
    clientId: need("UIPATH_CLIENT_ID"),
    clientSecret: need("UIPATH_CLIENT_SECRET"),
    scope: process.env.UIPATH_SCOPE || "OR.Execution TM.Projects TM.TestCases TM.TestSets TM.Requirements TM.Administration TM.Defects TM.TestExecutions",
  };
}

class UiPathClient {
  private token?: string;
  private expiresAt = 0;
  constructor(private cfg: UiPathConfig) {}

  private get tmBase(): string {
    return `${this.cfg.baseUrl}/${this.cfg.org}/${this.cfg.tenant}/testmanager_`;
  }

  /** Client-credentials grant against UiPath Identity Server. */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    const url = `${this.cfg.baseUrl}/${this.cfg.org}/identity_/connect/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      scope: this.cfg.scope,
    });
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!res.ok) throw new Error(`UiPath token ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j: any = await res.json();
    this.token = j.access_token as string;
    this.expiresAt = Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000;
    return this.token;
  }

  async tm(path: string, init: RequestInit = {}): Promise<any> {
    const token = await this.getToken();
    const res = await fetch(`${this.tmBase}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`UiPath TM ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  /** Read-only connectivity check — proves creds + scopes work. */
  async verify(): Promise<void> {
    await this.tm(`/api/v2/projects?%24top=1`);
  }

  private projectId?: string;
  /** Resolve the Test Manager project GUID from its prefix (e.g. "YAN"). */
  async resolveProjectId(prefix: string): Promise<string> {
    if (this.projectId) return this.projectId;
    const r = await this.tm(`/api/v2/projects`);
    const list: any[] = r?.data ?? [];
    const p = list.find((x) => x.projectPrefix === prefix) ?? list[0];
    if (!p?.id) throw new Error(`Test Manager project "${prefix}" not found`);
    this.projectId = p.id as string;
    return this.projectId;
  }

  async createTestCase(pid: string, name: string, description: string): Promise<string> {
    const r = await this.tm(`/api/v2/${pid}/testcases`, { method: "POST", body: JSON.stringify({ name, description, projectId: pid }) });
    return (r?.id ?? r?.data?.id) as string;
  }

  async createTestSet(pid: string, name: string): Promise<string> {
    const r = await this.tm(`/api/v2/${pid}/testsets`, { method: "POST", body: JSON.stringify({ name, projectId: pid }) });
    return (r?.id ?? r?.data?.id) as string;
  }

  async createExecution(pid: string, testSetId: string, name: string, testCaseIds: string[]): Promise<string> {
    const r = await this.tm(`/api/v2/${pid}/testexecutions`, {
      method: "POST",
      body: JSON.stringify({ projectId: pid, testSetId, testCaseIds, name, source: "ThirdParty", sourceDetails: "SelfHeal QA agent" }),
    });
    return (r?.id ?? r?.data?.id) as string;
  }

  /** Open a test-case log for the execution; returns its id. */
  async openLog(pid: string, executionId: string, testCaseId: string): Promise<string> {
    const r = await this.tm(`/api/v2/${pid}/testcaselogs`, { method: "POST", body: JSON.stringify({ testCaseId, testExecutionId: executionId }) });
    return (r?.id ?? r?.data?.id) as string;
  }

  async finishLog(pid: string, executionId: string, testCaseId: string, passed: boolean, detail: string): Promise<void> {
    await this.tm(`/api/v2/${pid}/testcaselogs/testexecution/${executionId}/finish`, {
      method: "POST",
      body: JSON.stringify({ testCaseId, result: passed ? "Passed" : "Failed", hasError: !passed, executedBy: "SelfHeal QA", detailLink: detail }),
    });
  }

  /** File a defect from a failing test-case log — the "real bug" path. */
  async createDefect(pid: string, executionId: string, testCaseId: string, logId: string): Promise<string | undefined> {
    const r = await this.tm(`/api/v2/${pid}/defects`, {
      method: "POST",
      body: JSON.stringify({ testExecutionId: executionId, testCaseId, linkToTestCaseLog: logId }),
    });
    return (r?.id ?? r?.data?.id) as string | undefined;
  }
}

export class UiPathExecutor implements Executor {
  private cfg = cfgFromEnv();
  private client = new UiPathClient(this.cfg);
  private pw = new PlaywrightExecutor();
  private verified = false;

  async run(test: TestCase): Promise<TestResult> {
    if (!this.verified) {
      try {
        await this.client.verify();
        console.log(`🔗 UiPath: authenticated to Test Manager (org=${this.cfg.org}, tenant=${this.cfg.tenant}, project=${this.cfg.project || "?"}).`);
      } catch (e) {
        console.log(`⚠️  UiPath connectivity check failed — continuing with local execution.\n   ${String(e).slice(0, 220)}`);
      }
      this.verified = true;
    }

    return this.pw.run(test); // real execution; final outcome reported once via reportRun()
  }

  /**
   * Report the FINAL agent outcome into UiPath Test Manager: test case + test set
   * + execution + result, plus self-heal context. When the agent classified a
   * failure as a REAL BUG, auto-file a linked defect — the key differentiator vs.
   * blind self-healing, which would silently mask that regression.
   * Best-effort: never breaks the run.
   */
  async reportRun(report: RunReport): Promise<void> {
    if (process.env.UIPATH_REPORT !== "1") {
      console.log(`📋 UiPath: report skipped (set UIPATH_REPORT=1 to push "${report.testName}" → ${report.finalStatus} into project ${this.cfg.project}).`);
      return;
    }
    try {
      const pid = await this.client.resolveProjectId(this.cfg.project);
      const passed = report.finalStatus === "pass";
      const heals = report.heals.map((h) => `${h.originalSelector}→${h.suggestedSelector}`).join(", ");
      const desc = `Authored by SelfHeal QA from ${report.url}` + (heals ? ` | self-heals: ${heals}` : "");
      const testCaseId = await this.client.createTestCase(pid, report.testName, desc);
      const testSetId = await this.client.createTestSet(pid, `${report.testName} (SelfHeal QA)`);
      const executionId = await this.client.createExecution(pid, testSetId, `${report.testName} (SelfHeal QA)`, [testCaseId]);
      const logId = await this.client.openLog(pid, executionId, testCaseId);
      await this.client.finishLog(pid, executionId, testCaseId, passed, `SelfHeal QA: ${report.finalStatus}, ${report.heals.length} heal(s), ${report.bugs.length} bug(s)`);
      console.log(`📤 UiPath: reported "${report.testName}" → ${report.finalStatus} (execution ${executionId}, ${report.heals.length} self-heal(s)).`);

      if (report.bugs.length > 0 && logId) {
        const defectId = await this.client.createDefect(pid, executionId, testCaseId, logId);
        console.log(`🐞 UiPath: filed a defect for the real bug — "${report.bugs[0].description}"${defectId ? ` (defect ${defectId})` : ""}. Blind self-healing would have masked this regression.`);
      }
    } catch (e) {
      console.log(`⚠️  UiPath report failed (run still valid locally): ${String(e).slice(0, 260)}`);
    }
  }

  async close(): Promise<void> {
    await this.pw.close();
  }
}
