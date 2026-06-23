// Generates START-HERE.html — a double-click, browser-openable submission guide
// with copy buttons, built from the actual submission .md files.
import { readFileSync, writeFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url);
const read = (f) => readFileSync(here(f), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sub = read("./SUBMISSION.md");
const deck = read("./DECK.md");
const feedback = read("./PRODUCT_FEEDBACK.md");
const demo = read("./DEMO_SCRIPT.md");

// Pull the description body (everything from "## The problem" onward) for Devpost.
const descBody = sub.slice(sub.indexOf("<!--PASTE-START-->") + 18, sub.indexOf("<!--PASTE-END-->")).trim();

const block = (id, label, text) => `
  <div class="card">
    <div class="cardhead"><h3>${label}</h3><button class="copy" onclick="cp('${id}')">Copy</button></div>
    <textarea id="${id}" readonly>${esc(text)}</textarea>
  </div>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SelfHeal QA — Finish Your Submission</title>
<style>
  :root{--ink:#11131a;--mut:#5b6472;--line:#e6e8ee;--brand:#0aa37f;--bg:#f6f8fa;}
  *{box-sizing:border-box}
  body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg);margin:0;line-height:1.55}
  .wrap{max-width:860px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:30px;margin:0 0 4px}
  .sub{color:var(--mut);margin:0 0 28px;font-size:16px}
  h2{font-size:21px;margin:36px 0 12px;padding-top:18px;border-top:1px solid var(--line)}
  ol{padding-left:22px} ol li{margin:9px 0}
  .pill{display:inline-block;background:#e9fbf4;color:#077a5f;border:1px solid #b6ecd9;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;margin-left:6px}
  .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0;box-shadow:0 1px 2px rgba(20,30,50,.04)}
  .cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .cardhead h3{margin:0;font-size:15px}
  textarea{width:100%;height:150px;margin-top:10px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:13px/1.5 ui-monospace,Menlo,monospace;background:#fbfcfe;color:#222;resize:vertical}
  .copy{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:7px 16px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
  .copy:active{transform:translateY(1px)}
  .short textarea{height:54px}
  a{color:var(--brand);font-weight:600}
  .note{background:#fff8e6;border:1px solid #f3e2a8;border-radius:10px;padding:12px 14px;margin:14px 0;font-size:14px}
  pre{white-space:pre-wrap;background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;font:13px/1.6 ui-monospace,Menlo,monospace;overflow:auto}
  code{background:#eef1f5;padding:1px 5px;border-radius:5px;font-size:13px}
</style></head><body><div class="wrap">

<h1>Finish your submission ✅</h1>
<p class="sub">Double-click done — you're reading the guide. Do the steps in order. Click <b>Copy</b> on a box, then paste into Devpost. Deadline: <b>Jun 29, 11:45pm EDT</b> — submit a day early, you can keep editing.</p>

<h2>① Before Devpost (3 things)</h2>
<ol>
  <li><b>Record the demo video</b> (≤5 min). Read the <a href="#demo">Demo script</a> below out loud while screen-recording the UiPath dashboard. Upload to <b>YouTube</b> (set "Unlisted"). Copy the link.</li>
  <li><b>Take 2 screenshots</b> — press <code>Cmd+Shift+4</code> and drag a box: (a) the <a href="https://cloud.uipath.com/yanza/DefaultTenant/testmanager_/YAN/dashboard" target="_blank">YAN dashboard</a>, (b) the filed defect. They save to your Desktop.</li>
  <li><b>Make the deck:</b> on Devpost → <b>Resources</b> tab → download the template → fill it using <a href="#deck">Deck text</a> below → put it in Google Slides → <b>Share → "Anyone with the link"</b> → copy the link.</li>
</ol>

<h2>② Submit on Devpost (in order)</h2>
<ol>
  <li>Go to <a href="https://uipath-agenthack.devpost.com" target="_blank">uipath-agenthack.devpost.com</a> → <b>My projects</b> → open your draft → <b>Continue</b>.</li>
  <li><b>Manage team</b> → it's just you → Next.</li>
  <li><b>Project overview</b> → paste <b>Project name</b> and <b>Tagline</b> (boxes below). Upload a screenshot as the thumbnail. Next.</li>
  <li><b>Project details</b> → in the "About the project" box paste <b>Full description</b>. In "Built with" paste the <b>tags</b>. Add media: paste your <b>YouTube link</b> + upload your 2 screenshots. Next.</li>
  <li><b>Additional info</b> → Track = <b>Track 3: UiPath Test Cloud</b>. If asked coded vs low-code: <i>"Coded agent (Python uipath SDK), built with Claude Code, deployed to Orchestrator."</i> Paste your <b>deck link</b>. Next.</li>
  <li><b>Submit</b> → review → click <b>Submit</b>. Confirm it no longer says <code>DRAFT</code>.</li>
  <li><b>Best Product Feedback ($1,500):</b> find the feedback-form link in Devpost <b>Rules/Resources</b> → paste <a href="#fb">Product feedback</a> → submit.</li>
  <li><b>Final check:</b> open your project's public page in a private/incognito window — video plays, repo + deck links work, track shows Test Cloud. 🎉</li>
</ol>
<div class="note"><b>Housekeeping:</b> after you're done, rotate the Anthropic API key you pasted earlier (console.anthropic.com → API keys).</div>

<h2>③ Copy-paste boxes <span class="pill">click Copy</span></h2>
<div class="short">${block("name", "Project name", "SelfHeal QA — the testing agent that knows when not to heal")}</div>
<div class="short">${block("tag", "Tagline / elevator pitch", "A UiPath coded agent that writes and self-heals UI tests — and knows when a failed step is actually a real bug, so it files a defect instead of quietly healing past it.")}</div>
<div class="short">${block("tags", "Built with (tags)", "uipath, python, playwright, anthropic, claude-code, typescript")}</div>
${block("desc", "Full description (paste into About the project)", descBody)}
${block("deckt", "Deck text (10 slides)", deck)}
${block("fbt", "Product feedback (for the feedback form)", feedback)}

<h2 id="demo">④ Demo script (read while recording)</h2>
<pre>${esc(demo)}</pre>

<h2 id="links">Links</h2>
<ul>
  <li>Repo: <a href="https://github.com/yanzaaa/selfheal" target="_blank">github.com/yanzaaa/selfheal</a></li>
  <li>Hackathon: <a href="https://uipath-agenthack.devpost.com" target="_blank">uipath-agenthack.devpost.com</a></li>
  <li>UiPath dashboard: <a href="https://cloud.uipath.com/yanza/DefaultTenant/testmanager_/YAN/dashboard" target="_blank">YAN project</a></li>
</ul>

</div>
<script>
function cp(id){var t=document.getElementById(id);t.focus();t.select();try{document.execCommand('copy');}catch(e){}
  if(navigator.clipboard){navigator.clipboard.writeText(t.value).catch(function(){});}
  var b=event.target;var o=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=o;},1400);}
</script>
</body></html>`;

writeFileSync(here("./START-HERE.html"), html);
console.log("Wrote START-HERE.html (" + html.length + " bytes)");
