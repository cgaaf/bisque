#!/usr/bin/env node
// Loads a page of the running docs site in headless Chromium, reports what the console said, and saves a
// screenshot: a way to look at a page without the Browser pane.
//
//   node scripts/shoot-docs.mjs components/popover --out /tmp/popover.png
//     --port 5180          the dev server's port (pnpm docs -- --port 5180)
//     --dark               emulate a dark colour scheme
//     --mobile             a 390px-wide viewport instead of 1360px
//     --click "<selector>" click this before the screenshot (repeatable, in order)
//     --hover "<selector>" rest the pointer on this before the screenshot
//     --press "<key>"      press this key after the clicks (repeatable)
//     --at "<selector>"    scroll this into view first
//     --full               capture the whole page, not the viewport
import { chromium } from "playwright";

const args = process.argv.slice(2);
const route =
  args.find(
    (arg) =>
      !arg.startsWith("--") &&
      args[args.indexOf(arg) - 1]?.match(/^--(out|port|click|hover|press|at)$/) == null,
  ) ?? "";
const all = (name) => args.flatMap((arg, index) => (arg === `--${name}` ? [args[index + 1]] : []));
const flag = (name) => args.includes(`--${name}`);
const port = all("port")[0] ?? "5180";
const out = all("out")[0] ?? "docs-shot.png";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: flag("mobile") ? { width: 390, height: 800 } : { width: 1360, height: 900 },
  colorScheme: flag("dark") ? "dark" : "light",
});
const messages = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning")
    messages.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => messages.push(`uncaught: ${error.message}`));

await page.goto(`http://localhost:${port}/${route.replace(/^\/|\/$/g, "")}${route ? "/" : ""}`, {
  waitUntil: "networkidle",
});
// The steps are a sequence: each one acts on what the one before left.
/* oxlint-disable no-await-in-loop */
for (const selector of all("at")) await page.locator(selector).first().scrollIntoViewIfNeeded();
for (const selector of all("click")) await page.locator(selector).first().click();
for (const selector of all("hover")) await page.locator(selector).first().hover();
for (const key of all("press")) await page.keyboard.press(key);
/* oxlint-enable no-await-in-loop */
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: flag("full") });
await browser.close();

console.log(`saved ${out}`);
console.log(messages.length ? messages.join("\n") : "console: clean");
if (messages.some((message) => !message.startsWith("warning"))) process.exit(1);
