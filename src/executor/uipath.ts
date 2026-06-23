import type { Executor } from "./index";
import type { TestCase, TestResult } from "../types";
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
    scope: process.env.UIPATH_SCOPE || "OR.Execution TM.Projects",
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

    const result = await this.pw.run(test); // real execution
    await this.report(test, result); // orchestration / record layer
    return result;
  }

  /**
   * Report the run into UiPath Test Manager so the project dashboard reflects
   * the agent's activity (pass/fail + self-heals). Best-effort: never breaks the
   * run. Finalize the exact endpoint/payload from your tenant Swagger.
   */
  private async report(test: TestCase, result: TestResult): Promise<void> {
    if (process.env.UIPATH_REPORT !== "1") {
      console.log(`📋 UiPath: report skipped (set UIPATH_REPORT=1 to push "${test.name}" → ${result.status} into project ${this.cfg.project}).`);
      return;
    }
    try {
      // TODO(confirm against /testmanager_/swagger/index.html): create/append a
      // TestExecution with TestCaseLogs for `result`. Structure below is the
      // documented v2 shape; field names may differ slightly per tenant.
      await this.client.tm(`/api/v2/projects/${this.cfg.project}/executions`, {
        method: "POST",
        body: JSON.stringify({
          name: `${test.name} (SelfHeal QA)`,
          status: result.status === "pass" ? "Passed" : "Failed",
          testCaseLogs: result.steps.map((s) => ({ name: s.stepId, status: s.status === "pass" ? "Passed" : s.status === "fail" ? "Failed" : "None", message: s.error })),
        }),
      });
      console.log(`📤 UiPath: reported "${test.name}" → ${result.status} into project ${this.cfg.project}.`);
    } catch (e) {
      console.log(`⚠️  UiPath report failed (run still valid locally): ${String(e).slice(0, 200)}`);
    }
  }

  async close(): Promise<void> {
    await this.pw.close();
  }
}
