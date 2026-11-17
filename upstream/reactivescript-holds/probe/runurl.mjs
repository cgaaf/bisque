#!/usr/bin/env node
// node runurl.mjs <path?query> <step>...   as run.mjs, for a page that is not an .rx probe
import { chromium } from "playwright";
const [path, ...steps] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log(`  [uncaught] ${e.message}`));
await page.goto(`http://localhost:${process.env.PORT ?? "5195"}/${path}`);
await page.waitForFunction(() => window.ready === true);
const t0 = Date.now();
for (const step of steps) {
  const [kind, a] = step.split(":");
  if (kind === "click") await page.evaluate((id) => document.getElementById(id).click(), a);
  else if (kind === "wait") await page.waitForTimeout(Number(a));
  else if (kind === "snap") {
    const text = await page.evaluate(() =>
      [...document.querySelectorAll("[data-o]")].map((e) => `${e.dataset.o}=${e.textContent}`).join("  "));
    console.log(`${String(Date.now() - t0).padStart(5)}ms ${(a ?? "").padEnd(14)} ${text}`);
  }
}
await browser.close();
