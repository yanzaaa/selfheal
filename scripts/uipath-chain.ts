// Probe the full Test Manager result chain: testcase -> testset -> assign ->
// execution -> log -> finish. Prints each step's status to find the right flow.
import { loadEnv } from "../src/llm";
loadEnv();
const base = process.env.UIPATH_BASE_URL!;
const org = process.env.UIPATH_ACCOUNT!;
const tenant = process.env.UIPATH_TENANT!;
const tmBase = `${base}/${org}/${tenant}/testmanager_`;

const tokRes = await fetch(`${base}/${org}/identity_/connect/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.UIPATH_CLIENT_ID!, client_secret: process.env.UIPATH_CLIENT_SECRET!, scope: process.env.UIPATH_SCOPE! }),
});
const tok: any = await tokRes.json();
const h = { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" } as Record<string, string>;
const pid = "6333d30b-d181-0000-a58b-0b49cdac7681";
const post = async (p: string, b: any) => {
  const r = await fetch(`${tmBase}${p}`, { method: "POST", headers: h, body: JSON.stringify(b) });
  return { s: r.status, b: await r.text() };
};
const idOf = (s: string) => { try { return JSON.parse(s).id; } catch { return undefined; } };

const tc = await post(`/api/v2/${pid}/testcases`, { name: "SH-chain TC", description: "chain", projectId: pid });
console.log("TC    ", tc.s, tc.b.slice(0, 90));
const tcId = idOf(tc.b);

const ts = await post(`/api/v2/${pid}/testsets`, { name: "SH-chain TS", projectId: pid });
console.log("TS    ", ts.s, ts.b.slice(0, 200));
const tsId = idOf(ts.b);

if (tsId && tcId) {
  const asg = await post(`/api/v2/${pid}/testsets/${tsId}/assigntestcases`, { testCaseIds: [tcId] });
  console.log("ASSIGN", asg.s, asg.b.slice(0, 90));

  const ex = await post(`/api/v2/${pid}/testexecutions`, { projectId: pid, testSetId: tsId, testCaseIds: [tcId], name: "SH-chain EXEC", source: "ThirdParty", sourceDetails: "chain" });
  console.log("EXEC  ", ex.s, ex.b.slice(0, 200));
  const exId = idOf(ex.b);

  if (exId) {
    const lg = await post(`/api/v2/${pid}/testcaselogs`, { testCaseId: tcId, testExecutionId: exId });
    console.log("LOG   ", lg.s, lg.b.slice(0, 120));
    const fin = await post(`/api/v2/${pid}/testcaselogs/testexecution/${exId}/finish`, { testCaseId: tcId, result: "Passed", hasError: false, executedBy: "SelfHeal QA" });
    console.log("FINISH", fin.s, fin.b.slice(0, 160));
  }
}
