"""Seeded triage benchmark — proof the agent doesn't mask real bugs.

Runs the REAL_BUG vs BRITTLE_SELECTOR triage on labeled cases (a mix of
cosmetic locator drift and genuine product regressions) and reports:
  - accuracy, and
  - the SAFETY-critical false-heal rate: real bugs wrongly classified as
    brittle (i.e. silently healed away). Industry credibility bar is <5%.

Run: .venv/bin/python benchmark.py   (uses real Claude triage if ANTHROPIC_API_KEY is set)
"""

from main import triage

CASES = [
    # --- Cosmetic / brittle: feature works, locator drifted -> expect BRITTLE_SELECTOR
    {"name": "login button renamed", "expected": "BRITTLE_SELECTOR",
     "failure": {"step": {"action": "click", "selector": "#login-btn"}, "failedSelector": "#login-btn",
                 "snapshot": "button#sign-in-btn (text 'Sign in')\ninput#username\ninput#password"}},
    {"name": "add-to-cart id -> data-testid", "expected": "BRITTLE_SELECTOR",
     "failure": {"step": {"action": "click", "selector": "#add-to-cart"}, "failedSelector": "#add-to-cart",
                 "snapshot": "button[data-testid='add-to-cart'] (text 'Add to cart')\ndiv.price (text '$19')"}},
    {"name": "submit class -> id", "expected": "BRITTLE_SELECTOR",
     "failure": {"step": {"action": "click", "selector": ".submit-btn"}, "failedSelector": ".submit-btn",
                 "snapshot": "button#submitOrder (text 'Submit order')"}},
    {"name": "email name -> id", "expected": "BRITTLE_SELECTOR",
     "failure": {"step": {"action": "type", "selector": "input[name=email]"}, "failedSelector": "input[name=email]",
                 "snapshot": "input#email (placeholder 'Email')\ninput#password"}},
    {"name": "nav link renamed", "expected": "BRITTLE_SELECTOR",
     "failure": {"step": {"action": "click", "selector": "#nav-home"}, "failedSelector": "#nav-home",
                 "snapshot": "a#home-link (text 'Home')\na#about-link (text 'About')"}},
    # --- Real product bugs: no equivalent control / error state -> expect REAL_BUG (must NOT heal)
    {"name": "payment failed (no confirmation)", "expected": "REAL_BUG",
     "failure": {"step": {"action": "expectText", "value": "Order confirmed"}, "failedSelector": None,
                 "snapshot": "div.error (text 'Payment failed. Please try again.')"}},
    {"name": "checkout button gone (out of stock)", "expected": "REAL_BUG",
     "failure": {"step": {"action": "click", "selector": "#checkout-btn"}, "failedSelector": "#checkout-btn",
                 "snapshot": "div.banner (text 'Out of stock')\na#home-link (text 'Home')"}},
    {"name": "500 on dashboard", "expected": "REAL_BUG",
     "failure": {"step": {"action": "expectVisible", "selector": "#dashboard"}, "failedSelector": "#dashboard",
                 "snapshot": "div (text 'Internal Server Error (500)')"}},
    {"name": "invalid credentials", "expected": "REAL_BUG",
     "failure": {"step": {"action": "expectText", "value": "Welcome back"}, "failedSelector": None,
                 "snapshot": "div.alert (text 'Invalid credentials')\ninput#username\ninput#password\nbutton#sign-in-btn"}},
    {"name": "transfer failed (insufficient funds)", "expected": "REAL_BUG",
     "failure": {"step": {"action": "expectText", "value": "Transfer successful"}, "failedSelector": None,
                 "snapshot": "div.error (text 'Insufficient funds')"}},
]


def run() -> None:
    correct = false_heals = real_total = 0
    rows = []
    for c in CASES:
        verdict = triage(c["failure"]).get("verdict")
        ok = verdict == c["expected"]
        correct += ok
        if c["expected"] == "REAL_BUG":
            real_total += 1
            if verdict == "BRITTLE_SELECTOR":
                false_heals += 1  # dangerous: a real bug would have been healed away
        rows.append((("OK " if ok else "MISS"), c["name"], c["expected"], verdict))

    n = len(CASES)
    print(f"\nTriage benchmark — {correct}/{n} correct = {correct / n * 100:.0f}% accuracy")
    fhr = (false_heals / real_total * 100) if real_total else 0
    print(f"Safety: real bugs healed-away = {false_heals}/{real_total} = {fhr:.0f}% false-heal rate (industry bar <5%)")
    print("-" * 64)
    for res, name, exp, got in rows:
        print(f"  [{res}] {name}: expected {exp}, got {got}")


if __name__ == "__main__":
    run()
