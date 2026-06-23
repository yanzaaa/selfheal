import type { LLM } from "./llm";
import type { TestCase } from "./types";

/** Turn a plain-English acceptance spec into a runnable TestCase. */
export async function generateTest(llm: LLM, spec: string, url: string): Promise<TestCase> {
  const test = await llm.generateTests(spec, url);
  // Defensive: ensure ids exist so the healer can target steps.
  test.steps.forEach((s, i) => {
    if (!s.id) s.id = `s${i + 1}`;
  });
  if (!test.url) test.url = url;
  return test;
}
