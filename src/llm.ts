// Provider-agnostic LLM layer. Supports a key-free "mock" provider (full
// self-heal loop, no network), plus real Anthropic / OpenAI via fetch (no SDK).

import { readFileSync, existsSync } from "node:fs";
import type { TestCase, Diagnosis } from "./types";

/** Minimal zero-dependency .env loader. */
export function loadEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export interface DiagnoseContext {
  test: TestCase;
  failedStepId: string;
  failedSelector?: string;
  errorMessage?: string;
  /** Compact list of interactive elements visible at failure. */
  pageSnapshot: string;
}

export interface LLM {
  name: string;
  generateTests(spec: string, url: string): Promise<TestCase>;
  diagnose(ctx: DiagnoseContext): Promise<Diagnosis>;
}

/** Pull the first JSON object out of a model response (handles ```json fences). */
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON found in model output:\n${text.slice(0, 400)}`);
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

const TESTGEN_SYSTEM = `You are a senior QA automation engineer. Convert a plain-English acceptance spec into a concrete, runnable UI test.
Return ONLY JSON matching:
{"name": string, "url": string, "steps": [{"id": string, "action": "goto"|"click"|"type"|"expectText"|"expectVisible", "description": string, "selector"?: string, "value"?: string}]}
Rules: first step is usually a "goto" with value=url. Use stable selectors (prefer data-testid, id, role). "type" needs selector+value. "expectText" needs value (the text). Keep it to the minimal steps that prove the spec.`;

const DIAGNOSE_SYSTEM = `You are a test-triage agent. A UI test step failed. Decide if this is a REAL_BUG (the product is broken) or a BRITTLE_SELECTOR (the feature works but the locator drifted, e.g. an id/class was renamed).
You are given the failed step, the error, and the list of interactive elements actually present on the page now.
If BRITTLE_SELECTOR, choose the single best replacement selector FROM the available elements (prefer data-testid > id > role+text).
Return ONLY JSON: {"verdict": "REAL_BUG"|"BRITTLE_SELECTOR"|"UNKNOWN", "confidence": number 0..1, "reasoning": string, "suggestedSelector"?: string}`;

// ---------------------------------------------------------------------------
// Mock provider — deterministic, no network. Demonstrates the full loop.
// ---------------------------------------------------------------------------
export class MockLLM implements LLM {
  name = "mock";

  async generateTests(spec: string, url: string): Promise<TestCase> {
    return {
      name: "Login flow",
      url,
      steps: [
        { id: "s1", action: "goto", description: "Open the app", value: url },
        { id: "s2", action: "type", description: "Enter the username", selector: "#username", value: "demo@user.com" },
        { id: "s3", action: "type", description: "Enter the password", selector: "#password", value: "hunter2" },
        // Intentionally brittle: the app renamed this to #sign-in-btn.
        { id: "s4", action: "click", description: "Click the login button", selector: "#login-btn" },
        { id: "s5", action: "expectText", description: "See the welcome message", value: "Welcome back" },
      ],
    };
  }

  async diagnose(ctx: DiagnoseContext): Promise<Diagnosis> {
    if (ctx.failedSelector === "#login-btn" && ctx.pageSnapshot.includes("sign-in-btn")) {
      return {
        verdict: "BRITTLE_SELECTOR",
        confidence: 0.92,
        reasoning:
          "#login-btn no longer exists, but the page has an equivalent submit control #sign-in-btn (text 'Sign in'). This is a renamed locator, not a product defect.",
        suggestedSelector: "#sign-in-btn",
      };
    }
    return {
      verdict: "REAL_BUG",
      confidence: 0.6,
      reasoning: "The expected element or state is genuinely absent and there is no equivalent control on the page — likely a product defect.",
    };
  }
}

// ---------------------------------------------------------------------------
// Anthropic provider (Messages API via fetch).
// ---------------------------------------------------------------------------
class AnthropicLLM implements LLM {
  name = "anthropic";
  constructor(private key: string, private model: string) {}

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: this.model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const j: any = await res.json();
    return j.content?.[0]?.text ?? "";
  }

  async generateTests(spec: string, url: string): Promise<TestCase> {
    const out = await this.call(TESTGEN_SYSTEM, `URL: ${url}\nSpec: ${spec}`);
    return extractJson<TestCase>(out);
  }

  async diagnose(ctx: DiagnoseContext): Promise<Diagnosis> {
    const user = `Failed step: ${JSON.stringify(ctx.test.steps.find((s) => s.id === ctx.failedStepId))}\nFailed selector: ${ctx.failedSelector}\nError: ${ctx.errorMessage}\nAvailable elements:\n${ctx.pageSnapshot}`;
    return extractJson<Diagnosis>(await this.call(DIAGNOSE_SYSTEM, user));
  }
}

// ---------------------------------------------------------------------------
// OpenAI provider (Chat Completions via fetch).
// ---------------------------------------------------------------------------
class OpenAILLM implements LLM {
  name = "openai";
  constructor(private key: string, private model: string) {}

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const j: any = await res.json();
    return j.choices?.[0]?.message?.content ?? "";
  }

  async generateTests(spec: string, url: string): Promise<TestCase> {
    return extractJson<TestCase>(await this.call(TESTGEN_SYSTEM, `URL: ${url}\nSpec: ${spec}`));
  }

  async diagnose(ctx: DiagnoseContext): Promise<Diagnosis> {
    const user = `Failed step: ${JSON.stringify(ctx.test.steps.find((s) => s.id === ctx.failedStepId))}\nFailed selector: ${ctx.failedSelector}\nError: ${ctx.errorMessage}\nAvailable elements:\n${ctx.pageSnapshot}`;
    return extractJson<Diagnosis>(await this.call(DIAGNOSE_SYSTEM, user));
  }
}

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in environment (.env). Set it or use LLM_PROVIDER=mock.`);
  return v;
}

export function createLLM(): LLM {
  loadEnv();
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  if (provider === "anthropic") return new AnthropicLLM(reqEnv("ANTHROPIC_API_KEY"), process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6");
  if (provider === "openai") return new OpenAILLM(reqEnv("OPENAI_API_KEY"), process.env.OPENAI_MODEL || "gpt-4o");
  return new MockLLM();
}
