#!/usr/bin/env node
// node run.mjs <probe> <step>...   steps: click:<id>  type:<id>:<text>  wait:<ms>  snap[:label]
// Prints the text of every [data-o] element at each snap, as id=text pairs.
import { chromium } from "playwright";
const [probe, ...steps] = process.argv.slice(2);
const port = process.env.PORT ?? "5195";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() !== "debug") console.log(`  [console.${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => console.log(`  [uncaught] ${e.message}`));
await page.goto(`http://localhost:${port}/?p=${probe}`);
await page.waitForFunction(() => window.ready === true);
const t0 = Date.now();
for (const step of steps) {
  const [kind, a, b] = step.split(":");
  if (kind === "click") await page.evaluate((id) => document.getElementById(id).click(), a);
  else if (kind === "type") await page.fill(`#${a}`, b);
  else if (kind === "wait") await page.waitForTimeout(Number(a));
  else if (kind === "snap") {
    const text = await page.evaluate(() =>
      [...document.querySelectorAll("[data-o]")].map((e) => `${e.dataset.o}=${e.textContent}`).join("  "));
    console.log(`${String(Date.now() - t0).padStart(5)}ms ${(a ?? "").padEnd(14)} ${text}`);
  }
}
await browser.close();
