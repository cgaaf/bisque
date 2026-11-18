// Fails a browser test during which Solid reported a diagnostic (`[STRICT_READ_UNTRACKED] …`).
//
// A browser's console doesn't reliably reach the terminal, so "no diagnostics in the output" proves nothing
// there. Solid's dev build reports through console.warn and console.error; this turns a report into a failure.
//
// Some diagnostics (an effect relaying a change into a signal, an untracked read in a cleanup) are only looked
// for while Solid's attribution engine is on, and their first sightings go to its structured channel, not the
// console. The docs dev server turns the engine on and Vitest doesn't, so it is turned on here for every test
// and the channel is read too.
import { OBSERVE } from "solid-js";
import { attribution } from "solid-js/attribution";
import { afterEach, beforeEach, expect } from "vitest";

// `VITE_TEMPORAL=polyfill pnpm test:browser src/calendar` runs the tests on the Temporal polyfill instead of the
// engine's own Temporal. Every test engine has Temporal natively, so this is the only way the path that a browser
// without it takes (Safari 27.2) is exercised with the components.
if (import.meta.env.VITE_TEMPORAL === "polyfill") {
  delete (globalThis as { Temporal?: unknown }).Temporal;
  // oxlint-disable-next-line import/no-unassigned-import -- the polyfill is loaded for its effect
  await import("temporal-polyfill/full/global");
}

const DIAGNOSTIC = /^\[[A-Z][A-Z_]+\]/;
// A scope over its time budget: how long a test takes depends on how busy the machine is (and Firefox's clock
// counts whole milliseconds), so it says nothing reliable about the code in a test run.
const TIMED = /^\[?HOT_SCOPE_[A-Z_]+\b/;
// A change held for more than half a second. The tests of a held prop and of a slow server hold one on purpose,
// for as long as the test takes; anywhere else it is a component keeping the screen waiting, and a failure.
const LONG_HOLD = /^\[?LONG_HOLD\b/;
const holdsOnPurpose = () => /\.(held|async)\.browser\.test\.ts$/.test(expect.getState().testPath ?? "");
const ignored = (code: string) => TIMED.test(code) || (LONG_HOLD.test(code) && holdsOnPurpose());
const reported: string[] = [];

for (const level of ["warn", "error"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (DIAGNOSTIC.test(first) && !ignored(first)) reported.push(first.split("\n")[0]);
    original(...args);
  };
}

type Diagnostic = { code: string; message: string; data?: { how?: string } };
let capture: { stop: () => unknown } | undefined;
let release: (() => void) | undefined;

beforeEach(() => {
  reported.length = 0;
  // OBSERVE exists in Solid's dev and observe builds, which are what tests run on.
  capture = OBSERVE?.diagnostics.capture();
  // The library narrows what it reads from a context with small equations that re-run and give the same value;
  // that is what they are for. Solid reports one once its discarded work passes 2ms in a second, which a busy
  // machine reaches by itself. 20ms is still far below a memo that is really doing wasted work.
  release = attribution.enable({
    log: false,
    wastedRecompute: { minRuns: 5, ratio: 0.8, budgetMs: 20, windowMs: 1000 },
  });
});

afterEach(() => {
  release?.();
  const structured = ((capture?.stop() ?? []) as Diagnostic[])
    // A guess that goes back because the request was refused is the feature working. One that is replaced by a
    // different answer ("superseded") is a flash of the wrong state, and stays a failure.
    .filter((event) => !(event.code === "OPTIMISTIC_REVERTED" && event.data?.how === "reverted"))
    .filter((event) => !ignored(event.code))
    .map((event) => `[${event.code}] ${event.message.split("\n")[0]}`);
  // oxlint-disable-next-line vitest/no-standalone-expect -- the hook runs inside each test, which is the point
  expect([...new Set([...reported, ...structured])], "Solid diagnostics reported during this test").toEqual(
    [],
  );
});
