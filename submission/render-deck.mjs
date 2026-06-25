// Renders SelfHeal-QA-Deck.pdf from deck.html so the PDF always matches the source.
import { chromium } from "playwright";

const url = new URL("./deck.html", import.meta.url).href;
const out = new URL("./SelfHeal-QA-Deck.pdf", import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.pdf({
  path: out,
  printBackground: true,
  width: "1280px",
  height: "720px",
  pageRanges: "1-",
});
await browser.close();
console.log("Rendered -> " + out);
