"""Regression: a late tap cannot be scored correct even with a delayed timer callback.
Fresh headless Edge profile only; no real user progress.
"""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parent
BASE = "https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=deadline-regression"
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel="msedge")
    context = browser.new_context(viewport={"width": 412, "height": 915}, service_workers="block")
    context.add_init_script("localStorage.setItem('b2_cloze_read_first_v1', '0')")
    page = context.new_page()
    js_errors = []
    page.on("pageerror", lambda error: js_errors.append(str(error)))
    def intercept(route):
        uri = urlparse(route.request.url)
        file = ROOT / (uri.path.split("/")[-1] or "index.html")
        if uri.path.startswith("/b2-multiple-choice-cloze/") and file.is_file():
            mime = {".js": "application/javascript", ".css": "text/css", ".json": "application/json",
                    ".html": "text/html", ".webmanifest": "application/manifest+json",
                    ".png": "image/png", ".svg": "image/svg+xml"}.get(file.suffix, "application/octet-stream")
            route.fulfill(path=str(file), content_type=mime)
        else:
            route.continue_()
    page.route("**/b2-multiple-choice-cloze/**", intercept)
    page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_function("typeof BANK !== 'undefined' && BANK.length === 900", timeout=45000)
    page.locator("#startBtn").click()
    page.wait_for_function("session && current && deadline > 0 && document.querySelectorAll('#answers button.answer').length === 4", timeout=30000)
    result = page.evaluate("""() => {
        clearInterval(timerHandle);
        const before = session.records.length;
        const limit = currentTimeLimitSec;
        const correctPos = current.correctPos;
        deadline = performance.now() - 250;
        answer(correctPos, false);
        const rec = session.records[session.records.length-1];
        answer(correctPos, false);
        return {added: session.records.length-before, correct:rec.correct, ms:rec.ms,
                userAnswer:rec.userAnswer, type:rec.type, limit};
    }""")
    on_time = page.evaluate("""() => {
        quizFlow.cancel();
        session.index++;
        nextQuestion();
        clearInterval(timerHandle);
        const before = session.records.length;
        const limit = currentTimeLimitSec;
        answer(current.correctPos, false);
        const rec = session.records[session.records.length-1];
        return {added: session.records.length-before, correct: rec.correct, ms:rec.ms, limit};
    }""")
    context.close()
    browser.close()
print(json.dumps({"expired": result, "onTime": on_time, "jsErrors": js_errors}))
assert result["added"] == 1, "Late double tap must record only one answer"
assert result["correct"] is False, "An answer after deadline cannot score as correct"
assert result["ms"] == result["limit"] * 1000, "Timeout duration must match real per-question limit"
assert result["userAnswer"] == "No answer", "Expired input must be treated as unanswered"
assert on_time["added"] == 1 and on_time["correct"] is True, "On-time correct answer must still count once"
assert on_time["ms"] <= on_time["limit"] * 1000, "On-time answer must not exceed the deadline"
assert not js_errors, js_errors
print("PASS: late input treated as timeout, duplicate blocked, adaptive time preserved")
