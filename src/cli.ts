import { runAgent } from "./agent";
import { createLLM, MockLLM } from "./llm";
import { MockExecutor } from "./executor/mock";
import { PlaywrightExecutor } from "./executor/playwright";
import type { Executor } from "./executor/index";
import type { RunReport } from "./types";

function flag(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : def;
}

function printReport(r: RunReport): void {
  const line = "─".repeat(56);
  console.log(`\n${line}`);
  console.log(`  ${r.finalStatus === "pass" ? "✅ PASS" : "❌ FAIL"}  ${r.testName}`);
  console.log(`  url: ${r.url}`);
  console.log(`  runs: ${r.attempts}   self-heals: ${r.heals.length}   bugs: ${r.bugs.length}`);
  if (r.heals.length) {
    console.log(`  self-heals:`);
    for (const h of r.heals) console.log(`    • ${h.stepId}: ${h.originalSelector}  →  ${h.suggestedSelector}`);
  }
  if (r.bugs.length) {
    console.log(`  bugs found:`);
    for (const b of r.bugs) console.log(`    • [${Math.round(b.confidence * 100)}%] ${b.description} — ${b.reasoning}`);
  }
  console.log(line);
  // Machine-readable line (e.g. for a UiPath process to consume).
  console.log(`\nRESULT_JSON ${JSON.stringify({ status: r.finalStatus, runs: r.attempts, heals: r.heals.length, bugs: r.bugs.length })}`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  if (cmd === "demo") {
    console.log("🧪 SelfHeal QA — key-free demo (renamed login button → self-heals)\n");
    const executor = new MockExecutor();
    const report = await runAgent({
      llm: new MockLLM(),
      executor,
      spec: "A returning user can log in and see the welcome message.",
      url: "https://demo.local/login",
      onEvent: (m) => console.log(m),
    });
    await executor.close();
    printReport(report);
    process.exit(report.finalStatus === "pass" ? 0 : 1);
  }

  if (cmd === "run") {
    const url = flag("url");
    const spec = flag("spec");
    if (!url || !spec) {
      console.error('Usage: npm run run -- --url <url> --spec "<acceptance spec>" [--executor playwright|mock] [--headed]');
      process.exit(2);
    }
    const llm = createLLM();
    const kind = flag("executor", "playwright");
    const executor: Executor =
      kind === "mock" ? new MockExecutor() : new PlaywrightExecutor({ headless: !process.argv.includes("--headed") });
    console.log(`🧪 SelfHeal QA — provider=${llm.name} executor=${kind}\n`);
    const report = await runAgent({ llm, executor, spec, url, onEvent: (m) => console.log(m) });
    await executor.close();
    printReport(report);
    process.exit(report.finalStatus === "pass" ? 0 : 1);
  }

  console.error("Commands:\n  demo                       key-free self-heal showcase\n  run --url --spec [...]     run against a real app");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
