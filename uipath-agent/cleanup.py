"""Wipe the Test Manager project clean (removes API-probe clutter) so the
dashboard shows only pristine agent runs for screenshots."""
from main import _tm, _project_id


def _delete_all(pid: str, resource: str) -> int:
    items = (_tm("GET", f"/api/v2/{pid}/{resource}") or {}).get("data", [])
    ids = [x["id"] for x in items if x.get("id")]
    if not ids:
        return 0
    for payload in ({"ids": ids}, ids, {"testCaseIds": ids}):
        try:
            _tm("POST", f"/api/v2/{pid}/{resource}/delete", payload)
            return len(ids)
        except Exception:
            continue
    # fall back to per-item DELETE
    deleted = 0
    for i in ids:
        try:
            _tm("DELETE", f"/api/v2/{pid}/{resource}/{i}")
            deleted += 1
        except Exception:
            pass
    return deleted


if __name__ == "__main__":
    pid = _project_id()
    for r in ("defects", "testexecutions", "testsets", "testcases"):
        try:
            print(f"{r}: deleted {_delete_all(pid, r)}")
        except Exception as e:
            print(f"{r}: error {str(e)[:120]}")
