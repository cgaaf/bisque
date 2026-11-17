// Fails a browser test during which Solid reported a diagnostic (`[STRICT_READ_UNTRACKED] …`).
//
// A browser's console doesn't reliably reach the terminal, so "no diagnostics in the output" proves nothing
// there. Solid's dev build reports through console.warn and console.error; this turns a report into a failure.
import { afterEach, beforeEach, expect } from "vitest";

const DIAGNOSTIC = /^\[[A-Z][A-Z_]+\]/;
const reported: string[] = [];

for (const level of ["warn", "error"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (DIAGNOSTIC.test(first)) reported.push(first.split("\n")[0]);
    original(...args);
  };
}

beforeEach(() => {
  reported.length = 0;
});

afterEach(() => {
  expect(reported, "Solid diagnostics reported during this test").toEqual([]);
});
