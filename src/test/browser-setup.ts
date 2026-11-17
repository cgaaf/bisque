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

const DIAGNOSTIC = /^\[[A-Z][A-Z_]+\]/;
// Reports that measure time: a scope over its budget, a change held longer than a threshold. How long a test
// takes depends on how busy the machine is (and Firefox's clock counts whole milliseconds), and the tests that
// hold a change do it on purpose, so these say nothing reliable about the code in a test run.
const TIMED = /^\[?(HOT_SCOPE_[A-Z_]+|LONG_HOLD)\b/;
const reported: string[] = [];

for (const level of ["warn", "error"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (DIAGNOSTIC.test(first) && !TIMED.test(first)) reported.push(first.split("\n")[0]);
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
  release = attribution.enable({ log: false });
});

afterEach(() => {
  release?.();
  const structured = ((capture?.stop() ?? []) as Diagnostic[])
    // A guess that goes back because the request was refused is the feature working. One that is replaced by a
    // different answer ("superseded") is a flash of the wrong state, and stays a failure.
    .filter((event) => !(event.code === "OPTIMISTIC_REVERTED" && event.data?.how === "reverted"))
    .filter((event) => !TIMED.test(event.code))
    .map((event) => `[${event.code}] ${event.message.split("\n")[0]}`);
  // oxlint-disable-next-line vitest/no-standalone-expect -- the hook runs inside each test, which is the point
  expect([...new Set([...reported, ...structured])], "Solid diagnostics reported during this test").toEqual(
    [],
  );
});
