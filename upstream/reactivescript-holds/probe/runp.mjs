#!/usr/bin/env node
// node run.mjs <program> <step>...   steps: click:<button text>  wait:<ms>  snap
// Prints the text of every <p> at each snap.
import { chromium } from "playwright";
const [program, ...steps] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log(`  [uncaught] ${e.message}`));
await page.goto(`http://localhost:${process.env.PORT ?? "5195"}/?p=${program}`);
await page.waitForFunction(() => window.ready === true);
let at = "mount";
for (const step of steps) {
  const [kind, a] = step.split(":");
  if (kind === "click") {
    await page.evaluate((text) => [...document.querySelectorAll("button")].find((b) => b.textContent === text).click(), a);
    at = `click ${a}`;
  } else if (kind === "wait") { await page.waitForTimeout(Number(a)); at += ` +${a}ms`; }
  else if (kind === "snap")
    console.log(at.padEnd(34), await page.evaluate(() => [...document.querySelectorAll("p")].map((p) => p.textContent).join(" | ")));
}
await browser.close();
