#!/usr/bin/env node
// Answers "can rs-ui rely on this natively?" from the Baseline project's own data.
//
// The library's rule is platform first: use a browser feature instead of JavaScript when the latest shipped
// Chrome, Firefox and Safari all have it. That set moves with every browser release, so it is computed here
// rather than written down:
//   pnpm baseline                     the features the library's design depends on
//   pnpm baseline popover dialog      any web-features ids (https://web-platform-dx.github.io/web-features-explorer)
// To refresh the data: pnpm up web-features @mdn/browser-compat-data
import bcd from "@mdn/browser-compat-data" with { type: "json" };
import { features } from "web-features";

const BROWSERS = ["chrome", "firefox", "safari"];
// What the components are built on, or would be if it shipped everywhere.
const TRACKED = [
  "dialog",
  "requestclose",
  "dialog-closedby",
  "popover",
  "popover-hint",
  "anchor-positioning",
  "invoker-commands",
  "interest-invokers",
  "details-name",
  "details-content",
  "interpolate-size",
  "starting-style",
  "transition-behavior",
  "overlay",
  "inert",
  "focusgroup",
  "customizable-select",
  "user-pseudos",
  "has",
  "field-sizing",
  "scrollbar-color",
  "scrollbar-width",
];

const released = Object.fromEntries(
  BROWSERS.map((browser) => [
    browser,
    new Set(
      Object.entries(bcd.browsers[browser].releases)
        .filter(([, release]) => release.status === "current" || release.status === "retired")
        .map(([version]) => version),
    ),
  ]),
);
const current = (browser) =>
  Object.entries(bcd.browsers[browser].releases).find(([, release]) => release.status === "current")?.[0];

const statements = (support) => (Array.isArray(support) ? support : [support]).filter(Boolean);
/** Shipped: in a released version, without a flag, complete, and not removed since. */
const shipped = (browser, support) =>
  statements(support).some(
    (s) =>
      !s.flags &&
      !s.partial_implementation &&
      !s.version_removed &&
      typeof s.version_added === "string" &&
      released[browser].has(s.version_added.replace("≤", "")),
  );
const describe = (support) =>
  statements(support)
    .map(
      (s) => `${s.version_added}${s.flags ? " (flag)" : ""}${s.partial_implementation ? " (partial)" : ""}`,
    )
    .join(" | ") || "no data";
// oxlint-disable-next-line no-underscore-dangle -- the data's own field name
const lookup = (key) => key.split(".").reduce((node, part) => node?.[part], bcd)?.__compat?.support;

console.log(`Latest shipped: ${BROWSERS.map((browser) => `${browser} ${current(browser)}`).join(", ")}\n`);
const ids = process.argv.length > 2 ? process.argv.slice(2) : TRACKED;
for (const id of ids) {
  const feature = features[id];
  if (!feature) {
    console.log(`?    ${id}: not a web-features id`);
    continue;
  }
  const keys = feature.compat_features ?? [];
  const missing = [];
  for (const key of keys) {
    const support = lookup(key);
    if (!support) continue;
    const lagging = BROWSERS.filter((browser) => !shipped(browser, support[browser]));
    if (lagging.length)
      missing.push(`${key}: ${lagging.map((b) => `${b} ${describe(support[b])}`).join(", ")}`);
  }
  const verdict = missing.length === 0 ? "yes " : missing.length === keys.length ? "no  " : "part";
  console.log(`${verdict} ${id} (${feature.name})`);
  for (const line of missing.slice(0, 6)) console.log(`       ${line}`);
  if (missing.length > 6) console.log(`       … and ${missing.length - 6} more`);
}
