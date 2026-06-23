// Probe the Test Manager Defects API so we can auto-file a defect when the agent
// classifies a failure as a REAL_BUG (our differentiator vs. blind self-healing).
import { loadEnv } from "../src/llm";
loadEnv();
const base = process.env.UIPATH_BASE_URL!;
const org = process.env.UIPATH_ACCOUNT!;
const tenant = process.env.UIPATH_TENANT!;
const tmBase = `${base}/${org}/${tenant}/testmanager_`;

const tok: any = await (await fetch(`${base}/${org}/identity_/connect/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.UIPATH_CLIENT_ID!, client_secret: process.env.UIPATH_CLIENT_SECRET!, scope: process.env.UIPATH_SCOPE! }),
})).json();
const h: any = { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" };
const sw: any = await (await fetch(`${tmBase}/swagger/v2/swagger.json`, { headers: h })).json();
const resolve = (ref: string): any => sw.components.schemas[ref.replace("#/components/schemas/", "")];

for (const p of ["/api/v2/{projectId}/defects"]) {
  const op = sw.paths[p]?.post;
  const ref = op?.requestBody?.content?.["application/json"]?.schema?.$ref;
  console.log(`POST ${p} body: ${ref}`);
  const s = ref ? resolve(ref) : null;
  if (s?.properties) for (const [k, v] of Object.entries<any>(s.properties)) {
    const t = v.type || (v.$ref ? v.$ref.split(".").pop() : v.allOf ? v.allOf[0]?.$ref?.split(".").pop() : "?");
    console.log(`   ${k}: ${t}${(s.required || []).includes(k) ? " *" : ""}`);
  }
}
for (const [n, e] of Object.entries<any>(sw.components.schemas)) {
  if (Array.isArray(e.enum) && /severity|priority|defectstatus/i.test(n)) console.log(`enum ${n.split(".").pop()}: ${JSON.stringify(e.enum)}`);
}
