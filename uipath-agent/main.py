"""SelfHeal QA — UiPath Coded Agent.

The orchestration brain runs *through the UiPath Platform* (this coded agent,
deployed to Orchestrator / run via the UiPath runtime). It:

  1. generates a UI test from a plain-English spec,
  2. runs it and, on failure, decides REAL_BUG vs BRITTLE_SELECTOR (Claude),
  3. self-heals brittle locators and re-runs,
  4. reports the run into UiPath Test Manager, and — the differentiator —
     when it's a real bug, files a linked DEFECT instead of blindly healing.

Stdlib-only so it runs anywhere the UiPath runtime does. Browser execution is
modeled deterministically here; the companion Playwright executor drives a real
browser for the live demo.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path


# --------------------------------------------------------------------------- #
# Config (loaded from .env in this folder or the repo root)                    #
# --------------------------------------------------------------------------- #
def _load_env() -> None:
    here = Path(__file__).resolve().parent
    for p in (here / ".env", here.parent / ".env"):
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()
BASE = os.environ.get("UIPATH_BASE_URL", "https://cloud.uipath.com")
ORG = os.environ.get("UIPATH_ACCOUNT", "")
TENANT = os.environ.get("UIPATH_TENANT", "")
PROJECT = os.environ.get("UIPATH_PROJECT", "")
SCOPE = os.environ.get(
    "UIPATH_SCOPE",
    "OR.Execution TM.Projects TM.TestCases TM.TestSets TM.Requirements TM.Administration TM.Defects TM.TestExecutions",
)
TM_BASE = f"{BASE}/{ORG}/{TENANT}/testmanager_"


# --------------------------------------------------------------------------- #
# Tiny HTTP helpers (stdlib)                                                   #
# --------------------------------------------------------------------------- #
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) SelfHealQA/1.0"


def _request(method: str, url: str, headers: dict, data: bytes | None = None):
    headers = {"User-Agent": _UA, "Accept": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode()
            return r.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


_token = {"value": None, "exp": 0.0}


def _get_token() -> str:
    if _token["value"] and time.time() < _token["exp"]:
        return _token["value"]
    form = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": os.environ["UIPATH_CLIENT_ID"],
            "client_secret": os.environ["UIPATH_CLIENT_SECRET"],
            "scope": SCOPE,
        }
    ).encode()
    status, j = _request(
        "POST",
        f"{BASE}/{ORG}/identity_/connect/token",
        {"content-type": "application/x-www-form-urlencoded"},
        form,
    )
    if status != 200 or not isinstance(j, dict):
        raise RuntimeError(f"UiPath token failed: {status} {j}")
    _token["value"] = j["access_token"]
    _token["exp"] = time.time() + j.get("expires_in", 3600) - 60
    return _token["value"]


def _tm(method: str, path: str, body: dict | None = None):
    headers = {"authorization": f"Bearer {_get_token()}", "content-type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    status, j = _request(method, f"{TM_BASE}{path}", headers, data)
    if status >= 300:
        raise RuntimeError(f"UiPath TM {status} {path}: {j}")
    return j


_pid_cache = {"id": None}


def _project_id() -> str:
    if _pid_cache["id"]:
        return _pid_cache["id"]
    res = _tm("GET", "/api/v2/projects")
    items = (res or {}).get("data", [])
    p = next((x for x in items if x.get("projectPrefix") == PROJECT), items[0] if items else None)
    if not p:
        raise RuntimeError(f"Test Manager project '{PROJECT}' not found")
    _pid_cache["id"] = p["id"]
    return p["id"]


# --------------------------------------------------------------------------- #
# Test generation + deterministic execution model + AI triage                 #
# --------------------------------------------------------------------------- #
ACTUAL_SELECTORS = {"#username", "#password", "#sign-in-btn"}  # app renamed #login-btn -> #sign-in-btn
SNAPSHOT = "input#username\ninput#password\nbutton#sign-in-btn (role: button, text: 'Sign in')"


def generate_test(spec: str, url: str) -> dict:
    """A real LLM authors these in the demo; here we use the canonical login flow."""
    return {
        "name": "Login flow",
        "url": url,
        "steps": [
            {"id": "s1", "action": "goto", "value": url},
            {"id": "s2", "action": "type", "selector": "#username", "value": "demo@user.com"},
            {"id": "s3", "action": "type", "selector": "#password", "value": "hunter2"},
            {"id": "s4", "action": "click", "selector": "#login-btn"},  # brittle on purpose
            {"id": "s5", "action": "expectText", "value": "Welcome back"},
        ],
    }


_GOOD_TOKENS = ("username", "password", "sign-in-btn")  # ids actually present in the app


def selector_present(sel: str | None) -> bool:
    """Lenient match: a selector resolves if it references a real element id,
    tolerant of formatting the LLM may use (e.g. '#sign-in-btn' or 'button#sign-in-btn')."""
    return bool(sel) and any(tok in sel for tok in _GOOD_TOKENS)


def run_test(test: dict, inject_bug: bool):
    clicked_valid = any(s["action"] == "click" and selector_present(s.get("selector")) for s in test["steps"])
    for s in test["steps"]:
        sel = s.get("selector")
        if s["action"] in ("click", "type", "expectVisible") and sel and not selector_present(sel):
            return {"status": "fail", "step": s, "failedSelector": sel, "snapshot": SNAPSHOT}
        if s["action"] == "expectText" and (not clicked_valid or inject_bug):
            return {"status": "fail", "step": s, "failedSelector": None, "snapshot": SNAPSHOT}
    return {"status": "pass"}


# Substrings in the page snapshot that signal a real error/regression state — the restraint
# guardrail refuses to silently heal over these even on a confident BRITTLE_SELECTOR call.
ERROR_SNAPSHOT_SIGNALS = ("error", "alert", "role=alert", "declined", "denied", "failure", "exception")


def _snapshot_looks_like_error(snapshot: str) -> bool:
    s = (snapshot or "").lower()
    return any(sig in s for sig in ERROR_SNAPSHOT_SIGNALS)


def _heuristic_triage(failure: dict) -> dict:
    """Deterministic triage used when no API key is present (or the live call fails)."""
    fsel = failure.get("failedSelector")
    snapshot = failure.get("snapshot", "")
    if fsel == "#login-btn" and "sign-in-btn" in snapshot:
        return {
            "verdict": "BRITTLE_SELECTOR",
            "confidence": 0.92,
            "reasoning": "#login-btn no longer exists; equivalent submit control #sign-in-btn is present. Renamed locator, not a defect.",
            "suggestedSelector": "#sign-in-btn",
        }
    return {
        "verdict": "REAL_BUG",
        "confidence": 0.6,
        "reasoning": "Expected state is genuinely absent with no equivalent control — likely a product defect.",
    }


def triage(failure: dict) -> dict:
    """Decide REAL_BUG vs BRITTLE_SELECTOR via Claude when a key is present, else a deterministic
    heuristic. Always stamps 'engine' ('claude' | 'deterministic-fallback') so a live decision is
    never silently mistaken for the fallback — and a benchmark can refuse to count fallback runs."""
    fsel = failure.get("failedSelector")
    snapshot = failure.get("snapshot", "")
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        system = (
            "You are a test-triage agent. A UI test step failed. Decide if this is a REAL_BUG "
            "(product is broken) or a BRITTLE_SELECTOR (feature works but the locator drifted). "
            "If BRITTLE_SELECTOR, pick the best replacement selector from the available elements. "
            'Return ONLY JSON: {"verdict":"REAL_BUG"|"BRITTLE_SELECTOR","confidence":0..1,'
            '"reasoning":"...","suggestedSelector":"..."}'
        )
        user = f"Failed step: {failure['step']}\nFailed selector: {fsel}\nAvailable elements:\n{snapshot}"
        try:
            status, j = _request(
                "POST",
                "https://api.anthropic.com/v1/messages",
                {"content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"},
                json.dumps(
                    {
                        "model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
                        "max_tokens": 600,
                        "system": system,
                        "messages": [{"role": "user", "content": user}],
                    }
                ).encode(),
            )
            text = j["content"][0]["text"] if isinstance(j, dict) else ""
            start, end = text.find("{"), text.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"no JSON object in Claude response (status {status})")
            d = json.loads(text[start : end + 1])
            d["engine"] = "claude"
            return d
        except Exception as e:
            # Do NOT silently pretend this was a live decision — record the failure and fall back.
            d = _heuristic_triage(failure)
            d["engine"] = "deterministic-fallback"
            d["engine_note"] = f"live Claude triage failed, used deterministic fallback: {str(e)[:120]}"
            return d
    d = _heuristic_triage(failure)
    d["engine"] = "deterministic-fallback"
    return d


# --------------------------------------------------------------------------- #
# Risk-based test selection — a proactive, pre-execution agentic decision      #
# --------------------------------------------------------------------------- #
TEST_CATALOG = [
    {"name": "Login flow", "tags": ["auth", "login", "session", "signin"]},
    {"name": "Checkout & payment", "tags": ["checkout", "payment", "cart", "order"]},
    {"name": "Search results", "tags": ["search", "catalog", "query"]},
    {"name": "Profile update", "tags": ["profile", "account", "settings"]},
]


def select_tests(changed_files: list[str]) -> list[str]:
    """Given a changeset, choose which suite tests it can affect (Claude, with a
    tag-match fallback) — so the agent runs the relevant slice, not the whole suite."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        try:
            system = (
                "You are a risk-based test selector. Given changed files and a test catalog "
                "(name + tags), return ONLY a JSON array of the test NAMES whose behavior the "
                "change could plausibly affect. Be precise — omit unrelated tests."
            )
            user = "Changed files:\n" + "\n".join(changed_files) + "\n\nCatalog:\n" + json.dumps(TEST_CATALOG)
            _, j = _request(
                "POST", "https://api.anthropic.com/v1/messages",
                {"content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"},
                json.dumps({"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"), "max_tokens": 300, "system": system, "messages": [{"role": "user", "content": user}]}).encode(),
            )
            text = j["content"][0]["text"] if isinstance(j, dict) else ""
            a, b = text.find("["), text.rfind("]")
            if a != -1 and b != -1:
                names = json.loads(text[a : b + 1])
                return [n for n in names if any(t["name"] == n for t in TEST_CATALOG)]
        except Exception:
            pass
    blob = " ".join(changed_files).lower()
    return [t["name"] for t in TEST_CATALOG if any(tag in blob for tag in t["tags"])]


# --------------------------------------------------------------------------- #
# UiPath coded-agent entrypoint                                               #
# --------------------------------------------------------------------------- #
@dataclass
class SelfHealIn:
    url: str
    spec: str
    inject_bug: bool | None = False
    changed_files: list[str] | None = None


@dataclass
class SelfHealOut:
    status: str
    runs: int
    heals: int
    flagged_heals: int
    bugs: int
    execution_id: str | None = None
    defect_id: str | None = None
    selection: str | None = None
    timeline: list[str] = field(default_factory=list)


def main(input: SelfHealIn) -> SelfHealOut:
    timeline: list[str] = []
    heals: list[dict] = []
    flagged: list[dict] = []  # heals the restraint guardrail withheld for human review
    bugs: list[dict] = []

    selection_summary = None
    if input.changed_files:
        selected = select_tests(input.changed_files)
        selection_summary = f"{len(selected)}/{len(TEST_CATALOG)} tests selected: {', '.join(selected) or '(none)'}"
        timeline.append(f"Risk-based selection — changeset affects {len(selected)} of {len(TEST_CATALOG)} suites: {', '.join(selected) or '(none)'}")

    test = generate_test(input.spec, input.url)
    timeline.append(f"Generated test '{test['name']}' ({len(test['steps'])} steps)")

    attempts, heal_budget = 0, 3
    final = "fail"
    while True:
        attempts += 1
        result = run_test(test, bool(input.inject_bug))
        if result["status"] == "pass":
            final = "pass"
            timeline.append(f"Run #{attempts}: all steps passed")
            break
        f = result
        timeline.append(f"Run #{attempts}: step {f['step']['id']} failed")
        if len(heals) >= heal_budget:
            timeline.append("Heal budget exhausted")
            break
        d = triage(f)
        conf = float(d.get("confidence", 0.0))
        timeline.append(f"Triage [{d.get('engine', '?')}]: {d['verdict']} ({int(conf * 100)}%) — {d.get('reasoning', '')[:80]}")
        if d.get("engine_note"):
            timeline.append(f"NOTE: {d['engine_note']}")
        if d["verdict"] == "BRITTLE_SELECTOR" and d.get("suggestedSelector"):
            step = next(s for s in test["steps"] if s["id"] == f["step"]["id"])
            # RESTRAINT GUARDRAIL (enforced in code): never silently rewrite a locator on a shaky
            # call. Below the confidence floor, OR when the page shows an error/alert state (a real
            # regression often masquerades as a drifted selector), withhold the heal and escalate.
            low = conf < 0.7
            error_state = _snapshot_looks_like_error(f.get("snapshot", ""))
            if low or error_state:
                why = "confidence below 70% floor" if low else "page is in an error/alert state"
                flagged.append({"from": step.get("selector"), "to": d["suggestedSelector"], "confidence": conf, "why": why})
                timeline.append(
                    f"RESTRAINT: heal WITHHELD ({why}) — no silent rewrite of {step.get('selector')}; escalated for human review."
                )
                break
            heals.append({"from": step.get("selector"), "to": d["suggestedSelector"], "confidence": conf})
            timeline.append(f"Self-healed: {step.get('selector')} -> {d['suggestedSelector']}")
            step["selector"] = d["suggestedSelector"]
            continue
        bugs.append({"step": f["step"]["id"], "reasoning": d.get("reasoning", ""), "confidence": conf})
        timeline.append(f"DECISION: REAL BUG ({int(conf * 100)}%) — refusing to heal; filing a defect. Reason: {d.get('reasoning', '')[:140]}")
        break

    # Report through UiPath Test Manager
    execution_id = defect_id = None
    if os.environ.get("UIPATH_REPORT", "1") == "1":
        try:
            pid = _project_id()
            heal_txt = ", ".join(f"{h['from']}->{h['to']} ({int(h['confidence'] * 100)}%)" for h in heals)
            flagged_txt = "; ".join(f"{h['from']} ({int(h['confidence'] * 100)}%, {h['why']})" for h in flagged)
            bug_txt = "; ".join(f"{b['reasoning']} ({int(b['confidence'] * 100)}% confidence)" for b in bugs)
            parts = [f"Authored by SelfHeal QA coded agent from {input.url}."]
            if selection_summary:
                parts.append(f"Risk-based selection: {selection_summary}.")
            if heal_txt:
                parts.append(f"Self-healed brittle locators: {heal_txt}.")
            if flagged_txt:
                parts.append(f"Heals WITHHELD by the restraint guardrail (escalated to a human, not auto-applied): {flagged_txt}.")
            if bug_txt:
                parts.append(f"REAL BUG — refused to heal (blind self-healing would have masked this regression): {bug_txt}")
            desc = " ".join(parts)
            outcome = (
                "REAL BUG -> defect filed" if bugs
                else "heal withheld -> human review" if flagged
                else "self-healed -> passed" if heals
                else final
            )
            run_name = f"{test['name']} - {outcome}"  # self-documenting name so the Execution list reads like a log
            tc = _tm("POST", f"/api/v2/{pid}/testcases", {"name": run_name, "description": desc, "projectId": pid})
            tcid = tc["id"]
            ts = _tm("POST", f"/api/v2/{pid}/testsets", {"name": f"{run_name} (SelfHeal QA)", "projectId": pid})
            ex = _tm("POST", f"/api/v2/{pid}/testexecutions", {"projectId": pid, "testSetId": ts["id"], "testCaseIds": [tcid], "name": f"{run_name} (SelfHeal QA)", "source": "ThirdParty", "sourceDetails": "SelfHeal QA coded agent"})
            execution_id = ex["id"]
            log = _tm("POST", f"/api/v2/{pid}/testcaselogs", {"testCaseId": tcid, "testExecutionId": execution_id})
            _tm("POST", f"/api/v2/{pid}/testcaselogs/testexecution/{execution_id}/finish", {"testCaseId": tcid, "result": "Passed" if final == "pass" else "Failed", "hasError": final != "pass", "executedBy": "SelfHeal QA"})
            timeline.append(f"Reported to Test Manager (execution {execution_id})")
            if bugs:
                df = _tm("POST", f"/api/v2/{pid}/defects", {"testExecutionId": execution_id, "testCaseId": tcid, "linkToTestCaseLog": log["id"]})
                defect_id = (df or {}).get("id")
                timeline.append(f"Filed defect {defect_id} — blind self-healing would have masked this")
        except Exception as e:  # never crash the agent on reporting
            timeline.append(f"Test Manager reporting skipped: {str(e)[:160]}")

    return SelfHealOut(
        status=final,
        runs=attempts,
        heals=len(heals),
        flagged_heals=len(flagged),
        bugs=len(bugs),
        execution_id=execution_id,
        defect_id=defect_id,
        selection=selection_summary,
        timeline=timeline,
    )
