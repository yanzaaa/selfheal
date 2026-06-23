// Dev utility: uses the working client-credentials auth to inspect the Test
// Manager API — find the YAN project's id and the results/execution endpoints.
import { loadEnv } from "../src/llm";

loadEnv();
const base = process.env.UIPATH_BASE_URL || "https://cloud.uipath.com";
const org = process.env.UIPATH_ACCOUNT!;
const tenant = process.env.UIPATH_TENANT!;
const tmBase = `${base}/${org}/${tenant}/testmanager_`;

async function tokenWith(scope: string): Promise<{ ok: boolean; status: number; token?: string; scopes?: string; raw: string }> {
  const res = await fetch(`${base}/${org}/identity_/connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.UIPATH_CLIENT_ID!, client_secret: process.env.UIPATH_CLIENT_SECRET!, scope }),
  });
  const raw = await res.text();
  if (!res.ok) return { ok: false, status: res.status, raw: raw.slice(0, 300) };
  const j = JSON.parse(raw);
  let scopes = "";
  try { scopes = JSON.parse(Buffer.from(j.access_token.split(".")[1], "base64").toString("utf8")).scope; } catch {}
  return { ok: true, status: res.status, token: j.access_token, scopes: JSON.stringify(scopes), raw: "" };
}

const known = ["OR.Execution", "TM.Projects", "TM.TestCases", "TM.TestSets", "TM.Requirements", "TM.Administration", "TM.Defects"];
const execCandidates = ["TM.TestExecutions", "TM.TestExecution", "TM.Executions", "TM.ExecuteTests", "TM.AutomatedExecution", "TM.TestSetExecutions", "TM.Runs", "TM.TestRuns", "TM.Reporting", "TM.Schedules"];
const granted = [...known];
for (const c of execCandidates) {
  const r = await tokenWith("TM.Projects " + c);
  console.log(`[exec scope ${c}] ${r.ok ? "OK ✅" : "invalid"}`);
  if (r.ok) granted.push(c);
}
console.log("GRANTABLE: " + granted.join(" "));

const best = await tokenWith(granted.join(" "));
const t = best.token!;
const h = { authorization: `Bearer ${t}` } as Record<string, string>;
const pid = "6333d30b-d181-0000-a58b-0b49cdac7681";
{
  const res = await fetch(`${tmBase}/api/v2/${pid}/testexecutions`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ projectId: pid, testCaseIds: [], name: "SelfHeal exec probe", source: "ThirdParty", sourceDetails: "probe" }) });
  console.log(`[probe POST testexecutions] status=${res.status} body=${(await res.text()).slice(0, 220)}`);
}

// 1) Projects (find YAN's id)
const pr = await fetch(`${tmBase}/api/v2/projects`, { headers: h });
console.log(`GET /api/v2/projects -> ${pr.status}`);
const projects = await pr.json().catch(() => null);
console.log(JSON.stringify(projects, null, 1).slice(0, 1000));

// 2) Swagger: all POST endpoints relevant to creating test cases / executions / results
try {
  const sw = await fetch(`${tmBase}/swagger/v2/swagger.json`, { headers: h });
  console.log(`\nGET /swagger/v2/swagger.json -> ${sw.status}`);
  if (sw.ok) {
    const spec: any = await sw.json();
    const resolve = (ref: string): any => {
      const name = ref.replace("#/components/schemas/", "");
      return spec.components?.schemas?.[name];
    };
    const dumpBody = (path: string, method = "post") => {
      const op = spec.paths?.[path]?.[method];
      if (!op) return console.log(`\n[${method.toUpperCase()} ${path}] NOT FOUND`);
      const ref = op.requestBody?.content?.["application/json"]?.schema?.$ref;
      console.log(`\n[${method.toUpperCase()} ${path}] body schema: ${ref || "(inline/none)"}`);
      const sch = ref ? resolve(ref) : op.requestBody?.content?.["application/json"]?.schema;
      if (sch?.properties) {
        for (const [k, v] of Object.entries<any>(sch.properties)) {
          const t = v.type || (v.$ref ? v.$ref.split("/").pop() : (v.allOf ? v.allOf[0]?.$ref?.split("/").pop() : "?"));
          console.log(`   ${k}: ${t}${v.enum ? " enum=" + JSON.stringify(v.enum) : ""}${(sch.required || []).includes(k) ? " *required" : ""}`);
        }
      }
    };
    dumpBody("/api/v2/{projectId}/testcases");
    dumpBody("/api/v2/{projectId}/testexecutions");

    // Source enum values
    const srcEnum = spec.components?.schemas?.["UiPath.TestManagementHub.TestManagement.Abstractions.Enums.Source"];
    console.log(`\nSource enum: ${JSON.stringify(srcEnum?.enum)}`);

    // Test case log (result) create body + start/finish bodies
    dumpBody("/api/v2/{projectId}/testcaselogs");
    dumpBody("/api/v2/{projectId}/testcaselogs/testexecution/{id}/finish");

    // Any enum that includes "Passed" (the result/status enum)
    for (const [name, s] of Object.entries<any>(spec.components?.schemas || {})) {
      if (Array.isArray(s.enum) && s.enum.includes("Passed")) console.log(`\nResult enum (${name.split(".").pop()}): ${JSON.stringify(s.enum)}`);
    }

    // All methods for execution/testcaselog endpoints (to find result-set + finish)
    console.log("\nExecution/log endpoints (all methods):");
    for (const [p, ops] of Object.entries<any>(spec.paths || {})) {
      if (/testexecutions|testcaselog/i.test(p)) {
        for (const m of Object.keys(ops)) console.log(`   ${m.toUpperCase()} ${p}  — ${ops[m].summary || ""}`);
      }
    }
  }
} catch (e) {
  console.log("swagger fetch failed:", String(e).slice(0, 120));
}
